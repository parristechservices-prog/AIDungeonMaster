import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { buildRecap } from '@/lib/game/recap';

describe('recap schema', () => {
  it('contains required baseline and extension fields', () => {
    const state = createInitialState('recap-1');
    const recap = buildRecap({
      state,
      turnNumber: 1,
      narration: 'You convinced Mira.',
      outcome: 'You convinced Mira.',
      mode: 'table_rules',
      aiUsed: false,
      fallbackUsed: true,
    });

    expect(recap.sessionId).toBe('recap-1');
    expect(recap.turnNumber).toBe(1);
    expect(recap.characters[0].id).toBeTruthy();
    expect(Array.isArray(recap.keyEvents)).toBe(true);
    expect(typeof recap.nextHook).toBe('string');
    expect(typeof recap.fallbackUsed).toBe('boolean');
  });
});
