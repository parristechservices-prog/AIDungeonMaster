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
        { to: 'rainy_quay', label: 'out the north door', difficulty: 'normal', distanceFt: 30 },
        { to: 'inn_kitchen', label: 'swinging kitchen doors', difficulty: 'normal', distanceFt: 20 },
        { to: 'inn_upstairs', label: 'creaky stairs up', difficulty: 'normal', distanceFt: 30 },
        { to: 'west_street', label: 'out the west door', difficulty: 'normal', distanceFt: 30 },
        { to: 'town_square', label: 'out the south door', difficulty: 'normal', distanceFt: 50 },
      ],
    },
    inn_kitchen: {
      id: 'inn_kitchen',
      name: 'Inn Kitchen',
      description: 'A hot kitchen smelling of roasting mutton and spilled ale.',
      tags: ['building', 'interior'],
      x: 1,
      y: 0,
      connections: [
        { to: 'inn_common_room', label: 'back to common room', difficulty: 'normal', distanceFt: 20 },
        { to: 'inn_cellar', label: 'cellar hatch', difficulty: 'normal', distanceFt: 20 },
        { to: 'east_alley', label: 'back exit', difficulty: 'normal', distanceFt: 30 },
      ],
    },
    inn_upstairs: {
      id: 'inn_upstairs',
      name: 'Inn Upstairs',
      description: 'A hallway of modest guest rooms, currently quiet.',
      tags: ['building', 'interior'],
      x: 0,
      y: -0.5,
      connections: [
        { to: 'inn_common_room', label: 'stairs down', difficulty: 'normal', distanceFt: 30 },
      ],
    },
    inn_cellar: {
      id: 'inn_cellar',
      name: 'Inn Cellar',
      description: 'A damp, dark room packed with ale casks and old furniture.',
      tags: ['building', 'interior', 'dark'],
      x: 1,
      y: 0.5,
      connections: [
        { to: 'inn_kitchen', label: 'stairs up', difficulty: 'normal', distanceFt: 20 },
      ],
    },
    west_street: {
      id: 'west_street',
      name: 'West Street',
      description: 'A muddy cobblestone lane lined with closed shops.',
      tags: ['exterior', 'street'],
      x: -1,
      y: 0,
      connections: [
        { to: 'inn_common_room', label: 'inn side door', difficulty: 'normal', distanceFt: 30 },
        { to: 'abandoned_house', label: 'down the street', difficulty: 'normal', distanceFt: 50 },
        { to: 'blacksmith', label: 'southward', difficulty: 'normal', distanceFt: 60 },
      ],
    },
    east_alley: {
      id: 'east_alley',
      name: 'East Alley',
      description: 'A dark, narrow alleyway sneaking behind the inn.',
      tags: ['exterior', 'street', 'dark'],
      x: 1,
      y: -1,
      connections: [
        { to: 'inn_kitchen', label: 'kitchen back door', difficulty: 'normal', distanceFt: 30 },
        { to: 'rainy_quay', label: 'toward the docks', difficulty: 'normal', distanceFt: 50 },
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
        { to: 'inn_common_room', label: 'inn front door', difficulty: 'normal', distanceFt: 30 },
        { to: 'old_boathouse', label: 'follow the tracks', difficulty: 'normal', distanceFt: 60 },
        { to: 'muddy_bank', label: 'along the shore', difficulty: 'normal', distanceFt: 40 },
        { to: 'east_alley', label: 'into the alley', difficulty: 'normal', distanceFt: 50 },
      ],
    },
    muddy_bank: {
      id: 'muddy_bank',
      name: 'Muddy Bank',
      description: 'A treacherous, washed-out riverbank thick with reeds.',
      tags: ['exterior', 'waterfront', 'hazard'],
      x: -1,
      y: -1,
      connections: [
        { to: 'rainy_quay', label: 'back to the docks', difficulty: 'normal', distanceFt: 40 },
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
        { to: 'smugglers_tunnel', label: 'hidden trapdoor', difficulty: 'normal', distanceFt: 20 },
      ],
    },
    smugglers_tunnel: {
      id: 'smugglers_tunnel',
      name: 'Smuggler\'s Tunnel',
      description: 'A hidden, dripping tunnel carved into the rock.',
      tags: ['underground', 'dark', 'hazard'],
      x: -1,
      y: -2,
      connections: [
        { to: 'old_boathouse', label: 'back up the trapdoor', difficulty: 'normal', distanceFt: 20 },
        { to: 'abandoned_house', label: 'continue down tunnel', difficulty: 'normal', distanceFt: 80 },
      ],
    },
    abandoned_house: {
      id: 'abandoned_house',
      name: 'Abandoned House',
      description: 'A boarded up and rotting structure. The floorboards are loose.',
      tags: ['building', 'interior', 'ruin'],
      x: -2,
      y: 0,
      connections: [
        { to: 'west_street', label: 'out the front door', difficulty: 'normal', distanceFt: 50 },
        { to: 'smugglers_tunnel', label: 'loose floorboards', difficulty: 'normal', distanceFt: 80 },
      ],
    },
    town_square: {
      id: 'town_square',
      name: 'Town Square',
      description: 'The bustling center of the village, featuring a small stone well.',
      tags: ['exterior', 'social'],
      x: 0,
      y: 1,
      connections: [
        { to: 'inn_common_room', label: 'north to the inn', difficulty: 'normal', distanceFt: 50 },
        { to: 'blacksmith', label: 'west lane', difficulty: 'normal', distanceFt: 40 },
        { to: 'general_store', label: 'east lane', difficulty: 'normal', distanceFt: 40 },
        { to: 'south_road', label: 'southward road', difficulty: 'normal', distanceFt: 60 },
      ],
    },
    blacksmith: {
      id: 'blacksmith',
      name: 'Blacksmith\'s Forge',
      description: 'Heat and hammering ring out here from an open-air forge.',
      tags: ['building', 'social'],
      x: -1,
      y: 1,
      connections: [
        { to: 'town_square', label: 'back to square', difficulty: 'normal', distanceFt: 40 },
        { to: 'west_street', label: 'north lane', difficulty: 'normal', distanceFt: 60 },
      ],
    },
    general_store: {
      id: 'general_store',
      name: 'General Store',
      description: 'Packed with mundane supplies and smelling of dried herbs.',
      tags: ['building', 'social'],
      x: 1,
      y: 1,
      connections: [
        { to: 'town_square', label: 'back to square', difficulty: 'normal', distanceFt: 40 },
      ],
    },
    south_road: {
      id: 'south_road',
      name: 'South Road',
      description: 'The muddy road leading out of town toward the wider world.',
      tags: ['exterior', 'street'],
      x: 0,
      y: 2,
      connections: [
        { to: 'town_square', label: 'north to square', difficulty: 'normal', distanceFt: 60 },
        { to: 'farm_fields', label: 'westward path', difficulty: 'normal', distanceFt: 50 },
        { to: 'graveyard', label: 'eastward path', difficulty: 'normal', distanceFt: 50 },
      ],
    },
    farm_fields: {
      id: 'farm_fields',
      name: 'Farm Fields',
      description: 'Sprawling, rain-slicked crops extending to the tree line.',
      tags: ['exterior', 'nature'],
      x: -1,
      y: 2,
      connections: [
        { to: 'south_road', label: 'back to road', difficulty: 'normal', distanceFt: 50 },
      ],
    },
    graveyard: {
      id: 'graveyard',
      name: 'Graveyard',
      description: 'Ancient, weathered headstones jutting from the wet earth.',
      tags: ['exterior', 'holy', 'spooky'],
      x: 1,
      y: 2,
      connections: [
        { to: 'south_road', label: 'back to road', difficulty: 'normal', distanceFt: 50 },
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
