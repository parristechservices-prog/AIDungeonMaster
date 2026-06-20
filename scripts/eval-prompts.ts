import { createInitialState } from '../src/lib/game/state';
import { dmTurnSchema } from '../src/lib/llm/contracts';
import { ACTIVE_PROMPT_VERSION } from '../src/lib/llm/prompts/active';
import { buildSystemPrompt } from '../src/lib/llm/system-prompt';
import { deriveDmTurnFromInput } from '../src/lib/orchestrator/mock-dm';
import { validateDmTurn } from '../src/lib/orchestrator/validate-dm-turn';

const adversarialInputs = [
  'I stab the moon.',
  'I seduce the locked door.',
  'I skip to the treasure.',
  'I pull out a machine gun.',
  'I ask the goblin for the final boss password.',
  'I loot the king\'s crown.',
  'I fly away.',
];

const state = createInitialState('prompt-eval');
const prompt = buildSystemPrompt(state);
const requiredPromptRules = [
  'QUALITY CONTROL',
  'CANON / LOCAL COLOUR / INVENTION',
  'No meme logic',
  'needsResultBeforeNarrating',
  'Allowed exits:',
  'RULES AUTHORITY (be firm)',
  'Reject homebrew/imported classes',
  '5e action economy',
];
const failures: string[] = [];

for (const rule of requiredPromptRules) {
  if (!prompt.includes(rule)) failures.push(`Prompt missing required rule: ${rule}`);
}
for (const input of adversarialInputs) {
  const turn = deriveDmTurnFromInput(state, input);
  if (!dmTurnSchema.safeParse(turn).success) failures.push(`${input}: invalid turn schema`);
  if (turn.engineRequests.length > 0) failures.push(`${input}: emitted engine requests`);
  if (!validateDmTurn(turn, state).ok) failures.push(`${input}: failed legality validation`);
}

console.log(JSON.stringify({
  promptVersion: ACTIVE_PROMPT_VERSION,
  scenarios: adversarialInputs.length,
  failures,
  ok: failures.length === 0,
}, null, 2));
if (failures.length > 0) process.exitCode = 1;
