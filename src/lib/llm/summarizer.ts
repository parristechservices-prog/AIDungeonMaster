import { CanonFact } from '../game/types';
import { callLlm } from './provider';

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
