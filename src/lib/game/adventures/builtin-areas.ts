import type { AreaGraph } from '@/lib/engine/spatial';

export const brindlehookStartAreaId = 'inn_common_room';
export const brindlehookAreas: AreaGraph = {
  areas: {
    inn_common_room: {
      id: 'inn_common_room',
      name: 'Inn Common Room',
      description: 'The lively tavern room where Mira tends the bar and patrons gather from the rain.',
      tags: ['building', 'social'],
      x: 0,
      y: 0,
      connections: [
        { to: 'rainy_quay', label: 'the front door', difficulty: 'normal', distanceFt: 30 },
      ],
    },
    rainy_quay: {
      id: 'rainy_quay',
      name: 'Rainy Quay',
      description: 'A muddy dock approach littered with fresh wheel ruts leading into the gloom.',
      tags: ['exterior', 'waterfront', 'mud'],
      x: 0,
      y: -1,
      connections: [
        { to: 'inn_common_room', label: 'back inside the inn', difficulty: 'normal', distanceFt: 30 },
        { to: 'old_boathouse', label: 'follow the tracks', difficulty: 'normal', distanceFt: 60 },
      ],
    },
    old_boathouse: {
      id: 'old_boathouse',
      name: 'Old Boathouse',
      description: 'A weather-beaten structure at the end of the quay where the ambush awaits.',
      tags: ['building', 'hazard'],
      x: 0,
      y: -2,
      connections: [
        { to: 'rainy_quay', label: 'back toward the inn', difficulty: 'normal', distanceFt: 60 },
      ],
    },
  },
};

export const cryptOfWhispersStartAreaId = 'ruined_chapel';
export const cryptOfWhispersAreas: AreaGraph = {
  areas: {
    ruined_chapel: {
      id: 'ruined_chapel',
      name: 'Ruined Chapel',
      description: 'A crumbling holy place lit by wavering candlelight where Sister Elara prays.',
      tags: ['building', 'holy', 'ruin'],
      x: 0,
      y: 0,
      connections: [
        { to: 'barrow_stairs', label: 'the dark steps down', difficulty: 'normal', distanceFt: 40 },
      ],
    },
    barrow_stairs: {
      id: 'barrow_stairs',
      name: 'Barrow Stairs',
      description: 'Cold stone steps leading beneath the earth. The walls bear the scraped remains of old wards.',
      tags: ['stairs', 'underground'],
      x: 0,
      y: -1,
      connections: [
        { to: 'ruined_chapel', label: 'up to the chapel', difficulty: 'slow', distanceFt: 40 },
        { to: 'desecrated_antechamber', label: 'deeper into the barrow', difficulty: 'normal', distanceFt: 30 },
      ],
    },
    desecrated_antechamber: {
      id: 'desecrated_antechamber',
      name: 'Desecrated Antechamber',
      description: 'An underground room littered with the shattered remains of a ward stone.',
      tags: ['underground', 'ruin'],
      x: 0,
      y: -2,
      connections: [
        { to: 'barrow_stairs', label: 'back to the stairs', difficulty: 'normal', distanceFt: 30 },
        { to: 'inner_crypt', label: 'the main crypt doors', difficulty: 'normal', distanceFt: 40 },
      ],
    },
    inner_crypt: {
      id: 'inner_crypt',
      name: 'Inner Crypt',
      description: 'A pillared crypt harboring a sarcophagus and restless skeletal guardians.',
      tags: ['underground', 'tomb', 'hazard'],
      x: 0,
      y: -3,
      connections: [
        { to: 'desecrated_antechamber', label: 'retreat to the antechamber', difficulty: 'normal', distanceFt: 40 },
      ],
    },
  },
};

export const smugglersCoveStartAreaId = 'foggy_pier';
export const smugglersCoveAreas: AreaGraph = {
  areas: {
    foggy_pier: {
      id: 'foggy_pier',
      name: 'Foggy Pier',
      description: 'A fog-swallowed dock where Dockmaster Holt oversees cargo.',
      tags: ['exterior', 'waterfront', 'fog'],
      x: 0,
      y: 0,
      connections: [
        { to: 'east_warehouse_exterior', label: 'toward the warehouses', difficulty: 'normal', distanceFt: 50 },
      ],
    },
    east_warehouse_exterior: {
      id: 'east_warehouse_exterior',
      name: 'East Warehouse Exterior',
      description: 'Salt-stained warehouses. A stack of false crates hides something behind it.',
      tags: ['exterior', 'building'],
      x: 1,
      y: 0,
      connections: [
        { to: 'foggy_pier', label: 'back to the pier', difficulty: 'normal', distanceFt: 50 },
        { to: 'smuggler_tunnel', label: 'through the false crates', difficulty: 'normal', distanceFt: 20 },
      ],
    },
    smuggler_tunnel: {
      id: 'smuggler_tunnel',
      name: 'Smuggler Tunnel',
      description: 'A damp, reeking tunnel where smugglers lie in wait to ambush intruders.',
      tags: ['underground', 'hazard'],
      x: 1,
      y: -1,
      connections: [
        { to: 'east_warehouse_exterior', label: 'retreat outside', difficulty: 'normal', distanceFt: 20 },
      ],
    },
  },
};

export const tutorialStartAreaId = 'training_courtyard';
export const tutorialAreas: AreaGraph = {
  areas: {
    training_courtyard: {
      id: 'training_courtyard',
      name: 'Training Courtyard',
      description: 'A sunlit yard where Master Kaelen teaches the basics of interaction.',
      tags: ['exterior', 'safe'],
      x: 0,
      y: 0,
      connections: [
        { to: 'dusty_basement', label: 'the basement stairs', difficulty: 'normal', distanceFt: 40 },
      ],
    },
    dusty_basement: {
      id: 'dusty_basement',
      name: 'Dusty Basement',
      description: 'A quiet, dusty room designed to test your perception and investigation.',
      tags: ['interior', 'safe'],
      x: 0,
      y: -1,
      connections: [
        { to: 'training_courtyard', label: 'up to the courtyard', difficulty: 'normal', distanceFt: 40 },
        { to: 'hidden_passage', label: 'the loose brick door', difficulty: 'normal', distanceFt: 20 },
      ],
    },
    hidden_passage: {
      id: 'hidden_passage',
      name: 'Hidden Passage',
      description: 'A secret corridor revealed by your sharp eyes.',
      tags: ['interior', 'safe'],
      x: 1,
      y: -1,
      connections: [
        { to: 'dusty_basement', label: 'back to the basement', difficulty: 'normal', distanceFt: 20 },
        { to: 'training_arena', label: 'into the arena', difficulty: 'normal', distanceFt: 40 },
      ],
    },
    training_arena: {
      id: 'training_arena',
      name: 'Training Arena',
      description: 'A combat practice room housing a wooden training construct.',
      tags: ['interior', 'arena'],
      x: 1,
      y: 0,
      connections: [
        { to: 'hidden_passage', label: 'back to the passage', difficulty: 'normal', distanceFt: 40 },
      ],
    },
  },
};
