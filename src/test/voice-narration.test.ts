import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/voice-narration/route';

const origin = 'https://ai-dungeon-master-azure.vercel.app';

function narrationRequest() {
  return new Request(`${origin}/api/voice-narration`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'test-value', voice: 'rowan', narration: 'The door opens.' }),
  });
}

afterEach(() => vi.unstubAllGlobals());

it('distinguishes deployment authentication from a rejected narration passcode', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json({ message: 'Protected by Vercel Authentication' }, { status: 401 }));
  vi.stubGlobal('fetch', fetch);

  expect((await POST(narrationRequest())).status).toBe(503);
});

it('streams audio from the alternate service after an authentication rejection', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response('demo audio', { headers: { 'Content-Type': 'audio/mpeg' } })));

  const result = await POST(narrationRequest());
  expect(result.status).toBe(200);
  expect(result.headers.get('Content-Type')).toBe('audio/mpeg');
  expect(await result.text()).toBe('demo audio');
});
