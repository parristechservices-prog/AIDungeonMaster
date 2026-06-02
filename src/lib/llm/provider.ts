import { dmTurnSchema, type DmTurn } from './contracts';
import { hasLlmCredentials } from './credentials';

type Input = { systemPrompt: string; playerInput: string };

function getProviderList(): string[] {
  return (process.env.PARTYQUEST_LLM_PROVIDER ?? 'groq')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
}

function getProviderApiKeys(provider: string): string[] {
  const keys: string[] = [];

  if (provider === 'openai') {
    if (process.env.OPENAI_API_KEY?.trim()) keys.push(process.env.OPENAI_API_KEY.trim());
    if (process.env.OPENAI_API_KEYS) {
      keys.push(...process.env.OPENAI_API_KEYS.split(',').map((k) => k.trim()));
    }
  }

  if (provider === 'groq') {
    if (process.env.GROQ_API_KEY?.trim()) keys.push(process.env.GROQ_API_KEY.trim());
    if (process.env.GROQ_API_KEYS) {
      keys.push(...process.env.GROQ_API_KEYS.split(',').map((k) => k.trim()));
    }
  }

  return [...new Set(keys.filter(Boolean))];
}

export async function callLlm(input: Input, options?: { json?: boolean }): Promise<string | null> {
  if (!hasLlmCredentials()) return null;

  const providers = getProviderList();
  for (const provider of providers) {
    const apiKeys = getProviderApiKeys(provider);
    if (apiKeys.length === 0) continue;

    for (const apiKey of apiKeys) {
      const baseUrl = provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.groq.com/openai/v1/chat/completions';

      let model: string;
      if (provider === 'openai') {
        model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
      } else {
        const useLightMode = (process.env.PARTYQUEST_LLM_MODE ?? '').toLowerCase() === 'light';
        model = process.env.GROQ_MODEL ?? (useLightMode ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile');
      }

      try {
        const r = await fetch(baseUrl, {
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
            ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
            temperature: 0.1,
          }),
        });

        if (!r.ok) continue;
        const data = await r.json();
        const text = data.choices?.[0]?.message?.content ?? null;
        if (text) return text;
      } catch {
        continue;
      }
    }
  }

  return null;
}

export async function generateDmTurn(input: Input): Promise<DmTurn | null> {
  const text = await callLlm(input, { json: true });
  if (!text) return null;
  return parseDmTurn(text);
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
