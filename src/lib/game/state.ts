import { getBackground } from './backgrounds';
import { buildCharacter } from './characters/templates';
import { getSceneKind } from './adventures/helpers';
import { initialMonstersForAdventure, resolveCombatMonsters } from './adventures/encounters';
import { DEFAULT_ADVENTURE_ID, getAdventure, getFirstPlayableSceneId } from './adventures/registry.server';
import { buildExplorationState } from './adventures/area-graphs';
import type { BattleMap, GridCoord, SpatialActor } from '@/lib/engine/spatial/tactical';
import type { CanonFact, GameState, NewGameOptions } from './types';

export type { NewGameOptions };

export function createInitialState(sessionId: string, options?: NewGameOptions): GameState {
  const adventureId = options?.adventureId ?? DEFAULT_ADVENTURE_ID;
  const characterTemplateIds = options?.characterIds ?? [options?.characterId ?? 'fighter'];
  const playerNames = options?.playerNames ?? (options?.playerName ? [options.playerName] : []);
  const adventure = getAdventure(adventureId);
  const level =
    options?.playerLevel ??
    adventure.playConfig?.defaultLevel ??
    adventure.levelRange?.[0] ??
    3;
  
  const party = characterTemplateIds.map((id, i) => buildCharacter(id, {
    playerName: playerNames[i],
    level,
  }));

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
    characterTemplateId: characterTemplateIds[0],
    characterTemplateIds,
    backgroundId: background?.id,
    personaId,
    sceneId: getFirstPlayableSceneId(adventure),
    log: [],
    canonLog,
    player: party[0],
    party,
    activeCharacterId: party[0].id,
    monsters: initialMonstersForAdventure(adventure, party[0].level),
    npcs: structuredClone(adventure.npcs),
    combat: { active: false, initiative: [], turnIndex: 0 },
    exploration: buildExplorationState(adventureId, party.map((p) => p.id)),
  };
}

const DEFAULT_SPEED_FT = 30;
const DEFAULT_REACH_FT = 5;

/**
 * Builds the tactical BattleMap that exists while combat is active: party on the
 * west edge, monsters on the east, every actor with default 5e speed/reach and a
 * fresh per-turn action economy. Terrain is empty (all normal) by default;
 * scenarios/modules can layer terrain on top later.
 */
export function buildBattleMap(
  state: GameState,
  preservePositions?: Record<string, GridCoord>,
): BattleMap {
  const width = 8;
  const height = 6;
  const positions: Record<string, GridCoord> = {};
  const actors: BattleMap['actors'] = {};

  state.party.forEach((member, index) => {
    positions[member.id] = preservePositions?.[member.id] ?? { x: 1, y: Math.min(height - 1, 1 + index), z: 0 };
    actors[member.id] = makeSpatialActor(member.id, 'party');
  });
  state.monsters.forEach((monster, index) => {
    positions[monster.id] = preservePositions?.[monster.id] ?? { x: width - 2, y: Math.min(height - 1, 1 + index), z: 0 };
    actors[monster.id] = makeSpatialActor(monster.id, 'monster');
  });

  return {
    gridType: 'square',
    cellSizeFt: 5,
    width,
    height,
    diagonalMode: 'simple_5ft',
    cells: {},
    positions,
    actors,
  };
}

function makeSpatialActor(id: string, faction: SpatialActor['faction']): SpatialActor {
  return {
    id,
    faction,
    size: 'medium',
    speedFt: DEFAULT_SPEED_FT,
    reachFt: DEFAULT_REACH_FT,
    movementSpentFt: 0,
    extraMovementFt: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionAvailable: true,
    disengaged: false,
    prone: false,
    flying: false,
  };
}

export function migrateGameState(state: GameState): GameState {
  const adventureId = state.adventureId ?? DEFAULT_ADVENTURE_ID;
  const characterTemplateIds = state.characterTemplateIds ?? ['fighter'];
  const characterTemplateId = state.characterTemplateId ?? characterTemplateIds[0];
  const personaId = state.personaId ?? 'balanced';
  const party = state.party ?? (state.player ? [state.player] : []);
  const player = state.player ?? party[0];
  const activeCharacterId = state.activeCharacterId ?? player?.id;
  const exploration =
    state.exploration ?? buildExplorationState(adventureId, party.map((p) => p.id));

  if (
    state.adventureId === adventureId &&
    state.characterTemplateIds === characterTemplateIds &&
    state.characterTemplateId === characterTemplateId &&
    state.personaId === personaId &&
    state.party === party &&
    state.player === player &&
    state.activeCharacterId === activeCharacterId &&
    state.exploration === exploration &&
    (!state.combat?.active || state.combat.battleMap)
  ) {
    return state;
  }
  // Upgrade old saves: build a BattleMap when combat is active but none exists,
  // preserving any positions from the legacy `{width,height,positions}` grid.
  const legacyGrid = (state.combat as { grid?: { positions?: Record<string, GridCoord> } } | undefined)?.grid;
  const combat = state.combat?.active && !state.combat.battleMap
    ? {
        active: state.combat.active,
        initiative: state.combat.initiative,
        turnIndex: state.combat.turnIndex,
        battleMap: buildBattleMap({ ...state, party, player, activeCharacterId }, legacyGrid?.positions),
      }
    : state.combat;
  return {
    ...state,
    adventureId,
    characterTemplateId,
    characterTemplateIds,
    personaId,
    party,
    player,
    activeCharacterId,
    combat,
    exploration,
  };
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
      monsters: resolveCombatMonsters(adventure, nextSceneId, state.party[0].level),
    };
  }
  return next;
}

export function getOpeningNarration(state: GameState): string {
  const adventure = getAdventure(state.adventureId);
  const first = getFirstPlayableSceneId(adventure);
  return adventure.scenes[first]?.starter ?? 'Your adventure begins.';
}
