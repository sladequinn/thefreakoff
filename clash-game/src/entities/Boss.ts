import { BossAI } from '../ai/BossAI';
import { FState, type CharId, type CharacterDef, type Team, type Variant, type World } from '../physics/Types';
import { Fighter } from './Fighter';

export interface BossOptions {
  team: Team;
  hpMult: number;
  versus: boolean;
  difficulty: number;
  variant?: Variant;
  /** Show the story-boss ember aura even in versus rules (arcade finale). */
  aura?: boolean;
}

/** The unselected protagonist driven by the master-level AI (story finale or Versus CPU). */
export class Boss extends Fighter {
  readonly ai: BossAI;
  readonly versus: boolean;
  private readonly aura: boolean;

  constructor(def: CharacterDef, opts: BossOptions) {
    const ai = new BossAI(def.id as CharId, { versus: opts.versus, difficulty: opts.difficulty });
    super(def, {
      team: opts.team,
      controller: ai,
      variant: opts.variant ?? (opts.versus ? 'normal' : 'boss'),
      hpMult: opts.hpMult,
      name: def.name,
    });
    this.ai = ai;
    this.versus = opts.versus;
    this.aura = opts.aura ?? !opts.versus;
    // Only hard versus CPUs get the just-guard; story bosses and easier settings block normally.
    this.canParry = opts.versus && opts.difficulty >= 1;
    this.facing = -1;
  }

  update(world: World): void {
    super.update(world);
    if (!this.aura || this.hidden || this.state === FState.DEAD) return;
    const p = world.particles;
    if (this.animTime % 5 === 0) {
      const color = this.def.archetype === 'ninja' ? '#9d5cff' : this.def.archetype === 'kingpin' ? '#b066ff' : this.def.archetype === 'fiddler' ? '#ff4d6d' : '#ff7a2a';
      p.spawn('ember', this.x + (Math.random() - 0.5) * 36, this.y + Math.random() * 90, this.z - 1, 0, 0.8 + Math.random(), 0, 30, 2.4, color, { drag: 0.98 });
    }
    if (this.hyperArmor > 0 && this.animTime % 3 === 0) {
      p.spawn('ember', this.x + (Math.random() - 0.5) * 40, this.y + Math.random() * 100, this.z + 1, 0, 1.2, 0, 20, 3, '#ffc857');
    }
  }
}
