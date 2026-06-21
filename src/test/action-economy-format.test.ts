import { describe, expect, it } from 'vitest';
import { actionEconomyRows } from '@/lib/play/dev-panel-format';
import { dash, type BattleMap, type SpatialActor } from '@/lib/engine/spatial/tactical';

function actor(id: string, faction: SpatialActor['faction'], over: Partial<SpatialActor> = {}): SpatialActor {
  return {
    id, faction, size: 'medium', speedFt: 30, reachFt: 5, movementSpentFt: 0, extraMovementFt: 0,
    actionUsed: false, bonusActionUsed: false, reactionAvailable: true, disengaged: false, prone: false, flying: false, ...over,
  };
}

function map(actors: SpatialActor[]): BattleMap {
  return {
    gridType: 'square', cellSizeFt: 5, width: 8, height: 6, diagonalMode: 'simple_5ft', cells: {},
    positions: Object.fromEntries(actors.map((a, i) => [a.id, { x: i, y: 0, z: 0 }])),
    actors: Object.fromEntries(actors.map((a) => [a.id, a])),
  };
}

describe('action economy rows', () => {
  it('returns a row per actor with movement and economy state', () => {
    const m = map([actor('hero', 'party'), actor('gob', 'monster', { movementSpentFt: 10, prone: true })]);
    const rows = actionEconomyRows(m, (id) => (id === 'hero' ? 'Hero' : 'Goblin'));
    expect(rows).toHaveLength(2);
    const hero = rows.find((r) => r.id === 'hero')!;
    expect(hero).toMatchObject({ name: 'Hero', faction: 'party', movementSpentFt: 0, movementRemainingFt: 30, actionUsed: false, reactionAvailable: true });
    const gob = rows.find((r) => r.id === 'gob')!;
    expect(gob.movementSpentFt).toBe(10);
    expect(gob.movementRemainingFt).toBe(20); // 30 speed - 10 spent
    expect(gob.prone).toBe(true);
  });

  it('reflects turn-to-turn state changes (Dash adds movement, consumes action)', () => {
    const m = map([actor('hero', 'party')]);
    const dashed = dash(m, 'hero').map;
    const row = actionEconomyRows(dashed, () => 'Hero')[0];
    expect(row.movementRemainingFt).toBe(60);
    expect(row.actionUsed).toBe(true);
  });

  it('marks unconscious combatants and active actor state correctly', () => {
    const m = map([
      actor('hero', 'party'),
      actor('orc', 'monster', { actionUsed: true }),
    ]);
    const rows = actionEconomyRows(m, (id) => (id === 'hero' ? 'Hero' : 'Orc'), 'orc', (id) => id === 'hero');
    const hero = rows.find((r) => r.id === 'hero')!;
    const orc = rows.find((r) => r.id === 'orc')!;

    expect(hero.unconscious).toBe(true);
    expect(hero.active).toBe(false);
    expect(orc.unconscious).toBe(false);
    expect(orc.active).toBe(true);
    expect(orc.actionUsed).toBe(true);
  });

  it('returns nothing when there is no battle map', () => {
    expect(actionEconomyRows(undefined, (id) => id)).toEqual([]);
  });
});
