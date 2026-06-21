// Shared, pure cell/grid helpers used by movement, range, and LOS modules.

import type { BattleMap, Cell, CreatureSize, GridCoord, SpatialActor } from './types';

const DEFAULT_CELL: Cell = { terrain: 'normal' };

// --- Creature footprint (multi-cell size) ---------------------------------
// A creature's anchor (its entry in `positions`) is the TOP-LEFT cell of its
// footprint. Medium/Small occupy 1 cell; Large occupies 2x2. Huge/Gargantuan
// are deferred and treated as single-cell for now (see roadmap).

export function sizeSpan(size?: CreatureSize): number {
  return size === 'large' ? 2 : 1;
}

/** Every cell a creature of `span` occupies with top-left anchor at `anchor`. */
export function footprintAt(span: number, anchor: GridCoord): GridCoord[] {
  if (span <= 1) return [{ x: anchor.x, y: anchor.y, z: anchor.z }];
  const out: GridCoord[] = [];
  for (let dx = 0; dx < span; dx++) {
    for (let dy = 0; dy < span; dy++) out.push({ x: anchor.x + dx, y: anchor.y + dy, z: anchor.z });
  }
  return out;
}

/** The cells an actor currently occupies on the map (footprint at its anchor). */
export function actorFootprint(map: BattleMap, id: string): GridCoord[] {
  const pos = map.positions[id];
  if (!pos) return [];
  return footprintAt(sizeSpan(map.actors[id]?.size), pos);
}

export function getCell(map: BattleMap, c: GridCoord): Cell {
  return map.cells[`${c.x},${c.y}`] ?? DEFAULT_CELL;
}

export function inBounds(map: BattleMap, c: GridCoord): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
}

/** Walls, objects, or impassable terrain that no creature may enter. */
export function blocksMovement(map: BattleMap, c: GridCoord): boolean {
  if (!inBounds(map, c)) return true;
  const cell = getCell(map, c);
  return cell.terrain === 'blocked' || cell.blocksMovement === true;
}

/** Difficult-terrain-style cells cost double to enter (5e). */
export function isDifficult(map: BattleMap, c: GridCoord): boolean {
  const cell = getCell(map, c);
  return (
    cell.terrain === 'difficult' ||
    cell.terrain === 'water' ||
    cell.terrain === 'climb' ||
    cell.terrain === 'squeeze' ||
    cell.terrain === 'hazard'
  );
}

/**
 * The id of an actor whose footprint covers cell `c`, ignoring `exceptId`.
 * Multi-cell (Large) creatures are detected on any of their occupied cells, not
 * just the anchor.
 */
export function occupantAt(map: BattleMap, c: GridCoord, exceptId?: string): string | undefined {
  for (const [id, pos] of Object.entries(map.positions)) {
    if (id === exceptId) continue;
    const span = sizeSpan(map.actors[id]?.size);
    if (c.x >= pos.x && c.x < pos.x + span && c.y >= pos.y && c.y < pos.y + span) return id;
  }
  return undefined;
}

/**
 * True if a creature of `span` anchored at `anchor` cannot legally occupy that
 * footprint: any cell is out of bounds, blocks movement, or is held by another
 * creature. Used to gate Large-creature movement through gaps/occupied cells.
 */
export function footprintBlocked(map: BattleMap, moverId: string, anchor: GridCoord, span: number): boolean {
  for (const cell of footprintAt(span, anchor)) {
    if (!inBounds(map, cell)) return true;
    if (blocksMovement(map, cell)) return true;
    if (occupantAt(map, cell, moverId) !== undefined) return true;
  }
  return false;
}

/** Two factions are hostile if exactly one of them is the party side. */
export function areHostile(a: SpatialActor, b: SpatialActor): boolean {
  const partyA = a.faction === 'party';
  const partyB = b.faction === 'party';
  return partyA !== partyB;
}

export function remainingMovementFt(actor: SpatialActor): number {
  return actor.speedFt + actor.extraMovementFt - actor.movementSpentFt;
}

export function isDiagonalStep(a: GridCoord, b: GridCoord): boolean {
  return a.x !== b.x && a.y !== b.y;
}
