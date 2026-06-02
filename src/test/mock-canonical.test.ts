import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';

describe('mock multi-request turns', () => {
  afterEach(() => vi.restoreAllMocks());

  it('applies canon fact on successful social ask (3 engine requests)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    let state = createInitialState('canon-1');
    const turn = deriveDmTurnFromInput(state, 'I ask Mira about the courier');
    expect(turn.engineRequests).toHaveLength(3);

    const result = runTurn(state, turn, {
      mode: 'table_rules',
      aiUsed: false,
      fallbackUsed: true,
    });
    state = result.state;

    expect(result.response.engineResults.map((r) => r.summary)).toContain('Added canon fact.');
    expect(state.canonLog.some((f) => f.content.toLowerCase().includes('boathouse'))).toBe(true);
  });
});
