import type { Ability, Character } from './types';

/** 5e hit die by class (PHB). */
const HIT_DIE: Record<string, number> = {
  barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  sorcerer: 6, wizard: 6,
};

/** 5e saving-throw proficiencies by class (PHB). */
const SAVE_PROFICIENCIES: Record<string, Ability[]> = {
  barbarian: ['str', 'con'], bard: ['dex', 'cha'], cleric: ['wis', 'cha'], druid: ['int', 'wis'],
  fighter: ['str', 'con'], monk: ['str', 'dex'], paladin: ['wis', 'cha'], ranger: ['str', 'dex'],
  rogue: ['dex', 'int'], sorcerer: ['con', 'cha'], warlock: ['wis', 'cha'], wizard: ['int', 'wis'],
};

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function hitDieFor(className: string): number | undefined {
  return HIT_DIE[className.trim().toLowerCase()];
}

/** The character's Hit Dice, derived from class and level when not stored yet. */
export function getHitDice(c: Character): { die: number; remaining: number; max: number } {
  if (c.hitDice) return c.hitDice;
  const die = hitDieFor(c.className) ?? 8;
  return { die, remaining: c.level, max: c.level };
}

/** 5e max HP: full hit die + Con at level 1, then the fixed average (die/2 + 1) + Con per level. */
export function maxHpForLevel(className: string, con: number, level: number): number | undefined {
  const die = hitDieFor(className);
  if (!die) return undefined;
  const conMod = abilityMod(con);
  return Math.max(level, die + conMod + (level - 1) * (die / 2 + 1 + conMod));
}

export function saveBonus(c: Character, ability: Ability): number {
  const proficient = (c.savingThrowProficiencies ?? SAVE_PROFICIENCIES[c.className.trim().toLowerCase()] ?? []).includes(ability);
  return abilityMod(c.abilities[ability]) + (proficient ? c.proficiencyBonus : 0);
}
