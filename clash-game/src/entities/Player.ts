import { STORY_LIVES } from '../config/constants';
import type { InputManager } from '../core/InputManager';
import { emptyInput, type CharacterDef, type Controller, type InputFrame, type Team, type Variant } from '../physics/Types';
import { Fighter } from './Fighter';

/** Reads one InputManager slot (keyboard bindings + matching gamepad index). */
export class HumanController implements Controller {
  enabled = true;
  private readonly idle = emptyInput();

  constructor(
    private readonly input: InputManager,
    readonly slot: number,
  ) {}

  getInput(): InputFrame {
    return this.enabled ? this.input.getFrame(this.slot) : this.idle;
  }
}

export class Player extends Fighter {
  readonly slot: number;
  readonly human: HumanController;
  lives = STORY_LIVES;
  score = 0;
  deadTimer = 0;

  constructor(def: CharacterDef, input: InputManager, slot: number, team: Team, variant: Variant = 'normal') {
    const human = new HumanController(input, slot);
    super(def, { team, controller: human, variant });
    this.slot = slot;
    this.human = human;
  }

  addScore(points: number): void {
    this.score += Math.round(points);
  }
}
