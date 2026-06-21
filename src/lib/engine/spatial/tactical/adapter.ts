// SpatialAdapter abstracts grid geometry so movement/range/LOS logic never
// hardcodes square-grid assumptions. SquareGridAdapter is the tactical default;
// HexGridAdapter is a working axial-coordinate implementation kept ready for
// wilderness maps. Zone/theatre-of-mind movement is handled by the separate
// exploration ExplorationState, not through this interface.

import type { DiagonalMode, GridCoord } from './types';

export interface SpatialAdapter {
  /** Stable string key for a coordinate (ignores elevation). */
  key(c: GridCoord): string;
  parse(k: string): GridCoord;
  /** Orthogonal (+ diagonal, for square) neighbours, elevation preserved. */
  neighbors(c: GridCoord): GridCoord[];
  /** Distance in CELLS between two coordinates (horizontal only). */
  distanceCells(a: GridCoord, b: GridCoord): number;
  /** Cells crossed from a to b inclusive, for line-of-sight raycasting. */
  line(a: GridCoord, b: GridCoord): GridCoord[];
  /**
   * Movement cost multiplier (in cells) for the i-th diagonal step taken so far.
   * Square simple = always 1; alternating = 1,2,1,2...; hex has no diagonals = 1.
   */
  diagonalStepCost(diagonalCountSoFar: number): number;
}

export class SquareGridAdapter implements SpatialAdapter {
  constructor(private readonly diagonalMode: DiagonalMode = 'simple_5ft') {}

  key(c: GridCoord): string {
    return `${c.x},${c.y}`;
  }

  parse(k: string): GridCoord {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  }

  neighbors(c: GridCoord): GridCoord[] {
    const out: GridCoord[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        out.push({ x: c.x + dx, y: c.y + dy, z: c.z });
      }
    }
    return out;
  }

  /** Chebyshev distance: in 5e simplified rules a diagonal counts as one square. */
  distanceCells(a: GridCoord, b: GridCoord): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  line(a: GridCoord, b: GridCoord): GridCoord[] {
    // Bresenham's line over integer cells.
    const points: GridCoord[] = [];
    let x0 = a.x;
    let y0 = a.y;
    const x1 = b.x;
    const y1 = b.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      points.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return points;
  }

  diagonalStepCost(diagonalCountSoFar: number): number {
    if (this.diagonalMode === 'simple_5ft') return 1;
    // Alternating 5/10: every 2nd diagonal costs 2 cells (10 ft).
    return diagonalCountSoFar % 2 === 1 ? 2 : 1;
  }
}

/**
 * Axial-coordinate hex adapter (x = q, y = r). Neighbours are the six axial
 * directions; distance uses the cube formula. Ready for wilderness maps; the
 * engine dispatcher treats it identically to the square adapter.
 */
export class HexGridAdapter implements SpatialAdapter {
  private static readonly DIRS: Array<[number, number]> = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];

  key(c: GridCoord): string {
    return `${c.x},${c.y}`;
  }

  parse(k: string): GridCoord {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  }

  neighbors(c: GridCoord): GridCoord[] {
    return HexGridAdapter.DIRS.map(([dq, dr]) => ({ x: c.x + dq, y: c.y + dr, z: c.z }));
  }

  distanceCells(a: GridCoord, b: GridCoord): number {
    // Cube distance derived from axial coords.
    const aq = a.x;
    const ar = a.y;
    const bq = b.x;
    const br = b.y;
    return (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;
  }

  line(a: GridCoord, b: GridCoord): GridCoord[] {
    const n = this.distanceCells(a, b);
    if (n === 0) return [{ x: a.x, y: a.y }];
    const out: GridCoord[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const q = a.x + (b.x - a.x) * t;
      const r = a.y + (b.y - a.y) * t;
      out.push(roundAxial(q, r));
    }
    return out;
  }

  diagonalStepCost(): number {
    return 1; // hexes have no diagonals
  }
}

function roundAxial(q: number, r: number): GridCoord {
  // Round axial via cube rounding to the nearest hex.
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: rz };
}
