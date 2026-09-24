import { nearestOpponent } from '../physics/Collision';
import {
  FState,
  emptyInput,
  type CharId,
  type Controller,
  type HitResponse,
  type Hitbox,
  type InputFrame,
  type World,
} from '../physics/Types';
import type { Fighter } from '../entities/Fighter';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export interface BossAIOptions {
  versus: boolean;
  /** 0.5 (gentle) .. 1.2 (brutal). Scales reaction time and aggression. */
  difficulty: number;
}

/**
 * Master-level AI for the two protagonists.
 * Slade: zones at mid range, substitutes out of juggles, casts Abyssal Rift when cornered, dive-kicks wake-ups.
 * Freckles: hyper armor on wake-up, punishes dash approaches with Bull Charge, loops the 4-hit string in the corner.
 */
export class BossAI implements Controller {
  private out: InputFrame = emptyInput();
  private think = 0;
  private cd = { special: 180, dash: 60, dive: 90, sub: 120, block: 0, charge: 90, hammer: 120 };
  private blockTimer = 0;
  private reactTimer = 0;
  private reactAction: string | null = null;
  private comboPressTimer = 0;
  private wantX = 0;
  private wantZ = 0;
  private strafe = 1;
  private mode: 'neutral' | 'pressure' | 'backoff' = 'neutral';
  private modeTimer = 0;

  constructor(
    private readonly char: CharId,
    private readonly opts: BossAIOptions,
  ) {}

  private get reaction(): number {
    return Math.round((this.opts.versus ? 14 : 9) / this.opts.difficulty);
  }

  private reset(): InputFrame {
    const o = this.out;
    o.moveX = o.moveZ = 0;
    o.run = o.jump = o.jumpPressed = o.attackPressed = o.specialPressed = false;
    o.dashDir = 0;
    o.moveRequest = undefined;
    return o;
  }

  private tick(): void {
    this.think--;
    this.blockTimer--;
    this.modeTimer--;
    for (const k of Object.keys(this.cd) as (keyof typeof this.cd)[]) this.cd[k]--;
  }

  getInput(self: Fighter, world: World): InputFrame {
    const o = this.reset();
    this.tick();
    const target = nearestOpponent(self, world);
    self.autoFace = target;
    if (!target) return o;

    const dx = target.x - self.x;
    const adx = Math.abs(dx);
    const dz = target.z - self.z;
    const dir = Math.sign(dx) || 1;
    const b = world.boundsFor(self);
    const wallDist = Math.min(self.x - b.minX, b.maxX - self.x);
    const targetWallDist = Math.min(target.x - b.minX, b.maxX - target.x);
    const phase2 = self.hp < self.maxHp * 0.5;
    const diff = this.opts.difficulty * (phase2 ? 1.15 : 1);

    if (self.state === FState.JUMP) {
      if (this.char === 'slade') {
        if (self.vy < 2.5 && adx < 210 && adx > 20 && Math.sign(dx) === self.facing) o.attackPressed = true;
      } else if (self.vy < 1 && adx < 50) {
        o.attackPressed = true;
      }
      o.moveX = dir;
      return o;
    }

    if (self.state === FState.ATTACK) {
      this.comboPressTimer--;
      const m = self.move;
      if (m?.kind === 'combo' && this.comboPressTimer <= 0) {
        const cornerLoop = this.char === 'freckles' && targetWallDist < 120;
        if (self.moveConnected || cornerLoop || Math.random() < 0.15 * diff) o.attackPressed = true;
        this.comboPressTimer = 3;
      }
      if (m?.kind === 'combo' && self.moveConnected && self.comboIndex >= 1 && this.cd.special <= 0 && self.canAffordSpecial() && Math.random() < 0.05 * diff) {
        o.specialPressed = true;
        this.cd.special = rand(420, 600);
      }
      return o;
    }

    if (self.state === FState.BLOCK) {
      o.moveX = -self.facing;
      return o;
    }
    if (!self.isActionable()) return o;

    const targetAttacking = target.state === FState.ATTACK;
    const targetDashing =
      (target.state === FState.RUN && Math.sign(target.vx) === -dir) || (targetAttacking && target.move?.kind === 'dash');

    if (this.opts.versus && self.canBlock) {
      if (this.blockTimer > 0) {
        o.moveX = -self.facing;
        return o;
      }
      if (targetAttacking && adx < 120 && Math.abs(dz) < 20 && this.cd.block <= 0) {
        this.cd.block = 18;
        if (Math.random() < 0.38 * diff) {
          this.blockTimer = Math.round(rand(14, 26));
          o.moveX = -self.facing;
          return o;
        }
      }
    }

    if (this.reactAction) {
      this.reactTimer--;
      if (this.reactTimer <= 0) {
        const act = this.reactAction;
        this.reactAction = null;
        if (act === 'special' && self.canAffordSpecial()) {
          o.specialPressed = true;
          return o;
        }
        if (act === 'charge' && adx < 320 && Math.abs(dz) < 18) {
          o.moveRequest = 'f_dash';
          return o;
        }
      }
    }

    const cornered = wallDist < 90 && adx < 130 && Math.abs(dz) < 40;
    const crowded = world.fighters.filter((f) => f.team !== self.team && f.isTargetable() && Math.abs(f.x - self.x) < 110 && Math.abs(f.z - self.z) < 40).length >= 2;

    if ((cornered || crowded) && this.cd.special <= 0 && self.canAffordSpecial() && Math.random() < 0.5 * diff) {
      this.cd.special = rand(360, 560) / diff;
      o.specialPressed = true;
      return o;
    }

    return this.char === 'slade'
      ? this.sladeBrain(self, target, o, dx, adx, dz, dir, diff)
      : this.frecklesBrain(self, target, o, dx, adx, dz, dir, diff, targetDashing, targetWallDist);
  }

  private sladeBrain(self: Fighter, target: Fighter, o: InputFrame, dx: number, adx: number, dz: number, dir: number, diff: number): InputFrame {
    const recovering =
      (target.state === FState.KNOCKDOWN && target.stateFrame > target.knockdownTimer - 26) || target.state === FState.WAKEUP;

    if (recovering && this.cd.dive <= 0 && adx > 80 && adx < 230 && Math.abs(dz) < 22) {
      this.cd.dive = rand(120, 200) / diff;
      o.jumpPressed = true;
      o.moveX = dir;
      return o;
    }

    const aligned = Math.abs(dz) < 12;
    if (aligned && adx > 105 && adx < 220 && this.cd.dash <= 0 && target.isHittable() && Math.random() < 0.35 * diff) {
      this.cd.dash = rand(90, 170) / diff;
      o.moveRequest = 's_dash';
      return o;
    }

    if (aligned && adx < 74 && target.isHittable()) {
      if (Math.random() < 0.3 * diff) {
        o.attackPressed = true;
        this.comboPressTimer = 4;
        return o;
      }
    }

    if (target.isHittable() && aligned && adx > 90 && adx < 170 && this.cd.dive <= 0 && Math.random() < 0.05 * diff) {
      this.cd.dive = rand(150, 240);
      o.jumpPressed = true;
      o.moveX = dir;
      return o;
    }

    if (this.think <= 0) {
      this.think = Math.round(rand(10, 22) / diff);
      if (this.modeTimer <= 0) {
        const r = Math.random();
        this.mode = r < 0.45 * diff ? 'pressure' : r < 0.8 ? 'neutral' : 'backoff';
        this.modeTimer = Math.round(rand(60, 140));
      }
      if (Math.random() < 0.3) this.strafe = -this.strafe;
      const range = this.mode === 'pressure' ? 58 : this.mode === 'neutral' ? 150 : 230;
      this.wantX = target.x - dir * range;
      this.wantZ = target.z + (this.mode === 'pressure' ? 0 : this.strafe * rand(0, 26));
    }
    return this.steer(self, o, dx);
  }

  private frecklesBrain(
    self: Fighter,
    target: Fighter,
    o: InputFrame,
    dx: number,
    adx: number,
    dz: number,
    dir: number,
    diff: number,
    targetDashing: boolean,
    targetWallDist: number,
  ): InputFrame {
    if (targetDashing && adx < 300 && Math.abs(dz) < 18 && !this.reactAction && this.cd.charge <= 0) {
      this.reactAction = 'charge';
      this.reactTimer = this.reaction;
      this.cd.charge = rand(80, 140);
    }

    const aligned = Math.abs(dz) < 12;
    const cornerLoop = targetWallDist < 120 && adx < 110;

    if (aligned && adx < 70 && target.isHittable()) {
      if (cornerLoop || Math.random() < 0.34 * diff) {
        o.attackPressed = true;
        this.comboPressTimer = 3;
        return o;
      }
    }

    if (aligned && adx > 150 && adx < 320 && this.cd.charge <= 0 && target.isHittable() && Math.random() < 0.25 * diff) {
      this.cd.charge = rand(150, 260) / diff;
      o.moveRequest = 'f_dash';
      return o;
    }

    if (aligned && adx > 80 && adx < 150 && this.cd.hammer <= 0 && Math.random() < 0.04 * diff) {
      this.cd.hammer = rand(200, 320);
      o.jumpPressed = true;
      o.moveX = dir;
      return o;
    }

    if (this.think <= 0) {
      this.think = Math.round(rand(8, 18) / diff);
      if (this.modeTimer <= 0) {
        this.mode = Math.random() < 0.7 * diff ? 'pressure' : 'neutral';
        this.modeTimer = Math.round(rand(70, 150));
      }
      const range = cornerLoop || this.mode === 'pressure' ? 52 : 120;
      this.wantX = target.x - dir * range;
      this.wantZ = target.z;
    }
    return this.steer(self, o, dx);
  }

  private steer(self: Fighter, o: InputFrame, dx: number): InputFrame {
    const ex = this.wantX - self.x;
    const ez = this.wantZ - self.z;
    if (Math.abs(ex) > 12) o.moveX = Math.sign(ex);
    if (Math.abs(ez) > 5) o.moveZ = Math.sign(ez);
    if (Math.abs(ex) > 200 && Math.sign(ex) === Math.sign(dx)) o.run = true;
    return o;
  }

  onHit(self: Fighter, _attacker: Fighter, _hb: Hitbox): HitResponse {
    if (this.char !== 'slade' || this.opts.versus) return;
    if (this.cd.sub > 0 || self.hp <= 0) return;
    const juggled = self.state === FState.JUGGLE || (self.state === FState.HURT && self.comboTaken >= 2);
    if (juggled && Math.random() < 0.7 * this.opts.difficulty) {
      this.cd.sub = self.hp < self.maxHp * 0.5 ? rand(220, 300) : rand(320, 420);
      return 'substitute';
    }
  }

  onWakeup(self: Fighter): void {
    if (this.char === 'freckles' && !this.opts.versus) {
      self.hyperArmor = 45;
    } else if (this.char === 'freckles') {
      self.hyperArmor = 20;
    }
    this.cd.dash = Math.min(this.cd.dash, 20);
  }
}
