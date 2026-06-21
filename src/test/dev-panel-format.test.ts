import { describe, expect, it } from 'vitest';
import {
  coverBadge,
  engineResultDetail,
  formatCover,
  formatCoverDetail,
  formatOpportunityAttack,
  formatRollBreakdown,
  terrainLegendFor,
  terrainStyle,
} from '@/lib/play/dev-panel-format';
import type { EngineResultView } from '@/lib/play/dev-panel-format';

describe('engine result formatting', () => {
  it('formats a dice breakdown with rolls, DC and pass/fail', () => {
    const line = formatRollBreakdown({ formula: '1d20+4', rolls: [13], modifier: 4, total: 17, dc: 15, ok: true });
    expect(line).toContain('1d20+4');
    expect(line).toContain('17');
    expect(line).toContain('DC 15');
    expect(line).toContain('✓');
  });

  it('reports which optional detail sections a result carries', () => {
    const bare: EngineResultView = { kind: 'skill_check', summary: 'ok', ok: true };
    expect(engineResultDetail(bare)).toEqual({ hasBreakdown: false, hasTactical: false, hasCover: false, opportunityAttackCount: 0 });

    const rich: EngineResultView = {
      kind: 'move_creature',
      summary: 'moved',
      ok: true,
      breakdown: { formula: '1d20', rolls: [10], modifier: 0, total: 10 },
      cover: { kind: 'half', baseAc: 12, bonus: 2, effectiveAc: 14 },
      tactical: { kind: 'query_reachable', cells: [] },
      opportunityAttacks: [
        { attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: true, damage: 6 },
      ],
    };
    expect(engineResultDetail(rich)).toEqual({ hasBreakdown: true, hasTactical: true, hasCover: true, opportunityAttackCount: 1 });
  });

  it('formats cover and total-cover distinctly', () => {
    expect(formatCover({ kind: 'half', baseAc: 12, bonus: 2, effectiveAc: 14 })).toBe('half cover: AC 12 + 2 = 14');
    expect(formatCover({ kind: 'total', baseAc: 12, bonus: 0, effectiveAc: 12 })).toMatch(/total cover/i);
  });

  it('formats cover details with none, half, three-quarters, and total cover', () => {
    expect(formatCoverDetail({ kind: 'none', baseAc: 10, bonus: 0, effectiveAc: 10 })).toBe('no cover — base AC 10, effective AC 10');
    expect(formatCoverDetail({ kind: 'half', baseAc: 12, bonus: 2, effectiveAc: 14 })).toBe('half cover — base AC 12, bonus +2, effective AC 14');
    expect(formatCoverDetail({ kind: 'three_quarters', baseAc: 13, bonus: 5, effectiveAc: 18 })).toBe('three-quarters cover — base AC 13, bonus +5, effective AC 18');
    expect(formatCoverDetail({ kind: 'total', baseAc: 12, bonus: 0, effectiveAc: 12 })).toBe('Total cover / blocked line of sight — base AC 12, effective AC 12');
  });

  it('produces terrain style labels and cover badges for legend display', () => {
    expect(terrainStyle('difficult')).toEqual(expect.objectContaining({ label: 'Difficult' }));
    expect(terrainStyle('normal')).toEqual(expect.objectContaining({ label: 'Normal', className: '' }));
    expect(coverBadge('half')).toBe('½');
    expect(coverBadge('total')).toBe('■');
  });

  it('builds a terrain legend from a map including cover entries', () => {
    const map = {
      gridType: 'square', cellSizeFt: 5, width: 2, height: 2, diagonalMode: 'simple_5ft',
      cells: {
        '0,0': { terrain: 'difficult' },
        '1,0': { terrain: 'normal', cover: 'half' },
      },
      positions: {},
      actors: {},
    };
    const legend = terrainLegendFor(map as import('@/lib/engine/spatial/tactical').BattleMap);
    expect(legend).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Difficult' }),
        expect.objectContaining({ label: 'half cover ½' }),
      ]),
    );
  });

  it('formats opportunity attacks (hit, miss, and warning)', () => {
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: true, damage: 6 })).toMatch(/Ogre.*hits Hero for 6/);
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: true, damage: 6 })).toMatch(/damage.*6|for 6/);
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: false, damage: 0 })).toMatch(/misses Hero/);
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: true, damage: 6, breakdown: { formula: '1d20+5', rolls: [12], modifier: 5, total: 17 } })).toMatch(/roll 17/);
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: false, damage: 0, warning: 'no melee' })).toBe('no melee');
  });
});
