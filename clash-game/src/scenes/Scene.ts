import { COLORS, LIGHT_HIT_THRESHOLD, PIXEL_SIZE, STAGE_MAX_Z, STAGE_MIN_Z } from '../config/constants';
import { Camera } from '../core/Camera';
import type { AudioEngine } from '../core/AudioEngine';
import type { GameContext } from '../core/StateManager';
import type { Entity, Projectile, RenderView } from '../entities/Entity';
import type { Fighter, HitResult } from '../entities/Fighter';
import { ParticleSystem } from '../entities/Particle';
import { boxesOverlap, checkHit, hitboxWorld, hurtboxWorld, separateBodies } from '../physics/Collision';
import { FState, type Bounds, type GameMode, type Hitbox, type World } from '../physics/Types';
import type { StageTheme } from '../rendering/Renderer';

export abstract class Scene {
  constructor(protected readonly game: GameContext) {}
  enter(): void {}
  exit(): void {}
  abstract update(): void;
  abstract render(ctx: CanvasRenderingContext2D, alpha: number): void;
}

interface PauseItem {
  label: string;
  /** Toggles flip a setting and keep the menu open. */
  toggle: boolean;
  act: () => void;
}

const TOKEN_STATES = new Set<FState>([FState.IDLE, FState.WALK, FState.RUN, FState.ATTACK, FState.PREJUMP, FState.JUMP, FState.LAND]);
const PROJECTILE_HURTBOX = { offsetX: 0, offsetY: 0, width: 18, height: 18, zDepth: 10 };

/**
 * Shared simulation for every mode that has fighters on a belt: update order, hit resolution,
 * hitstop, projectiles, particles, painter's-sorted rendering, pause menu and the debug overlay.
 */
export abstract class CombatScene extends Scene implements World {
  abstract readonly mode: GameMode;
  frame = 0;
  fighters: Fighter[] = [];
  projectiles: Projectile[] = [];
  readonly particles = new ParticleSystem();
  readonly camera = new Camera();
  theme: StageTheme = 'outskirts';
  stageWidth = 960;
  maxTokens = 2;
  private tokens = new Set<Fighter>();
  private drawList: Entity[] = [];
  slowmo = 0;
  private slowTick = 0;
  paused = false;
  private pauseIndex = 0;

  get audio(): AudioEngine {
    return this.game.audio;
  }

  abstract boundsFor(f: Fighter): Bounds;
  protected abstract restart(): void;

  spawnProjectile(p: Projectile): void {
    this.projectiles.push(p);
  }

  requestToken(f: Fighter): boolean {
    if (this.tokens.has(f)) return true;
    if (this.tokens.size >= this.maxTokens) return false;
    this.tokens.add(f);
    return true;
  }

  releaseToken(f: Fighter): void {
    this.tokens.delete(f);
  }

  protected depthBounds(minX: number, maxX: number): Bounds {
    return { minX, maxX, minZ: STAGE_MIN_Z, maxZ: STAGE_MAX_Z };
  }

  /** Scene-specific "leave the match" destination shown in the pause menu, e.g. the character select. */
  protected pauseExit(): { label: string; go: () => void } | null {
    return null;
  }

  /** Pause menu entries; toggles stay open, everything else closes the menu. */
  private pauseItems(): PauseItem[] {
    const g = this.game;
    const s = g.save.settings;
    const items: PauseItem[] = [
      { label: 'RESUME', toggle: false, act: () => undefined },
      { label: 'RESTART', toggle: false, act: () => this.restart() },
      {
        label: `MUSIC: ${s.musicOn ? 'ON' : 'OFF'}`,
        toggle: true,
        act: () => {
          s.musicOn = !s.musicOn;
          g.audio.setMusicEnabled(s.musicOn);
          g.save.save();
        },
      },
      {
        label: `SOUND FX: ${s.sfxOn ? 'ON' : 'OFF'}`,
        toggle: true,
        act: () => {
          s.sfxOn = !s.sfxOn;
          g.audio.setSfxEnabled(s.sfxOn);
          g.save.save();
        },
      },
    ];
    if (g.input.connectedPads() > 0) {
      items.push({
        label: `RUMBLE: ${s.rumble ? 'ON' : 'OFF'}`,
        toggle: true,
        act: () => {
          s.rumble = !s.rumble;
          g.input.rumbleEnabled = s.rumble;
          g.save.save();
          if (s.rumble) g.input.rumble(0, 0.6, 0.6, 180);
        },
      });
    }
    const exit = this.pauseExit();
    if (exit) items.push({ label: exit.label, toggle: false, act: exit.go });
    items.push({ label: 'QUIT TO TITLE', toggle: false, act: () => g.scenes.go('title', {}) });
    return items;
  }

  /** Returns true while the pause menu owns input. */
  protected handlePause(): boolean {
    const input = this.game.input;
    if (!this.paused) {
      if (input.pausePressed()) {
        this.paused = true;
        this.pauseIndex = 0;
        this.audio.playSelect();
        return true;
      }
      return false;
    }
    const m = input.menu();
    if (input.pausePressed() || m.back) {
      this.paused = false;
      return true;
    }
    const items = this.pauseItems();
    const n = items.length;
    if (m.up) {
      this.pauseIndex = (this.pauseIndex + n - 1) % n;
      this.audio.playSelect();
    }
    if (m.down) {
      this.pauseIndex = (this.pauseIndex + 1) % n;
      this.audio.playSelect();
    }
    const item = items[this.pauseIndex];
    if (m.confirm || (item.toggle && (m.left || m.right))) {
      this.audio.playConfirm();
      if (!item.toggle) this.paused = false;
      item.act();
    }
    return true;
  }

  /** Advances the world one fixed step, honouring slow-motion. Returns false when the frame was skipped. */
  protected stepWorld(): boolean {
    if (this.slowmo > 0) {
      this.slowmo--;
      this.slowTick++;
      if (this.slowTick % 2 === 1) return false;
    }
    this.frame++;
    for (const f of this.fighters) f.update(this);
    this.resolveCombat();
    this.resolveProjectiles();
    separateBodies(this.fighters);
    for (const p of this.projectiles) p.update(this);
    this.projectiles = this.projectiles.filter((p) => !p.remove);
    this.particles.update();
    for (const t of this.tokens) {
      if (!t.isTargetable() || !TOKEN_STATES.has(t.state) || t.remove) this.tokens.delete(t);
    }
    this.fighters = this.fighters.filter((f) => !f.remove);
    this.spawnAmbient();
    this.camera.update();
    return true;
  }

  private resolveCombat(): void {
    for (const a of this.fighters) {
      const windows = a.activeWindows();
      if (!windows) continue;
      for (const w of windows) {
        for (const t of this.fighters) {
          if (t === a || t.team === a.team || !t.isHittable()) continue;
          const key = `${t.id}:${w.group}`;
          if (a.hitRegistry.has(key)) continue;
          const hurt = t.getHurtbox();
          for (const hb of w.boxes) {
            if (!checkHit(a, hb, t, hurt)) continue;
            a.hitRegistry.add(key);
            const before = t.hp;
            const res = t.receiveHit(a, hb, this);
            if (res !== 'miss') {
              a.moveConnected = true;
              a.hitstop = Math.max(a.hitstop, res === 'blocked' ? Math.max(2, hb.hitstop - 1) : hb.hitstop);
              this.applyHitEffects(a, t, hb, res, before - t.hp);
              if (res === 'hit' && a.move?.onHitBounce) a.bounceOffHit();
            }
            break;
          }
        }
      }
    }
  }

  private resolveProjectiles(): void {
    for (const p of this.projectiles) {
      if (p.remove) continue;
      for (const a of this.fighters) {
        if (a.team === p.team) continue;
        const windows = a.activeWindows();
        if (!windows) continue;
        const pb = hurtboxWorld(p, PROJECTILE_HURTBOX);
        let deflected = false;
        for (const w of windows) {
          for (const hb of w.boxes) {
            if (Math.abs(a.z - p.z) <= hb.zRange && boxesOverlap(hitboxWorld(a, hb), pb)) deflected = true;
          }
        }
        if (deflected) {
          p.remove = true;
          this.particles.hitSpark('blade', p.x, p.y, p.z + 1, a.facing, false);
          this.particles.text(p.x, p.y + 20, p.z, 'DEFLECT', '#9fe8ff', 12);
          this.audio.playClank();
          break;
        }
      }
      if (p.remove) continue;
      for (const t of this.fighters) {
        if (t.team === p.team || !t.isHittable()) continue;
        if (!checkHit(p, p.hitbox, t, t.getHurtbox())) continue;
        const before = t.hp;
        const res = t.receiveHit(p.owner, p.hitbox, this);
        if (res !== 'miss') {
          p.remove = true;
          this.applyHitEffects(p.owner, t, p.hitbox, res, before - t.hp, p.x);
        }
        break;
      }
    }
  }

  private applyHitEffects(a: Fighter, t: Fighter, hb: Hitbox, res: HitResult, dealt: number, originX?: number): void {
    const p = this.particles;
    const fromX = originX ?? a.x;
    const dir = hb.radial ? Math.sign(t.x - fromX) || a.facing : a.facing;
    const heavy = hb.damage > LIGHT_HIT_THRESHOLD || hb.hitstop >= 6;
    const sx = t.x - dir * 8 * t.scale;
    const sy = Math.max(t.y + 12, Math.min(t.y + 96 * t.scale, a.y + hb.offsetY * a.scale));
    const sz = t.z + 2;

    if (res === 'blocked') {
      p.burst(sx, sy, sz, -dir, '#9fe8ff', 10, 4, 1.2);
      p.spawn('flash', sx, sy, sz, 0, 0, 0, 8, 6, '#6fb6ff', { size2: 28 });
      this.audio.playBlock();
      this.camera.shake(2, dir, 0, 5);
      return;
    }

    p.hitSpark(hb.spark ?? 'impact', sx, sy, sz, dir, heavy);
    const arch = t.def.archetype;
    if (arch === 'ninjabot') {
      p.burst(sx, sy, sz, dir, COLORS.cyan, 6, 5);
      p.splatter(sx, sy, sz, dir, COLORS.oil, heavy ? 5 : 2);
    } else if (arch === 'clownbot') {
      p.burst(sx, sy, sz, dir, '#ffe38a', 8, 6);
      p.splatter(sx, sy, sz, dir, COLORS.oil, heavy ? 6 : 3);
      if (Math.random() < 0.5) p.arc(sx, sy, sz, 24, COLORS.cyan);
    } else if (heavy) {
      p.splatter(sx, sy, sz, dir, COLORS.blood, 3);
    }

    switch (hb.sfx) {
      case 'slash':
        this.audio.playSlash();
        this.audio.playHitLight();
        break;
      case 'magic':
        this.audio.playMagic();
        this.audio.playHitHeavy();
        break;
      case 'heavy':
        this.audio.playHitHeavy();
        break;
      default:
        if (heavy) this.audio.playHitHeavy();
        else this.audio.playHitLight();
    }
    if (res === 'armored') {
      this.audio.playClank();
    }
    this.camera.shake(hb.hitstop * 0.7 + (heavy ? 3 : 0.6), dir, -hb.knockbackY * 0.25, heavy ? 12 : 7);
    this.rumbleFor(t, t.hp <= 0 ? 1 : heavy ? 0.7 : 0.25, t.hp <= 0 ? 420 : heavy ? 160 : 70);
    if (heavy) this.rumbleFor(a, 0.35, 90);

    if (t.hp <= 0) this.audio.playVoiceGrunt(t.def.voice, 'ko');
    else if (heavy || Math.random() < 0.25) this.audio.playVoiceGrunt(t.def.voice, 'pain');

    a.combat.hitsLanded++;
    a.combat.damageDealt += Math.max(0, dealt);
    a.combat.maxCombo = Math.max(a.combat.maxCombo, t.comboTaken);
    this.onHitLanded?.(a, t, dealt);

    if (t.hp <= 0 && !t.koNotified) {
      t.koNotified = true;
      a.combat.kos++;
      this.onFighterKO?.(t, a);
    }
  }

  onHitLanded?(attacker: Fighter, target: Fighter, damage: number): void;
  onFighterKO?(f: Fighter, by: Fighter | null): void;

  /** Haptics for whichever human (if any) is driving this fighter. */
  protected rumbleFor(f: Fighter, strength: number, ms: number): void {
    const slot = (f as { slot?: number }).slot;
    if (typeof slot !== 'number') return;
    this.game.input.rumble(slot, strength, Math.min(1, strength * 1.3), ms);
  }

  private spawnAmbient(): void {
    const p = this.particles;
    const cx = this.camera.x;
    switch (this.theme) {
      case 'sanctuary':
        if (this.frame % 7 === 0) {
          p.spawn('petal', cx + Math.random() * 1000, 260 + Math.random() * 60, STAGE_MIN_Z + Math.random() * (STAGE_MAX_Z - STAGE_MIN_Z), -0.6 - Math.random(), -0.3, 0, 360, 3 + Math.random() * 2, Math.random() < 0.5 ? '#f29ac4' : '#ffc4de', {
            vrot: 0.05 + Math.random() * 0.05,
          });
        }
        if (this.frame % 11 === 0) p.spawn('ember', cx + Math.random() * 960, 0, STAGE_MIN_Z + Math.random() * 170, 0, 0.5 + Math.random() * 0.6, 0, 120, 1.8, '#b98aff', { drag: 0.995 });
        break;
      case 'facility':
        if (this.frame % 50 === 0) {
          const x = cx + Math.random() * 960;
          p.burst(x, 250, STAGE_MIN_Z - 2, Math.random() < 0.5 ? 1 : -1, '#ffe38a', 8, 3, 2.4);
        }
        break;
      case 'outskirts':
        if (this.frame % 14 === 0) p.spawn('dust', cx + 980, 10 + Math.random() * 60, STAGE_MIN_Z + Math.random() * 170, -1.2 - Math.random(), 0, 0, 160, 2, 'rgba(255,190,150,0.35)', { size2: 3 });
        break;
      case 'harbor':
        if (this.frame % 9 === 0) {
          p.spawn('dust', cx + 980, 140 + Math.random() * 200, STAGE_MIN_Z + Math.random() * 170, -1.6 - Math.random(), 0.1, 0, 200, 3, 'rgba(180,230,255,0.22)', { size2: 6 });
        }
        break;
      case 'foundry':
        if (this.frame % 3 === 0) {
          p.spawn('ember', cx + Math.random() * 1000, 10 + Math.random() * 40, STAGE_MIN_Z + Math.random() * 176, (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.6, 0, 90, 1.8, Math.random() < 0.5 ? '#ffb347' : '#ff6a2a', { drag: 0.99 });
        }
        if (this.frame % 70 === 0) {
          const x = cx + Math.random() * 960;
          p.burst(x, 40, STAGE_MIN_Z - 2, Math.random() < 0.5 ? 1 : -1, '#fff1a8', 10, 4, 2.6);
        }
        break;
      case 'rooftop':
        if (this.frame % 4 === 0) {
          p.spawn('spark', cx + Math.random() * 1000, 330, STAGE_MIN_Z + Math.random() * 176, -0.8, -5, 0, 40, 1.4, 'rgba(160,190,255,0.5)', {});
        }
        break;
    }
  }

  protected renderWorld(screen: CanvasRenderingContext2D): void {
    const game = this.game;
    // Camera snaps to whole world pixels so sprites and parallax never land on half-pixel seams.
    const view: RenderView = {
      camX: Math.round(this.camera.viewX / PIXEL_SIZE) * PIXEL_SIZE,
      camY: Math.round(this.camera.viewY / PIXEL_SIZE) * PIXEL_SIZE,
      time: game.time,
      sprites: game.sprites,
      debug: game.settings.debug,
    };
    game.renderer.beginWorld();
    game.renderer.drawStage(this.theme, view.camX, view.camY, game.time, this.stageWidth);

    const ctx = game.renderer.beginSprites();
    for (const f of this.fighters) f.drawShadow(ctx, view);
    for (const p of this.projectiles) p.drawShadow(ctx, view);
    const list = this.drawList;
    list.length = 0;
    for (const f of this.fighters) list.push(f);
    for (const p of this.projectiles) list.push(p);
    for (const p of this.particles.active) if (p.kind !== 'text') list.push(p);
    list.sort((a, b) => a.sortZ - b.sortZ);
    for (const e of list) e.draw(ctx, view);
    game.renderer.endSprites();
    game.renderer.drawVignette();
    game.renderer.endWorld();

    // Floating combat text stays at full resolution so it remains legible over the pixelated world.
    for (const p of this.particles.active) if (p.kind === 'text') p.draw(screen, view);

    if (game.settings.debug) {
      game.renderer.drawDebug(this.fighters, this.projectiles, view.camX, view.camY, [
        `FPS ${game.loop?.fps ?? 0}  UPS ${game.loop?.ups ?? 0}`,
        `fighters ${this.fighters.length}  proj ${this.projectiles.length}`,
        `particles ${this.particles.count}  tokens ${this.tokens.size}/${this.maxTokens}`,
        `camera ${this.camera.x.toFixed(0)}${this.camera.locked ? ' [LOCK]' : ''}`,
        'red=hitbox green=hurtbox blue=z-plane',
      ]);
    }
  }

  protected renderPause(ctx: CanvasRenderingContext2D): void {
    if (!this.paused) return;
    this.game.ui.pauseOverlay(ctx, this.pauseItems().map((i) => i.label), this.pauseIndex, this.game.time, this.game.input.touchMode);
  }
}
