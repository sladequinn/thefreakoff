export type Action = 'up' | 'down' | 'left' | 'right' | 'jump' | 'attack' | 'special';

export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'jump', 'attack', 'special'];

export type KeyBindings = Record<Action, string[]>;

/** KeyboardEvent.code values. */
export const P1_KEYS: KeyBindings = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['KeyK', 'Space'],
  attack: ['KeyJ'],
  special: ['KeyU'],
};

export const P2_KEYS: KeyBindings = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['Numpad2', 'Period'],
  attack: ['Numpad1', 'Comma'],
  special: ['Numpad4', 'KeyL'],
};

/** Standard Gamepad mapping indices. */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

export const PAD_BINDINGS: Record<Action, number[]> = {
  up: [PAD.DPAD_UP],
  down: [PAD.DPAD_DOWN],
  left: [PAD.DPAD_LEFT],
  right: [PAD.DPAD_RIGHT],
  jump: [PAD.A],
  attack: [PAD.X],
  special: [PAD.Y, PAD.LT, PAD.RT],
};

export const PAD_DEADZONE = 0.35;

export const MENU_CONFIRM_KEYS = ['Enter', 'NumpadEnter', 'Space', 'KeyJ'];
export const MENU_BACK_KEYS = ['Escape', 'Backspace'];
export const PAUSE_KEYS = ['Escape', 'KeyP'];
export const DEBUG_KEY = 'Backquote';
export const MUTE_KEY = 'KeyM';

/** Keys whose default browser behaviour (scrolling, etc.) must be suppressed. */
export const PREVENT_DEFAULT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Backquote',
  'Numpad1',
  'Numpad2',
  'Numpad4',
  'Period',
  'Comma',
  'Backspace',
]);

export const CONTROL_HELP: { label: string; p1: string; p2: string; pad: string }[] = [
  { label: 'Move', p1: 'W A S D', p2: 'Arrow Keys', pad: 'D-Pad / Left Stick' },
  { label: 'Dash / Run', p1: 'Double-tap A / D', p2: 'Double-tap ← / →', pad: 'Double-tap left / right' },
  { label: 'Jump', p1: 'K / Space', p2: 'Numpad 2 / .', pad: 'A (South)' },
  { label: 'Attack', p1: 'J', p2: 'Numpad 1 / ,', pad: 'X (West)' },
  { label: 'Special', p1: 'U  or  J + K', p2: 'Numpad 4 / L', pad: 'Y (North) / Triggers' },
  { label: 'Block (Versus)', p1: 'Hold away', p2: 'Hold away', pad: 'Hold away' },
  { label: 'Pause', p1: 'Esc / P', p2: '—', pad: 'Start' },
  { label: 'Debug / Mute', p1: '`  /  M', p2: '—', pad: '—' },
];
