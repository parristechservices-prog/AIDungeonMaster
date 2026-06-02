import { dmTurnSchema, type DmTurn } from './contracts';

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
  const model =
    process.env.GROQ_MODEL ?? (useLightMode ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile');

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
