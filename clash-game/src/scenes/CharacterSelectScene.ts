import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_UI, STORY_LIVES, font } from '../config/constants';
import { CPU_DIFFICULTIES, CPU_DIFFICULTY, STAGE_INFO, STAGE_ORDER, resolveStage, type StagePick } from '../config/stages';
import { CHARACTERS, STORY_ROSTER, VS_ROSTER, isStoryChar } from '../characters';
import { ARCADE_RUNG_LABEL, newArcadeRun, type ArcadeRun } from '../config/arcade';
import type { GameContext, SceneMap } from '../core/StateManager';
import type { CharId, CharacterDef, StoryCharId } from '../physics/Types';
import type { StageTheme } from '../rendering/Renderer';
import { idlePose } from '../rendering/SpriteRenderer';
import { Scene } from './Scene';

const STAGE_PICKS: StagePick[] = [...STAGE_ORDER, 'random'];

interface RosterEntry {
  id: CharId;
  def: CharacterDef;
  accent: string;
  glow: string;
}

const STYLE: Record<CharId, { accent: string; glow: string }> = {
  slade: { accent: COLORS.void, glow: COLORS.voidGlow },
  freckles: { accent: COLORS.bone, glow: COLORS.silver },
  whitelie: { accent: '#ffd21f', glow: '#ffe38a' },
  fiddlejay: { accent: '#ffb13b', glow: '#ffd27a' },
};

const entry = (id: CharId): RosterEntry => ({ id, def: CHARACTERS[id], ...STYLE[id] });
const STORY_CARDS: RosterEntry[] = STORY_ROSTER.map(entry);
const VS_CARDS: RosterEntry[] = VS_ROSTER.map(entry);

const ROUTES: Record<StoryCharId, { foes: string; boss: string; story: string }> = {
  slade: {
    foes: 'CLOWNBOTS',
    boss: 'FRECKLES',
    story: 'The Iron Syndicate cloned Freckles into an army of spike-fisted Clownbots. Cut through them and reach the real one.',
  },
  freckles: {
    foes: 'NINJABOTS',
    boss: 'SLADE',
    story: 'Slade\'s stolen ninpo powers a swarm of shuriken-throwing Ninjabots. Smash the factory line and drag him out of the Sanctuary.',
  },
};

const SPLASH_FRAMES = 110;
const TILE_X0 = 36;
const TILE_STEP = 226;
const TILE_Y = 66;
const TILE_W = 210;
const TILE_H = 190;
const STORY_CONFIRM_FRAMES = 70;

type Who = 'P1' | 'P2' | 'CPU' | 'DUMMY';

type Costume = 'normal' | 'alt';

interface Cursor {
  who: Who;
  slot: number;
  index: number;
  locked: boolean;
  lockT: number;
  color: string;
  costume: Costume;
}

type Phase = 'pick' | 'stage' | 'splash' | 'story';

export class CharacterSelectScene extends Scene {
  private cursors: Cursor[];
  private phase: Phase = 'pick';
  private phaseT = 0;
  private t = 0;
  private flash = 0;
  /** Story mode offers the two protagonists; versus opens the full roster. */
  private readonly roster: RosterEntry[];
  private stageIndex = STAGE_PICKS.indexOf('rooftop');
  /** Concrete stage once the player confirms (random is rolled at that moment so the splash can name it). */
  private stageChoice: StageTheme = 'rooftop';
  /** Arcade: the ladder is rolled when Player 1 locks so the footer can preview it. */
  private arcadeRun: ArcadeRun | null = null;

  constructor(game: GameContext, private readonly params: SceneMap['select']) {
    super(game);
    this.roster = params.mode === 'story' ? STORY_CARDS : VS_CARDS;
    const p1: Cursor = { who: 'P1', slot: 0, index: 0, locked: false, lockT: 0, color: COLORS.voidGlow, costume: 'normal' };
    if (params.mode === 'story' || params.mode === 'arcade') this.cursors = [p1];
    else if (params.mode === 'training') this.cursors = [p1, { who: 'DUMMY', slot: 0, index: 1, locked: false, lockT: 0, color: '#b8c0cc', costume: 'normal' }];
    else if (params.cpu) this.cursors = [p1, { who: 'CPU', slot: 0, index: 1, locked: false, lockT: 0, color: '#b8c0cc', costume: 'normal' }];
    else this.cursors = [p1, { who: 'P2', slot: 1, index: 1, locked: false, lockT: 0, color: COLORS.bone, costume: 'normal' }];
  }

  private get mode() {
    return this.params.mode;
  }

  /** The fighter on the right of the preview: the second cursor, or the first arcade opponent. */
  private second(): RosterEntry {
    if (this.cursors.length > 1) return this.roster[this.cursors[1].index];
    const id = this.arcadeRun?.ladder[0] ?? this.roster[(this.cursors[0].index + 1) % this.roster.length].id;
    return this.roster.find((r) => r.id === id) ?? this.roster[0];
  }

  private secondWho(): string {
    return this.cursors.length > 1 ? this.cursors[1].who : 'CPU';
  }

  /** Final costumes for the two versus picks; a mirror match forces the second fighter into the other colour. */
  private costumes(): [Costume, Costume] {
    const [a, b] = this.cursors;
    if (!b) return [a.costume, 'normal'];
    let v2 = b.costume;
    if (this.roster[a.index].id === this.roster[b.index].id && v2 === a.costume) v2 = v2 === 'alt' ? 'normal' : 'alt';
    return [a.costume, v2];
  }

  /** Ladders fight all four, so the start-stage pick is where the tour begins; the finale is always the Sanctuary. */
  private launch(): void {
    const [v1, v2] = this.costumes();
    const p1 = this.roster[this.cursors[0].index].id;
    if (this.mode === 'training') {
      this.game.scenes.go('training', { p1, p2: this.second().id, stage: this.stageChoice, v1, v2 });
      return;
    }
    if (this.mode === 'arcade') {
      const run = this.arcadeRun ?? newArcadeRun(p1, this.stageChoice);
      run.startStage = this.stageChoice;
      this.game.scenes.go('vs', { p1, p2: run.ladder[0], cpu: true, stage: this.stageChoice, v1, arcade: run });
      return;
    }
    this.game.scenes.go('vs', { p1, p2: this.second().id, cpu: this.params.cpu, stage: this.stageChoice, v1, v2 });
  }

  enter(): void {
    this.game.audio.startMusic(this.params.mode === 'story' ? 'title' : 'versus');
  }

  /** In CPU mode the human picks both fighters in sequence; the CPU cursor is only live once P1 has locked. */
  private activeCursors(): Cursor[] {
    if (this.params.cpu && this.cursors.length > 1) {
      const [p1, cpu] = this.cursors;
      return p1.locked ? (cpu.locked ? [] : [cpu]) : [p1];
    }
    return this.cursors.filter((c) => !c.locked);
  }

  update(): void {
    this.t++;
    if (this.flash > 0) this.flash--;
    for (const c of this.cursors) if (c.locked) c.lockT++;
    if (this.game.scenes.transitioning) return;
    const audio = this.game.audio;
    const input = this.game.input;

    if (this.phase === 'splash') {
      if (++this.phaseT >= SPLASH_FRAMES || (this.phaseT > 30 && input.menu().confirm)) this.launch();
      return;
    }
    if (this.phase === 'stage') {
      this.phaseT++;
      this.updateStagePick();
      return;
    }
    if (this.phase === 'story') {
      if (++this.phaseT >= STORY_CONFIRM_FRAMES || (this.phaseT > 20 && input.menu().confirm)) {
        const id = this.roster[this.cursors[0].index].id;
        this.game.scenes.go('story', { char: isStoryChar(id) ? id : 'slade', stage: 0, score: 0, lives: STORY_LIVES });
      }
      return;
    }

    for (const c of this.activeCursors()) {
      const left = input.slotPressed(c.slot, 'left');
      const right = input.slotPressed(c.slot, 'right');
      if (left || right) {
        c.index = (c.index + (right ? 1 : this.roster.length - 1)) % this.roster.length;
        if (!this.game.save.isAltUnlocked(this.roster[c.index].id)) c.costume = 'normal';
        audio.playSelect();
      }
      if (this.mode !== 'story' && (input.slotPressed(c.slot, 'up') || input.slotPressed(c.slot, 'down'))) {
        if (this.game.save.isAltUnlocked(this.roster[c.index].id)) {
          c.costume = c.costume === 'alt' ? 'normal' : 'alt';
          audio.playSelect();
        } else {
          audio.playBack();
        }
      }
      if (input.slotConfirm(c.slot)) {
        c.locked = true;
        c.lockT = 0;
        this.flash = 10;
        audio.playConfirm();
        audio.playTaunt(this.roster[c.index].def.voice, 0);
        if (this.mode === 'arcade' && c.who === 'P1') this.arcadeRun = newArcadeRun(this.roster[c.index].id, this.stageChoice);
        if (c.who !== 'P1') return;
      }
    }

    for (const slot of [0, 1]) {
      if (!input.slotBack(slot)) continue;
      const owned = slot === 0 ? this.cursors : this.cursors.filter((c) => c.slot === slot);
      const lockedOwned = owned.filter((c) => c.locked);
      if (lockedOwned.length > 0) {
        lockedOwned[lockedOwned.length - 1].locked = false;
        audio.playBack();
      } else if (slot === 0) {
        audio.playBack();
        this.game.scenes.go('title', {});
        return;
      }
    }

    if (this.cursors.every((c) => c.locked)) {
      this.phaseT = 0;
      this.phase = this.mode === 'story' ? 'story' : 'stage';
    }
  }

  /** Stage (and, against the CPU, difficulty) selection. Player 1 drives it; Back returns to the roster. */
  private updateStagePick(): void {
    const input = this.game.input;
    const audio = this.game.audio;
    const n = STAGE_PICKS.length;
    if (input.slotPressed(0, 'left')) {
      this.stageIndex = (this.stageIndex + n - 1) % n;
      audio.playSelect();
    }
    if (input.slotPressed(0, 'right')) {
      this.stageIndex = (this.stageIndex + 1) % n;
      audio.playSelect();
    }
    if (this.mode === 'versus' && this.params.cpu) {
      const levels = CPU_DIFFICULTIES;
      const cur = levels.indexOf(this.game.save.settings.cpuDifficulty);
      if (input.slotPressed(0, 'up')) {
        this.game.save.settings.cpuDifficulty = levels[(cur + 1) % levels.length];
        this.game.save.save();
        audio.playSelect();
      } else if (input.slotPressed(0, 'down')) {
        this.game.save.settings.cpuDifficulty = levels[(cur + levels.length - 1) % levels.length];
        this.game.save.save();
        audio.playSelect();
      }
    }
    if (input.slotBack(0) || input.slotBack(1)) {
      const locked = this.cursors.filter((c) => c.locked);
      locked[locked.length - 1].locked = false;
      this.phase = 'pick';
      audio.playBack();
      return;
    }
    if (this.phaseT > 8 && (input.slotConfirm(0) || input.slotConfirm(1))) {
      this.stageChoice = resolveStage(STAGE_PICKS[this.stageIndex]);
      this.phase = 'splash';
      this.phaseT = 0;
      this.flash = 10;
      audio.playConfirm();
      audio.playBell();
    }
  }

  private hoveredStage(): StageTheme {
    const pick = STAGE_PICKS[this.stageIndex];
    if (pick !== 'random') return pick;
    return STAGE_ORDER[Math.floor(this.t / 45) % STAGE_ORDER.length];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const time = g.time;
    const stagePhase = this.phase === 'stage' || (this.phase === 'splash' && this.mode !== 'story');
    const w = g.renderer.beginWorld();
    const story = this.mode === 'story';
    if (stagePhase) {
      this.drawStagePreviewWorld(w, time);
    } else {
      g.renderer.drawStage(story ? 'facility' : 'rooftop', 0, 0, time, CANVAS_WIDTH);
      w.fillStyle = 'rgba(5,3,12,0.72)';
      w.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (story) this.roster.forEach((_, i) => this.drawCardBack(w, i, 60 + i * 430, 76, 410, 392, time));
      else this.roster.forEach((_, i) => this.drawTileBack(w, i, TILE_X0 + i * TILE_STEP, TILE_Y, TILE_W, TILE_H, time));
    }
    g.renderer.drawVignette();
    g.renderer.endWorld();

    const heading = stagePhase
      ? this.mode === 'arcade'
        ? 'ARCADE LADDER  —  CHOOSE YOUR STARTING STAGE'
        : this.mode === 'training'
          ? 'TRAINING  —  CHOOSE YOUR ROOM'
          : this.params.cpu
            ? 'CHOOSE YOUR STAGE  —  SET CPU LEVEL'
            : 'CHOOSE YOUR STAGE'
      : this.mode === 'story'
        ? 'STORY MODE  —  CHOOSE YOUR FIGHTER'
        : this.mode === 'arcade'
          ? 'ARCADE LADDER  —  CHOOSE YOUR FIGHTER'
          : this.mode === 'training'
            ? this.cursors[0].locked
              ? 'TRAINING  —  CHOOSE THE DUMMY'
              : 'TRAINING  —  CHOOSE YOUR FIGHTER'
            : this.params.cpu
              ? this.cursors[0].locked
                ? 'VERSUS CPU  —  CHOOSE YOUR OPPONENT'
                : 'VERSUS CPU  —  CHOOSE YOUR FIGHTER'
              : 'VERSUS  —  BOTH PLAYERS CHOOSE';
    g.ui.text(ctx, heading, CANVAS_WIDTH / 2, 48, 26, '#ffffff', { stroke: '#000', strokeWidth: 5, shadow: 'rgba(138,77,255,0.7)' });

    if (stagePhase) {
      if (this.phase === 'stage') this.drawStageCards(ctx, time);
    } else if (story) this.roster.forEach((_, i) => this.drawCardFront(ctx, i, 60 + i * 430, 76, 410, 392, time));
    else {
      this.roster.forEach((_, i) => this.drawTileFront(ctx, i, TILE_X0 + i * TILE_STEP, TILE_Y, TILE_W, TILE_H, time));
      this.cursors.forEach((c, k) => this.drawDetail(ctx, c, 36 + k * 452, 268, 436, 202));
      if (this.mode === 'arcade') this.drawLadderCard(ctx, 488, 268, 436, 202, time);
    }
    this.drawFooter(ctx, time);

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = (this.flash / 10) * 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
    if (this.phase === 'splash') this.drawSplash(ctx, time);
  }

  private drawCardBack(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number, time: number): void {
    const r = this.roster[i];
    const def = r.def;
    const here = this.cursors.filter((c) => c.index === i);
    const hovered = here.length > 0;
    const lockedHere = here.filter((c) => c.locked);

    ctx.save();
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, hovered ? 'rgba(30,18,52,0.95)' : 'rgba(14,10,24,0.88)');
    bg.addColorStop(1, 'rgba(6,4,12,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    const glow = ctx.createRadialGradient(x + 95, y + 230, 10, x + 95, y + 230, 190);
    glow.addColorStop(0, hovered ? `${r.accent}66` : `${r.accent}22`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    const feetY = y + 268;
    const locked = lockedHere.length > 0;
    const pose = idlePose(def.archetype, time + i * 37);
    const bounce = locked ? Math.max(0, 6 - lockedHere[0].lockT) * 1.5 : 0;
    this.game.renderer.withSprites((s) => {
      s.fillStyle = 'rgba(0,0,0,0.5)';
      s.beginPath();
      s.ellipse(x + 95, feetY, 62, 11, 0, 0, Math.PI * 2);
      s.fill();
      this.game.sprites.drawBody(s, def.archetype, 'normal', pose, x + 95, feetY - bounce, 1, 1.75, time, null);
      if (lockedHere.length > 1) {
        s.globalAlpha = 0.85;
        this.game.sprites.drawBody(s, def.archetype, 'alt', idlePose(def.archetype, time + 20), x + 150, feetY + 6, -1, 1.3, time, null);
      }
    });
  }

  private drawCardFront(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number, time: number): void {
    const ui = this.game.ui;
    const r = this.roster[i];
    const def = r.def;
    const here = this.cursors.filter((c) => c.index === i);
    const hovered = here.length > 0;
    const lockedHere = here.filter((c) => c.locked);

    ctx.save();
    ctx.lineWidth = hovered ? 3 : 1;
    ctx.strokeStyle = hovered ? r.accent : 'rgba(255,255,255,0.14)';
    if (hovered) {
      ctx.shadowColor = r.accent;
      ctx.shadowBlur = 18 + 6 * Math.sin(time * 0.1);
    }
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();

    const tx = x + 196;
    ui.text(ctx, def.name, tx, y + 44, 30, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 5 });
    ui.text(ctx, def.title.toUpperCase(), tx, y + 64, 12, r.glow, { align: 'left', template: FONT_UI });
    const s = def.stats;
    ui.text(ctx, `HP ${s.maxHp}   SPD ${s.speed}   DEF ${s.defense}   JMP ${s.jumpPower}`, tx, y + 82, 10, 'rgba(255,255,255,0.5)', {
      align: 'left',
      template: FONT_UI,
    });
    const rt = def.ratings ?? { power: 3, speed: 3, range: 3, defense: 3 };
    ui.statBar(ctx, 'POWER', rt.power, tx, y + 94, r.accent);
    ui.statBar(ctx, 'SPEED', rt.speed, tx, y + 110, r.accent);
    ui.statBar(ctx, 'RANGE', rt.range, tx, y + 126, r.accent);
    ui.statBar(ctx, 'DEFENSE', rt.defense, tx, y + 142, r.accent);
    this.wrap(ctx, def.blurb ?? '', tx, y + 172, w - 212, 15, 12, 'rgba(255,255,255,0.78)');

    const my = y + 292;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 12, my - 14, w - 24, 1);
    ctx.restore();
    const moves = def.moveList ?? [];
    const step = moves.length > 4 ? 20 : 24;
    moves.forEach((m, k) => {
      const yy = my + 6 + k * step;
      ui.text(ctx, m.name, x + 18, yy, 12, '#ffffff', { align: 'left', template: FONT_UI });
      ui.text(ctx, m.input, x + w - 18, yy, 12, COLORS.hazard, { align: 'right', template: FONT_UI });
      ui.text(ctx, m.desc, x + 18, yy + 12, 10, 'rgba(255,255,255,0.5)', { align: 'left', template: FONT_UI });
    });

    here.forEach((c, k) => {
      const bx = x + 14 + k * 58;
      const by = y + 12;
      const bob = c.locked ? 0 : Math.sin(time * 0.15 + k) * 2;
      ctx.save();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.moveTo(bx, by + bob);
      ctx.lineTo(bx + 50, by + bob);
      ctx.lineTo(bx + 44, by + 22 + bob);
      ctx.lineTo(bx - 6, by + 22 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ui.text(ctx, c.who, bx + 22, by + 17 + bob, 14, '#0a0612');
    });

    lockedHere.forEach((c, k) => {
      const pop = Math.min(1, c.lockT / 8);
      const sc = 1.6 - 0.6 * pop;
      ctx.save();
      ctx.translate(x + 95, y + 150 + k * 44);
      ctx.rotate(-0.12);
      ctx.scale(sc, sc);
      ctx.globalAlpha = pop;
      ui.text(ctx, c.who === 'CPU' ? 'CPU READY' : `${c.who} READY`, 0, 0, 24, c.color, { stroke: '#000', strokeWidth: 6 });
      ctx.restore();
    });
  }

  private drawTileBack(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number, time: number): void {
    const r = this.roster[i];
    const def = r.def;
    const here = this.cursors.filter((c) => c.index === i);
    const hovered = here.length > 0;
    const lockedHere = here.filter((c) => c.locked);

    ctx.save();
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, hovered ? 'rgba(30,18,52,0.95)' : 'rgba(14,10,24,0.88)');
    bg.addColorStop(1, 'rgba(6,4,12,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    const glow = ctx.createRadialGradient(x + w / 2, y + h - 40, 6, x + w / 2, y + h - 40, 120);
    glow.addColorStop(0, hovered ? `${r.accent}66` : `${r.accent}22`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    const feetY = y + 150;
    const pose = idlePose(def.archetype, time + i * 37);
    const bounce = lockedHere.length > 0 ? Math.max(0, 6 - lockedHere[0].lockT) * 1.5 : 0;
    const main = here[0]?.costume ?? 'normal';
    const second = here.length > 1 ? (here[1].costume === main ? (main === 'alt' ? 'normal' : 'alt') : here[1].costume) : null;
    this.game.renderer.withSprites((s) => {
      s.fillStyle = 'rgba(0,0,0,0.5)';
      s.beginPath();
      s.ellipse(x + w / 2, feetY, 46, 8, 0, 0, Math.PI * 2);
      s.fill();
      this.game.sprites.drawBody(s, def.archetype, main, pose, x + w / 2 - 6, feetY - bounce, 1, 1.25, time, null);
      if (second) {
        s.globalAlpha = 0.85;
        this.game.sprites.drawBody(s, def.archetype, second, idlePose(def.archetype, time + 20), x + w / 2 + 40, feetY + 4, -1, 0.95, time, null);
      }
    });
  }

  private drawTileFront(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number, time: number): void {
    const ui = this.game.ui;
    const r = this.roster[i];
    const def = r.def;
    const here = this.cursors.filter((c) => c.index === i);
    const hovered = here.length > 0;
    const lockedHere = here.filter((c) => c.locked);

    ctx.save();
    ctx.lineWidth = hovered ? 3 : 1;
    ctx.strokeStyle = hovered ? r.accent : 'rgba(255,255,255,0.14)';
    if (hovered) {
      ctx.shadowColor = r.accent;
      ctx.shadowBlur = 18 + 6 * Math.sin(time * 0.1);
    }
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();

    ui.text(ctx, def.name, x + w / 2, y + h - 22, 18, '#ffffff', { stroke: '#000', strokeWidth: 4 });
    ui.text(ctx, def.title.toUpperCase(), x + w / 2, y + h - 8, 10, r.glow, { template: FONT_UI });
    const altUnlocked = this.game.save.isAltUnlocked(r.id);
    if (altUnlocked) ui.text(ctx, hovered ? '▲▼ COSTUME' : 'ALT ✓', x + w - 8, y + 22, 9, hovered ? COLORS.hazard : 'rgba(255,255,255,0.45)', { align: 'right', template: FONT_UI });

    here.forEach((c, k) => {
      const bx = x + 10 + k * 56;
      const by = y + 10;
      const bob = c.locked ? 0 : Math.sin(time * 0.15 + k) * 2;
      ctx.save();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.moveTo(bx, by + bob);
      ctx.lineTo(bx + 48, by + bob);
      ctx.lineTo(bx + 42, by + 20 + bob);
      ctx.lineTo(bx - 6, by + 20 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ui.text(ctx, c.who, bx + 21, by + 15 + bob, 13, '#0a0612');
      if (c.costume === 'alt') ui.text(ctx, 'ALT', bx + 18, by + 34 + bob, 9, c.color, { template: FONT_UI, stroke: '#000', strokeWidth: 2 });
    });

    lockedHere.forEach((c, k) => {
      const pop = Math.min(1, c.lockT / 8);
      const sc = 1.6 - 0.6 * pop;
      ctx.save();
      ctx.translate(x + w / 2, y + 70 + k * 30);
      ctx.rotate(-0.12);
      ctx.scale(sc, sc);
      ctx.globalAlpha = pop;
      ui.text(ctx, c.who === 'CPU' ? 'CPU READY' : `${c.who} READY`, 0, 0, 20, c.color, { stroke: '#000', strokeWidth: 5 });
      ctx.restore();
    });
  }

  /** Versus-mode detail panel for one cursor's hovered fighter: stats on the left, move list on the right. */
  private drawDetail(ctx: CanvasRenderingContext2D, c: Cursor, x: number, y: number, w: number, h: number): void {
    const ui = this.game.ui;
    const r = this.roster[c.index];
    const def = r.def;
    ui.panel(ctx, x, y, w, h, 'rgba(8,6,18,0.9)');
    ctx.save();
    ctx.strokeStyle = c.locked ? c.color : `${c.color}66`;
    ctx.lineWidth = c.locked ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = c.color;
    ctx.fillRect(x, y, 6, h);
    ctx.restore();

    const tx = x + 20;
    ui.text(ctx, c.who, x + 214, y + 22, 13, c.color, { align: 'right', template: FONT_UI });
    ui.text(ctx, def.name, tx, y + 30, 24, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 4 });
    ui.text(ctx, def.title.toUpperCase(), tx, y + 46, 11, r.glow, { align: 'left', template: FONT_UI });
    const s = def.stats;
    ui.text(ctx, `HP ${s.maxHp}   SPD ${s.speed}   DEF ${s.defense}   JMP ${s.jumpPower}`, tx, y + 62, 10, 'rgba(255,255,255,0.5)', { align: 'left', template: FONT_UI });
    const rt = def.ratings ?? { power: 3, speed: 3, range: 3, defense: 3 };
    ui.statBar(ctx, 'POWER', rt.power, tx, y + 74, r.accent);
    ui.statBar(ctx, 'SPEED', rt.speed, tx, y + 90, r.accent);
    ui.statBar(ctx, 'RANGE', rt.range, tx, y + 106, r.accent);
    ui.statBar(ctx, 'DEFENSE', rt.defense, tx, y + 122, r.accent);
    this.wrap(ctx, def.blurb ?? '', tx, y + 146, 196, 12, 10, 'rgba(255,255,255,0.72)');

    const mx = x + 232;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(mx - 12, y + 14, 1, h - 28);
    ctx.restore();
    const moves = def.moveList ?? [];
    const dense = moves.length > 4;
    const step = dense ? 34 : 42;
    moves.forEach((m, k) => {
      const yy = y + 30 + k * step;
      ui.text(ctx, m.name, mx, yy, 12, '#ffffff', { align: 'left', template: FONT_UI });
      ui.text(ctx, m.input, x + w - 14, yy, 11, COLORS.hazard, { align: 'right', template: FONT_UI });
      if (dense) ui.text(ctx, this.ellipsis(ctx, m.desc, w - 232 - 14, 9), mx, yy + 13, 9, 'rgba(255,255,255,0.5)', { align: 'left', template: FONT_UI });
      else this.wrap(ctx, m.desc, mx, yy + 13, w - 232 - 14, 11, 9, 'rgba(255,255,255,0.5)');
    });
  }

  /** Arcade: the rungs ahead, revealed once Player 1 has locked in. */
  private drawLadderCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number): void {
    const ui = this.game.ui;
    ui.panel(ctx, x, y, w, h, 'rgba(8,6,18,0.9)');
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,31,0.5)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = COLORS.hazard;
    ctx.fillRect(x, y, 6, h);
    ctx.restore();
    ui.text(ctx, 'THE LADDER', x + 20, y + 30, 24, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 4 });
    const run = this.arcadeRun;
    if (!run) {
      ui.text(ctx, 'LOCK IN TO SEE YOUR BRACKET', x + 20, y + 50, 11, COLORS.hazard, { align: 'left', template: FONT_UI });
      this.wrap(ctx, 'Three rivals in a random order, each one a level tougher than the last. Beat them all and a shadow wearing your own colours waits in the Sanctuary.', x + 20, y + 76, w - 40, 15, 12, 'rgba(255,255,255,0.75)');
      return;
    }
    run.ladder.forEach((id, i) => {
      const def = CHARACTERS[id];
      const final = i === run.ladder.length - 1;
      const yy = y + 62 + i * 34;
      const glow = final ? COLORS.hazard : STYLE[id].glow;
      ctx.save();
      ctx.fillStyle = final ? 'rgba(255,210,31,0.12)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 20, yy - 10, 32, 32);
      ctx.restore();
      this.game.sprites.drawBust(ctx, def.archetype, final ? 'boss' : 'normal', x + 20, yy - 10, 32, 1, time + i * 23);
      ui.text(ctx, `${i + 1}`, x + 70, yy + 4, 12, 'rgba(255,255,255,0.45)', { align: 'left', template: FONT_UI });
      ui.text(ctx, final ? `SHADOW ${def.name}` : def.name, x + 90, yy + 5, 15, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 3 });
      ui.text(ctx, ARCADE_RUNG_LABEL[Math.min(i, ARCADE_RUNG_LABEL.length - 1)], x + w - 16, yy + 4, 11, glow, { align: 'right', template: FONT_UI });
    });
  }

  /** Live preview of the hovered stage with both picked fighters squaring off on it. */
  private drawStagePreviewWorld(w: CanvasRenderingContext2D, time: number): void {
    const theme = this.phase === 'splash' ? this.stageChoice : this.hoveredStage();
    this.game.renderer.drawStage(theme, 0, 0, time, CANVAS_WIDTH);
    const a = this.roster[this.cursors[0].index].def;
    const b = this.second().def;
    const [v1, v2] = this.costumes();
    const floor = 392;
    this.game.renderer.withSprites((s) => {
      for (const [def, x, facing, variant] of [
        [a, 330, 1, v1],
        [b, 630, -1, v2],
      ] as const) {
        s.fillStyle = 'rgba(0,0,0,0.45)';
        s.beginPath();
        s.ellipse(x, floor, 30 * def.scale, 6, 0, 0, Math.PI * 2);
        s.fill();
        this.game.sprites.drawBody(s, def.archetype, variant, idlePose(def.archetype, time + (facing > 0 ? 0 : 30)), x, floor, facing, def.scale, time, null);
      }
    });
    w.fillStyle = 'rgba(5,3,12,0.3)';
    w.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  private drawStageCards(ctx: CanvasRenderingContext2D, time: number): void {
    const ui = this.game.ui;
    const n = STAGE_PICKS.length;
    const cw = 118;
    const ch = 58;
    const gap = 8;
    const x0 = (CANVAS_WIDTH - (n * cw + (n - 1) * gap)) / 2;
    const y = 404;
    STAGE_PICKS.forEach((pick, i) => {
      const x = x0 + i * (cw + gap);
      const hovered = i === this.stageIndex;
      ctx.save();
      if (pick === 'random') {
        const hue = (time * 2) % 360;
        const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
        g.addColorStop(0, `hsl(${hue}, 60%, 28%)`);
        g.addColorStop(1, `hsl(${(hue + 90) % 360}, 60%, 18%)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cw, ch);
        ui.text(ctx, '?', x + cw / 2, y + 30, 26, '#ffffff', { stroke: '#000', strokeWidth: 4 });
      } else {
        const info = STAGE_INFO[pick];
        const g = ctx.createLinearGradient(0, y, 0, y + ch);
        g.addColorStop(0, info.sky[0]);
        g.addColorStop(0.7, info.sky[1]);
        g.addColorStop(0.71, info.ground);
        g.addColorStop(1, '#0a0810');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cw, ch);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let k = 0; k < 5; k++) {
          const bw = 10 + ((i * 7 + k * 13) % 14);
          const bh = 10 + ((i * 11 + k * 17) % 22);
          ctx.fillRect(x + 6 + k * 22, y + ch * 0.7 - bh, bw, bh);
        }
      }
      ctx.globalAlpha = hovered ? 1 : 0.55;
      ctx.lineWidth = hovered ? 3 : 1;
      ctx.strokeStyle = hovered ? '#ffffff' : 'rgba(255,255,255,0.3)';
      if (hovered) {
        ctx.shadowColor = pick === 'random' ? '#ffffff' : STAGE_INFO[pick].accent;
        ctx.shadowBlur = 16 + 6 * Math.sin(time * 0.12);
      }
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      ctx.restore();
      const label = pick === 'random' ? 'RANDOM' : STAGE_INFO[pick].name.replace('THE ', '');
      ui.text(ctx, label, x + cw / 2, y + ch + 14, 9, hovered ? '#ffffff' : 'rgba(255,255,255,0.55)', { template: FONT_UI });
    });

    // name + tagline of the hovered stage, floating above the cards
    const pick = STAGE_PICKS[this.stageIndex];
    const info = pick === 'random' ? null : STAGE_INFO[pick];
    ui.text(ctx, info ? info.name : 'RANDOM STAGE', CANVAS_WIDTH / 2, 92, 22, info ? info.accent : '#ffffff', { stroke: '#000', strokeWidth: 5 });
    ui.text(ctx, info ? info.tagline : 'Roll the dice. The city picks the battleground.', CANVAS_WIDTH / 2, 112, 13, 'rgba(255,255,255,0.8)', { template: FONT_UI });

    if (this.mode === 'arcade' && this.arcadeRun) {
      const names = this.arcadeRun.ladder.map((id, i) => (i === this.arcadeRun!.ladder.length - 1 ? `SHADOW ${CHARACTERS[id].name}` : CHARACTERS[id].name));
      ui.panel(ctx, CANVAS_WIDTH / 2 - 250, 150, 500, 54, 'rgba(8,6,18,0.86)');
      ui.text(ctx, 'THE LADDER', CANVAS_WIDTH / 2, 170, 12, COLORS.hazard, { template: FONT_UI });
      ui.text(ctx, names.join('  ›  '), CANVAS_WIDTH / 2, 192, 13, '#ffffff', { stroke: '#000', strokeWidth: 3 });
    } else if (this.mode === 'training') {
      ui.panel(ctx, CANVAS_WIDTH / 2 - 250, 150, 500, 54, 'rgba(8,6,18,0.86)');
      ui.text(ctx, 'TRAINING ROOM', CANVAS_WIDTH / 2, 170, 12, COLORS.hazard, { template: FONT_UI });
      ui.text(ctx, 'Infinite health  ·  hitboxes  ·  frame data  ·  dummy record & playback', CANVAS_WIDTH / 2, 192, 12, 'rgba(255,255,255,0.8)', { template: FONT_UI });
    } else if (this.params.cpu) {
      const d = CPU_DIFFICULTY[this.game.save.settings.cpuDifficulty];
      const bob = Math.sin(time * 0.15) * 2;
      ui.panel(ctx, CANVAS_WIDTH / 2 - 190, 150, 380, 54, 'rgba(8,6,18,0.86)');
      ui.text(ctx, '▲', CANVAS_WIDTH / 2 - 160, 172 - bob, 10, COLORS.hazard);
      ui.text(ctx, '▼', CANVAS_WIDTH / 2 - 160, 196 + bob, 10, COLORS.hazard);
      ui.text(ctx, `CPU LEVEL: ${d.label}`, CANVAS_WIDTH / 2 + 10, 176, 16, '#ffffff', { stroke: '#000', strokeWidth: 3 });
      ui.text(ctx, d.desc, CANVAS_WIDTH / 2 + 10, 195, 12, 'rgba(255,255,255,0.65)', { template: FONT_UI });
    }

    const a = this.roster[this.cursors[0].index];
    const b = this.second();
    ui.text(ctx, a.def.name, 330, 272, 16, a.glow, { stroke: '#000', strokeWidth: 4 });
    ui.text(ctx, b.def.name, 630, 272, 16, b.glow, { stroke: '#000', strokeWidth: 4 });
  }

  private drawFooter(ctx: CanvasRenderingContext2D, time: number): void {
    const ui = this.game.ui;
    const y = 480;
    ui.panel(ctx, 60, y, CANVAS_WIDTH - 120, 44, 'rgba(8,6,18,0.9)');
    if (this.phase === 'stage') {
      const touch = this.game.input.touchMode;
      const level = this.mode === 'versus' && this.params.cpu;
      const help = touch
        ? `Stick left / right to choose a stage${level ? '   ·   up / down CPU level' : ''}   ·   ATK to ${this.mode === 'training' ? 'train' : 'fight'}   ·   II to go back`
        : `A / D or ← / → choose a stage${level ? '   ·   W / S CPU level' : ''}   ·   J / Enter to ${this.mode === 'training' ? 'train' : 'fight'}   ·   Esc back to roster`;
      ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
      const sub =
        this.mode === 'arcade'
          ? 'Four matches, best of 3 each  ·  three continues  ·  the finale is always the Sanctuary'
          : this.mode === 'training'
            ? 'No timer, no rounds  ·  pause for dummy, hitbox and frame data options'
            : 'Best of 3 rounds  ·  99 second timer';
      ui.text(ctx, sub, CANVAS_WIDTH / 2, y + 37, 11, 'rgba(255,255,255,0.55)', { template: FONT_UI });
      return;
    }
    if (this.mode === 'arcade') {
      const id = this.roster[this.cursors[0].index].id;
      const high = this.game.save.records.arcadeHigh[id] ?? 0;
      const clears = this.game.save.records.arcadeClears[id] ?? 0;
      const best = high > 0 ? `   BEST: ${String(high).padStart(7, '0')}` : '';
      const help = this.game.input.touchMode ? 'Stick left / right to choose   ·   ATK to lock   ·   II to go back' : 'A / D choose your fighter   ·   W / S costume   ·   J confirm   ·   Esc back';
      ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
      ui.text(ctx, `${ARCADE_RUNG_LABEL.join(' > ')}   ·   CLEARS: ${clears}${best}`, CANVAS_WIDTH / 2, y + 37, 11, COLORS.hazard, { template: FONT_UI });
      return;
    }
    if (this.mode === 'story') {
      const c = this.cursors[0];
      const id = this.roster[c.index].id;
      const storyId = isStoryChar(id) ? id : 'slade';
      const route = ROUTES[storyId];
      const high = this.game.save.records.storyHigh[storyId] ?? 0;
      const best = high > 0 ? `   BEST: ${String(high).padStart(7, '0')}` : '';
      ui.text(ctx, `OUTSKIRTS > HARBOR > FACILITY > SKYLINE > FOUNDRY > SANCTUARY   FOES: ${route.foes}   BOSS: ${route.boss}${best}`, CANVAS_WIDTH / 2, y + 18, 12, COLORS.hazard, {
        template: FONT_UI,
      });
      if (this.phase === 'story') {
        const a = 0.5 + 0.5 * Math.sin(time * 0.3);
        ui.text(ctx, 'ENTERING THE OUTSKIRTS...', CANVAS_WIDTH / 2, y + 36, 12, '#ffffff', { template: FONT_UI, alpha: a });
      } else {
        this.wrapCentered(ctx, route.story, CANVAS_WIDTH / 2, y + 36, 11, 'rgba(255,255,255,0.7)');
      }
      return;
    }
    const other = this.mode === 'training' ? 'the dummy' : 'the CPU fighter';
    const help = this.game.input.touchMode
      ? this.params.cpu && this.cursors[0].locked
        ? `Stick left / right to choose ${other}   ·   ATK to lock   ·   II to undo`
        : 'Stick left / right to choose   ·   ATK to lock   ·   II to go back'
      : this.params.cpu
      ? this.cursors[0].locked
        ? `A / D choose ${other}   ·   J confirm   ·   Esc undo`
        : 'A / D choose your fighter   ·   W / S costume   ·   J confirm   ·   Esc back'
      : 'P1: A / D + J to lock   ·   P2: ← / → + Numpad 1 or , to lock   ·   Esc / gamepad Back undo';
    ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
    const sub = this.mode === 'training' ? 'Pick who you practise as, then who stands in front of you' : 'Best of 3 rounds  ·  99 second timer  ·  Hold away from your opponent to block';
    ui.text(ctx, sub, CANVAS_WIDTH / 2, y + 37, 11, 'rgba(255,255,255,0.55)', {
      template: FONT_UI,
    });
  }

  private drawSplash(ctx: CanvasRenderingContext2D, time: number): void {
    const t = this.phaseT;
    const ui = this.game.ui;
    const sprites = this.game.sprites;
    const a = this.roster[this.cursors[0].index];
    const b = this.second();
    const [v1, v2] = this.costumes();
    const slideIn = Math.min(1, t / 16);
    const ease = 1 - (1 - slideIn) ** 3;

    ctx.save();
    ctx.fillStyle = `rgba(4,2,10,${0.9 * ease})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(-CANVAS_WIDTH * (1 - ease), 0);
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(CANVAS_WIDTH / 2 + 50, 60);
    ctx.lineTo(CANVAS_WIDTH / 2 - 50, 480);
    ctx.lineTo(0, 480);
    ctx.closePath();
    ctx.fillStyle = a.accent;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(CANVAS_WIDTH * (1 - ease), 0);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2 + 50, 60);
    ctx.lineTo(CANVAS_WIDTH, 60);
    ctx.lineTo(CANVAS_WIDTH, 480);
    ctx.lineTo(CANVAS_WIDTH / 2 - 50, 480);
    ctx.closePath();
    ctx.fillStyle = b.accent;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.restore();

    sprites.drawPortrait(ctx, a.def.archetype, v1, 40 - 400 * (1 - ease), 80, 380, 380, 1, time);
    sprites.drawPortrait(ctx, b.def.archetype, v2, CANVAS_WIDTH - 420 + 400 * (1 - ease), 80, 380, 380, -1, time);

    ui.text(ctx, a.def.name, 60 - 400 * (1 - ease), 450, 44, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 7 });
    ui.text(ctx, this.cursors[0].who, 62 - 400 * (1 - ease), 104, 22, a.glow, { align: 'left', stroke: '#000', strokeWidth: 5 });
    ui.text(ctx, b.def.name, CANVAS_WIDTH - 60 + 400 * (1 - ease), 450, 44, '#ffffff', { align: 'right', stroke: '#000', strokeWidth: 7 });
    ui.text(ctx, this.secondWho(), CANVAS_WIDTH - 62 + 400 * (1 - ease), 104, 22, b.glow, { align: 'right', stroke: '#000', strokeWidth: 5 });

    if (t > 12) {
      const pop = Math.min(1, (t - 12) / 8);
      const sc = 2.4 - 1.4 * pop + Math.sin(time * 0.3) * 0.03;
      ctx.save();
      ctx.translate(CANVAS_WIDTH / 2, 290);
      ctx.scale(sc, sc);
      const vg = ctx.createLinearGradient(0, -50, 0, 10);
      vg.addColorStop(0, '#fff6c8');
      vg.addColorStop(1, COLORS.hazard);
      ui.text(ctx, 'VS', 0, 0, 96, vg, { stroke: '#120a1c', strokeWidth: 10, shadow: 'rgba(255,210,31,0.8)', alpha: pop });
      ctx.restore();
    }
    if (t > 40) {
      const level = this.mode === 'versus' && this.params.cpu ? `  ·  CPU ${CPU_DIFFICULTY[this.game.save.settings.cpuDifficulty].label}` : '';
      const rules = this.mode === 'arcade' ? `ARCADE  ·  MATCH 1 OF ${this.arcadeRun?.ladder.length ?? 4}` : this.mode === 'training' ? 'TRAINING ROOM' : 'BEST OF 3';
      ui.text(ctx, `${STAGE_INFO[this.stageChoice].name}  ·  ${rules}${level}`, CANVAS_WIDTH / 2, 500, 14, 'rgba(255,255,255,0.75)', { template: FONT_UI });
    }
    ctx.restore();
  }

  private wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, size: number, color: string): void {
    ctx.save();
    ctx.font = font(FONT_UI, size);
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        this.game.ui.text(ctx, line, x, yy, size, color, { align: 'left', template: FONT_UI });
        line = word;
        yy += lineH;
      } else line = test;
    }
    if (line) this.game.ui.text(ctx, line, x, yy, size, color, { align: 'left', template: FONT_UI });
    ctx.restore();
  }

  private ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number): string {
    ctx.save();
    ctx.font = font(FONT_UI, size);
    let str = text;
    while (ctx.measureText(`${str}…`).width > maxW && str.length > 4) str = str.slice(0, -1).trimEnd();
    ctx.restore();
    return str === text ? text : `${str}…`;
  }

  private wrapCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
    ctx.save();
    ctx.font = font(FONT_UI, size);
    let str = text;
    while (ctx.measureText(str).width > CANVAS_WIDTH - 160 && str.length > 4) str = `${str.slice(0, str.lastIndexOf(' '))}`;
    if (str !== text) str += '...';
    ctx.restore();
    this.game.ui.text(ctx, str, x, y, size, color, { template: FONT_UI });
  }
}
