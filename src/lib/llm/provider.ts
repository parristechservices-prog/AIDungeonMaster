import { dmTurnSchema, type DmTurn } from './contracts';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    engineRequests: {
      type: 'array',
      items: {
        oneOf: [
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'skill_check' }, skill: { type: 'string' }, dc: { type: 'integer' }, reason: { type: 'string' } }, required: ['kind', 'skill', 'dc', 'reason'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'start_combat' } }, required: ['kind'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'player_attack' }, targetId: { type: 'string' } }, required: ['kind', 'targetId'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'monster_turn' } }, required: ['kind'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'use_feature' }, featureId: { type: 'string' } }, required: ['kind', 'featureId'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'cast_spell' }, spellName: { type: 'string' }, level: { type: 'integer' }, targetId: { type: 'string' } }, required: ['kind', 'spellName', 'level'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'short_rest' } }, required: ['kind'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'long_rest' } }, required: ['kind'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'update_npc' }, npcId: { type: 'string' }, disposition: { type: 'string', enum: ['friendly', 'neutral', 'hostile'] }, knowledge: { type: 'string' } }, required: ['kind', 'npcId'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'add_canon_fact' }, content: { type: 'string' }, importance: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['kind', 'content', 'importance'] },
          { type: 'object', additionalProperties: false, properties: { kind: { const: 'update_inventory' }, add: { type: 'array', items: { type: 'string' } }, remove: { type: 'array', items: { type: 'string' } }, goldDelta: { type: 'integer' } }, required: ['kind'] },
        ],
      },
      maxItems: 5,
    },
    narration: { type: 'string' },
    needsResultBeforeNarrating: { type: 'boolean' },
  },
  required: ['engineRequests', 'narration', 'needsResultBeforeNarrating'],
} as const;

type Input = { systemPrompt: string; playerInput: string };

export async function generateDmTurn(input: Input): Promise<DmTurn | null> {
  const provider = (process.env.PARTYQUEST_LLM_PROVIDER ?? 'groq').toLowerCase();

  if (provider === 'openai') {
    return generateWithOpenAI(input);
  }

  const groqTurn = await generateWithGroq(input);
  if (groqTurn) return groqTurn;

  return generateWithOpenAI(input);
}

async function generateWithGroq(input: Input): Promise<DmTurn | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('GROQ_API_KEY not found in environment.');
    return null;
  }

  const useLightMode = (process.env.PARTYQUEST_LLM_MODE ?? '').toLowerCase() === 'light';
  const defaultModel = 'llama-3.3-70b-versatile';
  const model = process.env.GROQ_MODEL ?? defaultModel;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.playerInput },
        ],
        response_format: {
          type: 'json_object',
        },
        temperature: 0.1,
      }),
    });

    if (!r.ok) {
      const errorText = await r.text();
      console.error(`Groq API Error (${r.status}):`, errorText);
      return null;
    }
    const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      console.error('Groq Error: Empty response body');
      return null;
    }

    return parseDmTurn(text);
  } catch (e) {
    console.error('Failed to fetch from Groq:', e);
    return null;
  }
}

function parseDmTurn(raw: string): DmTurn | null {
  try {
    const parsedJson = JSON.parse(raw);
    const parsed = dmTurnSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error('LLM Turn Schema Mismatch:', parsed.error.format());
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error('Failed to parse LLM JSON:', e);
    return null;
  }
}

async function generateWithOpenAI(input: Input): Promise<DmTurn | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.playerInput },
        ],
        response_format: {
          type: 'json_object'
        },
      }),
    });

    if (!r.ok) {
      const errorText = await r.text();
      console.error(`OpenAI API Error (${r.status}):`, errorText);
      return null;
    }
    const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    return parseDmTurn(text);
  } catch (e) {
    console.error('Failed to fetch from OpenAI:', e);
    return null;
  }
}
