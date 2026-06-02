import { getScenario } from './scenarios';
import type { Monster } from './types';

/** @deprecated Use scenario.buildMonsters() */
export function buildCombatMonsters(adventureId = 'brindlehook-inn'): Monster[] {
  return getScenario(adventureId).buildMonsters();
}
