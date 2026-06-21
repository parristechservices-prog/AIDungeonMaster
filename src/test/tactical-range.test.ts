import { describe, expect, it } from 'vitest';
import {
  checkMeleeReach,
  checkRange,
  distanceFt,
  lineOfSight,
  resolveFalling,
  targetsInRange,
} from '@/lib/engine/spatial/tactical';
import type { BattleMap, Cell, SpatialActor } from '@/lib/engine/spatial/tactical';

function spatialActor(id: string, faction: SpatialActor['faction'], over: Partial<SpatialActor> = {}): SpatialActor {
  return {
    id, faction, size: 'medium', speedFt: 30, reachFt: 5,
    movementSpentFt: 0, extraMovementFt: 0, actionUsed: false, bonusActionUsed: false,
    reactionAvailable: true, disengaged: false, prone: false, flying: false, ...over,
  };
}

function makeMap(cells: Record<string, Cell> = {}): BattleMap {
  return { gridType: 'square', cellSizeFt: 5, width: 10, height: 10, diagonalMode: 'simple_5ft', cells, positions: {}, actors: {} };
}

function place(map: BattleMap, a: SpatialActor, x: number, y: number, z = 0): BattleMap {
  return { ...map, actors: { ...map.actors, [a.id]: a }, positions: { ...map.positions, [a.id]: { x, y, z } } };
}

describe('melee reach and ranged range', () => {
  it('melee succeeds when the target is within reach', () => {
    let map = makeMap();
    map = place(map, spatialActor('hero', 'party', { reachFt: 5 }), 0, 0);
    map = place(map, spatialActor('goblin', 'monster'), 1, 0);
    expect(checkMeleeReach(map, 'hero', 'goblin').ok).toBe(true);
  });

  it('melee fails when the target is out of reach', () => {
    let map = makeMap();
    map = place(map, spatialActor('hero', 'party', { reachFt: 5 }), 0, 0);
    map = place(map, spatialActor('goblin', 'monster'), 2, 0);
    const check = checkMeleeReach(map, 'hero', 'goblin');
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('out_of_reach');
    expect(check.distanceFt).toBe(10);
  });

  it('ranged succeeds within range and fails outside it', () => {
    let map = makeMap();
    map = place(map, spatialActor('archer', 'party'), 0, 0);
    map = place(map, spatialActor('goblin', 'monster'), 3, 0); // 15 ft
    expect(checkRange(map, 'archer', 'goblin', 30).ok).toBe(true);
    const tooFar = checkRange(map, 'archer', 'goblin', 10);
    expect(tooFar.ok).toBe(false);
    expect(tooFar.reason).toBe('out_of_range');
  });

  it('query_targets_in_range respects distance', () => {
    let map = makeMap();
    map = place(map, spatialActor('archer', 'party'), 0, 0);
    map = place(map, spatialActor('near', 'monster'), 2, 0); // 10 ft
    map = place(map, spatialActor('far', 'monster'), 6, 0); // 30 ft
    const ids = targetsInRange(map, 'archer', 15).map((t) => t.id);
    expect(ids).toEqual(['near']);
  });
});

describe('line of sight and cover', () => {
  it('reports a clear line of sight with no cover when nothing blocks', () => {
    const sight = lineOfSight(makeMap(), { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(sight.hasLineOfSight).toBe(true);
    expect(sight.cover).toBe('none');
  });

  it('a sight-blocking wall blocks line of sight (total cover)', () => {
    const map = makeMap({ '1,0': { terrain: 'normal', blocksSight: true } });
    const sight = lineOfSight(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(sight.hasLineOfSight).toBe(false);
    expect(sight.cover).toBe('total');
  });

  it('a see-through movement blocker grants half cover', () => {
    const map = makeMap({ '1,0': { terrain: 'normal', blocksMovement: true } });
    const sight = lineOfSight(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(sight.hasLineOfSight).toBe(true);
    expect(sight.cover).toBe('half');
  });

  it('total cover prevents ranged targeting', () => {
    let map = makeMap({ '1,0': { terrain: 'normal', blocksSight: true } });
    map = place(map, spatialActor('archer', 'party'), 0, 0);
    map = place(map, spatialActor('goblin', 'monster'), 2, 0);
    const check = checkRange(map, 'archer', 'goblin', 30);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('no_line_of_sight');
  });
});

describe('z-axis: distance and falling', () => {
  it('counts vertical separation in distance', () => {
    const map = makeMap();
    expect(distanceFt(map, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 30 })).toBe(30);
  });

  it('resolves a fall to the floor with 5e fall damage', () => {
    let map = makeMap();
    map = place(map, spatialActor('flyer', 'party'), 2, 2, 30);
    const { map: next, result } = resolveFalling(map, 'flyer');
    expect(result.fell).toBe(true);
    expect(result.distanceFt).toBe(30);
    expect(result.damageDiceD6).toBe(3);
    expect(next.positions.flyer.z).toBe(0);
    expect(next.actors.flyer.prone).toBe(true);
  });

  it('does not fall while flying', () => {
    let map = makeMap();
    map = place(map, spatialActor('flyer', 'party', { flying: true }), 2, 2, 30);
    expect(resolveFalling(map, 'flyer').result.fell).toBe(false);
  });
});
