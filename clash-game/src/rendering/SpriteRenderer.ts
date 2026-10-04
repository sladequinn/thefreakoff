import { WAKEUP_FRAMES } from '../config/constants';
import { FState, type Archetype, type Variant } from '../physics/Types';
import type { RenderView } from '../entities/Entity';
import type { Fighter } from '../entities/Fighter';
import { pixelize } from './Pixelize';

// ============================================================================ pose model

/** Angles in radians measured from straight down; positive rotates toward the facing direction. */
export interface Pose {
  lean: number;
  head: number;
  sL: number;
  eL: number;
  sR: number;
  eR: number;
  hL: number;
  kL: number;
  hR: number;
  kR: number;
  rot: number;
  weapon: number;
  spin: number;
  lying: boolean;
}

const P = (
  lean: number,
  head: number,
  sL: number,
  eL: number,
  sR: number,
  eR: number,
  hL: number,
  kL: number,
  hR: number,
  kR: number,
  rot = 0,
  weapon = 0,
): Pose => ({ lean, head, sL, eL, sR, eR, hL, kL, hR, kR, rot, weapon, spin: 0, lying: false });

const NUM_KEYS: (keyof Pose)[] = ['lean', 'head', 'sL', 'eL', 'sR', 'eR', 'hL', 'kL', 'hR', 'kR', 'rot', 'weapon', 'spin'];

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a };
  for (const k of NUM_KEYS) (out[k] as number) = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
  out.lying = t < 0.5 ? a.lying : b.lying;
  return out;
}

type Keys = [number, Pose][];

function sample(keys: Keys, f: number): Pose {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, p1] = keys[i];
    if (f <= f1) {
      const [f0, p0] = keys[i - 1];
      const t = (f - f0) / Math.max(1, f1 - f0);
      const e = t * t * (3 - 2 * t);
      return lerpPose(p0, p1, e);
    }
  }
  return keys[keys.length - 1][1];
}

const IDLE: Record<Archetype, Pose> = {
  ninja: P(0.18, -0.1, -0.5, 1.4, 1.0, 0.7, -0.35, -0.12, 0.45, -0.5, 0, 0.7),
  brawler: P(0.12, 0.04, -0.6, 0.5, 0.3, 0.9, -0.4, -0.15, 0.4, -0.4),
  // White Lie plants wide, mic fist folded up to the beard, far hand gesturing forward at belly height.
  kingpin: P(0.05, 0.05, 0.5, 1.0, 0.2, 2.2, -0.38, -0.1, 0.38, -0.3, 0, 0.94),
  // Fiddle Jay holds the fiddle up at the chin with the far arm and rests the bow across the strings.
  fiddler: P(0.15, -0.05, 1.45, 0.75, 0.75, 1.97, -0.4, -0.12, 0.45, -0.5, 0, 0.18),
  // Batman (no relation): tall boxer's guard, both gauntlets up at chin height, cape hanging behind.
  bat: P(0.08, 0.02, 0.5, 2.0, 0.8, 1.9, -0.3, -0.1, 0.35, -0.35),
  // Righteous: planted, crozier planted like a staff in the near fist, far hand blessing.
  bishop: P(0.04, 0.04, 0.6, 1.4, 0.35, 1.15, -0.32, -0.08, 0.32, -0.25, 0, -1.55),
  ninjabot: P(0.15, 0, -0.2, 1.1, 0.8, 0.9, -0.3, -0.1, 0.35, -0.4, 0, 0.9),
  clownbot: P(0.08, 0, 0.3, 1.5, 0.5, 1.4, -0.25, -0.1, 0.25, -0.2),
};

const withLegs = (p: Pose, hL: number, kL: number, hR: number, kR: number): Pose => ({ ...p, hL, kL, hR, kR });
const crouchOf = (a: Archetype): Pose => ({ ...withLegs(IDLE[a], 0.7, -1.5, 1.0, -1.5), lean: IDLE[a].lean + 0.25 });

const LYING: Pose = { ...P(0, 0.2, -0.3, 0.3, 0.3, 0.2, 0.05, 0, 0.15, -0.1, -Math.PI / 2), lying: true };
const HURT_POSE = P(-0.35, -0.4, -1.2, 0.8, -0.9, 0.6, -0.2, -0.2, 0.35, -0.3, 0, 0.7);
const SAD_INTRO = P(0.3, 0.62, 0.05, 0.15, 0.1, 0.25, -0.3, -0.08, 0.3, -0.12);
const GUARD: Record<Archetype, Pose> = {
  ninja: P(-0.05, 0.1, 1.2, 1.8, 1.0, 1.6, -0.4, -0.2, 0.4, -0.4, 0, 1.4),
  brawler: P(0.1, 0.2, 1.0, 2.3, 1.2, 2.2, -0.45, -0.2, 0.4, -0.4),
  kingpin: P(0.05, 0.1, 1.0, 2.0, 1.1, 2.0, -0.38, -0.1, 0.38, -0.3, 0, 0.6),
  fiddler: P(-0.05, 0.1, 1.2, 1.8, 1.0, 1.6, -0.4, -0.2, 0.4, -0.4, 0, -1.0),
  bat: P(0.0, 0.1, 1.2, 1.8, 1.0, 1.7, -0.35, -0.2, 0.4, -0.4),
  bishop: P(0.02, 0.08, 1.1, 1.8, 0.9, 1.7, -0.32, -0.08, 0.32, -0.25, 0, -1.4),
  ninjabot: P(-0.05, 0.1, 1.2, 1.6, 1.0, 1.6, -0.4, -0.2, 0.4, -0.4, 0, 1.4),
  clownbot: P(0.05, 0.1, 1.0, 2.0, 1.2, 1.9, -0.3, -0.1, 0.3, -0.2),
};
const VICTORY: Record<Archetype, Pose> = {
  ninja: P(-0.05, -0.15, -0.4, 1.2, 3.0, 0, -0.3, -0.05, 0.3, -0.05, 0, 0),
  // Freckles doesn't celebrate: head hung, far arm limp, near hand wiping a tear.
  brawler: P(0.1, 0.32, 0.2, 0.3, 2.25, 2.45, -0.3, -0.05, 0.3, -0.05),
  // Mic thrust to the sky, far arm spread wide.
  kingpin: P(-0.05, -0.1, -0.6, 0.3, 2.6, 0.3, -0.3, -0.05, 0.3, -0.05, 0, 0.3),
  fiddler: P(0.05, -0.25, 1.45, 0.75, 0.75, 1.97, -0.3, -0.05, 0.3, -0.05, 0, 0.18),
  // Brooding: chin down, near arm pulling the cape across the chest.
  bat: P(0.05, 0.18, 0.3, 0.3, 1.2, 2.6, -0.25, -0.05, 0.25, -0.05),
  // Crozier raised, far hand blessing the crowd.
  bishop: P(-0.05, -0.12, -0.4, 0.4, 2.7, 0.2, -0.25, -0.05, 0.25, -0.05, 0, 0.15),
  ninjabot: IDLE.ninjabot,
  clownbot: IDLE.clownbot,
};

const NI = IDLE.ninja;
const BI = IDLE.brawler;
const NB = IDLE.ninjabot;
const FB = IDLE.clownbot;
const KI = IDLE.kingpin;
const JI = IDLE.fiddler;
const BA = IDLE.bat;
const RI = IDLE.bishop;

const MOVE_KEYS: Record<string, Keys> = {
  slade_slash: [
    [0, NI],
    [2, P(0.05, -0.1, -0.6, 1.2, 2.6, 0.9, -0.4, -0.1, 0.5, -0.5, 0, 0.6)],
    [4, P(0.4, 0.1, -0.9, 0.9, 1.65, 0.0, -0.6, -0.1, 0.75, -0.3, 0, 0.05)],
    [9, P(0.35, 0.1, -0.8, 1.0, 1.1, 0.2, -0.6, -0.1, 0.75, -0.3, 0, -0.5)],
    [18, NI],
  ],
  slade_palm: [
    [0, NI],
    [3, P(0.1, 0, 0.4, 1.8, -0.5, 1.2, -0.4, -0.1, 0.5, -0.5, 0, 1.2)],
    [5, P(0.45, 0.1, 1.6, -0.05, -0.8, 1.0, -0.7, -0.05, 0.85, -0.3, 0, 1.4)],
    [12, P(0.4, 0.1, 1.55, 0, -0.8, 1.0, -0.7, -0.05, 0.85, -0.3, 0, 1.4)],
    [20, NI],
  ],
  slade_crescent: [
    [0, NI],
    [3, P(0.55, 0.2, -0.8, 1.0, 0.35, 0.1, 0.9, -1.6, 1.0, -1.4, 0, -0.2)],
    [6, P(-0.15, -0.2, -1.0, 0.8, 3.0, 0, -0.2, -0.2, 0.4, -0.2, 0, 0.1)],
    [15, P(-0.1, -0.2, -1.0, 0.8, 2.9, 0.1, -0.2, -0.2, 0.4, -0.2, 0, 0.2)],
    [30, NI],
  ],
  slade_sweep: [
    [0, P(0.5, 0.1, -0.8, 1, 0.6, 0.6, 0.7, -1.5, 1.0, -1.5, 0, 0.6)],
    [9, P(0.35, 0.1, -0.9, 0.3, 0.9, 0.5, 1.0, -2.3, 1.35, -0.05, 0, 0.9)],
    [18, P(0.35, 0.1, -0.9, 0.3, 0.9, 0.5, 1.0, -2.3, 1.3, -0.1, 0, 0.9)],
    [32, NI],
  ],
  slade_dive: [
    [0, P(0.1, 0, -0.4, 1.4, 1.8, 0.6, 1.0, -1.8, 1.2, -1.6, 0, 0.8)],
    [5, P(0.3, 0.2, -1.6, 0.4, -1.3, 0.5, 1.2, -2.0, 0.55, -0.05, 0.55, 0.3)],
    [70, P(0.3, 0.2, -1.6, 0.4, -1.3, 0.5, 1.2, -2.0, 0.55, -0.05, 0.55, 0.3)],
  ],
  slade_mudra: [
    [0, NI],
    [6, P(0, 0, 0.9, 1.7, 0.8, 1.8, -0.4, -0.2, 0.4, -0.2, 0, 1.6)],
    [12, P(0, 0, 0.9, 1.7, 0.8, 1.8, -0.45, -0.2, 0.45, -0.2, 0, 1.6)],
    [15, P(-0.1, -0.3, 2.7, 0.2, 2.6, 0.2, -0.6, -0.1, 0.6, -0.1, 0, 0.2)],
    [40, P(-0.1, -0.3, 2.6, 0.2, 2.5, 0.2, -0.6, -0.1, 0.6, -0.1, 0, 0.2)],
    [56, NI],
  ],
  fr_jab: [
    [0, BI],
    [3, P(0.35, 0.05, 0.55, 2.1, 1.6, 0.05, -0.5, -0.1, 0.5, -0.4)],
    [7, P(0.35, 0.05, 0.55, 2.1, 1.55, 0.1, -0.5, -0.1, 0.5, -0.4)],
    [14, BI],
  ],
  fr_liver: [
    [0, BI],
    [2, P(0.1, 0, -0.4, 1.6, 0.8, 1.9, -0.4, -0.15, 0.4, -0.4)],
    [4, P(0.55, 0.15, 1.35, 0.25, 0.7, 2.0, -0.6, -0.1, 0.8, -0.7)],
    [10, P(0.55, 0.15, 1.3, 0.3, 0.7, 2.0, -0.6, -0.1, 0.8, -0.7)],
    [18, BI],
  ],
  fr_uppercut: [
    [0, BI],
    [3, P(0.6, 0.2, 0.2, 1.2, 0.8, 2.0, 0.8, -1.5, 0.9, -1.4)],
    [6, P(-0.1, -0.2, 2.8, 0.4, 0.6, 2.0, -0.3, -0.1, 0.3, -0.2)],
    [13, P(-0.1, -0.2, 2.7, 0.5, 0.6, 2.0, -0.3, -0.1, 0.3, -0.2)],
    [22, BI],
  ],
  fr_haymaker: [
    [0, BI],
    [6, P(-0.15, -0.1, 0.6, 2.0, -0.7, 1.6, -0.3, -0.1, 0.5, -0.4)],
    [10, P(0.65, 0.2, -0.5, 1.2, 1.85, 0.1, -0.8, -0.05, 0.9, -0.5)],
    [20, P(0.6, 0.2, -0.5, 1.2, 1.7, 0.2, -0.8, -0.05, 0.9, -0.5)],
    [34, BI],
  ],
  fr_charge: [
    [0, P(0.5, 0.1, -0.3, 1.2, 0.2, 1.8, -0.5, -0.2, 0.6, -0.6)],
    [4, P(0.8, 0.3, -0.6, 1.0, 0.3, 1.6, -0.8, -0.3, 0.9, -0.9)],
    [26, P(0.8, 0.3, -0.6, 1.0, 0.3, 1.6, -0.8, -0.3, 0.9, -0.9)],
    [36, BI],
  ],
  fr_hammer: [
    [0, P(-0.1, -0.2, 3.0, 0.2, 3.0, 0.2, 0.9, -1.6, 1.1, -1.5)],
    [7, P(0.5, 0.3, 1.0, 0.1, 1.1, 0.1, 0.4, -0.6, 0.5, -0.5)],
    [70, P(0.5, 0.3, 1.0, 0.1, 1.1, 0.1, 0.4, -0.6, 0.5, -0.5)],
  ],
  fr_riot: [
    [0, BI],
    [10, P(0.3, 0, 1.2, 0.4, 1.4, 0.4, -0.7, -0.3, 0.7, -0.5)],
    [14, P(0.1, 0, -1.6, 0, 1.6, 0, -0.6, -0.2, 0.6, -0.3)],
    [44, P(0.1, 0, -1.6, 0, 1.6, 0, -0.6, -0.2, 0.6, -0.3)],
    [47, P(-0.2, -0.3, 3.0, 0.2, 3.0, 0.2, -0.4, -0.1, 0.4, -0.1)],
    [50, P(0.9, 0.4, 0.8, 0.1, 0.9, 0.1, 0.9, -1.7, 1.0, -1.5)],
    [66, P(0.9, 0.4, 0.8, 0.1, 0.9, 0.1, 0.9, -1.7, 1.0, -1.5)],
    [80, BI],
  ],
  nb_slash1: [
    [0, NB],
    [3, P(0.05, 0, -0.3, 1.0, 2.6, 0.8, -0.35, -0.1, 0.4, -0.4, 0, 0.6)],
    [6, P(0.4, 0.1, -0.6, 0.9, 1.6, 0, -0.6, -0.1, 0.7, -0.3, 0, 0.1)],
    [12, P(0.35, 0.1, -0.6, 0.9, 1.0, 0.2, -0.6, -0.1, 0.7, -0.3, 0, -0.5)],
    [22, NB],
  ],
  nb_slash2: [
    [0, NB],
    [4, P(0.0, 0, 2.5, 0.8, 0.4, 1.2, -0.35, -0.1, 0.4, -0.4, 0, 0.6)],
    [7, P(0.45, 0.1, 1.6, 0, 0.2, 1.2, -0.7, -0.05, 0.8, -0.3, 0, 0.1)],
    [14, P(0.4, 0.1, 1.2, 0.2, 0.2, 1.2, -0.7, -0.05, 0.8, -0.3, 0, -0.4)],
    [28, NB],
  ],
  nb_flip: [
    [0, crouchOf('ninjabot')],
    [4, P(0.2, 0, 1.5, 1.0, 1.5, 1.0, 1.1, -2.0, 1.2, -2.0, 0, 0.9)],
    [12, P(0.1, 0, -1.2, 0.5, -1.0, 0.5, 0.9, -1.8, 1.4, 0, 0, 0.3)],
    [60, P(0.1, 0, -1.2, 0.5, -1.0, 0.5, 0.9, -1.8, 1.4, 0, 0, 0.3)],
  ],
  nb_throw: [
    [0, NB],
    [6, P(-0.1, 0, -0.4, 1.0, 2.8, 0.8, -0.4, -0.1, 0.5, -0.3, 0, 0.5)],
    [10, P(0.35, 0.1, -0.7, 1.0, 1.5, 0.1, -0.6, -0.1, 0.7, -0.4, 0, 0.5)],
    [18, P(0.3, 0.1, -0.7, 1.0, 1.4, 0.2, -0.6, -0.1, 0.7, -0.4, 0, 0.5)],
    [28, NB],
  ],
  fb_punch1: [
    [0, FB],
    [5, P(-0.05, 0, 0.3, 1.5, 0.1, 1.7, -0.3, -0.1, 0.3, -0.2)],
    [9, P(0.3, 0.05, 0.3, 1.5, 1.6, 0.05, -0.5, -0.1, 0.5, -0.3)],
    [16, P(0.3, 0.05, 0.3, 1.5, 1.55, 0.1, -0.5, -0.1, 0.5, -0.3)],
    [26, FB],
  ],
  fb_punch2: [
    [0, FB],
    [6, P(-0.05, 0, -0.6, 1.4, 0.5, 1.4, -0.3, -0.1, 0.3, -0.2)],
    [10, P(0.4, 0.05, 1.6, 0.05, 0.4, 1.4, -0.6, -0.1, 0.6, -0.3)],
    [20, P(0.4, 0.05, 1.55, 0.1, 0.4, 1.4, -0.6, -0.1, 0.6, -0.3)],
    [32, FB],
  ],
  fb_tackle: [
    [0, FB],
    [10, P(0.35, 0.1, -0.3, 1.4, 0.1, 1.6, 0.6, -1.2, 0.8, -1.2)],
    [14, P(0.85, 0.3, -0.6, 1.1, 0.3, 1.7, -0.8, -0.3, 0.9, -0.9)],
    [42, P(0.85, 0.3, -0.6, 1.1, 0.3, 1.7, -0.8, -0.3, 0.9, -0.9)],
    [52, FB],
  ],
  fb_pulse: [
    [0, FB],
    [10, P(-0.2, -0.2, 2.0, 0.3, 2.0, 0.3, -0.5, -0.1, 0.5, -0.1)],
    [30, P(-0.2, -0.2, 2.1, 0.3, 2.1, 0.3, -0.5, -0.1, 0.5, -0.1)],
    [34, P(0.5, 0.3, 0.9, 0.1, 0.9, 0.1, 0.8, -1.5, 0.9, -1.4)],
    [50, P(0.5, 0.3, 0.9, 0.1, 0.9, 0.1, 0.8, -1.5, 0.9, -1.4)],
    [62, FB],
  ],
  // White Lie: the near fist keeps the mic, so punches land mic-first (weapon ~0.6 keeps the mic in line with the forearm).
  wl_slap: [
    [0, KI],
    [2, P(-0.05, 0, 0.5, 1.0, -0.6, 0.8, -0.38, -0.1, 0.38, -0.3, 0, 0.6)],
    [4, P(0.3, 0.05, 0.5, 1.0, 1.7, 0.1, -0.5, -0.1, 0.5, -0.3, 0, 0.6)],
    [9, P(0.3, 0.05, 0.5, 1.0, 1.65, 0.15, -0.5, -0.1, 0.5, -0.3, 0, 0.6)],
    [18, KI],
  ],
  wl_hook: [
    [0, KI],
    [3, P(-0.1, 0, 0.5, 1.0, -0.9, 1.4, -0.4, -0.1, 0.4, -0.3, 0, 0.6)],
    [6, P(0.5, 0.15, 0.5, 1.0, 1.6, 0.2, -0.7, -0.05, 0.8, -0.5, 0, 0.6)],
    [12, P(0.45, 0.15, 0.5, 1.0, 1.5, 0.3, -0.7, -0.05, 0.8, -0.5, 0, 0.6)],
    [24, KI],
  ],
  wl_bump: [
    [0, KI],
    [5, P(-0.3, -0.1, -0.6, 0.4, -0.5, 0.4, -0.3, -0.1, 0.4, -0.3, 0, 0.6)],
    [8, P(0.55, 0.15, -0.9, 0.3, -0.8, 0.3, -0.7, -0.05, 0.9, -0.5, 0, 0.6)],
    [15, P(0.5, 0.15, -0.9, 0.3, -0.8, 0.3, -0.7, -0.05, 0.9, -0.5, 0, 0.6)],
    [32, KI],
  ],
  wl_rush: [
    [0, P(0.4, 0.1, -0.4, 1.0, 0.2, 1.6, -0.5, -0.2, 0.6, -0.6, 0, 0.6)],
    [5, P(0.75, 0.25, -0.7, 0.9, 0.2, 1.5, -0.8, -0.3, 0.9, -0.9, 0, 0.6)],
    [26, P(0.75, 0.25, -0.7, 0.9, 0.2, 1.5, -0.8, -0.3, 0.9, -0.9, 0, 0.6)],
    [40, KI],
  ],
  wl_drop: [
    [0, P(-0.1, -0.2, 3.0, 0.2, 2.8, 0.3, 0.8, -1.5, 1.0, -1.4, 0, 0.3)],
    [8, P(0.6, 0.3, 1.2, 0.1, 1.3, 0.1, 0.5, -0.7, 0.6, -0.6, 0, 0.6)],
    [70, P(0.6, 0.3, 1.2, 0.1, 1.3, 0.1, 0.5, -0.7, 0.6, -0.6, 0, 0.6)],
  ],
  // Mic Drop: hoist the mic overhead, then let it fall straight down from the fist.
  wl_mic: [
    [0, KI],
    [10, P(-0.15, -0.2, 0.5, 1.0, 3.0, 0.1, -0.35, -0.1, 0.35, -0.3, 0, 0.1)],
    [20, P(-0.15, -0.2, 0.5, 1.0, 3.05, 0.1, -0.35, -0.1, 0.35, -0.3, 0, 0.1)],
    [24, P(0.7, 0.35, 0.5, 1.0, 1.1, 0.1, 0.8, -1.5, 0.9, -1.4, 0, -1.2)],
    [50, P(0.7, 0.35, 0.5, 1.0, 1.1, 0.1, 0.8, -1.5, 0.9, -1.4, 0, -1.2)],
    [72, KI],
  ],
  wl_grab: [
    [0, KI],
    [2, P(0.1, 0.05, 0.6, 0.9, 1.3, 0.4, -0.4, -0.1, 0.4, -0.3, 0, 0.6)],
    [6, P(0.45, 0.15, 1.4, 0.3, 1.7, 0.1, -0.6, -0.05, 0.8, -0.5, 0, 0.6)],
    [11, P(0.45, 0.15, 1.4, 0.3, 1.7, 0.1, -0.6, -0.05, 0.8, -0.5, 0, 0.6)],
    [16, P(0.0, -0.1, 2.3, 0.2, 2.5, 0.1, -0.4, -0.1, 0.4, -0.3, 0, 0.3)],
    [22, P(-0.25, -0.25, 3.0, 0.1, 3.1, 0.05, -0.35, -0.1, 0.35, -0.3, 0, 0.1)],
    [34, P(-0.3, -0.3, 3.05, 0.1, 3.15, 0.05, -0.35, -0.1, 0.35, -0.3, 0, 0.1)],
    [37, P(0.7, 0.35, 1.3, 0.2, 1.4, 0.1, 0.8, -1.5, 0.9, -1.4, 0, -1.2)],
    [48, P(0.7, 0.35, 1.3, 0.2, 1.4, 0.1, 0.8, -1.5, 0.9, -1.4, 0, -1.2)],
    [64, KI],
  ],
  bat_jab: [
    [0, BA],
    [2, P(0.1, 0.02, 0.5, 2.0, 0.4, 2.2, -0.3, -0.1, 0.35, -0.35)],
    [4, P(0.3, 0.05, 0.5, 2.0, 1.6, 0.05, -0.45, -0.1, 0.5, -0.35)],
    [8, P(0.3, 0.05, 0.5, 2.0, 1.55, 0.1, -0.45, -0.1, 0.5, -0.35)],
    [16, BA],
  ],
  bat_cross: [
    [0, BA],
    [3, P(-0.1, 0, -0.3, 1.8, 0.8, 1.9, -0.35, -0.1, 0.4, -0.35)],
    [6, P(0.45, 0.1, 1.75, 0.0, 0.6, 2.0, -0.6, -0.05, 0.8, -0.5)],
    [12, P(0.4, 0.1, 1.7, 0.05, 0.6, 2.0, -0.6, -0.05, 0.8, -0.5)],
    [20, BA],
  ],
  bat_knee: [
    [0, BA],
    [3, P(-0.15, -0.05, 1.6, 0.6, 1.6, 0.6, -0.3, -0.1, 0.3, -0.3)],
    [6, P(0.25, 0.1, 0.4, 1.8, 0.3, 1.8, -0.2, -0.1, 1.9, -2.0)],
    [10, P(0.25, 0.1, 0.4, 1.8, 0.3, 1.8, -0.2, -0.1, 1.85, -1.95)],
    [28, BA],
  ],
  bat_slide: [
    [0, P(0.5, 0.1, 0.6, 1.6, 0.6, 1.6, 0.6, -1.4, 0.9, -1.4)],
    [3, P(-0.6, -0.2, -0.9, 0.4, 0.4, 0.9, 1.65, -0.05, 0.6, -1.7)],
    [14, P(-0.6, -0.2, -0.9, 0.4, 0.4, 0.9, 1.65, -0.05, 0.6, -1.7)],
    [34, BA],
  ],
  bat_glide: [
    [0, P(0.0, -0.1, 2.6, 0.2, 2.9, 0.1, 0.3, -0.4, 0.6, -0.9)],
    [4, P(0.35, 0.15, 2.2, 0.3, 2.6, 0.2, 0.6, -1.2, 1.5, -0.05, 0.3)],
    [80, P(0.35, 0.15, 2.2, 0.3, 2.6, 0.2, 0.6, -1.2, 1.5, -0.05, 0.3)],
  ],
  bat_throw: [
    [0, BA],
    [4, P(-0.2, -0.05, 0.5, 2.0, -1.2, 1.0, -0.3, -0.1, 0.35, -0.35)],
    [9, P(0.35, 0.1, 0.5, 2.0, 1.8, 0.0, -0.5, -0.1, 0.55, -0.35)],
    [14, P(0.35, 0.1, 0.5, 2.0, 1.75, 0.05, -0.5, -0.1, 0.55, -0.35)],
    [30, BA],
  ],
  bat_rise: [
    [0, P(0.3, 0.15, 0.6, 1.9, 0.3, 1.0, 0.7, -1.5, 0.9, -1.4)],
    [3, P(-0.1, -0.25, 0.4, 1.0, 2.9, 0.2, 0.5, -1.0, 1.0, -1.8)],
    [20, P(-0.1, -0.25, 0.4, 1.0, 2.95, 0.15, 0.5, -1.0, 1.0, -1.8)],
    [90, P(0.1, -0.1, 0.4, 1.0, 2.6, 0.3, 0.4, -0.8, 0.8, -1.4)],
  ],
  ri_tap: [
    [0, RI],
    [3, P(-0.05, 0, 0.6, 1.4, -0.5, 1.0, -0.32, -0.08, 0.32, -0.25, 0, -1.55)],
    [6, P(0.25, 0.05, 0.6, 1.4, 1.55, 0.15, -0.45, -0.08, 0.5, -0.3, 0, -0.2)],
    [10, P(0.25, 0.05, 0.6, 1.4, 1.5, 0.2, -0.45, -0.08, 0.5, -0.3, 0, -0.25)],
    [18, RI],
  ],
  ri_butt: [
    [0, RI],
    [4, P(0.2, 0.1, 0.3, 1.0, 0.2, 1.8, -0.35, -0.08, 0.4, -0.3, 0, -1.4)],
    [7, P(0.4, 0.2, 0.3, 1.0, 1.4, 0.2, -0.5, -0.05, 0.6, -0.4, 0, -1.5)],
    [12, P(0.35, 0.15, 0.3, 1.0, 1.35, 0.25, -0.5, -0.05, 0.6, -0.4, 0, -1.5)],
    [20, RI],
  ],
  ri_sweep: [
    [0, RI],
    [5, P(-0.2, -0.1, 0.4, 1.2, -1.2, 0.6, -0.3, -0.08, 0.4, -0.3, 0, -1.6)],
    [9, P(0.45, 0.15, 0.4, 1.2, 1.8, 0.1, -0.6, -0.05, 0.8, -0.5, 0, 0.4)],
    [14, P(0.4, 0.12, 0.4, 1.2, 1.7, 0.2, -0.6, -0.05, 0.8, -0.5, 0, 0.3)],
    [32, RI],
  ],
  ri_process: [
    [0, P(0.35, 0.1, 0.5, 1.2, 0.3, 1.4, -0.5, -0.2, 0.6, -0.6, 0, -1.5)],
    [5, P(0.55, 0.2, 0.4, 1.1, 0.2, 1.5, -0.7, -0.3, 0.85, -0.8, 0, -1.5)],
    [16, P(0.55, 0.2, 0.4, 1.1, 0.2, 1.5, -0.7, -0.3, 0.85, -0.8, 0, -1.5)],
    [36, RI],
  ],
  ri_dive: [
    [0, P(-0.1, -0.2, 2.4, 0.3, 2.6, 0.2, 0.5, -1.2, 0.8, -1.4, 0, -1.4)],
    [6, P(0.5, 0.25, 0.8, 0.2, 1.4, 0.1, 0.4, -0.6, 0.6, -0.5, 0, -1.2)],
    [70, P(0.5, 0.25, 0.8, 0.2, 1.4, 0.1, 0.4, -0.6, 0.6, -0.5, 0, -1.2)],
  ],
  ri_absolve: [
    [0, RI],
    [8, P(-0.1, -0.2, 0.6, 1.4, 2.8, 0.15, -0.3, -0.08, 0.3, -0.25, 0, 0.1)],
    [16, P(-0.15, -0.25, 0.6, 1.4, 2.95, 0.1, -0.3, -0.08, 0.3, -0.25, 0, 0.05)],
    [28, P(-0.1, -0.2, 0.6, 1.4, 2.9, 0.12, -0.3, -0.08, 0.3, -0.25, 0, 0.08)],
    [64, RI],
  ],
  jay_pluck: [
    [0, JI],
    [3, P(-0.1, -0.1, 1.45, 0.75, 0.9, 2.4, -0.45, -0.15, 0.45, -0.5, 0, 0.0)],
    [8, P(0.15, 0.0, 1.45, 0.75, 0.55, 1.5, -0.45, -0.15, 0.45, -0.5, 0, 0.5)],
    [14, P(0.1, 0.0, 1.45, 0.75, 0.6, 1.6, -0.45, -0.15, 0.45, -0.5, 0, 0.4)],
    [30, JI],
  ],
  jay_lash: [
    [0, JI],
    [3, P(0.3, 0.05, 1.3, 1.0, 2.6, 0.3, -0.5, -0.1, 0.5, -0.4, 0, -1.3)],
    [7, P(0.3, 0.05, 1.3, 1.0, 2.5, 0.35, -0.5, -0.1, 0.5, -0.4, 0, -1.4)],
    [16, JI],
  ],
  jay_kick: [
    [0, JI],
    [4, P(-0.1, -0.05, 1.45, 0.75, 0.75, 1.97, -0.2, -0.1, 1.6, -0.1, 0, 0.18)],
    [8, P(-0.1, -0.05, 1.45, 0.75, 0.75, 1.97, -0.2, -0.1, 1.55, -0.15, 0, 0.18)],
    [18, JI],
  ],
  jay_hook: [
    [0, JI],
    [4, P(0.2, 0, 1.45, 0.75, 0.75, 1.97, 0.6, -1.4, 0.9, -1.2, 0, 0.18)],
    [7, P(-0.3, -0.2, 0.6, 1.2, 0.3, 1.0, -0.5, -0.1, 2.4, -0.3, 0, -1.6)],
    [12, P(-0.3, -0.2, 0.6, 1.2, 0.3, 1.0, -0.5, -0.1, 2.3, -0.35, 0, -1.6)],
    [24, JI],
  ],
  jay_thrust: [
    [0, JI],
    [4, P(-0.15, 0, 1.45, 0.75, -0.6, 1.2, -0.4, -0.1, 0.4, -0.5, 0, 0.6)],
    [7, P(0.5, 0.1, 1.3, 1.0, 1.6, 0.0, -0.7, -0.05, 0.9, -0.4, 0, -0.05)],
    [14, P(0.45, 0.1, 1.3, 1.0, 1.55, 0.05, -0.7, -0.05, 0.9, -0.4, 0, -0.05)],
    [30, JI],
  ],
  jay_slide: [
    [0, P(0.3, 0.1, 1.45, 0.75, 0.6, 0.8, 0.6, -1.4, 0.9, -1.4, 0, 0.18)],
    [3, P(-0.5, -0.2, -0.8, 0.5, 0.6, 0.8, 1.6, -0.05, 0.7, -1.6, 0, 0.18)],
    [16, P(-0.5, -0.2, -0.8, 0.5, 0.6, 0.8, 1.6, -0.05, 0.7, -1.6, 0, 0.18)],
    [32, JI],
  ],
  jay_dive: [
    [0, P(0.1, 0, 1.45, 0.75, 0.75, 1.97, 1.0, -1.8, 1.2, -1.6, 0, 0.18)],
    [4, P(0.4, 0.2, -1.4, 0.4, -1.0, 0.5, 0.8, -1.6, 1.7, -0.05, 0.45, -1.2)],
    [70, P(0.4, 0.2, -1.4, 0.4, -1.0, 0.5, 0.8, -1.6, 1.7, -0.05, 0.45, -1.2)],
  ],
  jay_solo: [
    [0, JI],
    [8, P(0.0, -0.15, 1.45, 0.75, 0.75, 1.97, -0.45, -0.15, 0.45, -0.5, 0, 0.18)],
    [12, P(0.0, -0.15, 1.45, 0.75, 0.85, 2.3, -0.45, -0.15, 0.45, -0.5, 0, 0.0)],
    [18, P(0.0, -0.15, 1.45, 0.75, 0.65, 1.7, -0.45, -0.15, 0.45, -0.5, 0, 0.4)],
    [24, P(0.0, -0.15, 1.45, 0.75, 0.85, 2.3, -0.45, -0.15, 0.45, -0.5, 0, 0.0)],
    [30, P(0.0, -0.15, 1.45, 0.75, 0.65, 1.7, -0.45, -0.15, 0.45, -0.5, 0, 0.4)],
    [36, P(0.0, -0.15, 1.45, 0.75, 0.85, 2.3, -0.45, -0.15, 0.45, -0.5, 0, 0.0)],
    [42, P(0.0, -0.15, 1.45, 0.75, 0.65, 1.7, -0.45, -0.15, 0.45, -0.5, 0, 0.4)],
    [48, P(-0.2, -0.3, 2.2, 0.4, 2.6, 0.2, -0.5, -0.1, 0.5, -0.1, 0, -0.6)],
    [52, P(0.4, 0.2, 1.45, 0.75, 0.6, 0.6, 0.7, -1.5, 2.3, -0.2, 0, -1.2)],
    [62, P(0.4, 0.2, 1.45, 0.75, 0.6, 0.6, 0.7, -1.5, 2.2, -0.25, 0, -1.2)],
    [78, JI],
  ],
};

const RUN_LEG_MOVES: Record<string, [number, number]> = {
  fr_charge: [4, 26],
  fb_tackle: [14, 42],
  wl_rush: [5, 26],
};

function walkLegs(p: Pose, ph: number, amp: number, knee: number): Pose {
  const q = { ...p };
  q.hR = Math.sin(ph) * amp;
  q.kR = -(0.12 + Math.max(0, Math.cos(ph)) * knee);
  q.hL = Math.sin(ph + Math.PI) * amp;
  q.kL = -(0.12 + Math.max(0, Math.cos(ph + Math.PI)) * knee);
  return q;
}

export function idlePose(a: Archetype, t: number): Pose {
  const b = IDLE[a];
  const breathe = Math.sin(t * 0.08);
  if (a === 'brawler') {
    const bounce = Math.abs(Math.sin(t * 0.13));
    return { ...b, kL: b.kL - bounce * 0.3, kR: b.kR - bounce * 0.3, hL: b.hL + bounce * 0.1, hR: b.hR + bounce * 0.12, eR: b.eR + breathe * 0.06 };
  }
  if (a === 'kingpin') {
    // slow heave, the far hand talking with the beat, the mic fist rocking at the chin
    const heave = Math.sin(t * 0.05);
    const talk = Math.sin(t * 0.14);
    return { ...b, lean: b.lean + heave * 0.02, head: b.head - heave * 0.03 + talk * 0.02, sL: b.sL + talk * 0.08, eL: b.eL - talk * 0.12, sR: b.sR - heave * 0.03, eR: b.eR + heave * 0.05 };
  }
  if (a === 'fiddler') {
    // idly bowing the fiddle
    const stroke = Math.sin(t * 0.11);
    return { ...b, sR: b.sR + stroke * 0.1, eR: b.eR + stroke * 0.22, weapon: b.weapon - stroke * 0.2, head: b.head + breathe * 0.04 };
  }
  if (a === 'bishop') {
    const heave = Math.sin(t * 0.06);
    return { ...b, lean: b.lean + heave * 0.015, sL: b.sL + heave * 0.06, eL: b.eL - heave * 0.08, head: b.head + breathe * 0.03 };
  }
  return { ...b, lean: b.lean + breathe * 0.03, sR: b.sR + breathe * 0.04, kR: b.kR - breathe * 0.05 };
}

export function poseFor(f: Fighter): Pose {
  const a = f.def.archetype;
  const base = IDLE[a];
  switch (f.state) {
    case FState.INTRO:
      if (a === 'brawler') {
        // slumped and staring at the floor, then slowly lifting her head as the bell rings
        const lift = Math.min(1, Math.max(0, (f.stateFrame - 55) / 40));
        return lerpPose(SAD_INTRO, idlePose(a, f.animTime), lift * lift);
      }
      return idlePose(a, f.animTime);
    case FState.IDLE:
      if (f.guarding) return GUARD[a];
      return idlePose(a, f.animTime);
    case FState.WALK: {
      const p = walkLegs(base, f.walkPhase, 0.5, 0.75);
      if (f.guarding) return walkLegs(GUARD[a], f.walkPhase, 0.35, 0.5);
      if (a === 'ninja' || a === 'ninjabot') {
        p.sL = base.sL + Math.sin(f.walkPhase) * 0.3;
      }
      return p;
    }
    case FState.RUN: {
      const p = walkLegs(base, f.walkPhase, 0.9, 1.45);
      p.lean = base.lean + 0.35;
      if (a === 'ninja' || a === 'ninjabot') {
        p.sL = -1.3;
        p.eL = 0.3;
        p.sR = -1.0;
        p.eR = 0.4;
        p.weapon = -1.2;
      } else if (a === 'fiddler') {
        p.sL = 1.3;
        p.eL = 0.9;
        p.sR = -1.0;
        p.eR = 0.5;
        p.weapon = -0.6;
      } else {
        p.sR = 0.3 + Math.sin(f.walkPhase) * 0.8;
        p.sL = 0.3 - Math.sin(f.walkPhase) * 0.8;
        p.eR = 1.7;
        p.eL = 1.7;
      }
      return p;
    }
    case FState.PREJUMP:
    case FState.LAND:
    case FState.SUBSTITUTE:
      return crouchOf(a);
    case FState.JUMP: {
      const tuck = withLegs(base, 0.6, -1.3, 1.1, -1.5);
      if (f.vy > 1) return { ...tuck, sL: base.sL + 0.6, sR: base.sR + 0.6 };
      return withLegs(base, 0.3, -0.7, 0.6, -0.9);
    }
    case FState.ATTACK: {
      const m = f.move;
      if (!m) return base;
      const keys = MOVE_KEYS[m.pose];
      let p = keys ? sample(keys, Math.max(0, f.moveFrame)) : base;
      const runWin = RUN_LEG_MOVES[m.pose];
      if (runWin && f.moveFrame >= runWin[0] && f.moveFrame <= runWin[1]) {
        const w = walkLegs(p, f.walkPhase, 0.85, 1.3);
        p = { ...p, hL: w.hL, kL: w.kL, hR: w.hR, kR: w.kR };
      }
      if (m.pose === 'fr_riot' && f.moveFrame >= 14 && f.moveFrame < 46) p = { ...p, spin: ((f.moveFrame - 14) / 16) * Math.PI * 2 };
      if (m.pose === 'nb_flip' && f.moveFrame >= 4 && f.moveFrame < 12) p = { ...p, rot: ((f.moveFrame - 4) / 8) * Math.PI * 2 };
      return p;
    }
    case FState.BLOCK:
      return GUARD[a];
    case FState.HURT: {
      const t = Math.min(1, f.stateFrame / 3);
      const back = Math.max(0, 1 - f.stateFrame / Math.max(6, f.hitstun));
      return lerpPose(base, HURT_POSE, Math.min(t, 0.4 + back * 0.6));
    }
    case FState.JUGGLE: {
      const fall = Math.max(0, Math.min(1, (6 - f.vy) / 12));
      return P(-0.2, -0.3, 2.4, 0.4, 2.0, 0.3, 0.6, -0.4, 0.9, -0.3, -0.5 - fall * 0.9, base.weapon);
    }
    case FState.KNOCKDOWN:
    case FState.DEAD:
      return LYING;
    case FState.WAKEUP:
      return lerpPose(LYING, crouchOf(a), Math.min(1, f.stateFrame / (WAKEUP_FRAMES * 0.8)));
    case FState.VICTORY: {
      const v = VICTORY[a];
      return { ...v, sR: v.sR + Math.sin(f.animTime * 0.1) * 0.05 };
    }
  }
  return base;
}

// ============================================================================ rig

interface Dims {
  thigh: number;
  shin: number;
  torso: number;
  upper: number;
  fore: number;
  headR: number;
  neck: number;
  hipW: number;
  chestW: number;
  blade: number;
}

const DIMS: Record<Archetype, Dims> = {
  ninja: { thigh: 22, shin: 22, torso: 30, upper: 16, fore: 16, headR: 9, neck: 11, hipW: 8, chestW: 10, blade: 46 },
  brawler: { thigh: 24, shin: 24, torso: 31, upper: 15, fore: 15, headR: 8, neck: 10, hipW: 9.5, chestW: 10, blade: 0 },
  kingpin: { thigh: 22, shin: 21, torso: 36, upper: 16, fore: 16, headR: 10, neck: 8, hipW: 15, chestW: 20, blade: 7 },
  fiddler: { thigh: 23, shin: 23, torso: 29, upper: 15, fore: 15, headR: 8.5, neck: 10, hipW: 7.5, chestW: 10, blade: 32 },
  bat: { thigh: 26, shin: 26, torso: 34, upper: 17, fore: 17, headR: 8, neck: 10, hipW: 6.5, chestW: 9.5, blade: 0 },
  bishop: { thigh: 23, shin: 22, torso: 34, upper: 16, fore: 16, headR: 7.2, neck: 10, hipW: 9, chestW: 11.5, blade: 42 },
  ninjabot: { thigh: 22, shin: 23, torso: 29, upper: 16, fore: 15, headR: 8.5, neck: 11, hipW: 7, chestW: 11, blade: 28 },
  clownbot: { thigh: 19, shin: 20, torso: 34, upper: 16, fore: 17, headR: 8, neck: 10, hipW: 12, chestW: 17, blade: 0 },
};

interface V {
  x: number;
  y: number;
}

interface Skeleton {
  hipY: number;
  hip: V;
  kneeL: V;
  footL: V;
  kneeR: V;
  footR: V;
  neck: V;
  head: V;
  shL: V;
  shR: V;
  elL: V;
  hdL: V;
  elR: V;
  hdR: V;
  foreL: number;
  foreR: number;
  up: V;
  perp: V;
}

const dirv = (a: number): V => ({ x: Math.sin(a), y: Math.cos(a) });
const add = (a: V, d: V, s: number): V => ({ x: a.x + d.x * s, y: a.y + d.y * s });
const mix = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function buildSkeleton(p: Pose, d: Dims): Skeleton {
  const legH = (h: number, k: number): number => Math.cos(h) * d.thigh + Math.cos(h + k) * d.shin;
  const hipY = p.lying ? -7 : -Math.max(8, legH(p.hL, p.kL), legH(p.hR, p.kR));
  const hip = { x: 0, y: hipY };
  const kneeL = add(hip, dirv(p.hL), d.thigh);
  const footL = add(kneeL, dirv(p.hL + p.kL), d.shin);
  const kneeR = add(hip, dirv(p.hR), d.thigh);
  const footR = add(kneeR, dirv(p.hR + p.kR), d.shin);
  const up = { x: Math.sin(p.lean), y: -Math.cos(p.lean) };
  const perp = { x: -up.y, y: up.x };
  const neck = add(hip, up, d.torso);
  const head = add(neck, { x: Math.sin(p.lean + p.head), y: -Math.cos(p.lean + p.head) }, d.neck);
  const sh = add(neck, up, -3);
  const shL = add(sh, perp, -3);
  const shR = add(sh, perp, 2);
  const elL = add(shL, dirv(p.sL), d.upper);
  const hdL = add(elL, dirv(p.sL + p.eL), d.fore);
  const elR = add(shR, dirv(p.sR), d.upper);
  const hdR = add(elR, dirv(p.sR + p.eR), d.fore);
  return { hipY, hip, kneeL, footL, kneeR, footR, neck, head, shL, shR, elL, hdL, elR, hdR, foreL: p.sL + p.eL, foreR: p.sR + p.eR, up, perp };
}

// ============================================================================ palettes

interface Palette {
  [k: string]: string;
}

const PALETTES: Record<Archetype, Partial<Record<Variant, Palette>> & { normal: Palette }> = {
  ninja: {
    normal: { gi: '#17131f', giDark: '#0b0910', gi2: '#2c2244', trim: '#8a4dff', scarf: '#6b2fd6', scarfTip: '#b48cff', skin: '#e0b48f', eye: '#d6b8ff', blade: '#e6ebff', glow: '#9d5cff', wrap: '#46287e', hilt: '#2a1f3a' },
    alt: { gi: '#e9e6f2', giDark: '#b7b1c9', gi2: '#ffffff', trim: '#d11a4a', scarf: '#c0102f', scarfTip: '#ff6b8b', skin: '#d9a57f', eye: '#ff6b8b', blade: '#fff0f0', glow: '#ff3b6b', wrap: '#7e1d33', hilt: '#3a1f24' },
    boss: { gi: '#120e18', giDark: '#07050a', gi2: '#2a1740', trim: '#b066ff', scarf: '#7a1fe0', scarfTip: '#e0c4ff', skin: '#e0b48f', eye: '#ff4dff', blade: '#f2eaff', glow: '#c070ff', wrap: '#5a2aa0', hilt: '#2a1f3a' },
  },
  brawler: {
    // Monochrome harlequin: black and white motley, porcelain skin, one black and one white twin-tail, silver bells.
    // dark2 sits one palette step above dark so sleeves and rim highlights survive on night stages.
    normal: { dark: '#15121a', dark2: '#49454f', white: '#f2eff5', white2: '#cfc9d6', hood: '#f2eff5', hood2: '#15121a', glove: '#f2eff5', glove2: '#cfc9d6', skin: '#dfd8de', skinDark: '#c4bcc4', stock1: '#15121a', stock2: '#f2eff5', boots: '#0d0b10', bell: '#d8dde6', hair1: '#15121a', hair2: '#f2eff5', lace: '#f2eff5', knuckle: '#d8dde6', paint: '#0b090e', lips: '#15121a', glow: '#dfe6ff', buckle: '#c0c8d4' },
    // Alt keeps the black dress and inverts only the hood, with ice-blue bells, gloves and lacing.
    alt: { dark: '#15121a', dark2: '#49454f', white: '#9fe8ff', white2: '#cfc9d6', hood: '#15121a', hood2: '#f2eff5', glove: '#9fe8ff', glove2: '#5fb8d8', skin: '#dfd8de', skinDark: '#c4bcc4', stock1: '#15121a', stock2: '#9fe8ff', boots: '#0d0b10', bell: '#9fe8ff', hair1: '#15121a', hair2: '#9fe8ff', lace: '#9fe8ff', knuckle: '#9fe8ff', paint: '#0b090e', lips: '#15121a', glow: '#9fe8ff', buckle: '#9fe8ff' },
    boss: { dark: '#15121a', dark2: '#49454f', white: '#f2eff5', white2: '#cfc9d6', hood: '#f2eff5', hood2: '#15121a', glove: '#f2eff5', glove2: '#cfc9d6', skin: '#dfd8de', skinDark: '#c4bcc4', stock1: '#15121a', stock2: '#f2eff5', boots: '#0d0b10', bell: '#ffd21f', hair1: '#15121a', hair2: '#f2eff5', lace: '#ffd21f', knuckle: '#ffd86a', paint: '#0b090e', lips: '#15121a', glow: '#ffb13b', buckle: '#ffd21f' },
  },
  kingpin: {
    // White textured overshirt hanging open over a black tee, black jeans and sneakers, white fitted cap with a small
    // dark logo, black rectangular glasses, dark beard, faint ink on the neck and knuckles, two gold chains, and a
    // wired handheld mic in the near fist. Skin is fair.
    normal: { shirt: '#f4f2ec', shirt2: '#c9c3b8', tee: '#15121a', pants: '#2a2730', pants2: '#1a1820', cap: '#f7f5f0', capBrim: '#d4cec2', logo: '#15121a', skin: '#f8e6d8', skinDark: '#e0c4b0', glasses: '#0b090e', gold: '#ffd21f', shoe: '#15121a', sole: '#f2eff5', mic: '#1c1c22', micHead: '#b4bcc8', micHead2: '#6d7582', ink: '#7f8ea4', beard: '#4a3426', mouth: '#a05a58', glow: '#ffd21f' },
    // Alt: black overshirt and white tee, black cap, silver chains.
    alt: { shirt: '#241f2c', shirt2: '#0d0b10', tee: '#f4f4f6', pants: '#2a2730', pants2: '#1a1820', cap: '#1a1620', capBrim: '#0d0b10', logo: '#f4f4f6', skin: '#f8e6d8', skinDark: '#e0c4b0', glasses: '#0b090e', gold: '#dfe6f0', shoe: '#f4f4f6', sole: '#15121a', mic: '#1c1c22', micHead: '#dfe6f0', micHead2: '#8a93a2', ink: '#7f8ea4', beard: '#4a3426', mouth: '#a05a58', glow: '#dfe6f0' },
    // Shadow mogul: violet-black overshirt, silver chains, a mic head that glows like a plasma bulb.
    boss: { shirt: '#2a1740', shirt2: '#160b26', tee: '#0b090e', pants: '#120c18', pants2: '#07050a', cap: '#160b26', capBrim: '#2a1740', logo: '#b066ff', skin: '#d8c2b4', skinDark: '#b89a8a', glasses: '#0b090e', gold: '#dfe6f0', shoe: '#0b090e', sole: '#b066ff', mic: '#1c1c22', micHead: '#e0c4ff', micHead2: '#8a4dc0', ink: '#5a3a7a', beard: '#1a1018', mouth: '#5a2a2a', glow: '#b066ff' },
  },
  fiddler: {
    // Cream karate gi, indigo pants, black belt, red headband, chestnut ponytail, a maple fiddle and a rosin-glowing bow.
    normal: { gi: '#e9e2cc', giDark: '#bfb496', pants: '#2b3f5c', pants2: '#1c2a3e', belt: '#15121a', skin: '#d9a06c', skinDark: '#b07a4c', hair: '#4a2410', band: '#b8102e', wood: '#9a4e1c', woodDark: '#5c2a0e', strings: '#f3e9cc', bow: '#efe3c8', bowHair: '#fff8e0', frog: '#15121a', eye: '#2a1a10', mouth: '#6b3a2a', glow: '#ffb13b' },
    alt: { gi: '#1a1620', giDark: '#0d0b10', pants: '#1a1620', pants2: '#0d0b10', belt: '#ffd21f', skin: '#d9a06c', skinDark: '#b07a4c', hair: '#1a1010', band: '#f2eff5', wood: '#2a1a10', woodDark: '#0d0b10', strings: '#ffd21f', bow: '#d8d0c0', bowHair: '#ffffff', frog: '#ffd21f', eye: '#2a1a10', mouth: '#6b3a2a', glow: '#39f3ff' },
    // Shadow fiddler: ash-black gi, blood-red belt and headband, a charred fiddle strung with light.
    boss: { gi: '#2a2230', giDark: '#17121c', pants: '#120c18', pants2: '#07050a', belt: '#b8102e', skin: '#c9946a', skinDark: '#9a6a44', hair: '#1a1010', band: '#ff4d6d', wood: '#3a1a1a', woodDark: '#1a0a0a', strings: '#ff9ab0', bow: '#4a2a2a', bowHair: '#ff4d6d', frog: '#ff4d6d', eye: '#ff4d6d', mouth: '#6b3a2a', glow: '#ff4d6d' },
  },
  bat: {
    // Off-brand bat: grey suit, dark trunks, cowl, boots and gauntlets, dark cape, yellow belt and oval emblem.
    normal: { suit: '#5a6478', suit2: '#3c4457', trunks: '#1a1c26', cowl: '#1a1c26', cowl2: '#343a4e', cape: '#30354a', capeIn: '#1a1d2a', belt: '#ffd21f', emblem: '#ffd21f', emblemBat: '#1a1c26', skin: '#e6c2a4', mouth: '#6a3030', eye: '#f6f8ff', glow: '#ffd21f' },
    // Alt: Saturday-morning blue and grey.
    alt: { suit: '#8a93a8', suit2: '#5c657a', trunks: '#2a3f8a', cowl: '#2a3f8a', cowl2: '#4a63b8', cape: '#2a3f8a', capeIn: '#1a2a5e', belt: '#ffd21f', emblem: '#ffd21f', emblemBat: '#1a1c26', skin: '#e6c2a4', mouth: '#6a3030', eye: '#f6f8ff', glow: '#9fe8ff' },
    // Shadow bat: violet-black everything, pink-lit eyes.
    boss: { suit: '#2a1740', suit2: '#160b26', trunks: '#0b090e', cowl: '#0b090e', cowl2: '#2a1740', cape: '#160b26', capeIn: '#07050a', belt: '#b066ff', emblem: '#b066ff', emblemBat: '#0b090e', skin: '#c9a890', mouth: '#5a2a2a', eye: '#ff4dff', glow: '#b066ff' },
  },
  bishop: {
    // Street bishop: cream cassock, gold sash and pectoral cross, cream mitre with a gold band, oak crozier.
    normal: { robe: '#f4ead0', robe2: '#d8cbb0', sash: '#c9a227', mitre: '#fff8e6', mitreBand: '#c9a227', skin: '#f6dcc8', skinDark: '#d8b8a2', hair: '#4a3428', gold: '#ffd21f', wood: '#8a4e22', woodDark: '#5a2e10', shoe: '#3a2a20', mouth: '#8a4a46', eye: '#2a1a10', glow: '#ffd21f' },
    // Alt: the old dark cassock, cream mitre.
    alt: { robe: '#2a1a3a', robe2: '#1a1026', sash: '#c9a227', mitre: '#f3ead2', mitreBand: '#c9a227', skin: '#f6dcc8', skinDark: '#d8b8a2', hair: '#4a3428', gold: '#ffd21f', wood: '#8a4e22', woodDark: '#5a2e10', shoe: '#15121a', mouth: '#8a4a46', eye: '#2a1a10', glow: '#c79bff' },
    // Shadow bishop: ash-black vestments, a crozier that glows like a relic.
    boss: { robe: '#160b26', robe2: '#07050a', sash: '#b066ff', mitre: '#2a1740', mitreBand: '#b066ff', skin: '#d8c2b4', skinDark: '#b89a8a', hair: '#1a1018', gold: '#dfe6f0', wood: '#e0c4ff', woodDark: '#8a4dc0', shoe: '#0b090e', mouth: '#5a2a2a', eye: '#ff4dff', glow: '#b066ff' },
  },
  ninjabot: {
    normal: { chrome1: '#eef3f8', chrome2: '#7d8896', dark: '#1b2129', mesh: '#2a3440', visor: '#39f3ff', blade: '#c9fbff', joint: '#39f3ff' },
    alt: { chrome1: '#e6f2ea', chrome2: '#6e8a78', dark: '#17221b', mesh: '#233328', visor: '#7dff9b', blade: '#d6ffe0', joint: '#7dff9b' },
    elite: { chrome1: '#5b6170', chrome2: '#262a33', dark: '#0d0f14', mesh: '#1a1d24', visor: '#ff4d6d', blade: '#ffd0d8', joint: '#ffc857' },
    boss: { chrome1: '#ffe08a', chrome2: '#a8741f', dark: '#141008', mesh: '#2a2010', visor: '#ff2a2a', blade: '#fff4c8', joint: '#ff2a2a' },
  },
  clownbot: {
    normal: { rust: '#93512c', rust2: '#5c2f18', steel: '#a4adb6', steel2: '#525a64', hazard: '#d8102c', band: '#f2eef0', eye: '#ffd21f', fist: '#d8102c', fist2: '#8a0a1c', face: '#f2eef0', nose: '#ff2a2a', hair: '#ff7a1f', hat: '#3a7bff', pom: '#ffd21f', dot: '#ffd21f', ruff: '#f2eef0', shoe: '#d8102c', shoe2: '#8a0a1c', lace: '#f2eef0' },
    heavy: { rust: '#56633f', rust2: '#343d24', steel: '#8d959c', steel2: '#3f454b', hazard: '#ff9a1f', band: '#141414', eye: '#ff8a1f', fist: '#2e8b57', fist2: '#1d5a38', face: '#dcd6d8', nose: '#ff6a1f', hair: '#3fd45a', hat: '#ff9a1f', pom: '#ffffff', dot: '#ff9a1f', ruff: '#dcd6d8', shoe: '#2e8b57', shoe2: '#1d5a38', lace: '#dcd6d8' },
    elite: { rust: '#8a1f22', rust2: '#4f0f12', steel: '#b8b0a8', steel2: '#5a4e48', hazard: '#141414', band: '#efe6ea', eye: '#ff3b3b', fist: '#141414', fist2: '#0a0a0a', face: '#efe6ea', nose: '#ff3b3b', hair: '#b14cff', hat: '#141414', pom: '#ff3b3b', dot: '#ffffff', ruff: '#141414', shoe: '#141414', shoe2: '#0a0a0a', lace: '#ff3b3b' },
    boss: { rust: '#26221e', rust2: '#12100e', steel: '#e0b04a', steel2: '#8a6420', hazard: '#ffd21f', band: '#141414', eye: '#ff2a2a', fist: '#ffd21f', fist2: '#a87a10', face: '#fff3d0', nose: '#ff2a2a', hair: '#ffd21f', hat: '#8a0a1c', pom: '#ffd21f', dot: '#ffd21f', ruff: '#fff3d0', shoe: '#ffd21f', shoe2: '#a87a10', lace: '#141414' },
  },
};

function paletteFor(a: Archetype, v: Variant): Palette {
  const set = PALETTES[a];
  return set[v] ?? set.normal;
}

// ============================================================================ drawing primitives

type Ctx = CanvasRenderingContext2D;

function seg(ctx: Ctx, a: V, b: V, w: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function dot(ctx: Ctx, c: V, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function taper(ctx: Ctx, a: V, b: V, w1: number, w2: number, fill: string | CanvasGradient): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(a.x + (nx * w1) / 2, a.y + (ny * w1) / 2);
  ctx.lineTo(b.x + (nx * w2) / 2, b.y + (ny * w2) / 2);
  ctx.lineTo(b.x - (nx * w2) / 2, b.y - (ny * w2) / 2);
  ctx.lineTo(a.x - (nx * w1) / 2, a.y - (ny * w1) / 2);
  ctx.closePath();
  ctx.fill();
}

function torsoQuad(ctx: Ctx, J: Skeleton, hipW: number, chestW: number, fill: string | CanvasGradient): void {
  const { hip, neck, perp } = J;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(hip.x - perp.x * hipW, hip.y - perp.y * hipW + 2);
  ctx.lineTo(hip.x + perp.x * hipW, hip.y + perp.y * hipW + 2);
  ctx.lineTo(neck.x + perp.x * chestW, neck.y + perp.y * chestW);
  ctx.lineTo(neck.x - perp.x * chestW, neck.y - perp.y * chestW);
  ctx.closePath();
  ctx.fill();
}

function perpGradient(ctx: Ctx, J: Skeleton, w: number, stops: [number, string][]): CanvasGradient {
  const c = mix(J.hip, J.neck, 0.5);
  const g = ctx.createLinearGradient(c.x - J.perp.x * w, c.y - J.perp.y * w, c.x + J.perp.x * w, c.y + J.perp.y * w);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

interface DrawOpts {
  tint: string | null;
  time: number;
  motion: number;
  /** Receives the blade tip & mid points in screen space when a weapon is drawn. */
  blade?: (tip: V, mid: V) => void;
  toScreen?: (p: V) => V;
}

// ============================================================================ character painters

function drawNinja(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  const t = o.time;

  // scarf and mask tails trail behind the neck
  const s0 = add(J.neck, J.perp, -3);
  ctx.lineCap = 'round';
  let prev = s0;
  for (let i = 1; i <= 8; i++) {
    const wave = Math.sin(t * 0.22 + i * 0.85) * i * (0.7 + o.motion * 0.6);
    const pt = { x: s0.x - i * (5.5 + o.motion * 3.5), y: s0.y + i * (1.4 - o.motion * 0.9) + wave };
    seg(ctx, prev, pt, Math.max(1.5, 7 - i * 0.7), T(i > 5 ? pal.scarfTip : pal.scarf));
    prev = pt;
  }
  let prevT = add(J.head, J.perp, -7);
  for (let i = 1; i <= 4; i++) {
    const pt = { x: prevT.x - 5 - o.motion * 2, y: prevT.y + 1.5 + Math.sin(t * 0.3 + i) * 1.6 };
    seg(ctx, prevT, pt, 2.4, T(pal.trim));
    prevT = pt;
  }

  // back limbs
  seg(ctx, J.hip, J.kneeL, 10, T(pal.giDark));
  seg(ctx, J.kneeL, J.footL, 8.5, T(pal.giDark));
  seg(ctx, mix(J.kneeL, J.footL, 0.45), J.footL, 8, T(pal.wrap));
  seg(ctx, J.footL, add(J.footL, { x: 1, y: 0 }, 5), 5, T(pal.giDark));
  seg(ctx, J.shL, J.elL, 8, T(pal.giDark));
  seg(ctx, J.elL, J.hdL, 7, T(pal.giDark));
  seg(ctx, mix(J.elL, J.hdL, 0.55), J.hdL, 7.5, T(pal.wrap));
  dot(ctx, J.hdL, 3.6, T(pal.giDark));

  // torso
  torsoQuad(ctx, J, d.hipW, d.chestW, o.tint ?? perpGradient(ctx, J, d.chestW, [[0, pal.giDark], [0.6, pal.gi], [1, pal.gi2]]));
  const lapelTop = add(J.neck, J.perp, 6);
  seg(ctx, lapelTop, add(J.hip, J.perp, -1), 2.4, T(pal.trim));
  seg(ctx, add(J.neck, J.perp, -7), add(J.neck, J.perp, 8), 3, T(pal.trim));
  seg(ctx, add(J.hip, J.perp, -d.hipW - 1), add(J.hip, J.perp, d.hipW + 1), 5, T(pal.trim));
  const knot = add(J.hip, J.perp, -d.hipW);
  seg(ctx, knot, { x: knot.x - 7 - o.motion * 4, y: knot.y + 9 + Math.sin(t * 0.25) * 2 }, 2.6, T(pal.trim));

  // front leg
  seg(ctx, J.hip, J.kneeR, 11, T(pal.gi));
  seg(ctx, J.kneeR, J.footR, 9.5, T(pal.gi));
  seg(ctx, mix(J.kneeR, J.footR, 0.45), J.footR, 9, T(pal.wrap));
  seg(ctx, J.footR, add(J.footR, { x: 1, y: 0 }, 6), 5.5, T(pal.gi));

  // head: hood, eye slit, glowing eyes
  seg(ctx, J.neck, J.head, 6, T(pal.gi));
  dot(ctx, J.head, d.headR, T(pal.gi));
  const face = add(J.head, J.perp, 3.5);
  ctx.fillStyle = T(pal.skin);
  ctx.beginPath();
  ctx.ellipse(face.x + 1, face.y - 1.5, 5.5, 2.4, p.lean + p.head, 0, Math.PI * 2);
  ctx.fill();
  if (!o.tint) {
    ctx.globalCompositeOperation = 'lighter';
    const eye = add(face, J.perp, 3);
    const g = ctx.createRadialGradient(eye.x, eye.y - 1.5, 0, eye.x, eye.y - 1.5, 6);
    g.addColorStop(0, pal.eye);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(eye.x - 6, eye.y - 7.5, 12, 12);
    ctx.globalCompositeOperation = 'source-over';
    dot(ctx, { x: eye.x, y: eye.y - 1.5 }, 1.3, '#ffffff');
  }
  dot(ctx, add(J.head, J.perp, -d.headR + 1), 2.6, T(pal.trim));

  // front arm + ninjato
  seg(ctx, J.shR, J.elR, 8.5, T(pal.gi));
  seg(ctx, J.elR, J.hdR, 7.5, T(pal.gi));
  seg(ctx, mix(J.elR, J.hdR, 0.55), J.hdR, 8, T(pal.wrap));
  const bd = dirv(J.foreR + p.weapon);
  const hiltBack = add(J.hdR, bd, -9);
  const guard = add(J.hdR, bd, 2.5);
  const tip = add(J.hdR, bd, 3 + d.blade);
  seg(ctx, hiltBack, guard, 3.4, T(pal.hilt));
  seg(ctx, add(guard, { x: -bd.y, y: bd.x }, -3), add(guard, { x: -bd.y, y: bd.x }, 3), 2.2, T('#9a8cb0'));
  if (!o.tint) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 0.3);
    seg(ctx, guard, tip, 7, pal.glow);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  seg(ctx, guard, tip, 2.6, T(pal.blade));
  dot(ctx, J.hdR, 4, T(pal.giDark));
  if (o.blade && o.toScreen) o.blade(o.toScreen(tip), o.toScreen(add(J.hdR, bd, 3 + d.blade * 0.45)));
}

function drawBrawler(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  const t = o.time;
  const up = J.up;
  const perp = J.perp;
  const fwd: V = { x: 1, y: 0 };
  ctx.lineCap = 'round';
  const poly = (pts: V[], color: string): void => {
    ctx.fillStyle = T(color);
    ctx.beginPath();
    pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.closePath();
    ctx.fill();
  };

  const striped = (a: V, b: V, w1: number, w2: number, n: number): void => {
    taper(ctx, a, b, w1, w2, T(pal.stock1));
    dot(ctx, a, w1 / 2, T(pal.stock1));
    if (o.tint) return;
    ctx.lineCap = 'butt';
    for (let i = 0; i < n; i++) {
      const t0 = (i + 0.2) / n;
      const t1 = (i + 0.6) / n;
      seg(ctx, mix(a, b, t0), mix(a, b, t1), w1 + (w2 - w1) * (t0 + t1) * 0.5, pal.stock2);
    }
    ctx.lineCap = 'round';
  };
  // Thin grey rim along one edge of a black limb so the silhouette reads against dark stages.
  const rim = (a: V, b: V, w: number, side: number): void => {
    if (o.tint) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = { x: (-dy / len) * side, y: (dx / len) * side };
    seg(ctx, add(mix(a, b, 0.1), n, w * 0.36), add(mix(a, b, 0.9), n, w * 0.36), 1.1, pal.dark2);
  };
  const boot = (knee: V, foot: V, w: number): void => {
    seg(ctx, mix(knee, foot, 0.68), foot, w, T(pal.boots));
    seg(ctx, add(foot, fwd, -2), add(foot, fwd, 7), w * 0.6, T(pal.boots));
    seg(ctx, add(foot, fwd, -2.5), add(add(foot, fwd, -2.5), { x: 0, y: -1 }, 3.5), 2.4, T(pal.boots));
    rim(mix(knee, foot, 0.68), foot, w, 1);
    if (!o.tint) dot(ctx, add(mix(knee, foot, 0.8), fwd, w * 0.3), 1.1, pal.buckle);
  };
  // Harlequin arms: black sleeves, the near hand in a white glove and the far hand in a shaded one.
  const sleeve = (sh: V, el: V, hd: V, front: boolean): void => {
    const cloth = front ? pal.dark : pal.dark2;
    const glove = front ? pal.glove : pal.glove2;
    dot(ctx, add(sh, up, 1), 4.6, T(cloth));
    seg(ctx, sh, el, 6.5, T(cloth));
    seg(ctx, el, mix(el, hd, 0.7), 5.6, T(cloth));
    if (front) rim(sh, el, 6.5, -1);
    seg(ctx, mix(el, hd, 0.7), hd, 5.6, T(glove));
    dot(ctx, hd, 4.2, T(glove));
  };
  const spikes = (hd: V, fore: number): void => {
    const fd = dirv(fore);
    const k = add(hd, fd, 3.2);
    const side = { x: -fd.y, y: fd.x };
    if (!o.tint) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, 8);
      g.addColorStop(0, pal.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(k.x - 8, k.y - 8, 16, 16);
      ctx.globalCompositeOperation = 'source-over';
    }
    seg(ctx, add(k, side, -3.4), add(k, side, 3.4), 2.4, T(pal.knuckle));
    for (const s of [-2.4, 0, 2.4]) dot(ctx, add(add(k, side, s), fd, 1.8), 0.9, T(pal.knuckle));
  };

  // twin-tails: far one white, near one black, each tied with the opposite colour
  const sway = Math.sin(t * 0.14) * 2.5 + o.motion * 7;
  const tailBase = add(J.head, perp, -d.headR + 2);
  const tails: [number, number, string, string][] = [
    [-2, 30, pal.hair2, pal.hair1],
    [3, 26, pal.hair1, pal.hair2],
  ];
  for (const [dy, len, col, tie] of tails) {
    const b0 = add(tailBase, up, -dy);
    const tip = { x: b0.x - 9 - sway * 1.3, y: b0.y + len - o.motion * 8 };
    const ctrl = { x: b0.x - 14 - sway, y: b0.y + len * 0.35 };
    ctx.strokeStyle = T(col);
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y);
    ctx.stroke();
    dot(ctx, add(b0, { x: -1, y: 0.3 }, 3), 2.4, T(tie));
  }

  // back arm and back leg
  sleeve(J.shL, J.elL, J.hdL, false);
  spikes(J.hdL, J.foreL);
  striped(J.hip, J.kneeL, 9, 7, 1);
  striped(J.kneeL, J.footL, 7, 5.5, 1);
  boot(J.kneeL, J.footL, 7.5);

  // hourglass corset with sweetheart neckline and white lacing
  const waist = mix(J.hip, J.neck, 0.42);
  const waistW = 5.5;
  poly(
    [add(J.hip, perp, -d.hipW), add(waist, perp, -waistW), add(J.neck, perp, -d.chestW), add(J.neck, perp, d.chestW), add(waist, perp, waistW), add(J.hip, perp, d.hipW)],
    pal.dark,
  );
  rim(add(J.hip, perp, -d.hipW), add(J.neck, perp, -d.chestW), 3, 1);
  const cb = mix(J.hip, J.neck, 0.78);
  poly([add(J.neck, perp, -d.chestW + 1), add(J.neck, perp, d.chestW), add(cb, perp, 3)], pal.skin);
  dot(ctx, add(cb, perp, 1), 5.6, T(pal.skin));
  dot(ctx, add(cb, perp, 6.5), 6.2, T(pal.skin));
  if (!o.tint) {
    seg(ctx, add(add(cb, perp, 5.2), up, 3), add(add(cb, perp, 5.6), up, -2.5), 1.1, pal.skinDark);
    dot(ctx, add(add(cb, perp, 8.8), up, 2.2), 1.1, '#ffffff');
  }
  const bustLine = add(cb, up, -4);
  seg(ctx, add(bustLine, perp, -d.chestW + 1), add(bustLine, perp, d.chestW + 5), 7, T(pal.dark));
  if (!o.tint) {
    seg(ctx, add(add(bustLine, up, 3.2), perp, -d.chestW + 1), add(add(bustLine, up, 3.2), perp, d.chestW + 6), 1.4, pal.lace);
    ctx.strokeStyle = pal.lace;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const c = mix(add(J.hip, up, 4), add(bustLine, up, -1.5), i / 5);
      const q = add(c, perp, i % 2 === 0 ? 2.2 : -2.2);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }

  // front leg, then the flared skirt (black over a white petticoat) across both thighs
  striped(J.hip, J.kneeR, 9.5, 7.5, 1);
  striped(J.kneeR, J.footR, 7.5, 6, 1);
  boot(J.kneeR, J.footR, 8);
  const skirt = (len: number, w0: number, w1: number, color: string): void => {
    const pts: V[] = [add(J.hip, perp, -w0), add(J.hip, perp, w0)];
    for (let i = 0; i <= 5; i++) {
      const base = add(add(J.hip, up, -len), perp, w1 - (i / 5) * 2 * w1);
      pts.push(i % 2 === 0 ? base : add(base, up, 3.5));
    }
    poly(pts, color);
  };
  skirt(13, d.hipW, d.hipW + 9, pal.white2);
  skirt(10, d.hipW, d.hipW + 7, pal.dark);
  seg(ctx, add(J.hip, perp, -d.hipW - 1), add(J.hip, perp, d.hipW + 1), 3, T(pal.white));

  // neck with a black choker and a silver bell
  seg(ctx, J.neck, J.head, 5, T(pal.skin));
  const chk = mix(J.neck, J.head, 0.45);
  seg(ctx, add(chk, perp, -3.2), add(chk, perp, 3.2), 2.2, T(pal.dark));
  dot(ctx, add(add(chk, perp, 3), up, -1.2), 1.3, T(pal.bell));

  // head in profile: cranium + jaw + nose, side-swept fringe, one large dark eye, hood with bells
  const ang = p.lean + p.head;
  ctx.save();
  ctx.translate(J.head.x, J.head.y);
  ctx.rotate(ang);
  const r = d.headR;
  const point = (bx: number, by: number, tx: number, ty: number, w: number, color: string): void => {
    taper(ctx, { x: bx, y: by }, { x: tx, y: ty }, w, 1.6, T(color));
    dot(ctx, { x: tx, y: ty }, 2, T(pal.bell));
  };
  point(-4, -4, -17 - sway * 0.8, 1 + Math.abs(sway) * 0.5, 8, pal.hood);
  dot(ctx, { x: 0, y: 0 }, r, T(pal.skin));
  dot(ctx, { x: 2.5, y: 3 }, 5.2, T(pal.skin));
  poly(
    [
      { x: 7.4, y: 0.3 },
      { x: 9, y: 1.6 },
      { x: 7.4, y: 2.6 },
    ],
    pal.skin,
  );
  point(3, -6, 10 - sway * 0.3, -15 + sway * 0.4, 7, pal.hood2);
  ctx.fillStyle = T(pal.hood);
  ctx.beginPath();
  ctx.arc(0, 0, r + 1.3, Math.PI * 0.95, Math.PI * 1.84);
  ctx.closePath();
  ctx.fill();
  if (!o.tint && pal.hood === pal.dark) {
    // black hood needs a grey edge or it melts into the hair
    ctx.strokeStyle = pal.dark2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.3, Math.PI * 0.98, Math.PI * 1.8);
    ctx.stroke();
  }
  if (!o.tint) {
    // jagged anime bangs under the hood, plus a side-lock framing the back of the face
    poly(
      [
        { x: -r + 0.5, y: -1.8 },
        { x: -3, y: -5 },
        { x: 3, y: -5.4 },
        { x: 7.8, y: -4.2 },
        { x: 8.6, y: -2.4 },
        { x: 6.8, y: -1.4 },
        { x: 5.4, y: -2.6 },
        { x: 3.6, y: -1 },
        { x: 2, y: -2.6 },
        { x: 0.2, y: -1.4 },
        { x: -1.6, y: -2.6 },
        { x: -4, y: -1.2 },
      ],
      pal.hair1,
    );
    taper(ctx, { x: -r + 1.5, y: -2 }, { x: -r + 0.5, y: 6 }, 3, 1.4, pal.hair1);
    // large anime eye in profile: tall almond, thick lid with lash flick, bright highlight
    ctx.fillStyle = pal.paint;
    ctx.beginPath();
    ctx.ellipse(4.9, 0.8, 1.4, 1.9, 0.05, 0, Math.PI * 2);
    ctx.fill();
    seg(ctx, { x: 3.5, y: -0.9 }, { x: 6.4, y: -1 }, 0.9, pal.paint);
    seg(ctx, { x: 6.4, y: -1 }, { x: 7.9, y: -1.9 }, 0.8, pal.paint);
    dot(ctx, { x: 5.2, y: 0 }, 0.55, '#ffffff');
    dot(ctx, { x: 4.6, y: 1.7 }, 0.3, '#ffffff');
    // painted sad-clown tear under the eye
    taper(ctx, { x: 4.4, y: 2.7 }, { x: 4.1, y: 4.6 }, 1.5, 0.5, pal.paint);
    dot(ctx, { x: 5.6, y: 4 }, 1.1, pal.skinDark);
    // downturned mouth
    seg(ctx, { x: 6.2, y: 4.3 }, { x: 7.6, y: 5.1 }, 1, pal.lips);
  }
  ctx.restore();

  // front arm with spiked knuckles
  sleeve(J.shR, J.elR, J.hdR, true);
  spikes(J.hdR, J.foreR);
}

function drawNinjabot(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  ctx.lineCap = 'round';
  const chrome = (a: V, b: V, w: number): CanvasGradient | string => {
    if (o.tint) return o.tint;
    const n = { x: -(b.y - a.y), y: b.x - a.x };
    const L = Math.hypot(n.x, n.y) || 1;
    const c = mix(a, b, 0.5);
    const g = ctx.createLinearGradient(c.x - (n.x / L) * w, c.y - (n.y / L) * w, c.x + (n.x / L) * w, c.y + (n.y / L) * w);
    g.addColorStop(0, pal.dark);
    g.addColorStop(0.45, pal.chrome2);
    g.addColorStop(0.75, pal.chrome1);
    g.addColorStop(1, pal.chrome2);
    return g;
  };
  const joint = (c: V, r: number): void => {
    dot(ctx, c, r, T(pal.dark));
    if (!o.tint) dot(ctx, c, r * 0.45, pal.joint);
  };
  const katana = (hand: V, fore: number, len: number, back: boolean): void => {
    const bd = dirv(fore + (back ? -p.weapon : p.weapon));
    const tip = add(hand, bd, len);
    seg(ctx, add(hand, bd, -5), hand, 3, T(pal.dark));
    if (!o.tint) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4;
      seg(ctx, hand, tip, 5.5, pal.visor);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    seg(ctx, hand, tip, 2, T(pal.blade));
    if (!back && o.blade && o.toScreen) o.blade(o.toScreen(tip), o.toScreen(add(hand, bd, len * 0.4)));
  };

  // back limbs
  taper(ctx, J.hip, J.kneeL, 9, 7, chrome(J.hip, J.kneeL, 5));
  taper(ctx, J.kneeL, J.footL, 7, 5, chrome(J.kneeL, J.footL, 4));
  seg(ctx, J.footL, add(J.footL, { x: 1, y: 0 }, 6), 4, T(pal.dark));
  joint(J.kneeL, 3.5);
  taper(ctx, J.shL, J.elL, 7, 6, chrome(J.shL, J.elL, 4));
  taper(ctx, J.elL, J.hdL, 6, 4.5, chrome(J.elL, J.hdL, 3));
  joint(J.elL, 3);
  katana(J.hdL, J.foreL, d.blade * 0.9, true);

  // torso: stealth-mesh abdomen + angular chest plate
  torsoQuad(ctx, J, d.hipW, d.chestW * 0.7, T(pal.mesh));
  if (!o.tint) {
    ctx.strokeStyle = 'rgba(120,200,255,0.18)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      const a = mix(J.hip, J.neck, 0.1 + i * 0.12);
      seg(ctx, add(a, J.perp, -d.hipW), add(a, J.perp, d.hipW), 0.6, 'rgba(120,200,255,0.2)');
    }
  }
  const c1 = mix(J.hip, J.neck, 0.45);
  const c2 = mix(J.hip, J.neck, 1.0);
  ctx.fillStyle = o.tint ?? perpGradient(ctx, J, d.chestW, [[0, pal.dark], [0.4, pal.chrome2], [0.8, pal.chrome1], [1, pal.chrome2]]);
  ctx.beginPath();
  ctx.moveTo(c1.x - J.perp.x * 5, c1.y - J.perp.y * 5);
  ctx.lineTo(c1.x + J.perp.x * 7, c1.y + J.perp.y * 7);
  ctx.lineTo(c2.x + J.perp.x * d.chestW, c2.y + J.perp.y * d.chestW);
  ctx.lineTo(c2.x - J.perp.x * (d.chestW - 2), c2.y - J.perp.y * (d.chestW - 2));
  ctx.closePath();
  ctx.fill();
  if (!o.tint) {
    ctx.globalCompositeOperation = 'lighter';
    seg(ctx, c1, add(c2, J.perp, 3), 1.6, pal.visor);
    ctx.globalCompositeOperation = 'source-over';
  }

  // front leg
  taper(ctx, J.hip, J.kneeR, 10, 7.5, chrome(J.hip, J.kneeR, 5));
  taper(ctx, J.kneeR, J.footR, 7.5, 5.5, chrome(J.kneeR, J.footR, 4));
  seg(ctx, J.footR, add(J.footR, { x: 1, y: 0 }, 7), 4.5, T(pal.dark));
  joint(J.kneeR, 3.8);

  // head: angular helmet with glowing visor slit
  const ang = p.lean + p.head;
  ctx.save();
  ctx.translate(J.head.x, J.head.y);
  ctx.rotate(ang);
  const r = d.headR;
  ctx.fillStyle = o.tint ?? (() => {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, pal.chrome1);
    g.addColorStop(0.6, pal.chrome2);
    g.addColorStop(1, pal.dark);
    return g;
  })();
  ctx.beginPath();
  ctx.moveTo(-r - 4, -2);
  ctx.lineTo(-r * 0.4, -r - 1);
  ctx.lineTo(r * 0.8, -r * 0.7);
  ctx.lineTo(r + 1.5, 1);
  ctx.lineTo(r * 0.5, r);
  ctx.lineTo(-r * 0.7, r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = T(pal.dark);
  ctx.fillRect(0, -2.8, r + 1.5, 4);
  if (!o.tint) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pal.visor;
    ctx.fillRect(1.5, -1.8, r, 1.8);
    const g = ctx.createRadialGradient(r * 0.6, -1, 0, r * 0.6, -1, 10);
    g.addColorStop(0, pal.visor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-6, -11, 22, 20);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  // front arm
  taper(ctx, J.shR, J.elR, 7.5, 6, chrome(J.shR, J.elR, 4));
  taper(ctx, J.elR, J.hdR, 6, 5, chrome(J.elR, J.hdR, 3));
  joint(J.elR, 3.2);
  joint(J.shR, 4);
  katana(J.hdR, J.foreR, d.blade, false);
}

function drawClownbot(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  ctx.lineCap = 'round';
  const glove = (el: V, hd: V, fore: number, w: number, fistR: number, front: boolean): void => {
    seg(ctx, el, hd, w, T(front ? pal.rust : pal.rust2));
    seg(ctx, mix(el, hd, 0.15), mix(el, hd, 0.85), 2, T(pal.steel));
    const fd = dirv(fore);
    const fist = add(hd, fd, fistR * 0.6);
    dot(ctx, fist, fistR, T(front ? pal.fist : pal.fist2));
    if (!o.tint) {
      dot(ctx, add(fist, { x: -0.4, y: -0.6 }, fistR * 0.35), fistR * 0.4, 'rgba(255,255,255,0.2)');
      const side = { x: -fd.y, y: fd.x };
      const wrist = add(fist, fd, -fistR * 0.55);
      seg(ctx, add(wrist, side, -fistR * 0.35), add(wrist, side, fistR * 0.35), 1.6, pal.lace);
    }
  };
  const shoe = (foot: V, len: number, front: boolean): void => {
    const col = T(front ? pal.shoe : pal.shoe2);
    ctx.fillStyle = col;
    ctx.fillRect(foot.x - 7, foot.y - 6, len, 7);
    dot(ctx, { x: foot.x - 7 + len, y: foot.y - 2.5 }, 3.6, col);
    if (!o.tint) dot(ctx, { x: foot.x - 7 + len + 0.5, y: foot.y - 3 }, 1.5, pal.lace);
  };

  // back limbs
  seg(ctx, J.hip, J.kneeL, 12, T(pal.steel2));
  seg(ctx, J.kneeL, J.footL, 12, T(pal.steel2));
  dot(ctx, J.kneeL, 6, T(pal.rust2));
  shoe(J.footL, 17, false);
  seg(ctx, J.shL, J.elL, 10, T(pal.steel2));
  glove(J.elL, J.hdL, J.foreL, 12, 10, false);

  // torso chassis with circus stripes and polka dots
  torsoQuad(ctx, J, d.hipW, d.chestW, o.tint ?? perpGradient(ctx, J, d.chestW, [[0, pal.rust2], [0.55, pal.rust], [1, pal.rust2]]));
  if (!o.tint) {
    ctx.save();
    ctx.beginPath();
    const b0 = mix(J.hip, J.neck, 0.55);
    const b1 = mix(J.hip, J.neck, 0.78);
    const w0 = d.hipW + (d.chestW - d.hipW) * 0.55;
    const w1 = d.hipW + (d.chestW - d.hipW) * 0.78;
    ctx.moveTo(b0.x - J.perp.x * w0, b0.y - J.perp.y * w0);
    ctx.lineTo(b0.x + J.perp.x * w0, b0.y + J.perp.y * w0);
    ctx.lineTo(b1.x + J.perp.x * w1, b1.y + J.perp.y * w1);
    ctx.lineTo(b1.x - J.perp.x * w1, b1.y - J.perp.y * w1);
    ctx.closePath();
    ctx.fillStyle = pal.band;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = pal.hazard;
    ctx.lineWidth = 3.2;
    const c = mix(b0, b1, 0.5);
    for (let i = -5; i <= 5; i++) {
      const s = add(c, J.perp, i * 6);
      ctx.beginPath();
      ctx.moveTo(s.x - 8, s.y + 8);
      ctx.lineTo(s.x + 8, s.y - 8);
      ctx.stroke();
    }
    ctx.restore();
    for (const [f, side] of [
      [0.18, -4],
      [0.3, 5],
      [0.42, -3],
      [0.9, 6],
      [0.92, -6],
    ]) {
      dot(ctx, add(mix(J.hip, J.neck, f), J.perp, side), 1.7, pal.dot);
    }
    ctx.globalCompositeOperation = 'lighter';
    const core = mix(J.hip, J.neck, 0.32);
    const g = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 8);
    g.addColorStop(0, pal.eye);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(core.x - 8, core.y - 8, 16, 16);
    ctx.globalCompositeOperation = 'source-over';
  }
  seg(ctx, add(J.neck, J.perp, -d.chestW), add(J.neck, J.perp, d.chestW), 5, T(pal.steel2));
  // ruffled collar
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const c = add(add(J.neck, J.perp, Math.cos(a) * d.chestW * 0.85), J.up, Math.sin(a) * 1.8 + 1.5);
    dot(ctx, c, 2.8, T(i % 2 === 0 ? pal.ruff : pal.hazard));
  }

  // front leg
  seg(ctx, J.hip, J.kneeR, 13, T(pal.steel));
  seg(ctx, J.kneeR, J.footR, 13, T(pal.steel));
  dot(ctx, J.kneeR, 6.5, T(pal.rust));
  shoe(J.footR, 20, true);

  // head: white clown face on a steel jaw, wild hair tufts, party hat, visor eye, red nose and grin
  const ang = p.lean + p.head;
  ctx.save();
  ctx.translate(J.head.x, J.head.y);
  ctx.rotate(ang);
  const r = d.headR;
  for (const [hx, hy, hr] of [
    [-r - 1.5, -1, 3.4],
    [-r - 0.5, -r + 2, 3.2],
    [-2.5, -r - 2, 3],
    [r * 0.55, -r - 1, 2.8],
    [r + 0.5, -r + 3, 2.4],
  ]) {
    dot(ctx, { x: hx, y: hy }, hr, T(pal.hair));
  }
  ctx.fillStyle = T(pal.steel2);
  ctx.fillRect(-r * 0.6, r * 0.2, r * 1.2, r * 0.9);
  ctx.fillStyle = T(pal.face);
  ctx.beginPath();
  ctx.arc(0, 0, r + 1, Math.PI, 0);
  ctx.lineTo(r + 1, r * 0.55);
  ctx.lineTo(-r - 1, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = T(pal.hat);
  ctx.beginPath();
  ctx.moveTo(-4.5, -r + 2);
  ctx.lineTo(4.5, -r + 2);
  ctx.lineTo(1, -r - 12);
  ctx.closePath();
  ctx.fill();
  if (!o.tint) {
    seg(ctx, { x: -2.2, y: -r - 3 }, { x: 3.4, y: -r - 3 }, 1.6, pal.pom);
    dot(ctx, { x: 1, y: -r - 12.5 }, 2.4, pal.pom);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(r * 0.4, -1.2, r * 0.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pal.eye;
    ctx.fillRect(r * 0.05, -1.9, r * 0.75, 1.5);
    const g = ctx.createRadialGradient(r * 0.5, -1, 0, r * 0.5, -1, 8);
    g.addColorStop(0, pal.eye);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-4, -9, 18, 18);
    ctx.globalCompositeOperation = 'source-over';
    dot(ctx, { x: r + 0.8, y: 1.6 }, 2.3, pal.nose);
    ctx.strokeStyle = pal.nose;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(r * 0.3, 2.2, 4.2, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  ctx.restore();

  // front arm: oversized pneumatic boxing glove
  dot(ctx, J.shR, 7, T(pal.steel));
  seg(ctx, J.shR, J.elR, 11, T(pal.steel));
  glove(J.elR, J.hdR, J.foreR, 14, 12.5, true);
}

function drawKingpin(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  const up = J.up;
  const perp = J.perp;
  const fwd: V = { x: 1, y: 0 };
  ctx.lineCap = 'round';
  const poly = (pts: V[], color: string): void => {
    ctx.fillStyle = T(color);
    ctx.beginPath();
    pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.closePath();
    ctx.fill();
  };
  const leg = (knee: V, foot: V, w1: number, w2: number, col: string): void => {
    seg(ctx, J.hip, knee, w1, T(col));
    seg(ctx, knee, foot, w2, T(col));
    dot(ctx, knee, w2 / 2, T(col));
    // chunky sneaker: dark upper, pale midsole
    seg(ctx, mix(knee, foot, 0.84), foot, w2 * 0.9, T(pal.shoe));
    seg(ctx, add(foot, fwd, -3), add(foot, fwd, 8), w2 * 0.75, T(pal.shoe));
    dot(ctx, add(foot, fwd, 8), w2 * 0.38, T(pal.shoe));
    if (!o.tint) seg(ctx, { x: foot.x - 3, y: foot.y + w2 * 0.3 }, { x: foot.x + 9, y: foot.y + w2 * 0.3 }, 1.8, pal.sole);
  };
  const arm = (sh0: V, el: V, hd: V, foreA: number, col: string, front: boolean): void => {
    // the rig's shoulder sits right under the jaw on this short neck, so hang the sleeve a little lower to keep the beard clear
    const sh = add(sh0, up, -4);
    if (front) {
      // thin dark edge so the near sleeve separates from the torso it overlaps
      seg(ctx, sh, el, 13.5, T(pal.shirt2));
      seg(ctx, el, hd, 12, T(pal.shirt2));
    }
    dot(ctx, sh, 6.5, T(col));
    seg(ctx, sh, el, 11.5, T(col));
    seg(ctx, el, hd, 10, T(col));
    seg(ctx, mix(el, hd, 0.8), mix(el, hd, 0.9), 10.5, T(pal.shirt2));
    dot(ctx, hd, 5.5, T(pal.skin));
    if (!o.tint) {
      // a single faint knuckle tattoo so the hands still read as skin at world resolution
      dot(ctx, add(hd, fwd, 1.6), 0.9, pal.ink);
      if (front) {
        const w = mix(el, hd, 0.94);
        const fd = dirv(foreA);
        const pd = { x: fd.y, y: -fd.x };
        seg(ctx, add(w, pd, -5.2), add(w, pd, 5.2), 1.7, pal.gold);
      }
    }
  };

  // back limbs
  leg(J.kneeL, J.footL, 15, 13, pal.pants2);
  arm(J.shL, J.elL, J.hdL, J.foreL, pal.shirt2, false);

  // broad back and heavy gut: white overshirt hanging open over a black tee
  torsoQuad(ctx, J, d.hipW, d.chestW, o.tint ?? perpGradient(ctx, J, d.chestW, [[0, pal.shirt2], [0.4, pal.shirt], [1, pal.shirt]]));
  const vTop = J.neck;
  const gc = add(mix(J.hip, J.neck, 0.35), perp, d.hipW - 3);
  poly([add(vTop, perp, -3), add(vTop, perp, 8), add(gc, perp, 6), add(gc, perp, -6)], pal.tee);
  dot(ctx, gc, 13, T(pal.tee));
  // open front panels and collar
  seg(ctx, add(vTop, perp, -3.5), add(gc, perp, -7.5), 3.6, T(pal.shirt2));
  seg(ctx, add(vTop, perp, 8.5), add(gc, perp, 8), 3.6, T(pal.shirt));
  const cTop = add(vTop, up, -4.5);
  poly([add(vTop, perp, -3), add(vTop, perp, -10), add(cTop, perp, -4)], pal.shirt);
  poly([add(vTop, perp, 8), add(vTop, perp, 14), add(cTop, perp, 9)], pal.shirt);
  if (!o.tint) {
    // seersucker stripes and a chest pocket flap on the far panel
    ctx.strokeStyle = 'rgba(0,0,0,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const k of [-0.78, -0.5, 0.88]) {
      const a = add(J.hip, perp, k * d.hipW);
      const b = add(J.neck, perp, k * d.chestW);
      ctx.moveTo(a.x, a.y + 2);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    const pk = mix(vTop, gc, 0.32);
    seg(ctx, add(pk, perp, -14), add(pk, perp, -8), 2.2, pal.shirt2);
    // two gold chains over the tee, the longer one with a pendant
    const c0 = add(vTop, perp, -1.5);
    const c1 = add(vTop, perp, 7.5);
    ctx.strokeStyle = pal.gold;
    for (const [sag, lw] of [[8, 1.3], [13, 1.8]] as [number, number][]) {
      const cm = add(mix(c0, c1, 0.5), up, -sag);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.quadraticCurveTo(cm.x, cm.y + 3, c1.x, c1.y);
      ctx.stroke();
    }
    dot(ctx, add(mix(c0, c1, 0.5), up, -11.5), 2.2, pal.gold);
  }

  // front leg
  leg(J.kneeR, J.footR, 16, 14, pal.pants);

  // bull neck with ink
  seg(ctx, add(J.neck, perp, 1), J.head, 11, T(pal.skin));
  if (!o.tint) {
    const n0 = mix(add(J.neck, perp, 1), J.head, 0.35);
    const n1 = mix(add(J.neck, perp, 1), J.head, 0.7);
    seg(ctx, add(n0, perp, -3), add(n1, perp, -1.5), 1.1, pal.ink);
    dot(ctx, add(n0, perp, 2.5), 0.9, pal.ink);
  }

  // head: fitted cap, black rectangular glasses, short dark beard, stud in the ear
  const ang = p.lean + p.head;
  ctx.save();
  ctx.translate(J.head.x, J.head.y);
  ctx.rotate(ang);
  const r = d.headR;
  dot(ctx, { x: 0, y: 0 }, r, T(pal.skin));
  dot(ctx, { x: 1.5, y: 3.5 }, r * 0.8, T(pal.skin));
  dot(ctx, { x: -r + 1.5, y: 1 }, 2, T(pal.skinDark));
  // short dark beard on the jaw only — cheeks and the rest of the face stay fair
  ctx.fillStyle = T(pal.beard);
  ctx.beginPath();
  ctx.arc(0, 0, r + 0.3, 0.95, Math.PI - 0.35);
  ctx.closePath();
  ctx.fill();
  dot(ctx, { x: 1.2, y: 6.6 }, r * 0.42, T(pal.beard));
  dot(ctx, { x: 4.4, y: 6.2 }, r * 0.28, T(pal.beard));
  // cap crown and brim
  ctx.fillStyle = T(pal.cap);
  ctx.beginPath();
  ctx.arc(0.4, -2.2, r + 0.7, Math.PI + 0.08, -0.08);
  ctx.closePath();
  ctx.fill();
  seg(ctx, { x: -2.5, y: -3.2 }, { x: r + 8, y: -3.9 }, 2.6, T(pal.capBrim));
  if (!o.tint) {
    seg(ctx, { x: 1, y: -4.4 }, { x: r + 7.5, y: -5.0 }, 0.9, pal.cap);
    dot(ctx, { x: 0.4, y: -r - 1.6 }, 0.9, pal.capBrim);
    dot(ctx, { x: 4.6, y: -6.8 }, 1.7, pal.logo);
    dot(ctx, { x: 6.2, y: -5.6 }, 1.1, pal.logo);
    // glasses: near lens plus the temple running back to the ear
    ctx.strokeStyle = pal.glasses;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(0.8, -2.1, r - 1.4, 3.0);
    seg(ctx, { x: 0.8, y: -1.2 }, { x: -r + 2.5, y: -0.4 }, 1.0, pal.glasses);
    dot(ctx, { x: r - 4.4, y: -0.4 }, 0.85, '#2a1a10');
    dot(ctx, { x: r - 2.6, y: -1.3 }, 0.6, '#ffffff');
    dot(ctx, { x: r - 1.2, y: 2.2 }, 0.6, pal.ink);
    dot(ctx, { x: -r + 2.4, y: 1.4 }, 0.9, '#e8f0ff');
    seg(ctx, { x: 4.2, y: 5.8 }, { x: 7.0, y: 5.4 }, 1.3, pal.mouth);
  }
  ctx.restore();

  // front arm gripping the handheld mic, cable trailing down behind the fist
  arm(J.shR, J.elR, J.hdR, J.foreR, pal.shirt, true);
  const md = dirv(J.foreR + p.weapon);
  const grip = add(J.hdR, md, -4.5);
  const headC = add(J.hdR, md, d.blade);
  if (!o.tint) {
    const sway = -5 - o.motion * 9;
    ctx.strokeStyle = pal.mic;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(grip.x, grip.y);
    ctx.quadraticCurveTo(grip.x - 2, grip.y + 13, grip.x + sway, grip.y + 22);
    ctx.stroke();
  }
  seg(ctx, grip, add(J.hdR, md, 3.5), 3.4, T(pal.mic));
  if (!o.tint && o.motion > 0.3) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    dot(ctx, headC, 6.5, pal.glow);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  dot(ctx, headC, 3.6, T(pal.micHead2));
  dot(ctx, add(headC, { x: -0.6, y: -0.6 }, 1), 2.6, T(pal.micHead));
  if (!o.tint) dot(ctx, add(headC, { x: -1, y: -1 }, 1.1), 0.8, '#ffffff');
  if (o.blade && o.toScreen) o.blade(o.toScreen(headC), o.toScreen(J.hdR));
}

function drawBat(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  const t = o.time;
  const up = J.up;
  const perp = J.perp;
  const fwd: V = { x: 1, y: 0 };
  ctx.lineCap = 'round';
  const poly = (pts: V[], color: string): void => {
    ctx.fillStyle = T(color);
    ctx.beginPath();
    pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.closePath();
    ctx.fill();
  };
  const leg = (knee: V, foot: V, w: number, col: string): void => {
    seg(ctx, J.hip, knee, w, T(col));
    seg(ctx, knee, foot, w * 0.85, T(col));
    dot(ctx, knee, w * 0.42, T(col));
    // tall boot to just under the knee
    seg(ctx, mix(knee, foot, 0.42), foot, w * 0.95, T(pal.trunks));
    seg(ctx, add(foot, fwd, -3), add(foot, fwd, 7), w * 0.7, T(pal.trunks));
    dot(ctx, add(foot, fwd, 7), w * 0.32, T(pal.trunks));
  };
  const arm = (sh: V, el: V, hd: V, foreA: number, col: string): void => {
    dot(ctx, add(sh, up, 1), 4.5, T(col));
    seg(ctx, sh, el, 7, T(col));
    seg(ctx, el, hd, 6.5, T(col));
    // gauntlet with its little fins
    seg(ctx, mix(el, hd, 0.5), hd, 7.5, T(pal.trunks));
    dot(ctx, hd, 4.2, T(pal.trunks));
    if (!o.tint) {
      const fd = dirv(foreA);
      const pd = { x: fd.y, y: -fd.x };
      const w0 = mix(el, hd, 0.58);
      const w1 = mix(el, hd, 0.76);
      seg(ctx, add(w0, pd, -3.5), add(w0, pd, -6), 1.3, pal.cowl2);
      seg(ctx, add(w1, pd, -3.5), add(w1, pd, -6), 1.3, pal.cowl2);
    }
  };

  // cape: hangs from the shoulders, trails behind and whips wide with speed, scalloped hem
  const sh = add(J.neck, up, -2.5);
  const billow = 13 + o.motion * 34 + Math.sin(t * 0.13) * 1.5;
  const hem = add(J.hip, up, -(d.thigh * 0.95 - o.motion * 10));
  const flutter = Math.sin(t * 0.21) * 1.5;
  const capePts: V[] = [add(sh, perp, 7), add(sh, perp, -9)];
  const back = { x: hem.x - billow - 8, y: hem.y + flutter - o.motion * 8 };
  const front = add(hem, perp, 3);
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const q = mix(back, front, i / n);
    capePts.push({ x: q.x, y: q.y + (i % 2 ? -5 : 1) });
  }
  const capeFill = o.tint ?? perpGradient(ctx, J, 14, [[0, pal.capeIn], [0.6, pal.cape], [1, pal.cape]]);
  ctx.fillStyle = capeFill;
  ctx.beginPath();
  capePts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();

  // back limbs
  leg(J.kneeL, J.footL, 8.5, pal.suit2);
  arm(J.shL, J.elL, J.hdL, J.foreL, pal.suit2);

  // narrow torso, trunks, belt and the oval emblem
  torsoQuad(ctx, J, d.hipW, d.chestW, o.tint ?? perpGradient(ctx, J, d.chestW, [[0, pal.suit2], [0.45, pal.suit], [1, pal.suit]]));
  const waist = mix(J.hip, J.neck, 0.24);
  poly([add(J.hip, perp, -d.hipW - 0.5), add(J.hip, perp, d.hipW + 0.5), add(waist, perp, d.hipW + 0.2), add(waist, perp, -d.hipW - 0.2)], pal.trunks);
  seg(ctx, add(waist, perp, -d.hipW - 1), add(waist, perp, d.hipW + 1), 3, T(pal.belt));
  if (!o.tint) {
    dot(ctx, add(waist, perp, 1), 1.6, pal.trunks);
    dot(ctx, add(waist, perp, -4.5), 1.1, pal.trunks);
    dot(ctx, add(waist, perp, 5.5), 1.1, pal.trunks);
    // yellow oval with a dumpy little bat silhouette in it
    const ec = add(mix(J.hip, J.neck, 0.72), perp, 1.5);
    ctx.save();
    ctx.translate(ec.x, ec.y);
    ctx.rotate(Math.atan2(up.y, up.x) + Math.PI / 2);
    ctx.fillStyle = pal.emblem;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.emblemBat;
    ctx.beginPath();
    const bat: [number, number][] = [[-4, 0.2], [-2.6, -1.1], [-1.1, -0.4], [0, -1.7], [1.1, -0.4], [2.6, -1.1], [4, 0.2], [2, 1.3], [0.7, 0.7], [0, 1.6], [-0.7, 0.7], [-2, 1.3]];
    bat.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // front leg
  leg(J.kneeR, J.footR, 9, pal.suit);

  // cowled head with two too-long ears, exposed jaw and a scowl
  seg(ctx, add(J.neck, perp, 0.5), J.head, 8, T(pal.cowl));
  const ang = p.lean + p.head;
  ctx.save();
  ctx.translate(J.head.x, J.head.y);
  ctx.rotate(ang);
  const r = d.headR;
  dot(ctx, { x: 0, y: 0 }, r, T(pal.cowl));
  poly([{ x: -6.5, y: -r + 3 }, { x: -5.5, y: -r - 8.5 }, { x: -2, y: -r + 1 }], pal.cowl);
  poly([{ x: 1, y: -r + 1 }, { x: 3.8, y: -r - 6.5 }, { x: 5.5, y: -r + 2.5 }], pal.cowl);
  // exposed lower face
  dot(ctx, { x: 3.4, y: 3.8 }, r * 0.56, T(pal.skin));
  dot(ctx, { x: 4.8, y: 1.8 }, r * 0.42, T(pal.skin));
  if (!o.tint) {
    dot(ctx, { x: -1.5, y: -r + 3.5 }, 1.8, 'rgba(255,255,255,0.14)');
    seg(ctx, { x: -5, y: -r + 2 }, { x: -2.5, y: -r + 0.5 }, 0.8, pal.cowl2);
    // one narrowed white eye slit
    poly([{ x: 1.6, y: -2.8 }, { x: 6.6, y: -3.6 }, { x: 6.9, y: -1.7 }, { x: 2.2, y: -1.0 }], pal.eye);
    seg(ctx, { x: 3.4, y: 4.6 }, { x: 6.4, y: 4.1 }, 1.2, pal.mouth);
    dot(ctx, { x: 5.6, y: 3.0 }, 0.5, pal.mouth);
  }
  ctx.restore();

  // front arm
  arm(J.shR, J.elR, J.hdR, J.foreR, pal.suit);
}

function drawFiddler(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  const t = o.time;
  const up = J.up;
  const perp = J.perp;
  const fwd: V = { x: 1, y: 0 };
  ctx.lineCap = 'round';
  const poly = (pts: V[], color: string): void => {
    ctx.fillStyle = T(color);
    ctx.beginPath();
    pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.closePath();
    ctx.fill();
  };

  // ponytail and headband tails trail behind the head
  let prev = add(J.head, perp, -d.headR + 1);
  for (let i = 1; i <= 6; i++) {
    const wave = Math.sin(t * 0.2 + i * 0.9) * i * (0.5 + o.motion * 0.5);
    const pt = { x: prev.x - 4.5 - o.motion * 2.5, y: prev.y + 3.2 - o.motion * 1.4 + wave * 0.3 };
    seg(ctx, prev, pt, Math.max(1.6, 5 - i * 0.5), T(pal.hair));
    prev = pt;
  }
  const bandKnot = add(J.head, perp, -d.headR - 0.5);
  for (const k of [0, 1]) {
    const tail = { x: bandKnot.x - 9 - o.motion * 5 - k * 2, y: bandKnot.y + 2 + k * 4 + Math.sin(t * 0.3 + k) * 2 };
    seg(ctx, bandKnot, tail, 1.8, T(pal.band));
  }

  // back leg (pants) and bare foot
  seg(ctx, J.hip, J.kneeL, 10, T(pal.pants2));
  seg(ctx, J.kneeL, J.footL, 8.5, T(pal.pants2));
  seg(ctx, J.footL, add(J.footL, fwd, 6), 5, T(pal.skinDark));

  // far arm holds the fiddle: gi sleeve to the elbow, bare forearm
  seg(ctx, J.shL, J.elL, 8, T(pal.giDark));
  seg(ctx, J.elL, J.hdL, 6.5, T(pal.skinDark));
  dot(ctx, J.hdL, 3.4, T(pal.skinDark));

  // fiddle spans from under the chin to the far hand
  const anchor = add(add(J.neck, perp, 5), up, 7);
  const fx = J.hdL.x - anchor.x;
  const fy = J.hdL.y - anchor.y;
  const fl = Math.hypot(fx, fy) || 1;
  const fd = { x: fx / fl, y: fy / fl };
  const fa = Math.atan2(fd.y, fd.x);
  const bout = (c: V, rx: number, ry: number, col: string): void => {
    ctx.fillStyle = T(col);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, fa, 0, Math.PI * 2);
    ctx.fill();
  };
  bout(add(anchor, fd, 5), 6.5, 5, pal.wood);
  bout(add(anchor, fd, 12.5), 5.5, 4.2, pal.wood);
  seg(ctx, add(anchor, fd, 14), J.hdL, 2.2, T(pal.woodDark));
  dot(ctx, add(J.hdL, fd, 2.5), 2, T(pal.woodDark));
  dot(ctx, add(anchor, fd, 0.5), 2.2, T(pal.belt));
  if (!o.tint) {
    const side = { x: -fd.y, y: fd.x };
    const mid = add(anchor, fd, 8.5);
    seg(ctx, add(add(mid, side, 2.6), fd, -2), add(add(mid, side, 2.6), fd, 2), 0.9, pal.woodDark);
    seg(ctx, add(add(mid, side, -2.6), fd, -2), add(add(mid, side, -2.6), fd, 2), 0.9, pal.woodDark);
    seg(ctx, add(anchor, fd, 2), J.hdL, 0.8, pal.strings);
    seg(ctx, add(mid, side, -1.2), add(mid, side, 1.2), 1.2, pal.woodDark);
  }

  // gi torso with a V-neck, lapels and a black belt
  torsoQuad(ctx, J, d.hipW, d.chestW, o.tint ?? perpGradient(ctx, J, d.chestW, [[0, pal.giDark], [0.5, pal.gi], [1, pal.gi]]));
  poly([add(J.neck, perp, -5), add(J.neck, perp, 7), add(mix(J.hip, J.neck, 0.6), perp, 2)], pal.skin);
  seg(ctx, add(J.neck, perp, -5), add(mix(J.hip, J.neck, 0.6), perp, 2), 2.2, T(pal.giDark));
  seg(ctx, add(J.neck, perp, 7), add(mix(J.hip, J.neck, 0.6), perp, 2), 2.2, T(pal.giDark));
  seg(ctx, add(J.hip, perp, -d.hipW - 1), add(J.hip, perp, d.hipW + 1), 4.5, T(pal.belt));
  const knot = add(J.hip, perp, 2);
  dot(ctx, knot, 2.6, T(pal.belt));
  seg(ctx, knot, { x: knot.x + 2, y: knot.y + 10 }, 2.2, T(pal.belt));
  seg(ctx, knot, { x: knot.x - 3 - o.motion * 3, y: knot.y + 9 }, 2.2, T(pal.belt));

  // front leg and bare foot
  seg(ctx, J.hip, J.kneeR, 11, T(pal.pants));
  seg(ctx, J.kneeR, J.footR, 9.5, T(pal.pants));
  seg(ctx, mix(J.kneeR, J.footR, 0.85), J.footR, 8.5, T(pal.pants2));
  seg(ctx, J.footR, add(J.footR, fwd, 7), 5.5, T(pal.skin));
  dot(ctx, add(J.footR, fwd, 7), 2.4, T(pal.skin));

  // head: tan skin, swept hair, red headband, sharp eye, confident grin
  seg(ctx, J.neck, J.head, 5.5, T(pal.skin));
  const ang = p.lean + p.head;
  ctx.save();
  ctx.translate(J.head.x, J.head.y);
  ctx.rotate(ang);
  const r = d.headR;
  dot(ctx, { x: 0, y: 0 }, r, T(pal.skin));
  dot(ctx, { x: 2, y: 3 }, r * 0.72, T(pal.skin));
  ctx.fillStyle = T(pal.hair);
  ctx.beginPath();
  ctx.arc(0, 0, r + 1.5, Math.PI * 0.95, Math.PI * 1.92);
  ctx.closePath();
  ctx.fill();
  poly(
    [
      { x: 2, y: -r + 1 },
      { x: r + 1.5, y: -4.5 },
      { x: r + 0.5, y: -1.5 },
      { x: 5, y: -3 },
    ],
    pal.hair,
  );
  seg(ctx, { x: -r - 1.5, y: -1.5 }, { x: r + 1, y: -4 }, 2.6, T(pal.band));
  dot(ctx, { x: -r - 0.5, y: -1.5 }, 2, T(pal.band));
  if (!o.tint) {
    seg(ctx, { x: -r + 2, y: -0.5 }, { x: -r + 2.5, y: 4 }, 2, pal.hair);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(4.6, 0.8, 1.8, 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    dot(ctx, { x: 5.1, y: 0.9 }, 0.9, pal.eye);
    seg(ctx, { x: 3, y: -1.6 }, { x: 6.9, y: -1 }, 1.1, pal.hair);
    seg(ctx, { x: 7.6, y: 1.6 }, { x: 8.4, y: 2.6 }, 1, pal.skinDark);
    seg(ctx, { x: 5.6, y: 4.6 }, { x: 7.8, y: 4.1 }, 1, pal.mouth);
  }
  ctx.restore();

  // front arm: sleeve, bare forearm, bow with rosin glow
  dot(ctx, add(J.shR, up, 1), 5, T(pal.gi));
  seg(ctx, J.shR, J.elR, 8.5, T(pal.gi));
  seg(ctx, J.elR, J.hdR, 7, T(pal.skin));
  dot(ctx, J.hdR, 3.6, T(pal.skin));
  const bd = dirv(J.foreR + p.weapon);
  const bn = { x: -bd.y, y: bd.x };
  const frog = add(J.hdR, bd, -4);
  const tip = add(J.hdR, bd, d.blade);
  if (!o.tint) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 0.3) + o.motion * 0.25;
    seg(ctx, frog, tip, 6, pal.glow);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  seg(ctx, frog, tip, 1.6, T(pal.bow));
  seg(ctx, add(frog, bn, 1.4), add(tip, bn, 1.4), 0.8, T(pal.bowHair));
  dot(ctx, frog, 1.7, T(pal.frog));
  if (o.blade && o.toScreen) o.blade(o.toScreen(tip), o.toScreen(add(J.hdR, bd, d.blade * 0.45)));
}

function drawBishop(ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts): void {
  const T = (c: string): string => o.tint ?? c;
  const up = J.up;
  const perp = J.perp;
  const fwd: V = { x: 1, y: 0 };
  ctx.lineCap = 'round';
  const poly = (pts: V[], color: string): void => {
    ctx.fillStyle = T(color);
    ctx.beginPath();
    pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.closePath();
    ctx.fill();
  };
  const leg = (knee: V, foot: V, w: number, col: string): void => {
    seg(ctx, J.hip, knee, w, T(col));
    seg(ctx, knee, foot, w * 0.9, T(col));
    dot(ctx, knee, w * 0.42, T(col));
    seg(ctx, add(foot, fwd, -2), add(foot, fwd, 6), w * 0.7, T(pal.shoe));
    dot(ctx, add(foot, fwd, 6), w * 0.3, T(pal.shoe));
  };
  const arm = (sh: V, el: V, hd: V, col: string): void => {
    dot(ctx, add(sh, up, 1), 4.6, T(col));
    seg(ctx, sh, el, 7.2, T(col));
    seg(ctx, el, hd, 6.4, T(col));
    dot(ctx, hd, 3.8, T(pal.skin));
  };

  // cassock hem behind the legs
  const hem = add(J.hip, up, -(d.thigh + 6));
  poly([add(J.hip, perp, -d.hipW - 2), add(J.hip, perp, d.hipW + 2), add(hem, perp, d.hipW + 6), add(hem, perp, -d.hipW - 8)], pal.robe2);

  leg(J.kneeL, J.footL, 8.5, pal.robe2);
  arm(J.shL, J.elL, J.hdL, pal.robe2);

  torsoQuad(ctx, J, d.hipW, d.chestW, o.tint ?? perpGradient(ctx, J, d.chestW, [[0, pal.robe2], [0.5, pal.robe], [1, pal.robe]]));
  // gold sash across the belly
  const sash = mix(J.hip, J.neck, 0.28);
  seg(ctx, add(sash, perp, -d.hipW - 1), add(sash, perp, d.hipW + 2), 4.2, T(pal.sash));
  if (!o.tint) {
    const xc = add(mix(J.hip, J.neck, 0.68), perp, 1.5);
    seg(ctx, add(xc, up, 3), add(xc, up, -5), 1.6, pal.gold);
    seg(ctx, add(xc, perp, -3.2), add(xc, perp, 3.2), 1.6, pal.gold);
    dot(ctx, add(xc, up, 4.2), 1.6, pal.gold);
  }

  leg(J.kneeR, J.footR, 9, pal.robe);

  // longer neck, narrower head: oval jaw instead of a circle
  seg(ctx, add(J.neck, perp, 0.5), J.head, 6.5, T(pal.skin));
  const ang = p.lean + p.head;
  ctx.save();
  ctx.translate(J.head.x, J.head.y);
  ctx.rotate(ang);
  const r = d.headR;
  ctx.fillStyle = T(pal.skin);
  ctx.beginPath();
  ctx.ellipse(0.4, 0.6, r * 0.82, r * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // cropped dark hair at the temples, kept off the cheeks
  ctx.fillStyle = T(pal.hair);
  ctx.beginPath();
  ctx.ellipse(0, -1.6, r * 0.78, r * 0.62, 0, Math.PI, 0);
  ctx.fill();
  // taller, narrower mitre
  poly([{ x: -5.2, y: -2.6 }, { x: -3.6, y: -r - 13 }, { x: 0.2, y: -r - 8.5 }, { x: 0.4, y: -2.6 }], pal.mitre);
  poly([{ x: 0.0, y: -2.6 }, { x: 0.4, y: -r - 8.5 }, { x: 4.4, y: -r - 12 }, { x: 5.4, y: -2.6 }], pal.mitre);
  seg(ctx, { x: -5.0, y: -2.8 }, { x: 5.2, y: -2.8 }, 2.0, T(pal.mitreBand));
  if (!o.tint) {
    dot(ctx, { x: 0.2, y: -r - 5 }, 1.1, pal.gold);
    dot(ctx, { x: 2.8, y: -1.4 }, 0.8, pal.eye);
    seg(ctx, { x: 2.6, y: 4.8 }, { x: 4.8, y: 4.5 }, 1.1, pal.mouth);
  }
  ctx.restore();

  arm(J.shR, J.elR, J.hdR, pal.robe);
  // crozier: staff plus a hooked head
  const cd = dirv(J.foreR + p.weapon);
  const grip = add(J.hdR, cd, -6);
  const tip = add(J.hdR, cd, d.blade);
  const hook = add(tip, { x: cd.y, y: -cd.x }, 8);
  if (!o.tint && o.motion > 0.3) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3;
    seg(ctx, grip, tip, 6, pal.glow);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  seg(ctx, grip, tip, 3.2, T(pal.wood));
  seg(ctx, tip, hook, 3.0, T(pal.wood));
  dot(ctx, hook, 2.4, T(pal.gold));
  dot(ctx, grip, 2.2, T(pal.gold));
  if (o.blade && o.toScreen) o.blade(o.toScreen(hook), o.toScreen(add(J.hdR, cd, d.blade * 0.5)));
}

const PAINTERS: Record<Archetype, (ctx: Ctx, J: Skeleton, p: Pose, d: Dims, pal: Palette, o: DrawOpts) => void> = {
  ninja: drawNinja,
  brawler: drawBrawler,
  kingpin: drawKingpin,
  fiddler: drawFiddler,
  bat: drawBat,
  bishop: drawBishop,
  ninjabot: drawNinjabot,
  clownbot: drawClownbot,
};

const TRAIL_TINT: Record<Archetype, string> = {
  ninja: '#6a2fd6',
  brawler: '#d8d0e0',
  kingpin: '#f0e6b0',
  fiddler: '#e8c080',
  bat: '#3a4260',
  bishop: '#c9a227',
  ninjabot: '#39f3ff',
  clownbot: '#ffd21f',
};

export type PortraitCrop = 'chest' | 'bust';

/** Per-archetype portrait framing: dx pushes the skull back from centre, dy raises it, zoom shrinks wide builds. */
const PORTRAIT: Record<Archetype, { dx: number; dy: number; zoom: number }> = {
  ninja: { dx: 3, dy: 0, zoom: 0.92 },
  brawler: { dx: 2, dy: 1, zoom: 1 },
  kingpin: { dx: 1, dy: -2, zoom: 0.8 },
  fiddler: { dx: 6, dy: 0, zoom: 0.94 },
  bat: { dx: 3, dy: 5, zoom: 0.92 },
  bishop: { dx: 2, dy: 6, zoom: 0.86 },
  ninjabot: { dx: 3, dy: 0, zoom: 1 },
  clownbot: { dx: 2, dy: 0, zoom: 0.9 },
};

// ============================================================================ public renderer

export class SpriteRenderer {
  /** Draws a posed body with feet at (x, y). */
  drawBody(
    ctx: Ctx,
    arch: Archetype,
    variant: Variant,
    pose: Pose,
    x: number,
    y: number,
    facing: number,
    scale: number,
    time: number,
    tint: string | null = null,
    motion = 0,
    onBlade?: (tip: V, mid: V) => void,
  ): void {
    const d = DIMS[arch];
    const J = buildSkeleton(pose, d);
    const pal = paletteFor(arch, variant);
    let sx = facing * scale;
    if (pose.spin) {
      const c = Math.cos(pose.spin);
      sx *= Math.sign(c || 1) * Math.max(0.12, Math.abs(c));
    }
    const rot = pose.rot;
    const hipY = J.hipY;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const toScreen = (pt: V): V => {
      let lx = pt.x;
      let ly = pt.y;
      if (rot) {
        const dy = ly - hipY;
        const nx = lx * cr - dy * sr;
        const ny = lx * sr + dy * cr + hipY;
        lx = nx;
        ly = ny;
      }
      return { x: x + lx * sx, y: y + ly * scale };
    };

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, scale);
    if (rot) {
      ctx.translate(0, hipY);
      ctx.rotate(rot);
      ctx.translate(0, -hipY);
    }
    ctx.lineJoin = 'round';
    PAINTERS[arch](ctx, J, pose, d, pal, { tint, time, motion, blade: onBlade, toScreen });
    ctx.restore();
  }

  drawFighter(ctx: Ctx, f: Fighter, view: RenderView): void {
    const arch = f.def.archetype;
    const sx = f.x - view.camX;
    const sy = f.z - f.y - view.camY;
    const pose = poseFor(f);

    const wantsTrail =
      f.state === FState.RUN ||
      (f.state === FState.ATTACK && (f.move?.kind === 'dash' || f.move?.kind === 'air' || (arch === 'ninja' && f.move?.kind === 'special')));
    if (wantsTrail && view.time % 3 === 0 && !f.hidden) {
      f.trail.push({ x: f.x, y: f.y, z: f.z, facing: f.facing, pose, life: 14 });
      if (f.trail.length > 6) f.trail.shift();
    }
    for (let i = f.trail.length - 1; i >= 0; i--) {
      const tr = f.trail[i];
      tr.life -= 1;
      if (tr.life <= 0) {
        f.trail.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = (tr.life / 14) * 0.42;
      this.drawBody(ctx, arch, f.variant, tr.pose as Pose, tr.x - view.camX, tr.z - tr.y - view.camY, tr.facing, f.scale, view.time, TRAIL_TINT[arch]);
    }
    ctx.globalAlpha = 1;

    this.drawBladeTrail(ctx, f, view);
    if (f.hidden) return;

    if (f.variant === 'boss' && f.state !== FState.DEAD) {
      ctx.globalCompositeOperation = 'lighter';
      const col = arch === 'ninja' ? 'rgba(140,70,255,0.28)' : 'rgba(230,225,245,0.22)';
      const g = ctx.createRadialGradient(sx, sy - 48, 4, sx, sy - 48, 70);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 70, sy - 118, 140, 140);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (f.hyperArmor > 0 || (f.armorHits > 0 && f.state === FState.ATTACK)) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(view.time * 0.6);
      this.drawBody(ctx, arch, f.variant, pose, sx, sy, f.facing, f.scale * 1.07, view.time, '#ffb13b');
      ctx.globalAlpha = 1;
    }

    let jx = 0;
    if (f.hitstop > 0 && f.flash > 0) jx = (Math.random() - 0.5) * 5;
    const tint = f.flash > 0 && f.flash % 4 < 2 ? '#ffffff' : null;
    if (f.invulnTimer > 0 && Math.floor(view.time / 3) % 2 === 0) ctx.globalAlpha = 0.35;
    if (f.state === FState.DEAD && f.deathFade > 0) ctx.globalAlpha = Math.max(0, 1 - f.deathFade);

    const record = f.state === FState.ATTACK && (arch === 'ninja' || arch === 'ninjabot' || arch === 'fiddler');
    const motion = Math.min(1, Math.abs(f.vx) / 7);
    this.drawBody(ctx, arch, f.variant, pose, sx + jx, sy, f.facing, f.scale, view.time, tint, motion, record
      ? (tip, mid) => {
          f.bladeTrail.push({ x: tip.x + view.camX, y: tip.y + view.camY, x2: mid.x + view.camX, y2: mid.y + view.camY, life: 7 });
          if (f.bladeTrail.length > 9) f.bladeTrail.shift();
        }
      : undefined);
    ctx.globalAlpha = 1;
  }

  private drawBladeTrail(ctx: Ctx, f: Fighter, view: RenderView): void {
    const tr = f.bladeTrail;
    for (let i = tr.length - 1; i >= 0; i--) {
      tr[i].life--;
      if (tr[i].life <= 0) tr.splice(i, 1);
    }
    if (tr.length < 2) return;
    const col =
      f.def.archetype === 'ninja'
        ? f.variant === 'alt'
          ? '255,60,110'
          : '157,92,255'
        : f.def.archetype === 'fiddler'
          ? f.variant === 'alt'
            ? '57,243,255'
            : '255,177,59'
          : f.variant === 'elite'
            ? '255,77,109'
            : '57,243,255';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1];
      const b = tr[i];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 90) continue;
      const alpha = (b.life / 7) * 0.55 * (i / tr.length);
      ctx.fillStyle = `rgba(${col},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a.x - view.camX, a.y - view.camY);
      ctx.lineTo(b.x - view.camX, b.y - view.camY);
      ctx.lineTo(b.x2 - view.camX, b.y2 - view.camY);
      ctx.lineTo(a.x2 - view.camX, a.y2 - view.camY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private portraitBuf: HTMLCanvasElement | null = null;

  /**
   * Portraits are painted at half resolution and upscaled with nearest-neighbour to match the pixelated world.
   * `crop` picks between a chest-up framing and a tight head-and-shoulders bust; both anchor on the skull so
   * every archetype lands in the same spot regardless of leg or torso length.
   */
  drawPortrait(ctx: Ctx, arch: Archetype, variant: Variant, x: number, y: number, w: number, h: number, facing = 1, time = 0, crop: PortraitCrop = 'chest'): void {
    const bw = Math.max(1, Math.ceil(w / 2));
    const bh = Math.max(1, Math.ceil(h / 2));
    const buf = (this.portraitBuf ??= document.createElement('canvas'));
    if (buf.width < bw) buf.width = bw;
    if (buf.height < bh) buf.height = bh;
    const b = buf.getContext('2d', { willReadFrequently: true })!;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, bw, bh);
    b.setTransform(0.5, 0, 0, 0.5, 0, 0);
    b.lineCap = 'round';
    const fr = PORTRAIT[arch];
    const tight = crop === 'bust';
    const scale = (h / 60) * (tight ? 2.0 : 1.35) * fr.zoom;
    const pose = { ...idlePose(arch, time), lean: 0.05, head: 0 };
    const head = buildSkeleton(pose, DIMS[arch]).head;
    // Skull sits a little behind centre so the face has breathing room in the facing direction.
    const cx = w / 2 - facing * (head.x + fr.dx) * scale;
    const feetY = h * (tight ? 0.5 : 0.4) - (head.y - fr.dy) * scale;
    this.drawBody(b, arch, variant, pose, cx, feetY, facing, scale, time);
    const img = b.getImageData(0, 0, bw, bh);
    pixelize(img);
    b.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, bw, bh, x, y, bw * 2, bh * 2);
    ctx.restore();
  }

  /** Tight head-and-shoulders portrait for HUD frames and dialogue boxes. */
  drawBust(ctx: Ctx, arch: Archetype, variant: Variant, x: number, y: number, size: number, facing = 1, time = 0): void {
    this.drawPortrait(ctx, arch, variant, x, y, size, size, facing, time, 'bust');
  }

  drawShuriken(ctx: Ctx, x: number, y: number, spin: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-14, -14, 28, 28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(spin);
    ctx.fillStyle = '#d7e0ea';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * 2.6, Math.sin(a + Math.PI / 4) * 2.6);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#20262e';
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Batman's not-a-rang: a spinning yellow bat-wing blade with a dark glow trail. */
  drawRang(ctx: Ctx, x: number, y: number, spin: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-14, -14, 28, 28);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(spin);
    ctx.fillStyle = color;
    ctx.beginPath();
    const wing: [number, number][] = [[-11, 1], [-7, -3], [-3, -1], [0, -4.5], [3, -1], [7, -3], [11, 1], [5.5, 3.5], [2, 2], [0, 4.5], [-2, 2], [-5.5, 3.5]];
    wing.forEach(([wx, wy], i) => (i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a1c26';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  /** Fiddle Jay's travelling quaver: a glowing note head with a stem and flag, drawn as shapes so it pixelizes cleanly. */
  drawNote(ctx: Ctx, x: number, y: number, age: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-16, -16, 32, 32);
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(Math.sin(age * 0.2) * 0.25 - 0.3);
    ctx.fillStyle = '#fff6dc';
    ctx.strokeStyle = '#fff6dc';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(-3, 5, 5, 3.6, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.5, 4);
    ctx.lineTo(1.5, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1.5, -10);
    ctx.quadraticCurveTo(8, -7, 7, 0);
    ctx.quadraticCurveTo(6, -4, 1.5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Ground-projected runic circle used by Abyssal Rift. */
  drawSigil(ctx: Ctx, x: number, y: number, r: number, rot: number, k: number, t: number, color: string): void {
    const grow = 0.3 + 0.7 * Math.min(1, t * 5);
    const R = r * grow;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.32);
    ctx.rotate(rot);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, k * 1.6);
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    g.addColorStop(0, 'rgba(120,50,255,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#e0c4ff';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = ((i + 2) / 6) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
      ctx.lineTo(Math.cos(b) * R * 0.78, Math.sin(b) * R * 0.78);
    }
    ctx.stroke();
    ctx.fillStyle = '#f0e0ff';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(a) * R * 0.89, Math.sin(a) * R * 0.89);
      ctx.rotate(a);
      ctx.fillRect(-2, -3, 4, 6);
      ctx.fillRect(-4, -0.8, 8, 1.6);
      ctx.restore();
    }
    ctx.restore();
  }
}
