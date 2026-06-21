// Tactical (in-combat) spatial model. Separate state machine from the
// exploration ExplorationState: a BattleMap only exists while combat is active.
//
// Pure data only — no functions, no I/O. Geometry/movement/range logic lives in
// sibling modules and is written against the SpatialAdapter interface so the
// same engine requests work for square grids today and hex/zone later.

export type GridType = 'square' | 'hex';

/**
 * A position on a battle map. `z` is elevation in FEET (not cells), 0 = ground.
 * Keeping z in feet keeps flying/falling math in the same unit as speed/range.
 */
export interface GridCoord {
  x: number;
  y: number;
  z?: number;
}

export type TerrainKind =
  | 'normal'
  | 'difficult'
  | 'blocked'
  | 'hazard'
  | 'water'
  | 'climb'
  | 'squeeze';

export type CoverKind = 'none' | 'half' | 'three_quarters' | 'total';

export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

export type Faction = 'party' | 'monster' | 'npc';

/** Simplified-5e (diagonal = 1 square) vs the DMG variant (5/10/5...). */
export type DiagonalMode = 'simple_5ft' | 'alternating_5_10';

export interface Cell {
  terrain: TerrainKind;
  /** Static cover a creature standing in this cell gains (e.g. behind a battlement). */
  cover?: CoverKind;
  /** Floor height of the cell in feet (ledges, raised platforms). Default 0. */
  elevationFt?: number;
  /** Walls/objects that stop movement even if terrain isn't 'blocked'. */
  blocksMovement?: boolean;
  /** Walls/objects that stop line of sight (also grants cover to things behind). */
  blocksSight?: boolean;
}

/** Per-combat spatial/action-economy data for one creature. */
export interface SpatialActor {
  id: string;
  faction: Faction;
  size: CreatureSize;
  speedFt: number;
  reachFt: number;
  /** Movement already spent THIS turn. Reset at the start of the actor's turn. */
  movementSpentFt: number;
  /** Extra movement granted this turn (Dash adds speedFt here). */
  extraMovementFt: number;
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionAvailable: boolean;
  /** Set by Disengage: suppresses opportunity attacks until the turn ends. */
  disengaged: boolean;
  prone: boolean;
  /** Creature is airborne under its own power (no falling while true). */
  flying: boolean;
}

export interface BattleMap {
  gridType: GridType;
  cellSizeFt: number;
  width: number;
  height: number;
  diagonalMode: DiagonalMode;
  /** Sparse terrain overrides keyed by "x,y". Missing cells are normal ground. */
  cells: Record<string, Cell>;
  positions: Record<string, GridCoord>;
  actors: Record<string, SpatialActor>;
}
