import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_MONO, STAGE_MAX_Z, STAGE_MIN_Z, font } from '../config/constants';
import { hitboxWorld, hurtboxWorld } from '../physics/Collision';
import type { Projectile } from '../entities/Entity';
import type { Fighter } from '../entities/Fighter';

export type StageTheme = 'outskirts' | 'facility' | 'sanctuary' | 'rooftop';

interface Layer {
  canvas: HTMLCanvasElement;
  factor: number;
  y: number;
  q: number;
}

const LAYER_Q = 2;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makeLayer(width: number, height: number, factor: number, y: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Layer {
  const c = document.createElement('canvas');
  c.width = Math.ceil(width * LAYER_Q);
  c.height = Math.ceil(height * LAYER_Q);
  const ctx = c.getContext('2d')!;
  ctx.scale(LAYER_Q, LAYER_Q);
  paint(ctx, width, height);
  return { canvas: c, factor, y, q: LAYER_Q };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  scale = 1;
  dpr = 1;
  private layers = new Map<string, Layer[]>();

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.scale = Math.max(0.2, Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.floor(CANVAS_WIDTH * this.scale);
    const cssH = Math.floor(CANVAS_HEIGHT * this.scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
  }

  beginFrame(): CanvasRenderingContext2D {
    const ctx = this.ctx;
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineCap = 'round';
    return ctx;
  }

  // ============================================================== stages

  private getLayers(theme: StageTheme, stageWidth: number): Layer[] {
    const key = `${theme}:${stageWidth}`;
    let l = this.layers.get(key);
    if (!l) {
      l = this.buildLayers(theme, stageWidth);
      this.layers.set(key, l);
    }
    return l;
  }

  private buildLayers(theme: StageTheme, stageWidth: number): Layer[] {
    const scroll = Math.max(0, stageWidth - CANVAS_WIDTH);
    switch (theme) {
      case 'outskirts':
        return [
          makeLayer(CANVAS_WIDTH + scroll * 0.15 + 20, 320, 0.15, 0, (c, w) => this.paintSkyline(c, w, 301)),
          makeLayer(CANVAS_WIDTH + scroll * 0.45 + 20, 340, 0.45, 0, (c, w) => this.paintOutskirtsMid(c, w)),
        ];
      case 'facility':
        return [makeLayer(CANVAS_WIDTH + scroll * 0.6 + 20, 340, 0.6, 0, (c, w) => this.paintFacilityWall(c, w))];
      case 'sanctuary':
        return [makeLayer(CANVAS_WIDTH, 340, 0, 0, (c, w) => this.paintSanctuary(c, w))];
      case 'rooftop':
        return [makeLayer(CANVAS_WIDTH, 340, 0, 0, (c, w) => this.paintRooftop(c, w))];
    }
  }

  drawStage(theme: StageTheme, camX: number, camY: number, time: number, stageWidth: number): void {
    const ctx = this.ctx;
    this.drawSky(theme, time, camX);
    for (const layer of this.getLayers(theme, stageWidth)) {
      const sx = camX * layer.factor;
      ctx.drawImage(
        layer.canvas,
        sx * layer.q,
        0,
        CANVAS_WIDTH * layer.q,
        layer.canvas.height,
        0,
        layer.y - camY * 0.3,
        CANVAS_WIDTH,
        layer.canvas.height / layer.q,
      );
    }
    this.drawAnimatedBackdrop(theme, time, camX);
    this.drawGround(theme, camX, camY, time);
  }

  private drawSky(theme: StageTheme, time: number, camX: number): void {
    const ctx = this.ctx;
    let g: CanvasGradient;
    switch (theme) {
      case 'outskirts': {
        g = ctx.createLinearGradient(0, 0, 0, 320);
        g.addColorStop(0, '#140b2e');
        g.addColorStop(0.45, '#4d1f5c');
        g.addColorStop(0.8, '#c4455a');
        g.addColorStop(1, '#f59a4e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CANVAS_WIDTH, 330);
        const sx = 640 - camX * 0.04;
        const sun = ctx.createLinearGradient(0, 120, 0, 290);
        sun.addColorStop(0, '#ffe07a');
        sun.addColorStop(1, '#ff4f6a');
        ctx.fillStyle = sun;
        ctx.beginPath();
        ctx.arc(sx, 230, 88, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c4455a';
        for (let i = 0; i < 7; i++) ctx.fillRect(sx - 100, 214 + i * 12, 200, 2 + i * 0.9);
        break;
      }
      case 'facility': {
        g = ctx.createLinearGradient(0, 0, 0, 330);
        g.addColorStop(0, '#07090f');
        g.addColorStop(1, '#141a26');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CANVAS_WIDTH, 340);
        break;
      }
      case 'sanctuary': {
        g = ctx.createLinearGradient(0, 0, 0, 330);
        g.addColorStop(0, '#04050f');
        g.addColorStop(0.6, '#161236');
        g.addColorStop(1, '#3a1e4a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CANVAS_WIDTH, 340);
        for (let i = 0; i < 90; i++) {
          const x = hash(i) * CANVAS_WIDTH;
          const y = hash(i + 99) * 220;
          const tw = 0.5 + 0.5 * Math.sin(time * 0.05 + i);
          ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`;
          ctx.fillRect(x, y, 1.6, 1.6);
        }
        const mg = ctx.createRadialGradient(720, 90, 10, 720, 90, 120);
        mg.addColorStop(0, 'rgba(230,220,255,0.55)');
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(600, 0, 240, 220);
        ctx.fillStyle = '#efe8ff';
        ctx.beginPath();
        ctx.arc(720, 90, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(180,160,220,0.35)';
        ctx.beginPath();
        ctx.arc(708, 82, 8, 0, Math.PI * 2);
        ctx.arc(732, 104, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rooftop': {
        g = ctx.createLinearGradient(0, 0, 0, 330);
        g.addColorStop(0, '#060a1c');
        g.addColorStop(0.55, '#1c1045');
        g.addColorStop(1, '#5a1a58');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CANVAS_WIDTH, 340);
        ctx.fillStyle = '#ffeefc';
        ctx.beginPath();
        ctx.arc(180, 80, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1c1045';
        ctx.beginPath();
        ctx.arc(192, 72, 28, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  private paintSkyline(ctx: CanvasRenderingContext2D, w: number, seed: number): void {
    const rnd = mulberry32(seed);
    for (let pass = 0; pass < 2; pass++) {
      let x = -20;
      while (x < w) {
        const bw = 36 + rnd() * 80;
        const bh = (pass === 0 ? 120 : 60) + rnd() * (pass === 0 ? 120 : 110);
        const base = 312;
        ctx.fillStyle = pass === 0 ? '#2a1638' : '#1c0f28';
        ctx.fillRect(x, base - bh, bw, bh);
        if (rnd() < 0.3) ctx.fillRect(x + bw * 0.4, base - bh - 18, 3, 18);
        if (pass === 1) {
          for (let wy = base - bh + 8; wy < base - 6; wy += 9) {
            for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
              if (rnd() < 0.28) {
                ctx.fillStyle = rnd() < 0.8 ? 'rgba(255,184,90,0.75)' : 'rgba(120,230,255,0.7)';
                ctx.fillRect(wx, wy, 3, 4);
              }
            }
          }
        }
        x += bw + rnd() * 10;
      }
    }
  }

  private paintOutskirtsMid(ctx: CanvasRenderingContext2D, w: number): void {
    const rnd = mulberry32(77);
    ctx.fillStyle = '#231226';
    ctx.fillRect(0, 300, w, 40);
    for (let x = 0; x < w; x += 16) {
      ctx.strokeStyle = 'rgba(40,24,40,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 262);
      ctx.lineTo(x + 16, 318);
      ctx.moveTo(x + 16, 262);
      ctx.lineTo(x, 318);
      ctx.stroke();
    }
    ctx.fillStyle = '#1a0d1c';
    ctx.fillRect(0, 258, w, 4);
    for (let x = 0; x < w; x += 64) ctx.fillRect(x, 258, 4, 62);

    for (let x = 120; x < w; x += 300 + rnd() * 80) {
      if (rnd() < 0.5) {
        ctx.fillStyle = '#170a1a';
        ctx.fillRect(x, 150, 8, 170);
        ctx.fillRect(x - 70, 140, 150, 80);
        const g = ctx.createLinearGradient(x - 64, 146, x + 74, 214);
        g.addColorStop(0, '#3b1d52');
        g.addColorStop(1, '#6a1f3f');
        ctx.fillStyle = g;
        ctx.fillRect(x - 64, 146, 138, 68);
        ctx.font = "900 20px 'Arial Black', Impact, sans-serif";
        ctx.fillStyle = rnd() < 0.5 ? '#ff9ad5' : '#7df9ff';
        ctx.textAlign = 'center';
        ctx.fillText(rnd() < 0.5 ? 'NEO-KASAI' : 'IRON SYND.', x + 5, 188);
        ctx.font = "700 10px 'Trebuchet MS', sans-serif";
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('YOUR FUTURE IS AUTOMATED', x + 5, 205);
      } else {
        ctx.fillStyle = '#1b0e1e';
        ctx.fillRect(x, 60, 7, 260);
        ctx.fillRect(x - 26, 76, 60, 5);
        ctx.fillRect(x - 18, 92, 44, 4);
        ctx.strokeStyle = 'rgba(20,10,20,0.8)';
        ctx.lineWidth = 1.2;
        for (const dy of [78, 94]) {
          ctx.beginPath();
          ctx.moveTo(x - 24, dy);
          ctx.quadraticCurveTo(x - 160, dy + 34, x - 300, dy);
          ctx.stroke();
        }
      }
    }
    for (let x = 200; x < w; x += 520 + rnd() * 200) {
      ctx.fillStyle = '#130914';
      ctx.beginPath();
      ctx.moveTo(x, 330);
      ctx.lineTo(x + 12, 306);
      ctx.lineTo(x + 40, 298);
      ctx.lineTo(x + 90, 298);
      ctx.lineTo(x + 112, 310);
      ctx.lineTo(x + 130, 312);
      ctx.lineTo(x + 132, 330);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,120,80,0.35)';
      ctx.fillRect(x + 46, 302, 36, 8);
    }
  }

  private paintFacilityWall(ctx: CanvasRenderingContext2D, w: number): void {
    const rnd = mulberry32(911);
    const g = ctx.createLinearGradient(0, 40, 0, 330);
    g.addColorStop(0, '#0e131c');
    g.addColorStop(1, '#1d2533');
    ctx.fillStyle = g;
    ctx.fillRect(0, 30, w, 310);
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, w, 40);
    for (let x = 0; x < w; x += 120) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, 44, 116, 132);
      ctx.strokeRect(x + 2, 180, 116, 120);
      ctx.fillStyle = 'rgba(160,180,200,0.25)';
      for (const [rx, ry] of [
        [8, 50],
        [110, 50],
        [8, 170],
        [110, 170],
      ]) {
        ctx.fillRect(x + rx, ry, 2, 2);
      }
    }
    for (let x = 60; x < w; x += 480) {
      const cg = ctx.createRadialGradient(x + 120, 130, 10, x + 120, 130, 110);
      cg.addColorStop(0, 'rgba(255,150,60,0.55)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = '#05070a';
      ctx.fillRect(x + 40, 70, 160, 120);
      ctx.fillStyle = cg;
      ctx.fillRect(x + 40, 70, 160, 120);
      ctx.strokeStyle = '#39424f';
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 40, 70, 160, 120);
      ctx.beginPath();
      ctx.moveTo(x + 120, 70);
      ctx.lineTo(x + 120, 190);
      ctx.moveTo(x + 40, 130);
      ctx.lineTo(x + 200, 130);
      ctx.stroke();
      ctx.fillStyle = '#ffb04a';
      ctx.beginPath();
      ctx.arc(x + 120, 150, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let x = 0; x < w; x += 180 + rnd() * 120) {
      const pw = 14 + rnd() * 14;
      const pg = ctx.createLinearGradient(x, 0, x + pw, 0);
      pg.addColorStop(0, '#2a323d');
      pg.addColorStop(0.5, '#6d7885');
      pg.addColorStop(1, '#1d232b');
      ctx.fillStyle = pg;
      ctx.fillRect(x, 30, pw, 300);
      ctx.fillStyle = '#10141a';
      for (let y = 60; y < 320; y += 70) ctx.fillRect(x - 3, y, pw + 6, 6);
    }
    const hp = ctx.createLinearGradient(0, 214, 0, 232);
    hp.addColorStop(0, '#59636f');
    hp.addColorStop(1, '#232a33');
    ctx.fillStyle = hp;
    ctx.fillRect(0, 214, w, 18);
    ctx.fillStyle = '#10141a';
    for (let x = 0; x < w; x += 90) ctx.fillRect(x, 212, 8, 22);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 306, w, 22);
    ctx.clip();
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 306, w, 22);
    ctx.fillStyle = COLORS.hazard;
    for (let x = -30; x < w + 30; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 328);
      ctx.lineTo(x + 14, 306);
      ctx.lineTo(x + 28, 306);
      ctx.lineTo(x + 14, 328);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.font = "900 28px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = 'center';
    for (let x = 300; x < w; x += 900) {
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(x - 90, 244, 180, 46);
      ctx.fillStyle = '#39f3ff';
      ctx.fillText('CORE-07', x, 278);
    }
    for (let x = 700; x < w; x += 900) {
      ctx.fillStyle = COLORS.hazard;
      ctx.fillRect(x - 60, 246, 120, 40);
      ctx.fillStyle = '#111';
      ctx.font = "900 15px 'Arial Black', Impact, sans-serif";
      ctx.fillText('DANGER', x, 264);
      ctx.font = "700 10px 'Trebuchet MS', sans-serif";
      ctx.fillText('AUTOMATON TESTING', x, 279);
    }
  }

  private paintSanctuary(ctx: CanvasRenderingContext2D, w: number): void {
    const rnd = mulberry32(5150);
    ctx.fillStyle = '#1a1433';
    ctx.beginPath();
    ctx.moveTo(0, 260);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, 200 + Math.sin(x * 0.012) * 40 + rnd() * 20);
    ctx.lineTo(w, 330);
    ctx.lineTo(0, 330);
    ctx.fill();
    ctx.fillStyle = '#120d26';
    ctx.beginPath();
    ctx.moveTo(0, 290);
    for (let x = 0; x <= w; x += 30) ctx.lineTo(x, 250 + Math.sin(x * 0.02 + 1) * 24 + rnd() * 10);
    ctx.lineTo(w, 330);
    ctx.lineTo(0, 330);
    ctx.fill();

    const cx = w / 2;
    ctx.fillStyle = '#0b0818';
    for (let i = 0; i < 4; i++) {
      const tw = 170 - i * 34;
      const y = 250 - i * 40;
      ctx.fillRect(cx - tw / 2 + 12, y, tw - 24, 40);
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2 - 18, y + 4);
      ctx.quadraticCurveTo(cx, y - 18, cx + tw / 2 + 18, y + 4);
      ctx.lineTo(cx + tw / 2 - 4, y + 10);
      ctx.lineTo(cx - tw / 2 + 4, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,170,90,0.55)';
      for (let k = 0; k < 3; k++) ctx.fillRect(cx - 24 + k * 20, y + 18, 8, 12);
      ctx.fillStyle = '#0b0818';
    }
    ctx.fillRect(cx - 2, 70, 4, 30);

    for (const tx of [150, w - 150]) {
      ctx.fillStyle = '#5a1020';
      ctx.fillRect(tx - 46, 200, 10, 130);
      ctx.fillRect(tx + 36, 200, 10, 130);
      ctx.fillRect(tx - 62, 196, 124, 12);
      ctx.fillRect(tx - 52, 222, 104, 8);
      ctx.fillStyle = '#2a0810';
      ctx.fillRect(tx - 66, 190, 132, 7);
    }
    for (const [tx, s] of [
      [60, 1],
      [300, 0.8],
      [660, 0.85],
      [900, 1.05],
    ] as const) {
      ctx.fillStyle = '#1a0f16';
      ctx.fillRect(tx - 4 * s, 240, 8 * s, 90);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = k % 3 === 0 ? '#c7568f' : k % 3 === 1 ? '#e27aab' : '#a23d73';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(tx + (rnd() - 0.5) * 90 * s, 230 + (rnd() - 0.5) * 50 * s, 16 + rnd() * 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const lx of [240, 420, 540, 720]) {
      ctx.fillStyle = '#2a2436';
      ctx.fillRect(lx - 5, 292, 10, 36);
      ctx.fillRect(lx - 12, 282, 24, 10);
      ctx.fillRect(lx - 14, 276, 28, 5);
    }
  }

  private paintRooftop(ctx: CanvasRenderingContext2D, w: number): void {
    const rnd = mulberry32(4242);
    this.paintSkyline(ctx, w, 99);
    for (let i = 0; i < 6; i++) {
      const x = 60 + rnd() * (w - 120);
      const y = 110 + rnd() * 120;
      ctx.fillStyle = ['#ff3dbb', '#39f3ff', '#ffd21f', '#7dff9b'][i % 4];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, 30 + rnd() * 40, 6);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#140c24';
    ctx.fillRect(740, 170, 70, 90);
    ctx.fillRect(748, 260, 6, 60);
    ctx.fillRect(796, 260, 6, 60);
    ctx.beginPath();
    ctx.moveTo(736, 172);
    ctx.lineTo(775, 146);
    ctx.lineTo(814, 172);
    ctx.fill();
    ctx.fillStyle = '#1b1230';
    ctx.fillRect(90, 262, 110, 58);
    ctx.fillRect(560, 276, 80, 44);
    ctx.fillStyle = '#2a1f45';
    for (let k = 0; k < 5; k++) ctx.fillRect(100 + k * 20, 272, 12, 38);
    ctx.fillStyle = '#0d0818';
    ctx.fillRect(0, 312, w, 5);
    for (let x = 0; x < w; x += 30) ctx.fillRect(x, 296, 3, 20);
    ctx.fillRect(0, 296, w, 3);
  }

  private drawAnimatedBackdrop(theme: StageTheme, time: number, camX: number): void {
    const ctx = this.ctx;
    if (theme === 'facility') {
      for (let i = 0; i < 9; i++) {
        const wx = i * 180 + 60;
        const sx = ((wx - camX * 0.6) % (CANVAS_WIDTH + 180) + CANVAS_WIDTH + 180) % (CANVAS_WIDTH + 180) - 90;
        const flick = hash(i + Math.floor(time / 6)) > 0.93 ? 0.2 : 1;
        const g = ctx.createRadialGradient(sx, 36, 2, sx, 60, 90);
        g.addColorStop(0, `rgba(160,240,255,${0.5 * flick})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - 90, 30, 180, 120);
        ctx.fillStyle = `rgba(200,250,255,${0.9 * flick})`;
        ctx.fillRect(sx - 18, 32, 36, 4);
      }
    } else if (theme === 'rooftop') {
      const on = Math.floor(time / 40) % 2 === 0;
      ctx.save();
      ctx.font = "900 34px 'Arial Black', Impact, sans-serif";
      ctx.textAlign = 'center';
      ctx.shadowColor = on ? '#ff3dbb' : '#39f3ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = on ? '#ff8ad8' : '#9ffbff';
      ctx.fillText(on ? 'CLASH' : 'ARCANE & IRON', 470, 150);
      ctx.restore();
    } else if (theme === 'sanctuary') {
      for (const lx of [240, 420, 540, 720]) {
        const flick = 0.8 + 0.2 * Math.sin(time * 0.3 + lx);
        const g = ctx.createRadialGradient(lx, 290, 1, lx, 290, 40);
        g.addColorStop(0, `rgba(255,190,100,${0.8 * flick})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(lx - 40, 250, 80, 80);
      }
    }
  }

  private drawGround(theme: StageTheme, camX: number, camY: number, time: number): void {
    const ctx = this.ctx;
    const top = STAGE_MIN_Z - 14 - camY;
    const H = CANVAS_HEIGHT - top;
    const cx = CANVAS_WIDTH / 2;
    const persp = (xs: number, y: number): number => cx + (xs - cx) * (1 + ((y - top) / H) * 0.45);

    switch (theme) {
      case 'outskirts': {
        ctx.fillStyle = '#4a3a44';
        ctx.fillRect(0, top - 10, CANVAS_WIDTH, 16);
        ctx.fillStyle = '#6d5a62';
        ctx.fillRect(0, top - 12, CANVAS_WIDTH, 3);
        const g = ctx.createLinearGradient(0, top + 6, 0, CANVAS_HEIGHT);
        g.addColorStop(0, '#2c2230');
        g.addColorStop(1, '#17121b');
        ctx.fillStyle = g;
        ctx.fillRect(0, top + 6, CANVAS_WIDTH, H);
        const start = Math.floor(camX / 60) - 1;
        for (let i = start; i < start + 20; i++) {
          const xs = i * 60 - camX;
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(xs, top - 10, 2, 16);
        }
        const dashStart = Math.floor(camX / 140) - 1;
        for (let i = dashStart; i < dashStart + 10; i++) {
          const xs = i * 140 - camX;
          ctx.fillStyle = 'rgba(255,214,120,0.55)';
          ctx.beginPath();
          const y0 = 430;
          ctx.moveTo(persp(xs, y0), y0);
          ctx.lineTo(persp(xs + 70, y0), y0);
          ctx.lineTo(persp(xs + 70, y0 + 6), y0 + 6);
          ctx.lineTo(persp(xs, y0 + 6), y0 + 6);
          ctx.fill();
        }
        const tileStart = Math.floor(camX / 200) - 1;
        for (let i = tileStart; i < tileStart + 8; i++) {
          const r = hash(i);
          const xs = i * 200 + r * 120 - camX;
          const y = top + 30 + hash(i + 3) * (H - 50);
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(xs, y);
          ctx.lineTo(xs + 14, y + 6);
          ctx.lineTo(xs + 22, y + 3);
          ctx.lineTo(xs + 36, y + 10);
          ctx.stroke();
          if (r > 0.6) {
            const pg = ctx.createLinearGradient(0, y + 16, 0, y + 30);
            pg.addColorStop(0, 'rgba(245,154,78,0.28)');
            pg.addColorStop(1, 'rgba(90,40,90,0.2)');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.ellipse(xs + 60, y + 22, 44, 8, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          if (r < 0.2) {
            ctx.fillStyle = '#211a24';
            ctx.beginPath();
            ctx.ellipse(xs + 100, y + 14, 20, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(120,110,120,0.5)';
            ctx.stroke();
          }
        }
        break;
      }
      case 'facility': {
        const g = ctx.createLinearGradient(0, top, 0, CANVAS_HEIGHT);
        g.addColorStop(0, '#2a323d');
        g.addColorStop(1, '#12161c');
        ctx.fillStyle = g;
        ctx.fillRect(0, top, CANVAS_WIDTH, H);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 2;
        for (const yf of [0.12, 0.3, 0.55, 0.85]) {
          const y = top + H * yf;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(CANVAS_WIDTH, y);
          ctx.stroke();
        }
        const s = Math.floor(camX / 96) - 3;
        for (let i = s; i < s + 18; i++) {
          const xs = i * 96 - camX;
          ctx.beginPath();
          ctx.moveTo(persp(xs, top), top);
          ctx.lineTo(persp(xs, CANVAS_HEIGHT), CANVAS_HEIGHT);
          ctx.stroke();
          if (hash(i) > 0.7) {
            ctx.fillStyle = 'rgba(57,243,255,0.08)';
            ctx.fillRect(persp(xs, top + H * 0.3) + 6, top + H * 0.3 + 3, 80, H * 0.25 - 6);
          }
        }
        ctx.fillStyle = 'rgba(255,210,31,0.8)';
        ctx.fillRect(0, top, CANVAS_WIDTH, 3);
        break;
      }
      case 'sanctuary': {
        const g = ctx.createLinearGradient(0, top, 0, CANVAS_HEIGHT);
        g.addColorStop(0, '#3a3348');
        g.addColorStop(1, '#1b1724');
        ctx.fillStyle = g;
        ctx.fillRect(0, top, CANVAS_WIDTH, H);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.5;
        for (let r = 0; r < 6; r++) {
          const y = top + H * (r / 6) ** 1.2;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(CANVAS_WIDTH, y);
          ctx.stroke();
          const off = r % 2 ? 40 : 0;
          for (let x = -80 + off; x < CANVAS_WIDTH + 80; x += 80) {
            ctx.beginPath();
            ctx.moveTo(persp(x, y), y);
            ctx.lineTo(persp(x, top + H * ((r + 1) / 6) ** 1.2), top + H * ((r + 1) / 6) ** 1.2);
            ctx.stroke();
          }
        }
        ctx.save();
        ctx.translate(CANVAS_WIDTH / 2, 430);
        ctx.scale(1, 0.3);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(140,77,255,${0.25 + 0.1 * Math.sin(time * 0.05)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 260, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 200, 0, Math.PI * 2);
        ctx.stroke();
        ctx.rotate(time * 0.003);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const b = ((i + 2) / 5) * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * 200, Math.sin(a) * 200);
          ctx.lineTo(Math.cos(b) * 200, Math.sin(b) * 200);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'rooftop': {
        const g = ctx.createLinearGradient(0, top, 0, CANVAS_HEIGHT);
        g.addColorStop(0, '#3a3140');
        g.addColorStop(1, '#1a141f');
        ctx.fillStyle = g;
        ctx.fillRect(0, top, CANVAS_WIDTH, H);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        for (let x = -120; x < CANVAS_WIDTH + 120; x += 120) {
          ctx.beginPath();
          ctx.moveTo(persp(x, top), top);
          ctx.lineTo(persp(x, CANVAS_HEIGHT), CANVAS_HEIGHT);
          ctx.stroke();
        }
        for (const [px, py, pw] of [
          [140, 470, 70],
          [640, 400, 90],
          [820, 500, 50],
        ]) {
          const pg = ctx.createLinearGradient(0, py - 8, 0, py + 8);
          pg.addColorStop(0, 'rgba(255,61,187,0.25)');
          pg.addColorStop(1, 'rgba(57,243,255,0.2)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.ellipse(px, py, pw, 9, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#4c4256';
        ctx.fillRect(0, top - 4, CANVAS_WIDTH, 6);
        break;
      }
    }
  }

  drawVignette(): void {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.45, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // ============================================================== debug overlay

  drawDebug(fighters: Fighter[], projectiles: Projectile[], camX: number, camY: number, info: string[]): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.debugZ;
    ctx.setLineDash([6, 4]);
    for (const z of [STAGE_MIN_Z, STAGE_MAX_Z]) {
      ctx.beginPath();
      ctx.moveTo(0, z - camY);
      ctx.lineTo(CANVAS_WIDTH, z - camY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(60,140,255,0.18)';
    for (let z = STAGE_MIN_Z; z <= STAGE_MAX_Z; z += 16) {
      ctx.beginPath();
      ctx.moveTo(0, z - camY);
      ctx.lineTo(CANVAS_WIDTH, z - camY);
      ctx.stroke();
    }

    ctx.font = font(FONT_MONO, 10);
    ctx.textAlign = 'center';
    for (const f of fighters) {
      const sx = f.x - camX;
      const hb = f.getHurtbox();
      ctx.fillStyle = 'rgba(60,140,255,0.16)';
      ctx.fillRect(sx - 36, f.z - hb.zDepth - camY, 72, hb.zDepth * 2);
      ctx.strokeStyle = COLORS.debugZ;
      ctx.beginPath();
      ctx.moveTo(sx - 40, f.z - camY);
      ctx.lineTo(sx + 40, f.z - camY);
      ctx.stroke();

      if (f.isTargetable()) {
        const b = hurtboxWorld(f, hb);
        ctx.strokeStyle = f.isHittable() ? COLORS.debugHurt : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x - b.w / 2 - camX, f.z - (b.y + b.h / 2) - camY, b.w, b.h);
      }
      const windows = f.activeWindows();
      if (windows) {
        for (const w of windows) {
          for (const box of w.boxes) {
            const b = hitboxWorld(f, box);
            ctx.fillStyle = 'rgba(255,40,40,0.22)';
            ctx.strokeStyle = COLORS.debugHit;
            ctx.lineWidth = 2;
            const rx = b.x - b.w / 2 - camX;
            const ry = f.z - (b.y + b.h / 2) - camY;
            ctx.fillRect(rx, ry, b.w, b.h);
            ctx.strokeRect(rx, ry, b.w, b.h);
            ctx.strokeStyle = COLORS.debugZ;
            ctx.lineWidth = 1;
            ctx.strokeRect(b.x - b.w / 2 - camX, f.z - box.zRange - camY, b.w, box.zRange * 2);
          }
        }
      }
      ctx.fillStyle = '#fff';
      const label = `${f.state}${f.move ? ':' + f.move.id + '@' + f.moveFrame : ''}`;
      ctx.fillText(label, sx, f.z - f.y - 112 * f.scale - camY);
      ctx.fillStyle = '#9fe8ff';
      ctx.fillText(`hp ${f.hp.toFixed(0)} z ${f.z.toFixed(0)} y ${f.y.toFixed(0)}`, sx, f.z - f.y - 100 * f.scale - camY);
    }
    for (const p of projectiles) {
      const b = hitboxWorld(p, p.hitbox);
      ctx.strokeStyle = COLORS.debugHit;
      ctx.strokeRect(b.x - b.w / 2 - camX, p.z - (b.y + b.h / 2) - camY, b.w, b.h);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(CANVAS_WIDTH - 214, CANVAS_HEIGHT - 16 - info.length * 13, 206, info.length * 13 + 8);
    ctx.fillStyle = '#7dff9b';
    info.forEach((line, i) => ctx.fillText(line, CANVAS_WIDTH - 206, CANVAS_HEIGHT - 12 - (info.length - 1 - i) * 13));
    ctx.restore();
  }
}
