import { CanonFact } from '../game/types';
import { callLlm } from './provider';

/**
 * Cheap, deterministic bound on canon-log growth so a long campaign's prompt
 * context doesn't bloat. Keeps all `high` facts, the most recent `medium` facts,
 * and only the most recent `low` facts; older `low` facts are dropped (their
 * gist is preserved by the LLM summarizer's periodic pass into `medium` facts).
 */
export function pruneCanonLog(
  canonLog: CanonFact[],
  options: { keepMedium?: number; keepLow?: number } = {},
): CanonFact[] {
  const keepMedium = options.keepMedium ?? 40;
  const keepLow = options.keepLow ?? 10;
  const high: CanonFact[] = [];
  const medium: CanonFact[] = [];
  const low: CanonFact[] = [];
  for (const fact of canonLog) {
    if (fact.importance === 'high') high.push(fact);
    else if (fact.importance === 'medium') medium.push(fact);
    else low.push(fact);
  }
  const kept = new Set<CanonFact>([...high, ...medium.slice(-keepMedium), ...low.slice(-keepLow)]);
  // Preserve original chronological order while dropping the trimmed entries.
  return canonLog.filter((f) => kept.has(f));
}

export async function summarizeCanonLog(facts: CanonFact[]): Promise<CanonFact[]> {
  if (facts.length < 15) return facts;

  const highPriority = facts.filter(f => f.importance === 'high');
  const lowPriority = facts.filter(f => f.importance !== 'high');

  const systemPrompt = `You are a world-building assistant for a D&D campaign. 
Your task is to summarize a list of minor facts into a few concise, high-level plot points or setting details.
Keep the most important information but combine related details. 
Return the result as a list of bullet points.`;

  const playerInput = `Please summarize these minor facts:
${lowPriority.map(f => `- ${f.content}`).join('\n')}`;

  const summary = await callLlm({ systemPrompt, playerInput });

  if (!summary) return facts;

  const summarizedFacts: CanonFact[] = summary
    .split('\n')
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(line => line.length > 0)
    .map((content, i) => ({
      id: `summary-${Date.now()}-${i}`,
      content,
      importance: 'medium'
    }));

  return [...highPriority, ...summarizedFacts];
}
