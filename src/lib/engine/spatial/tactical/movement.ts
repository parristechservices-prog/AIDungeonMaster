// Deterministic tactical movement: pathfinding, reachable cells, move
// resolution, Dash, Disengage, and opportunity-attack detection.
//
// Pure and immutable — every function that changes state returns a new
// BattleMap and never mutates its input, matching the area-graph engine.

import type { SpatialAdapter } from './adapter';
import { SquareGridAdapter } from './adapter';
import {
  areHostile,
  blocksMovement,
  footprintAt,
  footprintBlocked,
  inBounds,
  isDiagonalStep,
  isDifficult,
  occupantAt,
  remainingMovementFt,
  sizeSpan,
} from './grid';
import type { BattleMap, GridCoord, SpatialActor } from './types';

export function adapterFor(map: BattleMap): SpatialAdapter {
  // Hex maps would return a HexGridAdapter here; square is the tactical default.
  return new SquareGridAdapter(map.diagonalMode);
}

interface SearchNode {
  coord: GridCoord;
  costFt: number;
  diagCount: number;
  parent: string | null;
}

/** Cost in feet to ENTER `to` from `from`, or Infinity if illegal to enter. */
function enterCostFt(
  map: BattleMap,
  adapter: SpatialAdapter,
  moverId: string,
  from: GridCoord,
  to: GridCoord,
  diagCountSoFar: number,
): number {
  if (blocksMovement(map, to)) return Infinity;
  const occ = occupantAt(map, to, moverId);
  if (occ) {
    const mover = map.actors[moverId];
    const other = map.actors[occ];
    // Cannot pass through a hostile creature's space (no size exception yet).
    if (mover && other && areHostile(mover, other)) return Infinity;
    // Allied/neutral space is passable but counts as difficult terrain.
  }
  const isDiag = isDiagonalStep(from, to);
  const stepCells = isDiag ? adapter.diagonalStepCost(diagCountSoFar) : 1;
  const difficult = isDifficult(map, to) || (occ !== undefined);
  const mult = difficult ? 2 : 1;
  return stepCells * mult * map.cellSizeFt;
}

/** Terrain-only step cost (no occupancy logic); used for multi-cell movers whose
 * occupancy is gated separately via footprintBlocked. */
function terrainStepCostFt(map: BattleMap, adapter: SpatialAdapter, from: GridCoord, to: GridCoord, diagCountSoFar: number): number {
  const isDiag = isDiagonalStep(from, to);
  const stepCells = isDiag ? adapter.diagonalStepCost(diagCountSoFar) : 1;
  const mult = isDifficult(map, to) ? 2 : 1;
  return stepCells * mult * map.cellSizeFt;
}

interface Reached {
  coord: GridCoord;
  costFt: number;
  /** Best state key ("x,y:parity") this cell was reached at, for path rebuild. */
  endState: string;
}

/**
 * Dijkstra over the grid from the actor's position. Returns, for every cell
 * reachable within `budgetFt`, the least-cost coordinate and a parent map for
 * path reconstruction. Cells occupied by another creature are traversable
 * (allies) but never recorded as a legal END cell.
 *
 * State = cell + diagonal parity, because the alternating-diagonal variant's
 * next diagonal cost depends on how many diagonals preceded it. `parents` is
 * keyed by the FULL state (not just the cell) so the parent links always form a
 * tree — keying by cell alone can create A→B/B→A cycles across parities.
 */
function search(
  map: BattleMap,
  adapter: SpatialAdapter,
  actorId: string,
  budgetFt: number,
): { ends: Map<string, Reached>; parents: Map<string, string | null> } {
  const start = map.positions[actorId];
  const ends = new Map<string, Reached>();
  const parents = new Map<string, string | null>();
  if (!start) return { ends, parents };

  const bestCost = new Map<string, number>();
  const stateKey = (key: string, diag: number) => `${key}:${diag % 2}`;

  const span = sizeSpan(map.actors[actorId]?.size);
  const startKey = adapter.key(start);
  const startState = stateKey(startKey, 0);
  const queue: SearchNode[] = [{ coord: start, costFt: 0, diagCount: 0, parent: null }];
  bestCost.set(startState, 0);
  parents.set(startState, null);

  while (queue.length > 0) {
    // Small maps — linear extract-min keeps the code simple and dependency-free.
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].costFt < queue[minIdx].costFt) minIdx = i;
    const cur = queue.splice(minIdx, 1)[0];
    const curState = stateKey(adapter.key(cur.coord), cur.diagCount);

    for (const nb of adapter.neighbors(cur.coord)) {
      if (!inBounds(map, nb)) continue;
      // Multi-cell movers validate their whole footprint and can't pass through
      // any occupied cell; single-cell movers keep the ally-pass-through rule.
      let stepFt: number;
      let canEnd: boolean;
      if (span > 1) {
        if (footprintBlocked(map, actorId, nb, span)) continue;
        stepFt = terrainStepCostFt(map, adapter, cur.coord, nb, cur.diagCount);
        canEnd = true;
      } else {
        stepFt = enterCostFt(map, adapter, actorId, cur.coord, nb, cur.diagCount);
        if (!Number.isFinite(stepFt)) continue;
        canEnd = occupantAt(map, nb, actorId) === undefined;
      }
      const newCost = cur.costFt + stepFt;
      if (newCost > budgetFt) continue;
      const newDiag = cur.diagCount + (isDiagonalStep(cur.coord, nb) ? 1 : 0);
      const nbKey = adapter.key(nb);
      const sk = stateKey(nbKey, newDiag);
      if (bestCost.has(sk) && bestCost.get(sk)! <= newCost) continue;
      bestCost.set(sk, newCost);
      parents.set(sk, curState);
      queue.push({ coord: nb, costFt: newCost, diagCount: newDiag, parent: curState });

      if (canEnd) {
        const prev = ends.get(nbKey);
        if (!prev || prev.costFt > newCost) ends.set(nbKey, { coord: nb, costFt: newCost, endState: sk });
      }
    }
  }
  return { ends, parents };
}

export interface ReachableCell {
  coord: GridCoord;
  costFt: number;
}

/** Every legal destination cell within the actor's remaining movement. */
export function reachableCells(map: BattleMap, actorId: string): ReachableCell[] {
  const actor = map.actors[actorId];
  if (!actor) return [];
  const adapter = adapterFor(map);
  const { ends } = search(map, adapter, actorId, remainingMovementFt(actor));
  return [...ends.values()].map((e) => ({ coord: e.coord, costFt: e.costFt }));
}

/** Rebuild a coordinate path from a state key ("x,y:parity") back to the start. */
function reconstruct(parents: Map<string, string | null>, adapter: SpatialAdapter, endState: string): GridCoord[] {
  const path: GridCoord[] = [];
  let cur: string | null | undefined = endState;
  while (cur != null) {
    path.unshift(adapter.parse(cur.split(':')[0]));
    cur = parents.get(cur);
  }
  return path;
}

export type MoveFailReason =
  | 'unknown_actor'
  | 'out_of_bounds'
  | 'blocked'
  | 'occupied'
  | 'no_path'
  | 'insufficient_movement';

export interface MoveResolution {
  ok: boolean;
  reason?: MoveFailReason;
  movementSpentFt: number;
  movementRemainingFt: number;
  requiredDashFt?: number;
  finalPosition?: GridCoord;
  path?: GridCoord[];
  opportunityAttacks: string[];
}

/**
 * Resolves a move to `target`. Computes the least-cost legal path within the
 * actor's remaining movement, detects opportunity-attack triggers, and returns
 * the new map plus a structured result. The LLM never computes any of this.
 */
export function resolveMove(
  map: BattleMap,
  actorId: string,
  target: GridCoord,
): { map: BattleMap; result: MoveResolution } {
  const actor = map.actors[actorId];
  const start = map.positions[actorId];
  if (!actor || !start) {
    return { map, result: { ok: false, reason: 'unknown_actor', movementSpentFt: 0, movementRemainingFt: 0, opportunityAttacks: [] } };
  }
  const adapter = adapterFor(map);
  const remaining = remainingMovementFt(actor);
  const span = sizeSpan(actor.size);

  if (!inBounds(map, target)) return fail(map, actor, remaining, 'out_of_bounds');
  if (span > 1) {
    // A Large creature must fit its whole 2x2 footprint at the destination.
    if (footprintBlocked(map, actorId, target, span)) {
      const anyBlocked = footprintAt(span, target).some((c) => !inBounds(map, c) || blocksMovement(map, c));
      return fail(map, actor, remaining, anyBlocked ? 'blocked' : 'occupied');
    }
  } else {
    if (blocksMovement(map, target)) return fail(map, actor, remaining, 'blocked');
    if (occupantAt(map, target, actorId) !== undefined) return fail(map, actor, remaining, 'occupied');
  }

  const targetKey = adapter.key(target);
  const withinBudget = search(map, adapter, actorId, remaining);
  const reached = withinBudget.ends.get(targetKey);

  if (!reached) {
    // Distinguish "no legal route at all" from "reachable but too far".
    const unbounded = search(map, adapter, actorId, Number.POSITIVE_INFINITY);
    const far = unbounded.ends.get(targetKey);
    if (!far) return fail(map, actor, remaining, 'no_path');
    return {
      map,
      result: {
        ok: false,
        reason: 'insufficient_movement',
        movementSpentFt: actor.movementSpentFt,
        movementRemainingFt: remaining,
        requiredDashFt: far.costFt,
        opportunityAttacks: [],
      },
    };
  }

  const path = reconstruct(withinBudget.parents, adapter, reached.endState);
  const opportunityAttacks = detectOpportunityAttacks(map, adapter, actorId, path);

  const nextActor: SpatialActor = { ...actor, movementSpentFt: actor.movementSpentFt + reached.costFt };
  const nextMap: BattleMap = {
    ...map,
    positions: { ...map.positions, [actorId]: target },
    actors: { ...map.actors, [actorId]: nextActor },
  };

  return {
    map: nextMap,
    result: {
      ok: true,
      movementSpentFt: nextActor.movementSpentFt,
      movementRemainingFt: remainingMovementFt(nextActor),
      finalPosition: target,
      path,
      opportunityAttacks,
    },
  };
}

function fail(map: BattleMap, actor: SpatialActor, remaining: number, reason: MoveFailReason): { map: BattleMap; result: MoveResolution } {
  return {
    map,
    result: { ok: false, reason, movementSpentFt: actor.movementSpentFt, movementRemainingFt: remaining, opportunityAttacks: [] },
  };
}

/**
 * Opportunity attacks: a hostile with a reaction triggers when the mover leaves
 * its reach (a cell within reach followed by one outside it). Disengage and
 * forced movement suppress this. The roll itself is resolved elsewhere — we only
 * flag the triggering creature ids.
 */
export function detectOpportunityAttacks(
  map: BattleMap,
  adapter: SpatialAdapter,
  moverId: string,
  path: GridCoord[],
): string[] {
  const mover = map.actors[moverId];
  if (!mover || mover.disengaged || path.length < 2) return [];
  const triggers: string[] = [];
  for (const [id, other] of Object.entries(map.actors)) {
    if (id === moverId) continue;
    if (!areHostile(mover, other)) continue;
    if (!other.reactionAvailable) continue;
    const hpos = map.positions[id];
    if (!hpos) continue;
    const reachCells = Math.max(1, Math.ceil(other.reachFt / map.cellSizeFt));
    // Measure reach from the hostile's NEAREST occupied cell (Large creatures
    // threaten a wider area than their anchor).
    const hostileCells = footprintAt(sizeSpan(other.size), hpos);
    const distToHostile = (cell: GridCoord) => Math.min(...hostileCells.map((hc) => adapter.distanceCells(hc, cell)));
    let wasInReach = distToHostile(path[0]) <= reachCells;
    let left = false;
    for (let i = 1; i < path.length; i++) {
      const inReach = distToHostile(path[i]) <= reachCells;
      if (wasInReach && !inReach) left = true;
      wasInReach = inReach;
    }
    if (left) triggers.push(id);
  }
  return triggers;
}

export interface SimpleActionResult {
  ok: boolean;
  reason?: string;
  movementRemainingFt: number;
}

/** Dash: adds movement equal to speed and consumes the action. */
export function dash(map: BattleMap, actorId: string): { map: BattleMap; result: SimpleActionResult } {
  const actor = map.actors[actorId];
  if (!actor) return { map, result: { ok: false, reason: 'unknown_actor', movementRemainingFt: 0 } };
  if (actor.actionUsed) return { map, result: { ok: false, reason: 'action_already_used', movementRemainingFt: remainingMovementFt(actor) } };
  const next: SpatialActor = { ...actor, actionUsed: true, extraMovementFt: actor.extraMovementFt + actor.speedFt };
  return {
    map: { ...map, actors: { ...map.actors, [actorId]: next } },
    result: { ok: true, movementRemainingFt: remainingMovementFt(next) },
  };
}

/** Disengage: suppresses opportunity attacks this turn and consumes the action. */
export function disengage(map: BattleMap, actorId: string): { map: BattleMap; result: SimpleActionResult } {
  const actor = map.actors[actorId];
  if (!actor) return { map, result: { ok: false, reason: 'unknown_actor', movementRemainingFt: 0 } };
  if (actor.actionUsed) return { map, result: { ok: false, reason: 'action_already_used', movementRemainingFt: remainingMovementFt(actor) } };
  const next: SpatialActor = { ...actor, actionUsed: true, disengaged: true };
  return {
    map: { ...map, actors: { ...map.actors, [actorId]: next } },
    result: { ok: true, movementRemainingFt: remainingMovementFt(next) },
  };
}

/** Resets per-turn movement/action economy for the start of an actor's turn. */
export function startTurn(map: BattleMap, actorId: string): BattleMap {
  const actor = map.actors[actorId];
  if (!actor) return map;
  const next: SpatialActor = {
    ...actor,
    movementSpentFt: 0,
    extraMovementFt: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionAvailable: true,
    disengaged: false,
  };
  return { ...map, actors: { ...map.actors, [actorId]: next } };
}
