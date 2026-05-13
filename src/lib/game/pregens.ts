import type { Character } from './types';

export const pregenFighter: Character = {
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
  inventory: ['Leather Armor', 'Backpack', 'Bedroll', 'Mess Kit', 'Tinderbox', '10 Torches', '10 Days Rations', 'Waterskin', 'Signet Ring'],
};

export const pregenWizard: Character = {
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
  weapon: { name: 'Quarterstaff', attackBonus: 1, damage: '1d6-1' },
  gold: 10,
  inventory: ['Arcane Focus', 'Spellbook', 'Scholar\'s Pack'],
};
