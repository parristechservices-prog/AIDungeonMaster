// Shared, pure cell/grid helpers used by movement, range, and LOS modules.

import type { BattleMap, Cell, GridCoord, SpatialActor } from './types';

const DEFAULT_CELL: Cell = { terrain: 'normal' };

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

/** The id of an actor occupying cell `c`, ignoring `exceptId`, or undefined. */
export function occupantAt(map: BattleMap, c: GridCoord, exceptId?: string): string | undefined {
  for (const [id, pos] of Object.entries(map.positions)) {
    if (id === exceptId) continue;
    if (pos.x === c.x && pos.y === c.y) return id;
  }
  return undefined;
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
