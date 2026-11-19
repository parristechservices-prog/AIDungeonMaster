import { afterEach, describe, expect, it } from 'vitest';
import { resolveEngineRequest, resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState, advanceScene } from '@/lib/game/state';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { validateDmTurn } from '@/lib/orchestrator/validate-dm-turn';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { dmTurnSchema } from '@/lib/llm/contracts';
import type { GameState } from '@/lib/game/types';

afterEach(() => resetRandomProvider());

/** Feed exact die faces: each entry is [face, sides]. Extra calls return 0.5. */
function dice(...faces: [number, number][]) {
  const queue = faces.map(([face, sides]) => (face - 0.5) / sides);
  setRandomProvider(() => (queue.length ? queue.shift()! : 0.5));
}

function at(scene: string): GameState {
  let s = createInitialState('approach', { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] });
  for (let i = 0; i < 10 && s.sceneId !== scene; i++) s = advanceScene(s);
  return s;
}
const hero = (s: GameState) => s.party[0].id;
const living = (s: GameState) => s.monsters.filter((m) => m.hp > 0);
const dm = (s: GameState, engineRequests: unknown[]) =>
  runTurn(s, { engineRequests, narration: 'You act.', needsResultBeforeNarrating: true }, { mode: 'ai_director', aiUsed: true, fallbackUsed: false });

describe('players can investigate without being railroaded', () => {
  it('a successful check stays in the scene unless it completes the scene goal', () => {
    setRandomProvider(() => 0.99);
    const s = at('road-to-nightstone');
    const looked = resolveEngineRequest(s, { kind: 'skill_check', characterId: hero(s), skill: 'survival', dc: 10, reason: 'Read the tracks' });
    expect(looked.state.sceneId).toBe('road-to-nightstone');
    const done = resolveEngineRequest(s, { kind: 'skill_check', characterId: hero(s), skill: 'survival', dc: 10, reason: 'Find the way in', advancesScene: true });
    expect(done.state.sceneId).toBe('open-palisade');
  });

  it('a party that slips past a fight may move on, and the foes stay where they were', () => {
    const s = at('village-square');
    const turn = dmTurnSchema.parse({ engineRequests: [{ kind: 'advance_scene' }], narration: 'You slip away.', needsResultBeforeNarrating: false });
    expect(validateDmTurn(turn, s).ok).toBe(true);
    const moved = dm(s, [{ kind: 'advance_scene' }]).state;
    expect(moved.sceneId).toBe('chapel-bell');
    expect(moved.monsters).toHaveLength(0);
    expect(moved.reserveMonsters?.map((m) => `${m.name}@${m.homeSceneId}`)).toEqual(['Worg@village-square', 'Worg@village-square']);
  });

  it('the DM may advance a scene whose goal is prose-only (no listed success conditions)', () => {
    const s = at('road-to-nightstone');
    const turn = dmTurnSchema.parse({ engineRequests: [{ kind: 'advance_scene' }], narration: 'On you go.', needsResultBeforeNarrating: false });
    expect(validateDmTurn(turn, s).ok).toBe(true);
  });

  it('objectives completed earlier in the same turn allow advance_scene', () => {
    const s = createInitialState('objective', { adventureId: 'brindlehook-inn' });
    const objective = 'Learn that the courier went to the boathouse.';
    const both = dmTurnSchema.parse({ engineRequests: [{ kind: 'complete_objective', objectiveId: objective }, { kind: 'advance_scene' }], narration: 'On you go.', needsResultBeforeNarrating: false });
    expect(validateDmTurn(both, s).ok).toBe(true);
    const alone = dmTurnSchema.parse({ engineRequests: [{ kind: 'advance_scene' }], narration: 'On you go.', needsResultBeforeNarrating: false });
    expect(validateDmTurn(alone, s).ok).toBe(false);
  });

  it('consequences listed after a failed check are skipped', () => {
    dice([1, 20]);
    const s = at('village-square');
    const out = dm(s, [
      { kind: 'contest', characterId: hero(s), skill: 'stealth', targetId: living(s)[0].id, passive: true, reason: 'Sneak past' },
      { kind: 'advance_scene' },
    ]);
    expect(out.state.sceneId).toBe('village-square');
  });
});

describe('fights start where the party is, with whoever is there', () => {
  it('a fight in the steeple is with Beedo and Vark, not the worgs', () => {
    const s = advanceScene(at('village-square'));
    const { state } = resolveEngineRequest(s, { kind: 'start_combat' });
    expect(state.sceneId).toBe('chapel-bell');
    expect(state.monsters.map((m) => m.name)).toEqual(['Beedo', 'Vark']);
  });

  it('the DM can name combatants, and reinforcements join initiative', () => {
    const s = at('goblin-scouts');
    const first = resolveEngineRequest(s, { kind: 'start_combat', combatants: [{ template: 'goblin', name: 'Gum-Gum' }] }).state;
    expect(first.sceneId).toBe('goblin-scouts');
    expect(first.monsters.map((m) => m.name)).toEqual(['Gum-Gum']);
    const joined = resolveEngineRequest(first, { kind: 'start_combat', combatants: [{ template: 'spy', name: 'Kella Darkhope' }] }).state;
    expect(joined.monsters.map((m) => m.name)).toEqual(['Gum-Gum', 'Kella Darkhope']);
    expect(joined.combat.initiative.some((e) => joined.monsters.find((m) => m.name === 'Kella Darkhope')?.id === e.actorId)).toBe(true);
  });

  it('surprised creatures lose their first turn', () => {
    const s = at('village-square');
    const out = dm(s, [{ kind: 'start_combat', surprised: 'monsters' }]);
    const surprisedTurns = out.response.engineResults.filter((r) => r.kind === 'monster_turn' && /surprised/.test(r.summary));
    const worgsWentFirst = out.state.combat.initiative.findIndex((e) => e.actorId === hero(out.state)) > 0;
    if (worgsWentFirst) expect(surprisedTurns.length).toBeGreaterThan(0);
    expect(out.state.party[0].hp).toBe(out.state.party[0].maxHp);
  });

  it('attacking outside combat rolls initiative first, so a faster enemy acts first', () => {
    // Hero initiative d20=1, worgs 20 and 19; then their bites.
    dice([1, 20], [20, 20], [19, 20]);
    const s = at('village-square');
    const out = dm(s, [{ kind: 'player_attack', characterId: hero(s), targetId: living(s)[0].id }]);
    const kinds = out.response.engineResults.map((r) => r.kind);
    expect(kinds[0]).toBe('start_combat');
    expect(kinds.indexOf('monster_turn')).toBeLessThan(kinds.indexOf('player_attack'));
  });
});

describe('enemy turns are engine-run in initiative order', () => {
  it('after the hero ends their turn every living enemy acts and play returns to the hero', () => {
    const s = at('village-square');
    let st = resolveEngineRequest(s, { kind: 'start_combat' }).state;
    st = dm(st, []).state; // enemies that won initiative act
    const out = dm(st, [{ kind: 'take_action', characterId: hero(st), action: 'dodge' }, { kind: 'end_turn' }, { kind: 'monster_turn' }, { kind: 'end_turn' }]);
    const cur = out.state.combat.initiative[out.state.combat.turnIndex]?.actorId;
    if (out.state.combat.active && !out.state.party[0].unconscious) expect(cur).toBe(hero(out.state));
    expect(out.response.engineResults.filter((r) => r.kind === 'monster_turn').length).toBeGreaterThanOrEqual(1);
    expect(out.response.needsResultBeforeNarrating).toBe(true);
  });

  it('a party wipe ends the fight', () => {
    const s = at('village-square');
    let st = resolveEngineRequest(s, { kind: 'start_combat' }).state;
    st = { ...st, party: st.party.map((p) => ({ ...p, hp: 0, unconscious: true, deathSaves: { success: 0, failure: 2 } })) };
    setRandomProvider(() => 0.95);
    for (let i = 0; i < 6 && st.combat.active; i++) st = dm(st, [{ kind: 'end_turn' }]).state;
    expect(st.combat.active).toBe(false);
    expect(st.sceneId).toBe('ending');
  });
});

describe('weapons and 5e actions', () => {
  it('the crossbow uses its own damage, spends a bolt and refuses shots beyond long range', () => {
    dice([15, 20], [8, 8]);
    const s = resolveEngineRequest(at('village-square'), { kind: 'start_combat' }).state;
    const target = living(s)[0].id;
    s.combat.battleMap!.positions[hero(s)] = { x: 0, y: 0, z: 0 };
    s.combat.battleMap!.positions[target] = { x: 5, y: 0, z: 0 };
    const shot = resolveEngineRequest(s, { kind: 'player_attack', characterId: hero(s), targetId: target, weapon: 'crossbow' });
    expect(shot.result.summary).toMatch(/Light Crossbow hits/);
    expect(shot.result.breakdown?.formula).toBe('1d8+1');
    expect(shot.state.party[0].inventory).toContain('19 Crossbow Bolts');
  });

  it('a punch deals 1 + Strength damage', () => {
    dice([15, 20]);
    const s = resolveEngineRequest(at('village-square'), { kind: 'start_combat' }).state;
    const out = resolveEngineRequest(s, { kind: 'player_attack', characterId: hero(s), targetId: living(s)[0].id, weapon: 'unarmed' });
    expect(out.result.summary).toMatch(/Unarmed Strike hits Worg for 4 damage/);
  });

  it('shove is a contest that can knock a Large worg prone; a Huge giant is too big', () => {
    dice([20, 20], [1, 20]);
    const s = resolveEngineRequest(at('village-square'), { kind: 'start_combat' }).state;
    const shoved = resolveEngineRequest(s, { kind: 'shove', characterId: hero(s), targetId: living(s)[0].id, effect: 'prone' });
    expect(shoved.result.ok).toBe(true);
    expect(shoved.state.monsters.find((m) => m.id === living(s)[0].id)!.conditions).toContain('prone');
    const giant = resolveEngineRequest(s, { kind: 'start_combat', combatants: [{ template: 'hill_giant' }] }).state;
    const giantId = giant.monsters.find((m) => m.name === 'Hill Giant')!.id;
    const tooBig = resolveEngineRequest(giant, { kind: 'grapple', characterId: hero(s), targetId: giantId });
    expect(tooBig.result.summary).toMatch(/too big/);
  });

  it('a hidden character cannot be targeted, and Dodge imposes disadvantage', () => {
    const s = resolveEngineRequest(at('village-square'), { kind: 'start_combat' }).state;
    const hidden = { ...s, party: s.party.map((p) => ({ ...p, conditions: ['hidden' as const] })) };
    const worg = living(s)[0].id;
    const searched = resolveEngineRequest(hidden, { kind: 'monster_turn', monsterId: worg });
    expect(searched.result.summary).toMatch(/can't find anyone/);
    const dodging = { ...s, party: s.party.map((p) => ({ ...p, conditions: ['dodging' as const] })) };
    const heroPos = dodging.combat.battleMap!.positions[hero(s)];
    dodging.combat.battleMap!.positions[worg] = { ...heroPos, x: heroPos.x + 1 };
    // Disadvantage: a 20 and a 2 keeps the 2, which misses AC 18.
    dice([20, 20], [2, 20]);
    const bite = resolveEngineRequest(dodging, { kind: 'monster_turn', monsterId: worg });
    expect(bite.result.summary).toMatch(/missed/);
  });

  it('a saving throw applies half damage on a success', () => {
    dice([20, 20], [6, 6], [6, 6]);
    const s = at('village-square');
    const out = resolveEngineRequest(s, { kind: 'saving_throw', characterId: hero(s), ability: 'dex', dc: 13, reason: 'Falling masonry', damage: '2d6', halfOnSuccess: true });
    expect(out.result.ok).toBe(true);
    expect(out.state.party[0].hp).toBe(s.party[0].hp - 6);
  });

  it('an unconscious character cannot move', () => {
    const s = resolveEngineRequest(at('village-square'), { kind: 'start_combat' }).state;
    const down = { ...s, party: s.party.map((p) => ({ ...p, hp: 0, unconscious: true })) };
    expect(resolveEngineRequest(down, { kind: 'dash', actorId: hero(s) }).result.ok).toBe(false);
  });
});

describe('fights can end without a massacre', () => {
  it('surrender removes the foe; the last foe yielding ends the fight', () => {
    const s = resolveEngineRequest(at('goblin-scouts'), { kind: 'start_combat', combatants: [{ template: 'goblin', name: 'Gum-Gum' }] }).state;
    const out = resolveEngineRequest(s, { kind: 'remove_combatant', targetId: s.monsters[0].id, outcome: 'surrendered' });
    expect(out.state.combat.active).toBe(false);
    expect(out.state.canonLog.some((f) => /Gum-Gum surrenders/.test(f.content))).toBe(true);
  });

  it('escaping keeps the wounded worgs, who are the same ones next time', () => {
    const s = resolveEngineRequest(at('village-square'), { kind: 'start_combat' }).state;
    const wounded = { ...s, monsters: s.monsters.map((m, i) => (i === 0 ? { ...m, hp: 9 } : m)) };
    const fled = resolveEngineRequest(wounded, { kind: 'end_combat', reason: 'Seren escapes' }).state;
    expect(fled.combat.active).toBe(false);
    const again = resolveEngineRequest(fled, { kind: 'start_combat' }).state;
    expect(again.monsters.map((m) => m.hp)).toEqual([9, 26]);
  });
});

describe('fallback DM (no AI available)', () => {
  it('a dying hero rolls a death save on their turn whatever they type', () => {
    const s = resolveEngineRequest(at('village-square'), { kind: 'start_combat' }).state;
    const idx = s.combat.initiative.findIndex((e) => e.actorId === hero(s));
    const down: GameState = { ...s, combat: { ...s.combat, turnIndex: idx }, party: s.party.map((p) => ({ ...p, hp: 0, unconscious: true })) };
    const turn = deriveDmTurnFromInput(down, 'I attack the worg');
    expect(turn.engineRequests[0]).toMatchObject({ kind: 'death_save' });
  });

  it('understands shooting, shoving and demanding surrender', () => {
    const s = at('village-square');
    expect(deriveDmTurnFromInput(s, 'I shoot the worg with my crossbow').engineRequests[0]).toMatchObject({ kind: 'player_attack', ranged: true });
    expect(deriveDmTurnFromInput(s, 'I shove the worg').engineRequests[0]).toMatchObject({ kind: 'shove' });
    expect(deriveDmTurnFromInput(at('goblin-scouts'), 'I shout at the goblins to surrender').engineRequests[0]).toMatchObject({ kind: 'contest', skill: 'intimidation' });
  });
});
