import { describe, expect, it } from 'vitest';
import { buildBattlemapView, interpretCellTap } from '@/lib/play/battlemap-view';
import type { BattleMap, Cell, SpatialActor } from '@/lib/engine/spatial/tactical';

function actor(id: string, faction: SpatialActor['faction'], over: Partial<SpatialActor> = {}): SpatialActor {
  return {
    id, faction, size: 'medium', speedFt: 30, reachFt: 5, movementSpentFt: 0, extraMovementFt: 0,
    actionUsed: false, bonusActionUsed: false, reactionAvailable: true, disengaged: false, prone: false, flying: false, ...over,
  };
}

function makeMap(over: Partial<BattleMap> = {}): BattleMap {
  return { gridType: 'square', cellSizeFt: 5, width: 8, height: 6, diagonalMode: 'simple_5ft', cells: {}, positions: {}, actors: {}, ...over };
}

function withActor(map: BattleMap, a: SpatialActor, x: number, y: number): BattleMap {
  return { ...map, actors: { ...map.actors, [a.id]: a }, positions: { ...map.positions, [a.id]: { x, y, z: 0 } } };
}

describe('battlemap view-model', () => {
  it('renders party and monster tokens at their positions', () => {
    let map = makeMap();
    map = withActor(map, actor('hero', 'party'), 1, 1);
    map = withActor(map, actor('gob', 'monster'), 5, 2);
    const view = buildBattlemapView(map);
    expect(view.tokens.find((t) => t.id === 'hero')).toMatchObject({ faction: 'party', x: 1, y: 1, span: 1 });
    expect(view.tokens.find((t) => t.id === 'gob')).toMatchObject({ faction: 'monster', x: 5, y: 2 });
    expect(view.cells).toHaveLength(8 * 6);
  });

  it('renders terrain (blocked/difficult), cover, and a Large 2x2 footprint', () => {
    const cells: Record<string, Cell> = {
      '2,2': { terrain: 'blocked', blocksSight: true },
      '3,2': { terrain: 'difficult' },
      '4,2': { terrain: 'normal', cover: 'half' },
    };
    let map = makeMap({ cells });
    map = withActor(map, actor('ogre', 'monster', { size: 'large' }), 0, 0);
    const view = buildBattlemapView(map);
    expect(view.cells.find((c) => c.x === 2 && c.y === 2)).toMatchObject({ terrain: 'blocked', blocksSight: true });
    expect(view.cells.find((c) => c.x === 3 && c.y === 2)?.terrain).toBe('difficult');
    expect(view.cells.find((c) => c.x === 4 && c.y === 2)?.cover).toBe('half');
    expect(view.tokens.find((t) => t.id === 'ogre')?.span).toBe(2);
  });

  it('marks selected token and lights up its reachable cells', () => {
    let map = makeMap();
    map = withActor(map, actor('hero', 'party'), 0, 0);
    const view = buildBattlemapView(map, { selectedId: 'hero', currentTurnId: 'hero' });
    const hero = view.tokens.find((t) => t.id === 'hero')!;
    expect(hero.isSelected).toBe(true);
    expect(hero.isCurrentTurn).toBe(true);
    // 30 ft speed reaches (6,0); never marks the occupied origin.
    expect(view.cells.find((c) => c.x === 6 && c.y === 0)?.reachable).toBe(true);
    expect(view.cells.find((c) => c.x === 7 && c.y === 0)?.reachable).toBe(false);
  });
});

describe('battlemap interaction (suggestions only — never mutates state)', () => {
  it('selects a token when tapping it with nothing selected', () => {
    let map = makeMap();
    map = withActor(map, actor('hero', 'party'), 1, 1);
    expect(interpretCellTap(map, undefined, 1, 1)).toEqual({ kind: 'select_token', actorId: 'hero' });
  });

  it('does nothing tapping empty ground with nothing selected', () => {
    const map = withActor(makeMap(), actor('hero', 'party'), 1, 1);
    expect(interpretCellTap(map, undefined, 4, 4).kind).toBe('noop');
  });

  it('suggests a move (not a mutation) when tapping a reachable empty cell', () => {
    const map = withActor(makeMap(), actor('hero', 'party'), 0, 0);
    const r = interpretCellTap(map, 'hero', 3, 0);
    expect(r.kind).toBe('suggest_move');
    if (r.kind === 'suggest_move') expect(r.command).toContain('moves to (3,0)');
  });

  it('does not suggest a move to an unreachable cell', () => {
    const map = withActor(makeMap({ width: 14, height: 3 }), actor('hero', 'party'), 0, 0);
    expect(interpretCellTap(map, 'hero', 12, 0).kind).toBe('noop'); // 60 ft away, speed 30
  });

  it('suggests an attack when tapping a hostile token', () => {
    let map = makeMap();
    map = withActor(map, actor('hero', 'party'), 1, 1);
    map = withActor(map, actor('gob', 'monster'), 2, 1);
    const r = interpretCellTap(map, 'hero', 2, 1);
    expect(r.kind).toBe('suggest_attack');
    if (r.kind === 'suggest_attack') expect(r.targetId).toBe('gob');
  });

  it('reselects when tapping an allied token', () => {
    let map = makeMap();
    map = withActor(map, actor('hero', 'party'), 1, 1);
    map = withActor(map, actor('cleric', 'party'), 2, 1);
    expect(interpretCellTap(map, 'hero', 2, 1)).toEqual({ kind: 'select_token', actorId: 'cleric' });
  });

  it('treats out-of-bounds taps as no-ops', () => {
    const map = withActor(makeMap(), actor('hero', 'party'), 0, 0);
    expect(interpretCellTap(map, 'hero', 99, 99).kind).toBe('noop');
  });
});
