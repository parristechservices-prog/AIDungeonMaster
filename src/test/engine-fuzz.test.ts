import { afterEach, expect, it, vi } from 'vitest';
import { resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState, advanceScene } from '@/lib/game/state';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { listAdventures } from '@/lib/game/adventures/registry.server';
import { CHARACTER_TEMPLATES } from '@/lib/game/characters/templates';
import type { GameState } from '@/lib/game/types';

// Seeded PRNG so this fuzz test is deterministic (mulberry32).
function seeded(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let rand = seeded(1);
const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
afterEach(() => { resetRandomProvider(); vi.restoreAllMocks(); });
const SKILLS = ['athletics', 'stealth', 'perception', 'intimidation', 'persuasion', 'animal_handling', 'acrobatics', 'insight'];
const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
function randomRequest(s: GameState): Record<string, unknown> {
  const pc = s.party[0].id;
  const foes = [...s.monsters.map((m) => m.id), ...(s.reserveMonsters ?? []).map((m) => m.id), 'nobody'];
  const foe = pick(foes);
  const map = s.combat.battleMap;
  const opts: Array<() => Record<string, unknown>> = [
    () => ({ kind: 'skill_check', characterId: pc, skill: pick(SKILLS), dc: 5 + Math.floor(rand() * 15), reason: 'x', advancesScene: rand() < 0.2 }),
    () => ({ kind: 'player_attack', characterId: pc, targetId: foe, ...(rand() < 0.3 ? { weapon: pick(['crossbow', 'unarmed', 'improvised chair', 'longsword', 'shortbow', 'dagger', 'nonsense']) } : {}), ranged: rand() < 0.3 }),
    () => ({ kind: 'start_combat', ...(rand() < 0.5 ? { combatants: [{ template: pick(['goblin', 'worg', 'spy', 'ogre', 'hill_giant', 'commoner', 'not_a_monster']), count: 1 + Math.floor(rand() * 3) }] } : {}), ...(rand() < 0.3 ? { surprised: pick(['monsters', 'party']) } : {}) }),
    () => ({ kind: 'end_combat', reason: 'fled' }),
    () => ({ kind: 'remove_combatant', targetId: foe, outcome: pick(['fled', 'surrendered', 'calmed', 'captured']) }),
    () => ({ kind: 'end_turn' }),
    () => ({ kind: 'monster_turn' }),
    () => ({ kind: 'death_save', characterId: pc }),
    () => ({ kind: 'contest', characterId: pc, skill: pick(SKILLS), targetId: foe, passive: rand() < 0.5, reason: 'x' }),
    () => ({ kind: pick(['saving_throw', 'ability_check']), characterId: pc, ability: pick(ABIL), dc: 8 + Math.floor(rand() * 10), reason: 'x', ...(rand() < 0.5 ? { damage: pick(['1d6', '2d6 + 3', '4', '3d10']), halfOnSuccess: true } : {}), ...(rand() < 0.3 ? { conditionOnFail: pick(['prone', 'poisoned', 'restrained']) } : {}) }),
    () => ({ kind: pick(['grapple', 'shove']), characterId: pc, targetId: foe, effect: pick(['prone', 'push']) }),
    () => ({ kind: 'take_action', characterId: pc, action: pick(['dodge', 'hide', 'help', 'ready', 'search']) }),
    () => ({ kind: 'use_item', characterId: pc, item: pick(['Healing Potion', 'Rope', 'Potion of Healing']) }),
    () => ({ kind: 'use_feature', characterId: pc, featureId: pick(s.party[0].features.map((f) => f.id).concat('bogus')) }),
    () => ({ kind: 'cast_spell', characterId: pc, spellName: pick(['Magic Missile', 'Cure Wounds', 'Bless', 'Shield', 'Healing Word']), level: 1, targetId: pick([foe, pc]) }),
    () => ({ kind: pick(['short_rest', 'long_rest']) }),
    () => ({ kind: 'advance_scene' }),
    () => ({ kind: pick(['dash', 'disengage']), actorId: pc }),
    () => ({ kind: 'move_creature', actorId: pc, target: { x: Math.floor(rand() * (map?.width ?? 8)), y: Math.floor(rand() * (map?.height ?? 6)) } }),
    () => ({ kind: pick(['apply_condition', 'remove_condition']), targetId: pick([pc, foe]), condition: pick(['prone', 'frightened', 'grappled', 'blinded', 'poisoned', 'restrained']) }),
    () => ({ kind: 'update_inventory', characterId: pc, add: ['Rope'], goldDelta: Math.floor(rand() * 10) - 3 }),
  ];
  return pick(opts)();
}

function invariants(s: GameState): string[] {
  const bad: string[] = [];
  const ids = new Set([...s.party.map((p) => p.id), ...s.monsters.map((m) => m.id)]);
  if (new Set(s.monsters.map((m) => m.id)).size !== s.monsters.length) bad.push('duplicate monster ids');
  if ((s.reserveMonsters ?? []).some((r) => s.monsters.some((m) => m.id === r.id))) bad.push('monster active and in reserve');
  for (const p of s.party) {
    if (p.hp < 0 || p.hp > p.maxHp) bad.push(`hero hp out of bounds`);
    if (p.hp > 0 && p.unconscious) bad.push('unconscious with hp > 0');
    if (p.hp === 0 && !p.unconscious && p.deathSaves.failure < 3) bad.push('0 hp but conscious');
    if (p.deathSaves.failure > 3 || p.deathSaves.success > 3) bad.push('death saves out of range');
    for (const f of p.features) if (f.usesRemaining < 0 || f.usesRemaining > f.usesMax) bad.push(`feature uses out of range ${f.id}`);
    for (const slot of Object.values(p.spellSlots)) if (slot.remaining < 0 || slot.remaining > slot.max) bad.push('spell slots out of range');
    if (p.inventory.some((i) => /^-?\d+\s/.test(i) && Number(i.split(' ')[0]) <= 0)) bad.push('zero/negative ammo stack');
    if (p.hitDice && (p.hitDice.remaining < 0 || p.hitDice.remaining > p.hitDice.max)) bad.push('hit dice out of range');
    if (p.unconscious && p.conditions.includes('hidden')) bad.push('unconscious but hidden');
  }
  for (const m of s.monsters) if (m.hp < 0 || m.hp > m.maxHp) bad.push(`monster hp out of bounds`);
  if (s.combat.active) {
    for (const e of s.combat.initiative) if (!ids.has(e.actorId)) bad.push('initiative ghost actor');
    for (const id of ids) if (!s.combat.initiative.some((e) => e.actorId === id) && (s.monsters.find((m) => m.id === id)?.hp ?? 1) > 0) bad.push('living combatant missing from initiative');
    if (s.combat.turnIndex < 0 || s.combat.turnIndex >= s.combat.initiative.length) bad.push('turnIndex out of range');
    const cur = s.combat.initiative[s.combat.turnIndex]?.actorId;
    if (s.monsters.some((x) => x.id === cur)) bad.push('turn stuck on monster');
    if (!s.monsters.some((x) => x.hp > 0)) bad.push('combat active, no living enemies');
    if (s.party.every((p) => p.deathSaves.failure >= 3)) bad.push('combat after wipe');
    const map = s.combat.battleMap;
    if (!map) bad.push('combat without battle map');
    else for (const id of ids) if (!map.positions[id] && (s.monsters.find((m) => m.id === id)?.hp ?? 1) > 0) bad.push('living combatant not on map');
  }
  return bad;
}

// Random but well-formed DM requests of every kind must never crash the engine
// or leave the game in an impossible state (ghost combatants, stuck turns...).
it.each([1, 2, 3])('engine survives randomised DM turns (seed %i)', (seed) => {
  rand = seeded(seed);
  setRandomProvider(() => rand());
  vi.spyOn(Math, 'random').mockImplementation(() => rand());
  const problems = new Map<string, number>();
  const advs = listAdventures();
  for (let run = 0; run < 40; run++) {
    const adv = pick(advs);
    let s = createInitialState(`fz-${seed}-${run}`, { adventureId: adv.id, characterIds: [pick(CHARACTER_TEMPLATES).id] });
    for (let i = 0; i < Math.floor(rand() * 4); i++) s = advanceScene(s);
    for (let t = 0; t < 25; t++) {
      const reqs = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => randomRequest(s));
      s = runTurn(s, { engineRequests: reqs, narration: 'x', needsResultBeforeNarrating: true }, { mode: 'ai_director', aiUsed: true, fallbackUsed: false }).state;
      for (const b of invariants(s)) { const k = `${b} :: after ${reqs.map((r) => r.kind).join(',')}`; problems.set(k, (problems.get(k) ?? 0) + 1); }
      if (s.party.every((p) => p.deathSaves.failure >= 3) || s.sceneId === 'ending') break;
    }
  }
  expect([...problems.keys()]).toEqual([]);
}, 120000);
