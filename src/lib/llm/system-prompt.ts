import type { GameState } from '@/lib/game/types';
import { buildVersionedPrompt } from './prompts/registry';

/** Builds the DM system prompt using the active (or env-selected) prompt version. */
export function buildSystemPrompt(state: GameState): string {
  return buildVersionedPrompt(state);
}
