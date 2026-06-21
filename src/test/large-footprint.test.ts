import { describe, expect, it } from 'vitest';
import {
  occupantAt,
  resolveMove,
  detectOpportunityAttacks,
  checkMeleeReach,
  lineOfSight,
  creatureSightBlockers,
  actorFootprint,
  SquareGridAdapter,
} from '@/lib/engine/spatial/tactical';
import type { BattleMap, Cell, GridCoord, SpatialActor } from '@/lib/engine/spatial/tactical';

function actor(id: string, faction: SpatialActor['faction'], over: Partial<SpatialActor> = {}): SpatialActor {
  return {
    id, faction, size: 'medium', speedFt: 30, reachFt: 5, movementSpentFt: 0, extraMovementFt: 0,
    actionUsed: false, bonusActionUsed: false, reactionAvailable: true, disengaged: false, prone: false, flying: false, ...over,
  };
}

function makeMap(over: Partial<BattleMap> = {}): BattleMap {
  return { gridType: 'square', cellSizeFt: 5, width: 12, height: 6, diagonalMode: 'simple_5ft', cells: {}, positions: {}, actors: {}, ...over };
}

function place(map: BattleMap, a: SpatialActor, x: number, y: number): BattleMap {
  return { ...map, actors: { ...map.actors, [a.id]: a }, positions: { ...map.positions, [a.id]: { x, y, z: 0 } } };
}

describe('Large creature occupancy', () => {
  it('occupies all four cells of its 2x2 footprint, not just the anchor', () => {
    let map = makeMap();
    map = place(map, actor('ogre', 'monster', { size: 'large' }), 2, 2);
    expect(actorFootprint(map, 'ogre').map((c) => `${c.x},${c.y}`).sort()).toEqual(['2,2', '2,3', '3,2', '3,3']);
    // a non-anchor cell reports the ogre as occupant
    expect(occupantAt(map, { x: 3, y: 3, z: 0 })).toBe('ogre');
    expect(occupantAt(map, { x: 2, y: 2, z: 0 })).toBe('ogre');
  });
});

describe('Large creature movement', () => {
  it('cannot squeeze through a 1-wide gap a Medium creature could pass', () => {
    // Wall row at y=0 and y=2 leaving a 1-cell-tall corridor at y=1.
    const cells: Record<string, Cell> = {};
    for (let x = 0; x < 12; x++) { cells[`${x},0`] = { terrain: 'blocked', blocksMovement: true }; cells[`${x},2`] = { terrain: 'blocked', blocksMovement: true }; }
    let map = makeMap({ height: 3, cells });
    // Medium passes the 1-tall corridor.
    map = place(map, actor('scout', 'party'), 0, 1);
    expect(resolveMove(map, 'scout', { x: 4, y: 1 }).result.ok).toBe(true);
    // Large (2x2) cannot — its second row would overlap the wall.
    let big = makeMap({ height: 3, cells });
    big = place(big, actor('ogre', 'monster', { size: 'large' }), 0, 1);
    const moved = resolveMove(big, 'ogre', { x: 4, y: 1 });
    expect(moved.result.ok).toBe(false);
  });

  it('cannot end a move where any footprint cell overlaps a blocked cell', () => {
    let map = makeMap({ cells: { '5,2': { terrain: 'blocked', blocksMovement: true } } });
    map = place(map, actor('ogre', 'monster', { size: 'large' }), 0, 1);
    // Anchor (4,1) would put footprint over (5,2) which is blocked.
    const moved = resolveMove(map, 'ogre', { x: 4, y: 1 });
    expect(moved.result.ok).toBe(false);
    expect(moved.result.reason).toBe('blocked');
  });

  it('cannot end a move overlapping another creature with any footprint cell', () => {
    let map = makeMap();
    map = place(map, actor('ogre', 'monster', { size: 'large' }), 0, 1);
    map = place(map, actor('hero', 'party'), 5, 2);
    // Anchor (4,1) footprint includes (5,2) where the hero stands.
    const moved = resolveMove(map, 'ogre', { x: 4, y: 1 });
    expect(moved.result.ok).toBe(false);
    expect(moved.result.reason).toBe('occupied');
  });
});

describe('Large creature reach and opportunity attacks', () => {
  it('is adjacent to cells next to any of its footprint cells', () => {
    let map = makeMap();
    map = place(map, actor('ogre', 'monster', { size: 'large', reachFt: 5 }), 2, 2);
    // hero at (4,3): nearest footprint cell is (3,3) -> 5 ft, in reach
    map = place(map, actor('hero', 'party'), 4, 3);
    expect(checkMeleeReach(map, 'ogre', 'hero').ok).toBe(true);
  });

  it('triggers an OA when leaving the expanded reach of a Large creature', () => {
    let map = makeMap();
    map = place(map, actor('ogre', 'monster', { size: 'large', reachFt: 5 }), 2, 2);
    // hero starts adjacent to the (3,3) corner, then moves far away.
    map = place(map, actor('hero', 'party'), 4, 4);
    const adapter = new SquareGridAdapter('simple_5ft');
    const path: GridCoord[] = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }];
    expect(detectOpportunityAttacks(map, adapter, 'hero', path)).toEqual(['ogre']);
  });
});

describe('Large creature blocks line of sight', () => {
  it('blocks sight through a non-anchor footprint cell', () => {
    let map = makeMap();
    // ogre anchored at (2,1): footprint covers (2,1),(3,1),(2,2),(3,2)
    map = place(map, actor('ogre', 'monster', { size: 'large' }), 2, 1);
    map = place(map, actor('archer', 'party'), 0, 2);
    map = place(map, actor('target', 'monster'), 5, 2);
    // Sight line from (0,2) to (5,2) passes through (2,2)/(3,2) — ogre's lower row.
    const blockers = creatureSightBlockers(map, ['archer', 'target']);
    expect(lineOfSight(map, { x: 0, y: 2 }, { x: 5, y: 2 }, blockers).hasLineOfSight).toBe(false);
  });
});
