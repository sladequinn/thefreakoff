import type { Renderer } from '../rendering/Renderer';
import type { SpriteRenderer } from '../rendering/SpriteRenderer';
import type { UIRenderer } from '../rendering/UIRenderer';
import type { Scene } from '../scenes/Scene';
import type { CharId, GameMode } from '../physics/Types';
import type { AudioEngine } from './AudioEngine';
import type { InputManager } from './InputManager';
import type { GameLoop } from './GameLoop';

export interface GameOverOption<K extends SceneName = SceneName> {
  label: string;
  scene: K;
  params: SceneMap[K];
}

export interface GameOverParams {
  title: string;
  subtitle: string;
  accent: string;
  victory: boolean;
  lines: string[];
  portrait?: CharId;
  options: GameOverOption[];
}

export interface SceneMap {
  title: Record<string, never>;
  select: { mode: GameMode; cpu: boolean };
  story: { char: CharId; stage: number; score: number; lives: number };
  vs: { p1: CharId; p2: CharId; cpu: boolean };
  gameover: GameOverParams;
}

export type SceneName = keyof SceneMap;
export type SceneFactory<K extends SceneName> = (game: GameContext, params: SceneMap[K]) => Scene;

export interface GameSettings {
  debug: boolean;
}

export interface GameContext {
  renderer: Renderer;
  sprites: SpriteRenderer;
  ui: UIRenderer;
  input: InputManager;
  audio: AudioEngine;
  scenes: StateManager;
  loop: GameLoop | null;
  settings: GameSettings;
  /** Frames since boot; used for UI animation. */
  time: number;
}

const FADE_FRAMES = 14;

/** Scene registry + cross-fade transitions. Scenes are looked up by name so they never import each other. */
export class StateManager {
  current: Scene | null = null;
  private factories = new Map<SceneName, SceneFactory<SceneName>>();
  private pending: (() => Scene) | null = null;
  private fade = 0;
  private fadeDir: 0 | 1 | -1 = 0;
  game!: GameContext;

  register<K extends SceneName>(name: K, factory: SceneFactory<K>): void {
    this.factories.set(name, factory as unknown as SceneFactory<SceneName>);
  }

  go<K extends SceneName>(name: K, params: SceneMap[K], instant = false): void {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Scene "${name}" is not registered`);
    const make = (): Scene => factory(this.game, params as SceneMap[SceneName]);
    if (instant || !this.current) {
      this.swap(make());
      this.fade = FADE_FRAMES;
      this.fadeDir = -1;
      return;
    }
    if (this.fadeDir === 1) return;
    this.pending = make;
    this.fadeDir = 1;
  }

  get transitioning(): boolean {
    return this.fadeDir !== 0;
  }

  private swap(next: Scene): void {
    this.current?.exit();
    this.current = next;
    next.enter();
  }

  update(): void {
    if (this.fadeDir === 1) {
      this.fade++;
      if (this.fade >= FADE_FRAMES) {
        const make = this.pending;
        this.pending = null;
        if (make) this.swap(make());
        this.fadeDir = -1;
      }
      return;
    }
    if (this.fadeDir === -1) {
      this.fade--;
      if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    this.current?.update();
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    this.current?.render(ctx, alpha);
    if (this.fade > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.fade / FADE_FRAMES);
      ctx.fillStyle = '#05040a';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
  }
}
