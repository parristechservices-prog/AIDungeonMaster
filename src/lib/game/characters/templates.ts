import type { Character } from '../types';

export type CharacterTemplate = {
  id: string;
  label: string;
  className: string;
  description: string;
  /** Suggested scenario ids */
  suggestedAdventures: string[];
  create: () => Character;
};

const fighter: Character = {
  id: 'pc-fighter-1',
  name: 'Seren Ashfall',
  level: 3,
  className: 'Fighter',
  ac: 17,
  maxHp: 28,
  hp: 28,
  proficiencyBonus: 2,
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 11, cha: 13 },
  skills: { athletics: 5, perception: 2, intimidation: 3, history: 2 },
  features: [{ id: 'second_wind', name: 'Second Wind', usesMax: 1, usesRemaining: 1, rechargeOn: 'short_rest' }],
  spellSlots: {},
  weapon: { name: 'Longsword', attackBonus: 5, damage: '1d8+3' },
  gold: 15,
  inventory: ['Chain Shirt', 'Longsword', 'Explorer\'s Pack', 'Healing Potion'],
  deathSaves: { success: 0, failure: 0 },
  unconscious: false,
};

const wizard: Character = {
  id: 'pc-wizard-1',
  name: 'Kaelen Thorne',
  level: 3,
  className: 'Wizard',
  ac: 12,
  maxHp: 17,
  hp: 17,
  proficiencyBonus: 2,
  abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
  skills: { arcana: 5, investigation: 5, history: 5, insight: 3 },
  features: [{ id: 'arcane_recovery', name: 'Arcane Recovery', usesMax: 1, usesRemaining: 1, rechargeOn: 'long_rest' }],
  spellSlots: {
    1: { max: 4, remaining: 4 },
    2: { max: 2, remaining: 2 },
  },
  weapon: { name: 'Quarterstaff', attackBonus: 2, damage: '1d6+2' },
  gold: 10,
  inventory: ['Arcane Focus', 'Spellbook', 'Scholar\'s Pack', 'Healing Potion'],
  deathSaves: { success: 0, failure: 0 },
  unconscious: false,
};

const rogue: Character = {
  id: 'pc-rogue-1',
  name: 'Tamsin Vex',
  level: 3,
  className: 'Rogue',
  ac: 15,
  maxHp: 20,
  hp: 20,
  proficiencyBonus: 2,
  abilities: { str: 10, dex: 16, con: 12, int: 12, wis: 13, cha: 14 },
  skills: { stealth: 5, sleight_of_hand: 5, perception: 3, deception: 5, acrobatics: 5 },
  features: [{ id: 'cunning_action', name: 'Cunning Action', usesMax: 99, usesRemaining: 99, rechargeOn: 'short_rest' }],
  spellSlots: {},
  weapon: { name: 'Rapier', attackBonus: 5, damage: '1d8+3' },
  gold: 25,
  inventory: ['Leather Armor', 'Rapier', 'Thieves\' Tools', 'Dark Cloak', 'Healing Potion'],
  deathSaves: { success: 0, failure: 0 },
  unconscious: false,
};

const cleric: Character = {
  id: 'pc-cleric-1',
  name: 'Brother Aldric',
  level: 3,
  className: 'Cleric',
  ac: 16,
  maxHp: 24,
  hp: 24,
  proficiencyBonus: 2,
  abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
  skills: { religion: 5, insight: 5, medicine: 5, persuasion: 3 },
  features: [{ id: 'channel_divinity', name: 'Channel Divinity', usesMax: 1, usesRemaining: 1, rechargeOn: 'short_rest' }],
  spellSlots: {
    1: { max: 4, remaining: 4 },
    2: { max: 2, remaining: 2 },
  },
  weapon: { name: 'Mace', attackBonus: 4, damage: '1d6+2' },
  gold: 12,
  inventory: ['Chain Shirt', 'Shield', 'Holy Symbol', 'Healing Potion', 'Healing Potion'],
  deathSaves: { success: 0, failure: 0 },
  unconscious: false,
};

export const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'fighter',
    label: 'Fighter',
    className: 'Fighter',
    description: 'Front-line warrior with heavy armor, strong attacks, and Second Wind.',
    suggestedAdventures: ['brindlehook-inn', 'smugglers-cove'],
    create: () => structuredClone(fighter),
  },
  {
    id: 'wizard',
    label: 'Wizard',
    className: 'Wizard',
    description: 'Arcane scholar with spell slots and careful investigation skills.',
    suggestedAdventures: ['brindlehook-inn', 'crypt-of-whispers'],
    create: () => structuredClone(wizard),
  },
  {
    id: 'rogue',
    label: 'Rogue',
    className: 'Rogue',
    description: 'Skilled infiltrator — stealth, locks, and decisive strikes.',
    suggestedAdventures: ['smugglers-cove', 'brindlehook-inn'],
    create: () => structuredClone(rogue),
  },
  {
    id: 'cleric',
    label: 'Cleric',
    className: 'Cleric',
    description: 'Divine caster who turns undead and keeps allies standing.',
    suggestedAdventures: ['crypt-of-whispers', 'brindlehook-inn'],
    create: () => structuredClone(cleric),
  },
];

export function getCharacterTemplate(id: string): CharacterTemplate | undefined {
  return CHARACTER_TEMPLATES.find((t) => t.id === id);
}

export function buildCharacter(
  characterId: string,
  options?: { playerName?: string },
): Character {
  const template = getCharacterTemplate(characterId) ?? getCharacterTemplate('fighter')!;
  const character = template.create();
  if (options?.playerName?.trim()) {
    character.name = options.playerName.trim().slice(0, 40);
  }
  character.id = `${character.id}-${Date.now().toString(36).slice(-4)}`;
  return character;
}

/** @deprecated Use CHARACTER_TEMPLATES */
export const pregenFighter = fighter;
export const pregenWizard = wizard;
