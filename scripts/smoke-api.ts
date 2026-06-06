const baseUrl = process.env.PARTYQUEST_SMOKE_BASE_URL ?? 'http://localhost:3000';
const sessionId = `smoke-${Date.now()}`;

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const started = await post('/api/session/start', {
    sessionId,
    adventureId: 'brindlehook-inn',
    characterId: 'fighter',
  });
  const greeting = await post('/api/turn', { sessionId, playerInput: 'Hello, Mira.' });
  const observation = await post('/api/turn', { sessionId, playerInput: 'i look around' });
  const impossible = await post('/api/turn', { sessionId, playerInput: 'I stab the moon.' });

  if (
    greeting.mode !== 'table_rules' ||
    /not quite sure|name who acts/i.test(observation.narration) ||
    observation.state.monsters.length !== 0 ||
    impossible.engineResults.length !== 0
  ) {
    throw new Error('Smoke test expected no-key Table Rules mode with no impossible-action engine requests.');
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    sessionId,
    adventure: started.title,
    scene: impossible.sceneId,
    mode: greeting.mode,
    observationNarration: observation.narration,
    visibleSocialEnemies: observation.state.monsters.length,
    impossibleActionNarration: impossible.narration,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
