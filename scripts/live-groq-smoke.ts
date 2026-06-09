export {};

const runLive = process.env.RUN_LIVE_LLM_TESTS === 'true';
const baseUrl = process.env.PARTYQUEST_SMOKE_BASE_URL ?? 'http://localhost:3000';
const groqKey = process.env.GROQ_API_KEY?.trim();
const groqKeys = process.env.GROQ_API_KEYS?.split(',').map((k) => k.trim()).filter(Boolean) ?? [];

function jsonRequest(path: string, body: Record<string, unknown>) {
  return new Request(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function info(message: string) {
  console.log(message);
}

async function main() {
  if (!runLive) {
    console.log('skipped: RUN_LIVE_LLM_TESTS is not true');
    return;
  }

  if (!groqKey && groqKeys.length === 0) {
    console.log('skipped: no GROQ_API_KEY or GROQ_API_KEYS provided');
    return;
  }

  info('running live Groq smoke test');
  info(`configuredProviders: groq`);
  info(`providerKeyCounts: { groq: ${groqKey ? 1 + groqKeys.length : groqKeys.length} }`);

  const response = await fetch(`${baseUrl}/api/turn`, jsonRequest('/api/turn', {
    sessionId: `live-groq-${Date.now()}`,
    playerInput: 'Hello',
  }));
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(`Live Groq smoke failed: ${JSON.stringify(data)}`);
  }

  if (typeof data.mode !== 'string' || typeof data.aiUsed !== 'boolean' || typeof data.fallbackUsed !== 'boolean') {
    throw new Error('Live Groq smoke returned invalid turn response');
  }

  console.log(JSON.stringify({ ok: true, mode: data.mode, aiUsed: data.aiUsed, fallbackUsed: data.fallbackUsed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
