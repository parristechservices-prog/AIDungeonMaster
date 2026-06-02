import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/orchestrator/session-store';

/** GET session state for reconnect / debug (V0: no auth). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 });
  }

  const state = getOrCreateSession(sessionId);
  return NextResponse.json({
    ok: true,
    sessionId,
    sceneId: state.sceneId,
    player: {
      name: state.player.name,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
    },
    combat: state.combat,
  });
}
