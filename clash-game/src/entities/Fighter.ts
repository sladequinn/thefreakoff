import {
  AIR_CONTROL,
  CHIP_DAMAGE,
  COLORS,
  COMBO_SCALING_MIN,
  COMBO_SCALING_STEP,
  DEPTH_SPEED_FACTOR,
  GRAVITY,
  GROUND_FRICTION,
  HARD_KNOCKDOWN_FRAMES,
  JUGGLE_GRAVITY_STEP,
  KNOCKDOWN_FRAMES,
  LAND_FRAMES,
  LIGHT_HIT_THRESHOLD,
  PREJUMP_FRAMES,
  RUN_MULTIPLIER,
  SPECIAL_HP_COST,
  SUBSTITUTE_FRAMES,
  WAKEUP_FRAMES,
} from '../config/constants';
import { clamp, nearestOpponent } from '../physics/Collision';
import {
  FState,
  emptyInput,
  type CharacterDef,
  type Controller,
  type Hitbox,
  type HitWindow,
  type Hurtbox,
  type InputFrame,
  type MoveData,
  type Team,
  type Variant,
  type World,
} from '../physics/Types';
import { Entity, Projectile, type RenderView } from './Entity';

export type HitResult = 'hit' | 'blocked' | 'armored' | 'miss';

export interface FighterOptions {
  team: Team;
  controller: Controller;
  variant?: Variant;
  scale?: number;
  hpMult?: number;
  name?: string;
}

export interface CombatStats {
  damageDealt: number;
  hitsLanded: number;
  maxCombo: number;
  kos: number;
}

const ACTIONABLE = new Set<FState>([FState.IDLE, FState.WALK, FState.RUN]);
const UNHITTABLE = new Set<FState>([
  FState.KNOCKDOWN,
  FState.WAKEUP,
  FState.SUBSTITUTE,
  FState.DEAD,
  FState.INTRO,
  FState.VICTORY,
]);
const MAX_JUGGLE = 7;

/**
 * Shared combatant: state machine, frame-data driven moves, knockback/juggle physics and hit reactions.
 * Players, grunts and bosses differ only in their CharacterDef and Controller.
 */
export class Fighter extends Entity {
  readonly def: CharacterDef;
  team: Team;
  controller: Controller;
  variant: Variant;
  name: string;

  hp: number;
  maxHp: number;
  displayHp: number;
  private hpLagDelay = 0;

  state: FState = FState.IDLE;
  stateFrame = 0;
  move: MoveData | null = null;
  moveFrame = -1;
  comboIndex = -1;
  bufferedAttack = false;
  bufferedSpecial = false;
  readonly hitRegistry = new Set<string>();
  moveConnected = false;

  hitstun = 0;
  blockstun = 0;
  hitstop = 0;
  invulnTimer = 0;
  armorHits = 0;
  hyperArmor = 0;
  comboTaken = 0;
  juggleCount = 0;
  pendingGroundBounce = false;
  pendingWallBounce = false;
  hardKnockdown = false;
  knockdownTimer = KNOCKDOWN_FRAMES;
  landLag = LAND_FRAMES;
  airAttackUsed = false;
  noGravity = false;
  hidden = false;
  guarding = false;
  flash = 0;
  walkPhase = 0;
  animTime = 0;
  koNotified = false;
  deathFade = 0;
  lastHitFrame = -9999;
  private subX = 0;
  private subZ = 0;

  input: InputFrame = emptyInput();
  canBlock = false;
  /** Training dummy: guard without having to hold away. */
  autoGuard = false;
  autoFace: Fighter | null = null;
  /** Attacker currently holding this fighter in a command grab. */
  grabbedBy: Fighter | null = null;
  private riffIndex = 0;
  lastAttacker: Fighter | null = null;
  damageMult = 1;
  speedMult = 1;
  readonly combat: CombatStats = { damageDealt: 0, hitsLanded: 0, maxCombo: 0, kos: 0 };

  /** Render-side caches owned by SpriteRenderer. */
  trail: { x: number; y: number; z: number; facing: number; pose: unknown; life: number }[] = [];
  bladeTrail: { x: number; y: number; x2: number; y2: number; life: number }[] = [];

  constructor(def: CharacterDef, opts: FighterOptions) {
    super();
    this.def = def;
    this.team = opts.team;
    this.controller = opts.controller;
    this.variant = opts.variant ?? 'normal';
    this.scale = opts.scale ?? def.scale;
    this.name = opts.name ?? def.name;
    this.maxHp = Math.round(def.stats.maxHp * (opts.hpMult ?? 1));
    this.hp = this.maxHp;
    this.displayHp = this.maxHp;
  }

  // ------------------------------------------------------------------ queries

  isActionable(): boolean {
    return ACTIONABLE.has(this.state);
  }

  isAirborne(): boolean {
    return this.y > 0.01;
  }

  isTargetable(): boolean {
    return !this.remove && this.state !== FState.DEAD && this.hp > 0;
  }

  isHittable(): boolean {
    if (!this.isTargetable() || this.invulnTimer > 0 || this.hidden) return false;
    if (UNHITTABLE.has(this.state)) return false;
    if (this.state === FState.JUGGLE && this.juggleCount >= MAX_JUGGLE) return false;
    const inv = this.move?.invuln;
    const mf = Math.max(0, this.moveFrame);
    if (this.state === FState.ATTACK && inv && mf >= inv[0] && mf <= inv[1]) return false;
    return true;
  }

  isInvulnerable(): boolean {
    return this.isTargetable() && !this.isHittable();
  }

  isSolid(): boolean {
    return (
      this.y < 1 &&
      !this.hidden &&
      !this.grabbedBy &&
      this.state !== FState.JUGGLE &&
      this.state !== FState.KNOCKDOWN &&
      this.state !== FState.DEAD &&
      this.state !== FState.SUBSTITUTE
    );
  }

  get specialCost(): number {
    return this.maxHp * SPECIAL_HP_COST;
  }

  canAffordSpecial(): boolean {
    return !!this.def.special && this.hp > this.specialCost + 1;
  }

  getHurtbox(): Hurtbox {
    const base = this.def.hurtbox;
    switch (this.state) {
      case FState.KNOCKDOWN:
      case FState.DEAD:
        return { offsetX: -10, offsetY: 8, width: base.width * 2.2, height: 16, zDepth: base.zDepth };
      case FState.JUGGLE:
        return { offsetX: 0, offsetY: base.height * 0.3, width: base.width * 1.5, height: base.height * 0.6, zDepth: base.zDepth };
      case FState.PREJUMP:
      case FState.LAND:
      case FState.WAKEUP:
        return { offsetX: base.offsetX, offsetY: base.offsetY * 0.75, width: base.width, height: base.height * 0.75, zDepth: base.zDepth };
      default:
        if (this.move?.pose === 'slade_sweep' || (this.move?.pose === 'fr_riot' && this.moveFrame >= 48)) {
          return { offsetX: 8, offsetY: base.offsetY * 0.6, width: base.width * 1.3, height: base.height * 0.6, zDepth: base.zDepth };
        }
        return base;
    }
  }

  activeWindows(): HitWindow[] | null {
    if (this.state !== FState.ATTACK || !this.move || this.hidden) return null;
    const f = this.moveFrame;
    let out: HitWindow[] | null = null;
    for (const w of this.move.hits) {
      if (f >= w.start && f <= w.end) (out ??= []).push(w);
    }
    return out;
  }

  // ------------------------------------------------------------------ state control

  setState(s: FState): void {
    if (ACTIONABLE.has(s) && !ACTIONABLE.has(this.state)) {
      this.comboTaken = 0;
      this.juggleCount = 0;
    }
    this.state = s;
    this.stateFrame = 0;
  }

  private setLocomotion(s: FState): void {
    if (this.state !== s) this.setState(s);
  }

  startMove(id: string, world: World): boolean {
    const m = this.def.moves[id];
    if (!m) return false;
    if (m.tokenRequired && !world.requestToken(this)) return false;
    if (m.airborne && !this.isAirborne()) return false;
    const wasAttacking = this.move !== null;
    this.move = m;
    this.moveFrame = -1;
    this.hitRegistry.clear();
    this.moveConnected = false;
    this.bufferedAttack = false;
    this.bufferedSpecial = false;
    this.hidden = false;
    this.noGravity = false;
    this.armorHits = m.armor ?? 0;
    this.comboIndex = m.kind === 'combo' ? this.def.combo.indexOf(m.id) : -1;
    if (m.hpCost) this.hp = Math.max(1, this.hp - this.maxHp * m.hpCost);
    if (!this.autoFace && this.input.moveX !== 0) this.facing = this.input.moveX > 0 ? 1 : -1;
    if (!wasAttacking || this.state !== FState.ATTACK) this.state = FState.ATTACK;
    this.stateFrame = 0;
    return true;
  }

  endMove(world: World | null): void {
    this.move = null;
    this.moveFrame = -1;
    this.comboIndex = -1;
    this.armorHits = 0;
    this.hidden = false;
    this.noGravity = false;
    world?.releaseToken(this);
  }

  resetForRound(x: number, z: number, facing: 1 | -1): void {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vx = this.vy = this.vz = 0;
    this.facing = facing;
    this.hp = this.displayHp = this.maxHp;
    this.move = null;
    this.hidden = false;
    this.grabbedBy = null;
    this.hitstop = this.invulnTimer = this.hyperArmor = 0;
    this.koNotified = false;
    this.lastAttacker = null;
    this.trail.length = 0;
    this.bladeTrail.length = 0;
    this.setState(FState.INTRO);
  }

  // ------------------------------------------------------------------ update

  update(world: World): void {
    this.animTime++;
    if (this.flash > 0) this.flash--;
    this.input = this.controller.getInput(this, world);
    const inp = this.input;

    if (this.hitstop > 0) {
      this.hitstop--;
      if (this.state === FState.ATTACK) {
        if (inp.attackPressed) this.bufferedAttack = true;
        if (inp.specialPressed) this.bufferedSpecial = true;
      }
      return;
    }

    if (this.hpLagDelay > 0) this.hpLagDelay--;
    else if (this.displayHp > this.hp) this.displayHp = Math.max(this.hp, this.displayHp - Math.max(0.35, (this.displayHp - this.hp) * 0.06));
    if (this.displayHp < this.hp) this.displayHp = this.hp;

    if (this.invulnTimer > 0) this.invulnTimer--;
    if (this.hyperArmor > 0) this.hyperArmor--;
    this.stateFrame++;
    this.guarding = false;

    switch (this.state) {
      case FState.IDLE:
      case FState.WALK:
      case FState.RUN:
        this.updateActionable(inp, world);
        break;
      case FState.PREJUMP:
        if (inp.specialPressed && this.canAffordSpecial() && this.def.special) {
          this.startMove(this.def.special, world);
          break;
        }
        if (this.stateFrame >= PREJUMP_FRAMES) {
          const sp = this.def.stats.speed * this.speedMult;
          this.vy = this.def.stats.jumpPower;
          this.vx = inp.moveX * sp * (inp.run ? 1.35 : 1);
          this.vz = inp.moveZ * sp * 0.45;
          this.y = 0.5;
          this.airAttackUsed = false;
          this.setState(FState.JUMP);
          world.audio.playJump();
          world.particles.dust(this.x, this.z, 4);
        }
        break;
      case FState.JUMP:
        this.updateJump(inp, world);
        break;
      case FState.LAND:
        if (this.stateFrame >= this.landLag) this.setState(FState.IDLE);
        break;
      case FState.ATTACK:
        this.tickMove(inp, world);
        break;
      case FState.HURT:
        if (this.grabbedBy) {
          this.followGrab();
          return;
        }
        if (this.stateFrame >= this.hitstun) this.setState(FState.IDLE);
        break;
      case FState.BLOCK:
        if (this.stateFrame >= this.blockstun) this.setState(FState.IDLE);
        break;
      case FState.JUGGLE:
        break;
      case FState.KNOCKDOWN:
        if (this.stateFrame >= this.knockdownTimer) {
          if (this.hp <= 0) this.setState(FState.DEAD);
          else this.setState(FState.WAKEUP);
        }
        break;
      case FState.WAKEUP:
        if (this.stateFrame >= WAKEUP_FRAMES) {
          this.setState(FState.IDLE);
          this.hardKnockdown = false;
          this.controller.onWakeup?.(this, world);
        }
        break;
      case FState.SUBSTITUTE:
        this.updateSubstitute(world);
        break;
      case FState.DEAD:
      case FState.INTRO:
      case FState.VICTORY:
        this.vx *= 0.8;
        this.vz = 0;
        break;
    }

    this.physics(world);
  }

  private updateActionable(inp: InputFrame, world: World): void {
    const opp = this.autoFace;
    if (opp && opp.isTargetable() && Math.abs(opp.x - this.x) > 6) this.facing = opp.x > this.x ? 1 : -1;

    if (inp.moveRequest && this.def.moves[inp.moveRequest]) {
      const req = this.def.moves[inp.moveRequest];
      if (!req.hpCost || this.canAffordSpecial()) {
        if (this.startMove(inp.moveRequest, world)) return;
      }
    }
    // Command inputs are read relative to the nearest foe so they work in story mode, where facing follows movement.
    const ref = (this.def.commandGrab || this.def.backAttack) && inp.moveX !== 0 ? (opp ?? nearestOpponent(this, world)) : null;
    const refDir = ref ? Math.sign(ref.x - this.x) || this.facing : 0;
    const towardOpp = ref !== null && inp.moveX === refDir;
    const awayFromOpp = ref !== null && inp.moveX === -refDir;
    if ((inp.specialPressed || this.bufferedSpecial) && this.def.commandGrab && towardOpp && this.state !== FState.RUN) {
      this.bufferedSpecial = false;
      this.startMove(this.def.commandGrab, world);
      this.facing = refDir as 1 | -1;
      return;
    }
    if ((inp.specialPressed || this.bufferedSpecial) && this.def.special && this.canAffordSpecial()) {
      this.startMove(this.def.special, world);
      return;
    }
    this.bufferedSpecial = false;
    if (inp.attackPressed) {
      if (this.state === FState.RUN && this.def.dashAttack) {
        if (this.input.moveX !== 0 && !this.autoFace) this.facing = this.input.moveX > 0 ? 1 : -1;
        this.startMove(this.def.dashAttack, world);
      } else if (this.def.backAttack && awayFromOpp) {
        this.startMove(this.def.backAttack, world);
        this.facing = refDir as 1 | -1;
      } else if (this.def.combo.length) {
        this.startMove(this.def.combo[0], world);
      }
      return;
    }
    if (inp.jumpPressed) {
      this.vx *= 0.5;
      this.setState(FState.PREJUMP);
      return;
    }

    if (this.canBlock && opp && ((inp.moveX !== 0 && inp.moveX === -this.facing) || this.autoGuard)) this.guarding = true;

    let run = inp.run && inp.moveX !== 0 && (!opp || inp.moveX === this.facing);
    if (inp.dashDir !== 0 && (!opp || inp.dashDir === this.facing)) {
      run = true;
      if (!opp) this.facing = inp.dashDir > 0 ? 1 : -1;
      world.particles.dust(this.x, this.z, 5, this.facing);
      world.audio.playDash();
    }

    if (inp.moveX !== 0 || inp.moveZ !== 0) {
      const sp = this.def.stats.speed * this.speedMult * (run ? RUN_MULTIPLIER : this.guarding ? 0.6 : 1);
      const diag = inp.moveX !== 0 && inp.moveZ !== 0 ? 0.85 : 1;
      this.vx = inp.moveX * sp * diag;
      this.vz = inp.moveZ * this.def.stats.speed * this.speedMult * DEPTH_SPEED_FACTOR * diag;
      if (!opp && inp.moveX !== 0) this.facing = inp.moveX > 0 ? 1 : -1;
      this.setLocomotion(run ? FState.RUN : FState.WALK);
      if (run && this.animTime % 7 === 0) world.particles.dust(this.x - this.facing * 8, this.z, 1, this.facing);
    } else {
      this.vx = 0;
      this.vz = 0;
      this.setLocomotion(FState.IDLE);
    }
  }

  private updateJump(inp: InputFrame, world: World): void {
    const sp = this.def.stats.speed * this.speedMult;
    if (inp.moveX !== 0) {
      const target = inp.moveX * sp * 0.95;
      this.vx += clamp(target - this.vx, -AIR_CONTROL * 2, AIR_CONTROL * 2);
      if (!this.autoFace) this.facing = inp.moveX > 0 ? 1 : -1;
    }
    this.vz += clamp(inp.moveZ * sp * 0.4 - this.vz, -AIR_CONTROL, AIR_CONTROL);
    const airMove = inp.moveRequest && this.def.moves[inp.moveRequest]?.airborne ? inp.moveRequest : null;
    if ((inp.attackPressed || airMove) && this.def.airAttack && !this.airAttackUsed) {
      this.airAttackUsed = true;
      this.startMove(airMove ?? this.def.airAttack, world);
    }
  }

  private tickMove(inp: InputFrame, world: World): void {
    const m = this.move;
    if (!m) {
      this.setState(FState.IDLE);
      return;
    }
    this.moveFrame++;
    const f = this.moveFrame;

    if (m.events) for (const e of m.events) if (e.frame === f) this.fx(e.fx, world);
    if (m.teleport && f === m.teleport.frame) {
      const b = world.boundsFor(this);
      this.x = clamp(this.x + m.teleport.dx * this.facing, b.minX, b.maxX);
    }

    let driven = false;
    this.noGravity = false;
    if (m.motion) {
      for (const k of m.motion) {
        if (f < k.from || f > k.to) continue;
        if (k.vx !== undefined) this.vx = k.vx * this.facing * this.speedMult;
        if (k.vy !== undefined) this.vy = k.vy;
        if (k.vz !== undefined) this.vz = k.vz;
        if (k.noGravity) this.noGravity = true;
        driven = true;
      }
    }
    if (!driven && !this.isAirborne()) {
      this.vx *= m.friction ?? 0.78;
      this.vz *= 0.6;
    }
    this.hidden = !!m.hidden && f >= m.hidden[0] && f <= m.hidden[1];

    if (inp.attackPressed && f > 0) this.bufferedAttack = true;
    if (inp.specialPressed) this.bufferedSpecial = true;

    if (m.kind === 'combo') {
      if (this.bufferedSpecial && this.def.special && this.canAffordSpecial() && ((this.comboIndex === 0 && f <= 3) || (this.moveConnected && m.cancelFrom !== undefined && f >= m.cancelFrom))) {
        this.startMove(this.def.special, world);
        return;
      }
      if (this.bufferedAttack && m.cancelFrom !== undefined && f >= m.cancelFrom) {
        const next = this.def.combo[this.comboIndex + 1];
        if (next) {
          this.startMove(next, world);
          return;
        }
      }
    }

    if (f >= m.duration - 1 && !(m.endsOnLand && this.isAirborne())) {
      const air = this.isAirborne();
      this.endMove(world);
      this.bufferedSpecial = false;
      this.setState(air ? FState.JUMP : FState.IDLE);
    }
  }

  private updateSubstitute(world: World): void {
    this.vx = this.vy = this.vz = 0;
    const half = Math.floor(SUBSTITUTE_FRAMES / 2);
    this.hidden = this.stateFrame < SUBSTITUTE_FRAMES - 5;
    if (this.stateFrame === half) {
      const b = world.boundsFor(this);
      this.x = clamp(this.subX, b.minX, b.maxX);
      this.z = clamp(this.subZ, b.minZ, b.maxZ);
      this.y = 0;
      world.particles.smoke(this.x, 0, this.z, 10, 'rgba(70,90,120,1)');
    }
    if (this.stateFrame >= SUBSTITUTE_FRAMES) {
      this.hidden = false;
      const opp = this.lastAttacker;
      if (opp) this.facing = opp.x > this.x ? 1 : -1;
      this.setState(FState.IDLE);
    }
  }

  // ------------------------------------------------------------------ physics

  private physics(world: World): void {
    const airborne = this.y > 0 || this.vy > 0;
    if (airborne) {
      if (!this.noGravity) {
        const g = this.state === FState.JUGGLE ? GRAVITY * (1 + this.juggleCount * JUGGLE_GRAVITY_STEP) : GRAVITY;
        this.vy -= g;
      }
      this.y += this.vy;
      if (this.y <= 0) {
        this.y = 0;
        const impact = this.vy;
        this.vy = 0;
        this.onLand(world, impact);
      }
    }
    this.x += this.vx;
    this.z += this.vz;

    const b = world.boundsFor(this);
    if (this.x < b.minX) {
      this.x = b.minX;
      this.onWall(world, -1);
    } else if (this.x > b.maxX) {
      this.x = b.maxX;
      this.onWall(world, 1);
    }
    this.z = clamp(this.z, b.minZ, b.maxZ);

    if (this.y === 0) {
      switch (this.state) {
        case FState.HURT:
        case FState.BLOCK:
        case FState.KNOCKDOWN:
        case FState.DEAD:
        case FState.WAKEUP:
        case FState.LAND:
        case FState.PREJUMP:
          this.vx *= GROUND_FRICTION;
          this.vz *= 0.7;
          break;
        default:
          break;
      }
      this.walkPhase += Math.hypot(this.vx, this.vz) * 0.085;
    }
  }

  private onLand(world: World, impactVy: number): void {
    switch (this.state) {
      case FState.JUMP:
        this.landLag = LAND_FRAMES;
        this.setState(FState.LAND);
        this.vx *= 0.3;
        this.vz = 0;
        world.particles.dust(this.x, this.z, 4);
        world.audio.playLand();
        break;
      case FState.ATTACK: {
        const m = this.move;
        if (m && (m.endsOnLand || m.airborne)) {
          if (m.events) for (const e of m.events) if (e.frame === -1) this.fx(e.fx, world);
          this.endMove(world);
          this.landLag = m.landingLag ?? LAND_FRAMES;
          this.setState(FState.LAND);
          this.vx *= 0.2;
          this.vz = 0;
        }
        break;
      }
      case FState.JUGGLE:
        if (this.pendingGroundBounce) {
          this.pendingGroundBounce = false;
          this.vy = 5.2;
          this.y = 0.5;
          this.vx *= 0.5;
          world.particles.dust(this.x, this.z, 8);
          world.particles.ring(this.x, this.z, 10, 60, 'rgba(200,180,255,0.8)', 16);
          world.camera.shake(4, 0, 1, 8);
          world.audio.playLand();
          break;
        }
        this.knockdownTimer = this.hardKnockdown ? HARD_KNOCKDOWN_FRAMES : KNOCKDOWN_FRAMES;
        if (this.hp <= 0) this.knockdownTimer = 50;
        this.setState(FState.KNOCKDOWN);
        this.vx *= 0.45;
        this.vz = 0;
        world.particles.dust(this.x, this.z, impactVy < -6 ? 10 : 6);
        world.audio.playLand();
        if (impactVy < -7) world.camera.shake(3, 0, 1, 6);
        break;
      case FState.SUBSTITUTE:
      case FState.DEAD:
      case FState.KNOCKDOWN:
        break;
      default:
        if (this.state === FState.HURT || this.state === FState.BLOCK) break;
        this.setState(FState.IDLE);
        break;
    }
  }

  private onWall(world: World, side: number): void {
    if (this.state === FState.JUGGLE && this.pendingWallBounce && Math.abs(this.vx) > 1.5) {
      this.pendingWallBounce = false;
      this.vx = -side * Math.max(3, Math.abs(this.vx) * 0.55);
      this.vy = Math.max(this.vy, 5);
      this.y = Math.max(this.y, 1);
      world.particles.debris(this.x + side * 6, this.z, 8, -side);
      world.particles.hitSpark('impact', this.x + side * 10, this.y + 40, this.z, -side, true);
      world.camera.shake(6, side, 0, 10);
      world.audio.playHitHeavy();
      world.audio.playDebris();
    } else if (this.state === FState.JUGGLE || this.state === FState.HURT) {
      this.vx *= -0.2;
    }
  }

  // ------------------------------------------------------------------ hits

  receiveHit(attacker: Fighter, hb: Hitbox, world: World): HitResult {
    if (!this.isHittable()) return 'miss';
    if (this.controller.onHit?.(this, attacker, hb, world) === 'substitute') {
      this.doSubstitute(world, attacker);
      return 'miss';
    }

    if (hb.effect === 'grab') return this.receiveGrab(attacker, hb, world);

    const attackerInFront = Math.sign(attacker.x - this.x) === this.facing || Math.abs(attacker.x - this.x) < 4;
    if ((this.guarding || this.state === FState.BLOCK) && attackerInFront && !this.isAirborne()) {
      const chip = (hb.damage * CHIP_DAMAGE) / this.def.stats.defense;
      this.hp = Math.max(1, this.hp - chip);
      this.hpLagDelay = 20;
      if (this.move) this.endMove(world);
      this.setState(FState.BLOCK);
      this.blockstun = Math.round(hb.hitstun * 0.6) + 4;
      this.vx = -this.facing * (hb.knockbackX * 0.45 + 1.5);
      this.hitstop = Math.max(2, hb.hitstop - 1);
      return 'blocked';
    }

    const scale = Math.max(COMBO_SCALING_MIN, 1 - COMBO_SCALING_STEP * this.comboTaken);
    const dmg = (hb.damage * scale * attacker.damageMult) / this.def.stats.defense;
    this.lastHitFrame = world.frame;
    this.lastAttacker = attacker;

    const light = hb.damage <= LIGHT_HIT_THRESHOLD && hb.effect !== 'launch';
    if (this.hyperArmor > 0 || (this.armorHits > 0 && light)) {
      if (this.hyperArmor <= 0) this.armorHits--;
      this.hp -= dmg * 0.75;
      this.hpLagDelay = 30;
      this.flash = 6;
      this.hitstop = hb.hitstop;
      world.particles.text(this.x, this.y + 110 * this.scale, this.z, 'ARMOR', COLORS.brass, 14);
      if (this.hp > 0) return 'armored';
      this.hp = 0;
    } else {
      this.hp -= dmg;
    }
    if (this.hp < 0) this.hp = 0;
    this.hpLagDelay = 30;
    this.comboTaken++;

    const wasAir = this.isAirborne();
    if (this.move) this.endMove(world);
    this.hidden = false;
    this.noGravity = false;
    this.grabbedBy = null;
    this.flash = 8;

    const kdir = hb.radial ? Math.sign(this.x - attacker.x) || attacker.facing : attacker.facing;
    this.facing = kdir > 0 ? -1 : 1;
    this.vx = hb.knockbackX * kdir;
    this.vz = 0;
    const eff = hb.effect ?? 'none';
    const dying = this.hp <= 0;
    const launches = wasAir || hb.knockbackY > 0 || eff !== 'none' || dying;

    if (launches) {
      this.setState(FState.JUGGLE);
      this.juggleCount++;
      this.pendingGroundBounce = eff === 'groundBounce';
      this.pendingWallBounce = eff === 'wallBounce';
      this.hardKnockdown = eff === 'hardKnockdown';
      switch (eff) {
        case 'groundBounce':
        case 'hardKnockdown':
          this.vy = -5;
          this.y = Math.max(this.y, 0.5);
          break;
        case 'trip':
          this.vy = 3.4;
          this.y = Math.max(this.y, 1);
          this.vx = kdir * Math.max(1.5, hb.knockbackX * 0.5);
          break;
        default:
          this.vy = Math.max(hb.knockbackY, wasAir ? 3.2 : 2.5);
          this.y = Math.max(this.y, 1);
          break;
      }
      if (dying && eff !== 'groundBounce' && eff !== 'hardKnockdown') {
        this.vy = Math.max(this.vy, 5.5);
        this.vx = kdir * Math.max(Math.abs(this.vx), 4.5);
      }
    } else {
      this.setState(FState.HURT);
      this.hitstun = hb.hitstun;
    }
    this.hitstop = hb.hitstop;
    return 'hit';
  }

  /** Command grabs ignore guard but whiff on airborne, armoured or already-held targets. */
  private receiveGrab(attacker: Fighter, hb: Hitbox, world: World): HitResult {
    if (this.isAirborne() || this.hyperArmor > 0 || this.grabbedBy || this.state === FState.KNOCKDOWN || this.state === FState.WAKEUP) return 'miss';
    if (this.move) this.endMove(world);
    this.hidden = false;
    this.noGravity = false;
    this.guarding = false;
    this.lastHitFrame = world.frame;
    this.lastAttacker = attacker;
    this.hp = Math.max(1, this.hp - hb.damage / this.def.stats.defense);
    this.hpLagDelay = 30;
    this.comboTaken++;
    this.grabbedBy = attacker;
    this.facing = attacker.facing > 0 ? -1 : 1;
    this.vx = this.vy = this.vz = 0;
    this.y = 0;
    this.flash = 6;
    this.hitstop = hb.hitstop;
    this.setState(FState.HURT);
    this.hitstun = hb.hitstun;
    world.particles.text(this.x, this.y + 110 * this.scale, this.z, 'GRABBED', COLORS.hazard, 13);
    return 'hit';
  }

  /** Tracks the grabbing attacker's hands while held; releases if the grab move is interrupted. */
  private followGrab(): void {
    const g = this.grabbedBy;
    const spec = g?.move?.grab;
    if (!g || !spec || g.state !== FState.ATTACK || g.moveFrame > spec.to + 2) {
      this.grabbedBy = null;
      this.hitstun = Math.min(this.hitstun, this.stateFrame + 8);
      return;
    }
    const f = g.moveFrame;
    const t = Math.max(0, Math.min(1, (f - spec.from) / Math.max(1, spec.to - spec.from)));
    const ease = t * t * (3 - 2 * t);
    this.x = g.x + g.facing * spec.x * g.scale;
    this.z = g.z + 1;
    this.y = spec.lift * ease;
    this.vx = this.vy = this.vz = 0;
    this.facing = g.facing > 0 ? -1 : 1;
  }

  doSubstitute(world: World, attacker: Fighter): void {
    if (this.move) this.endMove(world);
    this.lastAttacker = attacker;
    world.particles.smoke(this.x, this.y, this.z, 16, 'rgba(60,70,95,1)');
    world.particles.debris(this.x, this.z, 5, 0, '#6b4a2a');
    world.particles.text(this.x, this.y + 100, this.z, 'SUBSTITUTE!', '#9fe8ff', 13);
    world.audio.playSmoke();
    const behind = attacker.x - attacker.facing * 80;
    this.subX = behind;
    this.subZ = attacker.z + (Math.random() - 0.5) * 20;
    this.y = 0;
    this.vx = this.vy = this.vz = 0;
    this.comboTaken = 0;
    this.juggleCount = 0;
    this.setState(FState.SUBSTITUTE);
    this.hidden = true;
  }

  bounceOffHit(): void {
    const b = this.move?.onHitBounce;
    if (!b) return;
    this.move = null;
    this.moveFrame = -1;
    this.noGravity = false;
    this.hidden = false;
    this.setState(FState.JUMP);
    this.vy = b.vy;
    this.vx = b.vx * this.facing;
    this.y = Math.max(this.y, 1);
    this.airAttackUsed = true;
  }

  // ------------------------------------------------------------------ move effects

  fx(name: string, world: World): void {
    const p = world.particles;
    const a = world.audio;
    const hx = this.x + this.facing * 32 * this.scale;
    const hy = this.y + 52 * this.scale;
    switch (name) {
      case 'slash':
        a.playSlash();
        break;
      case 'whiff':
        a.playWhiff();
        break;
      case 'voice_hah':
        a.playVoiceGrunt(this.def.voice, 'hah');
        break;
      case 'voice_hyah':
        a.playVoiceGrunt(this.def.voice, 'hyah');
        break;
      case 'voice_take':
        a.playVoiceGrunt(this.def.voice, 'take');
        break;
      case 'seal':
        a.playMagic();
        p.glyphs(hx, hy, this.z + 1, 7);
        p.spawn('flash', hx, hy, this.z + 1, 0, 0, 0, 10, 4, COLORS.void, { size2: 26 });
        break;
      case 'crescent':
        a.playSlash();
        a.playMagic();
        p.spawn('kinetic', this.x + this.facing * 26, this.y + 60, this.z + 1, this.facing * 0.4, 1.5, 0, 16, 16, '#8a4dff', { size2: 54, rot: this.facing });
        break;
      case 'smoke_out':
        p.smoke(this.x, this.y, this.z, 14, 'rgba(34,16,58,1)');
        p.glyphs(this.x, this.y + 40, this.z, 4);
        a.playSmoke();
        a.playDash();
        break;
      case 'smoke_in':
        p.smoke(this.x, this.y, this.z, 10, 'rgba(34,16,58,1)');
        p.dust(this.x, this.z, 5, this.facing);
        break;
      case 'mudra':
        a.playVoiceGrunt(this.def.voice, 'hah');
        a.playMagic();
        p.glyphs(this.x + this.facing * 12, this.y + 70, this.z + 1, 10);
        p.ring(this.x, this.z, 10, 70, COLORS.void, 24);
        break;
      case 'sigils': {
        a.playSpecial();
        world.camera.shake(9, 0, 1, 18);
        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI * 2 + Math.PI / 2;
          p.sigil(this.x + Math.cos(ang) * 62, this.z + Math.sin(ang) * 20, 70);
        }
        p.ring(this.x, this.z, 20, 130, '#b98aff', 28);
        p.ring(this.x, this.z, 10, 110, '#6a1dff', 34);
        p.glyphs(this.x, this.y + 30, this.z + 2, 20);
        for (let i = 0; i < 18; i++) {
          const ang = Math.random() * Math.PI * 2;
          p.spawn('spark', this.x + Math.cos(ang) * 60, 4, this.z + Math.sin(ang) * 16, Math.cos(ang) * 3, 6 + Math.random() * 6, 0, 28, 4, '#c79bff', { drag: 0.94, gravity: 0.05 });
        }
        break;
      }
      case 'dive':
        a.playDash();
        a.playVoiceGrunt(this.def.voice, 'hyah');
        p.glyphs(this.x, this.y + 30, this.z + 1, 6);
        break;
      case 'runic_land':
        p.ring(this.x, this.z, 8, 70, COLORS.void, 20);
        p.glyphs(this.x, 10, this.z + 1, 8);
        p.dust(this.x, this.z, 8);
        world.camera.shake(3, 0, 1, 6);
        a.playLand();
        break;
      case 'kinetic':
        p.kinetic(hx, hy, this.z + 1, this.facing, '#ff7a2a', 52);
        break;
      case 'charge_start':
        a.playDash();
        a.playVoiceGrunt(this.def.voice, 'hah');
        p.dust(this.x, this.z, 10, this.facing);
        break;
      case 'charge_dust':
        p.dust(this.x - this.facing * 10, this.z, 2, this.facing);
        break;
      case 'hammer_land':
        p.debris(this.x + this.facing * 16, this.z, 10);
        p.dust(this.x, this.z, 12);
        p.ring(this.x + this.facing * 14, this.z, 10, 80, '#e6e2f0', 18);
        world.camera.shake(7, 0, 1, 12);
        a.playHitHeavy();
        a.playDebris();
        break;
      case 'spin':
        a.playWhiff();
        a.playDash();
        p.dust(this.x, this.z, 6);
        p.ring(this.x, this.z, 20, 80, 'rgba(236,232,240,0.7)', 14);
        break;
      case 'slam':
        a.playSpecial();
        a.playDebris();
        a.playHitHeavy();
        world.camera.shake(12, 0, 1, 22);
        p.debris(this.x - 20, this.z, 16, -1);
        p.debris(this.x + 20, this.z, 16, 1);
        p.dust(this.x - 40, this.z, 10, 1);
        p.dust(this.x + 40, this.z, 10, -1);
        p.ring(this.x, this.z, 20, 150, '#ece8f0', 26);
        p.ring(this.x, this.z, 10, 110, '#ffffff', 20);
        p.spawn('flash', this.x + this.facing * 20, 10, this.z + 1, 0, 0, 0, 14, 20, '#ffffff', { size2: 110 });
        break;
      case 'shuriken':
        this.throwShuriken(world);
        break;
      case 'pulse_warn':
        a.playCharge();
        for (let i = 0; i < 4; i++) p.arc(this.x, this.y + 50, this.z + 1, 30, COLORS.hazard);
        p.text(this.x, this.y + 110 * this.scale, this.z, '!', COLORS.hazard, 22);
        break;
      case 'pulse_arc':
        for (let i = 0; i < 2; i++) p.arc(this.x + (Math.random() - 0.5) * 30, this.y + 40 + Math.random() * 30, this.z + 1, 26, COLORS.cyan);
        break;
      case 'pulse':
        a.playShock();
        world.camera.shake(6, 0, 1, 12);
        p.ring(this.x, this.z, 10, 110, COLORS.cyan, 20);
        p.ring(this.x, this.z, 10, 80, COLORS.hazard, 16);
        p.spawn('flash', this.x, this.y + 45, this.z + 1, 0, 0, 0, 12, 16, COLORS.cyan, { size2: 90 });
        for (let i = 0; i < 10; i++) p.arc(this.x, this.y + 40, this.z + 1, 50 + Math.random() * 30, COLORS.cyan);
        break;
      case 'steam':
        p.smoke(this.x - this.facing * 10, this.y + 60, this.z, 4, 'rgba(180,180,190,1)');
        a.playCharge();
        break;
      case 'flip':
        a.playJump();
        p.dust(this.x, this.z, 5);
        break;
      // ---- White Lie
      case 'belly':
        a.playHitHeavy();
        world.camera.shake(5, this.facing, 0, 8);
        p.ring(this.x + this.facing * 20, this.z, 8, 60, '#ffd21f', 14);
        p.dust(this.x, this.z, 6, this.facing);
        break;
      case 'beat_land':
        p.debris(this.x + this.facing * 10, this.z, 12);
        p.dust(this.x, this.z, 14);
        p.ring(this.x, this.z, 10, 95, '#ffd21f', 18);
        p.text(this.x, this.y + 118 * this.scale, this.z, 'BOOM', '#ffd21f', 16);
        world.camera.shake(9, 0, 1, 14);
        a.playHitHeavy();
        a.playDebris();
        break;
      case 'mic_raise':
        a.playCharge();
        p.spawn('flash', this.x + this.facing * 10, this.y + 118 * this.scale, this.z + 1, 0, 0, 0, 12, 10, '#ffd21f', { size2: 40 });
        for (let i = 0; i < 6; i++) p.spawn('spark', this.x + (Math.random() - 0.5) * 30, this.y + 100 * this.scale, this.z + 1, (Math.random() - 0.5) * 2, 2 + Math.random() * 3, 0, 24, 3, '#ffe38a', { gravity: 0.05 });
        break;
      case 'mic_drop':
        a.playSpecial();
        a.playDebris();
        a.playHitHeavy();
        world.camera.shake(13, 0, 1, 24);
        p.debris(this.x - 24, this.z, 14, -1);
        p.debris(this.x + 24, this.z, 14, 1);
        p.dust(this.x - 40, this.z, 10, 1);
        p.dust(this.x + 40, this.z, 10, -1);
        p.ring(this.x, this.z, 20, 150, '#ffd21f', 26);
        p.ring(this.x, this.z, 10, 110, '#ffffff', 20);
        p.spawn('flash', this.x + this.facing * 16, 10, this.z + 1, 0, 0, 0, 14, 20, '#ffe38a', { size2: 120 });
        p.text(this.x, this.y + 124 * this.scale, this.z, 'MIC DROP', '#ffd21f', 18);
        break;
      case 'mic_echo':
        a.playShock();
        world.camera.shake(6, 0, 1, 12);
        p.ring(this.x, this.z, 60, 200, 'rgba(255,210,31,0.7)', 22);
        p.ring(this.x, this.z, 30, 160, 'rgba(255,255,255,0.5)', 18);
        break;
      case 'grab_reach':
        a.playWhiff();
        a.playVoiceGrunt(this.def.voice, 'hah');
        break;
      case 'grab_lift':
        a.playVoiceGrunt(this.def.voice, 'take');
        a.playCharge();
        p.dust(this.x, this.z, 8, this.facing);
        p.spawn('flash', this.x + this.facing * 20, this.y + 100 * this.scale, this.z + 1, 0, 0, 0, 10, 8, '#ffd21f', { size2: 36 });
        break;
      case 'grab_slam':
        a.playSpecial();
        a.playDebris();
        a.playHitHeavy();
        world.camera.shake(14, this.facing, 1, 24);
        p.debris(this.x + this.facing * 40, this.z, 18, this.facing);
        p.dust(this.x + this.facing * 30, this.z, 14, this.facing);
        p.dust(this.x + this.facing * 60, this.z, 8, this.facing);
        p.ring(this.x + this.facing * 44, this.z, 16, 130, '#ffd21f', 22);
        p.ring(this.x + this.facing * 44, this.z, 8, 90, '#ffffff', 16);
        p.spawn('flash', this.x + this.facing * 44, 10, this.z + 1, 0, 0, 0, 12, 18, '#fff3c8', { size2: 100 });
        p.text(this.x + this.facing * 30, this.y + 128 * this.scale, this.z, 'TAKEOVER', '#ffd21f', 18);
        break;
      case 'note':
        a.playFiddlePluck(12 + Math.floor(Math.random() * 3) * 7);
        this.throwNote(world);
        break;
      // ---- Fiddle Jay
      case 'bow_whip':
        a.playSlash();
        for (let i = 0; i < 4; i++) p.spawn('spark', hx + (Math.random() - 0.5) * 20, hy + (Math.random() - 0.5) * 20, this.z + 1, this.facing * (1 + Math.random() * 2), 1 + Math.random() * 2, 0, 16, 2.5, '#ffb13b', { gravity: 0.08 });
        break;
      case 'rosin':
        a.playMagic();
        p.kinetic(hx + this.facing * 10, hy, this.z + 1, this.facing, '#ffb13b', 46);
        break;
      case 'riff_start':
        this.riffIndex = 0;
        a.playTaunt(this.def.voice, 1);
        a.playMagic();
        p.ring(this.x, this.z, 10, 60, '#ffb13b', 18);
        break;
      case 'riff': {
        a.playFiddleRiff(this.riffIndex++);
        a.playShock();
        world.camera.shake(4, 0, 1, 8);
        p.ring(this.x, this.z, 16, 120, 'rgba(255,177,59,0.85)', 18);
        p.ring(this.x, this.z, 10, 90, 'rgba(255,255,255,0.5)', 14);
        const notes = ['♪', '♫', '♩', '♬'];
        for (let i = 0; i < 5; i++) {
          const ang = Math.random() * Math.PI * 2;
          p.text(this.x + Math.cos(ang) * (30 + Math.random() * 40), this.y + 50 + Math.random() * 60, this.z + Math.sin(ang) * 14, notes[i % notes.length], i % 2 ? '#ffb13b' : '#fff3c8', 14 + Math.random() * 8);
        }
        break;
      }
      case 'sonic_boom':
        a.playFiddleRiff(3);
        a.playSpecial();
        a.playShock();
        world.camera.shake(11, 0, 1, 20);
        p.ring(this.x, this.z, 20, 160, '#ffb13b', 26);
        p.ring(this.x, this.z, 10, 120, '#ffffff', 20);
        p.spawn('flash', this.x, this.y + 50, this.z + 1, 0, 0, 0, 14, 20, '#ffd27a', { size2: 120 });
        for (let i = 0; i < 12; i++) {
          const ang = Math.random() * Math.PI * 2;
          p.text(this.x + Math.cos(ang) * 60, this.y + 30 + Math.random() * 80, this.z + Math.sin(ang) * 18, i % 2 ? '♪' : '♫', '#ffb13b', 16 + Math.random() * 10);
        }
        break;
      default:
        break;
    }
  }

  private throwShuriken(world: World): void {
    const target = nearestOpponent(this, world);
    const elite = this.variant === 'elite' || this.variant === 'boss';
    const baseAngle = target ? Math.atan2((target.z - this.z) / 0.6, target.x - this.x) : this.facing > 0 ? 0 : Math.PI;
    const spread = elite ? [-0.28, 0, 0.28] : [0];
    const color = elite ? '#ff4d6d' : COLORS.cyan;
    for (const s of spread) {
      const pr = new Projectile(this, target, this.x + this.facing * 24, this.y + 58 * this.scale, this.z, baseAngle + s, elite ? 6.2 : 5.4, color);
      if (elite) pr.hitbox.damage = 5;
      world.spawnProjectile(pr);
    }
    world.audio.playShuriken();
  }

  /** Fiddle Jay's travelling note: slow, non-homing, bobs along the string line and staggers on hit. */
  private throwNote(world: World): void {
    const angle = this.facing > 0 ? 0 : Math.PI;
    const note = new Projectile(this, null, this.x + this.facing * 30, this.y + 62 * this.scale, this.z, angle, 4.4, '#ffb13b');
    note.kind = 'note';
    note.homingFrames = 0;
    note.life = 110;
    note.hitbox.damage = 6;
    note.hitbox.knockbackX = 3;
    note.hitbox.hitstun = 18;
    note.hitbox.hitstop = 4;
    note.hitbox.spark = 'arcane';
    note.hitbox.sfx = 'magic';
    note.hitbox.width = 22;
    note.hitbox.height = 22;
    world.spawnProjectile(note);
    world.audio.playMagic();
    world.particles.text(this.x + this.facing * 24, this.y + 96 * this.scale, this.z, '♪', '#fff3c8', 14);
  }

  // ------------------------------------------------------------------ render

  draw(ctx: CanvasRenderingContext2D, view: RenderView): void {
    view.sprites.drawFighter(ctx, this, view);
  }

  drawShadow(ctx: CanvasRenderingContext2D, view: RenderView): void {
    if (this.hidden && this.state !== FState.ATTACK) return;
    const sx = this.x - view.camX;
    const sy = this.z - view.camY;
    const k = Math.max(0.35, 1 - this.y / 220);
    const w = (this.state === FState.KNOCKDOWN || this.state === FState.DEAD ? 38 : 24) * this.scale * k;
    ctx.fillStyle = `rgba(0,0,0,${0.38 * k})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, w, w * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
