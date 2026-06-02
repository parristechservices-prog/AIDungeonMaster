import { getAdventure, getFirstPlayableSceneId } from '@/lib/game/adventures';
import { ENDING_SCENE_ID } from '@/lib/game/adventures/types';
import type { GameState } from '@/lib/game/types';

type Props = {
  sceneId: GameState['sceneId'];
  adventureId: string;
  sceneGoal: string;
  choices: string[];
  onDismiss: () => void;
};

export function OnboardingBanner({ sceneId, adventureId, sceneGoal, choices, onDismiss }: Props) {
  const adventure = getAdventure(adventureId);
  const scene = sceneId !== ENDING_SCENE_ID ? adventure.scenes[sceneId] : null;
  const firstId = getFirstPlayableSceneId(adventure);
  const starters = (choices.length > 0 ? choices : adventure.scenes[firstId]?.choices ?? []).slice(0, 2);
  const goal = scene?.goal ?? sceneGoal;

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-blue-900 dark:text-blue-100">How to play</p>
          <p className="mt-1 text-blue-800 dark:text-blue-200">
            {goal || 'Choose your next action.'}
          </p>
          {starters.length > 0 && (sceneId === firstId || scene?.kind === 'social' || !scene) && (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              Try: {starters.map((s) => `"${s}"`).join(' · ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs text-blue-700 underline dark:text-blue-300"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
