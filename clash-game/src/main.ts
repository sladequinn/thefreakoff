import { CANVAS_WIDTH, FONT_UI } from './config/constants';
import { AudioEngine } from './core/AudioEngine';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { StateManager, type GameContext } from './core/StateManager';
import { TouchControls } from './core/TouchControls';
import { Renderer } from './rendering/Renderer';
import { SpriteRenderer } from './rendering/SpriteRenderer';
import { UIRenderer } from './rendering/UIRenderer';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { GameOverScene } from './scenes/GameOverScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { VsScene } from './scenes/VsScene';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app container');
root.replaceChildren();
document.querySelectorAll('.tc-root').forEach((el) => el.remove());

const renderer = new Renderer(root);
const sprites = new SpriteRenderer();
const ui = new UIRenderer(sprites);
const input = new InputManager(window);
const touch = new TouchControls(input, renderer.canvas);
touch.setVisible(input.touchMode);
const audio = new AudioEngine();
const scenes = new StateManager();

const game: GameContext = {
  renderer,
  sprites,
  ui,
  input,
  audio,
  scenes,
  loop: null,
  settings: { debug: false },
  time: 0,
};
scenes.game = game;

scenes.register('title', (g, p) => new TitleScene(g, p));
scenes.register('select', (g, p) => new CharacterSelectScene(g, p));
scenes.register('story', (g, p) => new StoryScene(g, p));
scenes.register('vs', (g, p) => new VsScene(g, p));
scenes.register('gameover', (g, p) => new GameOverScene(g, p));

let toast = '';
let toastT = 0;

function update(): void {
  input.update();
  if (input.debugPressed()) {
    game.settings.debug = !game.settings.debug;
    toast = game.settings.debug ? 'DEBUG OVERLAY ON' : 'DEBUG OVERLAY OFF';
    toastT = 90;
  }
  if (input.mutePressed()) {
    toast = audio.toggleMute() ? 'SOUND MUTED' : 'SOUND ON';
    toastT = 90;
  }
  touch.setVisible(input.touchMode);
  scenes.update();
  game.time++;
  if (toastT > 0) toastT--;
}

function render(alpha: number): void {
  const ctx = renderer.beginFrame();
  scenes.render(ctx, alpha);
  if (toastT > 0) {
    const a = Math.min(1, toastT / 20);
    ui.panel(ctx, CANVAS_WIDTH / 2 - 110, 84, 220, 28, 'rgba(8,6,18,0.85)');
    ui.text(ctx, toast, CANVAS_WIDTH / 2, 103, 13, '#ffffff', { template: FONT_UI, alpha: a });
  }
}

const loop = new GameLoop(update, render);
game.loop = loop;

const unlockAudio = (): void => {
  audio.unlock();
  renderer.canvas.focus({ preventScroll: true });
};
// iOS Safari only resumes an AudioContext inside touchend/click, not pointerdown.
const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'touchend', 'click'] as const;
for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlockAudio);
const blockGesture = (e: Event): void => e.preventDefault();
document.addEventListener('gesturestart', blockGesture);
document.addEventListener('dblclick', blockGesture);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

scenes.go('title', {}, true);
loop.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    loop.stop();
    audio.stopMusic();
    for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlockAudio);
    document.removeEventListener('gesturestart', blockGesture);
    document.removeEventListener('dblclick', blockGesture);
    touch.root.remove();
  });
}
