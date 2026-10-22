import { NextResponse } from 'next/server';
import { getOpeningNarration } from '@/lib/game/state';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { getSceneChoices, getSceneGoal } from '@/lib/game/adventures/helpers';
import { visibleNpcsForScene } from '@/lib/game/adventures/visibility';
import { getSession } from '@/lib/orchestrator/session-store';
import { clientIp, consumeRateLimit, sameOrigin } from '@/lib/http/request-guard';
import { isSecureSessionId } from '@/lib/security/session-id';
import { isSessionAuthorized, requiresSessionAccess } from '@/lib/security/session-access';

/** Returns reconnect state only to the browser that owns the campaign. */
export async function GET(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Reconnect from this website.' }, { status: 403 });
  }
  const retryAfter = consumeRateLimit(`session-read:${clientIp(req)}`, 60);
  if (retryAfter) {
    return NextResponse.json(
      { ok: false, error: 'Too many reconnect requests. Please try again shortly.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId || (process.env.NODE_ENV === 'production' && !isSecureSessionId(sessionId))) {
    return NextResponse.json({ ok: false, error: 'Valid sessionId required' }, { status: 400 });
  }

  const state = await getSession(sessionId);
  if (!state) return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  if (requiresSessionAccess() && !isSessionAuthorized(req, state)) {
    return NextResponse.json({ ok: false, error: 'Session access denied' }, { status: 403 });
  }

  const adventure = getAdventure(state.adventureId);
  const currentSceneStarter = adventure.scenes[state.sceneId]?.starter;
  return NextResponse.json({
    ok: true,
    sessionId,
    adventureId: state.adventureId,
    adventureTitle: adventure.title,
    opening: getOpeningNarration(state),
    sceneStarter: currentSceneStarter,
    characterTemplateIds: state.characterTemplateIds,
    backgroundId: state.backgroundId,
    sceneId: state.sceneId,
    sceneGoal: getSceneGoal(adventure, state.sceneId),
    nextChoices: getSceneChoices(adventure, state.sceneId),
    mode: 'table_rules',
    state: {
      party: state.party.map((p) => ({
        id: p.id,
        name: p.name,
        race: p.race,
        className: p.className,
        subclass: p.subclass,
        level: p.level,
        hp: p.hp,
        maxHp: p.maxHp,
        ac: p.ac,
        proficiencyBonus: p.proficiencyBonus,
        unconscious: p.unconscious,
        deathSaves: p.deathSaves,
        features: p.features,
        spellSlots: p.spellSlots,
        gold: p.gold,
        inventory: p.inventory,
        conditions: p.conditions,
      })),
      activeCharacterId: state.activeCharacterId,
      monsters: state.monsters.map((m) => ({
        id: m.id,
        name: m.name,
        hp: m.hp,
        maxHp: m.maxHp,
        ac: m.ac,
        conditions: m.conditions,
      })),
      npcs: visibleNpcsForScene(state.adventureId, state.sceneId, state.npcs),
      canonLog: state.canonLog,
      combat: state.combat,
      exploration: state.exploration,
      log: state.log.slice(-10),
    },
  });
}
