import type { Ability, Character, Weapon } from './types';

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

/** Which ability each skill uses (PHB). */
export const SKILL_ABILITY: Record<string, Ability> = {
  athletics: 'str',
  acrobatics: 'dex', sleight_of_hand: 'dex', stealth: 'dex',
  arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
  animal_handling: 'wis', insight: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis',
  deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha',
};

type StatBlock = { abilities?: Partial<Record<Ability, number>>; skills?: Record<string, number> };

/** A monster's ability modifier (missing scores count as 10). */
export function monsterAbilityMod(m: StatBlock, ability: Ability): number {
  return abilityMod(m.abilities?.[ability] ?? 10);
}

/** A monster's bonus for a skill: its stat-block skill, else the raw ability modifier. */
export function monsterSkillBonus(m: StatBlock, skill: string): number {
  const listed = m.skills?.[skill];
  if (listed !== undefined) return listed;
  return monsterAbilityMod(m, SKILL_ABILITY[skill] ?? 'dex');
}

/** Passive Wisdom (Perception) = 10 + Perception bonus. */
export function passivePerception(m: StatBlock): number {
  return 10 + monsterSkillBonus(m, 'perception');
}

/** A character's bonus for a skill: listed skill, else the ability modifier. */
export function characterSkillBonus(c: Character, skill: string): number {
  const listed = c.skills[skill];
  if (listed !== undefined) return listed;
  return abilityMod(c.abilities[SKILL_ABILITY[skill] ?? 'dex']);
}

const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

/** Grapple/shove rule: the target can be at most one size larger than you. */
export function canGrappleSize(attacker: string | undefined, target: string | undefined): boolean {
  return SIZES.indexOf(target ?? 'medium') - SIZES.indexOf(attacker ?? 'medium') <= 1;
}

/** Every weapon a character can use, including their main `weapon`. */
export function characterWeapons(c: Character): Weapon[] {
  const ranged = /bow|crossbow|sling|dart|javelin/i.test(c.weapon.name);
  const main: Weapon = { ...c.weapon, kind: ranged ? 'ranged' : 'melee', ...(ranged ? { rangeFt: 80, longRangeFt: 320 } : {}) };
  const list = c.weapons ?? [];
  // The main weapon is always usable, even if it was swapped after the list was made.
  const listedMain = list.find((w) => w.name.toLowerCase() === c.weapon.name.toLowerCase());
  return listedMain ? list : [main, ...list];
}

/**
 * Pick the weapon for an attack. Names match loosely ("crossbow", "sword"),
 * "unarmed"/"punch" gives an unarmed strike and "improvised" a thrown or
 * swung object (1d4, no proficiency).
 */
export function chooseWeapon(c: Character, name: string | undefined, ranged: boolean | undefined): Weapon | { error: string } {
  const weapons = characterWeapons(c);
  const str = abilityMod(c.abilities.str);
  if (name && /unarmed|punch|kick|fist|headbutt|elbow/i.test(name)) {
    return { name: 'Unarmed Strike', attackBonus: str + c.proficiencyBonus, damage: `${Math.max(1, 1 + str)}`, kind: 'melee' };
  }
  if (name && /improvis|chair|bottle|rock|stone|table|stool|tankard|plank/i.test(name)) {
    return ranged
      ? { name: `Improvised (${name})`, attackBonus: str, damage: `1d4+${str}`, kind: 'ranged', rangeFt: 20, longRangeFt: 60 }
      : { name: `Improvised (${name})`, attackBonus: str, damage: `1d4+${str}`, kind: 'melee' };
  }
  if (name) {
    const n = name.toLowerCase();
    const hit = weapons.find((w) => w.name.toLowerCase() === n)
      ?? weapons.find((w) => w.name.toLowerCase().includes(n) || n.includes(w.name.toLowerCase()))
      ?? weapons.find((w) => n.split(/\s+/).some((word) => word.length > 3 && w.name.toLowerCase().includes(word)));
    if (hit) return hit;
    return { error: `${c.name} has no ${name}. Weapons: ${weapons.map((w) => w.name).join(', ')}.` };
  }
  if (ranged) {
    const r = weapons.find((w) => w.kind === 'ranged');
    return r ?? { error: `${c.name} has no ranged weapon (weapons: ${weapons.map((w) => w.name).join(', ')}).` };
  }
  return weapons.find((w) => w.kind === 'melee') ?? weapons[0];
}
