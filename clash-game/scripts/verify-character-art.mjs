import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Real browser regression: every move/costume/facing plus menu and gameplay composition.
// Run: npm run verify:art (after npx playwright install chromium).
// CHROMIUM_PATH may select a preinstalled Chromium. Screenshots go to artifacts/character-review.
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, process.env.ART_REVIEW_OUTPUT || 'artifacts/character-review');
await mkdir(out, { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Hardware gamepads are irrelevant to deterministic render tests.
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads', { value: () => [] }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => window.__clash?.scenes.current);
  const results = await page.evaluate(async () => {
    const { SpriteRenderer, poseFor } = await import('/src/rendering/SpriteRenderer.ts');
    const { CHARACTERS } = await import('/src/characters/index.ts');
    const { NINJABOT_DEF, CLOWNBOT_DEF } = await import('/src/entities/Enemy.ts');
    const { Fighter } = await import('/src/entities/Fighter.ts');
    const { FState, emptyInput } = await import('/src/physics/Types.ts');
    const { pixelize } = await import('/src/rendering/Pixelize.ts');
    const game = window.__clash;
    game.loop.stop();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const sprites = new SpriteRenderer();
    let samples = 0, weaponAttachments = 0;
    const defs = [...Object.values(CHARACTERS), NINJABOT_DEF, CLOWNBOT_DEF];
    for (const def of defs) {
      const variants = def.archetype === 'clownbot' ? ['normal', 'heavy', 'elite', 'boss']
        : def.archetype === 'ninjabot' ? ['normal', 'alt', 'elite', 'boss'] : ['normal', 'alt', 'boss'];
      for (const variant of variants) for (const facing of [-1, 1]) {
        const fighter = new Fighter(def, { team: 0, variant, controller: { getInput: emptyInput } });
        const render = () => {
          const pose = poseFor(fighter);
          for (const [key, value] of Object.entries(pose)) {
            if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${def.id}: non-finite ${key}`);
          }
          ctx.clearRect(0, 0, 384, 384);
          sprites.drawBody(ctx, def.archetype, variant, pose, 192, 220, facing, def.scale, fighter.animTime, null, .6,
            (tip, mid) => {
              if (![tip.x, tip.y, mid.x, mid.y].every(Number.isFinite)) throw new Error(`${def.id}: invalid weapon attachment`);
              weaponAttachments++;
            });
          const pixels = ctx.getImageData(0, 0, 384, 384);
          pixelize(pixels);
          let occupied = 0;
          for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i]) occupied++;
          if (occupied < 100) throw new Error(`${def.id}/${variant}: empty sprite in ${fighter.state}`);
          samples++;
        };
        for (const state of Object.values(FState)) {
          if (state === FState.ATTACK) continue;
          fighter.state = state;
          for (const frame of [0, 5, 14, 30]) {
            fighter.stateFrame = frame; fighter.animTime = frame;
            fighter.walkPhase = frame * .2; fighter.hitstun = 18; render();
          }
        }
        for (const move of Object.values(def.moves)) {
          fighter.state = FState.ATTACK; fighter.move = move;
          const frames = new Set([0, move.duration - 1, ...move.hits.flatMap(hit => [hit.start - 1, hit.start, hit.end])]);
          for (let n = 1; n < 8; n++) frames.add(Math.floor(move.duration * n / 8));
          for (const frame of frames) { fighter.moveFrame = Math.max(0, frame); fighter.animTime = frame; render(); }
        }
      }
    }
    // Layer accumulation: every roster card must survive the single endWorld composite.
    game.scenes.go('select', { mode: 'vs', cpu: true }, true);
    for (let n = 0; n < 20; n++) game.scenes.update();
    game.scenes.current.render(game.renderer.beginFrame(), 0);
    return { samples, weaponAttachments, characters: defs.length };
  });
  await page.screenshot({ path: path.join(out, 'character-select.png') });
  for (const [name, p1, p2, stage, variant] of [
    ['normal', 'slade', 'freckles', 'outskirts', 'normal'],
    ['weapons', 'fiddlejay', 'righteous', 'rooftop', 'normal'],
    ['alternate', 'whitelie', 'batman', 'harbor', 'alt'],
    ['boss', 'slade', 'fiddlejay', 'outskirts', 'boss'],
  ]) {
    const timings = await page.evaluate(({ p1, p2, stage, variant }) => {
      const g = window.__clash;
      g.scenes.go('training', { p1, p2, stage }, true);
      for (let i = 0; i < 20; i++) g.scenes.update();
      const s = g.scenes.current;
      s.showFrameData = false;
      s.p1.variant = s.dummy.variant = variant;
      s.p1.x = 390; s.dummy.x = 510;
      const start = performance.now();
      for (let i = 0; i < 30; i++) { g.time++; s.render(g.renderer.beginFrame(), 0); }
      return (performance.now() - start) / 30;
    }, { p1, p2, stage, variant });
    await page.screenshot({ path: path.join(out, `${name}-stage.png`) });
    results[`${name}RenderMs`] = Number(timings.toFixed(2));
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ ...results, browserErrors: errors.length, screenshots: out }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
