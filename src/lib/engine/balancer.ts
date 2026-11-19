import { MONSTER_LIBRARY, getMonster } from '../game/monsters';
import { Monster } from '../game/types';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly';

// Single-character XP thresholds by level.
const XP_THRESHOLDS: Record<number, Record<Difficulty, number>> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
};

const CR_TO_XP: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  13: 10000,
};

export function buildBalancedEncounter(
  playerLevel: number,
  partySize: number,
  difficulty: Difficulty,
  preferredMonsterIds: string[] = ['goblin']
): Monster[] {
  const levelThresholds = XP_THRESHOLDS[playerLevel] || XP_THRESHOLDS[1];
  const targetXP = levelThresholds[difficulty] * partySize;

  let currentXP = 0;
  const monsters: Monster[] = [];

  // Simple greedy algorithm to fill XP budget
  while (currentXP < targetXP) {
    const remainingXP = targetXP - currentXP;
    
    // Find monsters that fit in remaining budget
    const candidates = Object.entries(MONSTER_LIBRARY)
      .filter(([id, m]) => preferredMonsterIds.includes(id) && CR_TO_XP[m.cr] <= remainingXP * 1.5);

    if (candidates.length === 0) {
        // If no preferred monsters fit, try any monster
        const anyCandidates = Object.entries(MONSTER_LIBRARY)
            .filter(([, m]) => CR_TO_XP[m.cr] <= remainingXP * 2);
        if (anyCandidates.length === 0) break;
        
        const [id] = anyCandidates[Math.floor(Math.random() * anyCandidates.length)];
        const m = MONSTER_LIBRARY[id];
        monsters.push(getMonster(id));
        currentXP += CR_TO_XP[m.cr];
    } else {
        const [id] = candidates[Math.floor(Math.random() * candidates.length)];
        const m = MONSTER_LIBRARY[id];
        monsters.push(getMonster(id));
        currentXP += CR_TO_XP[m.cr];
    }
    
    if (monsters.length > 8) break; // Limit monster count
  }

  return monsters;
}

/** DMG encounter multiplier by number of monsters. */
function encounterMultiplier(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  return 3;
}

/** Adjusted XP of a group of monsters (DMG: total XP x group multiplier). */
export function adjustedEncounterXp(monsters: Monster[]): number {
  const total = monsters.reduce((sum, m) => sum + (CR_TO_XP[MONSTER_LIBRARY[templateIdOf(m)]?.cr ?? -1] ?? 0), 0);
  return total * encounterMultiplier(monsters.length);
}

function templateIdOf(m: Monster): string {
  const match = Object.keys(MONSTER_LIBRARY).find((id) => m.id === id || m.id.startsWith(`${id}-`));
  return match ?? m.id;
}

/**
 * Book encounters assume a party of four. For smaller parties, drop monsters
 * (from the end of the list) until the adjusted XP fits the given difficulty
 * budget, always keeping at least one.
 */
export function scaleEncounterForParty(
  monsters: Monster[],
  playerLevel: number,
  partySize: number,
  cap: Difficulty = 'hard',
): Monster[] {
  const budget = (XP_THRESHOLDS[playerLevel] || XP_THRESHOLDS[1])[cap] * partySize;
  const kept = [...monsters];
  while (kept.length > 1 && adjustedEncounterXp(kept) > budget) kept.pop();
  return kept;
}
