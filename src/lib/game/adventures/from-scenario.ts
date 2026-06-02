import type { Scenario } from '../scenarios/types';
import type { Adventure, AdventureScene } from './types';
import { ENDING_SCENE_ID } from './types';

const BUILTIN_SCENE_ORDER = ['social', 'exploration', 'combat', ENDING_SCENE_ID] as const;

export function scenarioToAdventure(scenario: Scenario): Adventure {
  const scenes: Record<string, AdventureScene> = {
    social: { kind: 'social', ...scenario.scenes.social },
    exploration: { kind: 'exploration', ...scenario.scenes.exploration },
    combat: { kind: 'combat', ...scenario.scenes.combat },
  };

  return {
    id: scenario.id,
    title: scenario.title,
    tagline: scenario.tagline,
    estimatedMinutes: scenario.estimatedMinutes,
    tone: scenario.tone,
    recommendedCharacters: scenario.recommendedCharacters,
    source: 'builtin',
    sceneOrder: [...BUILTIN_SCENE_ORDER],
    scenes,
    endingMessage: scenario.endingMessage,
    npcs: structuredClone(scenario.npcs),
    monsters: scenario.buildMonsters(),
    mock: scenario.mock,
  };
}
