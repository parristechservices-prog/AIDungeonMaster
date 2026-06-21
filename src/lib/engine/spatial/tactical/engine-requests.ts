// The seam between LLM structured intent and the tactical engine. The LLM emits
// these requests; the engine resolves legality/cost/results. Add these kinds to
// the prompt and validate narration against the returned facts.

import { dash, disengage, reachableCells, resolveMove, type MoveResolution } from './movement';
import { checkRange, lineOfSight, targetsInRange, type TargetInfo } from './range-los';
import type { BattleMap, GridCoord } from './types';

export type TacticalEngineRequest =
  | { kind: 'move_creature'; actorId: string; target: GridCoord }
  | { kind: 'dash'; actorId: string }
  | { kind: 'disengage'; actorId: string }
  | { kind: 'query_reachable'; actorId: string }
  | { kind: 'query_targets_in_range'; actorId: string; rangeFt: number }
  | { kind: 'check_line_of_sight'; actorId: string; targetId: string; rangeFt?: number };

export type TacticalEngineResult =
  | { kind: 'move_creature'; result: MoveResolution }
  | { kind: 'dash'; ok: boolean; reason?: string; movementRemainingFt: number }
  | { kind: 'disengage'; ok: boolean; reason?: string; movementRemainingFt: number }
  | { kind: 'query_reachable'; cells: { coord: GridCoord; costFt: number }[] }
  | { kind: 'query_targets_in_range'; targets: TargetInfo[] }
  | { kind: 'check_line_of_sight'; ok: boolean; reason?: string; distanceFt?: number; cover?: string };

export function resolveTacticalRequest(
  map: BattleMap,
  request: TacticalEngineRequest,
): { map: BattleMap; result: TacticalEngineResult } {
  switch (request.kind) {
    case 'move_creature': {
      const { map: next, result } = resolveMove(map, request.actorId, request.target);
      return { map: next, result: { kind: 'move_creature', result } };
    }
    case 'dash': {
      const { map: next, result } = dash(map, request.actorId);
      return { map: next, result: { kind: 'dash', ...result } };
    }
    case 'disengage': {
      const { map: next, result } = disengage(map, request.actorId);
      return { map: next, result: { kind: 'disengage', ...result } };
    }
    case 'query_reachable':
      return { map, result: { kind: 'query_reachable', cells: reachableCells(map, request.actorId) } };
    case 'query_targets_in_range':
      return { map, result: { kind: 'query_targets_in_range', targets: targetsInRange(map, request.actorId, request.rangeFt) } };
    case 'check_line_of_sight': {
      const from = map.positions[request.actorId];
      const to = map.positions[request.targetId];
      if (!from || !to) {
        return { map, result: { kind: 'check_line_of_sight', ok: false, reason: 'unknown_actor' } };
      }
      if (request.rangeFt !== undefined) {
        const check = checkRange(map, request.actorId, request.targetId, request.rangeFt);
        return { map, result: { kind: 'check_line_of_sight', ok: check.ok, reason: check.reason, distanceFt: check.distanceFt, cover: check.cover } };
      }
      const sight = lineOfSight(map, from, to);
      return {
        map,
        result: {
          kind: 'check_line_of_sight',
          ok: sight.hasLineOfSight && sight.cover !== 'total',
          reason: sight.hasLineOfSight ? undefined : 'no_line_of_sight',
          cover: sight.cover,
        },
      };
    }
  }
}
