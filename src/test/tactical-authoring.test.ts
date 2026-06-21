import { describe, expect, it } from 'vitest';
import { buildCellsFromAuthoring, resolveMove, lineOfSight } from '@/lib/engine/spatial/tactical';
import type { AuthoredBattleMap, BattleMap, SpatialActor } from '@/lib/engine/spatial/tactical';
import { buildBattleMap, createInitialState } from '@/lib/game/state';
import { resolveEngineRequest } from '@/lib/engine';
import type { GameState } from '@/lib/game/types';

describe('authored battle-map parsing', () => {
  it('places difficult, blocked, blocksSight and cover cells', () => {
    const authored: AuthoredBattleMap = {
      width: 6,
      height: 6,
      terrain: [
        { x: 1, y: 1, terrain: 'difficult' },
        { x: 2, y: 2, terrain: 'blocked', blocksMovement: true, blocksSight: true },
        { x: 3, y: 3, cover: 'half' },
      ],
    };
    const { cells, warnings } = buildCellsFromAuthoring(authored, 6, 6);
    expect(cells['1,1'].terrain).toBe('difficult');
    expect(cells['2,2'].blocksMovement).toBe(true);
    expect(cells['2,2'].blocksSight).toBe(true);
    expect(cells['3,3'].cover).toBe('half');
    expect(warnings).toHaveLength(0);
  });

  it('expands regions across every cell in range', () => {
    const { cells } = buildCellsFromAuthoring(
      { width: 10, height: 10, regions: [{ from: { x: 1, y: 1 }, to: { x: 2, y: 3 }, terrain: 'difficult' }] },
      10,
      10,
    );
    // 2 wide x 3 tall = 6 cells
    const difficult = Object.values(cells).filter((c) => c.terrain === 'difficult');
    expect(difficult).toHaveLength(6);
    expect(cells['2,3'].terrain).toBe('difficult');
  });

  it('warns and skips out-of-bounds and unknown values rather than crashing', () => {
    const { cells, warnings } = buildCellsFromAuthoring(
      {
        width: 4,
        height: 4,
        terrain: [
          { x: 99, y: 0, terrain: 'difficult' },
          // @ts-expect-error intentionally invalid terrain value
          { x: 1, y: 1, terrain: 'lava' },
        ],
      },
      4,
      4,
    );
    expect(cells['99,0']).toBeUndefined();
    expect(warnings.some((w) => /out-of-bounds/.test(w))).toBe(true);
    expect(warnings.some((w) => /unknown terrain/.test(w))).toBe(true);
  });
});

describe('buildBattleMap with authored terrain', () => {
  function partyMonsterState(): GameState {
    const base = createInitialState('sess-auth', { adventureId: 'brindlehook-inn' });
    return {
      ...base,
      monsters: [{ id: 'goblin', name: 'Goblin', ac: 12, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }],
    };
  }

  it('uses authored dimensions and cells', () => {
    const authored: AuthoredBattleMap = {
      width: 10,
      height: 8,
      terrain: [{ x: 4, y: 2, terrain: 'blocked', blocksMovement: true }],
    };
    const map = buildBattleMap(partyMonsterState(), undefined, authored);
    expect(map.width).toBe(10);
    expect(map.height).toBe(8);
    expect(map.cells['4,2'].blocksMovement).toBe(true);
  });

  it('does not place an actor on a blocked cell', () => {
    // Block the whole party default column (x=1) so placement must relocate.
    const authored: AuthoredBattleMap = {
      width: 8,
      height: 6,
      regions: [{ from: { x: 1, y: 0 }, to: { x: 1, y: 5 }, terrain: 'blocked', blocksMovement: true }],
    };
    const map = buildBattleMap(partyMonsterState(), undefined, authored);
    for (const pos of Object.values(map.positions)) {
      expect(map.cells[`${pos.x},${pos.y}`]?.blocksMovement).not.toBe(true);
    }
  });

  it('falls back to a featureless 8x6 grid when no terrain is authored', () => {
    const map = buildBattleMap(partyMonsterState());
    expect(map.width).toBe(8);
    expect(map.height).toBe(6);
    expect(Object.keys(map.cells)).toHaveLength(0);
  });
});

describe('start_combat consumes authored encounter terrain', () => {
  it('builds the crypt battle map with its pillars and rubble', () => {
    const state = createInitialState('sess-crypt', { adventureId: 'crypt-of-whispers' });
    const { state: next } = resolveEngineRequest(state, { kind: 'start_combat' });
    const map = next.combat.battleMap!;
    expect(map.width).toBe(10);
    expect(map.height).toBe(8);
    expect(map.cells['4,2']?.blocksMovement).toBe(true);
    expect(map.cells['5,3']?.cover).toBe('half');
  });
});

describe('authored terrain affects movement and line of sight', () => {
  function actor(id: string, faction: SpatialActor['faction']): SpatialActor {
    return {
      id, faction, size: 'medium', speedFt: 30, reachFt: 5, movementSpentFt: 0, extraMovementFt: 0,
      actionUsed: false, bonusActionUsed: false, reactionAvailable: true, disengaged: false, prone: false, flying: false,
    };
  }

  it('blocks movement into authored blocked cells and sight through blocksSight cells', () => {
    const { cells } = buildCellsFromAuthoring(
      { width: 6, height: 1, terrain: [{ x: 2, y: 0, terrain: 'blocked', blocksMovement: true, blocksSight: true }] },
      6,
      1,
    );
    const map: BattleMap = {
      gridType: 'square', cellSizeFt: 5, width: 6, height: 1, diagonalMode: 'simple_5ft',
      cells, positions: { hero: { x: 0, y: 0, z: 0 } }, actors: { hero: actor('hero', 'party') },
    };
    expect(resolveMove(map, 'hero', { x: 2, y: 0 }).result.reason).toBe('blocked');
    expect(lineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 }).hasLineOfSight).toBe(false);
  });
});
