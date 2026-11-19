import { Monster, MonsterAttack } from './types';

export type MonsterTemplate = Omit<Monster, 'id' | 'hp'> & { cr: number };

/**
 * Normalises a monster into a list of attacks. Monsters with an explicit
 * `attacks` array use it; legacy monsters fall back to a single melee attack
 * built from `attackBonus`/`damage` with 5 ft reach (or `reachFt` if set).
 */
export function monsterAttacks(monster: Pick<Monster, 'attacks' | 'attackBonus' | 'damage' | 'reachFt'>): MonsterAttack[] {
  if (monster.attacks && monster.attacks.length > 0) return monster.attacks;
  return [
    {
      id: 'melee',
      name: 'Attack',
      kind: 'melee',
      attackBonus: monster.attackBonus,
      damage: monster.damage,
      reachFt: monster.reachFt ?? 5,
    },
  ];
}

export const MONSTER_LIBRARY: Record<string, MonsterTemplate> = {
  goblin: {
    name: 'Goblin',
    ac: 13,
    maxHp: 7,
    attackBonus: 4,
    damage: '1d6+2',
    cr: 0.25,
    conditions: [],
  },
  goblin_archer: {
    name: 'Goblin Archer',
    ac: 13,
    maxHp: 7,
    attackBonus: 4,
    damage: '1d6+2',
    cr: 0.25,
    conditions: [],
    attacks: [
      { id: 'scimitar', name: 'Scimitar', kind: 'melee', attackBonus: 4, damage: '1d6+2', damageType: 'slashing', reachFt: 5 },
      { id: 'shortbow', name: 'Shortbow', kind: 'ranged', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', rangeFt: 80, longRangeFt: 320 },
    ],
  },
  skeleton: {
    name: 'Skeleton',
    ac: 13,
    maxHp: 13,
    attackBonus: 4,
    damage: '1d6+2',
    cr: 0.25,
    conditions: [],
    // Skeletons in 5e carry shortbows; give them a ranged option too.
    attacks: [
      { id: 'shortsword', name: 'Shortsword', kind: 'melee', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', reachFt: 5 },
      { id: 'shortbow', name: 'Shortbow', kind: 'ranged', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', rangeFt: 80, longRangeFt: 320 },
    ],
  },
  wolf: {
    name: 'Wolf',
    ac: 13,
    maxHp: 11,
    attackBonus: 4,
    damage: '2d4+2',
    cr: 0.25,
    speedFt: 40,
    attacks: [
      { id: 'bite', name: 'Bite', kind: 'melee', attackBonus: 4, damage: '2d4+2', damageType: 'piercing', reachFt: 5, onHitSave: { ability: 'str', dc: 11, condition: 'prone' } },
    ],
    conditions: [],
  },
  worg: {
    name: 'Worg',
    ac: 13,
    maxHp: 26,
    attackBonus: 5,
    damage: '2d6+3',
    cr: 0.5,
    size: 'large',
    speedFt: 50,
    attacks: [
      { id: 'bite', name: 'Bite', kind: 'melee', attackBonus: 5, damage: '2d6+3', damageType: 'piercing', reachFt: 5, onHitSave: { ability: 'str', dc: 13, condition: 'prone' } },
    ],
    conditions: [],
  },
  orc: {
    name: 'Orc',
    ac: 13,
    maxHp: 15,
    attackBonus: 5,
    damage: '1d12+3',
    cr: 0.5,
    conditions: [],
  },
  bugbear: {
    name: 'Bugbear',
    ac: 16,
    maxHp: 27,
    attackBonus: 4,
    damage: '2d8+2',
    cr: 1,
    conditions: [],
  },
  hobgoblin: {
    name: 'Hobgoblin',
    ac: 18,
    maxHp: 11,
    attackBonus: 3,
    damage: '1d8+1',
    cr: 0.5,
    conditions: [],
  },
  bandit: {
    name: 'Bandit',
    ac: 12,
    maxHp: 11,
    attackBonus: 3,
    damage: '1d6+1',
    cr: 0.125,
    conditions: [],
  },
  ogre: {
    name: 'Ogre',
    ac: 11,
    maxHp: 59,
    attackBonus: 6,
    damage: '2d8+4',
    cr: 2,
    size: 'large',
    speedFt: 40,
    conditions: [],
  },
  hill_giant: {
    name: 'Hill Giant',
    ac: 13,
    maxHp: 105,
    attackBonus: 8,
    damage: '3d8+5',
    cr: 5,
    conditions: [],
  },
  stone_giant: {
    name: 'Stone Giant',
    ac: 17,
    maxHp: 126,
    attackBonus: 9,
    damage: '3d8+6',
    cr: 7,
    conditions: [],
  },
  frost_giant: {
    name: 'Frost Giant',
    ac: 15,
    maxHp: 138,
    attackBonus: 9,
    damage: '3d12+6',
    cr: 8,
    conditions: [],
  },
  fire_giant: {
    name: 'Fire Giant',
    ac: 18,
    maxHp: 162,
    attackBonus: 11,
    damage: '6d6+7',
    cr: 9,
    conditions: [],
  },
  cloud_giant: {
    name: 'Cloud Giant',
    ac: 14,
    maxHp: 200,
    attackBonus: 12,
    damage: '3d12+8',
    cr: 9,
    conditions: [],
  },
  storm_giant: {
    name: 'Storm Giant',
    ac: 16,
    maxHp: 230,
    attackBonus: 14,
    damage: '6d6+9',
    cr: 13,
    conditions: [],
  },
  ape: {
    name: 'Ape',
    ac: 12,
    maxHp: 19,
    attackBonus: 5,
    damage: '1d6+4',
    cr: 0.5,
    conditions: [],
  },
};

/** Extra SRD stat blocks so the DM can fight whoever the players pick a fight with. */
Object.assign(MONSTER_LIBRARY, {
  spy: {
    name: 'Spy', ac: 12, maxHp: 27, attackBonus: 4, damage: '1d6+2', cr: 1, conditions: [],
    attacks: [
      { id: 'shortsword', name: 'Shortsword', kind: 'melee', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', reachFt: 5 },
      { id: 'hand_crossbow', name: 'Hand Crossbow', kind: 'ranged', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', rangeFt: 30, longRangeFt: 120 },
    ],
  },
  bandit_captain: {
    name: 'Bandit Captain', ac: 15, maxHp: 65, attackBonus: 5, damage: '1d6+3', cr: 2, conditions: [],
    attacks: [
      { id: 'scimitar', name: 'Scimitar', kind: 'melee', attackBonus: 5, damage: '1d6+3', damageType: 'slashing', reachFt: 5 },
      { id: 'dagger', name: 'Dagger (thrown)', kind: 'ranged', attackBonus: 5, damage: '1d4+3', damageType: 'piercing', rangeFt: 20, longRangeFt: 60 },
    ],
  },
  guard: { name: 'Guard', ac: 16, maxHp: 11, attackBonus: 3, damage: '1d6+1', cr: 0.125, conditions: [] },
  scout: {
    name: 'Scout', ac: 13, maxHp: 16, attackBonus: 4, damage: '1d6+2', cr: 0.5, conditions: [],
    attacks: [
      { id: 'shortsword', name: 'Shortsword', kind: 'melee', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', reachFt: 5 },
      { id: 'longbow', name: 'Longbow', kind: 'ranged', attackBonus: 4, damage: '1d8+2', damageType: 'piercing', rangeFt: 150, longRangeFt: 600 },
    ],
  },
  commoner: { name: 'Commoner', ac: 10, maxHp: 4, attackBonus: 2, damage: '1d4', cr: 0, conditions: [] },
} satisfies Record<string, MonsterTemplate>);

/** SRD size, speed and reach for the giants (all Huge, 10 ft reach). */
const GIANT_BODY: Record<string, { speedFt: number }> = {
  hill_giant: { speedFt: 40 }, stone_giant: { speedFt: 40 }, frost_giant: { speedFt: 40 },
  fire_giant: { speedFt: 30 }, cloud_giant: { speedFt: 40 }, storm_giant: { speedFt: 50 },
};
for (const [id, body] of Object.entries(GIANT_BODY)) {
  const t = MONSTER_LIBRARY[id];
  if (!t) continue;
  t.size ??= 'huge';
  t.speedFt ??= body.speedFt;
  t.reachFt ??= 10;
}

/** SRD ability scores (STR, DEX, CON, INT, WIS, CHA) and notable skills. */
const STATS: Record<string, [[number, number, number, number, number, number], Record<string, number>?]> = {
  goblin: [[8, 14, 10, 10, 8, 8], { stealth: 6 }],
  goblin_archer: [[8, 14, 10, 10, 8, 8], { stealth: 6 }],
  skeleton: [[10, 14, 15, 6, 8, 5]],
  wolf: [[12, 15, 12, 3, 12, 6], { perception: 3, stealth: 4 }],
  worg: [[16, 13, 13, 7, 11, 8], { perception: 4 }],
  orc: [[16, 12, 16, 7, 11, 10], { intimidation: 2 }],
  bugbear: [[15, 14, 13, 8, 11, 9], { stealth: 6, survival: 2 }],
  hobgoblin: [[13, 12, 12, 10, 10, 9]],
  bandit: [[11, 12, 12, 10, 10, 10]],
  ogre: [[19, 8, 16, 5, 7, 7]],
  hill_giant: [[21, 8, 19, 5, 9, 6], { perception: 2 }],
  stone_giant: [[23, 15, 20, 10, 12, 9], { athletics: 12, perception: 4 }],
  frost_giant: [[23, 9, 21, 9, 10, 12], { athletics: 9, perception: 3 }],
  fire_giant: [[25, 9, 23, 10, 14, 13], { athletics: 11, perception: 6 }],
  cloud_giant: [[27, 10, 22, 12, 16, 16], { insight: 7, perception: 7 }],
  storm_giant: [[29, 14, 20, 16, 18, 18], { arcana: 8, athletics: 14, history: 8, perception: 9 }],
  ape: [[16, 14, 14, 6, 12, 7], { athletics: 5, perception: 3 }],
  spy: [[10, 15, 10, 12, 14, 16], { deception: 5, insight: 4, investigation: 5, perception: 6, persuasion: 5, sleight_of_hand: 4, stealth: 4 }],
  bandit_captain: [[15, 16, 14, 14, 11, 14], { athletics: 4, deception: 4 }],
  guard: [[13, 12, 12, 10, 11, 10], { perception: 2 }],
  scout: [[11, 14, 12, 11, 13, 11], { nature: 4, perception: 5, stealth: 6, survival: 5 }],
  commoner: [[10, 10, 10, 10, 10, 10]],
};
for (const [id, [[str, dex, con, int, wis, cha], skills]] of Object.entries(STATS)) {
  const t = MONSTER_LIBRARY[id];
  if (!t) continue;
  t.abilities ??= { str, dex, con, int, wis, cha };
  if (skills) t.skills ??= skills;
}

/** SRD Dexterity modifiers, used for monster initiative (5e: d20 + Dex). */
const INITIATIVE_BONUS: Record<string, number> = {
  goblin: 2, goblin_archer: 2, skeleton: 2, wolf: 2, worg: 1, orc: 1, bugbear: 2, hobgoblin: 1, bandit: 1,
  ogre: -1, hill_giant: -1, stone_giant: 2, frost_giant: -1, fire_giant: -1, cloud_giant: 0, storm_giant: 2, ape: 2,
  spy: 2, bandit_captain: 3, guard: 1, scout: 2, commoner: 0,
};
for (const [id, bonus] of Object.entries(INITIATIVE_BONUS)) {
  if (MONSTER_LIBRARY[id] && MONSTER_LIBRARY[id].initiativeBonus === undefined) MONSTER_LIBRARY[id].initiativeBonus = bonus;
}

export function getMonster(templateId: string): Monster {
  const template = MONSTER_LIBRARY[templateId] || MONSTER_LIBRARY.goblin;
  return {
    ...template,
    id: `${templateId}-${Math.random().toString(36).slice(2, 9)}`,
    hp: template.maxHp,
    conditions: [],
  };
}
