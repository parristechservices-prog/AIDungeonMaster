import type { Scenario } from './types';

export const brindlehookInn: Scenario = {
  id: 'brindlehook-inn',
  title: 'The Last Lantern at Brindlehook Inn',
  tagline: 'A missing courier, a rainy dock, and an ambush at the boathouse.',
  estimatedMinutes: 30,
  tone: 'coastal mystery',
  recommendedCharacters: ['fighter', 'rogue', 'wizard'],
  scenes: {
    social: {
      goal: 'Learn where the missing courier went.',
      starter:
        'Rain taps the windows of Brindlehook Inn. Mira the innkeeper dries a mug and watches you carefully.',
      choices: [
        'Ask Mira about the courier',
        'Offer coin for information',
        'Study the inn patrons',
      ],
      guidance:
        'Inn scene: player should learn the courier went to the boathouse. Persuasion or insight DC 12.',
    },
    exploration: {
      goal: 'Track the courier to the old boathouse and uncover the ambush.',
      starter:
        'The tide is low. Muddy bootprints run from the quay toward a weather-beaten boathouse.',
      choices: [
        'Scout the boathouse approach',
        'Search for hidden tracks',
        'Call out to lure whoever is hiding',
      ],
      guidance: 'Shore scene: perception or investigation to find tracks. DC 12.',
    },
    combat: {
      goal: 'Defeat the ruffians and recover the courier satchel.',
      starter:
        'Two ruffians step from behind stacked nets, blades drawn. "Coin or blood," one growls.',
      choices: [
        'Strike the nearest ruffian',
        'Use a class feature',
        'Hold position and look for an opening',
      ],
      guidance: 'Combat: player_attack then monster_turn. Use monster ids from state.',
    },
  },
  endingMessage: 'Your tale concludes at Brindlehook Inn.',
  npcs: [
    {
      id: 'npc-mira',
      name: 'Mira',
      description: 'Sharp-eyed innkeeper of Brindlehook Inn.',
      disposition: 'neutral',
      knowledge: [
        'The courier was last seen heading toward the old boathouse.',
        'Two men in dark cloaks were following him.',
      ],
    },
  ],
  buildMonsters: () => [
    { id: 'bandit-1', name: 'Dockside Ruffian', ac: 12, maxHp: 11, hp: 11, attackBonus: 3, damage: '1d6+1' },
    { id: 'bandit-2', name: 'Lantern Thug', ac: 12, maxHp: 11, hp: 11, attackBonus: 3, damage: '1d6+1' },
  ],
  mock: {
    socialNpcId: 'npc-mira',
    socialNpcName: 'Mira',
    socialSuccess:
      '"Fine," Mira sighs. "He went to the boathouse. Two cloaked figures were on his heels."',
    socialFailure: 'Mira shakes her head. "Buy a drink or move on, stranger."',
    explorationSuccess:
      'Fresh tracks lead straight to the boathouse door — something was dragged.',
    explorationFailure:
      'Rain washed the clearest signs away, but salt and rot linger near the boathouse.',
    socialSkill: 'persuasion',
    explorationSkill: 'perception',
    socialDc: 12,
    explorationDc: 12,
    canonFactOnSocialSuccess:
      'The courier was seen heading to the boathouse with two cloaked figures.',
  },
};
