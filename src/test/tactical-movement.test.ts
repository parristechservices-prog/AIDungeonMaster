import { describe, expect, it } from 'vitest';
import {
  dash,
  disengage,
  reachableCells,
  resolveMove,
  HexGridAdapter,
  SquareGridAdapter,
} from '@/lib/engine/spatial/tactical';
import type { BattleMap, Cell, GridCoord, SpatialActor } from '@/lib/engine/spatial/tactical';

function spatialActor(id: string, faction: SpatialActor['faction'], over: Partial<SpatialActor> = {}): SpatialActor {
  return {
    id,
    faction,
    size: 'medium',
    speedFt: 30,
    reachFt: 5,
    movementSpentFt: 0,
    extraMovementFt: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionAvailable: true,
    disengaged: false,
    prone: false,
    flying: false,
    ...over,
  };
}

function makeMap(over: Partial<BattleMap> = {}): BattleMap {
  return {
    gridType: 'square',
    cellSizeFt: 5,
    width: 10,
    height: 10,
    diagonalMode: 'simple_5ft',
    cells: {},
    positions: {},
    actors: {},
    ...over,
  };
}

function withActor(map: BattleMap, actor: SpatialActor, pos: GridCoord): BattleMap {
  return {
    ...map,
    actors: { ...map.actors, [actor.id]: actor },
    positions: { ...map.positions, [actor.id]: pos },
  };
}

function cell(over: Partial<Cell> = {}): Cell {
  return { terrain: 'normal', ...over };
}

describe('movement budget', () => {
  it('lets a 30 ft speed reach 6 normal squares but not 7', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    const reachable = new Set(reachableCells(map, 'hero').map((c) => `${c.coord.x},${c.coord.y}`));
    expect(reachable.has('6,0')).toBe(true);
    expect(reachable.has('7,0')).toBe(false);
  });

  it('resolves a legal move and tracks spent/remaining movement', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    const { map: next, result } = resolveMove(map, 'hero', { x: 6, y: 0 });
    expect(result.ok).toBe(true);
    expect(result.movementSpentFt).toBe(30);
    expect(result.movementRemainingFt).toBe(0);
    expect(next.positions.hero).toEqual({ x: 6, y: 0 });
    // input map is not mutated
    expect(map.positions.hero).toEqual({ x: 0, y: 0 });
  });

  it('reports insufficient movement (and required distance) for a too-far move', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    const { result } = resolveMove(map, 'hero', { x: 7, y: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_movement');
    expect(result.requiredDashFt).toBe(35);
  });
});

describe('dash and difficult terrain', () => {
  it('dash adds movement equal to speed and consumes the action', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    const { map: dashed, result } = dash(map, 'hero');
    expect(result.ok).toBe(true);
    expect(result.movementRemainingFt).toBe(60);
    expect(dashed.actors.hero.actionUsed).toBe(true);
    // now the 7th square is reachable
    const reachable = new Set(reachableCells(dashed, 'hero').map((c) => `${c.coord.x},${c.coord.y}`));
    expect(reachable.has('7,0')).toBe(true);
    // a second dash fails (action already used)
    expect(dash(dashed, 'hero').result.ok).toBe(false);
  });

  it('difficult terrain costs double to enter', () => {
    // single-row corridor so the path can't diagonal around the difficult cell
    let map = makeMap({ width: 5, height: 1, cells: { '1,0': cell({ terrain: 'difficult' }) } });
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    const { result } = resolveMove(map, 'hero', { x: 2, y: 0 });
    expect(result.ok).toBe(true);
    // enter (1,0)=10 difficult + enter (2,0)=5 normal = 15
    expect(result.movementSpentFt).toBe(15);
  });
});

describe('blocked and occupied cells', () => {
  it('cannot enter a blocked cell', () => {
    let map = makeMap({ cells: { '1,0': cell({ terrain: 'blocked' }) } });
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    const { result } = resolveMove(map, 'hero', { x: 1, y: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('blocked');
  });

  it('cannot end movement in an occupied cell', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    map = withActor(map, spatialActor('ally', 'party'), { x: 2, y: 0 });
    const { result } = resolveMove(map, 'hero', { x: 2, y: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('occupied');
  });

  it('passes through an allied space at difficult-terrain cost', () => {
    // single-row corridor forces the path straight through the ally
    let map = makeMap({ width: 5, height: 1 });
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    map = withActor(map, spatialActor('ally', 'party'), { x: 2, y: 0 });
    const { result } = resolveMove(map, 'hero', { x: 4, y: 0 });
    expect(result.ok).toBe(true);
    // (1,0)=5 + (2,0)=10 ally-difficult + (3,0)=5 + (4,0)=5 = 25
    expect(result.movementSpentFt).toBe(25);
  });

  it('cannot pass through a hostile space', () => {
    let map = makeMap({ width: 5, height: 1 });
    map = withActor(map, spatialActor('hero', 'party'), { x: 0, y: 0 });
    map = withActor(map, spatialActor('ogre', 'monster'), { x: 2, y: 0 });
    const { result } = resolveMove(map, 'hero', { x: 4, y: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_path');
  });
});

describe('opportunity attacks', () => {
  it('triggers when leaving a hostile reach without disengaging', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party'), { x: 1, y: 0 });
    map = withActor(map, spatialActor('ogre', 'monster'), { x: 0, y: 0 });
    const { result } = resolveMove(map, 'hero', { x: 3, y: 0 });
    expect(result.ok).toBe(true);
    expect(result.opportunityAttacks).toEqual(['ogre']);
  });

  it('does not trigger after Disengage', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party'), { x: 1, y: 0 });
    map = withActor(map, spatialActor('ogre', 'monster'), { x: 0, y: 0 });
    const disengaged = disengage(map, 'hero').map;
    const { result } = resolveMove(disengaged, 'hero', { x: 3, y: 0 });
    expect(result.ok).toBe(true);
    expect(result.opportunityAttacks).toEqual([]);
  });

  it('does not trigger if the mover stays within reach', () => {
    let map = makeMap();
    map = withActor(map, spatialActor('hero', 'party', { reachFt: 5 }), { x: 0, y: 0 });
    map = withActor(map, spatialActor('ogre', 'monster', { reachFt: 10 }), { x: 0, y: 1 });
    // ogre has 10 ft reach (2 cells) from (0,1); moving to (2,0) stays within reach
    const { result } = resolveMove(map, 'hero', { x: 2, y: 0 });
    expect(result.opportunityAttacks).toEqual([]);
  });
});

describe('hex adapter', () => {
  it('computes axial neighbours and cube distance', () => {
    const hex = new HexGridAdapter();
    expect(hex.neighbors({ x: 0, y: 0 })).toHaveLength(6);
    expect(hex.distanceCells({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(2);
    expect(hex.distanceCells({ x: 0, y: 0 }, { x: -1, y: -1 })).toBe(2);
  });

  it('square adapter alternating diagonal costs differ from simple', () => {
    expect(new SquareGridAdapter('simple_5ft').diagonalStepCost(1)).toBe(1);
    expect(new SquareGridAdapter('alternating_5_10').diagonalStepCost(1)).toBe(2);
  });
});
