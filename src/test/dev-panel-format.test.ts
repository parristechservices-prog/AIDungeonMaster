import { describe, expect, it } from 'vitest';
import {
  engineResultDetail,
  formatCover,
  formatOpportunityAttack,
  formatRollBreakdown,
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

  it('formats opportunity attacks (hit, miss, and warning)', () => {
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: true, damage: 6 })).toMatch(/Ogre.*hits Hero for 6/);
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: false, damage: 0 })).toMatch(/misses Hero/);
    expect(formatOpportunityAttack({ attackerId: 'a', attackerName: 'Ogre', targetId: 't', targetName: 'Hero', hit: false, damage: 0, warning: 'no melee' })).toBe('no melee');
  });
});
