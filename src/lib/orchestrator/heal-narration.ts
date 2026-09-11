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

export function getNarrationRepairAttempts(): number {
  const raw = process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_NARRATION_REPAIR_ATTEMPTS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_NARRATION_REPAIR_ATTEMPTS;
  return Math.min(Math.floor(parsed), MAX_NARRATION_REPAIR_ATTEMPTS);
}

export type EngineResultLite = { kind: string; summary: string; ok: boolean };

export function detectNarrationWarnings(
  narration: string,
  state: GameState,
  engineResults: NarrationEngineResult[],
): string[] {
  return [
    ...validateNarrationAgainstState(narration, state),
    ...validateNarrationAgainstResults(narration, engineResults, state),
  ];
}

export type HealNarrationInput = {
  narration: string;
  state: GameState;
  engineResults: NarrationEngineResult[];
  reprompt: (issues: string[]) => Promise<string | null>;
  maxAttempts?: number;
};

export type HealNarrationResult = {
  narration: string;
  warnings: string[];
  attempts: number;
  usedEngineSafeFallback: boolean;
};

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
    if (!rewrite) break;
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
