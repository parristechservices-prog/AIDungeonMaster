import { SCENARIOS } from '../scenarios';
import { scenarioToAdventure } from './from-scenario';
import type { Adventure } from './types';

export const DEFAULT_ADVENTURE_ID = 'brindlehook-inn';

export function buildBuiltinRegistry(): Map<string, Adventure> {
  const map = new Map<string, Adventure>();
  for (const scenario of SCENARIOS) {
    const adventure = scenarioToAdventure(scenario);
    map.set(adventure.id, adventure);
  }
  return map;
}
