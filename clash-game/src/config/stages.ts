import type { StageTheme } from '../rendering/Renderer';

export interface StageInfo {
  name: string;
  tagline: string;
  /** Sky gradient and ground tone for the stage-select thumbnail. */
  sky: [string, string];
  ground: string;
  accent: string;
}

export const STAGE_ORDER: StageTheme[] = ['outskirts', 'harbor', 'facility', 'rooftop', 'foundry', 'sanctuary'];

export const STAGE_INFO: Record<StageTheme, StageInfo> = {
  outskirts: { name: 'THE OUTSKIRTS', tagline: 'Dust, chain-link and a dying sunset.', sky: ['#2a1038', '#ff7a3a'], ground: '#4a3a2e', accent: '#ff9a5a' },
  harbor: { name: 'HARBOR', tagline: 'Sea spray and sodium lamps on the docks.', sky: ['#061224', '#1a4a6e'], ground: '#28323a', accent: '#5ac8ff' },
  facility: { name: 'THE FACILITY', tagline: 'Where the bots are stamped out.', sky: ['#0a0e14', '#1e2a36'], ground: '#2a2e36', accent: '#ffe38a' },
  rooftop: { name: 'ROOFTOP', tagline: 'Neon skyline, no railings.', sky: ['#0a0618', '#3a1a66'], ground: '#241a30', accent: '#ff4dd2' },
  foundry: { name: 'THE FOUNDRY', tagline: 'Molten steel and falling embers.', sky: ['#1a0604', '#6a1a0a'], ground: '#3a1a10', accent: '#ff6a2a' },
  sanctuary: { name: 'THE SANCTUARY', tagline: 'Petals drift through the final temple.', sky: ['#120a2a', '#4a2a7a'], ground: '#2a2440', accent: '#f29ac4' },
};

export type StagePick = StageTheme | 'random';

export function resolveStage(pick: StagePick | undefined): StageTheme {
  if (pick && pick !== 'random') return pick;
  return STAGE_ORDER[Math.floor(Math.random() * STAGE_ORDER.length)];
}

/** The stage after `current` in the tour order; used by the "next stage" rematch option. */
export function nextStage(current: StageTheme): StageTheme {
  return STAGE_ORDER[(STAGE_ORDER.indexOf(current) + 1) % STAGE_ORDER.length];
}

export type CpuDifficulty = 'easy' | 'normal' | 'hard';

export const CPU_DIFFICULTY: Record<CpuDifficulty, { label: string; value: number; desc: string }> = {
  easy: { label: 'EASY', value: 0.6, desc: 'Slow reactions, rarely punishes.' },
  normal: { label: 'NORMAL', value: 0.85, desc: 'Blocks, punishes and reads habits.' },
  hard: { label: 'HARD', value: 1.1, desc: 'Master-level reads and juggles.' },
};

export const CPU_DIFFICULTIES: CpuDifficulty[] = ['easy', 'normal', 'hard'];
