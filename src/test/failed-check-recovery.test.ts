import { describe, expect, it } from 'vitest';
import { isRecoveryVisible } from '@/components/play/FailedCheckRecovery';

// The dismiss interactions (close button, Escape, auto-dismiss) are local UI
// state in the component; the visibility rule is pure and tested here. Manual /
// e2e QA covers the actual dismiss gestures (a failed roll isn't deterministic
// through the UI). Dismissal never mutates game state.
describe('FailedCheckRecovery visibility rule', () => {
  it('shows only for a failed skill check', () => {
    expect(isRecoveryVisible({ kind: 'skill_check', summary: 'failed', ok: false })).toBe(true);
  });

  it('hides for a passed skill check', () => {
    expect(isRecoveryVisible({ kind: 'skill_check', summary: 'ok', ok: true })).toBe(false);
  });

  it('hides for non-skill-check results and when absent', () => {
    expect(isRecoveryVisible({ kind: 'player_attack', summary: 'miss', ok: false })).toBe(false);
    expect(isRecoveryVisible(undefined)).toBe(false);
  });
});
