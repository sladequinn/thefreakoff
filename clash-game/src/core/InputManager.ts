import {
  ACTIONS,
  DEBUG_KEY,
  MENU_BACK_KEYS,
  MENU_CONFIRM_KEYS,
  MUTE_KEY,
  P1_KEYS,
  P2_KEYS,
  PAD,
  PAD_BINDINGS,
  PAD_DEADZONE,
  PAUSE_KEYS,
  PREVENT_DEFAULT_KEYS,
  type Action,
  type KeyBindings,
} from '../config/controls';
import { DOUBLE_TAP_WINDOW, SIMULTANEOUS_PRESS_WINDOW } from '../config/constants';
import { emptyInput, type InputFrame } from '../physics/Types';

type ActionMap = Record<Action, boolean>;

function blankActions(): ActionMap {
  return { up: false, down: false, left: false, right: false, jump: false, attack: false, special: false };
}

interface SlotState {
  keys: KeyBindings;
  padIndex: number;
  held: ActionMap;
  prev: ActionMap;
  pressed: ActionMap;
  padStart: boolean;
  padStartPrev: boolean;
  padBack: boolean;
  padBackPrev: boolean;
  lastTapFrame: { left: number; right: number };
  runDir: number;
  dashDir: number;
  lastAttackPress: number;
  lastJumpPress: number;
  touchRun: boolean;
  comboSpecialLatched: boolean;
  specialFromCombo: boolean;
  frame: InputFrame;
}

export interface MenuInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}

export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
}

/**
 * Keyboard + Gamepad + on-screen touch aggregation into two logical player slots (touch always drives slot 0).
 * Presses are latched between fixed updates so sub-frame taps are never dropped.
 */
export class InputManager {
  private held = new Set<string>();
  private pressedQueue = new Set<string>();
  private pressedNow = new Set<string>();
  private frameNo = 0;
  private slots: SlotState[];
  private padsPrev: boolean[][] = [[], []];
  private touchHeld = blankActions();
  private touchLatched = blankActions();
  private touchRun = false;
  private touchPoked = false;
  anyInputThisFrame = false;
  lastDevice: InputDevice = isTouchDevice() ? 'touch' : 'keyboard';

  get touchMode(): boolean {
    return this.lastDevice === 'touch';
  }

  setTouchAction(action: Action, down: boolean): void {
    if (down && !this.touchHeld[action]) this.touchLatched[action] = true;
    this.touchHeld[action] = down;
    if (down) this.lastDevice = 'touch';
  }

  setTouchRun(run: boolean): void {
    this.touchRun = run;
  }

  /** Any touch on the control surface; counts as "any input" for press-start screens. */
  touchPoke(): void {
    this.touchPoked = true;
    this.lastDevice = 'touch';
  }

  /** Queues a synthetic key press (used by on-screen pause / mute buttons). */
  injectKey(code: string): void {
    this.pressedQueue.add(code);
  }

  constructor(target: Window = window) {
    this.slots = [this.makeSlot(P1_KEYS, 0), this.makeSlot(P2_KEYS, 1)];
    target.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressedQueue.add(e.code);
      this.held.add(e.code);
      this.lastDevice = 'keyboard';
    });
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    target.addEventListener('blur', () => {
      this.held.clear();
    });
  }

  private makeSlot(keys: KeyBindings, padIndex: number): SlotState {
    return {
      keys,
      padIndex,
      held: blankActions(),
      prev: blankActions(),
      pressed: blankActions(),
      padStart: false,
      padStartPrev: false,
      padBack: false,
      padBackPrev: false,
      lastTapFrame: { left: -999, right: -999 },
      runDir: 0,
      dashDir: 0,
      lastAttackPress: -999,
      lastJumpPress: -999,
      touchRun: false,
      comboSpecialLatched: false,
      specialFromCombo: false,
      frame: emptyInput(),
    };
  }

  private getPads(): (Gamepad | null)[] {
    const raw = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pads: Gamepad[] = [];
    for (const p of raw) if (p && p.connected) pads.push(p);
    return pads;
  }

  update(): void {
    this.frameNo++;
    this.pressedNow = this.pressedQueue;
    this.pressedQueue = new Set();
    this.anyInputThisFrame = this.pressedNow.size > 0 || this.touchPoked;
    this.touchPoked = false;

    const pads = this.getPads();
    this.slots.forEach((slot, slotIndex) => {
      slot.prev = slot.held;
      const held = blankActions();
      const pressed = blankActions();
      for (const a of ACTIONS) {
        for (const code of slot.keys[a]) {
          if (this.held.has(code)) held[a] = true;
          if (this.pressedNow.has(code)) {
            held[a] = true;
            pressed[a] = true;
          }
        }
      }
      slot.touchRun = false;
      if (slotIndex === 0) {
        for (const a of ACTIONS) {
          if (this.touchHeld[a]) held[a] = true;
          if (this.touchLatched[a]) {
            held[a] = true;
            pressed[a] = true;
            this.anyInputThisFrame = true;
            this.touchLatched[a] = false;
          }
        }
        slot.touchRun = this.touchRun;
      }

      const pad = pads[slot.padIndex] ?? null;
      slot.padStartPrev = slot.padStart;
      slot.padBackPrev = slot.padBack;
      slot.padStart = false;
      slot.padBack = false;
      if (pad) {
        const prevButtons = this.padsPrev[slot.padIndex] ?? [];
        const now: boolean[] = [];
        for (let i = 0; i < pad.buttons.length; i++) now[i] = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        const stick: ActionMap = blankActions();
        stick.left = ax < -PAD_DEADZONE;
        stick.right = ax > PAD_DEADZONE;
        stick.up = ay < -PAD_DEADZONE;
        stick.down = ay > PAD_DEADZONE;
        for (const a of ACTIONS) {
          let padHeld = stick[a];
          let padPressed = false;
          for (const b of PAD_BINDINGS[a]) {
            if (now[b]) padHeld = true;
            if (now[b] && !prevButtons[b]) padPressed = true;
          }
          if (padHeld) {
            held[a] = true;
            this.lastDevice = 'gamepad';
          }
          if (padPressed) {
            pressed[a] = true;
            this.anyInputThisFrame = true;
          }
        }
        slot.padStart = !!now[PAD.START];
        slot.padBack = !!now[PAD.B];
        this.padsPrev[slot.padIndex] = now;
      }

      for (const a of ACTIONS) {
        if (held[a] && !slot.prev[a]) pressed[a] = true;
      }
      slot.held = held;
      slot.pressed = pressed;
      this.buildFrame(slot);
    });
  }

  private buildFrame(slot: SlotState): void {
    const f = slot.frame;
    const { held, pressed } = slot;
    f.moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    f.moveZ = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    f.jump = held.jump;
    f.dashDir = 0;

    for (const dir of ['left', 'right'] as const) {
      if (pressed[dir]) {
        const sign = dir === 'left' ? -1 : 1;
        if (this.frameNo - slot.lastTapFrame[dir] <= DOUBLE_TAP_WINDOW) {
          slot.runDir = sign;
          f.dashDir = sign;
          slot.lastTapFrame[dir] = -999;
        } else {
          slot.lastTapFrame[dir] = this.frameNo;
        }
      }
    }
    if (slot.runDir !== 0 && f.moveX !== slot.runDir) slot.runDir = 0;
    f.run = slot.runDir !== 0 || (slot.touchRun && f.moveX !== 0);

    if (pressed.attack) slot.lastAttackPress = this.frameNo;
    if (pressed.jump) slot.lastJumpPress = this.frameNo;
    let comboSpecial = false;
    if ((pressed.attack || pressed.jump) && !slot.comboSpecialLatched) {
      if (Math.abs(slot.lastAttackPress - slot.lastJumpPress) <= SIMULTANEOUS_PRESS_WINDOW) {
        comboSpecial = true;
        slot.comboSpecialLatched = true;
      }
    }
    if (!held.attack || !held.jump) slot.comboSpecialLatched = false;

    f.specialPressed = pressed.special || comboSpecial;
    f.attackPressed = pressed.attack && !comboSpecial;
    f.jumpPressed = pressed.jump && !comboSpecial;
    f.moveRequest = undefined;
  }

  getFrame(slot: number): InputFrame {
    return this.slots[slot].frame;
  }

  slotPressed(slot: number, action: Action): boolean {
    return this.slots[slot].pressed[action];
  }

  slotHeld(slot: number, action: Action): boolean {
    return this.slots[slot].held[action];
  }

  slotConfirm(slot: number): boolean {
    const s = this.slots[slot];
    if (s.pressed.attack || s.pressed.jump) return true;
    if (slot === 0) return MENU_CONFIRM_KEYS.some((k) => this.pressedNow.has(k)) || (s.padStart && !s.padStartPrev);
    return this.pressedNow.has('NumpadEnter') || (s.padStart && !s.padStartPrev);
  }

  slotBack(slot: number): boolean {
    const s = this.slots[slot];
    if (s.padBack && !s.padBackPrev) return true;
    if (slot === 0) return MENU_BACK_KEYS.some((k) => this.pressedNow.has(k));
    return false;
  }

  keyPressed(code: string): boolean {
    return this.pressedNow.has(code);
  }

  pausePressed(): boolean {
    if (PAUSE_KEYS.some((k) => this.pressedNow.has(k))) return true;
    return this.slots.some((s) => s.padStart && !s.padStartPrev);
  }

  debugPressed(): boolean {
    return this.pressedNow.has(DEBUG_KEY);
  }

  mutePressed(): boolean {
    return this.pressedNow.has(MUTE_KEY);
  }

  /** Combined menu navigation from every device. */
  menu(): MenuInput {
    const m: MenuInput = { up: false, down: false, left: false, right: false, confirm: false, back: false };
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      m.up ||= s.pressed.up;
      m.down ||= s.pressed.down;
      m.left ||= s.pressed.left;
      m.right ||= s.pressed.right;
      m.confirm ||= s.pressed.attack || s.pressed.jump || (s.padStart && !s.padStartPrev);
      if (s.padBack && !s.padBackPrev) m.back = true;
    }
    if (MENU_CONFIRM_KEYS.some((k) => this.pressedNow.has(k))) m.confirm = true;
    if (MENU_BACK_KEYS.some((k) => this.pressedNow.has(k))) m.back = true;
    return m;
  }

  connectedPads(): number {
    return this.getPads().length;
  }
}
