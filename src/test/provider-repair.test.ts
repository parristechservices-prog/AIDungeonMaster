import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDmTurn } from '@/lib/llm/provider';

describe('generateDmTurn repair', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('retries malformed JSON once with a strict repair prompt', async () => {
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'test-key';
    delete process.env.PARTYQUEST_FORCE_MOCK;

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response('not json'))
      .mockResolvedValueOnce(response(JSON.stringify({
        engineRequests: [],
        narration: 'Please clarify your action.',
        needsResultBeforeNarrating: false,
      })));
    vi.stubGlobal('fetch', fetchMock);

    const turn = await generateDmTurn({ systemPrompt: 'system', playerInput: 'input' });
    expect(turn?.narration).toContain('clarify');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(repairBody.messages[1].content).toContain('Fix the malformed DM turn');
  });
});

function response(content: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}
