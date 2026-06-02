import { NextResponse } from 'next/server';
import { generateDmTurn } from '@/lib/llm/provider';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { validateNarrationAgainstState } from '@/lib/llm/validate-narration';
import { buildRecap } from '@/lib/game/recap';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { getOrCreateSession, nextTurnNumber, saveRecap, saveSession, getRecaps } from '@/lib/orchestrator/session-store';
import { writeDevLog } from '@/lib/logging/dev-log';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : 'local-default';
  const playerInput = typeof body?.playerInput === 'string' ? body.playerInput.slice(0, 800) : '';

  let state = getOrCreateSession(sessionId);
  const recentRecaps = getRecaps(sessionId).slice(-5);
  const systemPrompt =
    buildSystemPrompt(state) +
    (recentRecaps.length > 0
      ? `\n\n## RECENT CONVERSATION HISTORY\n${recentRecaps.map((r) => `Turn ${r.turnNumber} Narration: ${r.narration}`).join('\n')}`
      : '');

  const aiTurn = await generateDmTurn({
    systemPrompt,
    playerInput,
  });
  const fallbackUsed = !aiTurn;
  const rawTurn = aiTurn ?? deriveDmTurnFromInput(state, playerInput);
  const turn = runTurn(state, rawTurn, {
    mode: fallbackUsed ? 'table_rules' : 'ai_director',
    aiUsed: Boolean(aiTurn),
    fallbackUsed,
  });
  state = turn.state;

  saveSession(state);
  const turnNumber = nextTurnNumber(sessionId);

  const narration = fallbackUsed
    ? `The wind shifts and the tale steadies itself. ${turn.response.narration}`
    : turn.response.narration;

  const narrationWarnings = validateNarrationAgainstState(narration, state);
  if (narrationWarnings.length > 0) {
    writeDevLog({ type: 'narration_validation', sessionId, warnings: narrationWarnings });
  }

  const recap = buildRecap({
    state,
    turnNumber,
    narration,
    outcome: turn.response.engineResults[0]?.summary ?? turn.response.narration,
    consequences: turn.response.engineResults.map((r) => r.summary),
    nextChoices: turn.response.nextChoices,
    nextHook: turn.response.nextHook,
    mode: turn.response.mode,
    aiUsed: turn.response.aiUsed,
    fallbackUsed: turn.response.fallbackUsed,
  });
  saveRecap(sessionId, recap);

  const response = {
    ...turn.response,
    narration,
    narrationWarnings,
    sessionId,
    recap,
  };

  writeDevLog({ type: 'turn', sessionId, playerInput, response });

  return NextResponse.json(response);
}
