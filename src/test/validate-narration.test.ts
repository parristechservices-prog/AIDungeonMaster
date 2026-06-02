import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { validateNarrationAgainstState } from '@/lib/llm/validate-narration';

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
});
