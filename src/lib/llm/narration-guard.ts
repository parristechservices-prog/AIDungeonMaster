import type { GameState } from '@/lib/game/types';
import { validateNarrationAgainstState } from './validate-narration';

export type NarrationRewriter = (prompt: { systemPrompt: string; playerInput: string }) => Promise<string | null>;

export interface GuardedNarration {
  narration: string;
  warnings: string[];
  /** 'original' = passed first time; 'rewritten' = LLM retry passed; 'fallback' = replaced by engine summaries. */
  source: 'original' | 'rewritten' | 'fallback';
}

/**
 * Validate narration against engine state. If it contradicts the state,
 * ask the model once to rewrite it without the bad claims; if that still
 * fails (or no model is available) fall back to the engine's own summaries,
 * so contradictory numbers are never shown as fact.
 */
export async function guardNarration(
  narration: string,
  state: GameState,
  engineSummaries: string[],
  rewrite?: NarrationRewriter,
): Promise<GuardedNarration> {
  const first = validateNarrationAgainstState(narration, state);
  if (first.length === 0) return { narration, warnings: [], source: 'original' };

  if (rewrite) {
    const retry = await rewrite({
      systemPrompt:
        'You are editing narration for a tabletop RPG. Rewrite the narration below so it stays vivid but makes NO numeric claims about hit points, armor class or damage totals, and does not contradict these problems. Reply with the rewritten narration only.\n\nProblems:\n' +
        first.map((w) => `- ${w}`).join('\n'),
      playerInput: narration,
    }).catch(() => null);
    const cleaned = retry?.trim();
    if (cleaned && validateNarrationAgainstState(cleaned, state).length === 0) {
      return { narration: cleaned, warnings: first, source: 'rewritten' };
    }
  }

  const fallback = engineSummaries.filter(Boolean).join(' ') || 'The moment passes, and the story moves on.';
  return { narration: fallback, warnings: first, source: 'fallback' };
}
