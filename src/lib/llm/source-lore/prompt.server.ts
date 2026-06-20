import { loadSourceForAdventure } from './store.server';
import { retrieveRelevant } from './retrieve';

export type SourceLoreResult = {
  /** Prompt section to append, or '' when no relevant owned source is available. */
  section: string;
  /** Headings of the passages injected (for dev logging / telemetry). */
  headings: string[];
};

const EMPTY: SourceLoreResult = { section: '', headings: [] };

/**
 * Build an authoritative "official source lore" prompt section for the current
 * turn by retrieving the most relevant passages from the table's owned book.
 * Returns an empty section when no source index is configured for the adventure.
 *
 * The instruction tells the DM to DEFER to these excerpts when in doubt, which
 * is the whole point: grounded, canon-correct rulings instead of improvisation.
 */
export async function buildSourceLoreSection(
  adventureId: string,
  query: string,
  options?: { topK?: number; charBudget?: number },
): Promise<SourceLoreResult> {
  const loaded = await loadSourceForAdventure(adventureId);
  if (!loaded) return EMPTY;

  const hits = retrieveRelevant(loaded.index, query, loaded.idf, {
    topK: options?.topK ?? 3,
    charBudget: options?.charBudget ?? 1800,
  });
  if (hits.length === 0) return EMPTY;

  const passages = hits
    .map((h) => `### ${h.heading}\n${h.text}`)
    .join('\n\n');

  const section = [
    '',
    `## OFFICIAL SOURCE LORE — ${loaded.index.title} (authoritative)`,
    'The following are excerpts from the official sourcebook this table owns. They are the single source of truth.',
    'When your own assumptions conflict with these excerpts — for places, NPCs, maps, distances, room contents, treasure, or outcomes — DEFER ENTIRELY TO THE EXCERPTS. Never contradict them or invent details that conflict with them. If an excerpt is silent on something, you may improvise within the established canon, but do not overrule what the excerpts state.',
    '',
    passages,
  ].join('\n');

  return { section, headings: hits.map((h) => h.heading) };
}
