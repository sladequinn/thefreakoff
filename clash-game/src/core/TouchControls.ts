import type { Action } from '../config/controls';
import type { InputManager } from './InputManager';

const STICK_DEADZONE = 0.34;
const STICK_RUN = 0.9;

interface ButtonDef {
  action: Action;
  label: string;
  sub: string;
  color: string;
  size: number;
}

const BUTTONS: ButtonDef[] = [
  { action: 'attack', label: 'ATK', sub: 'attack', color: '#ff6a2a', size: 1 },
  { action: 'jump', label: 'JMP', sub: 'jump', color: '#39f3ff', size: 0.8 },
  { action: 'special', label: 'SPL', sub: 'special', color: '#8a4dff', size: 0.74 },
];

const STYLE = `
.tc-root { position: fixed; inset: 0; pointer-events: none; z-index: 10; display: none;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; font-family: 'Arial Black', Impact, sans-serif; }
.tc-root.on { display: block; }
.tc-zone { position: absolute; pointer-events: auto; touch-action: none; }
.tc-base { position: absolute; border-radius: 50%; border: 2px solid rgba(255,255,255,0.28);
  background: radial-gradient(circle, rgba(138,77,255,0.18), rgba(10,6,20,0.35)); transform: translate(-50%, -50%);
  transition: opacity 120ms; opacity: 0.55; }
.tc-base.active { opacity: 1; transition: none; }
.tc-knob { position: absolute; left: 50%; top: 50%; border-radius: 50%; transform: translate(-50%, -50%);
  background: radial-gradient(circle at 35% 30%, #ffffff, #c79bff 45%, #6a1dff); box-shadow: 0 0 18px rgba(138,77,255,0.7); }
.tc-btn { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: #fff; transform: translate(-50%, -50%);
  border: 2px solid rgba(255,255,255,0.35); text-shadow: 0 2px 0 #000; opacity: 0.82; }
.tc-btn span { font-size: 0.34em; letter-spacing: 0.04em; }
.tc-btn small { font-family: 'Trebuchet MS', system-ui, sans-serif; font-size: 0.16em; opacity: 0.8; text-transform: uppercase; }
.tc-root.landscape .tc-btn { opacity: 0.5; }
.tc-root.landscape .tc-base { opacity: 0.35; }
.tc-root.landscape .tc-base.active { opacity: 0.8; }
.tc-btn.down { opacity: 1; filter: brightness(1.35); transform: translate(-50%, -50%) scale(0.92); }
.tc-mini { position: absolute; pointer-events: auto; touch-action: none; width: 42px; height: 42px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px;
  background: rgba(10,6,20,0.6); border: 1px solid rgba(255,255,255,0.25); }
.tc-mini.down { background: rgba(138,77,255,0.6); }
.tc-hint { position: absolute; left: 0; right: 0; text-align: center; color: rgba(255,255,255,0.45);
  font: 700 12px 'Trebuchet MS', system-ui, sans-serif; pointer-events: none; }
`;

/**
 * On-screen virtual joystick + action buttons for phones and tablets. Portrait places the pad below the
 * game view; landscape overlays it on the lower corners.
 */
export class TouchControls {
  readonly root: HTMLDivElement;
  private zone: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private buttons: { def: ButtonDef; el: HTMLDivElement }[] = [];
  private minis: HTMLDivElement[] = [];
  private hint: HTMLDivElement;
  private stickPointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private rest = { x: 0, y: 0 };
  private radius = 56;
  private dirs: Record<'up' | 'down' | 'left' | 'right', boolean> = { up: false, down: false, left: false, right: false };
  private visible = false;

  constructor(
    private readonly input: InputManager,
    private readonly canvas: HTMLCanvasElement,
  ) {
    if (!document.getElementById('tc-style')) {
      const style = document.createElement('style');
      style.id = 'tc-style';
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    this.root = document.createElement('div');
    this.root.className = 'tc-root';

    this.zone = document.createElement('div');
    this.zone.className = 'tc-zone';
    this.base = document.createElement('div');
    this.base.className = 'tc-base';
    this.knob = document.createElement('div');
    this.knob.className = 'tc-knob';
    this.base.appendChild(this.knob);
    this.zone.appendChild(this.base);
    this.root.appendChild(this.zone);
    this.bindStick();

    for (const def of BUTTONS) {
      const el = document.createElement('div');
      el.className = 'tc-btn';
      el.style.background = `radial-gradient(circle at 35% 30%, ${def.color}ee, ${def.color}66 60%, rgba(10,6,20,0.6))`;
      el.innerHTML = `<span>${def.label}</span><small>${def.sub}</small>`;
      this.bindHold(el, (down) => this.input.setTouchAction(def.action, down));
      this.root.appendChild(el);
      this.buttons.push({ def, el });
    }

    const pause = this.mini('II', () => this.input.injectKey('Escape'));
    const mute = this.mini('\u266A', () => this.input.injectKey('KeyM'));
    this.minis.push(pause, mute);
    const docEl = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenEnabled && docEl.requestFullscreen) {
      const fs = this.mini('\u26F6', () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else
          void docEl.requestFullscreen({ navigationUI: 'hide' }).then(() => {
            const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
            orientation.lock?.('landscape').catch(() => undefined);
          });
      });
      this.minis.push(fs);
    }

    this.hint = document.createElement('div');
    this.hint.className = 'tc-hint';
    this.hint.textContent = 'Rotate your phone for a bigger view';
    this.root.appendChild(this.hint);

    document.body.appendChild(this.root);
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if ((e.target as Element | null)?.closest?.('.tc-btn, .tc-zone, .tc-mini')) return;
      this.input.touchPoke();
    });
    const relayout = (): void => {
      requestAnimationFrame(() => this.layout());
    };
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
    document.addEventListener('fullscreenchange', relayout);
    this.layout();
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.classList.toggle('on', v);
    document.body.classList.toggle('touch', v);
    if (!v) {
      this.releaseAll();
      if (this.canvas.parentElement) this.canvas.parentElement.style.paddingTop = '';
    }
    window.dispatchEvent(new Event('resize'));
  }

  private mini(label: string, onTap: () => void): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'tc-mini';
    el.textContent = label;
    this.bindHold(el, (down) => {
      if (down) onTap();
    });
    this.root.appendChild(el);
    return el;
  }

  private bindHold(el: HTMLElement, set: (down: boolean) => void): void {
    let pointer: number | null = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointer !== null) return;
      pointer = e.pointerId;
      el.setPointerCapture(e.pointerId);
      el.classList.add('down');
      this.input.touchPoke();
      navigator.vibrate?.(8);
      set(true);
    });
    const release = (e: PointerEvent): void => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      el.classList.remove('down');
      set(false);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  private bindStick(): void {
    const z = this.zone;
    z.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stickPointer !== null) return;
      this.stickPointer = e.pointerId;
      z.setPointerCapture(e.pointerId);
      const r = z.getBoundingClientRect();
      this.origin.x = Math.min(Math.max(e.clientX - r.left, this.radius), r.width - this.radius);
      this.origin.y = Math.min(Math.max(e.clientY - r.top, this.radius), r.height - this.radius);
      this.base.style.left = `${this.origin.x}px`;
      this.base.style.top = `${this.origin.y}px`;
      this.base.classList.add('active');
      this.input.touchPoke();
      this.moveStick(e.clientX - r.left, e.clientY - r.top);
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointer) return;
      const r = z.getBoundingClientRect();
      this.moveStick(e.clientX - r.left, e.clientY - r.top);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.resetStick();
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    z.addEventListener('lostpointercapture', end);
  }

  private moveStick(px: number, py: number): void {
    let dx = (px - this.origin.x) / this.radius;
    let dy = (py - this.origin.y) / this.radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.knob.style.left = `${50 + dx * 50}%`;
    this.knob.style.top = `${50 + dy * 50}%`;
    const active = len > STICK_DEADZONE;
    this.setDir('left', active && dx < -STICK_DEADZONE);
    this.setDir('right', active && dx > STICK_DEADZONE);
    this.setDir('up', active && dy < -0.42);
    this.setDir('down', active && dy > 0.42);
    this.input.setTouchRun(Math.abs(dx) > STICK_RUN);
  }

  private setDir(d: 'up' | 'down' | 'left' | 'right', on: boolean): void {
    if (this.dirs[d] === on) return;
    this.dirs[d] = on;
    this.input.setTouchAction(d, on);
  }

  private resetStick(): void {
    for (const d of ['up', 'down', 'left', 'right'] as const) this.setDir(d, false);
    this.input.setTouchRun(false);
    this.knob.style.left = '50%';
    this.knob.style.top = '50%';
    this.base.classList.remove('active');
    this.base.style.left = `${this.rest.x}px`;
    this.base.style.top = `${this.rest.y}px`;
  }

  private releaseAll(): void {
    this.stickPointer = null;
    this.resetStick();
    for (const b of this.buttons) {
      b.el.classList.remove('down');
      this.input.setTouchAction(b.def.action, false);
    }
  }

  private layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const portrait = vh > vw;
    const view = this.canvas.getBoundingClientRect();
    const safeBottom = 14;
    this.root.classList.toggle('landscape', !portrait);
    const app = this.canvas.parentElement;

    let areaTop: number;
    let unit: number;
    if (portrait) {
      unit = Math.min(vw / 4.2, 120);
      // Center the game view in the space left above the pad so it sits closer to the thumbs.
      const controlsH = unit * 3.4;
      const pad = Math.max(8, (vh - view.height - controlsH) / 2);
      if (app && this.visible) app.style.paddingTop = `${pad}px`;
      areaTop = pad + view.height + 8;
      unit = Math.min(unit, Math.max(160, vh - areaTop) / 2.6);
      this.hint.style.display = 'block';
      this.hint.style.top = `${areaTop + 6}px`;
    } else {
      if (app) app.style.paddingTop = '';
      areaTop = vh * 0.3;
      unit = Math.min(vh / 4.6, vw / 9, 104);
      this.hint.style.display = 'none';
    }

    this.radius = unit * 0.62;
    const baseSize = this.radius * 2;
    this.base.style.width = `${baseSize}px`;
    this.base.style.height = `${baseSize}px`;
    this.knob.style.width = `${baseSize * 0.44}px`;
    this.knob.style.height = `${baseSize * 0.44}px`;

    const zoneW = portrait ? vw * 0.52 : vw * 0.42;
    const zoneTop = portrait ? areaTop + 24 : areaTop;
    this.zone.style.left = '0px';
    this.zone.style.top = `${zoneTop}px`;
    this.zone.style.width = `${zoneW}px`;
    this.zone.style.height = `${vh - zoneTop}px`;
    this.rest.x = Math.min(zoneW * 0.5, this.radius + 26);
    this.rest.y = vh - zoneTop - this.radius - safeBottom - (portrait ? unit * 0.5 : 10);
    if (this.stickPointer === null) {
      this.base.style.left = `${this.rest.x}px`;
      this.base.style.top = `${this.rest.y}px`;
    }

    const cx = vw - unit * 1.35 - 8;
    const cy = vh - unit * (portrait ? 1.55 : 1.15) - safeBottom;
    const place = [
      { x: cx, y: cy },
      { x: cx + unit * 0.8, y: cy - unit * 0.95 },
      { x: cx - unit * 1.05, y: cy - unit * 0.55 },
    ];
    this.buttons.forEach((b, i) => {
      const size = unit * b.def.size;
      const p = place[i];
      b.el.style.width = `${size}px`;
      b.el.style.height = `${size}px`;
      b.el.style.fontSize = `${size}px`;
      b.el.style.left = `${Math.min(p.x, vw - size / 2 - 6)}px`;
      b.el.style.top = `${p.y}px`;
    });

    this.minis.forEach((m, i) => {
      if (portrait) {
        m.style.top = `${areaTop + 30}px`;
        m.style.right = `${10 + i * 50}px`;
      } else {
        m.style.top = `${10 + i * 50}px`;
        m.style.right = '6px';
      }
    });
  }
}
