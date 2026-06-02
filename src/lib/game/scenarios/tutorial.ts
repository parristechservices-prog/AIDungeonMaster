import { buildBalancedEncounter } from '@/lib/engine/balancer';
import type { Scenario } from './types';

export const tutorial: Scenario = {
  id: 'tutorial',
  title: 'Session 0: The Training Grounds',
  tagline: 'Learn the ropes of adventuring in a safe environment.',
  estimatedMinutes: 15,
  tone: 'educational and encouraging',
  recommendedCharacters: ['fighter', 'rogue', 'wizard', 'cleric'],
  scenes: {
    social: {
      goal: 'Practice talking to NPCs and learn about skill checks.',
      starter:
        'You stand in a sunlit courtyard. Master Kaelen, a retired knight, waits for you. "Ready to begin your training? Try asking me about the basics or greeting me."',
      choices: [
        'Greet Master Kaelen',
        'Ask about the basics of adventuring',
        'Inquire about the next trial',
      ],
      guidance:
        'Tutorial Social: Encourage the player to use "I say..." or "I ask...". Mention that high Persuasion or Insight helps here. DC 10.',
    },
    exploration: {
      goal: 'Learn how to use Perception and Investigation to find hidden paths.',
      starter:
        'Master Kaelen leads you to a dusty basement. "The path ahead is hidden. You must use your eyes and your mind. Try searching the walls or listening for echoes."',
      choices: [
        'Search the stone walls for a hidden switch',
        'Listen at the door for movement',
        'Check the floor for pressure plates',
      ],
      guidance: 'Tutorial Exploration: Explain that skills like Perception or Investigation are used to find hidden things. DC 10.',
    },
    combat: {
      goal: 'Experience your first combat encounter against a practice dummy.',
      starter:
        'A wooden training construct whirs to life. "Defend yourself!" Kaelen calls. "Strike it with your weapon or use a feature."',
      choices: [
        'Strike the training dummy',
        'Use a class feature like Second Wind',
        'Attempt to dodge the dummy’s swing',
      ],
      guidance: 'Tutorial Combat: Explain initiative and attack rolls. The training dummy has low AC (10).',
    },
  },
  endingMessage: 'Master Kaelen nods. "You are ready. Go forth and make your own legend."',
  npcs: [
    {
      id: 'npc-kaelen',
      name: 'Master Kaelen',
      description: 'A wise and patient mentor who teaches the fundamentals of adventuring.',
      disposition: 'friendly',
      knowledge: [
        'Skill checks are made by rolling a d20 and adding your modifier.',
        'Combat is turn-based. You roll for initiative to see who goes first.',
        'You can use features like Second Wind to recover HP during a fight.',
      ],
    },
  ],
  buildMonsters: () => [
    { id: 'dummy-1', name: 'Training Construct', ac: 10, maxHp: 15, hp: 15, attackBonus: 2, damage: '1d4' },
  ],
  mock: {
    socialNpcId: 'npc-kaelen',
    socialNpcName: 'Master Kaelen',
    socialSuccess:
      'Kaelen smiles. "Good. Communication is key. Now, let’s see how you handle a puzzle."',
    socialFailure: 'Kaelen encourages you. "Don’t be shy! Try again, focus on what you want to achieve."',
    explorationSuccess:
      'You find a loose brick — a hidden passage clicks open! "Excellent eye," Kaelen remarks.',
    explorationFailure:
      'It’s tricky, but keep looking. Sometimes the smallest detail is the most important.',
    socialSkill: 'persuasion',
    explorationSkill: 'perception',
    socialDc: 10,
    explorationDc: 10,
    canonFactOnSocialSuccess: 'Master Kaelen is satisfied with your social skills.',
  },
};
