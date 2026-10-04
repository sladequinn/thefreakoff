import { DEFAULT_Z_RANGE } from '../config/constants';
import type { CharacterDef, MoveData } from '../physics/Types';

const Z = DEFAULT_Z_RANGE;

/**
 * BATMAN (no relation): a tall, skinny, legally distinct caped vigilante. Long reach, floaty jumps and a
 * glide kick, with a thrown "not-a-rang" for zoning and an HP-cost rising uppercut as his reversal.
 */
const moves: Record<string, MoveData> = {
  b_combo1: {
    id: 'b_combo1',
    name: 'Justice Combo I — Gauntlet Jab',
    kind: 'combo',
    pose: 'bat_jab',
    duration: 16,
    cancelFrom: 6,
    hits: [
      {
        start: 3,
        end: 5,
        group: 1,
        boxes: [{ offsetX: 42, offsetY: 60, width: 58, height: 26, zRange: Z, damage: 5, knockbackX: 1.5, knockbackY: 0, hitstun: 9, hitstop: 4, spark: 'impact', sfx: 'light' }],
      },
    ],
    motion: [{ from: 1, to: 3, vx: 2.0 }],
    events: [{ frame: 2, fx: 'whiff' }],
  },
  b_combo2: {
    id: 'b_combo2',
    name: 'Justice Combo II — Cape Cross',
    kind: 'combo',
    pose: 'bat_cross',
    duration: 20,
    cancelFrom: 8,
    hits: [
      {
        start: 4,
        end: 6,
        group: 1,
        boxes: [{ offsetX: 46, offsetY: 58, width: 62, height: 30, zRange: Z, damage: 8, knockbackX: 2.4, knockbackY: 0, hitstun: 13, hitstop: 5, spark: 'impact', sfx: 'heavy' }],
      },
    ],
    motion: [{ from: 2, to: 5, vx: 2.6 }],
    events: [
      { frame: 3, fx: 'whiff' },
      { frame: 3, fx: 'voice_hah' },
    ],
  },
  b_combo3: {
    id: 'b_combo3',
    name: 'Justice Combo III — Knee of Justice (Trademark Pending)',
    kind: 'combo',
    pose: 'bat_knee',
    duration: 28,
    hits: [
      {
        start: 5,
        end: 8,
        group: 1,
        boxes: [{ offsetX: 32, offsetY: 60, width: 50, height: 70, zRange: Z, damage: 12, knockbackX: 3.5, knockbackY: 7, hitstun: 30, hitstop: 6, effect: 'launch', spark: 'impact', sfx: 'heavy' }],
      },
    ],
    motion: [
      { from: 3, to: 6, vx: 2.4 },
      { from: 5, to: 5, vy: 3.2 },
    ],
    events: [
      { frame: 4, fx: 'cape_snap' },
      { frame: 4, fx: 'voice_hyah' },
    ],
  },
  b_dash: {
    id: 'b_dash',
    name: 'Cape Slide',
    kind: 'dash',
    pose: 'bat_slide',
    duration: 34,
    hits: [
      {
        start: 4,
        end: 14,
        group: 1,
        boxes: [{ offsetX: 34, offsetY: 14, width: 70, height: 30, zRange: Z, damage: 10, knockbackX: 3, knockbackY: 3, hitstun: 28, hitstop: 5, effect: 'trip', spark: 'impact', sfx: 'heavy' }],
      },
    ],
    motion: [
      { from: 0, to: 3, vx: 4.6 },
      { from: 4, to: 14, vx: 5.2 },
    ],
    events: [
      { frame: 0, fx: 'cape_snap' },
      { frame: 3, fx: 'slide_dust' },
    ],
  },
  b_air: {
    id: 'b_air',
    name: 'Glide Kick',
    kind: 'air',
    pose: 'bat_glide',
    duration: 80,
    airborne: true,
    endsOnLand: true,
    landingLag: 10,
    onHitBounce: { vx: -2.0, vy: 5.5 },
    hits: [
      {
        start: 5,
        end: 80,
        group: 1,
        boxes: [{ offsetX: 24, offsetY: 14, width: 50, height: 34, zRange: Z, damage: 10, knockbackX: 4, knockbackY: 4.5, hitstun: 28, hitstop: 5, effect: 'launch', spark: 'impact', sfx: 'heavy' }],
      },
    ],
    motion: [
      // a beat of hang time with the cape spread, then a long shallow glide down
      { from: 0, to: 4, vx: 0.8, vy: 0.6, noGravity: true },
      { from: 5, to: 80, vx: 5.8, vy: -4.6, noGravity: true },
    ],
    events: [
      { frame: 4, fx: 'glide' },
      { frame: -1, fx: 'slide_dust' },
    ],
  },
  b_rang: {
    id: 'b_rang',
    name: 'Not-A-Rang',
    kind: 'special',
    pose: 'bat_throw',
    duration: 30,
    hits: [],
    events: [
      { frame: 2, fx: 'cape_snap' },
      { frame: 9, fx: 'rang' },
    ],
  },
  b_special: {
    id: 'b_special',
    name: 'Rising Cowl',
    kind: 'special',
    pose: 'bat_rise',
    duration: 90,
    invuln: [0, 10],
    endsOnLand: true,
    landingLag: 18,
    hpCost: 0.08,
    hits: [
      {
        start: 4,
        end: 13,
        group: 1,
        boxes: [{ offsetX: 24, offsetY: 60, width: 56, height: 96, zRange: Z, damage: 20, knockbackX: 3, knockbackY: 8.5, hitstun: 40, hitstop: 7, effect: 'launch', spark: 'shock', sfx: 'heavy' }],
      },
    ],
    motion: [
      { from: 0, to: 2, vx: 0.4 },
      { from: 3, to: 3, vx: 2.2, vy: 9.4 },
    ],
    events: [
      { frame: 0, fx: 'cowl_charge' },
      { frame: 3, fx: 'cowl_rise' },
    ],
  },
};

export const BATMAN: CharacterDef = {
  id: 'batman',
  name: 'BATMAN',
  title: 'No Relation',
  archetype: 'bat',
  voice: 'batman',
  stats: { speed: 4.3, maxHp: 105, defense: 0.95, jumpPower: 9.3 },
  combo: ['b_combo1', 'b_combo2', 'b_combo3'],
  dashAttack: 'b_dash',
  airAttack: 'b_air',
  special: 'b_special',
  backAttack: 'b_rang',
  moves,
  hurtbox: { offsetX: 0, offsetY: 52, width: 28, height: 104, zDepth: 14 },
  scale: 1.06,
  blurb: 'Tall, skinny, legally distinct caped vigilante. Long reach, a glide kick, a thrown not-a-rang and a rising cowl uppercut. No relation.',
  ratings: { power: 3, speed: 4, range: 5, defense: 2 },
  winQuotes: [
    "I'm... Batman. No relation.",
    'Justice. Or something adjacent to it.',
    'The night is mine. Weekdays only.',
    'Tell your friends. Spell it however you want.',
  ],
  winQuotesVs: {
    slade: ['Smoke bombs? Cute. I have a budget version too.', 'I was the shadow before you were, legally speaking.'],
    freckles: ['Clowns. Why is it always clowns.', 'Dry your eyes. I know a guy who deals with your type.'],
    whitelie: ['Big man, slow swing. I had a whole minute to pose.', "You've got the chains. I've got the cape. Cape wins."],
    fiddlejay: ['Nice tune. The bat signal is louder.', 'I brought a rang to a fiddle fight and still won.'],
    righteous: ['I do not do churches. I do rooftops.', 'Your light is a streetlamp. Sit down.'],
    batman: ['There can only be one. Legally, there are at least two.'],
  },
  moveList: [
    { name: 'Justice Combo', input: 'J, J, J', desc: 'Gauntlet jab → cape cross → launching Knee of Justice (trademark pending)' },
    { name: 'Cape Slide', input: 'Run + J', desc: 'Long tripping slide under the cape' },
    { name: 'Glide Kick', input: 'Air + J', desc: 'Hang in the air, then glide down with a launching kick' },
    { name: 'Not-A-Rang', input: 'Away + J', desc: 'Throw a bat-shaped something that curves after its target' },
    { name: 'Rising Cowl', input: 'U', desc: 'Invulnerable rising uppercut (costs 8% HP)' },
  ],
};
