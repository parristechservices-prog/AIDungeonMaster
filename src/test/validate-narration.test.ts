import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import {
  buildEngineSafeNarration,
  validateNarrationAgainstResults,
  validateNarrationAgainstState,
} from '@/lib/llm/validate-narration';

describe('validateNarrationAgainstState', () => {
  it('flags wrong HP in narration', () => {
    const state = createInitialState('test');
    const warnings = validateNarrationAgainstState(
      'You stagger with only 5/28 HP remaining.',
      state,
    );
    expect(warnings.some((w) => w.includes('HP'))).toBe(true);
  });

  it('passes when narration avoids numeric claims', () => {
    const state = createInitialState('test');
    const warnings = validateNarrationAgainstState(
      'Mira leans in and whispers about the boathouse.',
      state,
    );
    expect(warnings).toHaveLength(0);
  });

  it('flags wrong AC', () => {
    const state = createInitialState('test');
    const warnings = validateNarrationAgainstState('Your AC is 10 in this stance.', state);
    expect(warnings.some((w) => w.includes('AC'))).toBe(true);
  });

  it('flags narration that contradicts engine success or failure', () => {
    expect(validateNarrationAgainstResults('Your sword hits the goblin.', [
      { kind: 'player_attack', ok: false, summary: 'Attack missed.' },
    ])).not.toHaveLength(0);
    expect(validateNarrationAgainstResults('You fail to find the tracks.', [
      { kind: 'skill_check', ok: true, summary: 'Search: success' },
    ])).not.toHaveLength(0);
  });

  it('flags unsupported damage and produces an engine-safe fallback', () => {
    const results = [{
      kind: 'player_attack',
      ok: true,
      summary: 'Hit Goblin for 7 damage.',
      breakdown: { rolls: [4], total: 7 },
    }];
    expect(validateNarrationAgainstResults('You dealt 99 damage.', results)).not.toHaveLength(0);
    expect(buildEngineSafeNarration(results)).toBe('Hit Goblin for 7 damage.');
  });
});
