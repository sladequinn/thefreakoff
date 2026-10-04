import { DEFAULT_Z_RANGE } from '../config/constants';
import type { CharacterDef, MoveData } from '../physics/Types';

const Z = DEFAULT_Z_RANGE;

/**
 * RIGHTEOUS: a street-preaching bishop. Cassock, pectoral cross, mitre. He swings the crozier like a polearm,
 * plants it as a staff and calls down a radial blessing that is not, strictly speaking, a blessing.
 */
const moves: Record<string, MoveData> = {
  r_combo1: {
    id: 'r_combo1',
    name: 'Liturgy I — Crozier Tap',
    kind: 'combo',
    pose: 'ri_tap',
    duration: 18,
    cancelFrom: 6,
    hits: [
      {
        start: 4,
        end: 6,
        group: 1,
        boxes: [{ offsetX: 42, offsetY: 58, width: 64, height: 28, zRange: Z, damage: 6, knockbackX: 1.6, knockbackY: 0, hitstun: 9, hitstop: 4, spark: 'impact', sfx: 'light' }],
      },
    ],
    motion: [{ from: 2, to: 5, vx: 1.8 }],
    events: [{ frame: 3, fx: 'crozier_tap' }],
  },
  r_combo2: {
    id: 'r_combo2',
    name: 'Liturgy II — Mitre Butt',
    kind: 'combo',
    pose: 'ri_butt',
    duration: 20,
    cancelFrom: 8,
    hits: [
      {
        start: 5,
        end: 7,
        group: 1,
        boxes: [{ offsetX: 36, offsetY: 62, width: 48, height: 36, zRange: Z, damage: 8, knockbackX: 2.2, knockbackY: 0, hitstun: 12, hitstop: 5, spark: 'impact', sfx: 'heavy' }],
      },
    ],
    motion: [{ from: 3, to: 6, vx: 2.4 }],
    events: [
      { frame: 4, fx: 'whiff' },
      { frame: 4, fx: 'voice_hah' },
    ],
  },
  r_combo3: {
    id: 'r_combo3',
    name: 'Liturgy III — High Mass Sweep',
    kind: 'combo',
    pose: 'ri_sweep',
    duration: 32,
    hits: [
      {
        start: 8,
        end: 12,
        group: 1,
        boxes: [{ offsetX: 36, offsetY: 52, width: 86, height: 70, zRange: Z, damage: 13, knockbackX: 4.5, knockbackY: 6.5, hitstun: 32, hitstop: 6, effect: 'launch', spark: 'void', sfx: 'heavy' }],
      },
    ],
    motion: [{ from: 6, to: 10, vx: 2.0 }],
    events: [
      { frame: 7, fx: 'crozier_arc' },
      { frame: 7, fx: 'voice_hyah' },
    ],
  },
  r_dash: {
    id: 'r_dash',
    name: 'Procession',
    kind: 'dash',
    pose: 'ri_process',
    duration: 36,
    hits: [
      {
        start: 5,
        end: 16,
        group: 1,
        boxes: [{ offsetX: 32, offsetY: 48, width: 58, height: 70, zRange: Z, damage: 11, knockbackX: 4, knockbackY: 3, hitstun: 26, hitstop: 5, effect: 'knockdown', spark: 'impact', sfx: 'heavy' }],
      },
    ],
    motion: [
      { from: 0, to: 4, vx: 3.6 },
      { from: 5, to: 16, vx: 4.4 },
    ],
    events: [
      { frame: 0, fx: 'crozier_tap' },
      { frame: 4, fx: 'slide_dust' },
    ],
  },
  r_air: {
    id: 'r_air',
    name: 'Falling Grace',
    kind: 'air',
    pose: 'ri_dive',
    duration: 70,
    airborne: true,
    endsOnLand: true,
    landingLag: 14,
    hits: [
      {
        start: 6,
        end: 70,
        group: 1,
        boxes: [{ offsetX: 20, offsetY: 8, width: 48, height: 40, zRange: Z, damage: 12, knockbackX: 3, knockbackY: 4, hitstun: 28, hitstop: 6, effect: 'knockdown', spark: 'void', sfx: 'heavy' }],
      },
    ],
    motion: [
      { from: 0, to: 5, vx: 0.4, vy: 0.8, noGravity: true },
      { from: 6, to: 70, vx: 3.2, vy: -8.8, noGravity: true },
    ],
    events: [
      { frame: 5, fx: 'crozier_dive' },
      { frame: -1, fx: 'slide_dust' },
    ],
  },
  r_special: {
    id: 'r_special',
    name: 'Absolution',
    kind: 'special',
    pose: 'ri_absolve',
    duration: 64,
    invuln: [0, 14],
    hpCost: 0.08,
    hits: [
      {
        start: 16,
        end: 28,
        group: 1,
        boxes: [
          {
            offsetX: 0,
            offsetY: 52,
            width: 230,
            height: 130,
            zRange: 50,
            damage: 22,
            knockbackX: 7,
            knockbackY: 6.5,
            hitstun: 40,
            hitstop: 7,
            effect: 'launch',
            spark: 'void',
            sfx: 'magic',
            radial: true,
          },
        ],
      },
    ],
    events: [
      { frame: 0, fx: 'absolve_charge' },
      { frame: 15, fx: 'absolve' },
    ],
  },
};

export const RIGHTEOUS: CharacterDef = {
  id: 'righteous',
  name: 'RIGHTEOUS',
  title: 'The Street Bishop',
  archetype: 'bishop',
  voice: 'righteous',
  stats: { speed: 3.6, maxHp: 125, defense: 1.15, jumpPower: 7.4 },
  combo: ['r_combo1', 'r_combo2', 'r_combo3'],
  dashAttack: 'r_dash',
  airAttack: 'r_air',
  special: 'r_special',
  moves,
  hurtbox: { offsetX: 0, offsetY: 50, width: 34, height: 100, zDepth: 15 },
  scale: 1.08,
  blurb: 'Street-preaching bishop in a cassock and mitre. Long crozier reach, a processional charge and a radial Absolution that is not, strictly speaking, a blessing.',
  ratings: { power: 4, speed: 3, range: 5, defense: 4 },
  winQuotes: [
    'Go in peace. Or stay down. Either is holy.',
    'I absolve you. Of the W.',
    'The crozier is longer than your argument.',
    'Blessed are the meek. You qualified.',
  ],
  winQuotesVs: {
    slade: ['Shadows bow to the light. Yours just blinked.', 'A ninja at mass. Sit in the back.'],
    freckles: ['Dry your eyes, child. Confession is over.', 'Bells? I have a whole cathedral.'],
    whitelie: ['Platinum does not buy indulgences.', 'Big man, small soul. I kept the receipt.'],
    fiddlejay: ['A fiddle in the nave. Charming. Out of tune.', 'The devil already went down. You followed.'],
    batman: ['No relation? No parish either.', 'A cape is not vestments. Kneel.'],
    righteous: ['Only one of us read the book.'],
  },
  moveList: [
    { name: 'Liturgy', input: 'J, J, J', desc: 'Crozier tap → mitre butt → launching High Mass sweep' },
    { name: 'Procession', input: 'Run + J', desc: 'Shoulder-first charge with the crozier planted like a banner' },
    { name: 'Falling Grace', input: 'Air + J', desc: 'Dive with the crozier tip first; hard knockdown on land' },
    { name: 'Absolution', input: 'U', desc: 'Invulnerable radial blessing that launches (costs 8% HP)' },
  ],
};
