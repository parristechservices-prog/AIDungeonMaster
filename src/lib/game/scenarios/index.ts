import { listAdventuresForCatalog } from '../adventures';
import { brindlehookInn } from './brindlehook-inn';
import { cryptOfWhispers } from './crypt-of-whispers';
import { smugglersCove } from './smugglers-cove';
import { tutorial } from './tutorial';
import type { Scenario } from './types';

export const SCENARIOS: Scenario[] = [tutorial, brindlehookInn, cryptOfWhispers, smugglersCove];

export {
  DEFAULT_ADVENTURE_ID,
  getAdventure,
  listAdventuresForCatalog,
  isValidAdventureId,
} from '../adventures';

/** @deprecated Use getAdventure */
export function getScenario(id: string): Scenario {
  const builtIn = SCENARIOS.find((s) => s.id === id);
  if (builtIn) return builtIn;
  return brindlehookInn;
}

/** @deprecated Use listAdventuresForCatalog */
export function listScenarios() {
  return listAdventuresForCatalog();
}

/** @deprecated Use getScenario('brindlehook-inn') */
export const oneShot = {
  title: brindlehookInn.title,
  scenes: {
    social: { id: 'social' as const, goal: brindlehookInn.scenes.social.goal, starter: brindlehookInn.scenes.social.starter },
    exploration: {
      id: 'exploration' as const,
      goal: brindlehookInn.scenes.exploration.goal,
      starter: brindlehookInn.scenes.exploration.starter,
    },
    combat: { id: 'combat' as const, goal: brindlehookInn.scenes.combat.goal, starter: brindlehookInn.scenes.combat.starter },
  },
};
