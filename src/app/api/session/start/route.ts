import { NextResponse } from 'next/server';
import { getOpeningNarration } from '@/lib/game/state';
import { getAdventure, isValidAdventureId } from '@/lib/game/adventures/registry.server';
import { getSceneChoices, getSceneGoal } from '@/lib/game/adventures/helpers';
import { visibleNpcsForScene } from '@/lib/game/adventures/visibility';
import { getSession, startNewGame } from '@/lib/orchestrator/session-store';
import { clientIp, consumeRateLimit, sameOrigin } from '@/lib/http/request-guard';
import { createSessionId, isSecureSessionId } from '@/lib/security/session-id';
import {
  issueSessionAccess,
  SESSION_ACCESS_COOKIE,
  sessionAccessCookieOptions,
} from '@/lib/security/session-access';

const VALID_CHARACTERS = new Set(['fighter', 'wizard', 'rogue', 'cleric', 'paladin', 'ranger']);
const VALID_BACKGROUNDS = new Set(['soldier', 'scholar', 'criminal', 'acolyte']);
const VALID_PERSONAS = new Set(['balanced', 'gritty', 'epic', 'whimsical']);

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Start the adventure from this website.' }, { status: 403 });
  }
  const retryAfter = consumeRateLimit(`session-start:${clientIp(req)}`, 30);
  if (retryAfter) {
    return NextResponse.json(
      { ok: false, error: 'Too many new sessions. Please try again shortly.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const suppliedSessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  const sessionId = process.env.NODE_ENV === 'production'
    ? (isSecureSessionId(suppliedSessionId) ? suppliedSessionId : createSessionId())
    : (suppliedSessionId.slice(0, 128) || createSessionId());

  if (await getSession(sessionId)) {
    return NextResponse.json({ ok: false, error: 'That session already exists. Start with a new session id.' }, { status: 409 });
  }

  const adventureId =
    typeof body?.adventureId === 'string' && isValidAdventureId(body.adventureId)
      ? body.adventureId
      : 'brindlehook-inn';

  const characterIds: string[] = (
    Array.isArray(body?.characterIds)
      ? body.characterIds.filter((id: unknown): id is string => typeof id === 'string' && VALID_CHARACTERS.has(id))
      : [typeof body?.characterId === 'string' && VALID_CHARACTERS.has(body.characterId) ? body.characterId : 'fighter']
  ).slice(0, 4);
  if (characterIds.length === 0) characterIds.push('fighter');

  const rawPlayerNames = Array.isArray(body?.playerNames) ? body.playerNames : [body?.playerName];
  const playerNames = characterIds.map((_characterId: string, i: number) => {
    const rawName = rawPlayerNames[i];
    return typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 40) : '';
  });

  const backgroundId =
    typeof body?.backgroundId === 'string' && VALID_BACKGROUNDS.has(body.backgroundId)
      ? body.backgroundId
      : undefined;

  const personaId =
    typeof body?.personaId === 'string' && VALID_PERSONAS.has(body.personaId)
      ? (body.personaId as 'balanced' | 'gritty' | 'epic' | 'whimsical')
      : 'balanced';

  const adventurePreview = getAdventure(adventureId);
  const rawLevel = typeof body?.playerLevel === 'number' ? body.playerLevel : Number(body?.playerLevel);
  const [minL, maxL] = adventurePreview.levelRange ?? [1, 20];
  const playerLevel = Number.isFinite(rawLevel)
    ? Math.min(maxL, Math.max(minL, Math.round(rawLevel)))
    : undefined;

  const access = issueSessionAccess(sessionId);
  const state = await startNewGame(sessionId, {
    adventureId,
    characterIds,
    playerNames,
    playerLevel,
    backgroundId,
    personaId,
  }, access.hash);
  const adventure = getAdventure(adventureId);

  const response = NextResponse.json({
    ok: true,
    sessionId,
    adventureId,
    characterIds: state.characterTemplateIds,
    backgroundId: state.backgroundId,
    title: adventure.title,
    source: adventure.source,
    opening: getOpeningNarration(state),
    sceneId: state.sceneId,
    sceneGoal: getSceneGoal(adventure, state.sceneId),
    nextChoices: getSceneChoices(adventure, state.sceneId),
    party: state.party.map(p => ({
      id: p.id,
      name: p.name,
      race: p.race,
      className: p.className,
      subclass: p.subclass,
      level: p.level,
      hp: p.hp,
      maxHp: p.maxHp,
    })),
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
  response.cookies.set(SESSION_ACCESS_COOKIE, access.cookieValue, sessionAccessCookieOptions());
  return response;
}
