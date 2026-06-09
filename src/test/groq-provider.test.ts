import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredProviders, getProviderKeyCounts } from '@/lib/llm/credentials';
import { generateDmTurn } from '@/lib/llm/provider';

const originalEnv = { ...process.env };

function jsonResponse(content: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => content,
  };
}

function errorResponse(status: number, statusText = 'Error') {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({ message: 'error' }),
  };
}

describe('Groq provider key fallback', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('counts a single GROQ_API_KEY', () => {
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'first-key';
    process.env.GROQ_API_KEYS = '';

    expect(getConfiguredProviders()).toEqual(['groq']);
    expect(getProviderKeyCounts()).toEqual({ groq: 1 });
  });

  it('counts multiple GROQ_API_KEYS', () => {
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = '';
    process.env.GROQ_API_KEYS = 'key1,key2,key3';

    expect(getConfiguredProviders()).toEqual(['groq']);
    expect(getProviderKeyCounts()).toEqual({ groq: 3 });
  });

  it('counts GROQ_API_KEY plus GROQ_API_KEYS with duplicates removed', () => {
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'key1';
    process.env.GROQ_API_KEYS = 'key1,key2,key2,key3';

    expect(getConfiguredProviders()).toEqual(['groq']);
    expect(getProviderKeyCounts()).toEqual({ groq: 3 });
  });

  it('tries the second Groq key after the first returns 429', async () => {
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'primary';
    process.env.GROQ_API_KEYS = 'secondary';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: JSON.stringify({ engineRequests: [], narration: 'ok', needsResultBeforeNarrating: false }) } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const turn = await generateDmTurn({ systemPrompt: 'system', playerInput: 'hello' });

    expect(turn).toBeTruthy();
    expect(turn?.narration).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('api.groq.com');
    expect(fetchMock.mock.calls[1][0]).toContain('api.groq.com');
  });

  it('tries the next Groq key when the first returns invalid JSON', async () => {
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'primary';
    process.env.GROQ_API_KEYS = 'secondary';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'not valid json' } }] }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: JSON.stringify({ engineRequests: [], narration: 'ok', needsResultBeforeNarrating: false }) } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const turn = await generateDmTurn({ systemPrompt: 'system', playerInput: 'hello' });

    expect(turn).toBeTruthy();
    expect(turn?.narration).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when all Groq keys fail', async () => {
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'primary';
    process.env.GROQ_API_KEYS = 'secondary';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(errorResponse(503, 'Service Unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const turn = await generateDmTurn({ systemPrompt: 'system', playerInput: 'hello' });

    expect(turn).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
