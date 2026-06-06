import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as startSession } from '@/app/api/session/start/route';

const providerMock = {
  generateDmTurn: vi.fn<[], Promise<null>>().mockResolvedValue(null),
  generateNarration: vi.fn<[], Promise<null>>().mockResolvedValue(null),
};

vi.mock('@/lib/llm/provider', () => providerMock);

describe('AI failure fallback to table rules', () => {
  const originalEnv = { ...process.env };
  let runApiTurn: typeof import('@/app/api/turn/route').POST;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.PARTYQUEST_FORCE_MOCK = 'false';
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'mock-groq-key';

    providerMock.generateDmTurn.mockResolvedValue(null);
    providerMock.generateNarration.mockResolvedValue(null);

    const routeModule = await import('@/app/api/turn/route');
    runApiTurn = routeModule.POST;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it.each([
    ['Hello', /Mira|State your business/i],
    ['I look around', /patrons|inn|common room|lantern/i],
    ['Describe the scene', /common room|inn|scene|room/i],
  ])('falls back to table rules when AI fails for %s', async (playerInput, expectedNarration) => {
    const sessionId = `turn-fallback-${Date.now()}-${playerInput.replace(/\s+/g, '-')}`;
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
