import { CANVAS_WIDTH, FONT_UI, TEAM_ENEMY, TEAM_PLAYER, VS_ARENA_MARGIN, VS_ROUNDS_TO_WIN, VS_ROUND_SECONDS } from '../config/constants';
import { CPU_DIFFICULTY, STAGE_INFO, nextStage, resolveStage } from '../config/stages';
import { charDef } from '../characters';
import type { GameContext, SceneMap } from '../core/StateManager';
import { Boss } from '../entities/Boss';
import type { Fighter } from '../entities/Fighter';
import { Player } from '../entities/Player';
import { FState, type Bounds, type CharId } from '../physics/Types';
import { CombatScene } from './Scene';

type RoundPhase = 'intro' | 'fight' | 'ko' | 'timeup' | 'roundEnd' | 'matchEnd';

const defOf = charDef;

/** Picks a victory line, preferring one aimed at the specific opponent when the character has it. */
export function winQuote(winner: Fighter, loser: Fighter, seed: number): string {
  const vs = winner.def.winQuotesVs?.[loser.def.id as CharId];
  if (vs && vs.length > 0) return vs[seed % vs.length];
  const pool = winner.def.winQuotes ?? [];
  if (pool.length === 0) return '';
  return pool[seed % pool.length];
}

export class VsScene extends CombatScene {
  readonly mode = 'versus' as const;
  private readonly params: SceneMap['vs'];
  private readonly p1: Player;
  private readonly p2: Fighter;
  private round = 1;
  private wins: [number, number] = [0, 0];
  private timer = VS_ROUND_SECONDS;
  private phase: RoundPhase = 'intro';
  private phaseTimer = 0;
  private roundWinner: 0 | 1 | -1 = -1;
  private comboShow: [number, number] = [0, 0];
  private comboFade: [number, number] = [0, 0];
  private perfect = false;
  private matchWinner: 0 | 1 | -1 = -1;

  constructor(game: GameContext, params: SceneMap['vs']) {
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
    this.p1 = new Player(defOf(params.p1), game.input, 0, TEAM_PLAYER, v1);
    if (params.cpu) {
      const difficulty = CPU_DIFFICULTY[game.save.settings.cpuDifficulty].value;
      this.p2 = new Boss(defOf(params.p2), { team: TEAM_ENEMY, hpMult: 1, versus: true, difficulty, variant: v2 });
    } else {
      this.p2 = new Player(defOf(params.p2), game.input, 1, TEAM_ENEMY, v2);
    }
    for (const f of [this.p1, this.p2]) f.canBlock = true;
    this.p1.autoFace = this.p2;
    this.p2.autoFace = this.p1;
    this.fighters = [this.p1, this.p2];
    this.startRound();
  }

  enter(): void {
    this.audio.startMusic('versus', this.theme);
  }

  exit(): void {
    this.audio.stopMusic();
  }

  protected restart(): void {
    this.game.scenes.go('vs', { ...this.params, stage: this.theme });
  }

  protected pauseExit(): { label: string; go: () => void } {
    return { label: 'CHARACTER SELECT', go: () => this.game.scenes.go('select', { mode: 'versus', cpu: this.params.cpu }) };
  }

  boundsFor(): Bounds {
    return this.depthBounds(VS_ARENA_MARGIN, CANVAS_WIDTH - VS_ARENA_MARGIN);
  }

  private startRound(): void {
    this.p1.resetForRound(300, 430, 1);
    this.p2.resetForRound(660, 430, -1);
    this.p2.autoFace = this.p1;
    this.projectiles = [];
    this.particles.clear();
    this.timer = VS_ROUND_SECONDS;
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.roundWinner = -1;
    this.comboShow = [0, 0];
    this.comboFade = [0, 0];
  }

  onFighterKO(): void {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.phaseTimer = 0;
    this.slowmo = 70;
    this.audio.playKO();
    this.camera.shake(10, 0, 1, 20);
  }

  private decideRound(): void {
    const a = this.p1.hp / this.p1.maxHp;
    const b = this.p2.hp / this.p2.maxHp;
    if (this.p1.hp <= 0 && this.p2.hp <= 0) this.roundWinner = -1;
    else if (this.p2.hp <= 0) this.roundWinner = 0;
    else if (this.p1.hp <= 0) this.roundWinner = 1;
    else if (Math.abs(a - b) < 0.001) this.roundWinner = -1;
    else this.roundWinner = a > b ? 0 : 1;

    if (this.roundWinner === -1) {
      this.wins[0] = Math.min(VS_ROUNDS_TO_WIN, this.wins[0] + 1);
      this.wins[1] = Math.min(VS_ROUNDS_TO_WIN, this.wins[1] + 1);
    } else {
      this.wins[this.roundWinner]++;
      const w = this.roundWinner === 0 ? this.p1 : this.p2;
      this.perfect = w.hp >= w.maxHp - 0.01;
      w.move = null;
      w.setState(FState.VICTORY);
      this.audio.playTaunt(w.def.voice);
    }
  }

  update(): void {
    if (this.phase !== 'matchEnd' && this.handlePause()) return;
    this.phaseTimer++;

    for (let i = 0; i < 2; i++) {
      const victim = i === 0 ? this.p2 : this.p1;
      if (victim.comboTaken >= 2) {
        this.comboShow[i] = victim.comboTaken;
        this.comboFade[i] = 90;
      } else if (this.comboFade[i] > 0) {
        this.comboFade[i]--;
      }
    }

    switch (this.phase) {
      case 'intro':
        if (this.phaseTimer === 10) this.audio.playBell();
        if (this.phaseTimer === 40) this.audio.playTaunt(this.p2.def.voice, 0);
        if (this.phaseTimer === 90) this.audio.playTaunt(this.p1.def.voice, 0);
        if (this.phaseTimer === 100) this.audio.playGo();
        if (this.phaseTimer >= 110) {
          this.p1.setState(FState.IDLE);
          this.p2.setState(FState.IDLE);
          this.phase = 'fight';
          this.phaseTimer = 0;
        }
        break;
      case 'fight':
        this.timer -= 1 / 60;
        if (this.timer <= 0) {
          this.timer = 0;
          this.phase = 'timeup';
          this.phaseTimer = 0;
          this.audio.playBell();
          for (const f of this.fighters) {
            if (f.isActionable()) f.setState(FState.INTRO);
          }
        }
        break;
      case 'ko':
        if (this.phaseTimer === 110) this.decideRound();
        if (this.phaseTimer > 220) this.finishRound();
        break;
      case 'timeup':
        for (const f of this.fighters) if (f.isActionable()) f.setState(FState.INTRO);
        if (this.phaseTimer === 80) this.decideRound();
        if (this.phaseTimer > 200) this.finishRound();
        break;
      case 'roundEnd':
        if (this.phaseTimer > 30) {
          this.round++;
          this.startRound();
        }
        break;
      case 'matchEnd':
        if (this.phaseTimer > 170) this.toResults();
        if (this.phaseTimer > 40 && this.game.input.menu().confirm) this.toResults();
        break;
    }
    this.stepWorld();
  }

  private finishRound(): void {
    const [a, b] = this.wins;
    if (a >= VS_ROUNDS_TO_WIN || b >= VS_ROUNDS_TO_WIN) {
      this.matchWinner = a >= VS_ROUNDS_TO_WIN && b >= VS_ROUNDS_TO_WIN ? -1 : a >= VS_ROUNDS_TO_WIN ? 0 : 1;
      this.phase = 'matchEnd';
      this.phaseTimer = 0;
      this.audio.startMusic('victory');
    } else {
      this.phase = 'roundEnd';
      this.phaseTimer = 0;
    }
  }

  private toResults(): void {
    if (this.game.scenes.transitioning) return;
    const w = this.matchWinner;
    const winner = w === 0 ? this.p1 : w === 1 ? this.p2 : null;
    const loser = w === 0 ? this.p2 : this.p1;
    const p2Tag = this.params.cpu ? 'CPU' : '2P';
    const title = w === -1 ? 'DRAW GAME' : w === 0 ? '1P WINS' : `${p2Tag} WINS`;
    const stage = STAGE_INFO[this.theme].name;
    const difficulty = this.params.cpu ? `  ·  CPU ${CPU_DIFFICULTY[this.game.save.settings.cpuDifficulty].label}` : '';
    const humanWinner = w === 0 || (!this.params.cpu && w === 1);
    const rec = this.game.save.recordVs(humanWinner && winner ? (winner.def.id as CharId) : null, Math.max(this.p1.combat.maxCombo, this.p2.combat.maxCombo), this.params.cpu);
    const extra: string[] = [];
    if (rec.combo && Math.max(this.p1.combat.maxCombo, this.p2.combat.maxCombo) > 1) extra.push('★ NEW BEST COMBO');
    if (rec.alt && winner) extra.push(`UNLOCKED: ${winner.name.toUpperCase()} ALT COSTUME`);
    this.game.scenes.go('gameover', {
      title,
      subtitle: winner ? `${winner.name} takes the match ${this.wins[w as 0 | 1]} – ${this.wins[w === 0 ? 1 : 0]}` : 'Nobody walks away from this one a winner.',
      quote: winner ? winQuote(winner, loser, this.p1.combat.hitsLanded + this.p2.combat.hitsLanded + this.round) : undefined,
      accent: w === 1 ? '#ff4d6d' : '#6fb6ff',
      victory: w === 0 || (!this.params.cpu && w === 1),
      portrait: winner ? (winner.def.id as CharId) : undefined,
      portraitVariant: winner?.variant === 'alt' ? 'alt' : 'normal',
      lines: [
        `1P ${this.p1.name}  ·  ${this.p1.combat.hitsLanded} hits  ·  best combo ${this.p1.combat.maxCombo}`,
        `${p2Tag} ${this.p2.name}  ·  ${this.p2.combat.hitsLanded} hits  ·  best combo ${this.p2.combat.maxCombo}`,
        `${stage}  ·  ${this.round} ROUNDS${difficulty}`,
        ...extra,
      ],
      options: [
        { label: 'REMATCH', scene: 'vs', params: { ...this.params, stage: this.theme } },
        { label: 'NEXT STAGE', scene: 'vs', params: { ...this.params, stage: nextStage(this.theme) } },
        { label: 'CHARACTER SELECT', scene: 'select', params: { mode: 'versus', cpu: this.params.cpu } },
        { label: 'TITLE SCREEN', scene: 'title', params: {} },
      ],
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const t = this.game.time;
    this.renderWorld(ctx);
    ui.vsHud(ctx, this.p1, this.p2, this.wins, VS_ROUNDS_TO_WIN, this.timer, t, this.params.cpu ? 'CPU' : '2P');
    ui.comboCounter(ctx, this.comboShow[0], 40, 170, 'left', Math.min(1, this.comboFade[0] / 30), '#6fb6ff');
    ui.comboCounter(ctx, this.comboShow[1], CANVAS_WIDTH - 40, 170, 'right', Math.min(1, this.comboFade[1] / 30), '#ff7a8a');

    const pt = this.phaseTimer;
    switch (this.phase) {
      case 'intro':
        if (pt < 90) ui.banner(ctx, this.round >= 3 && this.wins[0] === this.wins[1] ? 'FINAL ROUND' : `ROUND ${this.round}`, '', pt, '#b98aff');
        else ui.banner(ctx, 'FIGHT!', '', pt - 90, '#ffd21f');
        break;
      case 'ko':
        ui.banner(ctx, 'K.O.', '', pt, '#ff3b3b');
        if (pt > 110) this.renderRoundResult(ctx, pt - 110);
        break;
      case 'timeup':
        ui.banner(ctx, 'TIME', '', pt, '#ffd21f');
        if (pt > 80) this.renderRoundResult(ctx, pt - 80);
        break;
      case 'matchEnd': {
        const w = this.matchWinner;
        const name = w === -1 ? 'DRAW GAME' : `${w === 0 ? this.p1.name : this.p2.name} WINS`;
        ui.banner(ctx, name, this.game.input.touchMode ? 'Tap ATK to continue' : 'Press J / Enter to continue', pt, w === 1 ? '#ff4d6d' : '#6fb6ff');
        break;
      }
      default:
        break;
    }
    if (this.params.cpu && this.phase === 'fight' && this.phaseTimer < 240) {
      ui.text(ctx, 'Hold away from your opponent to BLOCK', CANVAS_WIDTH / 2, 520, 12, 'rgba(255,255,255,0.6)', { template: FONT_UI, stroke: '#000', strokeWidth: 3 });
    }
    this.renderPause(ctx);
  }

  private renderRoundResult(ctx: CanvasRenderingContext2D, t: number): void {
    const ui = this.game.ui;
    const w = this.roundWinner;
    const text = w === -1 ? 'DOUBLE K.O.' : `${w === 0 ? this.p1.name : this.p2.name} WINS`;
    ui.text(ctx, text, CANVAS_WIDTH / 2, 360, 30, '#ffffff', { stroke: '#000', strokeWidth: 5, alpha: Math.min(1, t / 10) });
    if (this.perfect && w !== -1) ui.text(ctx, 'PERFECT', CANVAS_WIDTH / 2, 396, 22, '#ffd21f', { stroke: '#000', strokeWidth: 4, alpha: Math.min(1, t / 10) });
  }
}
