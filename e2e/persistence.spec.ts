import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('another server process restores and resolves a saved physical roll', async ({ request }) => {
  const secondServer = process.env.PARTYQUEST_SECOND_TEST_SERVER;
  test.skip(!secondServer, 'Requires a second app process connected to the same test database.');

  const sessionId = randomUUID();
  const adventureId = 'skt-nightstone-chapter1';
  const campaign = { sessionId, adventureId };
  const started = await request.post('/api/session/start', {
    data: { ...campaign, characterIds: ['fighter', 'rogue'] },
  });
  expect(started.ok()).toBe(true);
  const initial = await started.json();
  expect(initial.state.party).toHaveLength(2);

  const firstTurn = await request.post('/api/turn', {
    data: { ...campaign, playerInput: 'I search for tracks.', physicalDice: true },
  });
  expect(firstTurn.ok()).toBe(true);
  const pending = await firstTurn.json();
  expect(pending).toMatchObject({ needsManualRoll: true, rollId: expect.any(String) });

  const recovered = await request.get(`${secondServer}/api/session?sessionId=${sessionId}`);
  expect(recovered.ok()).toBe(true);
  const saved = await recovered.json();
  expect(saved).toMatchObject({
    adventureId,
    rollId: pending.rollId,
    manualRollContext: pending.manualRollContext,
  });
  expect(saved.state.party.map((hero: { id: string; inventory: string[] }) => [hero.id, hero.inventory]))
    .toEqual(initial.state.party.map((hero: { id: string; inventory: string[] }) => [hero.id, hero.inventory]));
  expect(saved.state.exploration.locations).toEqual(initial.state.exploration.locations);

  const payload = { ...campaign, rollId: saved.rollId, manualRoll: 17 };
  const completed = await request.post(`${secondServer}/api/turn`, { data: payload });
  expect(completed.ok()).toBe(true);
  expect(await completed.json()).toMatchObject({ needsManualRoll: false, recap: { turnNumber: 2 } });
  const duplicate = await request.post(`${secondServer}/api/turn`, { data: payload });
  expect(duplicate.status()).toBe(409);
  const replayOnOriginalServer = await request.post('/api/turn', { data: payload });
  expect(replayOnOriginalServer.status()).toBe(409);
});

test('a second server preserves both worgs and the party in a saved encounter', async ({ request }) => {
  const secondServer = process.env.PARTYQUEST_SECOND_TEST_SERVER;
  test.skip(!secondServer, 'Requires a second app process connected to the same test database.');

  const adventureId = 'skt-nightstone-chapter1';
  const sessionId = randomUUID();
  const campaign = { adventureId, sessionId };
  const start = await request.post('/api/session/start', {
    data: { ...campaign, characterIds: ['fighter', 'wizard'] },
  });
  expect(start.ok()).toBe(true);

  async function play(playerInput: string) {
    const result = await request.post('/api/turn', { data: { ...campaign, playerInput } });
    expect(result.ok()).toBe(true);
    return result.json();
  }

  await play('I cross the drawbridge.');
  await play('I enter the village square.');
  const attack = await request.post('/api/turn', {
    data: { ...campaign, playerInput: 'I attack the worgs.', physicalDice: true },
  });
  const pending = await attack.json();
  expect(pending.needsManualRoll).toBe(true);
  const result = await request.post('/api/turn', {
    data: { ...campaign, manualRoll: 20, rollId: pending.rollId },
  });
  const fight = await result.json();
  expect(fight.state.combat.active).toBe(true);
  expect(fight.state.monsters.map((monster: { name: string }) => monster.name)).toEqual(['Worg', 'Worg']);
  expect(fight.state.combat.initiative).toHaveLength(4);
  for (const worg of fight.state.monsters) {
    expect(fight.state.combat.battleMap.positions[worg.id]).toBeDefined();
  }

  const loaded = await request.get(`${secondServer}/api/session?sessionId=${sessionId}`);
  expect(loaded.ok()).toBe(true);
  const saved = await loaded.json();
  expect(saved.sceneId).toBe(fight.sceneId);
  expect(saved.state.combat).toEqual(fight.state.combat);
  expect(saved.state.monsters).toEqual(fight.state.monsters.map(({ id, name, hp, maxHp, ac, conditions }: { id: string; name: string; hp: number; maxHp: number; ac: number; conditions: string[] }) => ({ id, name, hp, maxHp, ac, conditions })));
});
