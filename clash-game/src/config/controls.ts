export type Action = 'up' | 'down' | 'left' | 'right' | 'jump' | 'attack' | 'special' | 'block' | 'tag';

export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'jump', 'attack', 'special', 'block', 'tag'];

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
  block: ['KeyH', 'ShiftLeft'],
  tag: ['KeyI'],
};

export const P2_KEYS: KeyBindings = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['Numpad2', 'Period'],
  attack: ['Numpad1', 'Comma'],
  special: ['Numpad4', 'KeyL'],
  block: ['Numpad0', 'Slash'],
  tag: ['Numpad5', 'Semicolon'],
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
  special: [PAD.Y, PAD.RT],
  block: [PAD.B, PAD.LT],
  tag: [PAD.LB, PAD.RB],
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
  'Numpad5',
  'Numpad0',
  'Period',
  'Comma',
  'Slash',
  'Backspace',
]);

export const TOUCH_HELP: { label: string; how: string }[] = [
  { label: 'Move', how: 'Drag anywhere on the left side (the stick follows your thumb)' },
  { label: 'Run / Dash', how: 'Push the stick all the way sideways, or flick it twice' },
  { label: 'Jump', how: 'JMP button; press ATK any time after for an air attack' },
  { label: 'Attack', how: 'ATK button (tap repeatedly for combos; ATK while running for a dash attack)' },
  { label: 'Block', how: 'Hold BLK; works in every mode, but attacks from behind still land' },
  { label: 'Parry', how: 'Tap BLK just before a hit lands: no chip damage and a free counter' },
  { label: 'Special', how: 'SPL button (costs 8% HP)' },
  { label: 'Tag (Tag Team)', how: 'TAG button while standing; your partner jumps in' },
  { label: 'Pause / Mute', how: 'II and \u266A buttons in the top-right corner, clear of the pad' },
];

export const CONTROL_HELP: { label: string; p1: string; p2: string; pad: string }[] = [
  { label: 'Move', p1: 'W A S D', p2: 'Arrow Keys', pad: 'D-Pad / Left Stick' },
  { label: 'Dash / Run', p1: 'Double-tap A / D', p2: 'Double-tap ← / →', pad: 'Double-tap left / right' },
  { label: 'Jump', p1: 'K / Space', p2: 'Numpad 2 / .', pad: 'A (South)' },
  { label: 'Attack', p1: 'J', p2: 'Numpad 1 / ,', pad: 'X (West)' },
  { label: 'Block / Parry', p1: 'H / Left Shift', p2: 'Numpad 0 / /', pad: 'B (East) / LT' },
  { label: 'Special', p1: 'U', p2: 'Numpad 4 / L', pad: 'Y (North) / RT' },
  { label: 'Tag (Tag Team)', p1: 'I', p2: 'Numpad 5 / ;', pad: 'LB / RB' },
  { label: 'Pause', p1: 'Esc / P', p2: '—', pad: 'Start' },
  { label: 'Debug / Mute', p1: '`  /  M', p2: '—', pad: '—' },
];
