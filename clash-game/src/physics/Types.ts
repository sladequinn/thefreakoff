import type { AudioEngine } from '../core/AudioEngine';
import type { Camera } from '../core/Camera';
import type { Fighter } from '../entities/Fighter';
import type { Projectile } from '../entities/Entity';
import type { ParticleSystem } from '../entities/Particle';

export type Team = 0 | 1;

export enum FState {
  IDLE = 'IDLE',
  WALK = 'WALK',
  RUN = 'RUN',
  PREJUMP = 'PREJUMP',
  JUMP = 'JUMP',
  LAND = 'LAND',
  ATTACK = 'ATTACK',
  BLOCK = 'BLOCK',
  HURT = 'HURT',
  JUGGLE = 'JUGGLE',
  KNOCKDOWN = 'KNOCKDOWN',
  WAKEUP = 'WAKEUP',
  SUBSTITUTE = 'SUBSTITUTE',
  DEAD = 'DEAD',
  INTRO = 'INTRO',
  VICTORY = 'VICTORY',
}

/** `grab` is unblockable, whiffs on airborne or armoured targets, and holds the victim until the move's follow-up hit lands. */
export type HitEffect = 'none' | 'launch' | 'trip' | 'knockdown' | 'hardKnockdown' | 'groundBounce' | 'wallBounce' | 'grab';
export type SparkType = 'slash' | 'arcane' | 'void' | 'impact' | 'red' | 'shock' | 'blade';
export type HitSfx = 'light' | 'heavy' | 'slash' | 'magic';

export interface Hitbox {
  offsetX: number;
  /** Altitude of the box centre above the attacker's feet. */
  offsetY: number;
  width: number;
  height: number;
  zRange: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  hitstun: number;
  hitstop: number;
  effect?: HitEffect;
  spark?: SparkType;
  sfx?: HitSfx;
  /** Knockback points away from the attacker's centre instead of along its facing. */
  radial?: boolean;
}

export interface Hurtbox {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  zDepth: number;
}

export interface HitWindow {
  start: number;
  end: number;
  /** Each group can connect with a given target once per move instance. */
  group: number;
  boxes: Hitbox[];
}

export interface MotionKey {
  from: number;
  to: number;
  vx?: number;
  vy?: number;
  vz?: number;
  noGravity?: boolean;
}

export interface MoveEvent {
  frame: number;
  fx: string;
}

export type MoveKind = 'combo' | 'dash' | 'air' | 'special' | 'enemy';

export interface MoveData {
  id: string;
  name: string;
  kind: MoveKind;
  pose: string;
  duration: number;
  hits: HitWindow[];
  cancelFrom?: number;
  motion?: MotionKey[];
  invuln?: [number, number];
  hidden?: [number, number];
  teleport?: { frame: number; dx: number };
  armor?: number;
  hpCost?: number;
  airborne?: boolean;
  endsOnLand?: boolean;
  landingLag?: number;
  events?: MoveEvent[];
  onHitBounce?: { vx: number; vy: number };
  friction?: number;
  tokenRequired?: boolean;
  /** Where a grabbed victim is held, relative to the attacker, between `from` and `to`; `lift` is the peak altitude. */
  grab?: { from: number; to: number; x: number; lift: number };
}

export interface CharacterStats {
  speed: number;
  maxHp: number;
  defense: number;
  jumpPower: number;
}

export type CharId = 'slade' | 'freckles' | 'whitelie' | 'fiddlejay';
/** Only the two protagonists have story campaigns; the rest of the roster is VS-only. */
/** Every fighter now has a campaign; the alias is kept for the save file and scene params. */
export type StoryCharId = CharId;
export type Archetype = 'ninja' | 'brawler' | 'kingpin' | 'fiddler' | 'ninjabot' | 'clownbot';
export type Variant = 'normal' | 'alt' | 'elite' | 'heavy' | 'boss';
export type VoiceId = 'slade' | 'freckles' | 'whitelie' | 'fiddlejay' | 'ninjabot' | 'clownbot';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  archetype: Archetype;
  voice: VoiceId;
  stats: CharacterStats;
  combo: string[];
  dashAttack?: string;
  airAttack?: string;
  special?: string;
  /** Hold away from the opponent + attack while grounded. */
  backAttack?: string;
  /** Hold toward the opponent + special while grounded; costs no HP. */
  commandGrab?: string;
  moves: Record<string, MoveData>;
  hurtbox: Hurtbox;
  scale: number;
  blurb?: string;
  moveList?: { name: string; input: string; desc: string }[];
  ratings?: { power: number; speed: number; range: number; defense: number };
  /** Lines shown on the versus results screen when this character wins. */
  winQuotes?: string[];
  /** Opponent-specific victory lines, keyed by the loser's CharId. */
  winQuotesVs?: Partial<Record<CharId, string[]>>;
}

export interface InputFrame {
  moveX: number;
  moveZ: number;
  run: boolean;
  jump: boolean;
  jumpPressed: boolean;
  attackPressed: boolean;
  specialPressed: boolean;
  /** Tag-team only: ask the scene to swap in the partner. */
  tagPressed: boolean;
  dashDir: number;
  /** AI-only: request a specific move by id when actionable. */
  moveRequest?: string;
}

export function emptyInput(): InputFrame {
  return {
    moveX: 0,
    moveZ: 0,
    run: false,
    jump: false,
    jumpPressed: false,
    attackPressed: false,
    specialPressed: false,
    tagPressed: false,
    dashDir: 0,
  };
}

export type HitResponse = 'substitute' | void;

export interface Controller {
  getInput(self: Fighter, world: World): InputFrame;
  onHit?(self: Fighter, attacker: Fighter, hb: Hitbox, world: World): HitResponse;
  onWakeup?(self: Fighter, world: World): void;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type GameMode = 'story' | 'versus' | 'training' | 'arcade' | 'tag';

export interface World {
  frame: number;
  mode: GameMode;
  fighters: Fighter[];
  particles: ParticleSystem;
  audio: AudioEngine;
  camera: Camera;
  boundsFor(f: Fighter): Bounds;
  spawnProjectile(p: Projectile): void;
  requestToken(f: Fighter): boolean;
  releaseToken(f: Fighter): void;
  onHitLanded?(attacker: Fighter, target: Fighter, damage: number): void;
  onFighterKO?(f: Fighter, by: Fighter | null): void;
}
