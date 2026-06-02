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
  },
  skeleton: {
    name: 'Skeleton',
    ac: 13,
    maxHp: 13,
    attackBonus: 4,
    damage: '1d6+2',
    cr: 0.25,
  },
  wolf: {
    name: 'Wolf',
    ac: 13,
    maxHp: 11,
    attackBonus: 4,
    damage: '2d4+2',
    cr: 0.25,
  },
  orc: {
    name: 'Orc',
    ac: 13,
    maxHp: 15,
    attackBonus: 5,
    damage: '1d12+3',
    cr: 0.5,
  },
  bugbear: {
    name: 'Bugbear',
    ac: 16,
    maxHp: 27,
    attackBonus: 4,
    damage: '2d8+2',
    cr: 1,
  },
};

export function getMonster(templateId: string): Monster {
  const template = MONSTER_LIBRARY[templateId] || MONSTER_LIBRARY.goblin;
  return {
    ...template,
    id: `${templateId}-${Math.random().toString(36).slice(2, 9)}`,
    hp: template.maxHp,
  };
}
