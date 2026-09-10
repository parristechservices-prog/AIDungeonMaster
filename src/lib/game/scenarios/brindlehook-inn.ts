import { buildBalancedEncounter } from '@/lib/engine/balancer';
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
      allowedNpcs: ['npc-mira'],
      allowedMonsters: [],
      allowedExits: ['old boathouse'],
      forbidden: ['Do not reveal the courier satchel or start the ambush here.'],
      successConditions: ['Learn that the courier went to the boathouse.'],
    },
    exploration: {
      goal: 'Track the courier to the old boathouse and uncover the ambush.',
      starter:
        'The village sprawls before you. The tide is low at the quay, and muddy bootprints run from the docks toward a weather-beaten boathouse.',
      choices: [
        'Scout the boathouse approach',
        'Search for hidden tracks',
        'Ask villagers if they saw the courier',
      ],
      guidance: 'Shore scene: perception or investigation to find tracks. DC 12.',
      allowedNpcs: ['npc-elias', 'npc-silas', 'npc-kael'],
      allowedMonsters: [],
      allowedExits: ['boathouse interior'],
      forbidden: ['Do not award the courier satchel before the ambush.'],
      successConditions: ['Find evidence leading into the boathouse.'],
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
      allowedNpcs: [],
      allowedMonsters: ['goblin'],
      allowedExits: ['ending'],
      forbidden: ['Do not end combat while a ruffian remains active.'],
      successConditions: ['Defeat all active monsters.'],
    },
  },
  endingMessage: 'Your tale concludes at Brindlehook Village.',
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
    {
      id: 'npc-elias',
      name: 'Elias',
      description: 'A burly blacksmith with soot on his face.',
      disposition: 'friendly',
      knowledge: [
        'Saw strange lights out by the abandoned house.',
        'Thinks the smugglers are using the tunnels again.',
      ],
    },
    {
      id: 'npc-silas',
      name: 'Old Silas',
      description: 'A weathered farmer working the fields south of town.',
      disposition: 'neutral',
      knowledge: [
        'The courier ran past here clutching a satchel like his life depended on it.',
      ],
    },
    {
      id: 'npc-kael',
      name: 'Brother Kael',
      description: 'A quiet priest tending the graveyard.',
      disposition: 'friendly',
      knowledge: [
        'Hears unholy noises from beneath the town.',
      ],
    },
  ],
  buildMonsters: () => buildBalancedEncounter(3, 1, 'easy', ['goblin']),
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
