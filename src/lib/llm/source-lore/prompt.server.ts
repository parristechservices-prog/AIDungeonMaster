import { loadSourceForAdventure } from './store.server';
import { retrieveRelevant, selectGazetteer } from './retrieve';

export type SourceLoreResult = {
  /** Prompt section to append, or '' when no relevant owned source is available. */
  section: string;
  /** Headings of the passages injected (for dev logging / telemetry). */
  headings: string[];
  /** Names of canonical entities injected (for dev logging / telemetry). */
  entities: string[];
};

const EMPTY: SourceLoreResult = { section: '', headings: [], entities: [] };

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
  options?: { topK?: number; charBudget?: number; conversationText?: string },
): Promise<SourceLoreResult> {
  const loaded = await loadSourceForAdventure(adventureId);
  if (!loaded) return EMPTY;

  const hits = retrieveRelevant(loaded.index, query, loaded.idf, {
    topK: options?.topK ?? 5,
    charBudget: options?.charBudget ?? 3800,
  });

  // Canonical names relevant to this turn (query + recent conversation), so the
  // DM never has to invent a name even when passage retrieval is thin.
  const gazQuery = [query, options?.conversationText ?? ''].join(' ');
  const entities = selectGazetteer(loaded.index, gazQuery, hits, { max: 24 });

  if (hits.length === 0 && entities.length === 0) return EMPTY;

  const blocks: string[] = ['', `## OFFICIAL SOURCE — ${loaded.index.title} (authoritative; defer to this)`];

  if (entities.length > 0) {
    blocks.push(
      'CANONICAL NAMES (use these EXACT names and facts; NEVER invent a different name for these people, monsters, or places):',
      ...entities.map((e) => `- ${e.name}: ${e.note}`),
      '',
    );
  }

  if (hits.length > 0) {
    blocks.push(
      'EXCERPTS (the single source of truth for places, NPCs, maps, distances, room contents, treasure, and outcomes — defer entirely to these and never contradict them):',
      ...hits.map((h) => `### ${h.heading}\n${h.text}`),
      '',
    );
  }

  blocks.push(
    'ANTI-INVENTION RULE: If the player asks for a specific name, number, or fact that is NOT in the canonical names, the excerpts, or established canon, do NOT fabricate one. Stay general ("you don\'t find a name on them"), keep it vague, or say it isn\'t established — never make up a proper noun that could contradict the source.',
  );

  return {
    section: blocks.join('\n'),
    headings: hits.map((h) => h.heading),
    entities: entities.map((e) => e.name),
  };
}
