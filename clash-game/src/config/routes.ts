import type { EnemyKind } from '../entities/Enemy';
import type { CharId } from '../physics/Types';

export interface RouteDef {
  /** Bot line that fills the waves. */
  foes: EnemyKind;
  /** Bot line sprinkled in as the "mix" slots (the other faction's elites). */
  mix: EnemyKind;
  foesLabel: string;
  boss: CharId;
  label: string;
  /** Name of the mid-boss unit the PA system barks about. */
  midBoss: string;
  story: string;
}

/** Who each protagonist fights through, and who waits at the Sanctuary gate. */
export const ROUTES: Record<CharId, RouteDef> = {
  slade: {
    foes: 'clownbot',
    mix: 'clownbot',
    foesLabel: 'CLOWNBOTS',
    boss: 'freckles',
    label: 'SLADE ROUTE · CLOWNBOT UPRISING',
    midBoss: 'FOREMAN MK-II',
    story: 'The Iron Syndicate cloned Freckles into an army of spike-fisted Clownbots. Cut through them and reach the real one.',
  },
  freckles: {
    foes: 'ninjabot',
    mix: 'ninjabot',
    foesLabel: 'NINJABOTS',
    boss: 'slade',
    label: 'FRECKLES ROUTE · NINJABOT PURGE',
    midBoss: 'SHOGUN-X',
    story: "Slade's stolen ninpo powers a swarm of shuriken-throwing Ninjabots. Smash the factory line and drag him out of the Sanctuary.",
  },
  whitelie: {
    foes: 'clownbot',
    mix: 'ninjabot',
    foesLabel: 'CLOWNBOTS + NINJABOT ENFORCERS',
    boss: 'fiddlejay',
    label: 'WHITE LIE ROUTE · HOSTILE TAKEOVER',
    midBoss: 'FOREMAN MK-II',
    story: 'The Syndicate repossessed every club on the Platinum label and set bots on the doors. Collect what is yours, then collect the man who sold them the beat.',
  },
  fiddlejay: {
    foes: 'ninjabot',
    mix: 'clownbot',
    foesLabel: 'NINJABOTS + CLOWNBOT HEAVIES',
    boss: 'whitelie',
    label: 'FIDDLE JAY ROUTE · THE DEVIL\'S CONTRACT',
    midBoss: 'SHOGUN-X',
    story: 'Every bot in the city moves to a rhythm sampled from your fiddle. Follow the signal to the label that pressed it and the mogul who signed it.',
  },
  batman: {
    foes: 'clownbot',
    mix: 'ninjabot',
    foesLabel: 'CLOWNBOTS + NINJABOT ENFORCERS',
    boss: 'slade',
    label: 'BATMAN ROUTE · NO RELATION',
    midBoss: 'FOREMAN MK-II',
    story: 'The Syndicate trademarked the night and sent a cease-and-desist with an army of Clownbots attached. Prove the city needs a bat. Any bat. Legally distinct.',
  },
  righteous: {
    foes: 'ninjabot',
    mix: 'clownbot',
    foesLabel: 'NINJABOTS + CLOWNBOT HEAVIES',
    boss: 'whitelie',
    label: 'RIGHTEOUS ROUTE · THE TITHE',
    midBoss: 'SHOGUN-X',
    story: 'The Syndicate bought the parish, boarded the doors and put Clownbots in the pews. Collect the tithe they stole, then collect the mogul who signed the deed.',
  },
};
