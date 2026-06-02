import { NextResponse } from 'next/server';
import { getOpeningNarration } from '@/lib/game/state';
import { getScenario } from '@/lib/game/scenarios';
import { startNewGame } from '@/lib/orchestrator/session-store';

const VALID_CHARACTERS = new Set(['fighter', 'wizard', 'rogue', 'cleric']);
const VALID_ADVENTURES = new Set(['brindlehook-inn', 'crypt-of-whispers', 'smugglers-cove']);
const VALID_BACKGROUNDS = new Set(['soldier', 'scholar', 'criminal', 'acolyte']);
const VALID_PERSONAS = new Set(['balanced', 'gritty', 'epic', 'whimsical']);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId =
    typeof body?.sessionId === 'string' && body.sessionId.length > 0
      ? body.sessionId.slice(0, 64)
      : `sess-${crypto.randomUUID().slice(0, 8)}`;

  const adventureId =
    typeof body?.adventureId === 'string' && VALID_ADVENTURES.has(body.adventureId)
      ? body.adventureId
      : 'brindlehook-inn';

  const characterId =
    typeof body?.characterId === 'string' && VALID_CHARACTERS.has(body.characterId)
      ? body.characterId
      : 'fighter';

  const playerName = typeof body?.playerName === 'string' ? body.playerName.slice(0, 40) : undefined;

  const backgroundId =
    typeof body?.backgroundId === 'string' && VALID_BACKGROUNDS.has(body.backgroundId)
      ? body.backgroundId
      : undefined;

  const personaId =
    typeof body?.personaId === 'string' && VALID_PERSONAS.has(body.personaId)
      ? (body.personaId as 'balanced' | 'gritty' | 'epic' | 'whimsical')
      : 'balanced';

  const state = startNewGame(sessionId, { adventureId, characterId, playerName, backgroundId, personaId });
  const scenario = getScenario(adventureId);

  return NextResponse.json({
    ok: true,
    sessionId,
    adventureId,
    characterId,
    backgroundId: state.backgroundId,
    title: scenario.title,
    opening: getOpeningNarration(state),
    player: {
      name: state.player.name,
      className: state.player.className,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
    },
  });
}
