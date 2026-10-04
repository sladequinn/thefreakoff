import type { CharId } from '../physics/Types';
import type { StageTheme } from '../rendering/Renderer';
import { STAGE_ORDER } from './stages';
import { VS_ROSTER } from '../characters';

/** State carried from match to match through an arcade run. */
export interface ArcadeRun {
  /** Opponents in order; the last entry is always the player's own character as the boss-variant finale. */
  ladder: CharId[];
  /** Index of the match about to be (or being) played. */
  index: number;
  score: number;
  continues: number;
  /** Stage the ladder started on; later matches walk the stage tour from here. */
  startStage: StageTheme;
}

/** CPU strength per rung. The finale is above the regular HARD setting. */
export const ARCADE_DIFFICULTY = [0.6, 0.8, 1.0, 1.25];
/** HP multiplier for the mirror-match boss on the final rung. */
export const ARCADE_BOSS_HP = 1.2;
export const ARCADE_CONTINUES = 3;

export const ARCADE_RUNG_LABEL = ['WARM-UP', 'CONTENDER', 'CHALLENGER', 'FINAL BOSS'];

export function arcadeLadder(player: CharId): CharId[] {
  const others = VS_ROSTER.filter((id) => id !== player);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return [...others, player];
}

export function newArcadeRun(player: CharId, startStage: StageTheme): ArcadeRun {
  return { ladder: arcadeLadder(player), index: 0, score: 0, continues: ARCADE_CONTINUES, startStage };
}

/** The finale always happens in the Sanctuary; earlier rungs tour the other stages from the start pick. */
export function arcadeStage(run: ArcadeRun): StageTheme {
  if (run.index >= run.ladder.length - 1) return 'sanctuary';
  const tour: StageTheme[] = STAGE_ORDER.filter((s) => s !== 'sanctuary');
  const start = Math.max(0, tour.indexOf(run.startStage));
  return tour[(start + run.index) % tour.length];
}

export function isArcadeFinal(run: ArcadeRun): boolean {
  return run.index === run.ladder.length - 1;
}

/** Points for one match win: base per rung, bonus for health left, perfects and speed. */
export function arcadeMatchScore(run: ArcadeRun, hpLeftRatio: number, roundsLost: number, perfectRounds: number, secondsLeft: number): number {
  const base = 1000 * (run.index + 1);
  const health = Math.round(hpLeftRatio * 800);
  const perfect = perfectRounds * 1500;
  const speed = Math.round(secondsLeft * 8);
  const penalty = roundsLost * 300;
  return Math.max(100, base + health + perfect + speed - penalty);
}
