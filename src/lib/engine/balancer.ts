import { MONSTER_LIBRARY, getMonster } from '../game/monsters';
import { Monster } from '../game/types';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly';

// XP thresholds per player level (Level 1-5 for V0)
const XP_THRESHOLDS: Record<number, Record<Difficulty, number>> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
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
            .filter(([id, m]) => CR_TO_XP[m.cr] <= remainingXP * 2);
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
