import { getBackground } from './backgrounds';
import { buildCharacter } from './characters/templates';
import { getSceneKind } from './adventures/helpers';
import { initialMonstersForAdventure, resolveCombatMonsters } from './adventures/encounters';
import { DEFAULT_ADVENTURE_ID, getAdventure, getFirstPlayableSceneId } from './adventures/registry.server';
import { buildExplorationState } from './adventures/area-graphs';
import type { AuthoredBattleMap, BattleMap, GridCoord, SpatialActor } from '@/lib/engine/spatial/tactical';
import { buildCellsFromAuthoring } from '@/lib/engine/spatial/tactical';
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
 * fresh per-turn action economy. When the encounter authored terrain (via
 * `authored`), its dimensions and cells are used and actors are placed on free,
 * non-blocked cells; otherwise a featureless square grid is generated.
 */
export function buildBattleMap(
  state: GameState,
  preservePositions?: Record<string, GridCoord>,
  authored?: AuthoredBattleMap,
): BattleMap {
  const width = authored?.width ?? 8;
  const height = authored?.height ?? 6;
  const cells = authored ? buildCellsFromAuthoring(authored, width, height).cells : {};
  const positions: Record<string, GridCoord> = {};
  const actors: BattleMap['actors'] = {};

  const isBlocked = (x: number, y: number) => {
    const c = cells[`${x},${y}`];
    return !!c && (c.terrain === 'blocked' || c.blocksMovement === true);
  };
  const takenKeys = new Set<string>();
  const place = (id: string, preferredX: number, index: number): GridCoord => {
    const fromSave = preservePositions?.[id];
    if (fromSave) {
      takenKeys.add(`${fromSave.x},${fromSave.y}`);
      return fromSave;
    }
    const preferredY = Math.min(height - 1, 1 + index);
    const candidate = firstFreeCell(preferredX, preferredY, width, height, isBlocked, takenKeys);
    takenKeys.add(`${candidate.x},${candidate.y}`);
    return { ...candidate, z: 0 };
  };

  state.party.forEach((member, index) => {
    positions[member.id] = place(member.id, 1, index);
    actors[member.id] = makeSpatialActor(member.id, 'party');
  });
  state.monsters.forEach((monster, index) => {
    positions[monster.id] = place(monster.id, width - 2, index);
    actors[monster.id] = makeSpatialActor(monster.id, 'monster', monster.size, monster.reachFt);
  });

  return {
    gridType: authored?.gridType ?? 'square',
    cellSizeFt: authored?.cellSizeFt ?? 5,
    width,
    height,
    diagonalMode: authored?.diagonalMode ?? 'simple_5ft',
    cells,
    positions,
    actors,
  };
}

/** Finds the nearest free, non-blocked cell to (preferredX, preferredY). */
function firstFreeCell(
  preferredX: number,
  preferredY: number,
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean,
  taken: Set<string>,
): { x: number; y: number } {
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && !isBlocked(x, y) && !taken.has(`${x},${y}`);
  if (free(preferredX, preferredY)) return { x: preferredX, y: preferredY };
  // Spiral-ish scan: same column first, then the whole grid.
  for (let y = 0; y < height; y++) if (free(preferredX, y)) return { x: preferredX, y };
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) if (free(x, y)) return { x, y };
  return { x: preferredX, y: preferredY }; // fully packed: fall back to preferred
}

function makeSpatialActor(
  id: string,
  faction: SpatialActor['faction'],
  size: SpatialActor['size'] = 'medium',
  reachFt: number = DEFAULT_REACH_FT,
): SpatialActor {
  return {
    id,
    faction,
    size,
    speedFt: DEFAULT_SPEED_FT,
    reachFt,
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
