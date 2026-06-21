import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as startSession } from '@/app/api/session/start/route';

vi.mock('@/lib/llm/provider', () => ({
  generateDmTurn: vi.fn(),
  generateNarration: vi.fn(),
}));

describe('Table Rules fallback when AI generation fails', () => {
  const originalEnv = { ...process.env };
  let runApiTurn: typeof import('@/app/api/turn/route').POST;
  let providerModule: { generateDmTurn: ReturnType<typeof vi.fn>; generateNarration: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.PARTYQUEST_FORCE_MOCK = 'false';
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'mock-groq-key';
    process.env.GROQ_API_KEYS = '';

    providerModule = await import('@/lib/llm/provider') as unknown as typeof providerModule;
    providerModule.generateDmTurn.mockResolvedValue(null);
    providerModule.generateNarration.mockResolvedValue(null);

    const routeModule = await import('@/app/api/turn/route');
    runApiTurn = routeModule.POST;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it.each([
    ['Hello', /Mira|State your business|What would you like to know/i],
    ['I look around', /patrons|inn|common room|lantern/i],
    ['Describe the scene', /common room|inn|scene|room/i],
  ])('falls back to Table Rules for %s', async (playerInput, expectedNarration) => {
    const sessionId = `turn-fallback-${Date.now()}-${playerInput.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const startResponse = await startSession(jsonRequest('http://localhost/api/session/start', {
      sessionId,
      adventureId: 'brindlehook-inn',
      characterId: 'fighter',
    }));
    const started = await startResponse.json();

    expect(started.ok).toBe(true);

    const turnResponse = await runApiTurn(jsonRequest('http://localhost/api/turn', {
      sessionId,
      playerInput,
    }));
    const result = await turnResponse.json();

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('table_rules');
    expect(result.fallbackUsed).toBe(true);
    expect(result.aiUsed).toBe(false);
    expect(result.narration).toBeTruthy();
    expect(result.narration).toMatch(expectedNarration);
    expect(result.narration).not.toMatch(/not quite sure|try naming who acts/i);
  });
});

function jsonRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
