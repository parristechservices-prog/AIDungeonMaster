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
  const basicPrompts = [
    'i look around',
    'what do i see',
    'talk to mira',
    'study the inn patrons',
    'look for clues',
    'what am i carrying',
    'help',
  ];
  const basicResponses = [];
  for (const playerInput of basicPrompts) {
    basicResponses.push({
      playerInput,
      response: await post('/api/turn', { sessionId, playerInput }),
    });
  }
  const impossible = await post('/api/turn', { sessionId, playerInput: 'I stab the moon.' });

  if (
    greeting.mode !== 'table_rules' ||
    basicResponses.some(({ response }) =>
      /not quite sure|name who acts|invalid_character_id/i.test(response.narration) ||
      response.state.monsters.length !== 0
    ) ||
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
    basicPrompts: basicResponses.map(({ playerInput, response }) => ({
      playerInput,
      narration: response.narration,
    })),
    visibleSocialEnemies: basicResponses[0].response.state.monsters.length,
    impossibleActionNarration: impossible.narration,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
