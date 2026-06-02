import { brindlehookInn } from './brindlehook-inn';
import { cryptOfWhispers } from './crypt-of-whispers';
import { smugglersCove } from './smugglers-cove';
import type { Scenario } from './types';

export const SCENARIOS: Scenario[] = [brindlehookInn, cryptOfWhispers, smugglersCove];

export const DEFAULT_ADVENTURE_ID = 'brindlehook-inn';

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? brindlehookInn;
}

export function listScenarios(): Array<{
  id: string;
  title: string;
  tagline: string;
  estimatedMinutes: number;
  tone: string;
  recommendedCharacters: string[];
}> {
  return SCENARIOS.map(({ id, title, tagline, estimatedMinutes, tone, recommendedCharacters }) => ({
    id,
    title,
    tagline,
    estimatedMinutes,
    tone,
    recommendedCharacters,
  }));
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
