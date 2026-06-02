import type { Monster, NPC, SceneId } from '../types';

export type PlayableSceneId = Exclude<SceneId, 'ending'>;

export type ScenarioScene = {
  goal: string;
  starter: string;
  choices: string[];
  /** Hint for LLM / mock DM */
  guidance: string;
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
