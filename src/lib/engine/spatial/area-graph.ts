import { ActorId, AreaGraph, AreaId, ExplorationState } from './types';

export class UnknownAreaError extends Error {
  constructor(areaId: AreaId) {
    super(`Unknown area id: ${areaId}`);
    this.name = 'UnknownAreaError';
  }
}

export function createExplorationState(graph: AreaGraph, startLocations: Record<ActorId, AreaId> = {}): ExplorationState {
  for (const actorId of Object.keys(startLocations)) {
    const areaId = startLocations[actorId];
    if (!graph.areas[areaId]) throw new UnknownAreaError(areaId);
  }
  return { graph, locations: { ...startLocations } };
}

export function getActorArea(state: ExplorationState, actorId: ActorId): AreaId | undefined {
  return state.locations[actorId];
}

export function getArea(state: ExplorationState, areaId: AreaId) {
  const area = state.graph.areas[areaId];
  if (!area) throw new UnknownAreaError(areaId);
  return area;
}

export function getNeighbors(state: ExplorationState, areaId: AreaId) {
  return getArea(state, areaId).connections;
}

export type MoveCheckResult =
  | { ok: true }
  | { ok: false; reason: 'no_connection' }
  | { ok: false; reason: 'blocked' }
  | { ok: false; reason: 'requires_unmet'; requiredTag: string };

export function canMove(
  state: ExplorationState,
  actorId: ActorId,
  targetAreaId: AreaId,
  satisfiedTags: Set<string> = new Set(),
): MoveCheckResult {
  const currentAreaId = getActorArea(state, actorId);
  if (!currentAreaId) throw new Error(`Actor ${actorId} has no known location`);

  const connection = getArea(state, currentAreaId).connections.find((c) => c.to === targetAreaId);
  if (!connection) return { ok: false, reason: 'no_connection' };
  if (connection.difficulty === 'blocked') return { ok: false, reason: 'blocked' };
  if (connection.requires && !satisfiedTags.has(connection.requires.tag)) {
    return { ok: false, reason: 'requires_unmet', requiredTag: connection.requires.tag };
  }
  return { ok: true };
}

export type MoveResult =
  | { ok: true; from: AreaId; to: AreaId; label?: string; distanceFt?: number }
  | { ok: false; reason: 'no_connection' | 'blocked' | 'requires_unmet'; requiredTag?: string };

export function moveActor(
  state: ExplorationState,
  actorId: ActorId,
  targetAreaId: AreaId,
  satisfiedTags: Set<string> = new Set(),
): { state: ExplorationState; result: MoveResult } {
  const check = canMove(state, actorId, targetAreaId, satisfiedTags);
  if (!check.ok) {
    const result: MoveResult =
      check.reason === 'requires_unmet'
        ? { ok: false, reason: check.reason, requiredTag: check.requiredTag }
        : { ok: false, reason: check.reason };
    return { state, result };
  }
  const currentAreaId = getActorArea(state, actorId)!;
  const connection = getArea(state, currentAreaId).connections.find((c) => c.to === targetAreaId)!;

  const nextState: ExplorationState = {
    graph: state.graph,
    locations: { ...state.locations, [actorId]: targetAreaId },
  };

  return {
    state: nextState,
    result: { ok: true, from: currentAreaId, to: targetAreaId, label: connection.label, distanceFt: connection.distanceFt },
  };
}

export function actorsInSameArea(state: ExplorationState, actorId: ActorId): ActorId[] {
  const areaId = getActorArea(state, actorId);
  if (!areaId) return [];
  return Object.entries(state.locations)
    .filter(([, loc]) => loc === areaId)
    .map(([id]) => id)
    .filter((id) => id !== actorId);
}

export function findPath(
  state: ExplorationState,
  fromAreaId: AreaId,
  toAreaId: AreaId,
  satisfiedTags: Set<string> = new Set(),
  respectGating = false,
): AreaId[] | null {
  if (!state.graph.areas[fromAreaId]) throw new UnknownAreaError(fromAreaId);
  if (!state.graph.areas[toAreaId]) throw new UnknownAreaError(toAreaId);
  if (fromAreaId === toAreaId) return [fromAreaId];

  const visited = new Set<AreaId>([fromAreaId]);
  const queue: AreaId[][] = [[fromAreaId]];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    for (const conn of getArea(state, current).connections) {
      if (conn.difficulty === 'blocked') continue;
      if (respectGating && conn.requires && !satisfiedTags.has(conn.requires.tag)) continue;
      if (visited.has(conn.to)) continue;

      const nextPath = [...path, conn.to];
      if (conn.to === toAreaId) return nextPath;

      visited.add(conn.to);
      queue.push(nextPath);
    }
  }
  return null;
}

export function pathDistance(state: ExplorationState, path: AreaId[]): number {
  let distance = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const area = getArea(state, path[i]);
    const connection = area.connections.find((c) => c.to === path[i + 1]);
    if (!connection || typeof connection.distanceFt !== 'number') continue;
    distance += connection.distanceFt;
  }
  return distance;
}
