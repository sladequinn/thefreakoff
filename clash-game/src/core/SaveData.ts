import type { CpuDifficulty } from '../config/stages';
import type { CharId, StoryCharId } from '../physics/Types';

const KEY = 'freakoff.save.v1';

export interface SavedSettings {
  cpuDifficulty: CpuDifficulty;
  musicOn: boolean;
  sfxOn: boolean;
  rumble: boolean;
}

export interface SavedRecords {
  storyHigh: Partial<Record<StoryCharId, number>>;
  storyClears: Partial<Record<StoryCharId, number>>;
  bestCombo: number;
  vsWins: Partial<Record<CharId, number>>;
  vsMatches: number;
}

export interface SaveState {
  version: 1;
  settings: SavedSettings;
  records: SavedRecords;
  unlocks: { alt: CharId[] };
}

const DEFAULTS: SaveState = {
  version: 1,
  settings: { cpuDifficulty: 'normal', musicOn: true, sfxOn: true, rumble: true },
  records: { storyHigh: {}, storyClears: {}, bestCombo: 0, vsWins: {}, vsMatches: 0 },
  unlocks: { alt: [] },
};

/** Thin localStorage wrapper; every write is best-effort so private browsing or quota errors never break play. */
export class SaveData {
  state: SaveState;
  readonly available: boolean;

  constructor() {
    this.available = SaveData.probe();
    this.state = this.load();
  }

  private static probe(): boolean {
    try {
      const k = '__freakoff_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  private load(): SaveState {
    if (!this.available) return structuredClone(DEFAULTS);
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      return {
        version: 1,
        settings: { ...DEFAULTS.settings, ...(parsed.settings ?? {}) },
        records: { ...structuredClone(DEFAULTS.records), ...(parsed.records ?? {}) },
        unlocks: { alt: Array.isArray(parsed.unlocks?.alt) ? parsed.unlocks.alt : [] },
      };
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  save(): void {
    if (!this.available) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* quota or private mode: ignore */
    }
  }

  get settings(): SavedSettings {
    return this.state.settings;
  }

  get records(): SavedRecords {
    return this.state.records;
  }

  isAltUnlocked(id: CharId): boolean {
    return this.state.unlocks.alt.includes(id);
  }

  /** Returns true when the costume was newly unlocked by this call. */
  unlockAlt(id: CharId): boolean {
    if (this.isAltUnlocked(id)) return false;
    this.state.unlocks.alt.push(id);
    this.save();
    return true;
  }

  /** Records a story run. Returns which milestones were new so the results screen can call them out. */
  recordStory(char: StoryCharId, score: number, combo: number, cleared: boolean): { highScore: boolean; combo: boolean; alt: boolean } {
    const r = this.state.records;
    const prev = r.storyHigh[char] ?? 0;
    const highScore = score > prev;
    if (highScore) r.storyHigh[char] = score;
    const comboBest = combo > r.bestCombo;
    if (comboBest) r.bestCombo = combo;
    let alt = false;
    if (cleared) {
      r.storyClears[char] = (r.storyClears[char] ?? 0) + 1;
      alt = this.unlockAlt(char);
    }
    this.save();
    return { highScore, combo: comboBest, alt };
  }

  /** Records a versus match; winning a CPU match unlocks the winner's alt costume. */
  recordVs(winner: CharId | null, combo: number, vsCpu: boolean): { combo: boolean; alt: boolean } {
    const r = this.state.records;
    r.vsMatches++;
    const comboBest = combo > r.bestCombo;
    if (comboBest) r.bestCombo = combo;
    let alt = false;
    if (winner) {
      r.vsWins[winner] = (r.vsWins[winner] ?? 0) + 1;
      if (vsCpu) alt = this.unlockAlt(winner);
    }
    this.save();
    return { combo: comboBest, alt };
  }
}
