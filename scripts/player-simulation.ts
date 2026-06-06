import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.PARTYQUEST_SIMULATION_BASE_URL ?? 'http://localhost:3000';
const transcriptDir = path.join(process.cwd(), '.data', 'playtest-transcripts');
const genericFallback = /not quite sure|name who acts|invalid_character_id|i can work with that|could not interpret/i;
const internalError = /validation failure|undefined|null reference|turn processing failed|internal server error/i;

type TurnRecord = {
  prompt: string;
  status: number;
  ok: boolean;
  sceneId?: string;
  narration?: string;
  nextChoices?: string[];
  visibleEnemies: string[];
};

type Playthrough = {
  name: string;
  adventureId: string;
  prompts: string[];
  expectEnding?: boolean;
  manualRoll?: number;
};

const playthroughs: Playthrough[] = [
  {
    name: 'brindlehook-normal',
    adventureId: 'brindlehook-inn',
    prompts: ['look around', 'talk to mira', 'ask mira about the courier', 'look for clues', ...Array(12).fill('attack')],
    expectEnding: true,
  },
  {
    name: 'brindlehook-vague',
    adventureId: 'brindlehook-inn',
    prompts: ['look', 'talk', 'ask', 'search', 'go', 'yes', 'continue', 'help', 'what can i do', 'study', 'outside', 'tracks', 'attack', 'again', 'run'],
  },
  {
    name: 'brindlehook-curious',
    adventureId: 'brindlehook-inn',
    prompts: ['what is behind the bar', 'can i buy food', 'who owns this inn', 'are there any guards here', 'do i recognise anyone', 'what does mira look like', 'is anyone suspicious', 'can i check the guestbook', 'can i search the fireplace', 'can i leave without helping', 'can i rest here'],
  },
  {
    name: 'brindlehook-chaotic',
    adventureId: 'brindlehook-inn',
    prompts: ['i draw my sword', 'i threaten mira', 'i apologise', 'i throw a mug', 'i hide under a table', 'i sneak out the back', 'i follow a suspicious patron', 'i shout for everyone to be quiet', 'i offer 5 gold for information', 'i accuse mira of lying'],
  },
  {
    name: 'brindlehook-adversarial',
    adventureId: 'brindlehook-inn',
    prompts: ['i stab the moon', 'i seduce the locked door', 'i pull out a machine gun', 'i skip to the treasure', 'i fly away', 'i become god', 'i ask the goblin for the password', 'i kill everyone instantly', 'i burn down the whole town', 'i loot the dragon hoard'],
  },
  {
    name: 'brindlehook-fresh-player',
    adventureId: 'brindlehook-inn',
    prompts: ['what is this place?', 'look around', 'who is here?', 'talk to mira', 'what courier?', 'can i tell if she is hiding something?', 'i study the patrons', 'i look for footprints', 'i go outside', 'i follow the tracks', 'wait what am i carrying?', 'i draw my sword', ...Array(12).fill('attack'), 'use second wind', 'keep going'],
    expectEnding: true,
  },
  ...['tutorial', 'crypt-of-whispers', 'smugglers-cove'].map((adventureId) => ({
    name: `${adventureId}-basic`,
    adventureId,
    prompts: ['look around', 'who is here', 'help', 'i ask the npc what they know', 'i inspect the area', ...Array(12).fill('i attack'), 'i stab the moon'],
    expectEnding: true,
  })),
  ...['tutorial', 'brindlehook-inn', 'crypt-of-whispers', 'smugglers-cove'].map((adventureId) => ({
    name: `${adventureId}-failed-check`,
    adventureId,
    prompts: ['i ask the npc what they know', 'help', 'try again', 'i stab the moon'],
    manualRoll: 1,
  })),
];

async function post(pathname: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'non-json response' }));
  return { response, data };
}

async function runPlaythrough(name: string, adventureId: string, prompts: string[], expectEnding = false, manualRoll = 20) {
  const sessionId = `simulation-${name}-${Date.now()}`;
  const started = await post('/api/session/start', { sessionId, adventureId, characterId: 'fighter', playerName: 'Seren Ashfall' });
  if (!started.response.ok || !started.data.ok) throw new Error(`${name}: session start failed`);

  const records: TurnRecord[] = [];
  const failures: string[] = [];
  for (const prompt of prompts) {
    const { response, data } = await post('/api/turn', { sessionId, playerInput: prompt, manualRoll });
    const record: TurnRecord = {
      prompt,
      status: response.status,
      ok: Boolean(data.ok),
      sceneId: data.sceneId,
      narration: data.narration,
      nextChoices: data.nextChoices,
      visibleEnemies: data.state?.monsters?.map((monster: { name: string }) => monster.name) ?? [],
    };
    records.push(record);
    if (!response.ok || !data.ok) failures.push(`${prompt}: HTTP ${response.status}`);
    if (!data.narration?.trim()) failures.push(`${prompt}: missing narration`);
    if (genericFallback.test(data.narration ?? '')) failures.push(`${prompt}: generic fallback`);
    if (internalError.test(data.narration ?? '') || internalError.test(data.error ?? '')) failures.push(`${prompt}: internal error text`);
    if (data.sceneId === 'social' && record.visibleEnemies.length > 0) failures.push(`${prompt}: social enemy leak`);
    if (!Array.isArray(data.nextChoices) || data.nextChoices.length === 0) failures.push(`${prompt}: no suggested next actions`);
  }
  if (expectEnding && records.at(-1)?.sceneId !== 'ending') failures.push(`expected ending, reached ${records.at(-1)?.sceneId ?? 'unknown'}`);
  return { name, adventureId, sessionId, failures, records };
}

async function main() {
  fs.mkdirSync(transcriptDir, { recursive: true });
  const results = [];
  for (const playthrough of playthroughs) {
    results.push(await runPlaythrough(playthrough.name, playthrough.adventureId, playthrough.prompts, playthrough.expectEnding, playthrough.manualRoll));
  }
  const failures = results.flatMap((result) => result.failures.map((failure) => `${result.name}: ${failure}`));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(transcriptDir, `${timestamp}.json`), JSON.stringify(results, null, 2));
  const summary = [
    '# Latest Player Simulation Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${baseUrl}`,
    `Playthroughs: ${results.length}`,
    `Prompts: ${results.reduce((count, result) => count + result.records.length, 0)}`,
    `Failures: ${failures.length}`,
    '',
    '| Playthrough | Scenario | Prompts | Final scene | Failures |',
    '|---|---|---:|---|---:|',
    ...results.map((result) => `| ${result.name} | ${result.adventureId} | ${result.records.length} | ${result.records.at(-1)?.sceneId ?? 'unknown'} | ${result.failures.length} |`),
    '',
    '## Failures',
    '',
    ...(failures.length > 0 ? failures.map((failure) => `- ${failure}`) : ['- None']),
    '',
    'Raw transcripts are written to ignored `.data/playtest-transcripts/`.',
  ].join('\n');
  fs.writeFileSync(path.join(process.cwd(), 'docs', 'latest-player-simulation-summary.md'), summary);
  console.log(JSON.stringify({ ok: failures.length === 0, playthroughs: results.length, prompts: results.reduce((count, result) => count + result.records.length, 0), failures }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
