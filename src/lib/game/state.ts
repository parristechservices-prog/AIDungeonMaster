import { getBackground } from './backgrounds';
import { buildCharacter } from './characters/templates';
import { DEFAULT_ADVENTURE_ID, getScenario } from './scenarios';
import type { CanonFact, GameState, NewGameOptions, SceneId } from './types';

export type { NewGameOptions };

export function createInitialState(sessionId: string, options?: NewGameOptions): GameState {
  const adventureId = options?.adventureId ?? DEFAULT_ADVENTURE_ID;
  const characterTemplateId = options?.characterId ?? 'fighter';
  const scenario = getScenario(adventureId);
  const player = buildCharacter(characterTemplateId, { playerName: options?.playerName });

  const canonLog: CanonFact[] = [];
  const background = options?.backgroundId ? getBackground(options.backgroundId) : undefined;
  if (background) {
    canonLog.push({
      id: `fact-bg-${background.id}`,
      content: background.canonFact,
      importance: 'medium',
    });
  }

  const personaId = options?.personaId ?? 'balanced';

  return {
    sessionId,
    adventureId,
    characterTemplateId,
    backgroundId: background?.id,
    personaId,
    sceneId: 'social',
    log: [],
    canonLog,
    player,
    monsters: scenario.buildMonsters(),
    npcs: structuredClone(scenario.npcs),
    combat: { active: false, initiative: [], turnIndex: 0 },
  };
}

export function migrateGameState(state: GameState): GameState {
  const adventureId = state.adventureId ?? DEFAULT_ADVENTURE_ID;
  const characterTemplateId = state.characterTemplateId ?? 'fighter';
  const personaId = state.personaId ?? 'balanced';
  if (
    state.adventureId === adventureId &&
    state.characterTemplateId === characterTemplateId &&
    state.personaId === personaId
  ) {
    return state;
  }
  return { ...state, adventureId, characterTemplateId, personaId };
}

export function advanceScene(state: GameState): GameState {
  const order: SceneId[] = ['social', 'exploration', 'combat', 'ending'];
  const i = order.indexOf(state.sceneId);
  if (i < 0 || i === order.length - 1) return state;
  return { ...state, sceneId: order[i + 1] };
}

export function getOpeningNarration(state: GameState): string {
  const scenario = getScenario(state.adventureId);
  return scenario.scenes.social.starter;
}
