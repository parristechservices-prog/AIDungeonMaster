import type { Character } from '../types';

/** Scale a level-3 template toward another level (solo SKT tables). */
export function applyCharacterLevel(character: Character, targetLevel: number): Character {
  const level = Math.min(20, Math.max(1, Math.round(targetLevel)));
  if (level === character.level) return character;

  const ratio = level / character.level;
  const proficiencyBonus = 2 + Math.floor((level - 1) / 4);
  const maxHp = Math.max(level, Math.round(character.maxHp * ratio));
  const hp = Math.min(character.hp, maxHp);

  const skills: Character['skills'] = {};
  for (const [key, mod] of Object.entries(character.skills)) {
    if (mod !== undefined) {
      const delta = proficiencyBonus - character.proficiencyBonus;
      skills[key] = mod + delta;
    }
  }

  const weaponBonus = proficiencyBonus - character.proficiencyBonus;

  return {
    ...character,
    level,
    proficiencyBonus,
    maxHp,
    hp: Math.max(1, hp),
    skills,
    weapon: {
      ...character.weapon,
      attackBonus: character.weapon.attackBonus + weaponBonus,
    },
  };
}
