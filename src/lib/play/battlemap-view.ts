// Pure view-model + interaction helpers for the player-facing battlemap. This is
// the deterministic core of the visual battlemap: it transforms the engine's
// existing BattleMap state into renderable cells/tokens and turns a tap on a
// cell into a SUGGESTED command string — it never mutates game state. All real
// state changes still flow through the engine/turn API.

import { getCell, occupantAt, sizeSpan } from '@/lib/engine/spatial/tactical';
import { reachableCells } from '@/lib/engine/spatial/tactical';
import type { BattleMap, Cell, CoverKind, TerrainKind } from '@/lib/engine/spatial/tactical';

export type TokenView = {
  id: string;
  faction: 'party' | 'monster' | 'npc';
  x: number;
  y: number;
  /** Footprint span in cells (1 = medium/small, 2 = large, etc.). */
  span: number;
  isCurrentTurn: boolean;
  isSelected: boolean;
};

export type CellView = {
  x: number;
  y: number;
  terrain: TerrainKind;
  cover: CoverKind;
  blocksSight: boolean;
  /** Reachable by the selected actor this turn (for a movement-range overlay). */
  reachable: boolean;
};

export type BattlemapView = {
  width: number;
  height: number;
  cells: CellView[];
  tokens: TokenView[];
};

/**
 * Builds the full render model for a battle map. `selectedId` highlights one
 * token and lights up its reachable cells; `currentTurnId` marks the active
 * actor. Reachability reuses the engine's pathfinder — the UI never computes it.
 */
export function buildBattlemapView(
  map: BattleMap,
  opts: { selectedId?: string; currentTurnId?: string } = {},
): BattlemapView {
  const reachableKeys = new Set<string>();
  if (opts.selectedId && map.actors[opts.selectedId]) {
    for (const c of reachableCells(map, opts.selectedId)) reachableKeys.add(`${c.coord.x},${c.coord.y}`);
  }

  const cells: CellView[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const cell: Cell = getCell(map, { x, y });
      cells.push({
        x,
        y,
        terrain: cell.terrain,
        cover: cell.cover ?? 'none',
        blocksSight: cell.blocksSight === true,
        reachable: reachableKeys.has(`${x},${y}`),
      });
    }
  }

  const tokens: TokenView[] = Object.values(map.actors).map((a) => {
    const pos = map.positions[a.id] ?? { x: 0, y: 0 };
    return {
      id: a.id,
      faction: a.faction,
      x: pos.x,
      y: pos.y,
      span: sizeSpan(a.size),
      isCurrentTurn: a.id === opts.currentTurnId,
      isSelected: a.id === opts.selectedId,
    };
  });

  return { width: map.width, height: map.height, cells, tokens };
}

export type CellInteraction =
  | { kind: 'select_token'; actorId: string }
  | { kind: 'suggest_move'; actorId: string; x: number; y: number; command: string }
  | { kind: 'suggest_attack'; actorId: string; targetId: string; command: string }
  | { kind: 'noop'; reason: string };

/**
 * Turns an interaction into a human-readable command the player can review and
 * send (e.g. "Move Seren to (3,0)"). Returns null for select/noop interactions.
 * `nameOf` resolves an actor id to a display name. Suggestion text only — the
 * engine still validates the action when the player sends it.
 */
export function toDisplayCommand(interaction: CellInteraction, nameOf: (id: string) => string): string | null {
  switch (interaction.kind) {
    case 'suggest_move':
      return `Move ${nameOf(interaction.actorId)} to (${interaction.x}, ${interaction.y})`;
    case 'suggest_attack':
      return `${nameOf(interaction.actorId)} attacks ${nameOf(interaction.targetId)}`;
    default:
      return null;
  }
}

/**
 * Interprets a tap on cell (x,y) given the currently-selected token. Returns a
 * SUGGESTION only — it produces a command string the player can send through the
 * normal turn API; it never changes engine state itself. Clicking an empty cell
 * with no selection selects nothing; clicking a token selects it; clicking a
 * reachable empty cell suggests a move; clicking a hostile suggests an attack.
 */
export function interpretCellTap(
  map: BattleMap,
  selectedId: string | undefined,
  x: number,
  y: number,
): CellInteraction {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return { kind: 'noop', reason: 'out_of_bounds' };
  }
  const occupant = occupantAt(map, { x, y });

  // No selection yet: a tap on a token selects it, otherwise nothing happens.
  if (!selectedId) {
    return occupant ? { kind: 'select_token', actorId: occupant } : { kind: 'noop', reason: 'nothing_selected' };
  }

  const selected = map.actors[selectedId];
  if (!selected) return { kind: 'noop', reason: 'unknown_selection' };

  // Tapping another token: hostile → suggest attack; ally/self → reselect.
  if (occupant && occupant !== selectedId) {
    const other = map.actors[occupant];
    const hostile = !!other && (selected.faction === 'party') !== (other.faction === 'party');
    if (hostile) {
      return { kind: 'suggest_attack', actorId: selectedId, targetId: occupant, command: `${selectedId} attacks ${occupant}` };
    }
    return { kind: 'select_token', actorId: occupant };
  }
  if (occupant === selectedId) return { kind: 'select_token', actorId: selectedId };

  // Empty cell: only suggest a move if the engine says it's reachable.
  const reachable = new Set(reachableCells(map, selectedId).map((c) => `${c.coord.x},${c.coord.y}`));
  if (reachable.has(`${x},${y}`)) {
    return { kind: 'suggest_move', actorId: selectedId, x, y, command: `${selectedId} moves to (${x},${y})` };
  }
  return { kind: 'noop', reason: 'unreachable' };
}
