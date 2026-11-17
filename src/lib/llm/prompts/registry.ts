import type { GameState } from '@/lib/game/types';
import { buildSystemPromptV1 } from './v1';

export type PromptBuilder = (state: GameState) => string;

/**
 * Versioned DM system prompts. Never edit a released version in place: add a
 * new file (v2.ts), register it here, record it in CHANGELOG.md, then switch
 * ACTIVE_PROMPT_VERSION (or set PARTYQUEST_PROMPT_VERSION to trial it).
 */
export const PROMPTS: Record<string, PromptBuilder> = {
  v1: buildSystemPromptV1,
};

export const ACTIVE_PROMPT_VERSION = 'v1';

/** Resolve the prompt version: env override if it names a registered version, else the active one. */
export function resolvePromptVersion(override: string | undefined = process.env.PARTYQUEST_PROMPT_VERSION): string {
  return override && override in PROMPTS ? override : ACTIVE_PROMPT_VERSION;
}

export function buildVersionedPrompt(state: GameState, version?: string): string {
  return PROMPTS[version && version in PROMPTS ? version : resolvePromptVersion()](state);
}
