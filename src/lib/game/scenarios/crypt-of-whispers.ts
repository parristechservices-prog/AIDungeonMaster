import { buildBalancedEncounter } from '@/lib/engine/balancer';
import type { Scenario } from './types';

export const cryptOfWhispers: Scenario = {
  id: 'crypt-of-whispers',
  title: 'Crypt of Whispers',
  tagline: 'Holy symbols fade in a barrow where the dead do not rest.',
  estimatedMinutes: 30,
  tone: 'gothic horror',
  recommendedCharacters: ['cleric', 'wizard', 'fighter'],
  scenes: {
    social: {
      goal: 'Convince Sister Elara to reveal what stirred beneath the chapel.',
      starter:
        'Candlelight wavers in the ruined chapel. Sister Elara clutches a tarnished holy symbol, lips moving in silent prayer.',
      choices: [
        'Ask Elara about the whispers below',
        'Examine the cracked crypt seal',
        'Offer to bless the chapel',
      ],
      guidance:
        'Chapel: religion or insight to learn the barrow door was opened three nights ago. DC 13.',
    },
    exploration: {
      goal: 'Navigate the barrow and find what broke the ward.',
      starter:
        'Cold air rolls up from stone steps. Chalk wards on the walls have been scraped away.',
      choices: [
        'Search for the broken ward stone',
        'Listen for movement in the dark',
        'Proceed deeper with weapon ready',
      ],
      guidance: 'Barrow: investigation or religion DC 13 to locate the desecrated altar.',
    },
    combat: {
      goal: 'Destroy the skeletal guardians and reseal the crypt.',
      starter:
        'Bones clatter together as two armored skeletons rise, empty eyes burning with pale light.',
      choices: [
        'Strike the nearest skeleton',
        'Use Channel Divinity or a spell',
        'Fall back toward the chapel steps',
      ],
      guidance: 'Undead combat: skeleton ids. Cleric features especially appropriate.',
    },
  },
  endingMessage: 'The whispers fall silent. The crypt is sealed once more.',
  npcs: [
    {
      id: 'npc-elara',
      name: 'Sister Elara',
      description: 'Weary acolyte tending a chapel above an ancient barrow.',
      disposition: 'neutral',
      knowledge: [
        'Someone opened the barrow door three nights ago.',
        'The old ward stone was shattered in the inner chamber.',
      ],
    },
  ],
  buildMonsters: () => buildBalancedEncounter(3, 1, 'medium', ['skeleton']),
  mock: {
    socialNpcId: 'npc-elara',
    socialNpcName: 'Sister Elara',
    socialSuccess:
      'Elara whispers, "The barrow was opened three nights ago. The ward stone lies shattered below."',
    socialFailure: 'Elara will not meet your eyes. "I have prayed enough for one night."',
    explorationSuccess:
      'You find the shattered ward stone — runes gouged out by a desperate hand.',
    explorationFailure:
      'The dark hides details, but desecrated chalk and claw marks point deeper inward.',
    socialSkill: 'insight',
    explorationSkill: 'investigation',
    socialDc: 13,
    explorationDc: 13,
    canonFactOnSocialSuccess: 'The barrow ward was broken three nights ago by unknown hands.',
  },
};
