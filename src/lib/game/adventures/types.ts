import type { Monster, NPC } from '../types';
import type { ScenarioMock, ScenarioScene } from '../scenarios/types';

export type SceneKind = 'social' | 'exploration' | 'combat';

export type AdventureScene = ScenarioScene & {
  kind: SceneKind;
};

export type Adventure = {
  id: string;
  title: string;
  tagline: string;
  estimatedMinutes: number;
  tone: string;
  recommendedCharacters: string[];
  source: 'builtin' | 'private' | 'template';
  levelRange?: [number, number];
  sceneOrder: string[];
  scenes: Record<string, AdventureScene>;
  endingMessage: string;
  npcs: NPC[];
  monsters: Monster[];
  mock: ScenarioMock;
};

export const ENDING_SCENE_ID = 'ending';
