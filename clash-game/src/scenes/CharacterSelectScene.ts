import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_UI, STORY_LIVES, font } from '../config/constants';
import { CPU_DIFFICULTIES, CPU_DIFFICULTY, STAGE_INFO, STAGE_ORDER, resolveStage, type StagePick } from '../config/stages';
import { CHARACTERS, VS_ROSTER } from '../characters';
import { ARCADE_RUNG_LABEL, newArcadeRun, type ArcadeRun } from '../config/arcade';
import { ROUTES } from '../config/routes';
import type { GameContext, SceneMap, TagTeam } from '../core/StateManager';
import type { CharId, CharacterDef } from '../physics/Types';
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
  batman: { accent: '#8a93a8', glow: '#ffd21f' },
};

const entry = (id: CharId): RosterEntry => ({ id, def: CHARACTERS[id], ...STYLE[id] });
const VS_CARDS: RosterEntry[] = VS_ROSTER.map(entry);


const SPLASH_FRAMES = 110;
// Tiles share the row evenly with a fixed gutter, so the layout follows the roster size.
const TILE_X0 = 36;
const TILE_GAP = 12;
const TILE_W = Math.floor((CANVAS_WIDTH - TILE_X0 * 2 - TILE_GAP * (VS_ROSTER.length - 1)) / VS_ROSTER.length);
const TILE_STEP = TILE_W + TILE_GAP;
const TILE_Y = 66;
const TILE_H = 190;
const STORY_CONFIRM_FRAMES = 70;

type Who = 'P1' | 'P2' | 'CPU' | 'DUMMY' | 'P1·2' | 'P2·2' | 'CPU·2';

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

/** `foe` is the tag-team opener where Player 1 decides whether the other team is human or CPU. */
type Phase = 'foe' | 'pick' | 'stage' | 'splash' | 'story';

const FOE_OPTIONS: { label: string; desc: string; cpu: boolean }[] = [
  { label: '2 PLAYERS', desc: 'Player 2 picks their own pair on the arrows / second pad', cpu: false },
  { label: 'VS CPU', desc: 'You pick both teams; the CPU runs the other side and tags on its own', cpu: true },
];

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
  /** Whether the opposing side is CPU-driven; tag mode decides this on its opener screen. */
  private cpu: boolean;
  private foeIndex = 1;

  constructor(game: GameContext, private readonly params: SceneMap['select']) {
    super(game);
    this.roster = VS_CARDS;
    this.cpu = params.cpu;
    if (params.mode === 'tag') {
      this.phase = 'foe';
      this.foeIndex = params.cpu ? 1 : 0;
    }
    this.cursors = this.buildCursors();
  }

  private buildCursors(): Cursor[] {
    const mode = this.params.mode;
    const p1: Cursor = { who: 'P1', slot: 0, index: 0, locked: false, lockT: 0, color: COLORS.voidGlow, costume: 'normal' };
    if (mode === 'story' || mode === 'arcade') return [p1];
    if (mode === 'training') return [p1, { who: 'DUMMY', slot: 0, index: 1, locked: false, lockT: 0, color: '#b8c0cc', costume: 'normal' }];
    if (mode === 'tag') {
      const p1b: Cursor = { ...p1, who: 'P1·2', index: 1 };
      const foeSlot = this.cpu ? 0 : 1;
      const foeColor = this.cpu ? '#b8c0cc' : COLORS.bone;
      return [
        p1,
        p1b,
        { who: this.cpu ? 'CPU' : 'P2', slot: foeSlot, index: 2, locked: false, lockT: 0, color: foeColor, costume: 'normal' },
        { who: this.cpu ? 'CPU·2' : 'P2·2', slot: foeSlot, index: 3, locked: false, lockT: 0, color: foeColor, costume: 'normal' },
      ];
    }
    if (this.cpu) return [p1, { who: 'CPU', slot: 0, index: 1, locked: false, lockT: 0, color: '#b8c0cc', costume: 'normal' }];
    return [p1, { who: 'P2', slot: 1, index: 1, locked: false, lockT: 0, color: COLORS.bone, costume: 'normal' }];
  }

  private get mode() {
    return this.params.mode;
  }

  private get tag(): boolean {
    return this.params.mode === 'tag';
  }

  /** Cursors on the opposing side: the second pick in a duel, the second pair in tag. */
  private foeCursors(): Cursor[] {
    return this.tag ? this.cursors.slice(2) : this.cursors.slice(1);
  }

  /** The fighter on the right of the preview: the opposing point fighter, or the first arcade opponent. */
  private second(): RosterEntry {
    const foe = this.foeCursors()[0];
    if (foe) return this.roster[foe.index];
    const id = this.arcadeRun?.ladder[0] ?? this.roster[(this.cursors[0].index + 1) % this.roster.length].id;
    return this.roster.find((r) => r.id === id) ?? this.roster[0];
  }

  private secondWho(): string {
    return this.foeCursors()[0]?.who ?? 'CPU';
  }

  /** Costume for the k-th cursor; an earlier pick of the same fighter in the same colour forces the other one. */
  private costumeFor(k: number): Costume {
    const c = this.cursors[k];
    let v = c.costume;
    const id = this.roster[c.index].id;
    for (let i = 0; i < k; i++) {
      const o = this.cursors[i];
      if (this.roster[o.index].id === id && this.costumeFor(i) === v) v = v === 'alt' ? 'normal' : 'alt';
    }
    return v;
  }

  /** Final costumes for the two duel picks; a mirror match forces the second fighter into the other colour. */
  private costumes(): [Costume, Costume] {
    if (this.cursors.length < 2) return [this.cursors[0].costume, 'normal'];
    const foe = this.tag ? 2 : 1;
    return [this.costumeFor(0), this.costumeFor(foe)];
  }

  private team(first: number): TagTeam {
    return {
      chars: [this.roster[this.cursors[first].index].id, this.roster[this.cursors[first + 1].index].id],
      costumes: [this.costumeFor(first), this.costumeFor(first + 1)],
    };
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
    if (this.tag) {
      this.game.scenes.go('tag', { t1: this.team(0), t2: this.team(2), cpu: this.cpu, stage: this.stageChoice });
      return;
    }
    this.game.scenes.go('vs', { p1, p2: this.second().id, cpu: this.cpu, stage: this.stageChoice, v1, v2 });
  }

  enter(): void {
    this.game.audio.startMusic(this.params.mode === 'story' ? 'title' : 'versus');
  }

  /** Each input slot drives its cursors in order, so a human picking several fighters locks them one at a time. */
  private activeCursors(): Cursor[] {
    const seen = new Set<number>();
    const out: Cursor[] = [];
    for (const c of this.cursors) {
      if (c.locked || seen.has(c.slot)) continue;
      seen.add(c.slot);
      out.push(c);
    }
    return out;
  }

  /** Tag opener: left / right flips between a human and a CPU opponent team. */
  private updateFoePick(): void {
    const input = this.game.input;
    const audio = this.game.audio;
    const m = input.menu();
    if (m.left || m.right) {
      this.foeIndex = (this.foeIndex + 1) % FOE_OPTIONS.length;
      audio.playSelect();
    }
    if (m.back) {
      audio.playBack();
      this.game.scenes.go('title', {});
      return;
    }
    if (this.phaseT > 8 && m.confirm) {
      if (!FOE_OPTIONS[this.foeIndex].cpu && this.secondDeviceMissing()) {
        audio.playBack();
        return;
      }
      this.cpu = FOE_OPTIONS[this.foeIndex].cpu;
      this.cursors = this.buildCursors();
      this.phase = 'pick';
      this.phaseT = 0;
      this.flash = 8;
      audio.playConfirm();
    }
  }

  /** Local 2P needs a second physical device when Player 1 is on the touch pad. */
  private secondDeviceMissing(): boolean {
    return this.game.input.touchMode && this.game.input.connectedPads() === 0;
  }

  update(): void {
    this.t++;
    if (this.flash > 0) this.flash--;
    for (const c of this.cursors) if (c.locked) c.lockT++;
    if (this.game.scenes.transitioning) return;
    const audio = this.game.audio;
    const input = this.game.input;

    if (this.phase === 'foe') {
      this.phaseT++;
      this.updateFoePick();
      return;
    }
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
        this.game.scenes.go('story', { char: id, stage: 0, score: 0, lives: STORY_LIVES });
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
        if (this.tag) {
          this.phase = 'foe';
          this.phaseT = 0;
        } else this.game.scenes.go('title', {});
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
    if ((this.mode === 'versus' || this.tag) && this.cpu) {
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
      if (this.phase !== 'foe') this.roster.forEach((_, i) => this.drawTileBack(w, i, TILE_X0 + i * TILE_STEP, TILE_Y, TILE_W, TILE_H, time));
    }
    g.renderer.drawVignette();
    g.renderer.endWorld();

    const heading = this.heading(stagePhase);
    g.ui.text(ctx, heading, CANVAS_WIDTH / 2, 48, 26, '#ffffff', { stroke: '#000', strokeWidth: 5, shadow: 'rgba(138,77,255,0.7)' });

    if (this.phase === 'foe') {
      this.drawFoePick(ctx, time);
    } else if (stagePhase) {
      if (this.phase === 'stage') this.drawStageCards(ctx, time);
    } else {
      this.roster.forEach((_, i) => this.drawTileFront(ctx, i, TILE_X0 + i * TILE_STEP, TILE_Y, TILE_W, TILE_H, time));
      if (this.tag) {
        this.drawTeamCard(ctx, [this.cursors[0], this.cursors[1]], 36, 268, 436, 202, time);
        this.drawTeamCard(ctx, [this.cursors[2], this.cursors[3]], 488, 268, 436, 202, time);
      } else this.cursors.forEach((c, k) => this.drawDetail(ctx, c, 36 + k * 452, 268, 436, 202));
      if (this.mode === 'arcade') this.drawLadderCard(ctx, 488, 268, 436, 202, time);
      if (story) this.drawRouteCard(ctx, 488, 268, 436, 202, time);
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

  private heading(stagePhase: boolean): string {
    if (this.phase === 'foe') return 'TAG TEAM  —  WHO IS ACROSS THE RING?';
    if (stagePhase) {
      if (this.mode === 'arcade') return 'ARCADE LADDER  —  CHOOSE YOUR STARTING STAGE';
      if (this.mode === 'training') return 'TRAINING  —  CHOOSE YOUR ROOM';
      return this.cpu ? 'CHOOSE YOUR STAGE  —  SET CPU LEVEL' : 'CHOOSE YOUR STAGE';
    }
    if (this.mode === 'story') return 'STORY MODE  —  CHOOSE YOUR FIGHTER';
    if (this.mode === 'arcade') return 'ARCADE LADDER  —  CHOOSE YOUR FIGHTER';
    if (this.mode === 'training') return this.cursors[0].locked ? 'TRAINING  —  CHOOSE THE DUMMY' : 'TRAINING  —  CHOOSE YOUR FIGHTER';
    if (this.tag) {
      const next = this.activeCursors()[0];
      if (!next) return 'TAG TEAM  —  TEAMS LOCKED';
      if (this.cpu) {
        if (next.who === 'P1') return 'TAG TEAM  —  PICK YOUR POINT FIGHTER';
        if (next.who === 'P1·2') return 'TAG TEAM  —  PICK YOUR PARTNER';
        return next.who === 'CPU' ? 'TAG TEAM  —  PICK THE CPU POINT FIGHTER' : 'TAG TEAM  —  PICK THE CPU PARTNER';
      }
      return 'TAG TEAM  —  EACH PLAYER PICKS A PAIR';
    }
    if (this.cpu) return this.cursors[0].locked ? 'VERSUS CPU  —  CHOOSE YOUR OPPONENT' : 'VERSUS CPU  —  CHOOSE YOUR FIGHTER';
    return 'VERSUS  —  BOTH PLAYERS CHOOSE';
  }

  /** Tag opener: two big cards, human or CPU opposition. */
  private drawFoePick(ctx: CanvasRenderingContext2D, time: number): void {
    const ui = this.game.ui;
    const cw = 320;
    const ch = 190;
    const gap = 40;
    const x0 = (CANVAS_WIDTH - (cw * 2 + gap)) / 2;
    const y = 150;
    const missing = this.secondDeviceMissing();
    FOE_OPTIONS.forEach((opt, i) => {
      const x = x0 + i * (cw + gap);
      const hovered = i === this.foeIndex;
      const blocked = !opt.cpu && missing;
      ui.panel(ctx, x, y, cw, ch, hovered ? 'rgba(30,18,52,0.95)' : 'rgba(8,6,18,0.88)');
      ctx.save();
      ctx.lineWidth = hovered ? 3 : 1;
      ctx.strokeStyle = hovered ? COLORS.hazard : 'rgba(255,255,255,0.14)';
      if (hovered) {
        ctx.shadowColor = COLORS.hazard;
        ctx.shadowBlur = 18 + 6 * Math.sin(time * 0.1);
      }
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      ctx.restore();
      const pair: [number, number] = opt.cpu ? [2, 3] : [0, 1];
      ctx.save();
      ctx.globalAlpha = blocked ? 0.4 : 1;
      pair.forEach((ri, k) => {
        const r = this.roster[ri];
        const bs = 68;
        const bx = x + cw / 2 + (k === 0 ? -bs - 8 : 8);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(bx, y + 50, bs, bs);
        ctx.strokeStyle = `${r.accent}66`;
        ctx.strokeRect(bx + 0.5, y + 50.5, bs - 1, bs - 1);
        this.game.sprites.drawBust(ctx, r.def.archetype, opt.cpu ? 'boss' : 'normal', bx, y + 50, bs, k === 0 ? 1 : -1, time + k * 31);
      });
      ctx.restore();
      ui.text(ctx, opt.cpu ? 'THE MACHINE PICKS ITS MOMENT' : 'LOCAL GRUDGE MATCH', x + cw / 2, y + 134, 9, hovered ? COLORS.hazard : 'rgba(255,255,255,0.45)', { template: FONT_UI });
      ui.text(ctx, opt.label, x + cw / 2, y + 36, 22, blocked ? 'rgba(255,255,255,0.4)' : '#ffffff', { stroke: '#000', strokeWidth: 4 });
      this.wrapCentered(ctx, blocked ? 'Player 2 needs a keyboard or gamepad to join' : opt.desc, x + cw / 2, y + 152, cw - 40, 14, 11, blocked ? '#ff7a8a' : 'rgba(255,255,255,0.72)');
    });
  }

  private wrapCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lineH: number, size: number, color: string): void {
    ctx.save();
    ctx.font = font(FONT_UI, size);
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    ctx.restore();
    lines.forEach((l, i) => this.game.ui.text(ctx, l, cx, y + i * lineH, size, color, { template: FONT_UI }));
  }

  /** Tag: both picks of one team side by side, with ratings and the lock state of each cursor. */
  private drawTeamCard(ctx: CanvasRenderingContext2D, pair: Cursor[], x: number, y: number, w: number, h: number, time: number): void {
    const ui = this.game.ui;
    const lead = pair[0];
    ui.panel(ctx, x, y, w, h, 'rgba(8,6,18,0.9)');
    ctx.save();
    ctx.strokeStyle = pair.every((c) => c.locked) ? lead.color : `${lead.color}66`;
    ctx.lineWidth = pair.every((c) => c.locked) ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = lead.color;
    ctx.fillRect(x, y, 6, h);
    ctx.restore();
    const teamLabel = lead.who === 'P1' ? 'TEAM 1P' : lead.who === 'P2' ? 'TEAM 2P' : 'TEAM CPU';
    ui.text(ctx, teamLabel, x + 20, y + 24, 13, lead.color, { align: 'left', template: FONT_UI });
    const half = (w - 32) / 2;
    pair.forEach((c, k) => {
      const cx = x + 20 + k * half;
      const r = this.roster[c.index];
      const def = r.def;
      const bs = 56;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(cx, y + 36, bs, bs);
      ctx.strokeStyle = c.locked ? c.color : 'rgba(255,255,255,0.14)';
      ctx.strokeRect(cx + 0.5, y + 36.5, bs - 1, bs - 1);
      ctx.restore();
      this.game.sprites.drawBust(ctx, def.archetype, this.costumeFor(this.cursors.indexOf(c)), cx, y + 36, bs, 1, time + k * 17);
      ui.text(ctx, k === 0 ? 'POINT' : 'PARTNER', cx + bs + 10, y + 46, 9, 'rgba(255,255,255,0.5)', { align: 'left', template: FONT_UI });
      ui.text(ctx, def.name, cx + bs + 10, y + 66, 16, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 3 });
      ui.text(ctx, def.title.toUpperCase(), cx + bs + 10, y + 80, 9, r.glow, { align: 'left', template: FONT_UI });
      ui.text(ctx, c.locked ? 'LOCKED' : 'CHOOSING…', cx + bs + 10, y + 94, 9, c.locked ? c.color : COLORS.hazard, { align: 'left', template: FONT_UI });
      const rt = def.ratings ?? { power: 3, speed: 3, range: 3, defense: 3 };
      ui.statBar(ctx, 'POWER', rt.power, cx, y + 112, r.accent);
      ui.statBar(ctx, 'SPEED', rt.speed, cx, y + 128, r.accent);
      ui.statBar(ctx, 'RANGE', rt.range, cx, y + 144, r.accent);
      ui.statBar(ctx, 'DEFENSE', rt.defense, cx, y + 160, r.accent);
      const s = def.stats;
      ui.text(ctx, `HP ${s.maxHp}   SPD ${s.speed}   DEF ${s.defense}`, cx, y + 186, 10, 'rgba(255,255,255,0.5)', { align: 'left', template: FONT_UI });
    });
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 20 + half - 10, y + 36, 1, h - 56);
    ctx.restore();
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

    ui.text(ctx, def.name, x + w / 2, y + h - 22, w < 200 ? 16 : 18, '#ffffff', { stroke: '#000', strokeWidth: 4 });
    ui.text(ctx, def.title.toUpperCase(), x + w / 2, y + h - 8, 10, r.glow, { template: FONT_UI });
    const altUnlocked = this.game.save.isAltUnlocked(r.id);
    if (altUnlocked) ui.text(ctx, hovered ? '▲▼ COSTUME' : 'ALT ✓', x + w - 8, y + 22, 9, hovered ? COLORS.hazard : 'rgba(255,255,255,0.45)', { align: 'right', template: FONT_UI });

    const badgeStep = here.length > 2 ? Math.floor((w - 20 - 48) / (here.length - 1)) : 56;
    here.forEach((c, k) => {
      const bx = x + 10 + k * badgeStep;
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
      ui.text(ctx, c.who, bx + 21, by + 15 + bob, c.who.length > 3 ? 9 : 13, '#0a0612');
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

  /** Story: who the hovered fighter cuts through and who waits at the end. */
  private drawRouteCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number): void {
    const ui = this.game.ui;
    const id = this.roster[this.cursors[0].index].id;
    const route = ROUTES[id];
    const boss = CHARACTERS[route.boss];
    const accent = STYLE[id].glow;
    ui.panel(ctx, x, y, w, h, 'rgba(8,6,18,0.9)');
    ctx.save();
    ctx.strokeStyle = `${accent}80`;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 6, h);
    ctx.restore();
    ui.text(ctx, 'THE ROUTE', x + 20, y + 30, 24, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 4 });
    ui.text(ctx, route.label, x + 20, y + 48, 11, accent, { align: 'left', template: FONT_UI });
    this.wrap(ctx, route.story, x + 20, y + 72, w - 170, 15, 11, 'rgba(255,255,255,0.78)');
    const high = this.game.save.records.storyHigh[id] ?? 0;
    const clears = this.game.save.records.storyClears[id] ?? 0;
    ui.text(ctx, `FOES: ${route.foesLabel}`, x + 20, y + 150, 10, COLORS.hazard, { align: 'left', template: FONT_UI });
    ui.text(ctx, `CLEARS: ${clears}${high > 0 ? `   ·   BEST: ${String(high).padStart(7, '0')}` : ''}`, x + 20, y + 166, 10, 'rgba(255,255,255,0.55)', { align: 'left', template: FONT_UI });
    ui.text(ctx, 'OUTSKIRTS › HARBOR › FACILITY › SKYLINE › FOUNDRY › SANCTUARY', x + 20, y + 184, 9, 'rgba(255,255,255,0.4)', { align: 'left', template: FONT_UI });

    // Final boss bust in the corner.
    const bs = 104;
    const bx = x + w - bs - 18;
    const by = y + 58;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(bx, by, bs, bs);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeRect(bx + 0.5, by + 0.5, bs - 1, bs - 1);
    ctx.restore();
    this.game.sprites.drawBust(ctx, boss.archetype, 'boss', bx, by, bs, -1, time);
    ui.text(ctx, 'FINAL BOSS', bx + bs / 2, y + 50, 9, 'rgba(255,255,255,0.5)', { template: FONT_UI });
    ui.text(ctx, boss.name, bx + bs / 2, by + bs + 14, 12, STYLE[route.boss].glow, { stroke: '#000', strokeWidth: 3 });
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
      // Tag partners wait a step behind their point fighter.
      if (this.tag) {
        for (const [k, x, facing] of [
          [1, 230, 1],
          [3, 730, -1],
        ] as const) {
          const def = this.roster[this.cursors[k].index].def;
          s.fillStyle = 'rgba(0,0,0,0.35)';
          s.beginPath();
          s.ellipse(x, floor - 26, 24 * def.scale, 5, 0, 0, Math.PI * 2);
          s.fill();
          this.game.sprites.drawBody(s, def.archetype, this.costumeFor(k), idlePose(def.archetype, time + k * 23), x, floor - 26, facing, def.scale * 0.9, time, null);
        }
      }
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
    } else if (this.cpu) {
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
    if (this.tag) {
      const a2 = this.roster[this.cursors[1].index];
      const b2 = this.roster[this.cursors[3].index];
      ui.text(ctx, `${a.def.name}  &  ${a2.def.name}`, 300, 272, 16, a.glow, { stroke: '#000', strokeWidth: 4 });
      ui.text(ctx, `${b.def.name}  &  ${b2.def.name}`, 660, 272, 16, b.glow, { stroke: '#000', strokeWidth: 4 });
      return;
    }
    ui.text(ctx, a.def.name, 330, 272, 16, a.glow, { stroke: '#000', strokeWidth: 4 });
    ui.text(ctx, b.def.name, 630, 272, 16, b.glow, { stroke: '#000', strokeWidth: 4 });
  }

  private drawFooter(ctx: CanvasRenderingContext2D, time: number): void {
    const ui = this.game.ui;
    const y = 480;
    ui.panel(ctx, 60, y, CANVAS_WIDTH - 120, 44, 'rgba(8,6,18,0.9)');
    if (this.phase === 'foe') {
      const help = this.game.input.touchMode ? 'Stick left / right to choose   ·   ATK to confirm   ·   II to go back' : 'A / D or ← / → choose   ·   J / Enter confirm   ·   Esc back to title';
      ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
      ui.text(ctx, 'Two fighters a side  ·  one 150 second round  ·  tag on a cooldown, the bench heals a little while it rests', CANVAS_WIDTH / 2, y + 37, 11, 'rgba(255,255,255,0.55)', { template: FONT_UI });
      return;
    }
    if (this.phase === 'stage') {
      const touch = this.game.input.touchMode;
      const level = (this.mode === 'versus' || this.tag) && this.cpu;
      const help = touch
        ? `Stick left / right to choose a stage${level ? '   ·   up / down CPU level' : ''}   ·   ATK to ${this.mode === 'training' ? 'train' : 'fight'}   ·   II to go back`
        : `A / D or ← / → choose a stage${level ? '   ·   W / S CPU level' : ''}   ·   J / Enter to ${this.mode === 'training' ? 'train' : 'fight'}   ·   Esc back to roster`;
      ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
      const sub =
        this.mode === 'arcade'
          ? 'Four matches, best of 3 each  ·  three continues  ·  the finale is always the Sanctuary'
          : this.mode === 'training'
            ? 'No timer, no rounds  ·  pause for dummy, hitbox and frame data options'
            : this.tag
              ? 'One 150 second round  ·  KO both fighters to win  ·  I / Numpad 5 / LB to tag'
              : 'Best of 3 rounds  ·  99 second timer';
      ui.text(ctx, sub, CANVAS_WIDTH / 2, y + 37, 11, 'rgba(255,255,255,0.55)', { template: FONT_UI });
      return;
    }
    if (this.tag) {
      const next = this.activeCursors()[0];
      const touch = this.game.input.touchMode;
      const whose = !next ? '' : next.who.startsWith('P1') ? (next.who === 'P1' ? 'your point fighter' : 'your partner') : next.who.startsWith('CPU') ? (next.who === 'CPU' ? 'the CPU point fighter' : 'the CPU partner') : '';
      const help = touch
        ? `Stick left / right to choose ${whose}   ·   ATK to lock   ·   II to undo`
        : this.cpu
          ? `A / D choose ${whose}   ·   W / S costume   ·   J confirm   ·   Esc undo`
          : 'P1: A / D + J locks each pick   ·   P2: ← / → + Numpad 1 or ,   ·   Esc / gamepad Back undo';
      ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
      ui.text(ctx, 'Point fighter starts on stage  ·  the partner waits on the bench and recovers a little health until tagged in', CANVAS_WIDTH / 2, y + 37, 11, 'rgba(255,255,255,0.55)', { template: FONT_UI });
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
      const help = this.game.input.touchMode ? 'Stick left / right to choose   ·   ATK to lock   ·   II to go back' : 'A / D choose your fighter   ·   J confirm   ·   Esc back';
      ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
      if (this.phase === 'story') {
        const a = 0.5 + 0.5 * Math.sin(time * 0.3);
        ui.text(ctx, 'ENTERING THE OUTSKIRTS...', CANVAS_WIDTH / 2, y + 37, 12, '#ffffff', { template: FONT_UI, alpha: a });
      } else {
        ui.text(ctx, `Six stages  ·  ${STORY_LIVES} lives  ·  a rival waits at the Sanctuary`, CANVAS_WIDTH / 2, y + 37, 11, 'rgba(255,255,255,0.55)', { template: FONT_UI });
      }
      return;
    }
    const other = this.mode === 'training' ? 'the dummy' : 'the CPU fighter';
    const help = this.game.input.touchMode
      ? this.cpu && this.cursors[0].locked
        ? `Stick left / right to choose ${other}   ·   ATK to lock   ·   II to undo`
        : 'Stick left / right to choose   ·   ATK to lock   ·   II to go back'
      : this.cpu
      ? this.cursors[0].locked
        ? `A / D choose ${other}   ·   J confirm   ·   Esc undo`
        : 'A / D choose your fighter   ·   W / S costume   ·   J confirm   ·   Esc back'
      : 'P1: A / D + J to lock   ·   P2: ← / → + Numpad 1 or , to lock   ·   Esc / gamepad Back undo';
    ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
    const sub = this.mode === 'training' ? 'Pick who you practise as, then who stands in front of you' : 'Best of 3 rounds  ·  99 second timer  ·  Hold BLOCK to guard, tap it on impact to parry';
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
    if (this.tag) {
      // Partners ride along as busts under each team's banner.
      const a2 = this.roster[this.cursors[1].index];
      const b2 = this.roster[this.cursors[3].index];
      const bs = 64;
      const ax = 62 - 400 * (1 - ease);
      const bx = CANVAS_WIDTH - 62 - bs + 400 * (1 - ease);
      ctx.save();
      ctx.fillStyle = 'rgba(8,6,18,0.8)';
      ctx.fillRect(ax - 4, 116, bs + 8, bs + 8);
      ctx.fillRect(bx - 4, 116, bs + 8, bs + 8);
      ctx.restore();
      sprites.drawBust(ctx, a2.def.archetype, this.costumeFor(1), ax, 120, bs, 1, time);
      sprites.drawBust(ctx, b2.def.archetype, this.costumeFor(3), bx, 120, bs, -1, time);
      ui.text(ctx, `+ ${a2.def.name}`, ax + bs + 10, 160, 16, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 4 });
      ui.text(ctx, `${b2.def.name} +`, bx - 10, 160, 16, '#ffffff', { align: 'right', stroke: '#000', strokeWidth: 4 });
    }

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
      const level = (this.mode === 'versus' || this.tag) && this.cpu ? `  ·  CPU ${CPU_DIFFICULTY[this.game.save.settings.cpuDifficulty].label}` : '';
      const rules = this.mode === 'arcade' ? `ARCADE  ·  MATCH 1 OF ${this.arcadeRun?.ladder.length ?? 4}` : this.mode === 'training' ? 'TRAINING ROOM' : this.tag ? 'TAG TEAM  ·  2 VS 2' : 'BEST OF 3';
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


}
