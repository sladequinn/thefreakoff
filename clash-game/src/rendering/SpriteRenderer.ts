import { WAKEUP_FRAMES } from '../config/constants';
import { FState, type Archetype, type Variant } from '../physics/Types';
import type { RenderView } from '../entities/Entity';
import type { Fighter } from '../entities/Fighter';
import { pixelize } from './Pixelize';
import { drawCharacterArt } from './CharacterArt';

// ============================================================================ pose model

/** Angles in radians measured from straight down; positive rotates toward the facing direction. */
export interface Pose {
  lean: number;
  hipShift: number;
  turn: number;
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
): Pose => ({ lean, hipShift: 0, turn: 0, head, sL, eL, sR, eR, hL, kL, hR, kR, rot, weapon, spin: 0, lying: false });

const NUM_KEYS: (keyof Pose)[] = ['lean', 'hipShift', 'turn', 'head', 'sL', 'eL', 'sR', 'eR', 'hL', 'kL', 'hR', 'kR', 'rot', 'weapon', 'spin'];

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
  ninja: P(0.22, -0.14, -0.5, 1.4, 1.0, 0.7, -0.55, -0.28, 0.72, -0.7, 0, 0.7),
  brawler: P(0.12, 0.04, -0.6, 0.5, 0.3, 0.9, -0.55, -0.25, 0.6, -0.7),
  // White Lie plants wide, mic fist raised, with the far hand outside the coat silhouette.
  kingpin: P(0.05, 0.05, -0.6, 0.2, 0.2, 2.2, -0.38, -0.1, 0.38, -0.3, 0, 0.94),
  // Fiddle Jay holds the fiddle up at the chin with the far arm and rests the bow across the strings.
  fiddler: P(0.12, -0.05, 1.30, 0.6, 0.65, 1.0, -0.4, -0.12, 0.45, -0.5, 0, 3.0),
  // Batman (no relation): tall boxer's guard, both gauntlets up at chin height, cape hanging behind.
  bat: P(0.06, -0.03, 0.5, 2.0, 0.8, 1.9, -0.35, -0.15, 0.55, -0.55),
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
  fiddler: P(0.05, -0.25, 1.30, 0.6, 0.65, 1.0, -0.3, -0.05, 0.3, -0.05, 0, 3.0),
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
    [4, P(-0.1, -0.05, 1.30, 0.6, 0.65, 1.0, -0.2, -0.1, 1.6, -0.1, 0, 3.0)],
    [8, P(-0.1, -0.05, 1.30, 0.6, 0.65, 1.0, -0.2, -0.1, 1.55, -0.15, 0, 3.0)],
    [18, JI],
  ],
  jay_hook: [
    [0, JI],
    [4, P(0.2, 0, 1.30, 0.6, 0.65, 1.0, 0.6, -1.4, 0.9, -1.2, 0, 3.0)],
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
    [0, P(0.1, 0, 1.30, 0.6, 0.65, 1.0, 1.0, -1.8, 1.2, -1.6, 0, 3.0)],
    [4, P(0.4, 0.2, -1.4, 0.4, -1.0, 0.5, 0.8, -1.6, 1.7, -0.05, 0.45, -1.2)],
    [70, P(0.4, 0.2, -1.4, 0.4, -1.0, 0.5, 0.8, -1.6, 1.7, -0.05, 0.45, -1.2)],
  ],
  jay_solo: [
    [0, JI],
    [8, P(0.0, -0.15, 1.30, 0.6, 0.65, 1.0, -0.45, -0.15, 0.45, -0.5, 0, 3.0)],
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
      const heavy = a === 'kingpin' || a === 'clownbot';
      const p = walkLegs(base, f.walkPhase, heavy ? 0.36 : 0.52, heavy ? 0.5 : 0.78);
      p.hipShift = Math.sin(f.walkPhase) * (heavy ? 1.2 : 2.2);
      p.lean += Math.sin(f.walkPhase) * (heavy ? 0.04 : 0.065);
      p.head -= Math.sin(f.walkPhase) * 0.04;
      if (f.guarding) return walkLegs(GUARD[a], f.walkPhase, 0.35, 0.5);
      if (a === 'ninja' || a === 'ninjabot') {
        p.sL = base.sL + Math.sin(f.walkPhase) * 0.3;
      }
      return p;
    }
    case FState.RUN: {
      const heavy = a === 'kingpin' || a === 'clownbot';
      const p = walkLegs(base, f.walkPhase, heavy ? 0.64 : 0.9, heavy ? 0.95 : 1.45);
      p.hipShift = Math.sin(f.walkPhase) * (heavy ? 1.8 : 3);
      p.lean = base.lean + (heavy ? 0.22 : 0.32) + Math.sin(f.walkPhase) * 0.055;
      p.head = base.head - 0.12 - Math.sin(f.walkPhase) * 0.04;
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
      // Contact compresses the lead knee and releases the rear heel. This is visual weight transfer only;
      // simulation positions, hit windows, collision boxes and move duration remain data-driven.
      if (m.kind === 'combo' && ['brawler', 'bat', 'clownbot', 'kingpin'].includes(a) && m.hits.length) {
        const start = m.hits[0].start;
        const contact = Math.max(0, 1 - Math.abs(f.moveFrame - start) / 5);
        const wind = f.moveFrame < start ? Math.sin(Math.PI * Math.max(0, f.moveFrame) / Math.max(1, start)) : 0;
        p = { ...p, turn: contact * 0.65 - wind * 0.35,
          sR: p.sR - wind * 0.35, eR: p.eR + wind * 0.2, sL: p.sL + wind * 0.25, eL: p.eL + wind * 0.35,
          hipShift: p.hipShift + contact * 2.5 - wind * 1.5, lean: p.lean + contact * 0.06 - wind * 0.14,
          hR: p.hR + contact * 0.14, kR: p.kR - contact * 0.18, kL: p.kL - contact * 0.42 };
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

export interface Dims {
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

export interface V {
  x: number;
  y: number;
}

export interface Skeleton {
  hipY: number;
  turn: number;
  hip: V;
  hipL: V;
  hipR: V;
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
  const hip = { x: p.hipShift, y: hipY };
  const hipL = { x: hip.x -d.hipW * 0.3, y: hipY };
  const hipR = { x: hip.x +d.hipW * 0.3, y: hipY };
  const kneeL = add(hipL, dirv(p.hL), d.thigh);
  const footL = add(kneeL, dirv(p.hL + p.kL), d.shin);
  const kneeR = add(hipR, dirv(p.hR), d.thigh);
  const footR = add(kneeR, dirv(p.hR + p.kR), d.shin);
  const up = { x: Math.sin(p.lean), y: -Math.cos(p.lean) };
  const perp = { x: -up.y, y: up.x };
  const neck = add(hip, up, d.torso);
  const head = add(neck, { x: Math.sin(p.lean + p.head), y: -Math.cos(p.lean + p.head) }, d.neck);
  const sh = add(neck, up, -3);
  const shL = add(add(sh, perp, -d.chestW * 0.78 * (1 - Math.abs(p.turn) * 0.18)), up, p.turn * 2);
  const shR = add(add(sh, perp, d.chestW * 0.60 * (1 - Math.abs(p.turn) * 0.18)), up, -p.turn * 2);
  const elL = add(shL, dirv(p.sL), d.upper);
  const hdL = add(elL, dirv(p.sL + p.eL), d.fore);
  const elR = add(shR, dirv(p.sR), d.upper);
  const hdR = add(elR, dirv(p.sR + p.eR), d.fore);
  return { hipY, turn: p.turn, hip, hipL, hipR, kneeL, footL, kneeR, footR, neck, head, shL, shR, elL, hdL, elR, hdR, foreL: p.sL + p.eL, foreR: p.sR + p.eR, up, perp };
}

// ============================================================================ palettes

export interface Palette {
  [k: string]: string;
}

const PALETTES: Record<Archetype, Partial<Record<Variant, Palette>> & { normal: Palette }> = {
  ninja: {
    normal: { gi: '#303049', giDark: '#161724', gi2: '#666384', trim: '#8a4dff', scarf: '#6b2fd6', scarfTip: '#b48cff', skin: '#e0b48f', eye: '#d6b8ff', blade: '#e6ebff', glow: '#9d5cff', wrap: '#46287e', hilt: '#2a1f3a' },
    alt: { gi: '#e9e6f2', giDark: '#b7b1c9', gi2: '#ffffff', trim: '#d11a4a', scarf: '#c0102f', scarfTip: '#ff6b8b', skin: '#d9a57f', eye: '#ff6b8b', blade: '#fff0f0', glow: '#ff3b6b', wrap: '#7e1d33', hilt: '#3a1f24' },
    boss: { gi: '#302039', giDark: '#120b1b', gi2: '#73517f', trim: '#b066ff', scarf: '#7a1fe0', scarfTip: '#e0c4ff', skin: '#e0b48f', eye: '#ff4dff', blade: '#f2eaff', glow: '#c070ff', wrap: '#5a2aa0', hilt: '#2a1f3a' },
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
    boss: { shirt: '#493157', shirt2: '#281930', tee: '#0b090e', pants: '#30283b', pants2: '#16121f', cap: '#160b26', capBrim: '#2a1740', logo: '#b066ff', skin: '#d8c2b4', skinDark: '#b89a8a', glasses: '#0b090e', gold: '#dfe6f0', shoe: '#0b090e', sole: '#b066ff', mic: '#1c1c22', micHead: '#e0c4ff', micHead2: '#8a4dc0', ink: '#5a3a7a', beard: '#1a1018', mouth: '#5a2a2a', glow: '#b066ff' },
  },
  fiddler: {
    // Cream karate gi, indigo pants, black belt, red headband, chestnut ponytail, a maple fiddle and a rosin-glowing bow.
    normal: { gi: '#e9e2cc', giDark: '#bfb496', pants: '#2b3f5c', pants2: '#1c2a3e', belt: '#15121a', skin: '#d9a06c', skinDark: '#b07a4c', hair: '#4a2410', band: '#b8102e', wood: '#9a4e1c', woodDark: '#5c2a0e', strings: '#f3e9cc', bow: '#efe3c8', bowHair: '#fff8e0', frog: '#15121a', eye: '#2a1a10', mouth: '#6b3a2a', glow: '#ffb13b' },
    alt: { gi: '#1a1620', giDark: '#0d0b10', pants: '#1a1620', pants2: '#0d0b10', belt: '#ffd21f', skin: '#d9a06c', skinDark: '#b07a4c', hair: '#1a1010', band: '#f2eff5', wood: '#2a1a10', woodDark: '#0d0b10', strings: '#ffd21f', bow: '#d8d0c0', bowHair: '#ffffff', frog: '#ffd21f', eye: '#2a1a10', mouth: '#6b3a2a', glow: '#39f3ff' },
    // Shadow fiddler: ash-black gi, blood-red belt and headband, a charred fiddle strung with light.
    boss: { gi: '#4d3b4f', giDark: '#241a2d', pants: '#342738', pants2: '#19111f', belt: '#b8102e', skin: '#c9946a', skinDark: '#9a6a44', hair: '#1a1010', band: '#ff4d6d', wood: '#3a1a1a', woodDark: '#1a0a0a', strings: '#ff9ab0', bow: '#4a2a2a', bowHair: '#ff4d6d', frog: '#ff4d6d', eye: '#ff4d6d', mouth: '#6b3a2a', glow: '#ff4d6d' },
  },
  bat: {
    // Off-brand bat: grey suit, dark trunks, cowl, boots and gauntlets, dark cape, yellow belt and oval emblem.
    normal: { suit: '#5a6478', suit2: '#3c4457', trunks: '#1a1c26', cowl: '#1a1c26', cowl2: '#343a4e', cape: '#30354a', capeIn: '#1a1d2a', belt: '#ffd21f', emblem: '#ffd21f', emblemBat: '#1a1c26', skin: '#e6c2a4', mouth: '#6a3030', eye: '#f6f8ff', glow: '#ffd21f' },
    // Alt: Saturday-morning blue and grey.
    alt: { suit: '#8a93a8', suit2: '#5c657a', trunks: '#2a3f8a', cowl: '#2a3f8a', cowl2: '#4a63b8', cape: '#2a3f8a', capeIn: '#1a2a5e', belt: '#ffd21f', emblem: '#ffd21f', emblemBat: '#1a1c26', skin: '#e6c2a4', mouth: '#6a3030', eye: '#f6f8ff', glow: '#9fe8ff' },
    // Shadow bat: violet-black everything, pink-lit eyes.
    boss: { suit: '#493359', suit2: '#271833', trunks: '#0b090e', cowl: '#171020', cowl2: '#694576', cape: '#342541', capeIn: '#160b26', belt: '#b066ff', emblem: '#b066ff', emblemBat: '#0b090e', skin: '#c9a890', mouth: '#5a2a2a', eye: '#ff4dff', glow: '#b066ff' },
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

// ============================================================================ character artwork

type Ctx = CanvasRenderingContext2D;

export interface DrawOpts {
  tint: string | null;
  time: number;
  motion: number;
  /** Receives the blade tip & mid points in screen space when a weapon is drawn. */
  blade?: (tip: V, mid: V) => void;
  toScreen?: (p: V) => V;
}

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
    drawCharacterArt(ctx, arch, J, pose, d, pal, { tint, time, motion: Math.max(motion, Math.abs(pose.turn) * 0.7), blade: onBlade, toScreen });
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
   * Portraits use their native pixel grid and the same authored palette as gameplay characters.
   * `crop` picks between a chest-up framing and a tight head-and-shoulders bust; both anchor on the skull so
   * every archetype lands in the same spot regardless of leg or torso length.
   */
  drawPortrait(ctx: Ctx, arch: Archetype, variant: Variant, x: number, y: number, w: number, h: number, facing = 1, time = 0, crop: PortraitCrop = 'chest'): void {
    const bw = Math.max(1, Math.ceil(w));
    const bh = Math.max(1, Math.ceil(h));
    const buf = (this.portraitBuf ??= document.createElement('canvas'));
    if (buf.width < bw) buf.width = bw;
    if (buf.height < bh) buf.height = bh;
    const b = buf.getContext('2d', { willReadFrequently: true })!;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, bw, bh);
    b.setTransform(1, 0, 0, 1, 0, 0);
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
    ctx.drawImage(buf, 0, 0, bw, bh, x, y, bw, bh);
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
