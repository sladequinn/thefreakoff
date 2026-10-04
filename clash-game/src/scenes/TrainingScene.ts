import { CANVAS_WIDTH, FONT_UI, TEAM_ENEMY, TEAM_PLAYER, VS_ARENA_MARGIN } from '../config/constants';
import { STAGE_INFO, resolveStage } from '../config/stages';
import { BossAI } from '../ai/BossAI';
import { charDef } from '../characters';
import type { GameContext, SceneMap } from '../core/StateManager';
import { Fighter } from '../entities/Fighter';
import { Player } from '../entities/Player';
import { FState, emptyInput, type Bounds, type CharId, type Controller, type InputFrame, type World } from '../physics/Types';
import { CombatScene, type PauseItem } from './Scene';

type DummyMode = 'stand' | 'block' | 'cpu' | 'record' | 'playback';
const DUMMY_MODES: DummyMode[] = ['stand', 'block', 'cpu', 'record', 'playback'];
const DUMMY_LABEL: Record<DummyMode, string> = { stand: 'STAND', block: 'BLOCK ALL', cpu: 'CPU', record: 'RECORD', playback: 'PLAYBACK' };
const MAX_RECORD_FRAMES = 60 * 10;
const PLAYBACK_GAP = 30;

const cloneInput = (f: InputFrame): InputFrame => ({ ...f });

/** Drives the training dummy: idle, auto-guard, full CPU, or a recorded clip of the player's own inputs. */
class DummyController implements Controller {
  mode: DummyMode = 'stand';
  readonly clip: InputFrame[] = [];
  private cursor = 0;
  private gap = 0;
  private readonly idle = emptyInput();
  private readonly ai: BossAI;

  constructor(
    charId: CharId,
    private readonly source: () => InputFrame,
  ) {
    this.ai = new BossAI(charId, { versus: true, difficulty: 0.85 });
  }

  startRecording(): void {
    this.clip.length = 0;
    this.cursor = 0;
    this.mode = 'record';
  }

  startPlayback(): void {
    this.cursor = 0;
    this.gap = 0;
    this.mode = 'playback';
  }

  getInput(self: Fighter, world: World): InputFrame {
    switch (this.mode) {
      case 'cpu':
        return this.ai.getInput(self, world);
      case 'record': {
        const f = cloneInput(this.source());
        if (this.clip.length < MAX_RECORD_FRAMES) this.clip.push(f);
        else this.startPlayback();
        return f;
      }
      case 'playback': {
        if (this.clip.length === 0) return this.idle;
        if (this.gap > 0) {
          this.gap--;
          return this.idle;
        }
        const f = this.clip[this.cursor++];
        if (this.cursor >= this.clip.length) {
          this.cursor = 0;
          this.gap = PLAYBACK_GAP;
        }
        return f;
      }
      default:
        return this.idle;
    }
  }
}

interface FrameReadout {
  move: string;
  startup: number;
  active: string;
  recovery: number;
  total: number;
}

/**
 * Training room: infinite health, hitbox overlay, frame data and a dummy that can stand, block,
 * fight back, or replay a clip of your own inputs. All rules live in this scene; the sim is shared.
 */
export class TrainingScene extends CombatScene {
  readonly mode = 'training' as const;
  private readonly params: SceneMap['training'];
  private readonly p1: Player;
  private readonly dummy: Fighter;
  private readonly brain: DummyController;
  private showFrameData = true;
  private readout: FrameReadout | null = null;
  private lastMove: string | null = null;
  /** Combo bookkeeping for the damage counter. */
  private comboHits = 0;
  private comboDamage = 0;
  private lastCombo: { hits: number; damage: number } | null = null;
  private comboFade = 0;
  /** Frame advantage: when the attacker and the victim both return to neutral after a hit. */
  private advPending: { blocked: boolean; aFree: number | null; dFree: number | null } | null = null;
  private advantage: { value: number; blocked: boolean } | null = null;
  private toast = '';
  private toastT = 0;

  constructor(game: GameContext, params: SceneMap['training']) {
    super(game);
    this.params = params;
    this.theme = resolveStage(params.stage);
    this.stageWidth = CANVAS_WIDTH;
    this.camera.reset(CANVAS_WIDTH, 0);
    this.maxTokens = 99;
    const mirror = params.p1 === params.p2;
    const v1 = params.v1 ?? 'normal';
    let v2 = params.v2 ?? 'normal';
    if (mirror && v1 === v2) v2 = v1 === 'alt' ? 'normal' : 'alt';
    this.p1 = new Player(charDef(params.p1), game.input, 0, TEAM_PLAYER, v1);
    this.brain = new DummyController(params.p2, () => game.input.getFrame(0));
    this.dummy = new Fighter(charDef(params.p2), { team: TEAM_ENEMY, controller: this.brain, variant: v2, name: charDef(params.p2).name });
    for (const f of [this.p1, this.dummy]) f.canBlock = true;
    this.p1.autoFace = this.dummy;
    this.dummy.autoFace = this.p1;
    this.fighters = [this.p1, this.dummy];
    this.onHitLanded = (a, t, dmg) => this.trackHit(a, t, dmg);
    this.resetPositions();
    this.p1.setState(FState.IDLE);
    this.dummy.setState(FState.IDLE);
  }

  enter(): void {
    this.audio.startMusic('stage', this.theme);
    this.say('TRAINING  ·  pause for dummy options');
  }

  exit(): void {
    this.audio.stopMusic();
  }

  protected restart(): void {
    this.resetPositions();
  }

  protected pauseExit(): { label: string; go: () => void } {
    return { label: 'CHARACTER SELECT', go: () => this.game.scenes.go('select', { mode: 'training', cpu: true }) };
  }

  protected pauseTitle(): string {
    return 'TRAINING';
  }

  protected extraPauseItems(): PauseItem[] {
    const g = this.game;
    const mode = this.brain.mode;
    return [
      {
        label: `DUMMY: ${DUMMY_LABEL[mode]}`,
        toggle: true,
        act: () => this.setDummyMode(DUMMY_MODES[(DUMMY_MODES.indexOf(this.brain.mode) + 1) % DUMMY_MODES.length]),
      },
      {
        label: `HITBOXES: ${g.settings.debug ? 'ON' : 'OFF'}`,
        toggle: true,
        act: () => {
          g.settings.debug = !g.settings.debug;
        },
      },
      {
        label: `FRAME DATA: ${this.showFrameData ? 'ON' : 'OFF'}`,
        toggle: true,
        act: () => {
          this.showFrameData = !this.showFrameData;
        },
      },
      { label: 'RESET POSITIONS', toggle: false, act: () => this.resetPositions() },
    ];
  }

  private say(msg: string): void {
    this.toast = msg;
    this.toastT = 150;
  }

  private setDummyMode(mode: DummyMode): void {
    this.dummy.autoGuard = mode === 'block';
    if (mode === 'record') {
      this.brain.startRecording();
      this.p1.human.enabled = false;
      this.say('RECORDING  ·  your controls drive the dummy  ·  pause to stop');
    } else {
      this.p1.human.enabled = true;
      if (mode === 'playback') {
        this.brain.startPlayback();
        this.say(this.brain.clip.length ? `PLAYBACK  ·  ${(this.brain.clip.length / 60).toFixed(1)}s clip looping` : 'NO CLIP RECORDED YET');
      } else {
        this.brain.mode = mode;
        this.say(`DUMMY: ${DUMMY_LABEL[mode]}`);
      }
    }
  }

  private resetPositions(): void {
    this.p1.resetForRound(380, 430, 1);
    this.dummy.resetForRound(580, 430, -1);
    this.p1.setState(FState.IDLE);
    this.dummy.setState(FState.IDLE);
    this.projectiles = [];
    this.particles.clear();
    this.comboHits = this.comboDamage = 0;
    this.advPending = null;
  }

  boundsFor(): Bounds {
    return this.depthBounds(VS_ARENA_MARGIN, CANVAS_WIDTH - VS_ARENA_MARGIN);
  }

  onFighterKO(): void {
    /* health is infinite here; refills happen in update */
  }

  private trackHit(a: Fighter, t: Fighter, dmg: number): void {
    if (a !== this.p1 || t !== this.dummy) return;
    this.comboHits = t.comboTaken;
    this.comboDamage += dmg;
    this.comboFade = 120;
    this.advPending = { blocked: false, aFree: null, dFree: null };
  }

  /** Frame advantage is measured by watching both fighters leave their animations after contact. */
  private trackAdvantage(): void {
    // Blocked hits don't call onHitLanded; detect them from the dummy entering blockstun under a live attack.
    if (!this.advPending && this.dummy.state === FState.BLOCK && this.dummy.blockstun > 0 && this.p1.state === FState.ATTACK) {
      this.advPending = { blocked: true, aFree: null, dFree: null };
    }
    const p = this.advPending;
    if (!p) return;
    if (p.aFree === null && this.p1.isActionable()) p.aFree = this.frame;
    // Stun counters aren't zeroed when the state ends, so neutral is judged by state alone.
    const dummyNeutral = this.dummy.isActionable() && this.dummy.state !== FState.BLOCK;
    if (p.dFree === null && dummyNeutral) p.dFree = this.frame;
    if (p.aFree !== null && p.dFree !== null) {
      this.advantage = { value: p.dFree - p.aFree, blocked: p.blocked };
      this.advPending = null;
    } else if (this.frame - (p.aFree ?? this.frame) > 300) {
      this.advPending = null;
    }
  }

  private trackFrameData(): void {
    const m = this.p1.move;
    if (m && m.id !== this.lastMove) {
      this.lastMove = m.id;
      const first = m.hits.length ? Math.min(...m.hits.map((h) => h.start)) : 0;
      const last = m.hits.length ? Math.max(...m.hits.map((h) => h.end)) : 0;
      const active = m.hits.length ? `${first + 1}–${last + 1}` : '—';
      this.readout = { move: m.name, startup: first + 1, active, recovery: Math.max(0, m.duration - last - 1), total: m.duration };
      this.advantage = null;
    }
    if (!m && this.p1.isActionable()) this.lastMove = null;
  }

  private refill(): void {
    for (const f of this.fighters) {
      const neutral = f.isActionable() && f.state !== FState.BLOCK && f.comboTaken === 0;
      if (neutral && f.hp < f.maxHp) f.hp = f.displayHp = f.maxHp;
      // A floor so a long combo can never score a KO; the damage counter still shows the full total.
      if (f.hp < f.maxHp * 0.25) f.hp = f.maxHp;
    }
  }

  update(): void {
    if (this.handlePause()) return;
    if (this.toastT > 0) this.toastT--;
    if (this.comboFade > 0) {
      this.comboFade--;
      if (this.comboFade === 0 || this.dummy.comboTaken === 0) {
        if (this.comboHits > 0) this.lastCombo = { hits: this.comboHits, damage: this.comboDamage };
        this.comboHits = this.comboDamage = 0;
      }
    }
    this.refill();
    this.trackFrameData();
    this.trackAdvantage();
    this.stepWorld();
    // Keep the dummy's special meter topped up so CPU and playback can use specials freely.
    if (this.dummy.hp < this.dummy.maxHp && this.dummy.isActionable() && this.dummy.comboTaken === 0) this.dummy.hp = this.dummy.displayHp = this.dummy.maxHp;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const t = this.game.time;
    this.renderWorld(ctx);
    ui.vsHud(ctx, this.p1, this.dummy, [0, 0], 0, 99, t, 'DUMMY');
    ui.text(ctx, `TRAINING  ·  ${STAGE_INFO[this.theme].name}  ·  DUMMY: ${DUMMY_LABEL[this.brain.mode]}`, CANVAS_WIDTH / 2, 86, 11, 'rgba(255,255,255,0.7)', {
      template: FONT_UI,
      stroke: '#000',
      strokeWidth: 3,
    });

    const hits = this.comboHits > 0 ? this.comboHits : this.lastCombo?.hits ?? 0;
    const dmg = this.comboHits > 0 ? this.comboDamage : this.lastCombo?.damage ?? 0;
    if (hits > 0) {
      const live = this.comboHits > 0;
      ui.comboCounter(ctx, hits, 40, 170, 'left', live ? 1 : 0.55, '#6fb6ff');
      ui.text(ctx, `${Math.round(dmg)} DMG`, 44, 196, 14, live ? '#ffd21f' : 'rgba(255,255,255,0.6)', { align: 'left', stroke: '#000', strokeWidth: 3 });
    }

    if (this.showFrameData) this.drawFrameData(ctx);

    if (this.brain.mode === 'record') {
      const blink = Math.floor(t / 20) % 2 === 0;
      ui.text(ctx, `${blink ? '●' : '○'} REC  ${(this.brain.clip.length / 60).toFixed(1)}s`, CANVAS_WIDTH - 40, 170, 16, '#ff4d6d', { align: 'right', stroke: '#000', strokeWidth: 3 });
    } else if (this.brain.mode === 'playback' && this.brain.clip.length) {
      ui.text(ctx, `▶ PLAYBACK  ${(this.brain.clip.length / 60).toFixed(1)}s`, CANVAS_WIDTH - 40, 170, 16, '#9fe8ff', { align: 'right', stroke: '#000', strokeWidth: 3 });
    }

    if (this.toastT > 0) {
      ui.text(ctx, this.toast, CANVAS_WIDTH / 2, 520, 12, 'rgba(255,255,255,0.85)', { template: FONT_UI, stroke: '#000', strokeWidth: 3, alpha: Math.min(1, this.toastT / 20) });
    }
    this.renderPause(ctx);
  }

  private drawFrameData(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const x = 12;
    const y = 400;
    const w = 300;
    ui.panel(ctx, x, y, w, 118, 'rgba(8,6,18,0.82)');
    ui.text(ctx, 'FRAME DATA', x + 12, y + 18, 11, '#ffd21f', { align: 'left', template: FONT_UI });
    const r = this.readout;
    const col = 'rgba(255,255,255,0.85)';
    if (!r) {
      ui.text(ctx, 'Throw a move to read its startup, active and recovery frames.', x + 12, y + 44, 11, 'rgba(255,255,255,0.55)', { align: 'left', template: FONT_UI });
    } else {
      ui.text(ctx, r.move.toUpperCase(), x + 12, y + 40, 14, '#ffffff', { align: 'left', stroke: '#000', strokeWidth: 3 });
      const line = (label: string, val: string, yy: number): void => {
        ui.text(ctx, label, x + 12, yy, 11, 'rgba(255,255,255,0.55)', { align: 'left', template: FONT_UI });
        ui.text(ctx, val, x + 120, yy, 11, col, { align: 'left', template: FONT_UI });
      };
      line('STARTUP', `${r.startup}f`, y + 60);
      line('ACTIVE', r.active, y + 76);
      line('RECOVERY', `${r.recovery}f  ·  total ${r.total}f`, y + 92);
    }
    const adv = this.advantage;
    const pending = this.advPending !== null;
    const label = adv ? `${adv.value >= 0 ? '+' : ''}${adv.value}` : pending ? '…' : '—';
    const color = adv ? (adv.value >= 0 ? '#7dff9a' : '#ff6a6a') : 'rgba(255,255,255,0.4)';
    ui.text(ctx, adv ? (adv.blocked ? 'ON BLOCK' : 'ON HIT') : 'ADVANTAGE', x + w - 12, y + 60, 10, 'rgba(255,255,255,0.55)', { align: 'right', template: FONT_UI });
    ui.text(ctx, label, x + w - 12, y + 88, 24, color, { align: 'right', stroke: '#000', strokeWidth: 4 });
    const st = this.p1.state;
    ui.text(ctx, `P1 ${st}${this.p1.move ? ` ${this.p1.moveFrame + 1}/${this.p1.move.duration}` : ''}`, x + 12, y + 108, 10, 'rgba(255,255,255,0.45)', { align: 'left', template: FONT_UI });
  }
}
