export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;

export const FIXED_FPS = 60;
export const FIXED_STEP_MS = 1000 / FIXED_FPS;
export const MAX_STEPS_PER_FRAME = 5;

/** Ground depth band (lower z = further back). With camera.y = 0, z is also the screen Y of a grounded foot. */
export const STAGE_MIN_Z = 336;
export const STAGE_MAX_Z = 512;
export const HORIZON_Y = 320;

export const GRAVITY = 0.42;
export const JUGGLE_GRAVITY_STEP = 0.035;
export const GROUND_FRICTION = 0.78;
export const AIR_CONTROL = 0.12;
export const DEPTH_SPEED_FACTOR = 0.62;
export const RUN_MULTIPLIER = 1.75;

export const DEFAULT_Z_RANGE = 14;
export const DOUBLE_TAP_WINDOW = 14;
export const SIMULTANEOUS_PRESS_WINDOW = 3;
export const PREJUMP_FRAMES = 3;
export const LAND_FRAMES = 5;
export const KNOCKDOWN_FRAMES = 42;
export const HARD_KNOCKDOWN_FRAMES = 64;
export const WAKEUP_FRAMES = 20;
export const SUBSTITUTE_FRAMES = 22;
export const SPECIAL_HP_COST = 0.08;
export const LIGHT_HIT_THRESHOLD = 10;

export const COMBO_SCALING_STEP = 0.1;
export const COMBO_SCALING_MIN = 0.4;
export const CHIP_DAMAGE = 0.12;

export const STORY_LIVES = 3;
export const RESPAWN_INVULN = 120;
export const STAGE_CLEAR_HEAL = 0.35;
export const BOSS_HP_MULT = 1.8;

export const VS_ROUND_SECONDS = 99;
export const VS_ROUNDS_TO_WIN = 2;
export const VS_ARENA_MARGIN = 40;

export const PARTICLE_POOL_SIZE = 900;

export const TEAM_PLAYER = 0 as const;
export const TEAM_ENEMY = 1 as const;

export const COLORS = {
  void: '#8a4dff',
  voidDeep: '#3b1580',
  voidGlow: '#c79bff',
  ember: '#ff6a2a',
  brass: '#ffc857',
  cyan: '#39f3ff',
  hazard: '#ffd21f',
  blood: '#c4122f',
  oil: '#1a1612',
  hudBg: 'rgba(8, 6, 18, 0.72)',
  hpFill: '#f5d547',
  hpLow: '#ff3b3b',
  hpLag: '#ffffff',
  debugHit: 'rgba(255, 40, 40, 0.9)',
  debugHurt: 'rgba(40, 255, 90, 0.9)',
  debugZ: 'rgba(60, 140, 255, 0.85)',
};

export const FONT_DISPLAY = "400 {size}px 'Press Start 2P', 'Arial Black', Impact, sans-serif";
export const FONT_UI = "400 {size}px 'VT323', 'Courier New', ui-monospace, monospace";
export const FONT_MONO = "400 {size}px 'VT323', 'Courier New', ui-monospace, monospace";

/**
 * Layout sizes were authored against Arial Black / Trebuchet metrics. Press Start 2P glyphs are a full em wide
 * and VT323 is narrow with a small x-height, so each face is rescaled to occupy roughly the same box.
 */
const FONT_SCALE = new Map<string, number>([
  [FONT_DISPLAY, 0.72],
  [FONT_UI, 1.32],
  [FONT_MONO, 1.3],
]);

export function font(template: string, size: number): string {
  return template.replace('{size}', String(Math.max(6, Math.round(size * (FONT_SCALE.get(template) ?? 1)))));
}

/** Internal resolution of the pixelated world layer (UI stays at CANVAS_WIDTH x CANVAS_HEIGHT). */
export const PIXEL_WIDTH = 480;
export const PIXEL_HEIGHT = 270;
