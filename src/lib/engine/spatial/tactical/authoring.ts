// Converts sparse, scenario-authored battle-map data into a full set of
// BattleMap cells. Pure and defensive: out-of-bounds entries and unknown
// terrain/cover values are dropped with a warning rather than crashing the game.

import type { AuthoredBattleMap, Cell, CoverKind, TerrainKind } from './types';

const VALID_TERRAIN = new Set<TerrainKind>([
  'normal', 'difficult', 'blocked', 'hazard', 'water', 'climb', 'squeeze',
]);
const VALID_COVER = new Set<CoverKind>(['none', 'half', 'three_quarters', 'total']);

interface CellAttrs {
  terrain?: TerrainKind;
  cover?: CoverKind;
  elevationFt?: number;
  blocksMovement?: boolean;
  blocksSight?: boolean;
}

function sanitizeAttrs(raw: CellAttrs, where: string, warnings: string[]): CellAttrs | null {
  const out: CellAttrs = {};
  if (raw.terrain !== undefined) {
    if (VALID_TERRAIN.has(raw.terrain)) out.terrain = raw.terrain;
    else warnings.push(`Ignored unknown terrain "${raw.terrain}" at ${where}.`);
  }
  if (raw.cover !== undefined) {
    if (VALID_COVER.has(raw.cover)) out.cover = raw.cover;
    else warnings.push(`Ignored unknown cover "${raw.cover}" at ${where}.`);
  }
  if (typeof raw.elevationFt === 'number') out.elevationFt = raw.elevationFt;
  if (typeof raw.blocksMovement === 'boolean') out.blocksMovement = raw.blocksMovement;
  if (typeof raw.blocksSight === 'boolean') out.blocksSight = raw.blocksSight;
  return Object.keys(out).length > 0 ? out : null;
}

function applyAttrs(cells: Record<string, Cell>, x: number, y: number, attrs: CellAttrs): void {
  const key = `${x},${y}`;
  const existing = cells[key] ?? { terrain: 'normal' as TerrainKind };
  cells[key] = { ...existing, ...attrs, terrain: attrs.terrain ?? existing.terrain };
}

/**
 * Builds BattleMap cells from authored data. Returns the cells plus any
 * warnings (unknown values, out-of-bounds entries) for dev/test visibility.
 */
export function buildCellsFromAuthoring(
  authored: AuthoredBattleMap,
  width: number,
  height: number,
): { cells: Record<string, Cell>; warnings: string[] } {
  const cells: Record<string, Cell> = {};
  const warnings: string[] = [];
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  for (const region of authored.regions ?? []) {
    const { from, to, ...rest } = region;
    const attrs = sanitizeAttrs(rest as CellAttrs, `region ${from.x},${from.y}-${to.x},${to.y}`, warnings);
    if (!attrs) continue;
    const x0 = Math.min(from.x, to.x);
    const x1 = Math.max(from.x, to.x);
    const y0 = Math.min(from.y, to.y);
    const y1 = Math.max(from.y, to.y);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (!inBounds(x, y)) {
          warnings.push(`Skipped out-of-bounds region cell ${x},${y}.`);
          continue;
        }
        applyAttrs(cells, x, y, attrs);
      }
    }
  }

  // Per-cell entries apply after regions so they can override region defaults.
  for (const cell of authored.terrain ?? []) {
    const { x, y, ...rest } = cell;
    if (!inBounds(x, y)) {
      warnings.push(`Skipped out-of-bounds terrain cell ${x},${y}.`);
      continue;
    }
    const attrs = sanitizeAttrs(rest as CellAttrs, `${x},${y}`, warnings);
    if (attrs) applyAttrs(cells, x, y, attrs);
  }

  return { cells, warnings };
}
