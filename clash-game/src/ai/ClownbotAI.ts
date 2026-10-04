import { nearestOpponent } from '../physics/Collision';
import { FState, emptyInput, type Controller, type InputFrame, type Variant, type World } from '../physics/Types';
import type { Fighter } from '../entities/Fighter';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/**
 * Clownbots swarm: each picks a flank slot around the player, closes in, trades piston punches,
 * launches armored rushes from mid-range and detonates shock pulses when critically damaged.
 */
export class ClownbotAI implements Controller {
  private out: InputFrame = emptyInput();
  private think = 0;
  private tackleCd: number;
  private pulseCd = rand(30, 120);
  private flank = Math.random() < 0.5 ? -1 : 1;
  private laneOffset = rand(-18, 18);
  private hover = rand(95, 130);
  private pendingAttack = 0;
  private readonly aggression: number;

  constructor(private readonly variant: Variant) {
    this.tackleCd = rand(90, 220);
    this.aggression = variant === 'boss' ? 0.9 : variant === 'elite' ? 0.8 : variant === 'heavy' ? 0.5 : 0.6;
  }

  getInput(self: Fighter, world: World): InputFrame {
    const o = this.out;
    o.moveX = o.moveZ = 0;
    o.run = o.jump = o.jumpPressed = o.attackPressed = o.specialPressed = false;
    o.dashDir = 0;
    o.moveRequest = undefined;

    this.tackleCd--;
    this.pulseCd--;
    this.think--;

    const target = nearestOpponent(self, world);
    self.autoFace = target;
    if (!target) return o;
    const dx = target.x - self.x;
    const adx = Math.abs(dx);
    const dz = target.z - self.z;
    const dir = Math.sign(dx) || 1;

    if (self.state === FState.ATTACK) {
      if (self.move?.id === 'fb_punch1' && (self.moveConnected || Math.random() < 0.04)) o.attackPressed = true;
      return o;
    }
    if (!self.isActionable()) return o;

    const targetDown = target.state === FState.KNOCKDOWN || target.state === FState.WAKEUP;
    const low = self.hp < self.maxHp * 0.35;

    if (this.pendingAttack > 0) {
      this.pendingAttack--;
      if (this.pendingAttack === 0 && adx < 78 * self.scale && Math.abs(dz) < 13 && !targetDown) {
        o.attackPressed = true;
        return o;
      }
    }

    if (low && this.pulseCd <= 0 && adx < 130 && Math.abs(dz) < 40 && !targetDown) {
      this.pulseCd = rand(260, 380);
      o.moveRequest = 'fb_pulse';
      return o;
    }

    if (this.think <= 0) {
      this.think = Math.round(rand(6, 14));
      if (!targetDown && adx < 72 * self.scale && Math.abs(dz) < 12) {
        if (Math.random() < this.aggression && world.requestToken(self)) this.pendingAttack = Math.round(rand(3, 10));
      } else if (!targetDown && adx > 140 && adx < 330 && Math.abs(dz) < 12 && this.tackleCd <= 0) {
        this.tackleCd = this.variant === 'boss' ? rand(110, 170) : this.variant === 'heavy' ? rand(160, 240) : rand(220, 340);
        o.moveRequest = 'fb_tackle';
        return o;
      }
      if (Math.random() < 0.08) this.flank = -this.flank;
    }

    const hasToken = adx < 160 && world.requestToken(self);
    const side = target.x + this.flank * (hasToken ? 52 : this.hover) * self.scale;
    const wantX = targetDown ? target.x + this.flank * 120 : side;
    const wantZ = target.z + (hasToken ? 0 : this.laneOffset);
    const ex = wantX - self.x;
    const ez = wantZ - self.z;
    if (Math.abs(ex) > 10) o.moveX = Math.sign(ex);
    if (Math.abs(ez) > 5) o.moveZ = Math.sign(ez);
    if (Math.abs(ex) < 10 && adx > 8) self.facing = dir > 0 ? 1 : -1;
    return o;
  }
}
