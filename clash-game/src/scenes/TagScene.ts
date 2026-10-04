import {
  CANVAS_WIDTH,
  FONT_UI,
  TAG_BENCH_RECOVER,
  TAG_BENCH_REGEN,
  TAG_COOLDOWN_FRAMES,
  TAG_ROUND_SECONDS,
  TAG_SWAP_IN_FRAMES,
  TAG_SWAP_OUT_FRAMES,
  TEAM_ENEMY,
  TEAM_PLAYER,
  VS_ARENA_MARGIN,
} from '../config/constants';
import { CPU_DIFFICULTY, STAGE_INFO, nextStage, resolveStage } from '../config/stages';
import { charDef } from '../characters';
import type { GameContext, SceneMap, TagTeam } from '../core/StateManager';
import { Boss } from '../entities/Boss';
import type { Fighter } from '../entities/Fighter';
import { Player } from '../entities/Player';
import { clamp, lerp } from '../physics/Collision';
import { FState, type Bounds, type CharId, type Team } from '../physics/Types';
import { CombatScene } from './Scene';
import { winQuote } from './VsScene';

type Phase = 'intro' | 'fight' | 'ko' | 'relay' | 'timeup' | 'matchEnd';

/** A partner swap in flight: the outgoing fighter walks off (voluntary tags only) while the partner leaps in. */
interface Swap {
  out: Fighter | null;
  in: Fighter;
  t: number;
  /** Which screen edge the team uses: -1 left, 1 right. */
  dir: 1 | -1;
  z: number;
  fromX: number;
  toX: number;
}

interface Side {
  team: Team;
  roster: [Fighter, Fighter];
  point: 0 | 1;
  tagCd: number;
  swap: Swap | null;
  /** Health the benched fighter can recover up to while resting. */
  benchCap: number;
  label: string;
  color: string;
  tags: number;
  human: boolean;
}

const RELAY_BANNER_FRAMES = 60;
const SAFE_STATES = new Set<FState>([FState.KNOCKDOWN, FState.WAKEUP, FState.HURT, FState.JUGGLE]);

/** Two-on-two: one long round, a point fighter per side, partners on the bench recovering until they are tagged in or forced in by a KO. */
export class TagScene extends CombatScene {
  readonly mode = 'tag' as const;
  private readonly params: SceneMap['tag'];
  private readonly sides: [Side, Side];
  private timer = TAG_ROUND_SECONDS;
  private phase: Phase = 'intro';
  private phaseTimer = 0;
  private koSide: 0 | 1 = 0;
  private relayName = '';
  private matchWinner: 0 | 1 | -1 = -1;
  private comboShow: [number, number] = [0, 0];
  private comboFade: [number, number] = [0, 0];
  private tagHintT = 0;

  constructor(game: GameContext, params: SceneMap['tag']) {
    super(game);
    this.params = params;
    this.theme = resolveStage(params.stage);
    this.stageWidth = CANVAS_WIDTH;
    this.camera.reset(CANVAS_WIDTH, 0);
    this.maxTokens = 99;
    const difficulty = CPU_DIFFICULTY[game.save.settings.cpuDifficulty].value;
    const build = (team: TagTeam, t: Team, slot: number, cpu: boolean): [Fighter, Fighter] =>
      team.chars.map((id, i) => {
        const def = charDef(id);
        const f: Fighter = cpu ? new Boss(def, { team: t, hpMult: 1, versus: true, difficulty, variant: team.costumes[i] }) : new Player(def, game.input, slot, t, team.costumes[i]);
        f.canBlock = true;
        return f;
      }) as [Fighter, Fighter];
    this.sides = [
      { team: TEAM_PLAYER, roster: build(params.t1, TEAM_PLAYER, 0, false), point: 0, tagCd: 0, swap: null, benchCap: 0, label: '1P', color: '#6fb6ff', tags: 0, human: true },
      { team: TEAM_ENEMY, roster: build(params.t2, TEAM_ENEMY, 1, params.cpu), point: 0, tagCd: 0, swap: null, benchCap: 0, label: params.cpu ? 'CPU' : '2P', color: '#ff7a8a', tags: 0, human: !params.cpu },
    ];
    this.startMatch();
  }

  enter(): void {
    this.game.settings.tagButton = true;
    this.audio.startMusic('versus', this.theme);
  }

  exit(): void {
    this.game.settings.tagButton = false;
    this.audio.stopMusic();
  }

  protected restart(): void {
    this.game.scenes.go('tag', { ...this.params, stage: this.theme });
  }

  protected pauseExit(): { label: string; go: () => void } {
    return { label: 'TEAM SELECT', go: () => this.game.scenes.go('select', { mode: 'tag', cpu: this.params.cpu }) };
  }

  boundsFor(f: Fighter): Bounds {
    for (const s of this.sides) {
      if (s.swap && (s.swap.in === f || s.swap.out === f)) return this.depthBounds(-200, CANVAS_WIDTH + 200);
    }
    return this.depthBounds(VS_ARENA_MARGIN, CANVAS_WIDTH - VS_ARENA_MARGIN);
  }

  private active(i: 0 | 1): Fighter {
    const s = this.sides[i];
    return s.roster[s.point];
  }

  private bench(i: 0 | 1): Fighter {
    const s = this.sides[i];
    return s.roster[1 - s.point];
  }

  private sideOf(f: Fighter): 0 | 1 {
    return this.sides[0].roster.includes(f) ? 0 : 1;
  }

  private startMatch(): void {
    for (const i of [0, 1] as const) {
      const s = this.sides[i];
      s.point = 0;
      s.tagCd = 0;
      s.swap = null;
      s.tags = 0;
      const x = i === 0 ? 300 : 660;
      const facing = i === 0 ? 1 : -1;
      s.roster[0].resetForRound(x, 430, facing);
      s.roster[1].resetForRound(x, 430, facing);
    }
    this.fighters = [this.active(0), this.active(1)];
    this.active(0).autoFace = this.active(1);
    this.active(1).autoFace = this.active(0);
    this.projectiles = [];
    this.particles.clear();
    this.timer = TAG_ROUND_SECONDS;
    this.phase = 'intro';
    this.phaseTimer = 0;
  }

  onFighterKO(f: Fighter): void {
    if (this.phase !== 'fight' && this.phase !== 'relay') return;
    this.koSide = this.sideOf(f);
    this.phase = 'ko';
    this.phaseTimer = 0;
    this.slowmo = 70;
    this.audio.playKO();
    this.camera.shake(10, 0, 1, 20);
  }

  // ------------------------------------------------------------------ tagging

  private canTag(i: 0 | 1): boolean {
    const s = this.sides[i];
    const f = this.active(i);
    return !s.swap && s.tagCd <= 0 && this.bench(i).hp > 0 && f.isActionable() && !f.isAirborne() && !f.grabbedBy;
  }

  /** Puts the partner in play. `voluntary` swaps walk the point fighter off; KO relays just drop the fallen one. */
  private startSwap(i: 0 | 1, voluntary: boolean): void {
    const s = this.sides[i];
    const other = this.active(i === 0 ? 1 : 0);
    const leaving = this.active(i);
    const incoming = this.bench(i);
    const dir: 1 | -1 = leaving.x < CANVAS_WIDTH / 2 ? -1 : 1;
    const edgeX = dir < 0 ? -70 : CANVAS_WIDTH + 70;
    const toX = clamp(leaving.x, VS_ARENA_MARGIN + 70, CANVAS_WIDTH - VS_ARENA_MARGIN - 70);

    if (voluntary) {
      leaving.endMove(this);
      leaving.grabbedBy = null;
      leaving.vx = leaving.vy = leaving.vz = 0;
      leaving.y = 0;
      leaving.setState(FState.INTRO);
      leaving.facing = dir;
      s.benchCap = Math.min(leaving.maxHp, leaving.hp + leaving.maxHp * TAG_BENCH_RECOVER);
      this.particles.dust(leaving.x, leaving.z, 6, -dir);
      this.audio.playDash();
    } else {
      this.fighters = this.fighters.filter((f) => f !== leaving);
      this.particles.smoke(leaving.x, 10, leaving.z, 8);
      s.benchCap = 0;
    }

    incoming.endMove(this);
    incoming.x = edgeX;
    incoming.z = leaving.z;
    incoming.y = 0;
    incoming.vx = incoming.vy = incoming.vz = 0;
    incoming.facing = dir < 0 ? 1 : -1;
    incoming.hidden = false;
    incoming.noGravity = true;
    incoming.grabbedBy = null;
    incoming.koNotified = false;
    incoming.hitstop = incoming.invulnTimer = 0;
    incoming.trail.length = 0;
    incoming.bladeTrail.length = 0;
    incoming.setState(FState.INTRO);
    incoming.autoFace = other;
    other.autoFace = incoming;
    this.fighters.push(incoming);

    s.point = (1 - s.point) as 0 | 1;
    s.tags++;
    s.swap = { out: voluntary ? leaving : null, in: incoming, t: 0, dir, z: leaving.z, fromX: edgeX, toX };
    this.relayName = incoming.name;
    this.audio.playTaunt(incoming.def.voice, 0);
  }

  /** Drives swap choreography after the physics step so the scripted positions win over the fighters' own motion. */
  private tickSwaps(): void {
    for (const i of [0, 1] as const) {
      const s = this.sides[i];
      const sw = s.swap;
      if (!sw) {
        if (s.tagCd > 0) s.tagCd--;
        this.regenBench(i);
        continue;
      }
      sw.t++;
      if (sw.out) {
        if (sw.t <= TAG_SWAP_OUT_FRAMES) {
          sw.out.x += sw.dir * 9;
          sw.out.y = 0;
          sw.out.vx = 0;
          if (sw.t % 6 === 0) this.particles.dust(sw.out.x, sw.out.z, 1, -sw.dir);
        }
        if (sw.t === TAG_SWAP_OUT_FRAMES) {
          this.fighters = this.fighters.filter((f) => f !== sw.out);
          sw.out.vx = 0;
        }
      }
      const inStart = sw.out ? TAG_SWAP_OUT_FRAMES - 10 : 0;
      if (sw.t < inStart) continue;
      const u = clamp((sw.t - inStart) / TAG_SWAP_IN_FRAMES, 0, 1);
      const eased = 1 - (1 - u) * (1 - u);
      const f = sw.in;
      f.x = lerp(sw.fromX, sw.toX, eased);
      f.y = 88 * 4 * u * (1 - u);
      f.z = sw.z;
      f.vx = f.vy = f.vz = 0;
      f.noGravity = true;
      const opp = this.active(i === 0 ? 1 : 0);
      f.facing = opp.x >= f.x ? 1 : -1;
      if (u >= 1) {
        f.y = 0;
        f.noGravity = false;
        f.setState(FState.IDLE);
        s.swap = null;
        s.tagCd = TAG_COOLDOWN_FRAMES;
        this.particles.dust(f.x, f.z, 10);
        this.particles.ring(f.x, f.z, 10, 70, 'rgba(255,210,31,0.8)', 16);
        this.camera.shake(4, 0, 1, 8);
        this.audio.playLand();
        this.rumbleFor(f, 0.4, 120);
      }
    }
  }

  private regenBench(i: 0 | 1): void {
    const s = this.sides[i];
    const b = this.bench(i);
    if (b.hp <= 0 || b.hp >= s.benchCap) return;
    b.hp = Math.min(s.benchCap, b.hp + b.maxHp * TAG_BENCH_REGEN);
    b.displayHp = b.hp;
  }

  private handleTagInputs(): void {
    for (const i of [0, 1] as const) {
      const s = this.sides[i];
      const f = this.active(i);
      if (s.human) {
        const slot = (f as Player).slot;
        if (!this.game.input.getFrame(slot).tagPressed) continue;
        if (this.canTag(i)) {
          this.startSwap(i, true);
        } else if (!s.swap && f.isActionable()) {
          const why = this.bench(i).hp <= 0 ? 'NO PARTNER' : 'TAG CHARGING';
          this.particles.text(f.x, f.y + 110 * f.scale, f.z, why, '#ffd21f', 11);
          this.audio.playBack();
        }
        continue;
      }
      if (!this.canTag(i)) continue;
      const opp = this.active(i === 0 ? 1 : 0);
      const ratio = f.hp / f.maxHp;
      const benchRatio = this.bench(i).hp / this.bench(i).maxHp;
      const safe = Math.abs(opp.x - f.x) > 150 || SAFE_STATES.has(opp.state);
      if (!safe) continue;
      const desperate = ratio < 0.35 && benchRatio > ratio + 0.2 && Math.random() < 0.04;
      const fresh = ratio < 0.6 && benchRatio > 0.9 && Math.random() < 0.004;
      if (desperate || fresh) this.startSwap(i, true);
    }
  }

  // ------------------------------------------------------------------ flow

  private teamHp(i: 0 | 1): number {
    const [a, b] = this.sides[i].roster;
    return (Math.max(0, a.hp) + Math.max(0, b.hp)) / (a.maxHp + b.maxHp);
  }

  private decideMatch(byKO: boolean): void {
    if (byKO) {
      const out = ([0, 1] as const).map((i) => this.sides[i].roster.every((f) => f.hp <= 0));
      this.matchWinner = out[0] && out[1] ? -1 : out[0] ? 1 : 0;
    } else {
      const a = this.teamHp(0);
      const b = this.teamHp(1);
      this.matchWinner = Math.abs(a - b) < 0.001 ? -1 : a > b ? 0 : 1;
    }
    if (this.matchWinner !== -1) {
      const w = this.active(this.matchWinner);
      if (w.hp > 0) {
        w.endMove(this);
        w.setState(FState.VICTORY);
        this.audio.playTaunt(w.def.voice);
      }
    }
  }

  update(): void {
    if (this.phase !== 'matchEnd' && this.handlePause()) return;
    this.phaseTimer++;
    if (this.tagHintT > 0) this.tagHintT--;

    for (const i of [0, 1] as const) {
      const victim = this.active(i === 0 ? 1 : 0);
      if (victim.comboTaken >= 2) {
        this.comboShow[i] = victim.comboTaken;
        this.comboFade[i] = 90;
      } else if (this.comboFade[i] > 0) this.comboFade[i]--;
    }

    switch (this.phase) {
      case 'intro':
        if (this.phaseTimer === 10) this.audio.playBell();
        if (this.phaseTimer === 40) this.audio.playTaunt(this.active(1).def.voice, 0);
        if (this.phaseTimer === 90) this.audio.playTaunt(this.active(0).def.voice, 0);
        if (this.phaseTimer === 100) this.audio.playGo();
        if (this.phaseTimer >= 110) {
          this.active(0).setState(FState.IDLE);
          this.active(1).setState(FState.IDLE);
          this.phase = 'fight';
          this.phaseTimer = 0;
          this.tagHintT = 300;
        }
        break;
      case 'fight':
        this.timer -= 1 / 60;
        if (this.timer <= 0) {
          this.timer = 0;
          this.phase = 'timeup';
          this.phaseTimer = 0;
          this.audio.playBell();
          for (const f of this.fighters) if (f.isActionable()) f.setState(FState.INTRO);
          break;
        }
        this.handleTagInputs();
        break;
      case 'ko': {
        // A double KO downs both point fighters at once; both benches relay in unless one team is out of bodies.
        if (this.phaseTimer === 60) {
          const downs = ([0, 1] as const).filter((i) => this.active(i).hp <= 0);
          if (downs.length > 0 && downs.every((i) => this.bench(i).hp > 0)) {
            for (const i of downs) this.startSwap(i, false);
            this.phase = 'relay';
            this.phaseTimer = 0;
            break;
          }
        }
        if (this.phaseTimer === 110) this.decideMatch(true);
        if (this.phaseTimer > 220) this.finishMatch();
        break;
      }
      case 'relay':
        if (!this.sides[0].swap && !this.sides[1].swap && this.phaseTimer > RELAY_BANNER_FRAMES) {
          this.phase = 'fight';
          this.phaseTimer = 0;
        }
        break;
      case 'timeup':
        for (const f of this.fighters) if (f.isActionable()) f.setState(FState.INTRO);
        if (this.phaseTimer === 80) this.decideMatch(false);
        if (this.phaseTimer > 200) this.finishMatch();
        break;
      case 'matchEnd':
        if (this.phaseTimer > 170) this.toResults();
        if (this.phaseTimer > 40 && this.game.input.menu().confirm) this.toResults();
        break;
    }
    if (this.stepWorld()) this.tickSwaps();
  }

  private finishMatch(): void {
    this.phase = 'matchEnd';
    this.phaseTimer = 0;
    this.audio.startMusic('victory');
  }

  private teamName(i: 0 | 1): string {
    const [a, b] = this.sides[i].roster;
    return `${a.name} & ${b.name}`;
  }

  private mvp(i: 0 | 1): Fighter {
    const [a, b] = this.sides[i].roster;
    return b.combat.damageDealt > a.combat.damageDealt ? b : a;
  }

  private toResults(): void {
    if (this.game.scenes.transitioning) return;
    const w = this.matchWinner;
    const cpu = this.params.cpu;
    const label2 = this.sides[1].label;
    const title = w === -1 ? 'DRAW GAME' : w === 0 ? '1P WINS' : `${label2} WINS`;
    const winnerSide = w === -1 ? null : w;
    const star = winnerSide === null ? null : this.mvp(winnerSide);
    const loserSide: 0 | 1 = w === 0 ? 1 : 0;
    const standing = winnerSide === null ? 0 : this.sides[winnerSide].roster.filter((f) => f.hp > 0).length;
    const humanWinner = w === 0 || (!cpu && w === 1);
    const bestCombo = Math.max(...this.sides.flatMap((s) => s.roster.map((f) => f.combat.maxCombo)));
    const rec = this.game.save.recordVs(humanWinner && star ? (star.def.id as CharId) : null, bestCombo, cpu);
    const extra: string[] = [];
    if (rec.combo && bestCombo > 1) extra.push('★ NEW BEST COMBO');
    if (rec.alt && star) extra.push(`UNLOCKED: ${star.name.toUpperCase()} ALT COSTUME`);
    const sideLine = (i: 0 | 1): string => {
      const s = this.sides[i];
      const hits = s.roster[0].combat.hitsLanded + s.roster[1].combat.hitsLanded;
      const combo = Math.max(s.roster[0].combat.maxCombo, s.roster[1].combat.maxCombo);
      return `${s.label} ${this.teamName(i)}  ·  ${hits} hits  ·  best combo ${combo}  ·  ${s.tags} tag${s.tags === 1 ? '' : 's'}`;
    };
    const used = TAG_ROUND_SECONDS - this.timer;
    const difficulty = cpu ? `  ·  CPU ${CPU_DIFFICULTY[this.game.save.settings.cpuDifficulty].label}` : '';
    const quoteSeed = this.sides.reduce((n, s) => n + s.roster[0].combat.hitsLanded + s.roster[1].combat.hitsLanded, 0);
    this.game.scenes.go('gameover', {
      title,
      subtitle:
        winnerSide === null
          ? 'Both teams drop at the same breath. Nobody takes the city tonight.'
          : `${this.teamName(winnerSide)} take it with ${standing === 2 ? 'both fighters' : 'one fighter'} still standing.`,
      quote: star ? winQuote(star, this.active(loserSide), quoteSeed) : undefined,
      accent: w === 1 ? '#ff4d6d' : '#6fb6ff',
      victory: humanWinner,
      portrait: star ? (star.def.id as CharId) : undefined,
      portraitVariant: star?.variant === 'alt' ? 'alt' : 'normal',
      lines: [sideLine(0), sideLine(1), `${STAGE_INFO[this.theme].name}  ·  ${Math.round(used)}s of ${TAG_ROUND_SECONDS}${difficulty}`, ...extra],
      options: [
        { label: 'REMATCH', scene: 'tag', params: { ...this.params, stage: this.theme } },
        { label: 'NEXT STAGE', scene: 'tag', params: { ...this.params, stage: nextStage(this.theme) } },
        { label: 'TEAM SELECT', scene: 'select', params: { mode: 'tag', cpu } },
        { label: 'TITLE SCREEN', scene: 'title', params: {} },
      ],
    });
  }

  // ------------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const t = this.game.time;
    this.renderWorld(ctx);
    ui.tagTimer(ctx, this.timer, t);
    for (const i of [0, 1] as const) {
      const s = this.sides[i];
      ui.tagSideHud(ctx, this.active(i), this.bench(i), i === 1, s.label, s.color, s.tagCd / TAG_COOLDOWN_FRAMES, t);
    }
    ui.comboCounter(ctx, this.comboShow[0], 40, 190, 'left', Math.min(1, this.comboFade[0] / 30), '#6fb6ff');
    ui.comboCounter(ctx, this.comboShow[1], CANVAS_WIDTH - 40, 190, 'right', Math.min(1, this.comboFade[1] / 30), '#ff7a8a');

    const pt = this.phaseTimer;
    const touch = this.game.input.touchMode;
    switch (this.phase) {
      case 'intro':
        if (pt < 90) ui.banner(ctx, 'TAG TEAM', `${this.teamName(0)}  vs  ${this.teamName(1)}`, pt, '#ffd21f');
        else ui.banner(ctx, 'FIGHT!', '', pt - 90, '#ffd21f');
        break;
      case 'ko':
        ui.banner(ctx, 'K.O.', '', pt, '#ff3b3b');
        if (pt > 110 && this.matchWinner !== -1) {
          ui.text(ctx, `${this.teamName(this.matchWinner)} WIN`, CANVAS_WIDTH / 2, 360, 28, '#ffffff', { stroke: '#000', strokeWidth: 5, alpha: Math.min(1, (pt - 110) / 10) });
        }
        break;
      case 'relay':
        if (pt < RELAY_BANNER_FRAMES) ui.banner(ctx, `${this.relayName.toUpperCase()} TAGS IN`, '', pt, this.koSide === 0 ? '#6fb6ff' : '#ff7a8a');
        break;
      case 'timeup':
        ui.banner(ctx, 'TIME', '', pt, '#ffd21f');
        if (pt > 80) {
          const text = this.matchWinner === -1 ? 'DRAW' : `${this.teamName(this.matchWinner)} WIN`;
          ui.text(ctx, text, CANVAS_WIDTH / 2, 360, 28, '#ffffff', { stroke: '#000', strokeWidth: 5, alpha: Math.min(1, (pt - 80) / 10) });
        }
        break;
      case 'matchEnd': {
        const w = this.matchWinner;
        const name = w === -1 ? 'DRAW GAME' : `${this.sides[w].label} WINS`;
        ui.banner(ctx, name, touch ? 'Tap ATK to continue' : 'Press J / Enter to continue', pt, w === 1 ? '#ff4d6d' : '#6fb6ff');
        break;
      }
      default:
        break;
    }
    if (this.phase === 'fight' && this.tagHintT > 0 && !this.paused) {
      const hint = touch ? 'TAG swaps in your partner  ·  hold BLK to block' : `${this.params.cpu ? 'I' : 'I  /  Numpad 5'} swaps in your partner  ·  ${this.params.cpu ? 'H' : 'H  /  Numpad 0'} blocks`;
      ui.text(ctx, hint, CANVAS_WIDTH / 2, 520, 12, 'rgba(255,255,255,0.6)', { template: FONT_UI, stroke: '#000', strokeWidth: 3, alpha: Math.min(1, this.tagHintT / 30) });
    }
    this.renderPause(ctx);
  }
}
