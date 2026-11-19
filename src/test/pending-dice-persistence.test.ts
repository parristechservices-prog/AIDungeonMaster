import { expect, it, vi } from 'vitest';

const stored = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@/lib/db/client', () => {
  const db = Object.assign(
    async (parts: TemplateStringsArray, sessionId: string, state?: unknown) => {
      const query = parts.join('?');
      if (query.includes('insert into sessions')) stored.set(sessionId, structuredClone(state));
      if (query.includes('select state') && stored.has(sessionId)) return [{ state: stored.get(sessionId) }];
      if (query.includes('select count')) return [{ n: 0 }];
      return [];
    },
    { json: (state: unknown) => state },
  );
  return { getDb: () => db, hasDb: () => true };
});

it('restores pending dice after the process cache is discarded and removes it once consumed', async () => {
  const first = await import('@/lib/orchestrator/session-store');
  const sessionId = 'persist-physical-dice';
  const state = await first.getOrCreateSession(sessionId);
  const pending = {
    rollId: 'roll-1',
    context: { kind: 'skill_check' as const, formula: '1d20' },
    playerInput: 'Inspect the tracks',
    turn: { engineRequests: [], narration: 'You examine the tracks.', needsResultBeforeNarrating: false },
    aiUsed: false,
    fallbackUsed: true,
    systemPrompt: '',
  };
  first.savePendingTurn(sessionId, pending);
  await first.saveSession(state);

  vi.resetModules();
  const restarted = await import('@/lib/orchestrator/session-store');
  expect(restarted.getPendingTurn(sessionId)).toBeUndefined();
  const restored = await restarted.getOrCreateSession(sessionId);
  expect(restarted.getPendingTurn(sessionId)).toEqual(pending);
  expect(restored).not.toHaveProperty('pendingDice');

  restarted.clearPendingTurn(sessionId);
  await restarted.saveSession(restored);
  vi.resetModules();
  const afterRoll = await import('@/lib/orchestrator/session-store');
  await afterRoll.getOrCreateSession(sessionId);
  expect(afterRoll.getPendingTurn(sessionId)).toBeUndefined();
});
