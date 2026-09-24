import { COLORS, FONT_DISPLAY, PARTICLE_POOL_SIZE, font } from '../config/constants';
import type { SparkType } from '../physics/Types';
import { Entity, type RenderView } from './Entity';

export type ParticleKind =
  | 'spark'
  | 'flash'
  | 'ring'
  | 'sigil'
  | 'pillar'
  | 'smoke'
  | 'dust'
  | 'debris'
  | 'drop'
  | 'splat'
  | 'glyph'
  | 'arc'
  | 'ember'
  | 'petal'
  | 'kinetic'
  | 'text';

const FLAT_KINDS = new Set<ParticleKind>(['ring', 'sigil', 'splat']);
const GLOW_KINDS = new Set<ParticleKind>(['spark', 'flash', 'pillar', 'glyph', 'arc', 'ember', 'kinetic']);

export class Particle extends Entity {
  kind: ParticleKind = 'spark';
  life = 0;
  maxLife = 1;
  size = 1;
  size2 = 1;
  color = '#fff';
  color2 = '#fff';
  rot = 0;
  vrot = 0;
  gravity = 0;
  drag = 1;
  text = '';
  seed = 0;
  active = false;

  get sortZ(): number {
    return FLAT_KINDS.has(this.kind) ? this.z - 10000 : this.z + 0.5;
  }

  get t(): number {
    return 1 - this.life / this.maxLife;
  }

  update(): void {
    this.life--;
    if (this.life <= 0) {
      this.active = false;
      return;
    }
    this.vx *= this.drag;
    this.vz *= this.drag;
    if (this.kind !== 'flash' && this.kind !== 'ring' && this.kind !== 'sigil') this.vy *= this.drag;
    this.vy -= this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    this.rot += this.vrot;
    if (this.kind === 'debris' && this.y < 0) {
      this.y = 0;
      this.vy = -this.vy * 0.35;
      this.vx *= 0.6;
      this.vrot *= 0.6;
    }
    if (this.kind === 'drop' && this.y <= 0) {
      this.kind = 'splat';
      this.y = 0;
      this.vx = this.vy = this.vz = 0;
      this.gravity = 0;
      this.life = this.maxLife = 50;
      this.size *= 1.8;
    }
  }

  draw(ctx: CanvasRenderingContext2D, view: RenderView): void {
    const sx = this.x - view.camX;
    const sy = this.z - this.y - view.camY;
    const gy = this.z - view.camY;
    const k = this.life / this.maxLife;
    const t = 1 - k;
    if (sx < -200 || sx > 1160) return;
    const glow = GLOW_KINDS.has(this.kind);
    if (glow) ctx.globalCompositeOperation = 'lighter';

    switch (this.kind) {
      case 'spark': {
        const len = this.size * 2.2;
        const dx = this.vx;
        const dy = this.vz - this.vy;
        const m = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.lineWidth = Math.max(0.6, this.size * 0.45 * k);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - (dx / m) * len * (0.5 + m * 0.25), sy - (dy / m) * len * (0.5 + m * 0.25));
        ctx.stroke();
        break;
      }
      case 'flash': {
        const rad = this.size + (this.size2 - this.size) * t;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, this.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = k;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ring': {
        const rad = this.size + (this.size2 - this.size) * (1 - Math.pow(k, 2));
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k * 0.9;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2 + 6 * k;
        ctx.beginPath();
        ctx.ellipse(sx, gy, rad, rad * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'sigil':
        view.sprites.drawSigil(ctx, sx, gy, this.size, this.rot, k, t, this.color);
        break;
      case 'pillar': {
        const h = this.size2 * Math.min(1, t * 4);
        const w = this.size * k;
        const g = ctx.createLinearGradient(0, gy - h, 0, gy);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.4, this.color);
        g.addColorStop(1, '#ffffff');
        ctx.globalAlpha = k;
        ctx.fillStyle = g;
        ctx.fillRect(sx - w / 2, gy - h, w, h);
        break;
      }
      case 'smoke':
      case 'dust': {
        const rad = this.size + (this.size2 - this.size) * t;
        ctx.globalAlpha = k * (this.kind === 'smoke' ? 0.75 : 0.55);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'debris': {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.rot);
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.fillStyle = this.color;
        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.6);
        ctx.lineTo(s * 0.7, -s);
        ctx.lineTo(s, s * 0.5);
        ctx.lineTo(-s * 0.4, s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(-s * 0.5, -s * 0.5, s * 0.6, s * 0.4);
        ctx.restore();
        break;
      }
      case 'drop': {
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(sx, sy, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'splat': {
        ctx.globalAlpha = k * 0.7;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(sx, gy, this.size, this.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'glyph': {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.rot);
        ctx.globalAlpha = k;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        const s = this.size;
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.beginPath();
        ctx.moveTo(-s, 0);
        ctx.lineTo(s, 0);
        ctx.moveTo(0, -s * 1.4);
        ctx.lineTo(0, s * 1.4);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'arc': {
        ctx.globalAlpha = k;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        let px = sx;
        let py = sy;
        const segs = 5;
        const ang = this.rot;
        for (let i = 1; i <= segs; i++) {
          const d = (this.size / segs) * i;
          px = sx + Math.cos(ang) * d + (Math.random() - 0.5) * 8;
          py = sy + Math.sin(ang) * d + (Math.random() - 0.5) * 8;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        break;
      }
      case 'ember': {
        ctx.globalAlpha = k;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(sx, sy, this.size * (0.5 + k * 0.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'petal': {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.rot);
        ctx.globalAlpha = Math.min(1, k * 2) * 0.85;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.45 * Math.abs(Math.sin(this.rot * 2)) + 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'kinetic': {
        const rad = this.size + (this.size2 - this.size) * (1 - k * k);
        ctx.globalAlpha = k;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 6 * k + 1;
        const dir = this.rot;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rad * 0.45, rad, 0, dir > 0 ? -1.2 : Math.PI - 1.2, dir > 0 ? 1.2 : Math.PI + 1.2);
        ctx.stroke();
        ctx.strokeStyle = '#fff3c4';
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.font = font(FONT_DISPLAY, this.size);
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.strokeText(this.text, sx, sy);
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, sx, sy);
        break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export interface SpawnOpts {
  size2?: number;
  color2?: string;
  gravity?: number;
  drag?: number;
  rot?: number;
  vrot?: number;
  text?: string;
}

/** Fixed-size particle pool; no allocations after boot. */
export class ParticleSystem {
  private pool: Particle[] = [];
  private free: Particle[] = [];
  readonly active: Particle[] = [];

  constructor(size = PARTICLE_POOL_SIZE) {
    for (let i = 0; i < size; i++) {
      const p = new Particle();
      this.pool.push(p);
      this.free.push(p);
    }
  }

  get count(): number {
    return this.active.length;
  }

  clear(): void {
    for (const p of this.active) {
      p.active = false;
      this.free.push(p);
    }
    this.active.length = 0;
  }

  spawn(
    kind: ParticleKind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    color: string,
    opts?: SpawnOpts,
  ): Particle | null {
    const p = this.free.pop();
    if (!p) return null;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = p.maxLife = Math.max(1, Math.round(life));
    p.size = size;
    p.size2 = opts?.size2 ?? size;
    p.color = color;
    p.color2 = opts?.color2 ?? color;
    p.gravity = opts?.gravity ?? 0;
    p.drag = opts?.drag ?? 1;
    p.rot = opts?.rot ?? 0;
    p.vrot = opts?.vrot ?? 0;
    p.text = opts?.text ?? '';
    p.seed = Math.random();
    p.active = true;
    this.active.push(p);
    return p;
  }

  update(): void {
    const list = this.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.update();
      if (!p.active) {
        list[i] = list[list.length - 1];
        list.pop();
        this.free.push(p);
      }
    }
  }

  // ------------------------------------------------------------ emitters

  burst(x: number, y: number, z: number, dir: number, color: string, count: number, speed: number, spread = Math.PI): void {
    for (let i = 0; i < count; i++) {
      const a = (dir >= 0 ? 0 : Math.PI) + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn('spark', x, y, z, Math.cos(a) * s, Math.sin(-a) * s * 0.9 + Math.random() * 1.5, 0, 10 + Math.random() * 10, 3 + Math.random() * 3, color, {
        drag: 0.86,
        gravity: 0.12,
      });
    }
  }

  hitSpark(type: SparkType, x: number, y: number, z: number, dir: number, heavy: boolean): void {
    const n = heavy ? 18 : 10;
    switch (type) {
      case 'slash':
      case 'blade':
        this.spawn('flash', x, y, z, 0, 0, 0, 8, 6, '#b48cff', { size2: heavy ? 44 : 30 });
        this.burst(x, y, z, dir, '#e7d9ff', n, 7, 1.4);
        this.burst(x, y, z, dir, COLORS.void, n / 2, 5, 2.2);
        break;
      case 'arcane':
        this.spawn('flash', x, y, z, 0, 0, 0, 10, 8, COLORS.void, { size2: 40 });
        this.burst(x, y, z, dir, COLORS.voidGlow, n, 5, 2.6);
        this.glyphs(x, y, z, 6);
        break;
      case 'void':
        this.spawn('flash', x, y, z, 0, 0, 0, 14, 10, '#6a1dff', { size2: 64 });
        this.burst(x, y, z, dir, '#c79bff', n + 6, 8, 2);
        this.glyphs(x, y, z, 8);
        this.spawn('kinetic', x, y, z, dir * 0.5, 0, 0, 16, 10, '#9d5cff', { size2: 48, rot: dir });
        break;
      case 'red':
        this.spawn('flash', x, y, z, 0, 0, 0, 12, 10, '#ff5a1f', { size2: 70 });
        this.burst(x, y, z, dir, '#ffb13b', n + 8, 9, 1.8);
        this.burst(x, y, z, dir, '#ff3b1f', n, 6, 2.8);
        this.spawn('kinetic', x, y, z, dir * 1.2, 0, 0, 18, 12, '#ff6a2a', { size2: 60, rot: dir });
        this.spawn('kinetic', x, y, z, dir * 0.6, 0, 0, 22, 8, '#ffc857', { size2: 44, rot: dir });
        break;
      case 'shock':
        this.spawn('flash', x, y, z, 0, 0, 0, 10, 8, COLORS.cyan, { size2: 44 });
        for (let i = 0; i < 5; i++) this.arc(x, y, z, 24 + Math.random() * 20, COLORS.cyan);
        this.burst(x, y, z, dir, '#bff9ff', n, 6, 3);
        break;
      case 'impact':
      default:
        this.spawn('flash', x, y, z, 0, 0, 0, 8, 6, '#ffe7a8', { size2: heavy ? 50 : 32 });
        this.burst(x, y, z, dir, '#fff2c0', n, 6.5, 1.6);
        this.burst(x, y, z, dir, '#ffb13b', n / 2, 4.5, 2.4);
        break;
    }
  }

  dust(x: number, z: number, count: number, dir = 0, color = 'rgba(190,170,150,1)'): void {
    for (let i = 0; i < count; i++) {
      const vx = dir !== 0 ? -dir * (0.5 + Math.random() * 2) : (Math.random() - 0.5) * 3;
      this.spawn('dust', x + (Math.random() - 0.5) * 16, 2 + Math.random() * 4, z + (Math.random() - 0.5) * 4, vx, 0.3 + Math.random() * 0.8, 0, 20 + Math.random() * 16, 3 + Math.random() * 3, color, {
        size2: 10 + Math.random() * 8,
        drag: 0.92,
      });
    }
  }

  smoke(x: number, y: number, z: number, count: number, color = 'rgba(40,24,64,1)'): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 2.2;
      this.spawn('smoke', x + Math.cos(a) * 8, y + Math.random() * 60, z + (Math.random() - 0.5) * 6, Math.cos(a) * s, Math.sin(a) * s * 0.6 + 0.4, 0, 26 + Math.random() * 18, 6 + Math.random() * 6, color, {
        size2: 20 + Math.random() * 14,
        drag: 0.9,
      });
    }
  }

  sigil(x: number, z: number, radius: number, color = COLORS.void, life = 46): void {
    this.spawn('sigil', x, 0, z, 0, 0, 0, life, radius, color, { vrot: 0.08 });
    this.spawn('pillar', x, 0, z + 1, 0, 0, 0, life * 0.7, radius * 0.9, color, { size2: 220 });
  }

  ring(x: number, z: number, r0: number, r1: number, color: string, life = 20): void {
    this.spawn('ring', x, 0, z, 0, 0, 0, life, r0, color, { size2: r1 });
  }

  debris(x: number, z: number, count: number, dirBias = 0, color = '#8d8a84'): void {
    for (let i = 0; i < count; i++) {
      const dir = dirBias !== 0 ? dirBias : Math.random() < 0.5 ? -1 : 1;
      const shade = 110 + Math.floor(Math.random() * 60);
      const c = Math.random() < 0.3 ? color : `rgb(${shade},${shade - 6},${shade - 14})`;
      this.spawn('debris', x + (Math.random() - 0.5) * 20, 2, z + (Math.random() - 0.5) * 10, dir * (1.5 + Math.random() * 6), 4 + Math.random() * 7, (Math.random() - 0.5) * 1.2, 50 + Math.random() * 30, 2.5 + Math.random() * 4.5, c, {
        gravity: 0.38,
        rot: Math.random() * 6,
        vrot: (Math.random() - 0.5) * 0.5,
      });
    }
  }

  splatter(x: number, y: number, z: number, dir: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawn('drop', x, y, z + (Math.random() - 0.5) * 6, dir * (1 + Math.random() * 4), 1 + Math.random() * 4, (Math.random() - 0.5) * 0.6, 40, 1.4 + Math.random() * 1.8, color, {
        gravity: 0.3,
      });
    }
  }

  glyphs(x: number, y: number, z: number, count: number, color = COLORS.voidGlow): void {
    for (let i = 0; i < count; i++) {
      this.spawn('glyph', x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, z, (Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.6, 0, 24 + Math.random() * 16, 2.5 + Math.random() * 2.5, color, {
        drag: 0.95,
        vrot: (Math.random() - 0.5) * 0.2,
        rot: Math.random() * 3,
      });
    }
  }

  arc(x: number, y: number, z: number, len: number, color: string): void {
    this.spawn('arc', x, y, z, 0, 0, 0, 4 + Math.random() * 4, len, color, { rot: Math.random() * Math.PI * 2 });
  }

  kinetic(x: number, y: number, z: number, dir: number, color: string, size = 50): void {
    this.spawn('kinetic', x, y, z, dir * 1.4, 0, 0, 18, 10, color, { size2: size, rot: dir });
  }

  text(x: number, y: number, z: number, str: string, color: string, size = 16): void {
    this.spawn('text', x, y, z + 2, 0, 1.2, 0, 40, size, color, { text: str, drag: 0.93 });
  }
}
