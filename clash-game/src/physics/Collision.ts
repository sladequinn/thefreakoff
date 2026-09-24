import type { Fighter } from '../entities/Fighter';
import type { Hitbox, Hurtbox, World } from './Types';

/** Axis-aligned box in world space: x = stage x centre, y = altitude centre. */
export interface WorldBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Positioned {
  x: number;
  y: number;
  z: number;
  facing: number;
  scale: number;
}

export function hitboxWorld(attacker: Positioned, hb: Hitbox): WorldBox {
  const s = attacker.scale;
  return {
    x: attacker.x + hb.offsetX * s * attacker.facing,
    y: attacker.y + hb.offsetY * s,
    w: hb.width * s,
    h: hb.height * s,
  };
}

export function hurtboxWorld(target: Positioned, hurt: Hurtbox): WorldBox {
  const s = target.scale;
  return {
    x: target.x + hurt.offsetX * s * target.facing,
    y: target.y + hurt.offsetY * s,
    w: hurt.width * s,
    h: hurt.height * s,
  };
}

export function boxesOverlap(a: WorldBox, b: WorldBox): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

/** The three-axis hit test: X overlap, altitude overlap, and depth tolerance. */
export function checkHit(attacker: Positioned, hb: Hitbox, target: Positioned, hurt: Hurtbox): boolean {
  if (Math.abs(attacker.z - target.z) > hb.zRange) return false;
  return boxesOverlap(hitboxWorld(attacker, hb), hurtboxWorld(target, hurt));
}

export function dist2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function nearestOpponent(self: Fighter, world: World): Fighter | null {
  let best: Fighter | null = null;
  let bestD = Infinity;
  for (const f of world.fighters) {
    if (f === self || f.team === self.team || !f.isTargetable()) continue;
    const d = Math.abs(f.x - self.x) + Math.abs(f.z - self.z) * 1.5;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** Soft push-apart for bodies standing on overlapping lanes so crowds don't stack into one sprite. */
export function separateBodies(fighters: Fighter[]): void {
  for (let i = 0; i < fighters.length; i++) {
    const a = fighters[i];
    if (!a.isSolid()) continue;
    for (let j = i + 1; j < fighters.length; j++) {
      const b = fighters[j];
      if (!b.isSolid()) continue;
      const dz = Math.abs(a.z - b.z);
      if (dz > 10) continue;
      const minDx = ((a.def.hurtbox.width * a.scale + b.def.hurtbox.width * b.scale) / 2) * 0.8;
      const dx = b.x - a.x;
      const adx = Math.abs(dx);
      if (adx >= minDx) continue;
      const push = (minDx - adx) * 0.25;
      const dir = dx === 0 ? (a.id < b.id ? 1 : -1) : Math.sign(dx);
      a.x -= push * dir;
      b.x += push * dir;
    }
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
