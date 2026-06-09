import { dmTurnSchema, type DmTurn } from './contracts';
import { hasLlmCredentials } from './credentials';
import { writeDevLog } from '@/lib/logging/dev-log';

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
      const keyIndex = apiKeys.indexOf(apiKey);
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

        if (!r.ok) {
          writeDevLog({
            type: 'llm_provider_attempt',
            provider,
            keyIndex,
            status: r.status,
            statusText: r.statusText,
            error: 'provider_response_not_ok',
          });
          continue;
        }
        const data = await r.json();
        const text = data.choices?.[0]?.message?.content ?? null;
        writeDevLog({
          type: 'llm_provider_attempt',
          provider,
          keyIndex,
          status: r.status,
          success: Boolean(text),
          fallbackToNextKey: !Boolean(text),
        });
        if (text) yield text;
      } catch (error) {
        writeDevLog({
          type: 'llm_provider_attempt',
          provider,
          keyIndex,
          error: error instanceof Error ? error.message : 'unknown_error',
          errorClass: error instanceof Error ? error.name : 'UnknownError',
          fallbackToNextKey: true,
        });
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
  let malformedOutput: string | null = null;
  for await (const text of callLlmCandidates(input, { json: true })) {
    const parsed = parseDmTurn(text);
    if (parsed) return parsed;
    malformedOutput = text;
  }

  if (malformedOutput) {
    const repairInput = {
      systemPrompt: input.systemPrompt,
      playerInput: [
        'Fix the malformed DM turn below. Return JSON only, matching the required schema exactly.',
        'Do not add markdown or commentary.',
        '',
        malformedOutput,
      ].join('\n'),
    };
    for await (const text of callLlmCandidates(repairInput, { json: true })) {
      const parsed = parseDmTurn(text);
      if (parsed) return parsed;
    }
  }
  return null;
}

export async function generateNarration(input: {
  systemPrompt: string;
  sceneDescription: string;
  playerInput: string;
  originalNarration: string;
  engineResults: Array<{ kind: string; summary: string; ok: boolean }>;
  visibleState: string;
  validationIssues?: string[];
}): Promise<string | null> {
  const resultSummary = input.engineResults
    .map((result, index) => `${index + 1}. ${result.kind}: ${result.summary}`)
    .join('\n');

  const narrationPrompt = [
    'You are the Dungeon Master narrator. Produce a final, faithful narration after the engine has resolved the mechanical actions.',
    'Do not invent new facts or contradict the engine results. Use the current scene, the player intent, and the engine summaries to write a single concise prose paragraph.',
    '',
    `Scene: ${input.sceneDescription}`,
    `Player input: ${input.playerInput}`,
    `Initial narration: ${input.originalNarration}`,
    '',
    'Engine results:',
    resultSummary || 'None',
    '',
    'Visible state summary:',
    input.visibleState || 'No additional state summary.',
    ...(input.validationIssues?.length
      ? ['', 'Previous narration validation failures:', ...input.validationIssues.map((issue) => `- ${issue}`)]
      : []),
    '',
    'Return only the narration text. No markdown fences, no JSON, no extra commentary.',
  ].join('\n');

  return callLlm({ systemPrompt: input.systemPrompt, playerInput: narrationPrompt });
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
