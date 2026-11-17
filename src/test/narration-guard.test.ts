import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { guardNarration } from '@/lib/llm/narration-guard';

function stateWithHp() {
  const s = createInitialState('guard');
  const p = s.party.find((x) => x.id === s.activeCharacterId) ?? s.party[0];
  return { s, p };
}

describe('guardNarration', () => {
  it('passes clean narration through untouched', async () => {
    const { s } = stateWithHp();
    const out = await guardNarration('The door creaks open.', s, ['Opened door.']);
    expect(out).toEqual({ narration: 'The door creaks open.', warnings: [], source: 'original' });
  });

  it('uses a clean rewrite when the first draft contradicts state', async () => {
    const { s, p } = stateWithHp();
    const bad = `${p.name} staggers, now at 999/999 HP.`;
    const out = await guardNarration(bad, s, ['Hit for 3.'], async () => `${p.name} staggers but stays standing.`);
    expect(out.source).toBe('rewritten');
    expect(out.narration).toContain('stays standing');
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it('falls back to engine summaries when the rewrite is still wrong', async () => {
    const { s, p } = stateWithHp();
    const bad = `${p.name} staggers, now at 999/999 HP.`;
    const out = await guardNarration(bad, s, ['Hit for 3.', 'Goblin misses.'], async () => bad);
    expect(out.source).toBe('fallback');
    expect(out.narration).toBe('Hit for 3. Goblin misses.');
  });

  it('falls back when no rewriter is available or it throws', async () => {
    const { s, p } = stateWithHp();
    const bad = `${p.name} staggers, now at 999/999 HP.`;
    expect((await guardNarration(bad, s, ['Hit.'])).source).toBe('fallback');
    const thrown = await guardNarration(bad, s, ['Hit.'], async () => { throw new Error('down'); });
    expect(thrown.source).toBe('fallback');
  });
});
