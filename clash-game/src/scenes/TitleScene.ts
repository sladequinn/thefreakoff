import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_UI } from '../config/constants';
import { CONTROL_HELP, TOUCH_HELP } from '../config/controls';
import type { GameContext, SceneMap } from '../core/StateManager';
import { idlePose } from '../rendering/SpriteRenderer';
import { Scene } from './Scene';

interface MenuEntry {
  label: string;
  hint: string;
  go: () => void;
}

interface Mote {
  x: number;
  y: number;
  vy: number;
  size: number;
  hue: 'void' | 'ember';
  phase: number;
}

const IDLE_TIMEOUT = 60 * 25;

export class TitleScene extends Scene {
  private index = 0;
  private t = 0;
  private showControls = false;
  private pressedStart = false;
  private idle = 0;
  private motes: Mote[] = [];
  private readonly items: MenuEntry[];

  constructor(game: GameContext, _params: SceneMap['title']) {
    super(game);
    this.items = [
      {
        label: 'STORY MODE',
        hint: 'Carve through six stages of Clownbots and Ninjabots to reach your rival.',
        go: () => this.game.scenes.go('select', { mode: 'story', cpu: false }),
      },
      {
        label: 'VERSUS: 1P vs 2P',
        hint: 'Settle it face to face. Best of three rounds, 99 seconds each.',
        go: () => this.game.scenes.go('select', { mode: 'versus', cpu: false }),
      },
      {
        label: 'VERSUS: 1P vs CPU',
        hint: 'Duel an adaptive CPU rival that blocks, punishes and reads your habits.',
        go: () => this.game.scenes.go('select', { mode: 'versus', cpu: true }),
      },
      {
        label: 'CONTROLS',
        hint: 'Keyboard and gamepad layouts for both players.',
        go: () => {
          this.showControls = true;
        },
      },
    ];
    for (let i = 0; i < 46; i++) {
      this.motes.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vy: 0.2 + Math.random() * 0.7,
        size: 1 + Math.random() * 2.4,
        hue: i % 2 === 0 ? 'void' : 'ember',
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  enter(): void {
    this.game.audio.startMusic('title');
  }

  update(): void {
    this.t++;
    for (const m of this.motes) {
      m.y -= m.vy;
      m.x += Math.sin(this.t * 0.02 + m.phase) * 0.3;
      if (m.y < -10) {
        m.y = CANVAS_HEIGHT + 10;
        m.x = Math.random() * CANVAS_WIDTH;
      }
    }
    if (this.game.scenes.transitioning) return;
    const m = this.game.input.menu();
    const audio = this.game.audio;

    if (!this.pressedStart) {
      if (m.confirm || this.game.input.anyInputThisFrame) {
        this.pressedStart = true;
        audio.playConfirm();
      }
      return;
    }

    if (this.showControls) {
      if (m.back || m.confirm) {
        this.showControls = false;
        audio.playBack();
      }
      return;
    }

    if (this.game.input.anyInputThisFrame) this.idle = 0;
    else if (++this.idle > IDLE_TIMEOUT) {
      this.pressedStart = false;
      this.idle = 0;
    }

    if (m.up) {
      this.index = (this.index + this.items.length - 1) % this.items.length;
      audio.playSelect();
    }
    if (m.down) {
      this.index = (this.index + 1) % this.items.length;
      audio.playSelect();
    }
    if (m.back) {
      this.pressedStart = false;
      audio.playBack();
      return;
    }
    if (m.confirm) {
      if (this.disabled()[this.index]) {
        audio.playBack();
        return;
      }
      audio.playConfirm();
      this.items[this.index].go();
    }
  }

  /** Local 2P needs a second physical device when Player 1 is on the touch pad. */
  private disabled(): boolean[] {
    const needsSecondDevice = this.game.input.touchMode && this.game.input.connectedPads() === 0;
    return this.items.map((_, i) => i === 1 && needsSecondDevice);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const time = g.time;
    const w = g.renderer.beginWorld();
    g.renderer.drawStage('rooftop', 0, 0, time, CANVAS_WIDTH);
    w.save();
    const shade = w.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    shade.addColorStop(0, 'rgba(6,3,14,0.35)');
    shade.addColorStop(0.6, 'rgba(6,3,14,0.55)');
    shade.addColorStop(1, 'rgba(6,3,14,0.9)');
    w.fillStyle = shade;
    w.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    w.restore();
    this.drawClashLight(w, time);
    this.drawHeroes(w, time);
    this.drawMotes(w, time);
    g.renderer.drawVignette();
    g.renderer.endWorld();
    this.drawHeroLabels(ctx);

    const logoY = this.pressedStart ? 132 : 170;
    g.ui.logo(ctx, CANVAS_WIDTH / 2, logoY, this.pressedStart ? 0.82 : 1, time);

    const touch = g.input.touchMode;
    if (!this.pressedStart) {
      const a = 0.45 + 0.55 * Math.abs(Math.sin(time * 0.05));
      g.ui.text(ctx, touch ? 'TAP TO START' : 'PRESS ANY KEY', CANVAS_WIDTH / 2, 380, 24, '#ffffff', { stroke: '#000', strokeWidth: 5, alpha: a });
      g.ui.text(ctx, 'The bots own the streets. Two legends fight to own the city.', CANVAS_WIDTH / 2, 412, 13, 'rgba(255,255,255,0.7)', {
        template: FONT_UI,
      });
    } else if (this.showControls) {
      this.drawControls(ctx);
    } else {
      const disabled = this.disabled();
      g.ui.menu(ctx, this.items.map((i) => i.label), this.index, CANVAS_WIDTH / 2, 262, time, 42, disabled);
      g.ui.panel(ctx, CANVAS_WIDTH / 2 - 300, 440, 600, 30);
      const hint = disabled[this.index] ? 'Player 2 needs a keyboard or gamepad. Connect one to play local versus.' : this.items[this.index].hint;
      g.ui.text(ctx, hint, CANVAS_WIDTH / 2, 460, 13, 'rgba(255,255,255,0.82)', { template: FONT_UI });
      if (touch) g.ui.text(ctx, 'Stick up / down to choose  ·  ATK to select', CANVAS_WIDTH / 2, 490, 12, 'rgba(255,255,255,0.55)', { template: FONT_UI });
    }

    const pads = g.input.connectedPads();
    const status = [
      g.audio.muted
        ? `SOUND: MUTED (${touch ? '\u266A' : 'M'})`
        : g.audio.ready
          ? `SOUND: ON (${touch ? '\u266A' : 'M'} to mute)`
          : touch
            ? 'Tap to enable sound'
            : 'Press any key or click to enable sound',
      pads > 0 ? `${pads} GAMEPAD${pads > 1 ? 'S' : ''} CONNECTED` : 'Gamepads supported',
    ].join('   ·   ');
    g.ui.text(ctx, status, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16, 11, 'rgba(255,255,255,0.45)', { template: FONT_UI });
    g.ui.text(ctx, 'v2.0', CANVAS_WIDTH - 14, CANVAS_HEIGHT - 16, 11, 'rgba(255,255,255,0.3)', { template: FONT_UI, align: 'right' });
  }

  private drawClashLight(ctx: CanvasRenderingContext2D, time: number): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = 300;
    const pulse = 0.8 + 0.2 * Math.sin(time * 0.06);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const left = ctx.createRadialGradient(cx - 60, cy, 10, cx - 60, cy, 360 * pulse);
    left.addColorStop(0, 'rgba(138,77,255,0.5)');
    left.addColorStop(1, 'rgba(138,77,255,0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const right = ctx.createRadialGradient(cx + 60, cy, 10, cx + 60, cy, 360 * pulse);
    right.addColorStop(0, 'rgba(255,106,42,0.42)');
    right.addColorStop(1, 'rgba(255,106,42,0)');
    ctx.fillStyle = right;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let y = 120;
    ctx.moveTo(cx, y);
    while (y < 470) {
      y += 18;
      ctx.lineTo(cx + Math.sin(time * 0.7 + y) * 7, y);
    }
    ctx.globalAlpha = 0.25 + 0.25 * Math.abs(Math.sin(time * 0.3));
    ctx.stroke();
    ctx.restore();
  }

  private drawHeroes(ctx: CanvasRenderingContext2D, time: number): void {
    const sprites = this.game.sprites;
    const floorY = 520;
    const sway = Math.sin(time * 0.02) * 6;
    this.game.renderer.withSprites((s) => {
      this.shadow(s, 220 + sway, floorY, 90);
      this.shadow(s, 740 - sway, floorY, 110);
      sprites.drawBody(s, 'ninja', 'normal', idlePose('ninja', time), 220 + sway, floorY, 1, 2.35, time);
      sprites.drawBody(s, 'brawler', 'normal', idlePose('brawler', time), 740 - sway, floorY, -1, 2.35, time);
    });

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rim = (x: number, color: string): void => {
      const gr = ctx.createRadialGradient(x, 360, 0, x, 360, 200);
      gr.addColorStop(0, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 200, 160, 400, 400);
    };
    rim(220 + sway, 'rgba(138,77,255,0.16)');
    rim(740 - sway, 'rgba(255,106,42,0.14)');
    ctx.restore();
  }

  private drawHeroLabels(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    ui.text(ctx, 'SLADE', 150, 505, 20, COLORS.voidGlow, { stroke: '#000', strokeWidth: 5, align: 'left' });
    ui.text(ctx, 'The Magick Ninja', 150, 522, 11, 'rgba(255,255,255,0.6)', { template: FONT_UI, align: 'left' });
    ui.text(ctx, 'FRECKLES', 810, 505, 20, COLORS.ember, { stroke: '#000', strokeWidth: 5, align: 'right' });
    ui.text(ctx, 'The Gothic Jester', 810, 522, 11, 'rgba(255,255,255,0.6)', { template: FONT_UI, align: 'right' });
  }

  private shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMotes(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const a = 0.35 + 0.35 * Math.sin(time * 0.05 + m.phase);
      ctx.fillStyle = m.hue === 'void' ? `rgba(199,155,255,${a})` : `rgba(255,170,90,${a})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawControls(ctx: CanvasRenderingContext2D): void {
    if (this.game.input.touchMode) {
      this.drawTouchControls(ctx);
      return;
    }
    const ui = this.game.ui;
    const x = 110;
    const y = 190;
    const w = CANVAS_WIDTH - 220;
    const rowH = 28;
    ui.panel(ctx, x, y, w, 44 + CONTROL_HELP.length * rowH + 30, 'rgba(8,6,18,0.9)');
    const cols = [x + 24, x + 200, x + 380, x + 560];
    ['ACTION', 'PLAYER 1', 'PLAYER 2', 'GAMEPAD'].forEach((h, i) =>
      ui.text(ctx, h, cols[i], y + 28, 13, i === 0 ? COLORS.hazard : i === 1 ? COLORS.voidGlow : i === 2 ? COLORS.ember : COLORS.cyan, {
        align: 'left',
      }),
    );
    CONTROL_HELP.forEach((row, r) => {
      const yy = y + 58 + r * rowH;
      if (r % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x + 10, yy - 18, w - 20, rowH);
      }
      ui.text(ctx, row.label, cols[0], yy, 13, '#ffffff', { align: 'left', template: FONT_UI });
      ui.text(ctx, row.p1, cols[1], yy, 13, 'rgba(255,255,255,0.8)', { align: 'left', template: FONT_UI });
      ui.text(ctx, row.p2, cols[2], yy, 13, 'rgba(255,255,255,0.8)', { align: 'left', template: FONT_UI });
      ui.text(ctx, row.pad, cols[3], yy, 13, 'rgba(255,255,255,0.8)', { align: 'left', template: FONT_UI });
    });
    ui.text(ctx, 'Press attack, jump or Esc to return', CANVAS_WIDTH / 2, y + 44 + CONTROL_HELP.length * rowH + 18, 12, 'rgba(255,255,255,0.55)', {
      template: FONT_UI,
    });
  }

  private drawTouchControls(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const x = 110;
    const y = 180;
    const w = CANVAS_WIDTH - 220;
    const rowH = 32;
    const h = 40 + TOUCH_HELP.length * rowH + 34;
    ui.panel(ctx, x, y, w, h, 'rgba(8,6,18,0.92)');
    ui.text(ctx, 'TOUCH CONTROLS', x + 24, y + 28, 15, COLORS.hazard, { align: 'left' });
    TOUCH_HELP.forEach((row, r) => {
      const yy = y + 62 + r * rowH;
      if (r % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x + 10, yy - 21, w - 20, rowH);
      }
      ui.text(ctx, row.label, x + 24, yy, 17, COLORS.voidGlow, { align: 'left', template: FONT_UI });
      ui.text(ctx, row.how, x + 190, yy, 16, '#ffffff', { align: 'left', template: FONT_UI });
    });
    ui.text(ctx, 'Tap ATK to return', CANVAS_WIDTH / 2, y + h - 12, 15, 'rgba(255,255,255,0.6)', { template: FONT_UI });
  }
}
