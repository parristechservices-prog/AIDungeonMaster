const origin = 'https://ai-dungeon-master-azure.vercel.app';
// natter-narration-backup currently serves the narrate endpoint; natter-two's
// production deploy doesn't, so try the working one first.
const endpoints = [
  'https://natter-narration-backup.vercel.app/api/narrate',
  'https://natter-two.vercel.app/api/narrate',
];

export async function POST(request: Request) {
  if (request.headers.get('origin') !== origin) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.passcode !== 'string' || !body.passcode || body.passcode.length > 256 ||
      !['rowan', 'ella'].includes(body.voice) || typeof body.narration !== 'string' ||
      !body.narration.trim() || body.narration.length > 2000) {
    return new Response(null, { status: 400 });
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ passcode: body.passcode, voice: body.voice, narration: body.narration }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
      });
      if (response.status === 401 && response.headers.get('access-control-allow-origin') === origin) return new Response(null, { status: 401 });
      const type = response.headers.get('content-type');
      if (response.ok && response.body && type?.startsWith('audio/')) {
        return new Response(response.body, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
      }
    } catch {
      if (request.signal.aborted) break;
    }
  }
  return Response.json({ error: 'Both Natter audio endpoints are unavailable.' }, { status: 502 });
}
