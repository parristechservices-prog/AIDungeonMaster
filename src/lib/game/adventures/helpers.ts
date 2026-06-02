import type { Adventure, AdventureScene, SceneKind } from './types';
import { ENDING_SCENE_ID } from './types';

export function getSceneKind(adventure: Adventure, sceneId: string): SceneKind | 'ending' | null {
  if (sceneId === ENDING_SCENE_ID) return 'ending';
  const scene = adventure.scenes[sceneId];
  return scene?.kind ?? null;
}

export function getPlayableScene(adventure: Adventure, sceneId: string): AdventureScene | undefined {
  if (sceneId === ENDING_SCENE_ID) return undefined;
  return adventure.scenes[sceneId];
}

export function getFirstPlayableSceneId(adventure: Adventure): string {
  const first = adventure.sceneOrder.find((id) => id !== ENDING_SCENE_ID);
  return first ?? adventure.sceneOrder[0];
}

export function getSceneGoal(adventure: Adventure, sceneId: string): string {
  if (sceneId === ENDING_SCENE_ID) return 'Finish the adventure.';
  return adventure.scenes[sceneId]?.goal ?? 'Continue your journey.';
}

export function getSceneChoices(adventure: Adventure, sceneId: string): string[] {
  if (sceneId === ENDING_SCENE_ID) return ['Start a new adventure'];
  return adventure.scenes[sceneId]?.choices ?? [];
}
