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
    conditions: [],
  },
  worg: {
    name: 'Worg',
    ac: 13,
    maxHp: 26,
    attackBonus: 5,
    damage: '2d6+3',
    cr: 0.5,
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

export function getMonster(templateId: string): Monster {
  const template = MONSTER_LIBRARY[templateId] || MONSTER_LIBRARY.goblin;
  return {
    ...template,
    id: `${templateId}-${Math.random().toString(36).slice(2, 9)}`,
    hp: template.maxHp,
    conditions: [],
  };
}
