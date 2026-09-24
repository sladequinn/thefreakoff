import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_DISPLAY, FONT_MONO, FONT_UI, font } from '../config/constants';
import type { Fighter } from '../entities/Fighter';
import type { Player } from '../entities/Player';
import type { SpriteRenderer } from './SpriteRenderer';

type Ctx = CanvasRenderingContext2D;

export interface TextOpts {
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  template?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow?: string;
  alpha?: number;
}

export class UIRenderer {
  constructor(private readonly sprites: SpriteRenderer) {}

  text(ctx: Ctx, str: string, x: number, y: number, size: number, color: string | CanvasGradient, o: TextOpts = {}): void {
    ctx.save();
    ctx.font = font(o.template ?? FONT_DISPLAY, size);
    ctx.textAlign = o.align ?? 'center';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.shadow) {
      ctx.shadowColor = o.shadow;
      ctx.shadowBlur = size * 0.6;
    }
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeWidth ?? Math.max(2, size * 0.14);
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  panel(ctx: Ctx, x: number, y: number, w: number, h: number, fill = COLORS.hudBg, border = 'rgba(255,255,255,0.12)'): void {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - 8, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  healthBar(
    ctx: Ctx,
    x: number,
    y: number,
    w: number,
    h: number,
    f: Fighter,
    time: number,
    opts: { flip?: boolean; colors?: [string, string]; showSpecial?: boolean } = {},
  ): void {
    const pct = Math.max(0, f.hp / f.maxHp);
    const lag = Math.max(pct, f.displayHp / f.maxHp);
    const flip = !!opts.flip;
    ctx.save();
    ctx.fillStyle = '#120a18';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a0d14';
    ctx.fillRect(x, y, w, h);
    const bx = (fraction: number): number => (flip ? x + w - w * fraction : x);
    ctx.fillStyle = COLORS.hpLag;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(bx(lag), y, w * lag, h);
    ctx.globalAlpha = 1;
    const low = pct < 0.25;
    const [c0, c1] = opts.colors ?? ['#fff27a', '#ffb13b'];
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (low && Math.floor(time / 8) % 2 === 0) {
      g.addColorStop(0, '#ff8080');
      g.addColorStop(1, COLORS.hpLow);
    } else {
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
    }
    ctx.fillStyle = g;
    ctx.fillRect(bx(pct), y, w * pct, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx(pct), y, w * pct, Math.max(1, h * 0.28));

    if (opts.showSpecial && f.def.special) {
      const cost = f.specialCost / f.maxHp;
      const afford = f.canAffordSpecial();
      const sx = flip ? x + w - w * pct : x + w * (pct - cost);
      ctx.fillStyle = afford ? `rgba(138,77,255,${0.55 + 0.25 * Math.sin(time * 0.15)})` : 'rgba(80,80,80,0.5)';
      if (pct > cost) ctx.fillRect(sx, y, w * cost, h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * i) / 10, y);
      ctx.lineTo(x + (w * i) / 10, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }

  portraitFrame(ctx: Ctx, f: Fighter, x: number, y: number, size: number, facing: number, time: number, accent: string): void {
    ctx.save();
    ctx.fillStyle = '#0a0712';
    ctx.fillRect(x - 3, y - 3, size + 6, size + 6);
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, accent);
    g.addColorStop(1, '#0a0712');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, size, size);
    this.sprites.drawPortrait(ctx, f.def.archetype, f.variant === 'boss' ? 'normal' : f.variant, x, y, size, size, facing, time);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, size, size);
    ctx.restore();
  }

  // ------------------------------------------------------------------ story HUD

  storyHud(ctx: Ctx, p: Player, focus: Fighter | null, time: number, stageLabel: string): void {
    const accent = p.def.archetype === 'ninja' ? '#5a2aa0' : '#b8481a';
    this.panel(ctx, 10, 10, 360, 78);
    this.portraitFrame(ctx, p, 20, 18, 60, 1, time, accent);
    this.text(ctx, p.name, 92, 34, 18, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 3 });
    ctx.font = font(FONT_DISPLAY, 18);
    const nameW = ctx.measureText(p.name).width;
    this.text(ctx, p.def.title.toUpperCase(), 92 + nameW + 10, 33, 10, 'rgba(255,255,255,0.55)', { align: 'left', template: FONT_UI });
    this.healthBar(ctx, 92, 40, 250, 14, p, time, { showSpecial: true });
    for (let i = 0; i < Math.max(0, p.lives); i++) {
      ctx.save();
      ctx.translate(96 + i * 16, 68);
      ctx.fillStyle = COLORS.hpFill;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    this.text(ctx, `SCORE ${String(p.score).padStart(7, '0')}`, 342, 73, 13, '#ffe7a8', { align: 'right', template: FONT_MONO });

    if (focus && focus.isTargetable() && focus !== (p as Fighter)) {
      this.panel(ctx, 10, 92, 260, 30, 'rgba(8,6,18,0.6)');
      this.text(ctx, focus.name, 22, 106, 11, '#ff9aa8', { align: 'left', template: FONT_UI });
      this.healthBar(ctx, 22, 111, 230, 6, focus, time, { colors: ['#ff6b6b', '#c4122f'] });
    }
    this.text(ctx, stageLabel, CANVAS_WIDTH - 16, 26, 12, 'rgba(255,255,255,0.75)', { align: 'right', template: FONT_UI, stroke: '#000', strokeWidth: 3 });
  }

  bossBar(ctx: Ctx, boss: Fighter, time: number, intro: number): void {
    const w = 620;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = CANVAS_HEIGHT - 40;
    const reveal = Math.min(1, intro / 40);
    ctx.save();
    ctx.globalAlpha = reveal;
    const ninja = boss.def.archetype === 'ninja';
    const gold = ctx.createLinearGradient(x, 0, x + w, 0);
    gold.addColorStop(0, '#7a5a1c');
    gold.addColorStop(0.5, '#ffe08a');
    gold.addColorStop(1, '#7a5a1c');
    ctx.fillStyle = 'rgba(6,4,12,0.85)';
    ctx.fillRect(x - 16, y - 24, w + 32, 44);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 16, y - 24, w + 32, 44);
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 12, y - 20, w + 24, 36);
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x - 16 : x + w + 16;
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(cx, y - 14);
      ctx.lineTo(cx + side * 12, y - 2);
      ctx.lineTo(cx, y + 10);
      ctx.lineTo(cx - side * 12, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + side * 20, y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = gold;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const px = x + 30 + i * ((w - 60) / 11);
      ctx.moveTo(px - 6, y - 20);
      ctx.quadraticCurveTo(px, y - 26, px + 6, y - 20);
    }
    ctx.stroke();
    this.text(ctx, `${boss.name}  —  ${boss.def.title.toUpperCase()}`, x, y - 8, 12, '#ffe7a8', { align: 'left', template: FONT_UI, stroke: '#000', strokeWidth: 3 });
    this.text(ctx, 'MASTER', x + w, y - 8, 11, ninja ? '#c79bff' : '#ffb13b', { align: 'right', template: FONT_UI });
    this.healthBar(ctx, x, y - 2, w, 12, boss, time, { colors: ninja ? ['#d6b8ff', '#6a1dff'] : ['#ffd08a', '#ff4a1a'] });
    ctx.restore();
  }

  goArrow(ctx: Ctx, time: number): void {
    if (Math.floor(time / 18) % 2 === 1) return;
    const x = CANVAS_WIDTH - 150;
    const y = 190;
    ctx.save();
    ctx.fillStyle = '#ffd21f';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 70, y - 30);
    ctx.lineTo(x + 120, y);
    ctx.lineTo(x + 70, y + 30);
    ctx.lineTo(x + 70, y + 14);
    ctx.lineTo(x + 20, y + 14);
    ctx.lineTo(x + 20, y - 14);
    ctx.lineTo(x + 70, y - 14);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    this.text(ctx, 'GO', x - 10, y + 16, 46, '#ffd21f', { stroke: '#000', strokeWidth: 6 });
  }

  banner(ctx: Ctx, title: string, sub: string, t: number, color: string, y = CANVAS_HEIGHT / 2 - 20): void {
    const inT = Math.min(1, t / 10);
    const scale = 1 + (1 - inT) * 1.6;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t / 6);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const bandH = sub ? 110 : 84;
    ctx.fillRect(0, y - bandH / 2 - 10, CANVAS_WIDTH, bandH);
    ctx.fillStyle = color;
    ctx.fillRect(0, y - bandH / 2 - 10, CANVAS_WIDTH, 2);
    ctx.fillRect(0, y + bandH / 2 - 12, CANVAS_WIDTH, 2);
    ctx.translate(CANVAS_WIDTH / 2, y + (sub ? 6 : 18));
    ctx.scale(scale, scale);
    const g = ctx.createLinearGradient(0, -40, 0, 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, color);
    g.addColorStop(1, '#2a0a3a');
    this.text(ctx, title, 0, 0, 56, g, { stroke: '#000', strokeWidth: 7 });
    ctx.restore();
    if (sub) this.text(ctx, sub, CANVAS_WIDTH / 2, y + 36, 15, '#ffffff', { template: FONT_UI, alpha: Math.min(1, t / 14), stroke: '#000', strokeWidth: 3 });
  }

  comboCounter(ctx: Ctx, hits: number, x: number, y: number, align: CanvasTextAlign, alpha: number, color: string): void {
    if (hits < 2 || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    this.text(ctx, String(hits), x, y, 48, color, { align, stroke: '#000', strokeWidth: 6 });
    const w = ctx.measureText(String(hits)).width;
    ctx.font = font(FONT_DISPLAY, 48);
    const numW = ctx.measureText(String(hits)).width;
    const off = align === 'left' ? numW + 8 : align === 'right' ? -numW - 8 : w / 2 + 8;
    this.text(ctx, 'HITS', x + off, y, 18, '#ffffff', { align, stroke: '#000', strokeWidth: 4 });
    ctx.restore();
  }

  // ------------------------------------------------------------------ versus HUD

  vsHud(
    ctx: Ctx,
    p1: Fighter,
    p2: Fighter,
    wins: [number, number],
    roundsToWin: number,
    timer: number,
    time: number,
    p2Label: string,
  ): void {
    const barW = 360;
    const y = 30;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,12,0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 78);
    ctx.restore();
    this.portraitFrame(ctx, p1, 12, 12, 54, 1, time, p1.def.archetype === 'ninja' ? '#5a2aa0' : '#b8481a');
    this.portraitFrame(ctx, p2, CANVAS_WIDTH - 66, 12, 54, -1, time, p2.def.archetype === 'ninja' ? '#5a2aa0' : '#b8481a');
    this.healthBar(ctx, 76, y, barW, 18, p1, time, { showSpecial: true });
    this.healthBar(ctx, CANVAS_WIDTH - 76 - barW, y, barW, 18, p2, time, { flip: true, showSpecial: true });
    this.text(ctx, p1.name, 78, 64, 15, '#fff', { align: 'left', stroke: '#000', strokeWidth: 3 });
    this.text(ctx, '1P', 78, 24, 11, '#6fb6ff', { align: 'left', template: FONT_UI });
    this.text(ctx, p2.name, CANVAS_WIDTH - 78, 64, 15, '#fff', { align: 'right', stroke: '#000', strokeWidth: 3 });
    this.text(ctx, p2Label, CANVAS_WIDTH - 78, 24, 11, '#ff7a8a', { align: 'right', template: FONT_UI });

    for (let i = 0; i < roundsToWin; i++) {
      this.pip(ctx, 76 + barW - 12 - i * 20, 62, i < wins[0]);
      this.pip(ctx, CANVAS_WIDTH - 76 - barW + 12 + i * 20, 62, i < wins[1]);
    }

    const tx = CANVAS_WIDTH / 2;
    ctx.save();
    ctx.fillStyle = '#0a0712';
    ctx.fillRect(tx - 32, 14, 64, 52);
    ctx.strokeStyle = '#ffd86a';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - 32, 14, 64, 52);
    ctx.restore();
    const urgent = timer <= 10;
    this.text(ctx, String(Math.max(0, Math.ceil(timer))).padStart(2, '0'), tx, 56, 36, urgent && Math.floor(time / 10) % 2 ? '#ff4d4d' : '#ffe7a8', { stroke: '#000', strokeWidth: 4 });
  }

  private pip(ctx: Ctx, x: number, y: number, won: boolean): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = won ? '#ffd21f' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.strokeStyle = won ? '#fff6c4' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }

  // ------------------------------------------------------------------ menus & branding

  logo(ctx: Ctx, x: number, y: number, scale: number, time: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const g = ctx.createLinearGradient(0, -80, 0, 10);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#c7ccd6');
    g.addColorStop(0.5, '#6a7080');
    g.addColorStop(1, '#e8ecf4');
    ctx.save();
    ctx.shadowColor = 'rgba(138,77,255,0.9)';
    ctx.shadowBlur = 30 + 10 * Math.sin(time * 0.05);
    this.text(ctx, 'CLASH', 0, 0, 120, g, { stroke: '#120a1c', strokeWidth: 10 });
    ctx.restore();
    const sweep = ((time * 4) % 900) - 450;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(sweep - 60, 0, sweep + 60, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    this.text(ctx, 'CLASH', 0, 0, 120, sg);
    ctx.restore();
    const a = ctx.createLinearGradient(-200, 0, 0, 0);
    a.addColorStop(0, '#6a1dff');
    a.addColorStop(1, '#d6b8ff');
    const i = ctx.createLinearGradient(0, 0, 200, 0);
    i.addColorStop(0, '#ffd08a');
    i.addColorStop(1, '#ff4a1a');
    this.text(ctx, 'ARCANE', -26, 44, 34, a, { align: 'right', stroke: '#000', strokeWidth: 5 });
    this.text(ctx, '&', 0, 44, 30, '#ffffff', { stroke: '#000', strokeWidth: 5 });
    this.text(ctx, 'IRON', 26, 44, 34, i, { align: 'left', stroke: '#000', strokeWidth: 5 });
    ctx.restore();
  }

  menu(ctx: Ctx, items: string[], index: number, x: number, y: number, time: number, spacing = 38, disabled: boolean[] = []): void {
    items.forEach((label, i) => {
      const sel = i === index;
      const yy = y + i * spacing;
      if (sel) {
        ctx.save();
        const g = ctx.createLinearGradient(x - 180, 0, x + 180, 0);
        g.addColorStop(0, 'rgba(138,77,255,0)');
        g.addColorStop(0.5, 'rgba(138,77,255,0.45)');
        g.addColorStop(1, 'rgba(255,106,42,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 200, yy - 24, 400, 32);
        ctx.restore();
        const bob = Math.sin(time * 0.2) * 3;
        this.text(ctx, '▶', x - 170 + bob, yy, 18, '#ffd21f');
        this.text(ctx, '◀', x + 170 - bob, yy, 18, '#ffd21f');
      }
      this.text(ctx, label, x, yy, sel ? 24 : 20, disabled[i] ? 'rgba(255,255,255,0.3)' : sel ? '#ffffff' : 'rgba(255,255,255,0.62)', {
        stroke: '#000',
        strokeWidth: 4,
      });
    });
  }

  pauseOverlay(ctx: Ctx, index: number, time: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(4,2,10,0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
    this.text(ctx, 'PAUSED', CANVAS_WIDTH / 2, 190, 56, '#ffffff', { stroke: '#000', strokeWidth: 6, shadow: 'rgba(138,77,255,0.8)' });
    this.menu(ctx, ['RESUME', 'RESTART', 'QUIT TO TITLE'], index, CANVAS_WIDTH / 2, 270, time);
    this.text(ctx, '`  toggles hitbox debug overlay   ·   M  mutes audio', CANVAS_WIDTH / 2, 470, 12, 'rgba(255,255,255,0.5)', { template: FONT_UI });
  }

  statBar(ctx: Ctx, label: string, value: number, x: number, y: number, color: string): void {
    this.text(ctx, label, x, y + 9, 11, 'rgba(255,255,255,0.7)', { align: 'left', template: FONT_UI });
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < value ? color : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 74 + i * 22, y, 18, 10);
    }
  }
}
