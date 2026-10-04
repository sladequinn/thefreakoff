import {
  BOSS_HP_MULT,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FONT_UI,
  RESPAWN_INVULN,
  STAGE_CLEAR_HEAL,
  STAGE_MAX_Z,
  STAGE_MIN_Z,
  STORY_LIVES,
  TEAM_ENEMY,
  TEAM_PLAYER,
  font,
} from '../config/constants';
import { FRECKLES } from '../characters/Freckles';
import { SLADE } from '../characters/Slade';
import type { MusicTrack } from '../core/AudioEngine';
import type { GameContext, SceneMap } from '../core/StateManager';
import { Boss } from '../entities/Boss';
import { Enemy, type EnemyKind } from '../entities/Enemy';
import type { Fighter } from '../entities/Fighter';
import { Player } from '../entities/Player';
import { FState, type Archetype, type Bounds, type StoryCharId, type Variant } from '../physics/Types';
import type { StageTheme } from '../rendering/Renderer';
import { CombatScene } from './Scene';

interface WaveDef {
  at: number;
  enemies: Variant[];
}

interface StageDef {
  label: string;
  name: string;
  theme: StageTheme;
  width: number;
  music: MusicTrack;
  waves: WaveDef[];
  boss?: boolean;
}

function stagesFor(kind: EnemyKind): StageDef[] {
  const mix: Variant = kind === 'ninjabot' ? 'alt' : 'heavy';
  return [
    {
      label: 'STAGE 1',
      name: 'THE OUTSKIRTS',
      theme: 'outskirts',
      width: 2600,
      music: 'stage',
      waves: [
        { at: 360, enemies: ['normal', 'normal', 'normal'] },
        { at: 1100, enemies: ['normal', 'normal', mix, 'normal'] },
        { at: 1640, enemies: ['normal', 'normal', 'normal', 'normal', 'elite'] },
      ],
    },
    {
      label: 'STAGE 2',
      name: 'PIER 9 HARBOR',
      theme: 'harbor',
      width: 2800,
      music: 'harbor',
      waves: [
        { at: 380, enemies: ['normal', mix, 'normal', mix] },
        { at: 1150, enemies: ['normal', 'normal', 'normal', mix, 'normal'] },
        { at: 1840, enemies: ['boss', 'normal', mix] },
      ],
    },
    {
      label: 'STAGE 3',
      name: 'THE CORE FACILITY',
      theme: 'facility',
      width: 2800,
      music: 'facility',
      waves: [
        { at: 420, enemies: ['normal', 'normal', 'normal', 'normal', 'normal'] },
        { at: 1200, enemies: ['normal', mix, 'normal', mix, 'normal', mix] },
        { at: 1840, enemies: ['elite', 'normal', mix, 'elite'] },
      ],
    },
    {
      label: 'STAGE 4',
      name: 'NEON SKYLINE',
      theme: 'rooftop',
      width: 2700,
      music: 'skyline',
      waves: [
        { at: 380, enemies: [mix, mix, 'normal', 'normal'] },
        { at: 1120, enemies: ['elite', 'normal', 'normal', mix, 'normal'] },
        { at: 1740, enemies: ['elite', 'elite', mix, 'normal', 'normal'] },
      ],
    },
    {
      label: 'STAGE 5',
      name: 'THE IRON FOUNDRY',
      theme: 'foundry',
      width: 3000,
      music: 'foundry',
      waves: [
        { at: 400, enemies: ['normal', 'normal', mix, mix, 'normal'] },
        { at: 1180, enemies: ['elite', 'normal', mix, 'normal', mix, 'normal'] },
        { at: 2040, enemies: ['boss', 'elite', mix, 'normal'] },
      ],
    },
    { label: 'STAGE 6', name: 'THE SANCTUARY', theme: 'sanctuary', width: CANVAS_WIDTH, music: 'boss', waves: [], boss: true },
  ];
}

/** Stages after which the player earns an extra life. */
const ONE_UP_AFTER = new Set([2, 4]);

interface Page {
  speaker: string;
  arch: Archetype | null;
  text: string;
}

const STORY: Record<StoryCharId, { pre: Page[][]; boss: string[]; ending: Page[] }> = {
  freckles: {
    pre: [
      [
        { speaker: 'NEO-KASAI, 2089', arch: null, text: 'The Iron Syndicate flooded the Outskirts with a new line of security automata overnight. Sleek. Silent. Built to move like one man.' },
        { speaker: 'FRECKLES', arch: 'brawler', text: "Those tin shinobi torched my garage and everyone who fixed cars there. Somebody's gonna answer for it. Starting with every bot between me and the Core." },
      ],
      [
        { speaker: 'FRECKLES', arch: 'brawler', text: 'Followed the scrap trail to Pier 9. The Syndicate ships these bots in by the crate load, every night, right under the harbor lights.' },
        { speaker: 'SYNDICATE PA', arch: null, text: 'PIER 9 ALERT. SHOGUN-X COMMAND UNIT ACTIVATED. DOCK CREWS EVACUATE. INTRUDER WILL BE FILED AS SCRAP.' },
      ],
      [
        { speaker: 'FRECKLES', arch: 'brawler', text: "Every one of these Ninjabots runs the same combat file. Same stance, same smoke tricks. I've seen it before — on a poster in the old dojo." },
        { speaker: 'SYNDICATE PA', arch: null, text: 'CORE FACILITY LOCKDOWN. MOTION TEMPLATE "SLADE" LICENSED TO ALL UNITS. INTRUDER: FRECKLES. PRIORITY: TERMINATE.' },
      ],
      [
        { speaker: 'FRECKLES', arch: 'brawler', text: 'Busted out through the vents and landed on the roof. Every billboard in the city is selling Syndicate steel. And there are shinobi on every ledge.' },
      ],
      [
        { speaker: 'FRECKLES', arch: 'brawler', text: "So this is where they pour 'em. Molten iron, conveyor lines, and a rebuilt Shogun guarding the forge. Wreck the forge and they can't make any more." },
        { speaker: 'SYNDICATE PA', arch: null, text: 'FOUNDRY BREACH. SHOGUN-X REBUILD COMPLETE. ALL LINES: PROTECT THE CRUCIBLE.' },
      ],
      [
        { speaker: 'FRECKLES', arch: 'brawler', text: 'The template signal leads up the mountain. A shrine, of all places. And somebody is waiting at the gate.' },
        { speaker: 'SLADE', arch: 'ninja', text: 'You broke my shadows all the way here. Impressive. But nobody reaches the Syndicate vault through my sanctuary without proving their fists are worth it.' },
      ],
    ],
    boss: ['SLADE: The Syndicate stole my form. I will not let a brawler steal my ground.', 'FRECKLES: Then stop talking and show me the original.'],
    ending: [
      { speaker: 'SLADE', arch: 'ninja', text: 'Enough. You fight like a landslide… and you never once hesitated. They copied my body, not my spirit. Yours they could never copy.' },
      { speaker: 'FRECKLES', arch: 'brawler', text: "So we're done hitting each other? Good. The vault is the next door up. Let's go break the Syndicate's toys — together." },
    ],
  },
  slade: {
    pre: [
      [
        { speaker: 'NEO-KASAI, 2089', arch: null, text: 'Hydraulic boxers stalk the Outskirts: Clownbots, forged by the Iron Syndicate from the fight data of one legendary carnival brawler.' },
        { speaker: 'SLADE', arch: 'ninja', text: 'Their pistons shake the old shrine every night. Someone taught iron to throw punches. I will unmake the lesson, one sigil at a time.' },
      ],
      [
        { speaker: 'SLADE', arch: 'ninja', text: 'The Clownbots arrive packed in shipping crates at Pier 9. The docks smell of brine and machine oil, and something large is waking in the hold.' },
        { speaker: 'SYNDICATE PA', arch: null, text: 'PIER 9 ALERT. FOREMAN MK-II ONLINE. SECURE THE SHIPMENT. THE NINJA IS NOT TO REACH THE CORE.' },
      ],
      [
        { speaker: 'SLADE', arch: 'ninja', text: "Each unit carries the same signature: a four-strike rhythm, a shoulder tackle, spikes on the knuckles. This is a living fighter's style — and the bells are a nice touch." },
        { speaker: 'SYNDICATE PA', arch: null, text: 'CORE FACILITY LOCKDOWN. MOTION TEMPLATE "FRECKLES" LICENSED TO ALL UNITS. INTRUDER: SLADE. PRIORITY: TERMINATE.' },
      ],
      [
        { speaker: 'SLADE', arch: 'ninja', text: 'Above the neon the wind carries the sound of their pistons. I will cross these rooftops faster than iron can climb.' },
      ],
      [
        { speaker: 'SLADE', arch: 'ninja', text: 'The forge where they are born. Every chassis poured here carries a stolen fighting style. Tonight, the fire goes out.' },
        { speaker: 'SYNDICATE PA', arch: null, text: 'FOUNDRY BREACH. FOREMAN MK-II REBUILT AND REINFORCED. ALL LINES: PROTECT THE CRUCIBLE.' },
      ],
      [
        { speaker: 'SLADE', arch: 'ninja', text: 'The trail ends at my own sanctuary. The gate is already broken open — and the one who broke it is cracking their knuckles.' },
        { speaker: 'FRECKLES', arch: 'brawler', text: 'So YOU are the ghost wrecking my copies. Figures. Syndicate says you sold them my moves. Only one way I trust an answer.' },
      ],
    ],
    boss: ['FRECKLES: I licensed nothing. Somebody stole me, and I think it was you.', "SLADE: Then strike. Your fists will tell you what my words can't."],
    ending: [
      { speaker: 'FRECKLES', arch: 'brawler', text: "…Okay. Nobody who fights that clean works for the Syndicate. You're the real deal, ninja." },
      { speaker: 'SLADE', arch: 'ninja', text: 'And you hit harder than every copy combined. The vault lies beneath this shrine. Shall we return what was stolen from us both?' },
    ],
  },
};

type Phase = 'card' | 'play' | 'clear' | 'bossIntro' | 'bossDown' | 'ending' | 'gameover';

export class StoryScene extends CombatScene {
  readonly mode = 'story' as const;
  private readonly params: SceneMap['story'];
  private readonly player: Player;
  private readonly enemyKind: EnemyKind;
  private readonly stages: StageDef[];
  private stageIndex: number;
  private stage!: StageDef;
  private phase: Phase = 'card';
  private phaseTimer = 0;
  private pages: Page[] = [];
  private pageIndex = 0;
  private typed = 0;
  private waveIndex = 0;
  private waveActive = false;
  private exitOpen = false;
  private goTimer = 0;
  private bannerTimer = 0;
  private boss: Boss | null = null;
  private midBoss: Enemy | null = null;
  private midBossTimer = 0;
  private focus: Fighter | null = null;
  private focusTimer = 0;
  private startScore = 0;
  private startLives: number = STORY_LIVES;
  private startFrame = 0;
  private epilogue = false;

  constructor(game: GameContext, params: SceneMap['story']) {
    super(game);
    this.params = params;
    const def = params.char === 'slade' ? SLADE : FRECKLES;
    this.player = new Player(def, game.input, 0, TEAM_PLAYER);
    this.player.score = params.score;
    this.player.lives = params.lives;
    this.enemyKind = params.char === 'slade' ? 'clownbot' : 'ninjabot';
    this.stages = stagesFor(this.enemyKind);
    this.stageIndex = Math.max(0, Math.min(this.stages.length - 1, params.stage));
    this.setupStage(this.stageIndex);
    this.openCard(STORY[params.char].pre[this.stageIndex]);
  }

  enter(): void {
    this.audio.startMusic(this.stage.music);
  }

  exit(): void {
    this.audio.stopMusic();
  }

  protected restart(): void {
    this.game.scenes.go('story', { char: this.params.char, stage: this.stageIndex, score: this.startScore, lives: this.startLives });
  }

  private setupStage(i: number): void {
    this.stage = this.stages[i];
    this.theme = this.stage.theme;
    this.stageWidth = this.stage.width;
    this.camera.reset(this.stage.width, 0);
    this.fighters = [this.player];
    this.projectiles = [];
    this.particles.clear();
    this.waveIndex = 0;
    this.waveActive = false;
    this.exitOpen = false;
    this.goTimer = 0;
    this.boss = null;
    this.midBoss = null;
    this.focus = null;
    this.maxTokens = this.enemyKind === 'clownbot' ? 3 : 2;
    const p = this.player;
    p.x = 140;
    p.z = 430;
    p.y = 0;
    p.vx = p.vy = p.vz = 0;
    p.facing = 1;
    p.move = null;
    p.hidden = false;
    p.setState(FState.IDLE);
    this.startScore = p.score;
    this.startLives = p.lives;
    this.startFrame = this.frame;

    if (this.stage.boss) {
      const bossDef = this.params.char === 'slade' ? FRECKLES : SLADE;
      const boss = new Boss(bossDef, { team: TEAM_ENEMY, hpMult: BOSS_HP_MULT, versus: false, difficulty: 1 });
      boss.x = 780;
      boss.z = 430;
      boss.setState(FState.INTRO);
      this.boss = boss;
      this.fighters.push(boss);
      p.x = 200;
    }
  }

  private openCard(pages: Page[]): void {
    this.pages = pages;
    this.pageIndex = 0;
    this.typed = 0;
    this.phase = 'card';
    this.player.human.enabled = false;
  }

  private beginPlay(): void {
    this.player.human.enabled = true;
    this.bannerTimer = 0;
    if (this.stage.boss && this.boss && this.boss.state === FState.INTRO) {
      this.phase = 'bossIntro';
      this.phaseTimer = 0;
      this.player.human.enabled = false;
      this.audio.playWarning();
    } else {
      this.phase = 'play';
    }
  }

  // ------------------------------------------------------------------ World

  boundsFor(f: Fighter): Bounds {
    const cam = this.camera;
    if (this.stage.boss) return this.depthBounds(30, CANVAS_WIDTH - 30);
    if (f === this.player) {
      const left = cam.x + 24;
      const right = cam.locked ? cam.lockedAt + CANVAS_WIDTH - 24 : Math.min(this.stageWidth - 24, cam.x + CANVAS_WIDTH - 24);
      return this.depthBounds(left, right);
    }
    if (f instanceof Enemy && f.entered) return this.depthBounds(cam.x + 20, cam.x + CANVAS_WIDTH - 20);
    return this.depthBounds(cam.x - 240, cam.x + CANVAS_WIDTH + 240);
  }

  onHitLanded(attacker: Fighter, target: Fighter, damage: number): void {
    if (attacker === this.player) {
      this.player.addScore(damage * 12 + 10);
      if (target !== this.boss && target !== this.midBoss) {
        this.focus = target;
        this.focusTimer = 180;
      }
    }
  }

  onFighterKO(f: Fighter): void {
    if (f instanceof Enemy) {
      this.player.addScore(f.scoreValue);
      this.releaseToken(f);
      if (f === this.midBoss) {
        this.slowmo = 70;
        this.audio.playKO();
      }
    } else if (f === this.boss) {
      this.player.addScore(10000);
      this.slowmo = 110;
      this.phase = 'bossDown';
      this.phaseTimer = 0;
      this.audio.playKO();
      this.audio.stopMusic();
    } else if (f === this.player) {
      this.audio.playKO();
    }
  }

  // ------------------------------------------------------------------ flow

  private spawnWave(w: WaveDef): void {
    const lockX = this.camera.lockedAt;
    w.enemies.forEach((variant, i) => {
      const right = i % 2 === 0;
      const x = right ? lockX + CANVAS_WIDTH + 60 + i * 34 : lockX - 60 - i * 26;
      const z = variant === 'boss' ? (STAGE_MIN_Z + STAGE_MAX_Z) / 2 : STAGE_MIN_Z + 20 + Math.random() * (STAGE_MAX_Z - STAGE_MIN_Z - 40);
      const e = new Enemy(this.enemyKind, variant, x, z);
      e.facing = right ? -1 : 1;
      this.fighters.push(e);
      if (variant === 'boss') {
        this.midBoss = e;
        this.midBossTimer = 0;
        this.audio.startMusic('boss');
      }
    });
    this.audio.playWarning();
  }

  private enemiesAlive(): number {
    let n = 0;
    for (const f of this.fighters) if (f.team === TEAM_ENEMY && !f.remove) n++;
    return n;
  }

  private updatePlay(): void {
    const p = this.player;
    const cam = this.camera;
    this.bannerTimer++;
    if (this.goTimer > 0) this.goTimer--;
    if (this.focusTimer > 0) this.focusTimer--;
    else this.focus = null;

    if (!this.stage.boss) {
      cam.follow(p.x);
      const wave = this.stage.waves[this.waveIndex];
      if (!this.waveActive && wave && p.x - CANVAS_WIDTH * 0.42 >= wave.at) {
        cam.lock(wave.at);
        this.waveActive = true;
        this.spawnWave(wave);
      }
      if (this.midBoss) this.midBossTimer++;
      if (this.waveActive && this.enemiesAlive() === 0) {
        this.waveActive = false;
        if (this.midBoss) {
          this.midBoss = null;
          this.audio.startMusic(this.stage.music);
        }
        cam.unlock();
        this.waveIndex++;
        this.goTimer = 220;
        this.audio.playGo();
        if (this.waveIndex >= this.stage.waves.length) this.exitOpen = true;
      }
      for (const f of this.fighters) {
        if (f instanceof Enemy && !f.entered && f.x > cam.x + 30 && f.x < cam.x + CANVAS_WIDTH - 30) f.entered = true;
      }
      if (this.exitOpen && p.x > this.stageWidth - 90) {
        this.phase = 'clear';
        this.phaseTimer = 0;
        this.audio.playConfirm();
        p.human.enabled = false;
      }
    }

    if (p.state === FState.DEAD) {
      p.deadTimer++;
      if (p.deadTimer > 70) {
        if (p.lives > 0) this.respawn();
        else this.toGameOver(false);
      }
    }
  }

  private respawn(): void {
    const p = this.player;
    p.lives--;
    p.deadTimer = 0;
    p.hp = p.displayHp = p.maxHp;
    p.koNotified = false;
    p.x = this.camera.x + 220;
    p.z = 430;
    p.y = 240;
    p.vx = p.vy = 0;
    p.invulnTimer = RESPAWN_INVULN;
    p.setState(FState.JUMP);
    p.airAttackUsed = true;
    this.particles.ring(p.x, p.z, 10, 160, '#ffffff', 30);
    for (const f of this.fighters) {
      if (f.team === TEAM_ENEMY && f.isTargetable() && Math.abs(f.x - p.x) < 260) {
        f.vx = Math.sign(f.x - p.x || 1) * 9;
      }
    }
    this.audio.playPickup();
  }

  private nextStage(): void {
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * STAGE_CLEAR_HEAL);
    if (ONE_UP_AFTER.has(this.stageIndex)) p.lives++;
    this.stageIndex++;
    this.setupStage(this.stageIndex);
    this.audio.startMusic(this.stage.music);
    this.openCard(STORY[this.params.char].pre[this.stageIndex]);
  }

  private toGameOver(victory: boolean): void {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
    const p = this.player;
    const secs = Math.floor((this.frame - this.startFrame) / 60);
    const lines = [
      `SCORE  ${String(p.score).padStart(7, '0')}`,
      `ROBOTS DESTROYED  ${p.combat.kos}`,
      `BEST COMBO  ${p.combat.maxCombo} HITS`,
      `DAMAGE DEALT  ${Math.round(p.combat.damageDealt)}`,
    ];
    if (!victory) lines.push(`FELL IN ${this.stage.name} (${secs}s)`);
    this.game.scenes.go('gameover', {
      title: victory ? 'VICTORY' : 'GAME OVER',
      subtitle: victory
        ? `${p.name} conquered the Sanctuary — the Syndicate's vault awaits.`
        : `The ${this.enemyKind === 'ninjabot' ? 'Ninjabots' : 'Clownbots'} overran ${p.name}.`,
      accent: victory ? '#ffd21f' : '#ff3b3b',
      victory,
      portrait: this.params.char,
      lines,
      options: victory
        ? [
            { label: 'PLAY AGAIN', scene: 'select', params: { mode: 'story', cpu: false } },
            { label: 'VERSUS MODE', scene: 'select', params: { mode: 'versus', cpu: true } },
            { label: 'TITLE SCREEN', scene: 'title', params: {} },
          ]
        : [
            { label: `CONTINUE FROM ${this.stage.label}`, scene: 'story', params: { char: this.params.char, stage: this.stageIndex, score: 0, lives: STORY_LIVES } },
            { label: 'CHARACTER SELECT', scene: 'select', params: { mode: 'story', cpu: false } },
            { label: 'TITLE SCREEN', scene: 'title', params: {} },
          ],
    });
  }

  update(): void {
    if (this.phase === 'gameover') return;
    if (this.phase === 'card') {
      this.updateCard();
      return;
    }
    if (this.handlePause()) return;

    this.phaseTimer++;
    switch (this.phase) {
      case 'play':
        this.updatePlay();
        break;
      case 'bossIntro':
        if (this.phaseTimer === 1) this.audio.playVoiceGrunt(this.boss!.def.voice, 'hah');
        if (this.phaseTimer > 230 || (this.phaseTimer > 40 && this.game.input.menu().confirm)) {
          this.boss!.setState(FState.IDLE);
          this.player.human.enabled = true;
          this.phase = 'play';
          this.phaseTimer = 0;
          this.bannerTimer = 0;
          this.audio.playBell();
        }
        break;
      case 'clear':
        if (this.phaseTimer > 150) this.nextStage();
        break;
      case 'bossDown':
        if (this.phaseTimer === 120) {
          this.player.setState(FState.VICTORY);
          this.player.vx = 0;
          this.player.human.enabled = false;
          this.audio.startMusic('victory');
        }
        if (this.phaseTimer > 260) {
          this.phase = 'ending';
          this.epilogue = true;
          this.openCard(STORY[this.params.char].ending);
        }
        break;
      default:
        break;
    }
    if ((this.phase as string) === 'card') return;
    this.stepWorld();
  }

  private updateCard(): void {
    const page = this.pages[this.pageIndex];
    this.typed += 1.4;
    this.frame++;
    this.particles.update();
    const m = this.game.input.menu();
    if (m.confirm) {
      if (this.typed < page.text.length) {
        this.typed = page.text.length;
      } else {
        this.pageIndex++;
        this.typed = 0;
        this.audio.playSelect();
        if (this.pageIndex >= this.pages.length) {
          if (this.stage.boss && this.boss?.state === FState.DEAD) {
            this.toGameOver(true);
            return;
          }
          this.beginPlay();
        }
      }
    }
    if (m.back && this.pageIndex < this.pages.length) {
      if (this.stage.boss && this.boss?.state === FState.DEAD) {
        this.toGameOver(true);
        return;
      }
      this.beginPlay();
    }
  }

  // ------------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const t = this.game.time;
    this.renderWorld(ctx);

    if (this.phase !== 'card' && this.phase !== 'ending') {
      ui.storyHud(ctx, this.player, this.focus, t, `${this.stage.label} · ${this.stage.name}`);
      if (this.boss && this.phase !== 'bossIntro') ui.bossBar(ctx, this.boss, t, this.boss.state === FState.INTRO ? 0 : 60);
      if (this.phase === 'play' && this.bannerTimer < 150 && !this.stage.boss) {
        ui.banner(ctx, this.stage.label, this.stage.name, this.bannerTimer, '#b98aff', 200);
      }
      if (this.phase === 'play' && this.stage.boss && this.bannerTimer < 70) ui.banner(ctx, 'FIGHT!', '', this.bannerTimer, '#ffd21f', 220);
      if (this.phase === 'play' && (this.goTimer > 0 || (this.exitOpen && !this.waveActive))) ui.goArrow(ctx, t);
      if (this.waveActive && this.phase === 'play' && this.camera.locked) {
        ui.text(ctx, `ENEMIES  ${this.enemiesAlive()}`, CANVAS_WIDTH - 16, 46, 12, '#ff9aa8', { align: 'right', template: FONT_UI, stroke: '#000', strokeWidth: 3 });
      }
      const mb = this.midBoss;
      if (mb && !mb.remove && this.phase === 'play') {
        if (mb.state !== FState.DEAD) ui.bossBar(ctx, mb, t, this.midBossTimer, 'WARDEN');
        if (this.midBossTimer < 140) ui.banner(ctx, 'WARNING', `${mb.name} APPROACHING`, this.midBossTimer, '#ff3b3b', 200);
      }
      if (this.phase === 'clear') {
        const heal = `+${Math.round(STAGE_CLEAR_HEAL * 100)}% HEALTH RESTORED`;
        ui.banner(ctx, 'STAGE CLEAR', ONE_UP_AFTER.has(this.stageIndex) ? `${heal}  ·  EXTRA LIFE!` : heal, this.phaseTimer, '#ffd21f');
      }
      if (this.phase === 'bossIntro') this.renderBossIntro(ctx);
      if (this.phase === 'bossDown' && this.phaseTimer < 200) ui.banner(ctx, 'K.O.', '', this.phaseTimer, '#ff3b3b');
      if (this.player.state === FState.DEAD && this.player.lives > 0) {
        ui.text(ctx, `LIVES LEFT: ${this.player.lives}`, CANVAS_WIDTH / 2, 300, 22, '#ffffff', { stroke: '#000', strokeWidth: 4 });
      }
    }
    if (this.phase === 'card' || this.phase === 'ending') this.renderCard(ctx);
    this.renderPause(ctx);
  }

  private renderBossIntro(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const t = this.phaseTimer;
    const boss = this.boss!;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 70);
    ctx.fillRect(0, CANVAS_HEIGHT - 100, CANVAS_WIDTH, 100);
    ctx.restore();
    ui.text(ctx, 'WARNING', CANVAS_WIDTH / 2, 48, 30, Math.floor(t / 8) % 2 ? '#ff3b3b' : '#ffd21f', { stroke: '#000', strokeWidth: 5 });
    if (t > 30) ui.banner(ctx, boss.name, `${boss.def.title.toUpperCase()}  ·  AI MASTER`, t - 30, boss.def.archetype === 'ninja' ? '#b98aff' : '#ece8f0', 200);
    const lines = STORY[this.params.char].boss;
    lines.forEach((line, i) => {
      if (t > 70 + i * 60) ui.text(ctx, line, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 62 + i * 26, 15, i === 0 ? '#ffd6a8' : '#d6c4ff', { template: FONT_UI, stroke: '#000', strokeWidth: 3 });
    });
  }

  private renderCard(ctx: CanvasRenderingContext2D): void {
    const ui = this.game.ui;
    const page = this.pages[Math.min(this.pageIndex, this.pages.length - 1)];
    if (!page) return;
    ctx.save();
    ctx.fillStyle = 'rgba(4,2,10,0.78)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
    const title = this.epilogue ? 'EPILOGUE' : `${this.stage.label}  ·  ${this.stage.name}`;
    ui.text(ctx, title, CANVAS_WIDTH / 2, 90, 30, '#ffffff', { stroke: '#000', strokeWidth: 5, shadow: 'rgba(138,77,255,0.8)' });
    const route = this.params.char === 'slade' ? 'SLADE ROUTE · CLOWNBOT UPRISING' : 'FRECKLES ROUTE · NINJABOT PURGE';
    ui.text(ctx, route, CANVAS_WIDTH / 2, 118, 12, 'rgba(255,255,255,0.55)', { template: FONT_UI });

    const px = 90;
    const py = 250;
    const pw = CANVAS_WIDTH - 180;
    const ph = 190;
    ui.panel(ctx, px, py, pw, ph, 'rgba(14,10,28,0.92)', 'rgba(185,138,255,0.5)');
    let tx = px + 40;
    if (page.arch) {
      const variant = page.arch === (this.params.char === 'slade' ? 'ninja' : 'brawler') ? 'normal' : 'boss';
      ctx.save();
      ctx.fillStyle = page.arch === 'ninja' ? '#2a1450' : '#4a1c0a';
      ctx.fillRect(px + 24, py + 24, 130, 140);
      ctx.restore();
      this.game.sprites.drawPortrait(ctx, page.arch, variant, px + 24, py + 24, 130, 140, 1, this.game.time);
      tx = px + 180;
    }
    ui.text(ctx, page.speaker, tx, py + 46, 18, page.arch === 'ninja' ? '#c79bff' : page.arch === 'brawler' ? '#ffb13b' : '#9fe8ff', { align: 'left', stroke: '#000', strokeWidth: 3 });
    const shown = page.text.slice(0, Math.floor(this.typed));
    this.wrapText(ctx, shown, tx, py + 78, px + pw - tx - 30, 22);
    if (this.typed >= page.text.length && Math.floor(this.game.time / 20) % 2 === 0) {
      ui.text(ctx, this.game.input.touchMode ? '▶  TAP ATK' : '▶  J / ENTER', px + pw - 30, py + ph - 18, 12, '#ffd21f', { align: 'right', template: FONT_UI });
    }
    ui.text(ctx, `${this.pageIndex + 1} / ${this.pages.length}     ESC — skip`, px + 40, py + ph - 18, 11, 'rgba(255,255,255,0.4)', { align: 'left', template: FONT_UI });
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
    ctx.save();
    ctx.font = font(FONT_UI, 16);
    ctx.fillStyle = '#f0ecff';
    ctx.textAlign = 'left';
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = w;
        yy += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
    ctx.restore();
  }
}
