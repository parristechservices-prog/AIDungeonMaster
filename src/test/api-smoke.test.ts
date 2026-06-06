import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as startSession } from '@/app/api/session/start/route';
import { POST as runApiTurn } from '@/app/api/turn/route';
import { GET as getHealth } from '@/app/api/health/route';
import { resetRandomProvider, setRandomProvider } from '@/lib/engine';

describe('no-key API smoke flow', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PARTYQUEST_FORCE_MOCK = 'true';
    process.env.PARTYQUEST_MOCK_FLAVOR = 'false';
    setRandomProvider(() => 0.99);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetRandomProvider();
  });

  it('starts a session, responds in Table Rules mode, and safely rejects silly input', async () => {
    const sessionId = `api-smoke-${Date.now()}`;
    const startResponse = await startSession(jsonRequest('http://localhost/api/session/start', {
      sessionId,
      adventureId: 'brindlehook-inn',
      characterId: 'fighter',
    }));
    const started = await startResponse.json();
    expect(started.ok).toBe(true);
    expect(started.sceneId).toBe('social');

    const greetingResponse = await runApiTurn(jsonRequest('http://localhost/api/turn', {
      sessionId,
      playerInput: 'Hello, Mira.',
    }));
    const greeting = await greetingResponse.json();
    expect(greeting.ok).toBe(true);
    expect(greeting.mode).toBe('table_rules');
    expect(greeting.narration).toBeTruthy();

    const lookResponse = await runApiTurn(jsonRequest('http://localhost/api/turn', {
      sessionId,
      playerInput: 'i look around',
    }));
    const look = await lookResponse.json();
    expect(look.ok).toBe(true);
    expect(look.narration).toMatch(/rain|lantern|patrons|mira/i);
    expect(look.narration).not.toMatch(/not quite sure|name who acts/i);
    expect(look.state.monsters).toEqual([]);

    const sillyResponse = await runApiTurn(jsonRequest('http://localhost/api/turn', {
      sessionId,
      playerInput: 'I stab the moon.',
    }));
    const silly = await sillyResponse.json();
    expect(silly.ok).toBe(true);
    expect(silly.engineResults).toEqual([]);
    expect(silly.narration).toMatch(/not possible|choose an action/i);
  });

  it('rejects out-of-bounds manual rolls before processing a turn', async () => {
    const response = await runApiTurn(jsonRequest('http://localhost/api/turn', {
      sessionId: `api-manual-${Date.now()}`,
      playerInput: 'I search.',
      manualRoll: 21,
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: expect.stringContaining('integer between 1 and 20'),
    });
  });

  it('reports secret-safe health information', async () => {
    const response = await getHealth();
    expect(await response.json()).toMatchObject({
      ok: true,
      service: 'partyquest',
      llmConfigured: false,
      storageMode: expect.stringMatching(/memory|local_files/),
      promptVersion: expect.stringContaining('grounded-dm'),
    });
  });

  it('enforces an optional per-session turn cap', async () => {
    process.env.PARTYQUEST_MAX_TURNS_PER_SESSION = '1';
    const sessionId = `api-limit-${Date.now()}`;
    await startSession(jsonRequest('http://localhost/api/session/start', { sessionId }));
    expect((await runApiTurn(jsonRequest('http://localhost/api/turn', {
      sessionId,
      playerInput: 'Hello.',
    }))).status).toBe(200);
    expect((await runApiTurn(jsonRequest('http://localhost/api/turn', {
      sessionId,
      playerInput: 'Hello again.',
    }))).status).toBe(429);
  });
});

function jsonRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
