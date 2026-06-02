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

  if (provider === 'openrouter') {
    if (process.env.OPENROUTER_API_KEY?.trim()) keys.push(process.env.OPENROUTER_API_KEY.trim());
    if (process.env.OPENROUTER_API_KEYS) {
      keys.push(...process.env.OPENROUTER_API_KEYS.split(',').map((k) => k.trim()));
    }
  }

  return [...new Set(keys.filter(Boolean))];
}

function getProviderBaseUrl(provider: string): string {
  if (provider === 'openai') return 'https://api.openai.com/v1/chat/completions';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions';
  return 'https://api.groq.com/openai/v1/chat/completions';
}

function getProviderModel(provider: string): string {
  if (provider === 'openai') return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  if (provider === 'openrouter') {
    return process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct';
  }

  const useLightMode = (process.env.PARTYQUEST_LLM_MODE ?? '').toLowerCase() === 'light';
  return process.env.GROQ_MODEL ?? (useLightMode ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile');
}

function getProviderHeaders(provider: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (provider === 'openrouter') {
    headers['X-Title'] = process.env.OPENROUTER_APP_NAME ?? 'PartyQuest';
    if (process.env.OPENROUTER_SITE_URL?.trim()) {
      headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL.trim();
    }
  }

  return headers;
}

async function* callLlmCandidates(input: Input, options?: { json?: boolean }): AsyncGenerator<string> {
  if (!hasLlmCredentials()) return null;

  const providers = getProviderList();
  for (const provider of providers) {
    const apiKeys = getProviderApiKeys(provider);
    if (apiKeys.length === 0) continue;

    for (const apiKey of apiKeys) {
      try {
        const r = await fetch(getProviderBaseUrl(provider), {
          method: 'POST',
          headers: getProviderHeaders(provider, apiKey),
          body: JSON.stringify({
            model: getProviderModel(provider),
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
        if (text) yield text;
      } catch {
        continue;
      }
    }
  }
}

export async function callLlm(input: Input, options?: { json?: boolean }): Promise<string | null> {
  for await (const text of callLlmCandidates(input, options)) {
    return text;
  }
  return null;
}

export async function generateDmTurn(input: Input): Promise<DmTurn | null> {
  for await (const text of callLlmCandidates(input, { json: true })) {
    const parsed = parseDmTurn(text);
    if (parsed) return parsed;
  }
  return null;
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
