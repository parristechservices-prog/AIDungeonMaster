import type { SourceChunk, SourceIndex } from './types';

/** Common words ignored when scoring relevance. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'as', 'it', 'its', 'this', 'that', 'these',
  'those', 'from', 'into', 'out', 'up', 'down', 'over', 'you', 'your', 'i', 'we', 'they', 'he',
  'she', 'him', 'her', 'them', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should',
  'what', 'when', 'where', 'who', 'how', 'why', 'if', 'then', 'than', 'so', 'not', 'no', 'yes',
  'my', 'me', 'our', 'their', 'his', 'there', 'here', 'about', 'around', 'toward', 'towards',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[-']+|[-']+$/g, ''))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export type RetrievalOptions = {
  /** Max number of chunks to return. */
  topK?: number;
  /** Max total characters across returned passages. */
  charBudget?: number;
  /** Minimum score a chunk must beat to be included. */
  minScore?: number;
};

export type ScoredChunk = SourceChunk & { score: number };

/**
 * Precomputed inverse-document-frequency weights for an index. Computing this
 * once and reusing it across turns keeps per-turn retrieval cheap.
 */
export function buildIdf(index: SourceIndex): Map<string, number> {
  const df = new Map<string, number>();
  for (const chunk of index.chunks) {
    const seen = new Set(tokenize(chunk.text));
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const n = index.chunks.length || 1;
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    // Smoothed idf; rarer terms (proper nouns, place names) weigh more.
    idf.set(term, Math.log(1 + n / (1 + count)));
  }
  return idf;
}

/**
 * Score every chunk against the query with tf-idf and return the best ones,
 * respecting topK and a character budget. Pure and deterministic.
 */
export function retrieveRelevant(
  index: SourceIndex,
  query: string,
  idf: Map<string, number>,
  options: RetrievalOptions = {},
): ScoredChunk[] {
  const { topK = 3, charBudget = 1800, minScore = 0.0001 } = options;
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];
  const queryWeights = new Map<string, number>();
  for (const term of queryTerms) {
    queryWeights.set(term, (queryWeights.get(term) ?? 0) + 1);
  }

  const scored: ScoredChunk[] = [];
  for (const chunk of index.chunks) {
    const tokens = tokenize(chunk.text);
    if (tokens.length === 0) continue;
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const [term, qw] of queryWeights) {
      const termTf = tf.get(term);
      if (!termTf) continue;
      const weight = idf.get(term) ?? 0;
      // Sub-linear tf damping so one long chunk can't dominate on repetition.
      score += qw * weight * (1 + Math.log(termTf));
    }
    if (score <= 0) continue;
    // Mild normalization by length so short, dense passages can win.
    score = score / Math.sqrt(tokens.length);
    scored.push({ ...chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const selected: ScoredChunk[] = [];
  let used = 0;
  for (const chunk of scored) {
    if (chunk.score < minScore) break;
    if (selected.length >= topK) break;
    if (used + chunk.text.length > charBudget && selected.length > 0) continue;
    selected.push(chunk);
    used += chunk.text.length;
  }
  return selected;
}
