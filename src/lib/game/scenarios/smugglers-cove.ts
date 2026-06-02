import { buildBalancedEncounter } from '@/lib/engine/balancer';
import type { Scenario } from './types';

export const smugglersCove: Scenario = {
  id: 'smugglers-cove',
  title: "Smuggler's Cove",
  tagline: 'Lantern codes, hidden cargo, and knives in the fog.',
  estimatedMinutes: 30,
  tone: 'coastal intrigue',
  recommendedCharacters: ['rogue', 'fighter', 'wizard'],
  scenes: {
    social: {
      goal: 'Learn the lantern code from the dockmaster before the midnight exchange.',
      starter:
        'Fog swallows the cove. Dockmaster Holt counts crates without looking up, a lantern hooked on his belt.',
      choices: [
        'Ask Holt about the lantern signals',
        'Bribe Holt for the exchange time',
        'Watch the dock workers from the shadows',
      ],
      guidance:
        'Docks: deception or persuasion to learn two-flash means "cargo ready". DC 12.',
    },
    exploration: {
      goal: 'Find the hidden smuggler tunnel behind the warehouse.',
      starter:
        'Salt-stained warehouses line the pier. Fresh wheel ruts vanish behind a false crate stack.',
      choices: [
        'Search for a hidden latch',
        'Follow the wheel ruts',
        'Pick the warehouse side door',
      ],
      guidance: 'Warehouse: investigation or stealth DC 12 to find the tunnel entrance.',
    },
    combat: {
      goal: 'Survive the smugglers’ ambush and seize the contraband ledger.',
      starter:
        'A crate topples — two smugglers burst from the tunnel, curved blades flashing in the fog.',
      choices: [
        'Attack the lead smuggler',
        'Dive for cover',
        'Threaten them with arrest',
      ],
      guidance: 'Smuggler fight: use smuggler monster ids.',
    },
  },
  endingMessage: 'The cove goes quiet. The ledger is yours — for now.',
  npcs: [
    {
      id: 'npc-holt',
      name: 'Dockmaster Holt',
      description: 'Gruff dockmaster who runs lantern codes for smugglers after dark.',
      disposition: 'neutral',
      knowledge: [
        'Two lantern flashes mean cargo is ready to move.',
        'The tunnel mouth is behind the east warehouse crates.',
      ],
    },
  ],
  buildMonsters: () => buildBalancedEncounter(3, 1, 'medium', ['orc', 'goblin']),
  mock: {
    socialNpcId: 'npc-holt',
    socialNpcName: 'Holt',
    socialSuccess:
      'Holt grunts, "Two flashes means move the cargo. Tunnel\'s behind the east stacks — don\'t make me regret telling you."',
    socialFailure: 'Holt spits. "I don\'t know you. Come back with coin or don\'t come back."',
    explorationSuccess:
      'A false crate panel swings inward — a damp tunnel reeks of tar and iron.',
    explorationFailure:
      'You lose the trail in fog, but muffled voices echo from behind the east warehouse.',
    socialSkill: 'deception',
    explorationSkill: 'stealth',
    socialDc: 12,
    explorationDc: 12,
    canonFactOnSocialSuccess: 'Two lantern flashes signal ready cargo at Smuggler\'s Cove.',
  },
};
