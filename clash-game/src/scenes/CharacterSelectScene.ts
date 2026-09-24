import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_UI, STORY_LIVES, font } from '../config/constants';
import { FRECKLES } from '../characters/Freckles';
import { SLADE } from '../characters/Slade';
import type { GameContext, SceneMap } from '../core/StateManager';
import type { CharId, CharacterDef } from '../physics/Types';
import { idlePose } from '../rendering/SpriteRenderer';
import { Scene } from './Scene';

const ROSTER: { id: CharId; def: CharacterDef; accent: string; glow: string }[] = [
  { id: 'slade', def: SLADE, accent: COLORS.void, glow: COLORS.voidGlow },
  { id: 'freckles', def: FRECKLES, accent: COLORS.ember, glow: COLORS.brass },
];

const ROUTES: Record<CharId, { foes: string; boss: string; story: string }> = {
  slade: {
    foes: 'FRECKLEBOTS',
    boss: 'FRECKLES',
    story: 'The Iron Syndicate cloned Freckles into an army of brass-fisted Frecklebots. Cut through them and reach the real one.',
  },
  freckles: {
    foes: 'NINJABOTS',
    boss: 'SLADE',
    story: 'Slade\'s stolen ninpo powers a swarm of shuriken-throwing Ninjabots. Smash the factory line and drag him out of the Sanctuary.',
  },
};

const SPLASH_FRAMES = 110;
const STORY_CONFIRM_FRAMES = 70;

type Who = 'P1' | 'P2' | 'CPU';

interface Cursor {
  who: Who;
  slot: number;
  index: number;
  locked: boolean;
  lockT: number;
  color: string;
}

type Phase = 'pick' | 'splash' | 'story';

export class CharacterSelectScene extends Scene {
  private cursors: Cursor[];
  private phase: Phase = 'pick';
  private phaseT = 0;
  private t = 0;
  private flash = 0;

  constructor(game: GameContext, private readonly params: SceneMap['select']) {
    super(game);
    const p1: Cursor = { who: 'P1', slot: 0, index: 0, locked: false, lockT: 0, color: COLORS.voidGlow };
    if (params.mode === 'story') this.cursors = [p1];
    else if (params.cpu) this.cursors = [p1, { who: 'CPU', slot: 0, index: 1, locked: false, lockT: 0, color: '#b8c0cc' }];
    else this.cursors = [p1, { who: 'P2', slot: 1, index: 1, locked: false, lockT: 0, color: COLORS.ember }];
  }

  enter(): void {
    this.game.audio.startMusic(this.params.mode === 'story' ? 'title' : 'versus');
  }

  /** In CPU mode the human picks both fighters in sequence; the CPU cursor is only live once P1 has locked. */
  private activeCursors(): Cursor[] {
    if (this.params.cpu) {
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
      if (++this.phaseT >= SPLASH_FRAMES || (this.phaseT > 30 && input.menu().confirm)) {
        this.game.scenes.go('vs', { p1: ROSTER[this.cursors[0].index].id, p2: ROSTER[this.cursors[1].index].id, cpu: this.params.cpu });
      }
      return;
    }
    if (this.phase === 'story') {
      if (++this.phaseT >= STORY_CONFIRM_FRAMES || (this.phaseT > 20 && input.menu().confirm)) {
        this.game.scenes.go('story', { char: ROSTER[this.cursors[0].index].id, stage: 0, score: 0, lives: STORY_LIVES });
      }
      return;
    }

    for (const c of this.activeCursors()) {
      const left = input.slotPressed(c.slot, 'left');
      const right = input.slotPressed(c.slot, 'right');
      if (left || right) {
        c.index = (c.index + (right ? 1 : ROSTER.length - 1)) % ROSTER.length;
        audio.playSelect();
      }
      if (input.slotConfirm(c.slot)) {
        c.locked = true;
        c.lockT = 0;
        this.flash = 10;
        audio.playConfirm();
        audio.playVoiceGrunt(ROSTER[c.index].def.voice, 'hah');
        if (c.who === 'CPU') return;
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
      if (this.params.mode === 'story') {
        this.phase = 'story';
      } else {
        this.phase = 'splash';
        audio.playBell();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const time = g.time;
    g.renderer.drawStage(this.params.mode === 'story' ? 'facility' : 'rooftop', 0, 0, time, CANVAS_WIDTH);
    ctx.save();
    ctx.fillStyle = 'rgba(5,3,12,0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    const heading =
      this.params.mode === 'story'
        ? 'STORY MODE  —  CHOOSE YOUR FIGHTER'
        : this.params.cpu
          ? this.cursors[0].locked
            ? 'VERSUS CPU  —  CHOOSE YOUR OPPONENT'
            : 'VERSUS CPU  —  CHOOSE YOUR FIGHTER'
          : 'VERSUS  —  BOTH PLAYERS CHOOSE';
    g.ui.text(ctx, heading, CANVAS_WIDTH / 2, 48, 26, '#ffffff', { stroke: '#000', strokeWidth: 5, shadow: 'rgba(138,77,255,0.7)' });

    ROSTER.forEach((r, i) => this.drawCard(ctx, i, 60 + i * 430, 76, 410, 392, time));
    this.drawFooter(ctx, time);

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = (this.flash / 10) * 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
    if (this.phase === 'splash') this.drawSplash(ctx, time);
    g.renderer.drawVignette();
  }

  private drawCard(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number, time: number): void {
    const ui = this.game.ui;
    const r = ROSTER[i];
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
    ctx.lineWidth = hovered ? 3 : 1;
    ctx.strokeStyle = hovered ? r.accent : 'rgba(255,255,255,0.14)';
    if (hovered) {
      ctx.shadowColor = r.accent;
      ctx.shadowBlur = 18 + 6 * Math.sin(time * 0.1);
    }
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();

    const feetY = y + 268;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + 95, feetY, 62, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const locked = lockedHere.length > 0;
    const pose = idlePose(def.archetype, time + i * 37);
    const bounce = locked ? Math.max(0, 6 - lockedHere[0].lockT) * 1.5 : 0;
    this.game.sprites.drawBody(ctx, def.archetype, 'normal', pose, x + 95, feetY - bounce, 1, 1.75, time, null);
    if (lockedHere.length > 1) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      this.game.sprites.drawBody(ctx, def.archetype, 'alt', idlePose(def.archetype, time + 20), x + 150, feetY + 6, -1, 1.3, time, null);
      ctx.restore();
    }

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
    (def.moveList ?? []).forEach((m, k) => {
      const yy = my + 6 + k * 24;
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

  private drawFooter(ctx: CanvasRenderingContext2D, time: number): void {
    const ui = this.game.ui;
    const y = 480;
    ui.panel(ctx, 60, y, CANVAS_WIDTH - 120, 44, 'rgba(8,6,18,0.9)');
    if (this.params.mode === 'story') {
      const c = this.cursors[0];
      const id = ROSTER[c.index].id;
      const route = ROUTES[id];
      ui.text(ctx, `ROUTE: OUTSKIRTS  >  CORE FACILITY  >  SANCTUARY     FOES: ${route.foes}     FINAL BOSS: ${route.boss}`, CANVAS_WIDTH / 2, y + 18, 12, COLORS.hazard, {
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
    const help = this.game.input.touchMode
      ? this.params.cpu && this.cursors[0].locked
        ? 'Stick left / right to choose the CPU fighter   ·   ATK to lock   ·   II to undo'
        : 'Stick left / right to choose   ·   ATK to lock   ·   II to go back'
      : this.params.cpu
      ? this.cursors[0].locked
        ? 'A / D choose the CPU fighter   ·   J confirm   ·   Esc undo'
        : 'A / D choose your fighter   ·   J confirm   ·   Esc back'
      : 'P1: A / D + J to lock   ·   P2: ← / → + Numpad 1 or , to lock   ·   Esc / gamepad Back undo';
    ui.text(ctx, help, CANVAS_WIDTH / 2, y + 20, 13, '#ffffff', { template: FONT_UI });
    ui.text(ctx, 'Best of 3 rounds  ·  99 second timer  ·  Hold away from your opponent to block', CANVAS_WIDTH / 2, y + 37, 11, 'rgba(255,255,255,0.55)', {
      template: FONT_UI,
    });
  }

  private drawSplash(ctx: CanvasRenderingContext2D, time: number): void {
    const t = this.phaseT;
    const ui = this.game.ui;
    const sprites = this.game.sprites;
    const a = ROSTER[this.cursors[0].index];
    const b = ROSTER[this.cursors[1].index];
    const mirror = a.id === b.id;
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

    sprites.drawPortrait(ctx, a.def.archetype, 'normal', 40 - 400 * (1 - ease), 80, 380, 380, 1, time);
    sprites.drawPortrait(ctx, b.def.archetype, mirror ? 'alt' : 'normal', CANVAS_WIDTH - 420 + 400 * (1 - ease), 80, 380, 380, -1, time);

    ui.text(ctx, a.def.name, 60 - 400 * (1 - ease), 450, 44, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 7 });
    ui.text(ctx, this.cursors[0].who, 62 - 400 * (1 - ease), 104, 22, a.glow, { align: 'left', stroke: '#000', strokeWidth: 5 });
    ui.text(ctx, b.def.name, CANVAS_WIDTH - 60 + 400 * (1 - ease), 450, 44, '#ffffff', { align: 'right', stroke: '#000', strokeWidth: 7 });
    ui.text(ctx, this.cursors[1].who, CANVAS_WIDTH - 62 + 400 * (1 - ease), 104, 22, b.glow, { align: 'right', stroke: '#000', strokeWidth: 5 });

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
      ui.text(ctx, 'ROOFTOP  ·  BEST OF 3', CANVAS_WIDTH / 2, 500, 14, 'rgba(255,255,255,0.75)', { template: FONT_UI });
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
