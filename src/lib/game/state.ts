import { getBackground } from './backgrounds';
import { buildCharacter } from './characters/templates';
import { getSceneKind } from './adventures/helpers';
import { initialMonstersForAdventure, resolveCombatMonsters } from './adventures/encounters';
import { DEFAULT_ADVENTURE_ID, getAdventure, getFirstPlayableSceneId } from './adventures/registry.server';
import type { CanonFact, GameState, NewGameOptions } from './types';

export type { NewGameOptions };

export function createInitialState(sessionId: string, options?: NewGameOptions): GameState {
  const adventureId = options?.adventureId ?? DEFAULT_ADVENTURE_ID;
  const characterTemplateId = options?.characterId ?? 'fighter';
  const adventure = getAdventure(adventureId);
  const level =
    options?.playerLevel ??
    adventure.playConfig?.defaultLevel ??
    adventure.levelRange?.[0] ??
    3;
  const player = buildCharacter(characterTemplateId, {
    playerName: options?.playerName,
    level,
  });

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
    sceneId: getFirstPlayableSceneId(adventure),
    log: [],
    canonLog,
    player,
    monsters: initialMonstersForAdventure(adventure, player.level),
    npcs: structuredClone(adventure.npcs),
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
  const adventure = getAdventure(state.adventureId);
  const order = adventure.sceneOrder;
  const i = order.indexOf(state.sceneId);
  if (i < 0 || i >= order.length - 1) return state;
  const nextSceneId = order[i + 1];
  let next: GameState = {
    ...state,
    sceneId: nextSceneId,
    combat: { active: false, initiative: [], turnIndex: 0 },
  };
  if (getSceneKind(adventure, nextSceneId) === 'combat') {
    next = {
      ...next,
      monsters: resolveCombatMonsters(adventure, nextSceneId, state.player.level),
    };
  }
  return next;
}

export function getOpeningNarration(state: GameState): string {
  const adventure = getAdventure(state.adventureId);
  const first = getFirstPlayableSceneId(adventure);
  return adventure.scenes[first]?.starter ?? 'Your adventure begins.';
}
