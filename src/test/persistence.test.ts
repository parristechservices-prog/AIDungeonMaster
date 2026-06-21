import { describe, expect, it } from 'vitest';
import { pruneCanonLog } from '@/lib/llm/summarizer';
import type { CanonFact } from '@/lib/game/types';
import {
  getOrCreateSession,
  saveSession,
  saveRecap,
  getRecaps,
  getLatestRecap,
  getSessionStorageMode,
} from '@/lib/orchestrator/session-store';
import type { PartyQuestRecap } from '@/lib/game/recap';

function fact(id: string, importance: CanonFact['importance']): CanonFact {
  return { id, content: `fact ${id}`, importance };
}

describe('pruneCanonLog', () => {
  it('keeps all high, recent medium, recent low, in original order', () => {
    const log: CanonFact[] = [
      fact('h1', 'high'),
      ...Array.from({ length: 50 }, (_, i) => fact(`m${i}`, 'medium')),
      ...Array.from({ length: 20 }, (_, i) => fact(`l${i}`, 'low')),
      fact('h2', 'high'),
    ];
    const pruned = pruneCanonLog(log, { keepMedium: 40, keepLow: 10 });
    expect(pruned.filter((f) => f.importance === 'high')).toHaveLength(2);
    expect(pruned.filter((f) => f.importance === 'medium')).toHaveLength(40);
    expect(pruned.filter((f) => f.importance === 'low')).toHaveLength(10);
    // Order preserved: h1 before any medium, h2 last.
    expect(pruned[0].id).toBe('h1');
    expect(pruned[pruned.length - 1].id).toBe('h2');
    // Kept the most RECENT low facts.
    expect(pruned.some((f) => f.id === 'l19')).toBe(true);
    expect(pruned.some((f) => f.id === 'l0')).toBe(false);
  });

  it('leaves a small log untouched', () => {
    const log = [fact('a', 'low'), fact('b', 'medium')];
    expect(pruneCanonLog(log)).toEqual(log);
  });
});

describe('session-store (in-memory path, no DATABASE_URL)', () => {
  it('reports memory mode without a DB', () => {
    expect(getSessionStorageMode()).toBe('memory');
  });

  it('round-trips state and recaps through the cache', async () => {
    const sid = `test-${Math.floor(performance.now())}-a`;
    const state = await getOrCreateSession(sid);
    expect(state.sessionId).toBe(sid);

    state.party[0].hp = 7;
    await saveSession(state);
    const reloaded = await getOrCreateSession(sid);
    expect(reloaded.party[0].hp).toBe(7);

    const recap = { sessionId: sid, turnNumber: 1, narration: 'hello' } as unknown as PartyQuestRecap;
    await saveRecap(sid, recap);
    expect(await getRecaps(sid)).toHaveLength(1);
    expect((await getLatestRecap(sid))?.turnNumber).toBe(1);
  });
});
