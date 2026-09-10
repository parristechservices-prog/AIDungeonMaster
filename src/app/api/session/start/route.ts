import { NextResponse } from 'next/server';
import { getOpeningNarration } from '@/lib/game/state';
import { getAdventure, isValidAdventureId } from '@/lib/game/adventures/registry.server';
import { getSceneChoices, getSceneGoal } from '@/lib/game/adventures/helpers';
import { visibleNpcsForScene } from '@/lib/game/adventures/visibility';
import { startNewGame } from '@/lib/orchestrator/session-store';

const VALID_CHARACTERS = new Set(['fighter', 'wizard', 'rogue', 'cleric', 'paladin', 'ranger']);
const VALID_BACKGROUNDS = new Set(['soldier', 'scholar', 'criminal', 'acolyte']);
const VALID_PERSONAS = new Set(['balanced', 'gritty', 'epic', 'whimsical']);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId =
    typeof body?.sessionId === 'string' && body.sessionId.length > 0
      ? body.sessionId.slice(0, 64)
      : `sess-${crypto.randomUUID().slice(0, 8)}`;

  const adventureId =
    typeof body?.adventureId === 'string' && isValidAdventureId(body.adventureId)
      ? body.adventureId
      : 'brindlehook-inn';

  const characterIds: string[] = (
    Array.isArray(body?.characterIds)
      ? body.characterIds.filter((id: unknown): id is string => typeof id === 'string' && VALID_CHARACTERS.has(id))
      : [typeof body?.characterId === 'string' && VALID_CHARACTERS.has(body.characterId) ? body.characterId : 'fighter']
  ).slice(0, 4);
  if (characterIds.length === 0) {
    characterIds.push('fighter');
  }

  const rawPlayerNames = Array.isArray(body?.playerNames)
    ? body.playerNames
    : [body?.playerName];
  const playerNames = characterIds.map((_characterId: string, i: number) => {
    const rawName = rawPlayerNames[i];
    if (typeof rawName === 'string' && rawName.trim()) {
      return rawName.trim().slice(0, 40);
    }
    return '';
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

  const state = await startNewGame(sessionId, {
    adventureId,
    characterIds,
    playerNames,
    playerLevel,
    backgroundId,
    personaId,
  });
  const adventure = getAdventure(adventureId);

  return NextResponse.json({
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
}
