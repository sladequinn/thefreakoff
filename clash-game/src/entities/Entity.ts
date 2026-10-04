import type { SpriteRenderer } from '../rendering/SpriteRenderer';
import type { Hitbox, Team, World } from '../physics/Types';
import type { Fighter } from './Fighter';

export interface RenderView {
  camX: number;
  camY: number;
  time: number;
  sprites: SpriteRenderer;
  debug: boolean;
}

let nextEntityId = 1;

export abstract class Entity {
  readonly id = nextEntityId++;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  scale = 1;
  remove = false;

  /** Depth used by the painter's sort; ground decals override this to render beneath bodies. */
  get sortZ(): number {
    return this.z;
  }

  abstract update(world: World): void;
  abstract draw(ctx: CanvasRenderingContext2D, view: RenderView): void;

  screenX(view: RenderView): number {
    return this.x - view.camX;
  }

  screenY(view: RenderView): number {
    return this.z - this.y - view.camY;
  }
}

/** Homing ninja star. Steers toward its target for a limited window, then flies straight. */
export class Projectile extends Entity {
  readonly team: Team;
  readonly hitbox: Hitbox;
  life = 150;
  homingFrames = 46;
  turnRate = 0.07;
  speed: number;
  spin = 0;
  color: string;
  readonly owner: Fighter;
  target: Fighter | null;
  deflected = false;
  kind: 'shuriken' | 'note' | 'rang' = 'shuriken';
  private age = 0;

  constructor(owner: Fighter, target: Fighter | null, x: number, y: number, z: number, angle: number, speed: number, color: string) {
    super();
    this.owner = owner;
    this.team = owner.team;
    this.target = target;
    this.x = x;
    this.y = y;
    this.z = z;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vz = Math.sin(angle) * speed * 0.6;
    this.color = color;
    this.facing = this.vx >= 0 ? 1 : -1;
    this.hitbox = {
      offsetX: 0,
      offsetY: 0,
      width: 18,
      height: 18,
      zRange: 14,
      damage: 4,
      knockbackX: 2,
      knockbackY: 0,
      hitstun: 12,
      hitstop: 3,
      spark: 'blade',
      sfx: 'light',
      radial: true,
    };
  }

  update(world: World): void {
    this.life--;
    if (this.life <= 0) {
      this.remove = true;
      return;
    }
    const t = this.target;
    if (t && this.homingFrames > 0 && t.isTargetable()) {
      this.homingFrames--;
      const cur = Math.atan2(this.vz, this.vx);
      const want = Math.atan2(t.z - this.z, t.x - this.x);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const next = cur + Math.max(-this.turnRate, Math.min(this.turnRate, diff));
      this.vx = Math.cos(next) * this.speed;
      this.vz = Math.sin(next) * this.speed * 0.6;
      const wantY = t.y + 48 * t.scale;
      this.y += (wantY - this.y) * 0.04;
    }
    this.age++;
    this.x += this.vx;
    this.z += this.vz;
    this.y += this.vy;
    this.facing = this.vx >= 0 ? 1 : -1;
    this.spin += 0.55;
    if (this.kind === 'note') {
      // rides a sine wave like a note on a stave, leaving a soft trail
      this.y += Math.cos(this.age * 0.18) * 1.1;
      if (world.frame % 3 === 0) world.particles.spawn('ember', this.x, this.y, this.z, -this.vx * 0.08, 0.2, 0, 16, 2, this.age % 6 < 3 ? this.color : '#fff3c8');
    } else if (this.kind === 'rang') {
      if (world.frame % 3 === 0) world.particles.spawn('ember', this.x, this.y, this.z, -this.vx * 0.06, 0, 0, 12, 1.8, this.color);
    } else if (world.frame % 2 === 0) {
      world.particles.spawn('ember', this.x, this.y, this.z, -this.vx * 0.05, 0, 0, 14, 2.2, this.color);
    }
    const cam = world.camera;
    if (this.x < cam.x - 200 || this.x > cam.x + 1160) this.remove = true;
  }

  draw(ctx: CanvasRenderingContext2D, view: RenderView): void {
    if (this.kind === 'note') view.sprites.drawNote(ctx, this.screenX(view), this.screenY(view), this.age, this.color);
    else if (this.kind === 'rang') view.sprites.drawRang(ctx, this.screenX(view), this.screenY(view), this.spin, this.color);
    else view.sprites.drawShuriken(ctx, this.screenX(view), this.screenY(view), this.spin, this.color);
  }

  drawShadow(ctx: CanvasRenderingContext2D, view: RenderView): void {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x - view.camX, this.z - view.camY, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
