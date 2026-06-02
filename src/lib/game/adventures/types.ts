import type { Difficulty } from '@/lib/engine/balancer';
import type { Monster, NPC } from '../types';
import type { ScenarioMock, ScenarioScene } from '../scenarios/types';
import type { SceneEncounterSpec } from './encounters';

export type { SceneEncounterSpec };

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
  /** Short DM notes for the LLM — your own words, not book text */
  campaignGuide?: string;
  playConfig?: {
    defaultLevel: number;
    partySize: number;
    defaultDifficulty: Difficulty;
    spawnMonstersOnCombatOnly: boolean;
    preferredMonsterTemplates: string[];
  };
  sceneEncounters?: Record<string, SceneEncounterSpec>;
  sceneOrder: string[];
  scenes: Record<string, AdventureScene>;
  endingMessage: string;
  npcs: NPC[];
  monsters: Monster[];
  mock: ScenarioMock;
};

export const ENDING_SCENE_ID = 'ending';
