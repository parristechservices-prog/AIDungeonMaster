import { DMPersona, DMPersonaId } from './types';

export const DM_PERSONAS: Record<DMPersonaId, DMPersona> = {
  balanced: {
    id: 'balanced',
    name: 'The Classic Guide',
    description: 'A fair and theatrical DM who balances rules and story.',
    tone: 'Descriptive, atmospheric, and fair. Focuses on the "theatre of the mind" while maintaining mechanical integrity.',
  },
  gritty: {
    id: 'gritty',
    name: 'The Gritty Realist',
    description: 'Dark, dangerous, and unforgiving. Actions have heavy consequences.',
    tone: 'Somber, visceral, and lethal. Emphasizes the mud, blood, and hard choices of survival.',
  },
  epic: {
    id: 'epic',
    name: 'The Epic Narrator',
    description: 'High fantasy, legendary deeds, and cinematic descriptions.',
    tone: 'Grand, heroic, and inspiring. Uses powerful language and focuses on the legendary scale of the adventure.',
  },
  whimsical: {
    id: 'whimsical',
    name: 'The Whimsical Trickster',
    description: 'Lighthearted, funny, and unpredictable.',
    tone: 'Playful, witty, and colorful. Focuses on the wonder, comedy, and weirdness of the world.',
  },
};
