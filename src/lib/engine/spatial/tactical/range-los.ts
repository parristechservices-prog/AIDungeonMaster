// Range, reach, line of sight, and cover — all deterministic, all engine-owned.
// Distances include elevation (z, in feet) so flying/heights affect range too.

import { adapterFor } from './movement';
import { actorFootprint, getCell, sizeSpan } from './grid';
import type { BattleMap, CoverKind, GridCoord } from './types';

/** Footprint-aware distance in feet between two actors (nearest occupied cells). */
export function actorDistanceFt(map: BattleMap, aId: string, bId: string): number | undefined {
  const aCells = actorFootprint(map, aId);
  const bCells = actorFootprint(map, bId);
  if (aCells.length === 0 || bCells.length === 0) return undefined;
  let min = Infinity;
  for (const a of aCells) for (const b of bCells) min = Math.min(min, distanceFt(map, a, b));
  return min;
}

/**
 * Cells that block sight because a multi-cell (Large) creature stands there.
 * `excludeIds` skips the attacker/target so a creature never blocks sight to or
 * from itself.
 */
export function creatureSightBlockers(map: BattleMap, excludeIds: Iterable<string> = []): Set<string> {
  const exclude = new Set(excludeIds);
  const blockers = new Set<string>();
  for (const id of Object.keys(map.positions)) {
    if (exclude.has(id)) continue;
    if (sizeSpan(map.actors[id]?.size) <= 1) continue; // only Large+ footprints block
    for (const c of actorFootprint(map, id)) blockers.add(`${c.x},${c.y}`);
  }
  return blockers;
}

/**
 * 5e cube/Chebyshev distance in feet, including vertical separation. The
 * greatest axis difference dominates, matching the "count the longer dimension"
 * approximation used for flight and ranged attacks.
 */
export function distanceFt(map: BattleMap, a: GridCoord, b: GridCoord): number {
  const adapter = adapterFor(map);
  const horizFt = adapter.distanceCells(a, b) * map.cellSizeFt;
  const vertFt = Math.abs((a.z ?? 0) - (b.z ?? 0));
  return Math.max(horizFt, vertFt);
}

export function distanceBetweenActors(map: BattleMap, aId: string, bId: string): number | undefined {
  return actorDistanceFt(map, aId, bId);
}

export interface SightResult {
  hasLineOfSight: boolean;
  cover: CoverKind;
}

/**
 * Line of sight + cover between two cells via Bresenham raycast.
 * - A sight-blocking cell on the line => total cover (no line of sight).
 * - Movement-blocking-but-see-through cells (low walls) grant half (1) or
 *   three-quarters (2+) cover.
 * - The target cell's own static `cover` is also applied (max wins).
 */
export function lineOfSight(map: BattleMap, from: GridCoord, to: GridCoord, blockers?: Set<string>): SightResult {
  const adapter = adapterFor(map);
  const cells = adapter.line(from, to);
  let partialBlockers = 0;
  // Skip the first (attacker) and last (target) cells.
  for (let i = 1; i < cells.length - 1; i++) {
    const cell = getCell(map, cells[i]);
    if (cell.blocksSight) return { hasLineOfSight: false, cover: 'total' };
    // A Large creature standing on the line blocks sight through any of its cells.
    if (blockers?.has(`${cells[i].x},${cells[i].y}`)) return { hasLineOfSight: false, cover: 'total' };
    if (cell.blocksMovement) partialBlockers++;
  }
  const fromObstacles: CoverKind = partialBlockers >= 2 ? 'three_quarters' : partialBlockers === 1 ? 'half' : 'none';
  const targetStatic = getCell(map, to).cover ?? 'none';
  return { hasLineOfSight: true, cover: maxCover(fromObstacles, targetStatic) };
}

const COVER_RANK: Record<CoverKind, number> = { none: 0, half: 1, three_quarters: 2, total: 3 };

export function maxCover(a: CoverKind, b: CoverKind): CoverKind {
  return COVER_RANK[a] >= COVER_RANK[b] ? a : b;
}

/** AC bonus from cover; total cover means the target cannot be targeted at all. */
export function coverAcBonus(cover: CoverKind): number {
  switch (cover) {
    case 'half':
      return 2;
    case 'three_quarters':
      return 5;
    default:
      return 0;
  }
}

export interface RangeCheck {
  ok: boolean;
  reason?: 'unknown_actor' | 'out_of_reach' | 'out_of_range' | 'no_line_of_sight';
  distanceFt?: number;
  cover?: CoverKind;
}

/** Melee: target must be within the attacker's reach (3D distance). */
export function checkMeleeReach(map: BattleMap, attackerId: string, targetId: string): RangeCheck {
  const attacker = map.actors[attackerId];
  const dist = distanceBetweenActors(map, attackerId, targetId);
  if (!attacker || dist === undefined) return { ok: false, reason: 'unknown_actor' };
  if (dist > attacker.reachFt) return { ok: false, reason: 'out_of_reach', distanceFt: dist };
  return { ok: true, distanceFt: dist };
}

/** Ranged/spell: target within range AND not behind total cover. */
export function checkRange(map: BattleMap, attackerId: string, targetId: string, rangeFt: number): RangeCheck {
  const from = map.positions[attackerId];
  const to = map.positions[targetId];
  if (!from || !to) return { ok: false, reason: 'unknown_actor' };
  const dist = actorDistanceFt(map, attackerId, targetId) ?? distanceFt(map, from, to);
  if (dist > rangeFt) return { ok: false, reason: 'out_of_range', distanceFt: dist };
  const sight = lineOfSight(map, from, to, creatureSightBlockers(map, [attackerId, targetId]));
  if (!sight.hasLineOfSight || sight.cover === 'total') {
    return { ok: false, reason: 'no_line_of_sight', distanceFt: dist, cover: 'total' };
  }
  return { ok: true, distanceFt: dist, cover: sight.cover };
}

export interface TargetInfo {
  id: string;
  distanceFt: number;
  hasLineOfSight: boolean;
  cover: CoverKind;
  inReach: boolean;
}

/** All other actors within `rangeFt`, with LOS/cover/reach annotations. */
export function targetsInRange(map: BattleMap, actorId: string, rangeFt: number): TargetInfo[] {
  const from = map.positions[actorId];
  const self = map.actors[actorId];
  if (!from || !self) return [];
  const out: TargetInfo[] = [];
  for (const [id, pos] of Object.entries(map.positions)) {
    if (id === actorId) continue;
    const dist = actorDistanceFt(map, actorId, id) ?? distanceFt(map, from, pos);
    if (dist > rangeFt) continue;
    const sight = lineOfSight(map, from, pos, creatureSightBlockers(map, [actorId, id]));
    out.push({
      id,
      distanceFt: dist,
      hasLineOfSight: sight.hasLineOfSight,
      cover: sight.cover,
      inReach: dist <= self.reachFt,
    });
  }
  return out.sort((a, b) => a.distanceFt - b.distanceFt);
}
