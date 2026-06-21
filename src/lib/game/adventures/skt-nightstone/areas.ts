import type { AreaGraph } from '@/lib/engine/spatial';

export const nightstoneStartAreaId = 'gatehouse';

export const nightstoneAreas: AreaGraph = {
  areas: {
    gatehouse: {
      id: 'gatehouse',
      name: 'Nightstone Gatehouse',
      description: 'The village gatehouse opens onto the road and the damaged drawbridge approach.',
      tags: ['village', 'entry'],
      connections: [
        { to: 'drawbridge', label: 'the raised-road approach', difficulty: 'normal', distanceFt: 40 },
        { to: 'south_square', label: 'the inner cart track', difficulty: 'normal', distanceFt: 60 },
      ],
    },
    drawbridge: {
      id: 'drawbridge',
      name: 'Drawbridge and Moat',
      description: 'A defensive bridge spans the moat between the gatehouse and the village streets.',
      tags: ['village', 'moat'],
      connections: [
        { to: 'gatehouse', label: 'back toward the gatehouse', difficulty: 'normal', distanceFt: 40 },
        { to: 'south_square', label: 'into the village lane', difficulty: 'normal', distanceFt: 50 },
      ],
    },
    south_square: {
      id: 'south_square',
      name: 'South Village Square',
      description: 'The southern lane is littered with debris from the attack, but the main routes remain passable.',
      tags: ['village', 'debris'],
      connections: [
        { to: 'gatehouse', difficulty: 'normal', distanceFt: 60 },
        { to: 'drawbridge', difficulty: 'normal', distanceFt: 50 },
        { to: 'nightstone_inn', label: 'the inn porch', difficulty: 'normal', distanceFt: 40 },
        { to: 'stable', label: 'the stable yard', difficulty: 'normal', distanceFt: 45 },
        { to: 'central_square', label: 'the main street north', difficulty: 'normal', distanceFt: 80 },
      ],
    },
    nightstone_inn: {
      id: 'nightstone_inn',
      name: 'Nightstone Inn',
      description: 'The inn is a likely refuge or ambush point, with common room exits facing the street.',
      tags: ['building', 'social'],
      connections: [
        { to: 'south_square', label: 'front door', difficulty: 'normal', distanceFt: 40 },
        { to: 'stable', label: 'side yard', difficulty: 'normal', distanceFt: 35 },
      ],
    },
    stable: {
      id: 'stable',
      name: 'Stable',
      description: 'The stable smells of hay, frightened animals, and broken tack.',
      tags: ['building', 'animals'],
      connections: [
        { to: 'south_square', difficulty: 'normal', distanceFt: 45 },
        { to: 'nightstone_inn', label: 'side yard', difficulty: 'normal', distanceFt: 35 },
        { to: 'windmill', label: 'back lane', difficulty: 'normal', distanceFt: 70 },
      ],
    },
    windmill: {
      id: 'windmill',
      name: 'Windmill',
      description: 'The windmill stands near the edge of the village, useful as a lookout over nearby lanes.',
      tags: ['building', 'lookout'],
      connections: [
        { to: 'stable', label: 'back lane', difficulty: 'normal', distanceFt: 70 },
        { to: 'central_square', label: 'curving lane', difficulty: 'normal', distanceFt: 75 },
      ],
    },
    central_square: {
      id: 'central_square',
      name: 'Central Village Square',
      description: 'The main village square gives access to the temple, trading shops, and roads toward the keep.',
      tags: ['village', 'crossroads'],
      connections: [
        { to: 'south_square', difficulty: 'normal', distanceFt: 80 },
        { to: 'temple', label: 'stone steps', difficulty: 'normal', distanceFt: 45 },
        { to: 'general_store', label: 'shopfront', difficulty: 'normal', distanceFt: 35 },
        { to: 'trading_post', label: 'wagon ruts', difficulty: 'normal', distanceFt: 45 },
        { to: 'keep_gate', label: 'north road', difficulty: 'normal', distanceFt: 90 },
      ],
    },
    temple: {
      id: 'temple',
      name: 'Temple of the Morninglord',
      description: 'The damaged temple and its bell tower overlook the village square.',
      tags: ['building', 'holy', 'bell_tower'],
      connections: [
        { to: 'central_square', label: 'temple steps', difficulty: 'normal', distanceFt: 45 },
        { to: 'bell_tower', label: 'narrow tower stairs', difficulty: 'slow', distanceFt: 25 },
      ],
    },
    bell_tower: {
      id: 'bell_tower',
      name: 'Temple Bell Tower',
      description: 'A cramped tower chamber with a commanding view and dangerous footing.',
      tags: ['building', 'height', 'hazard'],
      connections: [
        { to: 'temple', label: 'narrow tower stairs', difficulty: 'slow', distanceFt: 25 },
      ],
    },
    general_store: {
      id: 'general_store',
      name: 'Lionshield General Store',
      description: 'Shelves, crates, and counters make the store useful for supplies or cover.',
      tags: ['building', 'shop'],
      connections: [
        { to: 'central_square', label: 'front door', difficulty: 'normal', distanceFt: 35 },
        { to: 'trading_post', label: 'service alley', difficulty: 'normal', distanceFt: 30 },
      ],
    },
    trading_post: {
      id: 'trading_post',
      name: 'Trading Post',
      description: 'A mercantile building near the square, with wagon access and storage corners.',
      tags: ['building', 'shop'],
      connections: [
        { to: 'central_square', difficulty: 'normal', distanceFt: 45 },
        { to: 'general_store', label: 'service alley', difficulty: 'normal', distanceFt: 30 },
        { to: 'keep_gate', label: 'north road', difficulty: 'normal', distanceFt: 70 },
      ],
    },
    keep_gate: {
      id: 'keep_gate',
      name: 'Nandar Keep Gate',
      description: 'The gate before Nandar Keep is defensible and may be locked or barred.',
      tags: ['keep', 'gate'],
      connections: [
        { to: 'central_square', label: 'south road', difficulty: 'normal', distanceFt: 90 },
        { to: 'trading_post', label: 'side road', difficulty: 'normal', distanceFt: 70 },
        {
          to: 'keep_courtyard',
          label: 'locked keep gate',
          difficulty: 'normal',
          requires: { tag: 'key:nandar_keep_gate' },
          distanceFt: 30,
        },
      ],
    },
    keep_courtyard: {
      id: 'keep_courtyard',
      name: 'Nandar Keep Courtyard',
      description: 'The inner yard of the keep is exposed to the walls and the great hall entrance.',
      tags: ['keep', 'courtyard'],
      connections: [
        { to: 'keep_gate', label: 'locked keep gate', difficulty: 'normal', distanceFt: 30 },
        { to: 'great_hall', label: 'great hall doors', difficulty: 'normal', distanceFt: 40 },
        { to: 'keep_bridge', label: 'broken bridge approach', difficulty: 'hazardous', distanceFt: 50 },
      ],
    },
    great_hall: {
      id: 'great_hall',
      name: 'Nandar Keep Great Hall',
      description: 'The great hall is the keep interior where survivors, clues, or threats may be found.',
      tags: ['keep', 'interior'],
      connections: [
        { to: 'keep_courtyard', label: 'great hall doors', difficulty: 'normal', distanceFt: 40 },
      ],
    },
    keep_bridge: {
      id: 'keep_bridge',
      name: 'Broken Keep Bridge',
      description: 'A damaged crossing near the keep; crossing it without repairs is dangerous.',
      tags: ['keep', 'hazard', 'bridge'],
      connections: [
        { to: 'keep_courtyard', label: 'broken bridge approach', difficulty: 'hazardous', distanceFt: 50 },
      ],
    },
  },
};
