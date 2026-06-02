import { NextResponse } from 'next/server';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { getSceneChoices, getSceneGoal } from '@/lib/game/adventures/helpers';
import { visibleNpcsForScene } from '@/lib/game/adventures/visibility';
import { getOrCreateSession } from '@/lib/orchestrator/session-store';

/** GET session state for reconnect / debug (V0: no auth). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 });
  }

  const state = getOrCreateSession(sessionId);
  const adventure = getAdventure(state.adventureId);
  return NextResponse.json({
    ok: true,
    sessionId,
    adventureId: state.adventureId,
    adventureTitle: adventure.title,
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
      log: state.log.slice(-10),
    },
  });
}
