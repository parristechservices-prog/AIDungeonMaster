import { ActorId, AreaId, ExplorationState } from './types';
import { actorsInSameArea, findPath, getActorArea, getNeighbors, moveActor, pathDistance } from './area-graph';

export type SpatialEngineRequest =
  | { kind: 'move_area'; actorId: ActorId; targetAreaId: AreaId }
  | { kind: 'query_current_area'; actorId: ActorId }
  | { kind: 'query_exits'; actorId: ActorId }
  | { kind: 'query_actors_present'; actorId: ActorId }
  | { kind: 'query_path_exists'; fromAreaId: AreaId; toAreaId: AreaId };

export type SpatialEngineResult =
  | { kind: 'move_area'; ok: true; from: AreaId; to: AreaId; label?: string; distanceFt?: number }
  | { kind: 'move_area'; ok: false; reason: 'no_connection' | 'blocked' | 'requires_unmet'; requiredTag?: string }
  | { kind: 'query_current_area'; areaId: AreaId }
  | { kind: 'query_exits'; exits: { to: AreaId; label?: string; difficulty: string; locked: boolean }[] }
  | { kind: 'query_actors_present'; actorIds: ActorId[] }
  | { kind: 'query_path_exists'; path: AreaId[] | null; distanceFt?: number };

export function resolveSpatialRequest(
  state: ExplorationState,
  request: SpatialEngineRequest,
  satisfiedTags: Set<string> = new Set(),
): { state: ExplorationState; result: SpatialEngineResult } {
  switch (request.kind) {
    case 'move_area': {
      const { state: nextState, result } = moveActor(state, request.actorId, request.targetAreaId, satisfiedTags);
      return { state: nextState, result: { kind: 'move_area', ...result } };
    }
    case 'query_current_area': {
      const areaId = getActorArea(state, request.actorId);
      if (!areaId) throw new Error(`Actor ${request.actorId} has no known location`);
      return { state, result: { kind: 'query_current_area', areaId } };
    }
    case 'query_exits': {
      const areaId = getActorArea(state, request.actorId);
      if (!areaId) throw new Error(`Actor ${request.actorId} has no known location`);
      const exits = getNeighbors(state, areaId).map((c) => ({
        to: c.to,
        label: c.label,
        difficulty: c.difficulty,
        locked: !!c.requires && !satisfiedTags.has(c.requires.tag),
      }));
      return { state, result: { kind: 'query_exits', exits } };
    }
    case 'query_actors_present':
      return { state, result: { kind: 'query_actors_present', actorIds: actorsInSameArea(state, request.actorId) } };
    case 'query_path_exists': {
      const path = findPath(state, request.fromAreaId, request.toAreaId, satisfiedTags, true);
      return {
        state,
        result: { kind: 'query_path_exists', path, distanceFt: path ? pathDistance(state, path) : undefined },
      };
    }
  }
}
