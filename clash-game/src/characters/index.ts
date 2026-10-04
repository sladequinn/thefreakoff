import type { CharId, CharacterDef, StoryCharId } from '../physics/Types';
import { FIDDLE_JAY } from './FiddleJay';
import { FRECKLES } from './Freckles';
import { SLADE } from './Slade';
import { WHITE_LIE } from './WhiteLie';

export const CHARACTERS: Record<CharId, CharacterDef> = {
  slade: SLADE,
  freckles: FRECKLES,
  whitelie: WHITE_LIE,
  fiddlejay: FIDDLE_JAY,
};

export const STORY_ROSTER: StoryCharId[] = ['slade', 'freckles', 'whitelie', 'fiddlejay'];
export const VS_ROSTER: CharId[] = ['slade', 'freckles', 'whitelie', 'fiddlejay'];

export const charDef = (id: CharId): CharacterDef => CHARACTERS[id];

export const isStoryChar = (id: CharId): id is StoryCharId => id in CHARACTERS;
