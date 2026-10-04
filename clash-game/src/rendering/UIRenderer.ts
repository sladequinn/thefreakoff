import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_DISPLAY, FONT_MONO, FONT_UI, font } from '../config/constants';
import type { Fighter } from '../entities/Fighter';
import type { Player } from '../entities/Player';
import type { Archetype } from '../physics/Types';
import type { SpriteRenderer } from './SpriteRenderer';

type Ctx = CanvasRenderingContext2D;

const HUD_ACCENT: Record<Archetype, string> = {
  ninja: '#5a2aa0',
  brawler: '#5a5664',
  kingpin: '#6b5a1e',
  fiddler: '#2a5a48',
  bat: '#3a3f58',
  bishop: '#5a4a1e',
  ninjabot: '#1a5a66',
  clownbot: '#6b3a1a',
};

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
    this.sprites.drawBust(ctx, f.def.archetype, f.variant === 'boss' ? 'normal' : f.variant, x, y, size, facing, time);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, size, size);
    ctx.restore();
  }

  // ------------------------------------------------------------------ story HUD

  storyHud(ctx: Ctx, p: Player, focus: Fighter | null, time: number, stageLabel: string): void {
    const accent = HUD_ACCENT[p.def.archetype];
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

  bossBar(ctx: Ctx, boss: Fighter, time: number, intro: number, tag = 'MASTER'): void {
    const w = 620;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = CANVAS_HEIGHT - 40;
    const reveal = Math.min(1, intro / 40);
    ctx.save();
    ctx.globalAlpha = reveal;
    const ninja = boss.def.archetype === 'ninja' || boss.def.archetype === 'ninjabot';
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
    const title = boss.def.title ? `  —  ${boss.def.title.toUpperCase()}` : '';
    this.text(ctx, `${boss.name}${title}`, x, y - 8, 12, '#ffe7a8', { align: 'left', template: FONT_UI, stroke: '#000', strokeWidth: 3 });
    this.text(ctx, tag, x + w, y - 8, 11, ninja ? '#c79bff' : '#ffb13b', { align: 'right', template: FONT_UI });
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
    this.portraitFrame(ctx, p1, 12, 12, 54, 1, time, HUD_ACCENT[p1.def.archetype]);
    this.portraitFrame(ctx, p2, CANVAS_WIDTH - 66, 12, 54, -1, time, HUD_ACCENT[p2.def.archetype]);
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

  // ------------------------------------------------------------------ tag-team HUD

  /**
   * One side of the tag HUD: point fighter on the big bar, partner on a slim bar beneath with a bust,
   * and a TAG READY / cooldown lamp. `flip` mirrors it for the right-hand team.
   */
  tagSideHud(ctx: Ctx, point: Fighter, partner: Fighter, flip: boolean, label: string, labelColor: string, tagReady: number, time: number): void {
    const barW = 300;
    const y = 30;
    const x = flip ? CANVAS_WIDTH - 76 - barW : 76;
    const edge = flip ? CANVAS_WIDTH - 78 : 78;
    const align: CanvasTextAlign = flip ? 'right' : 'left';
    this.portraitFrame(ctx, point, flip ? CANVAS_WIDTH - 66 : 12, 12, 54, flip ? -1 : 1, time, HUD_ACCENT[point.def.archetype]);
    this.healthBar(ctx, x, y, barW, 18, point, time, { flip, showSpecial: true });
    this.text(ctx, point.name, edge, 64, 15, '#fff', { align, stroke: '#000', strokeWidth: 3 });
    this.text(ctx, label, edge, 24, 11, labelColor, { align, template: FONT_UI });

    // Partner strip: bust + slim bar; a KO'd partner shows as a dark bar with a cross.
    const alive = partner.hp > 0;
    const px = flip ? CANVAS_WIDTH - 76 - 26 : 76;
    const py = 70;
    ctx.save();
    ctx.fillStyle = '#0a0712';
    ctx.fillRect(px - 2, py - 2, 30, 30);
    ctx.fillStyle = alive ? HUD_ACCENT[partner.def.archetype] : '#2a0c12';
    ctx.fillRect(px, py, 26, 26);
    if (alive) this.sprites.drawBust(ctx, partner.def.archetype, partner.variant === 'boss' ? 'normal' : partner.variant, px, py, 26, flip ? -1 : 1, time);
    else {
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 6, py + 6);
      ctx.lineTo(px + 20, py + 20);
      ctx.moveTo(px + 20, py + 6);
      ctx.lineTo(px + 6, py + 20);
      ctx.stroke();
    }
    ctx.restore();
    const sbW = barW - 34 - 110;
    const sbX = flip ? px - 8 - sbW : px + 34;
    if (alive) this.healthBar(ctx, sbX, py + 10, sbW, 8, partner, time, { flip, colors: ['#9fe8ff', '#3b8fd6'] });
    else {
      ctx.save();
      ctx.fillStyle = '#120a18';
      ctx.fillRect(sbX - 2, py + 8, sbW + 4, 12);
      ctx.fillStyle = '#2a0c12';
      ctx.fillRect(sbX, py + 10, sbW, 8);
      ctx.restore();
    }
    this.text(ctx, alive ? partner.name.toUpperCase() : `${partner.name.toUpperCase()}  ·  OUT`, flip ? sbX + sbW : sbX, py + 6, 9, alive ? 'rgba(255,255,255,0.75)' : '#ff7a8a', { align, template: FONT_UI });

    // Tag lamp sits outboard of the partner bar.
    const lx = flip ? sbX - 12 - 96 : sbX + sbW + 12;
    const ly = py + 4;
    const ready = alive && tagReady <= 0;
    ctx.save();
    ctx.fillStyle = ready ? `rgba(255,210,31,${0.75 + 0.25 * Math.sin(time * 0.2)})` : 'rgba(20,14,30,0.9)';
    ctx.fillRect(lx, ly, 96, 20);
    ctx.strokeStyle = ready ? '#fff6c4' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx + 0.5, ly + 0.5, 95, 19);
    if (!ready && alive && tagReady > 0) {
      ctx.fillStyle = 'rgba(255,210,31,0.35)';
      ctx.fillRect(lx + 2, ly + 16, 92 * Math.max(0, 1 - tagReady), 2);
    }
    ctx.restore();
    this.text(ctx, !alive ? 'NO PARTNER' : ready ? 'TAG READY' : 'TAG CHARGING', lx + 48, ly + 14, 9, ready ? '#120a1c' : 'rgba(255,255,255,0.55)', { template: FONT_UI });
  }

  tagTimer(ctx: Ctx, timer: number, time: number): void {
    const tx = CANVAS_WIDTH / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,12,0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 104);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#0a0712';
    ctx.fillRect(tx - 36, 14, 72, 52);
    ctx.strokeStyle = '#ffd86a';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - 36, 14, 72, 52);
    ctx.restore();
    const urgent = timer <= 10;
    this.text(ctx, String(Math.max(0, Math.ceil(timer))).padStart(3, '0'), tx, 56, 32, urgent && Math.floor(time / 10) % 2 ? '#ff4d4d' : '#ffe7a8', { stroke: '#000', strokeWidth: 4 });
    this.text(ctx, 'TAG TEAM', tx, 82, 10, 'rgba(255,255,255,0.6)', { template: FONT_UI });
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
    const title = 'FREAKOFF';
    const size = 104;

    ctx.save();
    ctx.transform(1, 0, -0.16, 1, 0, 0);
    for (let d = 9; d >= 1; d--) {
      this.text(ctx, title, d * 0.9, d * 1.1, size, d > 6 ? '#1a0306' : '#7a0d12', { stroke: '#1a0306', strokeWidth: 10 });
    }
    const g = ctx.createLinearGradient(0, -74, 0, 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.42, '#cfd5e2');
    g.addColorStop(0.5, '#5c6272');
    g.addColorStop(0.56, '#8a90a2');
    g.addColorStop(1, '#f2f5fb');
    ctx.save();
    ctx.shadowColor = 'rgba(255,40,40,0.65)';
    ctx.shadowBlur = 22 + 8 * Math.sin(time * 0.05);
    this.text(ctx, title, 0, 0, size, g, { stroke: '#0c0408', strokeWidth: 8 });
    ctx.restore();
    const sweep = ((time * 4) % 1000) - 500;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(sweep - 60, 0, sweep + 60, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    this.text(ctx, title, 0, 0, size, sg);
    ctx.restore();
    this.text(ctx, 'THE', -262, -70, 24, '#ffd21f', { align: 'left', stroke: '#000', strokeWidth: 6 });
    ctx.restore();

    ctx.save();
    ctx.translate(0, 46);
    const bw = 300;
    const bh = 42;
    const slant = 16;
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + slant, -bh / 2);
    ctx.lineTo(bw / 2 + slant, -bh / 2);
    ctx.lineTo(bw / 2 - slant, bh / 2);
    ctx.lineTo(-bw / 2 - slant, bh / 2);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
    bg.addColorStop(0, '#ff3b2a');
    bg.addColorStop(0.5, '#c0101a');
    bg.addColorStop(1, '#5a0510');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd21f';
    ctx.stroke();
    ctx.fillStyle = '#8a4dff';
    ctx.fillRect(-bw / 2 - slant - 40, -3, 30, 6);
    ctx.fillStyle = '#ece8f0';
    ctx.fillRect(bw / 2 + slant + 10, -3, 30, 6);
    const tg = ctx.createLinearGradient(0, -14, 0, 12);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(1, '#ffe07a');
    this.text(ctx, 'SHADOW WARS', 0, 12, 30, tg, { stroke: '#2a0206', strokeWidth: 6 });
    ctx.restore();

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

  pauseOverlay(ctx: Ctx, items: string[], index: number, time: number, touch = false, title = 'PAUSED'): void {
    ctx.save();
    ctx.fillStyle = 'rgba(4,2,10,0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
    const tall = items.length > 8;
    this.text(ctx, title, CANVAS_WIDTH / 2, tall ? 92 : 150, tall ? 44 : 56, '#ffffff', { stroke: '#000', strokeWidth: 6, shadow: 'rgba(138,77,255,0.8)' });
    const spacing = tall ? 30 : items.length > 5 ? 34 : 40;
    this.menu(ctx, items, index, CANVAS_WIDTH / 2, tall ? 150 : 215, time, spacing);
    const help = touch ? 'Stick up / down to choose   ·   ATK to select   ·   II to resume' : '`  toggles hitbox debug overlay   ·   M  mutes audio   ·   Esc resumes';
    this.text(ctx, help, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40, 12, 'rgba(255,255,255,0.5)', { template: FONT_UI });
  }

  statBar(ctx: Ctx, label: string, value: number, x: number, y: number, color: string): void {
    this.text(ctx, label, x, y + 9, 11, 'rgba(255,255,255,0.7)', { align: 'left', template: FONT_UI });
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < value ? color : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 74 + i * 22, y, 18, 10);
    }
  }
}
