import { FIXED_STEP_MS, MAX_STEPS_PER_FRAME } from '../config/constants';

/**
 * Fixed-timestep simulation (60 Hz) decoupled from display refresh.
 * Physics and frame data are authored in frames, so the simulation must never run on variable dt.
 */
export class GameLoop {
  private rafId = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  fps = 60;
  ups = 60;
  private upsCount = 0;

  constructor(
    private readonly update: () => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.fpsTime = this.last;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    let delta = now - this.last;
    this.last = now;
    if (delta > 250) delta = FIXED_STEP_MS;
    this.acc += delta;

    let steps = 0;
    while (this.acc >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.update();
      this.acc -= FIXED_STEP_MS;
      steps++;
      this.upsCount++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0;

    this.render(this.acc / FIXED_STEP_MS);

    this.fpsFrames++;
    if (now - this.fpsTime >= 500) {
      const secs = (now - this.fpsTime) / 1000;
      this.fps = Math.round(this.fpsFrames / secs);
      this.ups = Math.round(this.upsCount / secs);
      this.fpsFrames = 0;
      this.upsCount = 0;
      this.fpsTime = now;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };
}
