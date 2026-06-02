import { Monster } from './types';

export type MonsterTemplate = Omit<Monster, 'id' | 'hp'> & { cr: number };

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
  skeleton: {
    name: 'Skeleton',
    ac: 13,
    maxHp: 13,
    attackBonus: 4,
    damage: '1d6+2',
    cr: 0.25,
    conditions: [],
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
