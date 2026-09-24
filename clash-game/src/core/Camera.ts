import { CANVAS_WIDTH } from '../config/constants';
import { clamp } from '../physics/Collision';

export class Camera {
  x = 0;
  y = 0;
  minX = 0;
  maxX = 0;
  /** Classic belt-scroll rule: the camera never scrolls back toward already-cleared ground. */
  forwardOnly = true;
  private progressX = 0;
  private lockX: number | null = null;

  private shakeMag = 0;
  private shakeDirX = 1;
  private shakeDirY = 0;
  private shakeT = 0;
  offsetX = 0;
  offsetY = 0;

  reset(stageWidth: number, x = 0): void {
    this.minX = 0;
    this.maxX = Math.max(0, stageWidth - CANVAS_WIDTH);
    this.x = clamp(x, this.minX, this.maxX);
    this.progressX = this.x;
    this.lockX = null;
    this.shakeMag = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  lock(x: number): void {
    this.lockX = clamp(x, this.minX, this.maxX);
  }

  unlock(): void {
    this.lockX = null;
  }

  get locked(): boolean {
    return this.lockX !== null;
  }

  get lockedAt(): number {
    return this.lockX ?? this.x;
  }

  follow(targetX: number, lead = 0.42): void {
    const desired = targetX - CANVAS_WIDTH * lead;
    let goal = clamp(desired, this.minX, this.maxX);
    if (this.forwardOnly) goal = Math.max(goal, this.progressX);
    if (this.lockX !== null) goal = Math.min(goal, this.lockX);
    if (this.lockX !== null && this.x > this.lockX) goal = this.lockX;
    this.x += (goal - this.x) * 0.12;
    if (Math.abs(goal - this.x) < 0.1) this.x = goal;
    this.progressX = Math.max(this.progressX, this.x);
  }

  /** Directional shake along the impact vector; stronger requests override weaker ones. */
  shake(magnitude: number, dirX = 1, dirY = 0, frames = 10): void {
    if (magnitude < this.shakeMag * 0.6) return;
    const len = Math.hypot(dirX, dirY) || 1;
    this.shakeDirX = dirX / len;
    this.shakeDirY = dirY / len;
    this.shakeMag = Math.min(14, magnitude);
    this.shakeT = frames;
  }

  update(): void {
    if (this.shakeT > 0 && this.shakeMag > 0.05) {
      this.shakeT--;
      const osc = this.shakeT % 2 === 0 ? 1 : -1;
      const perp = (Math.random() - 0.5) * 0.35;
      this.offsetX = (this.shakeDirX * osc - this.shakeDirY * perp) * this.shakeMag;
      this.offsetY = (this.shakeDirY * osc + this.shakeDirX * perp) * this.shakeMag;
      this.shakeMag *= 0.82;
    } else {
      this.shakeMag = 0;
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  get viewX(): number {
    return this.x + this.offsetX;
  }

  get viewY(): number {
    return this.y + this.offsetY;
  }
}
