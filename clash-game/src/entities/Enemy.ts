import { COLORS, DEFAULT_Z_RANGE, TEAM_ENEMY } from '../config/constants';
import { FrecklebotAI } from '../ai/FrecklebotAI';
import { NinjabotAI } from '../ai/NinjabotAI';
import { FState, type CharacterDef, type MoveData, type Variant, type World } from '../physics/Types';
import { Fighter } from './Fighter';

const Z = DEFAULT_Z_RANGE;

const ninjabotMoves: Record<string, MoveData> = {
  nb_slash1: {
    id: 'nb_slash1',
    name: 'Twin Edge I',
    kind: 'combo',
    pose: 'nb_slash1',
    duration: 22,
    cancelFrom: 10,
    tokenRequired: true,
    hits: [
      {
        start: 5,
        end: 7,
        group: 1,
        boxes: [{ offsetX: 32, offsetY: 54, width: 50, height: 28, zRange: Z, damage: 5, knockbackX: 1.5, knockbackY: 0, hitstun: 14, hitstop: 4, spark: 'blade', sfx: 'slash' }],
      },
    ],
    motion: [{ from: 2, to: 5, vx: 2 }],
    events: [{ frame: 4, fx: 'slash' }],
  },
  nb_slash2: {
    id: 'nb_slash2',
    name: 'Twin Edge II',
    kind: 'combo',
    pose: 'nb_slash2',
    duration: 28,
    tokenRequired: true,
    hits: [
      {
        start: 6,
        end: 8,
        group: 1,
        boxes: [{ offsetX: 32, offsetY: 50, width: 52, height: 32, zRange: Z, damage: 6, knockbackX: 4.5, knockbackY: 0, hitstun: 18, hitstop: 5, spark: 'blade', sfx: 'slash' }],
      },
    ],
    motion: [{ from: 3, to: 6, vx: 2.5 }],
    events: [{ frame: 5, fx: 'slash' }],
  },
  nb_flip: {
    id: 'nb_flip',
    name: 'Aerial Flip Kick',
    kind: 'enemy',
    pose: 'nb_flip',
    duration: 60,
    endsOnLand: true,
    landingLag: 12,
    tokenRequired: true,
    hits: [
      {
        start: 12,
        end: 60,
        group: 1,
        boxes: [
          { offsetX: 20, offsetY: 22, width: 46, height: 42, zRange: Z, damage: 7, knockbackX: 4, knockbackY: 3, hitstun: 30, hitstop: 5, effect: 'knockdown', spark: 'blade', sfx: 'heavy' },
        ],
      },
    ],
    motion: [{ from: 4, to: 4, vx: 4.6, vy: 7.6 }],
    events: [{ frame: 3, fx: 'flip' }],
  },
  nb_throw: {
    id: 'nb_throw',
    name: 'Homing Shuriken',
    kind: 'enemy',
    pose: 'nb_throw',
    duration: 28,
    hits: [],
    events: [{ frame: 10, fx: 'shuriken' }],
  },
};

const frecklebotMoves: Record<string, MoveData> = {
  fb_punch1: {
    id: 'fb_punch1',
    name: 'Piston Jab',
    kind: 'combo',
    pose: 'fb_punch1',
    duration: 26,
    cancelFrom: 13,
    tokenRequired: true,
    hits: [
      {
        start: 9,
        end: 11,
        group: 1,
        boxes: [{ offsetX: 38, offsetY: 54, width: 54, height: 34, zRange: Z, damage: 6, knockbackX: 1.5, knockbackY: 0, hitstun: 16, hitstop: 5, spark: 'impact', sfx: 'heavy' }],
      },
    ],
    motion: [{ from: 5, to: 9, vx: 1.8 }],
    events: [{ frame: 7, fx: 'whiff' }],
  },
  fb_punch2: {
    id: 'fb_punch2',
    name: 'Hydraulic Cross',
    kind: 'combo',
    pose: 'fb_punch2',
    duration: 32,
    tokenRequired: true,
    hits: [
      {
        start: 10,
        end: 12,
        group: 1,
        boxes: [{ offsetX: 38, offsetY: 52, width: 56, height: 36, zRange: Z, damage: 8, knockbackX: 5, knockbackY: 0, hitstun: 22, hitstop: 6, spark: 'shock', sfx: 'heavy' }],
      },
    ],
    motion: [{ from: 6, to: 10, vx: 2.5 }],
    events: [{ frame: 8, fx: 'whiff' }],
  },
  fb_tackle: {
    id: 'fb_tackle',
    name: 'Armored Rush',
    kind: 'enemy',
    pose: 'fb_tackle',
    duration: 52,
    armor: 1,
    tokenRequired: true,
    hits: [
      {
        start: 14,
        end: 40,
        group: 1,
        boxes: [
          { offsetX: 28, offsetY: 50, width: 48, height: 72, zRange: Z, damage: 9, knockbackX: 6, knockbackY: 4, hitstun: 30, hitstop: 6, effect: 'knockdown', spark: 'impact', sfx: 'heavy' },
        ],
      },
    ],
    motion: [
      { from: 0, to: 13, vx: 0 },
      { from: 14, to: 40, vx: 6 },
    ],
    events: [
      { frame: 0, fx: 'steam' },
      { frame: 14, fx: 'charge_start' },
      { frame: 20, fx: 'charge_dust' },
      { frame: 26, fx: 'charge_dust' },
      { frame: 32, fx: 'charge_dust' },
    ],
  },
  fb_pulse: {
    id: 'fb_pulse',
    name: 'Shock Pulse',
    kind: 'enemy',
    pose: 'fb_pulse',
    duration: 62,
    hits: [
      {
        start: 34,
        end: 38,
        group: 1,
        boxes: [
          {
            offsetX: 0,
            offsetY: 45,
            width: 180,
            height: 100,
            zRange: 40,
            damage: 10,
            knockbackX: 6,
            knockbackY: 4,
            hitstun: 30,
            hitstop: 5,
            effect: 'knockdown',
            spark: 'shock',
            sfx: 'heavy',
            radial: true,
          },
        ],
      },
    ],
    events: [
      { frame: 0, fx: 'pulse_warn' },
      { frame: 10, fx: 'pulse_arc' },
      { frame: 18, fx: 'pulse_arc' },
      { frame: 26, fx: 'pulse_arc' },
      { frame: 30, fx: 'pulse_arc' },
      { frame: 34, fx: 'pulse' },
    ],
  },
};

export const NINJABOT_DEF: CharacterDef = {
  id: 'ninjabot',
  name: 'NINJABOT',
  title: 'Cyber-Shinobi Unit',
  archetype: 'ninjabot',
  voice: 'ninjabot',
  stats: { speed: 3.3, maxHp: 38, defense: 1, jumpPower: 8 },
  combo: ['nb_slash1', 'nb_slash2'],
  moves: ninjabotMoves,
  hurtbox: { offsetX: 0, offsetY: 46, width: 30, height: 90, zDepth: 14 },
  scale: 1,
};

export const FRECKLEBOT_DEF: CharacterDef = {
  id: 'frecklebot',
  name: 'FRECKLEBOT',
  title: 'Industrial Boxing Automaton',
  archetype: 'frecklebot',
  voice: 'frecklebot',
  stats: { speed: 2.5, maxHp: 55, defense: 1.1, jumpPower: 6 },
  combo: ['fb_punch1', 'fb_punch2'],
  moves: frecklebotMoves,
  hurtbox: { offsetX: 0, offsetY: 46, width: 40, height: 92, zDepth: 14 },
  scale: 1,
};

export type EnemyKind = 'ninjabot' | 'frecklebot';

interface VariantTuning {
  label: string;
  hpMult: number;
  scale: number;
  speed: number;
  damage: number;
  score: number;
}

const TUNING: Record<EnemyKind, Partial<Record<Variant, VariantTuning>>> = {
  ninjabot: {
    normal: { label: 'NINJABOT', hpMult: 1, scale: 1, speed: 1, damage: 1, score: 400 },
    alt: { label: 'NINJABOT // STAR UNIT', hpMult: 0.85, scale: 0.96, speed: 1.05, damage: 1, score: 500 },
    elite: { label: 'ELITE NINJABOT', hpMult: 1.9, scale: 1.08, speed: 1.15, damage: 1.25, score: 1500 },
  },
  frecklebot: {
    normal: { label: 'FRECKLEBOT', hpMult: 1, scale: 1, speed: 1, damage: 1, score: 400 },
    heavy: { label: 'FRECKLEBOT // HEAVY', hpMult: 1.7, scale: 1.16, speed: 0.8, damage: 1.25, score: 700 },
    elite: { label: 'ELITE FRECKLEBOT', hpMult: 1.7, scale: 1.1, speed: 1.1, damage: 1.25, score: 1500 },
  },
};

export class Enemy extends Fighter {
  readonly kind: EnemyKind;
  entered = false;
  deathTimer = 0;
  readonly scoreValue: number;

  constructor(kind: EnemyKind, variant: Variant, x: number, z: number) {
    const def = kind === 'ninjabot' ? NINJABOT_DEF : FRECKLEBOT_DEF;
    const tune = TUNING[kind][variant] ?? TUNING[kind].normal!;
    const controller = kind === 'ninjabot' ? new NinjabotAI(variant) : new FrecklebotAI(variant);
    super(def, { team: TEAM_ENEMY, controller, variant, scale: tune.scale, hpMult: tune.hpMult, name: tune.label });
    this.kind = kind;
    this.x = x;
    this.z = z;
    this.facing = -1;
    this.speedMult = tune.speed;
    this.damageMult = tune.damage;
    this.scoreValue = tune.score;
  }

  update(world: World): void {
    super.update(world);
    const p = world.particles;
    if (this.state === FState.DEAD) {
      this.deathTimer++;
      if (this.deathTimer === 1) {
        world.audio.playExplode();
        p.hitSpark(this.kind === 'ninjabot' ? 'shock' : 'impact', this.x, 20, this.z + 1, this.facing, true);
        p.splatter(this.x, 16, this.z, 1, COLORS.oil, 6);
        p.splatter(this.x, 16, this.z, -1, COLORS.oil, 6);
        p.debris(this.x, this.z, 8, 0, this.kind === 'ninjabot' ? '#aeb8c4' : '#8a4b2a');
        p.smoke(this.x, 0, this.z, 8, 'rgba(30,30,34,1)');
      }
      if (this.deathTimer > 20 && this.deathTimer % 12 === 0) p.arc(this.x, 10, this.z + 1, 20, COLORS.cyan);
      this.deathFade = Math.max(0, (this.deathTimer - 40) / 30);
      if (this.deathTimer > 70) this.remove = true;
      return;
    }
    if (this.hidden) return;
    if (this.kind === 'ninjabot') {
      const moving = Math.abs(this.vx) + Math.abs(this.vz) > 1.2;
      if (moving && this.animTime % 3 === 0) {
        const color = this.variant === 'elite' ? '#ff4d6d' : this.variant === 'alt' ? '#7dff9b' : COLORS.cyan;
        p.spawn('ember', this.x - this.facing * 10, this.y + 40 + Math.random() * 30, this.z - 1, -this.vx * 0.2, 0.2, 0, 18, 2.2, color);
      }
    } else {
      const low = this.hp < this.maxHp * 0.35;
      if (Math.random() < (low ? 0.12 : 0.025)) {
        p.arc(this.x + (Math.random() - 0.5) * 30 * this.scale, this.y + (60 + Math.random() * 30) * this.scale, this.z + 1, 14 + Math.random() * 14, low ? COLORS.hazard : COLORS.cyan);
      }
      if (low && this.animTime % 20 === 0) p.smoke(this.x, this.y + 70 * this.scale, this.z, 1, 'rgba(60,60,60,1)');
    }
  }
}
