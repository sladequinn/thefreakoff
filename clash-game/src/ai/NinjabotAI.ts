import { nearestOpponent } from '../physics/Collision';
import { FState, emptyInput, type Controller, type HitResponse, type Hitbox, type InputFrame, type Variant, type World } from '../physics/Types';
import type { Fighter } from '../entities/Fighter';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/**
 * Ninjabots keep their distance: they orbit at range, pepper the player with homing shurikens,
 * dart in with flip kicks and vanish via smoke-bomb substitution when caught.
 */
export class NinjabotAI implements Controller {
  private out: InputFrame = emptyInput();
  private think = 0;
  private throwCd: number;
  private flipCd = rand(60, 140);
  private subCd = rand(60, 200);
  private strafe = Math.random() < 0.5 ? -1 : 1;
  private wantX = 0;
  private wantZ = 0;
  private pendingAttack = 0;
  private retreat = 0;
  private readonly preferred: number;
  private readonly subChance: number;
  private readonly throwRate: [number, number];

  constructor(private readonly variant: Variant) {
    this.preferred = variant === 'alt' ? 300 : variant === 'elite' ? 170 : 210;
    this.subChance = variant === 'elite' ? 0.4 : variant === 'alt' ? 0.18 : 0.22;
    this.throwRate = variant === 'alt' ? [80, 130] : variant === 'elite' ? [110, 170] : [150, 240];
    this.throwCd = rand(40, this.throwRate[1]);
  }

  getInput(self: Fighter, world: World): InputFrame {
    const o = this.out;
    o.moveX = o.moveZ = 0;
    o.run = o.jump = o.jumpPressed = o.attackPressed = o.specialPressed = false;
    o.dashDir = 0;
    o.moveRequest = undefined;

    this.throwCd--;
    this.flipCd--;
    this.subCd--;
    this.think--;

    const target = nearestOpponent(self, world);
    self.autoFace = target;
    if (!target) return o;
    const dx = target.x - self.x;
    const adx = Math.abs(dx);
    const dz = target.z - self.z;
    const dir = Math.sign(dx) || 1;

    if (self.state === FState.ATTACK) {
      if (self.move?.id === 'nb_slash1' && self.moveConnected) o.attackPressed = true;
      return o;
    }
    if (!self.isActionable()) return o;

    const onScreen = self.x > world.camera.x + 20 && self.x < world.camera.x + 940;
    const targetDown = target.state === FState.KNOCKDOWN || target.state === FState.WAKEUP;

    if (this.pendingAttack > 0) {
      this.pendingAttack--;
      if (this.pendingAttack === 0 && adx < 80 && Math.abs(dz) < 14 && !targetDown) {
        o.attackPressed = true;
        return o;
      }
    }

    if (this.think <= 0) {
      this.think = Math.round(rand(8, 16));
      this.strafe = Math.random() < 0.15 ? -this.strafe : this.strafe;

      if (!targetDown && adx < 70 && Math.abs(dz) < 12) {
        if (Math.random() < 0.55 && world.requestToken(self)) {
          this.pendingAttack = Math.round(rand(2, 8));
        } else if (Math.random() < 0.4) {
          this.retreat = 26;
          o.jumpPressed = Math.random() < 0.4;
        }
      } else if (!targetDown && adx > 90 && adx < 175 && Math.abs(dz) < 16 && this.flipCd <= 0 && Math.random() < 0.45) {
        this.flipCd = rand(150, 260);
        o.moveRequest = 'nb_flip';
        return o;
      } else if (onScreen && adx > 150 && adx < 440 && Math.abs(dz) < 50 && this.throwCd <= 0) {
        this.throwCd = rand(this.throwRate[0], this.throwRate[1]);
        o.moveRequest = 'nb_throw';
        return o;
      }

      const keep = targetDown ? this.preferred + 40 : this.preferred;
      this.wantX = target.x - dir * keep * rand(0.8, 1.1);
      this.wantZ = target.z + this.strafe * rand(10, 34);
    }

    let tx = this.wantX;
    if (this.retreat > 0) {
      this.retreat--;
      tx = self.x - dir * 60;
    }
    const b = world.boundsFor(self);
    tx = Math.max(b.minX + 10, Math.min(b.maxX - 10, tx));
    const ex = tx - self.x;
    const ez = this.wantZ - self.z;
    if (Math.abs(ex) > 14) o.moveX = Math.sign(ex);
    if (Math.abs(ez) > 6) o.moveZ = Math.sign(ez);
    if (!onScreen && Math.abs(ex) > 120) o.run = o.moveX === self.facing;
    return o;
  }

  onHit(self: Fighter, _attacker: Fighter, hb: Hitbox): HitResponse {
    if (this.subCd > 0 || self.hp <= hb.damage) return;
    if (self.comboTaken >= 1 && Math.random() < this.subChance) {
      this.subCd = rand(260, 420);
      return 'substitute';
    }
  }
}
