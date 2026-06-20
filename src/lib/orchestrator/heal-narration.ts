import type { GameState } from '@/lib/game/types';
import {
  buildEngineSafeNarration,
  validateNarrationAgainstResults,
  validateNarrationAgainstState,
  type NarrationEngineResult,
} from '@/lib/llm/validate-narration';

/** Default number of LLM re-prompt attempts before falling back to engine-safe text. */
export const DEFAULT_NARRATION_REPAIR_ATTEMPTS = 2;
/** Hard ceiling so a misconfigured env var cannot spawn unbounded LLM calls per turn. */
export const MAX_NARRATION_REPAIR_ATTEMPTS = 4;

/**
 * Number of self-healing re-prompt attempts, from `PARTYQUEST_NARRATION_REPAIR_ATTEMPTS`.
 * Clamped to [0, MAX_NARRATION_REPAIR_ATTEMPTS]; invalid values fall back to the default.
 */
export function getNarrationRepairAttempts(): number {
  const raw = process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_NARRATION_REPAIR_ATTEMPTS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_NARRATION_REPAIR_ATTEMPTS;
  return Math.min(Math.floor(parsed), MAX_NARRATION_REPAIR_ATTEMPTS);
}

export type EngineResultLite = { kind: string; summary: string; ok: boolean };

/** Runs both narration validators and merges their warnings (deduped). */
export function detectNarrationWarnings(
  narration: string,
  state: GameState,
  engineResults: NarrationEngineResult[],
): string[] {
  return [
    ...validateNarrationAgainstState(narration, state),
    ...validateNarrationAgainstResults(narration, engineResults),
  ];
}

export type HealNarrationInput = {
  narration: string;
  state: GameState;
  engineResults: NarrationEngineResult[];
  /**
   * Re-prompts the narrator with the listed validation issues and returns new
   * narration, or null if the LLM is unavailable / produced nothing usable.
   */
  reprompt: (issues: string[]) => Promise<string | null>;
  maxAttempts?: number;
};

export type HealNarrationResult = {
  narration: string;
  warnings: string[];
  /** Number of re-prompt attempts actually made. */
  attempts: number;
  /** True when warnings remained after all attempts and we used engine-safe text. */
  usedEngineSafeFallback: boolean;
};

/**
 * Self-healing narration loop. Validates the narration against engine truth and,
 * while it still contradicts state, re-prompts the narrator with the specific
 * contradictions — up to `maxAttempts` times. If contradictions survive every
 * attempt, it replaces the prose with deterministic engine-safe narration so the
 * player never sees a hallucinated outcome.
 *
 * This is what makes the engine/narrator split structural rather than advisory:
 * the narrator is not trusted, it is checked and corrected against the engine.
 */
export async function healNarration({
  narration,
  state,
  engineResults,
  reprompt,
  maxAttempts = getNarrationRepairAttempts(),
}: HealNarrationInput): Promise<HealNarrationResult> {
  let current = narration;
  let warnings = detectNarrationWarnings(current, state, engineResults);
  let attempts = 0;

  while (warnings.length > 0 && attempts < maxAttempts) {
    attempts += 1;
    const rewrite = await reprompt(warnings);
    if (!rewrite) break; // LLM unavailable — stop trying, fall through to engine-safe text.
    current = rewrite;
    warnings = detectNarrationWarnings(current, state, engineResults);
  }

  if (warnings.length > 0) {
    return {
      narration: buildEngineSafeNarration(engineResults),
      warnings,
      attempts,
      usedEngineSafeFallback: true,
    };
  }

  return { narration: current, warnings, attempts, usedEngineSafeFallback: false };
}
