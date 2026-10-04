import type { CharId, CharacterDef, StoryCharId } from '../physics/Types';
import { BATMAN } from './Batman';
import { FIDDLE_JAY } from './FiddleJay';
import { FRECKLES } from './Freckles';
import { RIGHTEOUS } from './Righteous';
import { SLADE } from './Slade';
import { WHITE_LIE } from './WhiteLie';

export const CHARACTERS: Record<CharId, CharacterDef> = {
  slade: SLADE,
  freckles: FRECKLES,
  whitelie: WHITE_LIE,
  fiddlejay: FIDDLE_JAY,
  batman: BATMAN,
  righteous: RIGHTEOUS,
};

export const STORY_ROSTER: StoryCharId[] = ['slade', 'freckles', 'whitelie', 'fiddlejay', 'batman', 'righteous'];
export const VS_ROSTER: CharId[] = ['slade', 'freckles', 'whitelie', 'fiddlejay', 'batman', 'righteous'];

export const charDef = (id: CharId): CharacterDef => CHARACTERS[id];

export const isStoryChar = (id: CharId): id is StoryCharId => id in CHARACTERS;
