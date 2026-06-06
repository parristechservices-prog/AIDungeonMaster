import type { Monster, NPC } from '../types';

export type PlayableSceneId = 'social' | 'exploration' | 'combat';

export type ScenarioScene = {
  goal: string;
  starter: string;
  choices: string[];
  /** Hint for LLM / mock DM */
  guidance: string;
  allowedNpcs: string[];
  allowedMonsters: string[];
  allowedExits: string[];
  forbidden: string[];
  successConditions: string[];
};

export type ScenarioMock = {
  socialNpcId: string;
  socialNpcName: string;
  socialSuccess: string;
  socialFailure: string;
  explorationSuccess: string;
  explorationFailure: string;
  socialSkill: 'persuasion' | 'insight' | 'deception' | 'intimidation';
  explorationSkill: 'perception' | 'investigation' | 'survival' | 'stealth';
  socialDc: number;
  explorationDc: number;
  canonFactOnSocialSuccess: string;
};

export type Scenario = {
  id: string;
  title: string;
  tagline: string;
  estimatedMinutes: number;
  tone: string;
  recommendedCharacters: string[];
  scenes: Record<PlayableSceneId, ScenarioScene>;
  endingMessage: string;
  npcs: NPC[];
  buildMonsters: () => Monster[];
  mock: ScenarioMock;
};
