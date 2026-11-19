import { getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { encounterBattleMap, resolveCombatMonsters } from '@/lib/game/adventures/encounters';
import type { GameState, Character } from '@/lib/game/types';
import { advanceScene, buildBattleMap } from '@/lib/game/state';
import type { EngineRequest, EngineResult, RollBreakdown, OpportunityAttackOutcome, CoverOutcome } from './types';
import { resolveSpatialRequest, type SpatialEngineResult } from './spatial';
import { resolveTacticalRequest, lineOfSight, coverAcBonus, reachableCells, resolveMove, distanceFt, distanceBetweenActors, type TacticalEngineRequest, type TacticalEngineResult, type BattleMap, type CoverKind, type GridCoord } from './spatial/tactical';
import { MONSTER_LIBRARY, getMonster, monsterAttacks } from '@/lib/game/monsters';
import { abilityMod, getHitDice, saveBonus, canGrappleSize, characterSkillBonus, chooseWeapon, monsterSkillBonus, passivePerception } from '@/lib/game/rules';
import type { Condition, Weapon } from '@/lib/game/types';
import type { Monster, MonsterAttack } from '@/lib/game/types';

let randomProvider = Math.random;

export function setRandomProvider(provider: () => number) {
  randomProvider = provider;
}

export function resetRandomProvider() {
  randomProvider = Math.random;
}

function isValidD20Roll(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20;
}

function hasCondition(creature: { conditions: import('@/lib/game/types').Condition[] }, condition: import('@/lib/game/types').Condition): boolean {
  return creature.conditions.includes(condition);
}

function updateCharacterInParty(state: GameState, id: string, updater: (c: Character) => Character): GameState {
  const party = state.party.map(p => p.id === id ? updater(p) : p);
  return {
    ...state,
    party,
    player: party[0],
  };
}

function requestedCharacterId(characterId?: string): string | undefined {
  return characterId;
}

export function resolveEngineRequest(
  state: GameState,
  request: EngineRequest,
  options?: { physicalDice?: boolean }
): { state: GameState; result: EngineResult } {
  switch (request.kind) {
    case 'move_area':
    case 'query_current_area':
    case 'query_exits':
    case 'query_actors_present':
    case 'query_path_exists': {
      if (!state.exploration) {
        return {
          state,
          result: { ok: false, summary: 'No exploration area graph is available for this session.' },
        };
      }
      try {
        const resolved = resolveSpatialRequest(state.exploration, request, deriveSatisfiedTags(state));
        return {
          state: { ...state, exploration: resolved.state },
          result: spatialResultToEngineResult(resolved.result),
        };
      } catch (e) {
        return {
          state,
          result: { ok: false, summary: e instanceof Error ? e.message : 'Spatial request failed.' },
        };
      }
    }
    case 'move_creature':
    case 'dash':
    case 'disengage':
    case 'query_reachable':
    case 'query_targets_in_range':
    case 'check_line_of_sight': {
      const battleMap = state.combat.battleMap;
      if (!state.combat.active || !battleMap) {
        return { state, result: { ok: false, summary: 'No tactical battle map is active.' } };
      }
      if (request.kind === 'move_creature' || request.kind === 'dash' || request.kind === 'disengage') {
        const mover = state.party.find((p) => p.id === request.actorId);
        if (mover?.unconscious) return { state, result: { ok: false, summary: `${mover.name} is unconscious and cannot move.` } };
        if (mover && ['grappled', 'restrained'].some((c) => hasCondition(mover, c as Condition)) && request.kind === 'move_creature') {
          return { state, result: { ok: false, summary: `${mover.name} is ${mover.conditions.includes('grappled') ? 'grappled' : 'restrained'} (speed 0) and must escape first.` } };
        }
      }
      try {
        const resolved = resolveTacticalRequest(battleMap, request as TacticalEngineRequest);
        let nextState: GameState = { ...state, combat: { ...state.combat, battleMap: resolved.map } };
        const engineResult = tacticalResultToEngineResult(resolved.result);

        // A successful move that left hostile reach triggers real opportunity
        // attacks: roll them here against the just-moved creature.
        if (resolved.result.kind === 'move_creature' && resolved.result.result.ok) {
          const triggers = resolved.result.result.opportunityAttacks;
          if (triggers.length > 0) {
            const oa = resolveOpportunityAttacks(nextState, request.actorId, triggers);
            nextState = oa.state;
            if (oa.outcomes.length > 0) {
              engineResult.opportunityAttacks = oa.outcomes;
              const oaSummary = oa.outcomes
                .map((o) => o.warning ?? `${o.attackerName} opportunity attack ${o.hit ? `hits ${o.targetName} for ${o.damage}` : `misses ${o.targetName}`}`)
                .join('; ');
              engineResult.summary = `${engineResult.summary} ${oaSummary}.`;
              for (const o of oa.outcomes) {
                nextState = appendLog(nextState, o.warning ?? `${o.attackerName}'s opportunity attack ${o.hit ? `hits ${o.targetName} for ${o.damage} damage` : `misses ${o.targetName}`}.`);
              }
            }
          }
        }

        return { state: nextState, result: engineResult };
      } catch (e) {
        return {
          state,
          result: { ok: false, summary: e instanceof Error ? e.message : 'Tactical request failed.' },
        };
      }
    }
    case 'skill_check': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (!isValidD20Roll(request.manualRoll) && request.manualRoll !== undefined) {
        return { state, result: { ok: false, summary: 'Manual roll must be an integer between 1 and 20.' } };
      }
      if (char.unconscious) {
        return { state, result: { ok: false, summary: `${char.name} is unconscious and cannot take that action.` } };
      }

      const mod = char.skills[request.skill] ?? 0;
      
      const advantage = request.advantage;
      let disadvantage = request.disadvantage;
      let bonusFormula = undefined;

      if (hasCondition(char, 'poisoned')) disadvantage = true;
      if (hasCondition(char, 'restrained') && (request.skill === 'acrobatics' || request.skill === 'athletics')) disadvantage = true;
      if (hasCondition(char, 'blinded') && (request.skill === 'perception')) disadvantage = true;
      if (hasCondition(char, 'blessed')) bonusFormula = '1d4';

      if (options?.physicalDice && request.manualRoll === undefined) {
        return {
          state,
          result: {
            ok: false,
            summary: `Waiting for manual ${request.skill} roll for ${char.name}...`,
            needsManualRoll: true,
            manualRollContext: {
              kind: 'skill_check',
              formula: `1d20+${mod}${bonusFormula ? '+1d4' : ''}`,
              dc: request.dc,
              advantage,
              disadvantage,
            },
          },
        };
      }

      const breakdown = request.manualRoll !== undefined 
        ? { formula: `1d20+${mod}`, rolls: [request.manualRoll], modifier: mod, total: request.manualRoll + mod }
        : rollFormula('1d20', mod, { advantage, disadvantage, bonusFormula });
      
      const ok = breakdown.total >= request.dc;
      breakdown.dc = request.dc;
      breakdown.ok = ok;
      // A check only moves the story on when the DM marks it as completing the
      // scene goal; investigating, climbing or sneaking around stays in the scene.
      const inCombatScene =
        getSceneKind(getAdventure(state.adventureId), state.sceneId) === 'combat';
      const next = ok && request.advancesScene && !inCombatScene && !state.combat.active ? advanceScene(state) : state;
      return {
        state: appendLog(next, `${char.name}: ${request.skill} check ${ok ? 'passed' : 'failed'} (${breakdown.total} vs DC ${request.dc})`),
        result: { ok, summary: `${request.reason}: ${ok ? 'success' : 'failure'}`, breakdown },
      };
    }
    case 'start_combat': {
      const adventure = getAdventure(state.adventureId);
      const living = (list: Monster[] | undefined) => (list ?? []).filter((m) => m.hp > 0);
      // Who is fighting? 1) combatants the DM names, 2) hostiles already here,
      // 3) this scene's authored encounter, 4) for legacy scenes with nothing
      // authored, the next combat scene's encounter.
      let reserve = state.reserveMonsters ?? [];
      const spawned: Monster[] = [];
      if (request.combatants?.length) {
        for (const c of request.combatants) {
          if (c.monsterId) {
            const found = [...state.monsters, ...reserve].find((m) => m.id === c.monsterId && m.hp > 0);
            if (found) { spawned.push(found); reserve = reserve.filter((m) => m.id !== found.id); }
            continue;
          }
          if (!c.template || !MONSTER_LIBRARY[c.template]) {
            return { state, result: { ok: false, summary: `Unknown combatant template "${c.template ?? '?'}". Known: ${Object.keys(MONSTER_LIBRARY).join(', ')}.` } };
          }
          const count = Math.max(1, Math.min(12, c.count ?? 1));
          for (let n = 0; n < count; n++) {
            const base = getMonster(c.template);
            const name = c.name ? (count > 1 ? `${c.name} ${n + 1}` : c.name) : base.name;
            const id = uniqueMonsterId(state, `${slugifyTag(c.name ?? c.template)}${count > 1 ? `-${n + 1}` : ''}`, spawned);
            spawned.push({ ...base, id, name });
          }
        }
      }

      if (state.combat.active) {
        if (spawned.length === 0) {
          const repaired = repairMissingEncounter(state);
          return { state: repaired, result: { ok: repaired !== state, summary: repaired !== state
            ? 'Missing enemies restored to initiative.' : 'Combat is already active.' } };
        }
        // Reinforcements join the fight with their own initiative.
        const joined = joinCombat({ ...state, reserveMonsters: reserve }, spawned);
        return { state: appendLog(joined, `${spawned.map((m) => m.name).join(', ')} join the fight!`), result: { ok: true, summary: `${spawned.map((m) => m.name).join(', ')} join the fight and roll initiative.` } };
      }

      let monsters: Monster[];
      let sceneId = state.sceneId;
      if (spawned.length > 0) {
        // Hostiles already present but not named stay nearby, out of this fight.
        const bystanders = living(state.monsters).filter((m) => !spawned.some((x) => x.id === m.id));
        reserve = [...reserve, ...bystanders.map((m) => ({ ...m, homeSceneId: m.homeSceneId ?? state.sceneId }))];
        monsters = spawned;
      } else if (living(state.monsters).length > 0) {
        monsters = state.monsters;
        // Legacy adventures pre-place the first fight's monsters; starting combat
        // outside a combat scene there means "go to that fight".
        if (!adventure.playConfig?.spawnMonstersOnCombatOnly && getSceneKind(adventure, state.sceneId) !== 'combat' && !adventure.sceneEncounters?.[state.sceneId]) {
          sceneId = adventure.sceneOrder.find((id) => adventure.scenes[id]?.kind === 'combat') ?? state.sceneId;
        }
      } else if (reserve.some((m) => m.hp > 0 && m.homeSceneId === state.sceneId)) {
        monsters = reserve.filter((m) => m.hp > 0 && m.homeSceneId === state.sceneId);
        reserve = reserve.filter((m) => !monsters.includes(m));
      } else if ((adventure.sceneEncounters?.[state.sceneId] || getSceneKind(adventure, state.sceneId) === 'combat') && !state.monsters.some((m) => m.hp <= 0)) {
        monsters = resolveCombatMonsters(adventure, state.sceneId, state.party[0].level);
      } else if (getSceneKind(adventure, state.sceneId) !== 'combat' && state.monsters.length === 0) {
        const from = Math.max(0, adventure.sceneOrder.indexOf(state.sceneId));
        const nextCombat = adventure.sceneOrder.slice(from).find((id) => adventure.scenes[id]?.kind === 'combat');
        if (!nextCombat) return { state, result: { ok: false, summary: 'No enemies are present. Name the combatants (start_combat.combatants).' } };
        monsters = resolveCombatMonsters(adventure, nextCombat, state.party[0].level);
        sceneId = nextCombat;
      } else {
        return { state, result: { ok: false, summary: 'No active enemies to roll initiative for. Name the combatants (start_combat.combatants).' } };
      }
      if (!monsters.some((m) => m.hp > 0)) {
        return { state, result: { ok: false, summary: 'No active enemies to roll initiative for.' } };
      }

      // Surprise (5e): stealthy attackers vs passive Perception decide this; the
      // DM names who is surprised. Surprised creatures lose their first turn.
      const surprisedIds = resolveSurpriseIds(state, monsters, request.surprised);
      const started = beginCombat({ ...state, sceneId, reserveMonsters: reserve }, monsters, surprisedIds);
      const surpriseNote = surprisedIds.length
        ? ` Surprised: ${surprisedIds.map((id) => started.monsters.find((m) => m.id === id)?.name ?? started.party.find((p) => p.id === id)?.name ?? id).join(', ')}.`
        : '';
      return {
        state: appendLog(started, `Combat started. Roll for initiative!${surpriseNote}`),
        result: { ok: true, summary: `Initiative rolled: ${started.combat.initiative.map((e) => `${started.monsters.find((m) => m.id === e.actorId)?.name ?? started.party.find((p) => p.id === e.actorId)?.name ?? e.actorId} ${e.roll}`).join(', ')}.${surpriseNote}` },
      };
    }
    case 'end_combat': {
      if (!state.combat.active) return { state, result: { ok: true, summary: 'Not in combat.' } };
      // The party escapes, both sides back off, or a truce is struck. Enemies keep
      // their wounds and stay where they are; they can return later.
      const next: GameState = { ...state, combat: { active: false, initiative: [], turnIndex: 0 } };
      const why = request.reason?.trim() || 'The fight breaks off.';
      return { state: appendLog(next, `Combat ends: ${why}`), result: { ok: true, summary: `Combat ends: ${why}` } };
    }
    case 'remove_combatant': {
      const m = state.monsters.find((x) => x.id === request.targetId);
      if (!m) return { state, result: { ok: false, summary: `No combatant ${request.targetId}.` } };
      const outcome = request.outcome ?? 'fled';
      const verb: Record<string, string> = { fled: 'flees', surrendered: 'surrenders', captured: 'is captured', calmed: 'is calmed and backs off', dismissed: 'leaves the fight', befriended: 'stops fighting' };
      let next = removeMonster(state, m.id);
      if (outcome === 'surrendered' || outcome === 'captured') {
        next = { ...next, canonLog: [...next.canonLog, { id: `fact-${next.canonLog.length + 1}`, content: `${m.name} ${verb[outcome]} (${m.hp}/${m.maxHp} HP) and is in the party's custody.`, importance: 'medium' }] };
      } else {
        // Fled creatures leave the area; calmed or dismissed ones are still around.
        next = { ...next, reserveMonsters: [...(next.reserveMonsters ?? []), { ...m, conditions: [], homeSceneId: outcome === 'fled' ? undefined : state.sceneId }] };
      }
      const wasFighting = state.combat.active;
      next = finishCombatIfResolved(next);
      const summary = `${m.name} ${verb[outcome] ?? 'leaves the fight'}.${wasFighting && !next.combat.active ? ' No enemies remain in the fight.' : ''}`;
      return { state: appendLog(next, summary), result: { ok: true, summary } };
    }
    case 'contest': {
      // Opposed check (5e): grapple escapes, Stealth vs Perception, Deception vs
      // Insight, tug-of-war... A tie leaves things as they were (initiator fails).
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (char.unconscious) return { state, result: { ok: false, summary: `${char.name} is unconscious.` } };
      const foe = state.monsters.find((m) => m.id === request.targetId) ?? [...(state.reserveMonsters ?? [])].find((m) => m.id === request.targetId);
      const npc = foe ? undefined : state.npcs.find((n) => n.id === request.targetId);
      if (!foe && !npc) return { state, result: { ok: false, summary: `No creature ${request.targetId} to contest.` } };
      const oppSkill = request.targetSkill ?? defaultOpposingSkill(request.skill);
      const oppBonus = foe ? monsterSkillBonus(foe, oppSkill) : (request.targetBonus ?? 0);
      const helped = hasCondition(char, 'helped');
      const mine = rollFormula('1d20', characterSkillBonus(char, request.skill), {
        advantage: request.advantage || helped,
        disadvantage: request.disadvantage || hasCondition(char, 'poisoned'),
        bonusFormula: hasCondition(char, 'blessed') ? '1d4' : undefined,
      });
      const theirs = request.passive ? { total: 10 + oppBonus, formula: `passive ${oppSkill}`, rolls: [], modifier: oppBonus } : rollFormula('1d20', oppBonus);
      const ok = request.passive ? mine.total >= theirs.total : mine.total > theirs.total;
      mine.dc = theirs.total; mine.ok = ok;
      let next = helped ? updateCharacterInParty(state, char.id, (c) => ({ ...c, conditions: c.conditions.filter((x) => x !== 'helped') })) : state;
      next = spendAction(next, char.id, request.usesAction);
      const oppName = foe?.name ?? npc!.name;
      const summary = `${request.reason}: ${char.name} ${request.skill} ${mine.total} vs ${oppName} ${request.passive ? 'passive ' : ''}${oppSkill} ${theirs.total}: ${ok ? 'success' : 'failure'}.`;
      return { state: appendLog(next, summary), result: { ok, summary, breakdown: mine } };
    }
    case 'ability_check':
    case 'saving_throw': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      const isSave = request.kind === 'saving_throw';
      // Unconscious creatures automatically fail Strength and Dexterity saves.
      if (isSave && char.unconscious && (request.ability === 'str' || request.ability === 'dex')) {
        const next = request.damage ? applyPcDamage(state, char.id, rollFormula(request.damage).total) : state;
        return { state: next, result: { ok: false, summary: `${request.reason}: ${char.name} is unconscious and automatically fails.` } };
      }
      const bonus = isSave ? saveBonus(char, request.ability) : abilityMod(char.abilities[request.ability]);
      const helped = !isSave && hasCondition(char, 'helped');
      const roll = rollFormula('1d20', bonus, {
        advantage: request.advantage || helped || (isSave && request.ability === 'dex' && hasCondition(char, 'dodging')),
        disadvantage: request.disadvantage || (!isSave && hasCondition(char, 'poisoned')) || (isSave && request.ability === 'dex' && hasCondition(char, 'restrained')),
        bonusFormula: hasCondition(char, 'blessed') ? '1d4' : undefined,
      });
      const ok = roll.total >= request.dc;
      roll.dc = request.dc; roll.ok = ok;
      let next = helped ? updateCharacterInParty(state, char.id, (c) => ({ ...c, conditions: c.conditions.filter((x) => x !== 'helped') })) : state;
      let dmgNote = '';
      if (request.damage) {
        const raw = rollFormula(request.damage).total;
        const dmg = ok ? (request.halfOnSuccess ? Math.floor(raw / 2) : 0) : raw;
        if (dmg > 0) { next = applyPcDamage(next, char.id, dmg); dmgNote = ` Takes ${dmg}${request.damageType ? ` ${request.damageType}` : ''} damage.`; }
        else dmgNote = ' Takes no damage.';
      }
      if (!ok && request.conditionOnFail) {
        next = updateCharacterInParty(next, char.id, (c) => ({ ...c, conditions: c.conditions.includes(request.conditionOnFail!) ? c.conditions : [...c.conditions, request.conditionOnFail!] }));
        dmgNote += ` ${char.name} is ${request.conditionOnFail}.`;
      }
      const label = `${request.ability.toUpperCase()} ${isSave ? 'save' : 'check'}`;
      const summary = `${request.reason}: ${char.name} ${label} ${roll.total} vs DC ${request.dc}: ${ok ? 'success' : 'failure'}.${dmgNote}`;
      return { state: appendLog(next, summary), result: { ok, summary, breakdown: roll } };
    }
    case 'grapple':
    case 'shove': {
      // 5e: replaces one attack. Athletics vs the target's Athletics or Acrobatics;
      // the target can be at most one size larger.
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (char.unconscious) return { state, result: { ok: false, summary: `${char.name} is unconscious.` } };
      const target = state.monsters.find((m) => m.id === request.targetId && m.hp > 0);
      if (!target) return { state, result: { ok: false, summary: 'No valid target.' } };
      if (!canGrappleSize('medium', target.size)) {
        return { state, result: { ok: false, summary: `${target.name} is too big to ${request.kind} (more than one size larger).` } };
      }
      if (request.kind === 'grapple' && hasCondition(target, 'grappled')) {
        return { state, result: { ok: false, summary: `${target.name} is already grappled.` } };
      }
      const approach = approachForMelee(state, char.id, target.id, false);
      if (approach.result) return { state: approach.state, result: approach.result };
      let next = approach.state;
      if (next.combat.battleMap?.actors[char.id]?.actionUsed) {
        return { state, result: { ok: false, summary: `${char.name} has already used their action this turn.` } };
      }
      next = spendAction(next, char.id, true);
      const mine = rollFormula('1d20', characterSkillBonus(char, 'athletics'), { advantage: hasCondition(char, 'helped') || hasCondition(char, 'hidden') });
      const theirSkill = monsterSkillBonus(target, 'athletics') >= monsterSkillBonus(target, 'acrobatics') ? 'athletics' : 'acrobatics';
      const theirs = rollFormula('1d20', monsterSkillBonus(target, theirSkill), { disadvantage: hasCondition(target, 'surprised') && false });
      const ok = mine.total > theirs.total;
      mine.dc = theirs.total; mine.ok = ok;
      next = updateCharacterInParty(next, char.id, (c) => ({ ...c, conditions: c.conditions.filter((x) => x !== 'helped' && x !== 'hidden') }));
      let effect = '';
      if (ok) {
        if (request.kind === 'grapple') {
          next = addMonsterCondition(next, target.id, 'grappled');
          effect = `${target.name} is grappled (speed 0).`;
        } else if (request.effect === 'push') {
          next = pushMonsterAway(next, char.id, target.id);
          effect = `${target.name} is shoved 5 ft away.`;
        } else {
          next = addMonsterCondition(next, target.id, 'prone');
          effect = `${target.name} is knocked prone.`;
        }
      }
      if (!next.combat.active && next.monsters.some((m) => m.hp > 0)) next = beginCombat(next, next.monsters, []);
      const verb = request.kind === 'grapple' ? 'Grapple' : request.effect === 'push' ? 'Shove (push)' : 'Shove (prone)';
      const summary = `${approach.note}${verb}: ${char.name} Athletics ${mine.total} vs ${target.name} ${theirSkill} ${theirs.total}: ${ok ? `success. ${effect}` : 'failure.'}`;
      return { state: appendLog(next, summary), result: { ok, summary, breakdown: mine } };
    }
    case 'take_action': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (char.unconscious) return { state, result: { ok: false, summary: `${char.name} is unconscious.` } };
      if (state.combat.active && state.combat.battleMap?.actors[char.id]?.actionUsed) {
        return { state, result: { ok: false, summary: `${char.name} has already used their action this turn.` } };
      }
      let next = spendAction(state, char.id, true);
      const addCond = (id: string, cond: Condition) => updateCharacterInParty(next, id, (c) => ({ ...c, conditions: c.conditions.includes(cond) ? c.conditions : [...c.conditions, cond] }));
      switch (request.action) {
        case 'dodge': {
          next = addCond(char.id, 'dodging');
          const summary = `${char.name} takes the Dodge action: attacks against them have disadvantage until their next turn.`;
          return { state: appendLog(next, summary), result: { ok: true, summary } };
        }
        case 'help': {
          const ally = state.party.find((p) => p.id === request.targetId && p.id !== char.id);
          if (!ally) return { state, result: { ok: false, summary: 'Help needs an ally as the target.' } };
          next = addCond(ally.id, 'helped');
          const summary = `${char.name} helps ${ally.name}: advantage on their next attack or ability check.`;
          return { state: appendLog(next, summary), result: { ok: true, summary } };
        }
        case 'hide': {
          // Stealth vs the best passive Perception of enemies who could notice.
          const watchers = state.monsters.filter((m) => m.hp > 0 && !hasCondition(m, 'unconscious'));
          const dc = watchers.length ? Math.max(...watchers.map((m) => passivePerception(m))) : (request.dc ?? 10);
          const roll = rollFormula('1d20', characterSkillBonus(char, 'stealth'), {
            advantage: hasCondition(char, 'helped'),
            disadvantage: char.inventory.some((i) => /chain mail|splint|plate|ring mail/i.test(i)),
          });
          const ok = roll.total >= dc;
          roll.dc = dc; roll.ok = ok;
          if (ok) next = addCond(char.id, 'hidden');
          const armour = char.inventory.some((i) => /chain mail|splint|plate|ring mail/i.test(i)) ? ' (heavy armour: disadvantage)' : '';
          const summary = `${char.name} tries to hide: Stealth ${roll.total} vs passive Perception ${dc}${armour}: ${ok ? 'hidden' : 'spotted'}.`;
          return { state: appendLog(next, summary), result: { ok, summary, breakdown: roll } };
        }
        default: {
          const what = { ready: 'readies an action', search: 'searches', use_object: 'uses an object' }[request.action] ?? 'acts';
          const summary = `${char.name} ${what}${request.reason ? `: ${request.reason}` : ''}.`;
          return { state: appendLog(next, summary), result: { ok: true, summary } };
        }
      }
    }
    case 'player_attack': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (!isValidD20Roll(request.manualRoll) && request.manualRoll !== undefined) {
        return { state, result: { ok: false, summary: 'Manual roll must be an integer between 1 and 20.' } };
      }
      if (char.unconscious) {
        return { state, result: { ok: false, summary: `${char.name} is unconscious and cannot attack.` } };
      }

      const target = state.monsters.find((m) => m.id === request.targetId && m.hp > 0);
      if (!target) return { state, result: { ok: false, summary: 'No valid target.' } };

      // Which weapon? Named weapon, else a ranged one when asked, else the main melee weapon.
      const chosen = chooseWeapon(char, request.weapon, request.ranged);
      if ('error' in chosen) return { state, result: { ok: false, summary: chosen.error } };
      const weapon: Weapon = chosen;
      const isRanged = weapon.kind === 'ranged';
      let ammoNote = '';
      if (weapon.ammo) {
        const ammoIdx = char.inventory.findIndex((i) => new RegExp(`^(\\d+)\\s+${weapon.ammo}$`, 'i').test(i) || i.toLowerCase() === weapon.ammo!.toLowerCase());
        const count = ammoIdx >= 0 ? Number(/^(\d+)/.exec(char.inventory[ammoIdx])?.[1] ?? 1) : 0;
        if (count <= 0) return { state, result: { ok: false, summary: `${char.name} is out of ${weapon.ammo.toLowerCase()} for the ${weapon.name}.` } };
        const left = count - 1;
        state = updateCharacterInParty(state, char.id, (c) => ({
          ...c,
          inventory: left > 0 ? c.inventory.map((it, i) => (i === ammoIdx ? `${left} ${weapon.ammo}` : it)) : c.inventory.filter((_, i) => i !== ammoIdx),
        }));
        ammoNote = ` (${left} ${weapon.ammo!.toLowerCase()} left)`;
      }

      // 5e move-then-attack: a melee attacker out of reach first spends their
      // remaining movement to close in (as monster turns already do). If they
      // still can't reach, they end up as close as possible with the action unspent.
      const approach = approachForMelee(state, char.id, target.id, isRanged);
      if (approach.result) return { state: approach.state, result: approach.result };
      state = approach.state;
      const approachNote = approach.note;

      const map = state.combat.battleMap;
      let nextState = state;
      if (map) {
        const actor = map.actors[char.id];
        if (actor) {
          if (actor.actionUsed) {
            return { state, result: { ok: false, summary: `${char.name} has already used their action this turn.` } };
          }
          nextState = {
            ...state,
            combat: {
              ...state.combat,
              battleMap: {
                ...map,
                actors: {
                  ...map.actors,
                  [char.id]: { ...actor, actionUsed: true },
                },
              },
            },
          };
        }
      }

      // Spatial cover for ranged/spell attacks: total cover (or a blocked sight
      // line) makes the shot impossible; half/three-quarters raise effective AC.
      // Melee attacks ignore cover (5e), so this only applies when ranged.
      let coverOutcome: CoverOutcome | undefined;
      let effectiveTargetAc = target.ac;
      let rangeDisadvantage = false;
      let rangeNote = '';
      if (isRanged && state.combat.battleMap?.positions[char.id] && state.combat.battleMap.positions[target.id]) {
        const bm = state.combat.battleMap;
        const dist = distanceBetweenActors(bm, char.id, target.id) ?? 0;
        const long = weapon.longRangeFt ?? weapon.rangeFt ?? 0;
        if (long && dist > long) {
          return { state, result: { ok: false, summary: `${target.name} is ${dist} ft away, beyond the ${weapon.name}'s ${long} ft long range.` } };
        }
        if (weapon.rangeFt && dist > weapon.rangeFt) { rangeDisadvantage = true; rangeNote = ' (long range: disadvantage)'; }
        // A ranged attack with a conscious enemy within 5 ft has disadvantage (5e).
        const threatened = state.monsters.some((m) => m.hp > 0 && !hasCondition(m, 'surprised') && bm.positions[m.id] && (distanceBetweenActors(bm, char.id, m.id) ?? 99) <= 5);
        if (threatened) { rangeDisadvantage = true; rangeNote += ' (enemy within 5 ft: disadvantage)'; }
      }
      if (isRanged) {
        const cov = resolveSpatialCover(state.combat.battleMap, char.id, target.id);
        if (cov.available && cov.blocked) {
          return {
            state,
            result: {
              ok: false,
              summary: `${target.name} has total cover and cannot be targeted directly.`,
              cover: { kind: 'total', baseAc: target.ac, bonus: 0, effectiveAc: target.ac },
            },
          };
        }
        if (cov.available && cov.bonus > 0) {
          effectiveTargetAc = target.ac + cov.bonus;
          coverOutcome = { kind: cov.cover, baseAc: target.ac, bonus: cov.bonus, effectiveAc: effectiveTargetAc };
        }
      }

      const attackMod = weapon.attackBonus;
      let advantage = request.advantage;
      let disadvantage = request.disadvantage || rangeDisadvantage;
      // Unseen attacker (hidden) or an ally's Help: advantage. Both are spent by the attack.
      const spentConditions: Condition[] = [];
      if (hasCondition(char, 'hidden')) { advantage = true; spentConditions.push('hidden'); }
      if (hasCondition(char, 'helped')) { advantage = true; spentConditions.push('helped'); }
      if (hasCondition(char, 'frightened')) disadvantage = true;
      if (hasCondition(target, 'dodging')) disadvantage = true;
      if (hasCondition(target, 'surprised') || hasCondition(target, 'hidden')) {
        // Surprised creatures can't react; hidden ones must be found before you aim (DM's call).
      }
      if (spentConditions.length) {
        state = updateCharacterInParty(state, char.id, (c) => ({ ...c, conditions: c.conditions.filter((x) => !spentConditions.includes(x)) }));
        nextState = updateCharacterInParty(nextState, char.id, (c) => ({ ...c, conditions: c.conditions.filter((x) => !spentConditions.includes(x)) }));
      }
      let bonusFormula = undefined;

      // Attacker conditions
      if (hasCondition(char, 'blinded')) disadvantage = true;
      if (hasCondition(char, 'poisoned')) disadvantage = true;
      if (hasCondition(char, 'prone')) disadvantage = true;
      if (hasCondition(char, 'restrained')) disadvantage = true;
      if (hasCondition(char, 'blessed')) bonusFormula = '1d4';

      // Target conditions
      if (hasCondition(target, 'blinded')) advantage = true;
      if (hasCondition(target, 'paralyzed') || hasCondition(target, 'stunned') || hasCondition(target, 'unconscious')) advantage = true;
      if (hasCondition(target, 'restrained')) advantage = true;
      if (hasCondition(target, 'guiding_bolt_target')) advantage = true;
      // Prone target: advantage for melee, disadvantage for ranged (5e).
      if (hasCondition(target, 'prone')) {
        if (isRanged) disadvantage = true; else advantage = true;
      }

      if (options?.physicalDice && request.manualRoll === undefined) {
        return {
          state,
          result: {
            ok: false,
            summary: `Waiting for manual attack roll from ${char.name} against ${target.name}...`,
            needsManualRoll: true,
            manualRollContext: {
              kind: 'player_attack',
              formula: `1d20+${attackMod}${bonusFormula ? '+1d4' : ''}`,
              dc: effectiveTargetAc,
              advantage,
              disadvantage,
            },
          },
        };
      }

      const toHit = request.manualRoll !== undefined
        ? { formula: `1d20+${attackMod}`, rolls: [request.manualRoll], modifier: attackMod, total: request.manualRoll + attackMod, dc: effectiveTargetAc }
        : rollFormula('1d20', attackMod, { advantage, disadvantage, bonusFormula });

      toHit.dc = effectiveTargetAc;
      // Crit on the die actually KEPT: with advantage keptRoll is the higher die,
      // with disadvantage the lower, so a natural 20 on a discarded die never crits.
      const naturalRoll = toHit.keptRoll ?? toHit.rolls[0];
      // 5e: a natural 1 always misses and a natural 20 always hits. A Champion's
      // Improved Critical (level 3) makes a hitting 19 a critical hit too.
      const champion = char.features.some((f) => f.id === 'improved_critical')
        || (char.className === 'Fighter' && char.subclass === 'Champion' && char.level >= 3);
      const critMin = champion ? 19 : 20;
      toHit.ok = naturalRoll !== 1 && (naturalRoll === 20 || toHit.total >= effectiveTargetAc);
      const critical = toHit.ok && naturalRoll >= critMin;

      if (!toHit.ok) {
        const coverNote = coverOutcome ? ` (${coverOutcome.kind.replace('_', '-')} cover: AC ${coverOutcome.baseAc}+${coverOutcome.bonus})` : '';
        // Attacking an enemy outside combat starts the fight (initiative, map).
        const missed = nextState.combat.active ? nextState : beginCombat(nextState, nextState.monsters, []);
        return { state: appendLog(missed, `${char.name} missed ${target.name}.`), result: { ok: false, summary: `${approachNote}${weapon.name} attack missed${coverNote}${rangeNote}.${ammoNote}`, breakdown: toHit, cover: coverOutcome } };
      }
      // Use the weapon's damage; a crit doubles the dice (5e).
      const damage = rollFormula(critical ? critFormula(weapon.damage) : weapon.damage);
      const monsters = nextState.monsters.map((m) => m.id === target.id ? { ...m, hp: Math.max(0, m.hp - damage.total) } : m);
      let next = { ...nextState, monsters };
      if (monsters.some((m) => m.hp > 0) && !next.combat.active) {
        // Attacking living enemies starts combat, so initiative and enemy turns follow.
        next = beginCombat(next, next.monsters, []);
      }
      next = finishCombatIfResolved(next);
      const killed = monsters.find((m) => m.id === target.id)!.hp <= 0;
      return {
        state: appendLog(next, `${char.name} hit ${target.name} with the ${weapon.name} for ${damage.total}.${killed ? ` ${target.name} drops.` : ''}`),
        result: { ok: true, summary: `${approachNote}${weapon.name} hits ${target.name} for ${damage.total} damage.${critical ? ' Critical hit!' : ''}${killed ? ` ${target.name} is down.` : ''}${coverOutcome ? ` (${coverOutcome.kind.replace('_', '-')} cover applied, AC ${coverOutcome.effectiveAc})` : ''}${rangeNote}${ammoNote}`, breakdown: damage, critical, cover: coverOutcome },
      };
    }
    case 'end_turn': {
      if (!state.combat.active) return { state, result: { ok: false, summary: 'Not in combat.' } };
      const init = state.combat.initiative;
      if (init.length === 0) return { state, result: { ok: false, summary: 'No initiative order.' } };
      
      // Skip creatures that are dead (monsters at 0 HP, characters with 3 failed saves).
      const canAct = (id: string) => {
        const m = state.monsters.find((x) => x.id === id);
        if (m) return m.hp > 0;
        const p = state.party.find((x) => x.id === id);
        return p ? p.deathSaves.failure < 3 : false;
      };
      let nextTurnIndex = (state.combat.turnIndex + 1) % init.length;
      for (let step = 0; step < init.length && !canAct(init[nextTurnIndex].actorId); step++) {
        nextTurnIndex = (nextTurnIndex + 1) % init.length;
      }
      const nextActorId = init[nextTurnIndex].actorId;
      const standing = isProne(state, nextActorId);
      
      const nextState: GameState = {
        ...state,
        combat: { ...state.combat, turnIndex: nextTurnIndex },
        activeCharacterId: nextActorId,
      };

      if (nextState.combat.battleMap) {
        const actor = nextState.combat.battleMap.actors[nextActorId];
        if (actor) {
          nextState.combat.battleMap = {
            ...nextState.combat.battleMap,
            actors: {
              ...nextState.combat.battleMap.actors,
              [nextActorId]: {
                ...actor,
                actionUsed: false,
                bonusActionUsed: false,
                // Standing up from prone costs half your speed (5e).
                movementSpentFt: standing ? Math.floor(actor.speedFt / 2) : 0,
                extraMovementFt: 0,
                reactionAvailable: true,
                disengaged: false,
              },
            },
          };
        }
      }
      let afterStand = standing ? removeConditionFrom(nextState, nextActorId, 'prone') : nextState;
      // Dodge lasts until the start of the dodger's next turn.
      afterStand = removeConditionFrom(afterStand, nextActorId, 'dodging');
      const standNote = standing ? ' They stand up from prone, using half their movement.' : '';
      return { state: appendLog(afterStand, `Turn ended. It is now ${nextActorId}'s turn.${standNote}`), result: { ok: true, summary: `Ended turn. It is now ${nextActorId}'s turn.${standNote}` } };
    }
    case 'monster_turn': {
      // 5e turn order: the monster that acts is the one whose initiative turn it is.
      const currentId = state.combat.active ? state.combat.initiative[state.combat.turnIndex]?.actorId : undefined;
      const currentIsMonster = Boolean(currentId && state.monsters.some((m) => m.id === currentId));
      // Only enforce strict order when monsters are actually in the initiative list
      // (legacy saves and some authored setups track the party alone).
      const orderHasMonsters = state.combat.initiative.some((e) => state.monsters.some((m) => m.id === e.actorId));
      if (orderHasMonsters && currentId && !currentIsMonster && !request.monsterId) {
        const pc = state.party.find((p) => p.id === currentId);
        return { state, result: { ok: false, summary: `It is ${pc?.name ?? currentId}'s turn, not a monster's. End the turn first.` } };
      }
      const wantedId = request.monsterId ?? (currentIsMonster ? currentId : undefined);
      let attacker = wantedId
        ? state.monsters.find((m) => m.id === wantedId && m.hp > 0)
        : state.monsters.find((m) => m.hp > 0);
      if (!attacker) {
        const anyAlive = state.monsters.some((m) => m.hp > 0);
        return { state, result: { ok: true, summary: anyAlive ? 'That monster is down and cannot act.' : 'No monsters remain.' } };
      }
      // A grapple ends once no conscious character is holding on within 5 ft.
      if (hasCondition(attacker, 'grappled')) {
        const bm = state.combat.battleMap;
        const heldId = attacker.id;
        const held = state.party.some((p) => !p.unconscious && bm?.positions[p.id] && bm.positions[heldId] && (distanceBetweenActors(bm, p.id, heldId) ?? 99) <= 5);
        if (!held) {
          state = removeConditionFrom(state, attacker.id, 'grappled');
          const freedId = attacker.id;
          attacker = state.monsters.find((m) => m.id === freedId)!;
        }
      }
      if (hasCondition(attacker, 'surprised')) {
        const next = removeConditionFrom(state, attacker.id, 'surprised');
        return { state: appendLog(next, `${attacker.name} is surprised and loses its turn.`), result: { ok: true, summary: `${attacker.name} is surprised and loses its turn.` } };
      }
      if (['incapacitated', 'paralyzed', 'stunned', 'unconscious', 'petrified'].some((c) => hasCondition(attacker, c as Condition))) {
        return { state, result: { ok: true, summary: `${attacker.name} is incapacitated and cannot act.` } };
      }
      // Hidden characters can't be targeted until found.
      const hiddenPcs = state.party.filter((p) => !p.unconscious && hasCondition(p, 'hidden'));
      const consciousPlayers = state.party.filter((p) => !p.unconscious && !hasCondition(p, 'hidden'));
      if (consciousPlayers.length === 0 && hiddenPcs.length > 0 && state.party.every((p) => p.unconscious || hasCondition(p, 'hidden'))) {
        // It searches (Perception vs the hider's Stealth was already beaten), so it loses track.
        return { state: appendLog(state, `${attacker.name} prowls, searching for its hidden prey.`), result: { ok: true, summary: `${attacker.name} can't find anyone to attack and searches the area.` } };
      }
      // A frightened, grappled or restrained creature won't (or can't) close in.
      const canClose = !['grappled', 'restrained', 'frightened'].some((c) => hasCondition(attacker, c as Condition));
      const battleMap = state.combat.battleMap;
      const attacks = monsterAttacks(attacker);
      const melee = attacks.find((a) => a.kind === 'melee');
      const ranged = attacks.find((a) => a.kind === 'ranged');

      // Legacy / non-spatial path: no battle map (or attacker not placed). Keep
      // the original random-target melee behaviour so old saves/tests are intact.
      if (!battleMap || !battleMap.positions[attacker.id]) {
        const target = consciousPlayers.length > 0
          ? consciousPlayers[Math.floor(randomProvider() * consciousPlayers.length)]
          : state.party[0];
        return resolveMonsterStrike(state, attacker, target, melee ?? attacks[0], {});
      }

      // Spatial path: target the nearest conscious, placed player.
      // Prefer creatures still standing; with none left, attack the downed (not dead).
      const standing = consciousPlayers.filter((p) => battleMap.positions[p.id]);
      const placed = standing.length > 0
        ? standing
        : state.party.filter((p) => battleMap.positions[p.id] && p.deathSaves.failure < 3);
      if (placed.length === 0) {
        return { state, result: { ok: true, summary: `${attacker.name} has no reachable target.` } };
      }
      let target = placed[0];
      let bestDist = distanceBetweenActors(battleMap, attacker.id, target.id) ?? Infinity;
      for (const p of placed) {
        const d = distanceBetweenActors(battleMap, attacker.id, p.id) ?? Infinity;
        if (d < bestDist) { bestDist = d; target = p; }
      }
      const reach = melee?.reachFt ?? 5;

      // 1. Melee if already in reach.
      if (melee && bestDist <= reach) {
        return resolveMonsterStrike(state, attacker, target, melee, {});
      }
      // 2. Ranged if in range with a clear shot.
      if (ranged && bestDist <= (ranged.rangeFt ?? 0)) {
        const cover = resolveSpatialCover(battleMap, attacker.id, target.id);
        if (!cover.blocked) {
          return resolveMonsterStrike(state, attacker, target, ranged, { coverKind: cover.cover, coverBonus: cover.bonus });
        }
      }
      // 3. Move into melee reach if movement allows, then strike.
      if (melee && canClose) {
        const dest = bestReachableCellWithinReach(battleMap, attacker.id, target.id, reach);
        if (dest) {
          const moved = resolveMove(battleMap, attacker.id, dest);
          if (moved.result.ok) {
            const movedState: GameState = { ...state, combat: { ...state.combat, battleMap: moved.map } };
            const newDist = distanceBetweenActors(moved.map, attacker.id, target.id) ?? Infinity;
            if (newDist <= reach) {
              const struck = resolveMonsterStrike(movedState, attacker, target, melee, {});
              return { state: struck.state, result: { ...struck.result, summary: `${attacker.name} moves into reach. ${struck.result.summary}` } };
            }
            return {
              state: appendLog(movedState, `${attacker.name} advances but cannot reach ${target.name}.`),
              result: { ok: false, summary: `${attacker.name} moved but could not reach ${target.name}.` },
            };
          }
        }
      }
      // 4. Ranged in range but blocked by cover / line of sight.
      if (ranged && bestDist <= (ranged.rangeFt ?? 0)) {
        return {
          state,
          result: { ok: false, summary: `${attacker.name} has no clear shot at ${target.name} (cover or line of sight).`, cover: { kind: 'total', baseAc: target.ac, bonus: 0, effectiveAc: target.ac } },
        };
      }
      // 5. Nothing legal this turn.
      return { state, result: { ok: false, summary: `${attacker.name} cannot reach or target any foe this turn.` } };
    }
    case 'death_save': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (!char.unconscious) return { state, result: { ok: false, summary: `${char.name} is not unconscious.` } };
      if (char.deathSaves.failure >= 3) return { state, result: { ok: false, summary: `${char.name} is dead.` } };
      if (char.stable) return { state, result: { ok: true, summary: `${char.name} is stable and does not roll death saves.` } };
      if (!isValidD20Roll(request.manualRoll) && request.manualRoll !== undefined) {
        return { state, result: { ok: false, summary: 'Manual roll must be an integer between 1 and 20.' } };
      }

      if (options?.physicalDice && request.manualRoll === undefined) {
        return {
          state,
          result: {
            ok: false,
            summary: `Waiting for manual Death Save for ${char.name}...`,
            needsManualRoll: true,
            manualRollContext: { kind: 'skill_check', formula: '1d20' },
          },
        };
      }

      const breakdown = request.manualRoll !== undefined
        ? { formula: '1d20', rolls: [request.manualRoll], modifier: 0, total: request.manualRoll }
        : rollFormula('1d20', 0);
      
      const natural = breakdown.rolls[0];
      let { success, failure } = char.deathSaves;
      let hp = 0;
      let unconscious = true;
      let msg = '';

      if (natural === 20) {
        success = 0;
        failure = 0;
        hp = 1;
        unconscious = false;
        msg = 'Critical Success! Regains 1 HP and is no longer unconscious.';
      } else if (natural === 1) {
        failure += 2;
        msg = 'Critical Failure! Marks 2 failures.';
      } else if (natural >= 10) {
        success += 1;
        msg = 'Success! Marks 1 success.';
      } else {
        failure += 1;
        msg = 'Failure. Marks 1 failure.';
      }

      if (failure >= 3) {
        msg += ' Has died.';
      } else if (success >= 3) {
        success = 0;
        failure = 0;
        unconscious = true; // Stable
        msg += ' Is now stable.';
      }

      const stable = unconscious && failure < 3 && msg.includes('Is now stable');
      let next = updateCharacterInParty(state, char.id, (c) => ({ 
        ...c, hp, unconscious, stable, deathSaves: { success, failure } 
      }));

      const allDead = next.party.every(p => p.hp <= 0 && p.deathSaves.failure >= 3);
      if (allDead) next = { ...next, sceneId: 'ending', combat: { ...next.combat, active: false } };
      
      return { 
        state: appendLog(next, `${char.name} Death Save: ${msg}`), 
        result: { ok: natural >= 10, summary: msg, breakdown } 
      };
    }
    case 'use_feature': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (char.unconscious) {
        return { state, result: { ok: false, summary: `${char.name} is unconscious and cannot use a feature.` } };
      }

      const idx = char.features.findIndex((f) => f.id === request.featureId);
      if (idx < 0) return { state, result: { ok: false, summary: `Feature ${request.featureId} not found.` } };
      const feature = char.features[idx];
      if (feature.passive) return { state, result: { ok: false, summary: `${feature.name} is always active; it isn't used.` } };
      if (feature.usesRemaining <= 0) return { state, result: { ok: false, summary: `No uses of ${feature.name} remaining.` } };
      
      const map = state.combat.battleMap;
      let nextState = state;
      if (feature.id === 'action_surge') {
        const actor = map?.actors[char.id];
        const activeId = state.combat.initiative[state.combat.turnIndex]?.actorId;
        if (!map || !actor?.actionUsed || activeId !== char.id) {
          return { state, result: { ok: false, summary: 'Use Action Surge on your turn after spending your action.' } };
        }
        const restored = updateCharacterInParty({
          ...state,
          combat: { ...state.combat, battleMap: { ...map, actors: { ...map.actors, [char.id]: { ...actor, actionUsed: false } } } },
        }, char.id, (c) => ({
          ...c,
          features: c.features.map((f) => f.id === feature.id ? { ...f, usesRemaining: f.usesRemaining - 1 } : f),
        }));
        const summary = `${char.name} uses Action Surge and gains another action.`;
        return { state: appendLog(restored, summary), result: { ok: true, summary } };
      }
      const isBonusAction = feature.id === 'second_wind' || feature.id === 'rage'; // heuristic
      
      if (map) {
        const actor = map.actors[char.id];
        if (actor) {
          if (isBonusAction && actor.bonusActionUsed) {
            return { state, result: { ok: false, summary: `${char.name} has already used their bonus action this turn.` } };
          }
          if (!isBonusAction && actor.actionUsed) {
            return { state, result: { ok: false, summary: `${char.name} has already used their action this turn.` } };
          }
          nextState = {
            ...state,
            combat: {
              ...state.combat,
              battleMap: {
                ...map,
                actors: {
                  ...map.actors,
                  [char.id]: {
                    ...actor,
                    actionUsed: isBonusAction ? actor.actionUsed : true,
                    bonusActionUsed: isBonusAction ? true : actor.bonusActionUsed,
                  },
                },
              },
            },
          };
        }
      }

      let next = nextState;
      let summary = `${char.name} used ${feature.name}.`;
      let breakdown: RollBreakdown | undefined;

      // Logic for specific features
      if (feature.id === 'second_wind') {
        breakdown = rollFormula('1d10', char.level);
        const hp = Math.min(char.maxHp, char.hp + breakdown.total);
        next = updateCharacterInParty(next, char.id, (c) => ({ ...c, hp }));
        summary = `${char.name} used Second Wind (bonus action) and restored ${breakdown.total} HP.`;
      } else if (feature.id === 'lay_on_hands') {
          // Simplistic implementation for now
          const amount = Math.min(feature.usesRemaining, 5);
          next = updateCharacterInParty(next, char.id, (c) => ({ ...c, hp: Math.min(c.maxHp, c.hp + amount) }));
          summary = `${char.name} used Lay on Hands and restored ${amount} HP.`;
      }

      next = updateCharacterInParty(next, char.id, (c) => {
        const features = c.features.map((f, i) => i === idx ? { ...f, usesRemaining: f.usesRemaining - 1 } : f);
        return { ...c, features };
      });
      
      return { state: appendLog(next, summary), result: { ok: true, summary, breakdown } };
    }
    case 'cast_spell': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (char.unconscious) {
        return { state, result: { ok: false, summary: `${char.name} is unconscious and cannot cast a spell.` } };
      }

      const level = request.level;
      const slot = char.spellSlots[level];
      if (level > 0) {
        if (!slot || slot.remaining <= 0) {
          return { state, result: { ok: false, summary: `No level ${level} spell slots remaining.` } };
        }
      }

      const map = state.combat.battleMap;
      let nextState = state;
      const spellName = request.spellName.toLowerCase();
      // Heuristic: Healing Word, Misty Step, Spiritual Weapon, Shield of Faith are bonus actions.
      const isBonusAction = spellName.includes('healing word') || spellName.includes('misty step') || spellName.includes('spiritual weapon') || spellName.includes('shield of faith') || spellName.includes('expeditious retreat');
      
      if (map) {
        const actor = map.actors[char.id];
        if (actor) {
          if (isBonusAction && actor.bonusActionUsed) {
            return { state, result: { ok: false, summary: `${char.name} has already used their bonus action this turn.` } };
          }
          if (!isBonusAction && actor.actionUsed) {
            return { state, result: { ok: false, summary: `${char.name} has already used their action this turn.` } };
          }
          nextState = {
            ...state,
            combat: {
              ...state.combat,
              battleMap: {
                ...map,
                actors: {
                  ...map.actors,
                  [char.id]: {
                    ...actor,
                    actionUsed: isBonusAction ? actor.actionUsed : true,
                    bonusActionUsed: isBonusAction ? true : actor.bonusActionUsed,
                  },
                },
              },
            },
          };
        }
      }
      const knownSpells = ['cure wounds', 'healing word', 'magic missile', 'shield', 'bless'];
      if (!knownSpells.some((known) => spellName.includes(known))) {
        return { state, result: { ok: false, summary: `${request.spellName} is not a recognized spell.` } };
      }
      if (char.knownSpells && !char.knownSpells.some((known) => known.toLowerCase() === spellName)) {
        return { state, result: { ok: false, summary: `${char.name} does not know ${request.spellName}.` } };
      }

      let next = nextState;
      if (level > 0) {
        const slots = next.party.find((p) => p.id === char.id)!.spellSlots;
        next = updateCharacterInParty(next, char.id, (c) => ({
          ...c,
          spellSlots: { ...slots, [level]: { ...slots[level], remaining: slots[level].remaining - 1 } },
        }));
      }

      let summary = `${char.name} cast ${request.spellName} (Level ${level})`;
      let breakdown: RollBreakdown | undefined;

      // Basic Spell Logic
      if (spellName.includes('cure wounds') || spellName.includes('healing word')) {
        const dice = spellName.includes('cure wounds') ? 'd8' : 'd4';
        breakdown = rollFormula(`${level}${dice}`, 3);
        
        // Target can be self or another character
        const targetId = request.targetId || char.id;
        next = updateCharacterInParty(next, targetId, (c) => {
          const hp = Math.min(c.maxHp, c.hp + (breakdown?.total ?? 0));
          const unconscious = hp > 0 ? false : c.unconscious;
          const deathSaves = hp > 0 ? { success: 0, failure: 0 } : c.deathSaves;
          return { ...c, hp, unconscious, deathSaves };
        });
        const target = next.party.find(p => p.id === targetId);
        summary = `${char.name} cast ${spellName} on ${target?.name}, restoring ${breakdown.total} HP.`;
      } else if (spellName.includes('magic missile')) {
         const missileCount = 2 + level;
         breakdown = rollFormula(`${missileCount}d4`, missileCount);
         if (request.targetId) {
           const monsters = next.monsters.map(m => 
             m.id === request.targetId ? { ...m, hp: Math.max(0, m.hp - (breakdown?.total ?? 0)) } : m
           );
           next = { ...next, monsters };
           const target = next.monsters.find(m => m.id === request.targetId);
           summary = `${char.name}'s Magic Missile hit ${target?.name} for ${breakdown.total} damage.`;
         }
       } else if (spellName.includes('shield')) {
         next = updateCharacterInParty(next, char.id, (c) => ({
           ...c, conditions: c.conditions.includes('shielded') ? c.conditions : [...c.conditions, 'shielded' as const]
         }));
         summary = `${char.name} cast Shield.`;
       } else if (spellName.includes('bless')) {
         // Simplistic: blesses the whole party for now
         const party = next.party.map(p => ({
           ...p, conditions: p.conditions.includes('blessed') ? p.conditions : [...p.conditions, 'blessed' as const]
         }));
         next = {
           ...next,
           party,
         };
         summary = `${char.name} cast Bless on the party.`;
       }

      return { state: appendLog(next, summary), result: { ok: true, summary, breakdown } };
    }
    case 'use_item': {
      const user = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!user) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (user.unconscious) return { state, result: { ok: false, summary: `${user.name} is unconscious and cannot use an item.` } };
      const recipient = request.targetId ? state.party.find((p) => p.id === request.targetId) : user;
      if (!recipient) return { state, result: { ok: false, summary: 'Target not found.' } };
      if (recipient.deathSaves.failure >= 3) return { state, result: { ok: false, summary: `${recipient.name} is dead; a potion cannot help.` } };
      const itemIndex = user.inventory.findIndex((i) => i.toLowerCase() === request.item.toLowerCase());
      if (itemIndex < 0) return { state, result: { ok: false, summary: `${user.name} has no ${request.item}.` } };
      const item = user.inventory[itemIndex];
      if (!/healing potion|potion of healing/i.test(item)) {
        return { state, result: { ok: false, summary: `${item} has no automatic rules effect; narrate how it is used.` } };
      }
      const map = state.combat.battleMap;
      const actor = state.combat.active ? map?.actors[user.id] : undefined;
      if (actor?.actionUsed) return { state, result: { ok: false, summary: `${user.name} has already used their action this turn.` } };
      let next: GameState = actor && map
        ? { ...state, combat: { ...state.combat, battleMap: { ...map, actors: { ...map.actors, [user.id]: { ...actor, actionUsed: true } } } } }
        : state;
      // Potion of Healing: 2d4 + 2. Drinking or administering it takes an action.
      const heal = rollFormula('2d4+2');
      next = updateCharacterInParty(next, user.id, (c) => ({ ...c, inventory: c.inventory.filter((_, i) => i !== itemIndex) }));
      next = updateCharacterInParty(next, recipient.id, (c) => ({
        ...c,
        hp: Math.min(c.maxHp, Math.max(0, c.hp) + heal.total),
        unconscious: false,
        stable: false,
        deathSaves: { success: 0, failure: 0 },
      }));
      const summary = `${recipient.name} ${recipient.id === user.id ? 'drinks' : 'is given'} a Potion of Healing and regains ${heal.total} HP.`;
      return { state: appendLog(next, summary), result: { ok: true, summary, breakdown: heal } };
    }
    case 'short_rest': {
      // 5e: short-rest features recharge, and each conscious character may spend
      // Hit Dice (one die + Con modifier each) to recover HP.
      const notes: string[] = [];
      const party = state.party.map((p) => {
        const features = p.features.map((f) => (f.rechargeOn === 'short_rest' && !f.passive ? { ...f, usesRemaining: f.usesMax } : f));
        if (p.unconscious || p.hp <= 0) return { ...p, features };
        const dice = { ...getHitDice(p) };
        let hp = p.hp;
        let spent = 0;
        while (hp < p.maxHp && dice.remaining > 0) {
          hp = Math.min(p.maxHp, hp + Math.max(0, rollFormula(`1d${dice.die}`, 0).total + abilityMod(p.abilities.con)));
          dice.remaining -= 1;
          spent += 1;
        }
        if (spent > 0) notes.push(`${p.name} spends ${spent} Hit ${spent === 1 ? 'Die' : 'Dice'} and recovers ${hp - p.hp} HP`);
        return { ...p, features, hp, hitDice: dice };
      });
      const next = {
        ...state,
        party,
        player: party[0],
      };
      const restNote = notes.length ? ` ${notes.join('; ')}.` : '';
      return { state: appendLog(next, `The party took a short rest.${restNote}`), result: { ok: true, summary: `Short rest complete.${restNote}` } };
    }
    case 'long_rest': {
      const party = state.party.map(p => {
        const dead = p.deathSaves.failure >= 3;
        const dice = getHitDice(p);
        return {
        ...p,
        // Resting does not raise the dead.
        hp: dead ? p.hp : p.maxHp,
        unconscious: dead ? p.unconscious : false,
        stable: false,
        deathSaves: dead ? p.deathSaves : { success: 0, failure: 0 },
        // Regain spent Hit Dice up to half your total (minimum 1).
        hitDice: { ...dice, remaining: Math.min(dice.max, dice.remaining + Math.max(1, Math.floor(dice.max / 2))) },
        features: p.features.map(f => ({ ...f, usesRemaining: f.usesMax })),
        spellSlots: Object.fromEntries(
          Object.entries(p.spellSlots).map(([lvl, s]) => [lvl, { ...s, remaining: s.max }])
        )
      };
      });
      const next = {
        ...state,
        party,
        player: party[0],
      };
      return { state: appendLog(next, 'The party took a long rest. Everyone is restored.'), result: { ok: true, summary: 'Long rest complete.' } };
    }
    case 'complete_objective': {
      if (state.completedObjectives.includes(request.objectiveId)) {
        return { state, result: { ok: true, summary: 'Objective already completed.' } };
      }
      const next = { ...state, completedObjectives: [...state.completedObjectives, request.objectiveId] };
      return {
        state: appendLog(next, `Objective completed: ${request.objectiveId}`),
        result: { ok: true, summary: `Objective completed: ${request.objectiveId}` },
      };
    }
    case 'advance_scene': {
      const next = advanceScene(state);
      const ok = next.sceneId !== state.sceneId;
      return {
        state: ok ? appendLog(next, `Advanced to scene ${next.sceneId}.`) : state,
        result: { ok, summary: ok ? 'Scene advanced.' : 'No next scene available.' },
      };
    }
    case 'update_npc': {
      if (!state.npcs.some((npc) => npc.id === request.npcId)) {
        return { state, result: { ok: false, summary: `NPC ${request.npcId} not found.` } };
      }
      const npcs = state.npcs.map((n) => {
        if (n.id === request.npcId) {
          return {
            ...n,
            disposition: request.disposition ?? n.disposition,
            knowledge: request.knowledge ? [...n.knowledge, request.knowledge] : n.knowledge,
          };
        }
        return n;
      });
      return { state: { ...state, npcs }, result: { ok: true, summary: `Updated NPC ${request.npcId}` } };
    }
    case 'add_canon_fact': {
      const isDuplicate = state.canonLog.some(f => f.content === request.content);
      if (isDuplicate) return { state, result: { ok: true, summary: 'Fact already established.' } };

      const fact = { id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, content: request.content, importance: request.importance };
      return { state: { ...state, canonLog: [...state.canonLog, fact] }, result: { ok: true, summary: 'Added canon fact.' } };
    }
    case 'update_inventory': {
      const char = state.party.find((p) => p.id === requestedCharacterId(request.characterId));
      if (!char) return { state, result: { ok: false, summary: 'Character not found.' } };
      if (char.unconscious) {
        return { state, result: { ok: false, summary: `${char.name} is unconscious and cannot change inventory.` } };
      }

      const goldDelta = request.goldDelta ?? 0;
      if (char.gold + goldDelta < 0) {
        return { state, result: { ok: false, summary: 'Cannot spend more gold than available.' } };
      }

      if (request.remove) {
        const missing = request.remove.filter((item) => !char.inventory.includes(item));
        if (missing.length > 0) {
          return { state, result: { ok: false, summary: `Cannot remove missing item(s): ${missing.join(', ')}.` } };
        }
      }

      const next = updateCharacterInParty(state, char.id, (c) => {
        const gold = c.gold + goldDelta;
        let inventory = [...c.inventory];
        if (request.add) inventory = [...inventory, ...request.add];
        if (request.remove) {
          const removed = [...request.remove];
          inventory = inventory.filter((item) => {
            const index = removed.indexOf(item);
            if (index >= 0) {
              removed.splice(index, 1);
              return false;
            }
            return true;
          });
        }
        return { ...c, gold, inventory };
      });
      
      return { state: next, result: { ok: true, summary: 'Inventory updated.' } };
    }
    case 'apply_condition': {
      let next = state;
      let targetName = '';
      let targetFound = false;
      
      const char = state.party.find((p) => p.id === request.targetId);
      if (char) {
        targetFound = true;
        next = updateCharacterInParty(state, char.id, (c) => ({
          ...c, conditions: c.conditions.includes(request.condition) ? c.conditions : [...c.conditions, request.condition]
        }));
        targetName = char.name;
      } else {
        const monsters = state.monsters.map((m) => {
          if (m.id === request.targetId) {
            targetFound = true;
            if (!m.conditions.includes(request.condition)) {
              targetName = m.name;
              return { ...m, conditions: [...m.conditions, request.condition] };
            }
          }
          return m;
        });
        next = { ...state, monsters };
      }
      
      if (!targetFound) {
        return { state, result: { ok: false, summary: 'No valid target for applying condition.' } };
      }

      const summary = `${targetName} is now ${request.condition}.`;
      return { state: appendLog(next, summary), result: { ok: true, summary } };
    }
    case 'remove_condition': {
      let next = state;
      let targetName = '';
      let targetFound = false;
      
      const char = state.party.find((p) => p.id === request.targetId);
      if (char) {
        targetFound = true;
        next = updateCharacterInParty(state, char.id, (c) => ({
          ...c, conditions: c.conditions.filter((con) => con !== request.condition)
        }));
        targetName = char.name;
      } else {
        const monsters = state.monsters.map((m) => {
          if (m.id === request.targetId) {
            targetFound = true;
            targetName = m.name;
            return { ...m, conditions: m.conditions.filter((con) => con !== request.condition) };
          }
          return m;
        });
        next = { ...state, monsters };
      }
      
      if (!targetFound) {
        return { state, result: { ok: false, summary: 'No valid target for removing condition.' } };
      }

      const summary = `${targetName} is no longer ${request.condition}.`;
      return { state: appendLog(next, summary), result: { ok: true, summary } };
    }
  }
}

function spatialResultToEngineResult(spatial: SpatialEngineResult): EngineResult {
  switch (spatial.kind) {
    case 'move_area':
      return spatial.ok
        ? {
            ok: true,
            summary: `Moved from ${spatial.from} to ${spatial.to}.`,
            spatial,
          }
        : {
            ok: false,
            summary: spatial.reason === 'requires_unmet'
              ? `Movement blocked by unmet requirement: ${spatial.requiredTag}.`
              : `Movement failed: ${spatial.reason}.`,
            spatial,
          };
    case 'query_current_area':
      return { ok: true, summary: `Current area: ${spatial.areaId}.`, spatial };
    case 'query_exits':
      return { ok: true, summary: `${spatial.exits.length} exit(s) available.`, spatial };
    case 'query_actors_present':
      return { ok: true, summary: `${spatial.actorIds.length} actor(s) present.`, spatial };
    case 'query_path_exists':
      return {
        ok: spatial.path !== null,
        summary: spatial.path
          ? `Path exists: ${spatial.path.join(' -> ')}${typeof spatial.distanceFt === 'number' ? ` (${spatial.distanceFt} ft).` : '.'}`
          : 'No path exists.',
        spatial,
      };
  }
}

type CombatantRef = {
  name: string;
  ac: number;
  conditions: import('@/lib/game/types').Condition[];
  attackBonus: number;
  damageFormula: string;
  isParty: boolean;
};

/** Looks up a combatant (party or monster) by id, normalising attack data. */
function findCombatant(state: GameState, id: string): CombatantRef | undefined {
  const char = state.party.find((p) => p.id === id);
  if (char) {
    return {
      name: char.name,
      ac: char.ac,
      conditions: char.conditions,
      attackBonus: char.weapon.attackBonus,
      damageFormula: char.weapon.damage,
      isParty: true,
    };
  }
  const monster = state.monsters.find((m) => m.id === id);
  if (monster) {
    return {
      name: monster.name,
      ac: monster.ac,
      conditions: monster.conditions,
      attackBonus: monster.attackBonus,
      damageFormula: monster.damage,
      isParty: false,
    };
  }
  return undefined;
}

/** Applies damage to any combatant (party or monster), knocking PCs out at 0 HP. */
function applyDamageTo(state: GameState, id: string, damage: number): GameState {
  if (state.party.some((p) => p.id === id)) {
    return updateCharacterInParty(state, id, (c) => {
      const hp = Math.max(0, c.hp - damage);
      return { ...c, hp, unconscious: hp === 0 ? true : c.unconscious };
    });
  }
  return { ...state, monsters: state.monsters.map((m) => (m.id === id ? { ...m, hp: Math.max(0, m.hp - damage) } : m)) };
}

function setReactionUnavailable(state: GameState, attackerId: string): GameState {
  const battleMap = state.combat.battleMap;
  const actor = battleMap?.actors[attackerId];
  if (!battleMap || !actor) return state;
  return {
    ...state,
    combat: {
      ...state.combat,
      battleMap: { ...battleMap, actors: { ...battleMap.actors, [attackerId]: { ...actor, reactionAvailable: false } } },
    },
  };
}

/**
 * Resolves opportunity attacks triggered by a move. Each attacker (already
 * filtered to reaction-available hostiles by the spatial layer) rolls a melee
 * attack against the mover, applies damage on a hit, and has its reaction
 * consumed. Deterministic and engine-owned — the LLM only narrates the outcome.
 */
function resolveOpportunityAttacks(
  state: GameState,
  moverId: string,
  attackerIds: string[],
): { state: GameState; outcomes: OpportunityAttackOutcome[] } {
  let working = state;
  const outcomes: OpportunityAttackOutcome[] = [];
  const target = findCombatant(working, moverId);
  if (!target) return { state: working, outcomes };

  for (const attackerId of attackerIds) {
    const attacker = findCombatant(working, attackerId);
    if (!attacker) continue;
    if (!Number.isFinite(attacker.attackBonus) || !attacker.damageFormula) {
      outcomes.push({
        attackerId,
        attackerName: attacker.name,
        targetId: moverId,
        targetName: target.name,
        hit: false,
        damage: 0,
        warning: `${attacker.name} has no usable melee attack for an opportunity attack.`,
      });
      working = setReactionUnavailable(working, attackerId);
      continue;
    }

    const toHit = rollFormula('1d20', attacker.attackBonus);
    const natural = toHit.keptRoll ?? toHit.rolls[0];
    const critical = natural === 20;
    const hit = toHit.total >= target.ac || critical;
    toHit.dc = target.ac;
    toHit.ok = hit;

    let damage = 0;
    if (hit) {
      const dmg = rollFormula(critical ? critFormula(attacker.damageFormula) : attacker.damageFormula);
      damage = dmg.total;
      working = applyDamageTo(working, moverId, damage);
    }
    working = setReactionUnavailable(working, attackerId);
    outcomes.push({
      attackerId,
      attackerName: attacker.name,
      targetId: moverId,
      targetName: target.name,
      hit,
      damage,
      breakdown: toHit,
    });
  }
  return { state: working, outcomes };
}

/** Spatial cover between two placed actors, attacker-agnostic (shared by player and monster attacks). */
function resolveSpatialCover(
  battleMap: BattleMap | undefined,
  attackerId: string,
  targetId: string,
): { available: boolean; blocked: boolean; cover: CoverKind; bonus: number } {
  if (!battleMap?.positions[attackerId] || !battleMap.positions[targetId]) {
    return { available: false, blocked: false, cover: 'none', bonus: 0 };
  }
  const sight = lineOfSight(battleMap, battleMap.positions[attackerId], battleMap.positions[targetId]);
  if (!sight.hasLineOfSight || sight.cover === 'total') return { available: true, blocked: true, cover: 'total', bonus: 0 };
  return { available: true, blocked: false, cover: sight.cover, bonus: coverAcBonus(sight.cover) };
}

const PLAYER_MELEE_REACH_FT = 5;

/**
 * Moves a party member into melee reach of their target before an attack, using
 * only the movement they have left this turn. Returns `result` when the attack
 * cannot happen (action already used, still out of reach, or dropped by an
 * opportunity attack); otherwise returns the moved state plus a short note.
 */
export function approachForMelee(
  state: GameState,
  charId: string,
  targetId: string,
  ranged: boolean,
): { state: GameState; note: string; result?: EngineResult } {
  const map = state.combat.battleMap;
  if (ranged || !state.combat.active || !map || !map.positions[charId] || !map.positions[targetId]) {
    return { state, note: '' };
  }
  const startDist = distanceBetweenActors(map, charId, targetId) ?? Infinity;
  if (startDist <= PLAYER_MELEE_REACH_FT) return { state, note: '' };

  const char = state.party.find((p) => p.id === charId);
  const target = state.monsters.find((m) => m.id === targetId);
  const name = char?.name ?? 'The attacker';
  const targetName = target?.name ?? 'the target';
  if (map.actors[charId]?.actionUsed) {
    return { state, note: '', result: { ok: false, summary: `${name} has already used their action this turn.` } };
  }
  const spentBefore = map.actors[charId]?.movementSpentFt ?? 0;

  const dest = bestReachableCellWithinReach(map, charId, targetId, PLAYER_MELEE_REACH_FT);
  if (dest) {
    const moved = resolveMove(map, charId, dest);
    if (moved.result.ok) {
      let next: GameState = { ...state, combat: { ...state.combat, battleMap: moved.map } };
      const spent = moved.result.movementSpentFt - spentBefore;
      let note = `${name} moves ${spent} ft into reach of ${targetName}. `;
      if (moved.result.opportunityAttacks.length > 0) {
        const oa = resolveOpportunityAttacks(next, charId, moved.result.opportunityAttacks);
        next = oa.state;
        for (const o of oa.outcomes) {
          const line = o.warning ?? `${o.attackerName}'s opportunity attack ${o.hit ? `hits ${o.targetName} for ${o.damage} damage` : `misses ${o.targetName}`}.`;
          next = appendLog(next, line);
          note += `${line} `;
        }
        if (next.party.find((p) => p.id === charId)?.unconscious) {
          return { state: next, note, result: { ok: false, summary: `${note}${name} falls before reaching ${targetName}.` } };
        }
      }
      return { state: appendLog(next, `${name} closes ${spent} ft on ${targetName}.`), note };
    }
  }

  // Can't reach this turn: move as close as possible and keep the action.
  const targetPos = map.positions[targetId];
  let best: GridCoord | undefined;
  let bestDist = startDist;
  for (const cell of reachableCells(map, charId)) {
    const d = distanceFt(map, cell.coord, targetPos);
    if (d < bestDist) { best = cell.coord; bestDist = d; }
  }
  let next = state;
  let spent = 0;
  if (best) {
    const moved = resolveMove(map, charId, best);
    if (moved.result.ok) {
      next = { ...state, combat: { ...state.combat, battleMap: moved.map } };
      spent = moved.result.movementSpentFt - spentBefore;
    }
  }
  const remaining = distanceBetweenActors(next.combat.battleMap ?? map, charId, targetId) ?? bestDist;
  const summary = `${name} moves ${spent} ft toward ${targetName} but is still ${remaining} ft away, out of melee reach. Their action is unspent: they can Dash to cover more ground or end their turn.`;
  return { state: appendLog(next, summary), note: '', result: { ok: false, summary } };
}

/** Least-cost reachable cell that puts the mover within `reachFt` of the target. */
function bestReachableCellWithinReach(
  battleMap: BattleMap,
  attackerId: string,
  targetId: string,
  reachFt: number,
): GridCoord | undefined {
  const targetPos = battleMap.positions[targetId];
  if (!targetPos) return undefined;
  let best: GridCoord | undefined;
  let bestCost = Infinity;
  for (const cell of reachableCells(battleMap, attackerId)) {
    if (distanceFt(battleMap, cell.coord, targetPos) <= reachFt && cell.costFt < bestCost) {
      best = cell.coord;
      bestCost = cell.costFt;
    }
  }
  return best;
}

/**
 * Resolves a single monster attack against a party member. Attacker-agnostic in
 * the cover sense — melee attacks pass no cover; ranged attacks pass the cover
 * bonus computed from the battle map. Reuses the same dice/damage/death-save
 * pipeline the monster_turn melee path always used.
 */
function resolveMonsterStrike(
  state: GameState,
  attacker: Monster,
  target: Character,
  attack: MonsterAttack,
  opts: { coverKind?: CoverKind; coverBonus?: number },
): { state: GameState; result: EngineResult } {
  let advantage = false;
  let disadvantage = false;
  let bonusFormula: string | undefined;

  if (hasCondition(attacker, 'blinded')) disadvantage = true;
  if (hasCondition(attacker, 'poisoned')) disadvantage = true;
  if (hasCondition(attacker, 'prone')) disadvantage = true;
  if (hasCondition(attacker, 'restrained')) disadvantage = true;
  if (hasCondition(attacker, 'frightened')) disadvantage = true;
  if (hasCondition(attacker, 'blessed')) bonusFormula = '1d4';
  if (hasCondition(target, 'dodging')) disadvantage = true;

  if (hasCondition(target, 'blinded')) advantage = true;
  if (hasCondition(target, 'paralyzed') || hasCondition(target, 'stunned') || hasCondition(target, 'unconscious')) advantage = true;
  if (hasCondition(target, 'restrained')) advantage = true;
  // Prone target: melee attacks have advantage, ranged attacks disadvantage (5e).
  if (hasCondition(target, 'prone')) {
    if (attack.kind === 'ranged') disadvantage = true; else advantage = true;
  }
  // Attacks against an unconscious creature have advantage.
  if (target.unconscious || target.hp <= 0) advantage = true;

  const baseAc = hasCondition(target, 'shielded') ? target.ac + 5 : target.ac;
  const coverBonus = opts.coverBonus ?? 0;
  const effectiveAc = baseAc + coverBonus;
  const cover: CoverOutcome | undefined =
    opts.coverKind && opts.coverKind !== 'none' ? { kind: opts.coverKind, baseAc, bonus: coverBonus, effectiveAc } : undefined;
  const coverNote = cover ? ` (${cover.kind.replace('_', '-')} cover: AC ${baseAc}+${coverBonus})` : '';

  const toHit = rollFormula('1d20', attack.attackBonus, { advantage, disadvantage, bonusFormula });
  const natural = toHit.keptRoll ?? toHit.rolls[0];
  const hits = natural !== 1 && (natural === 20 || toHit.total >= effectiveAc);
  // A melee hit on an unconscious creature within 5 ft is automatically a critical hit.
  const meleeOnDowned = attack.kind === 'melee' && (target.unconscious || target.hp <= 0);
  const critical = hits && (natural === 20 || meleeOnDowned);
  if (!hits) {
    return {
      state: appendLog(state, `${attacker.name} missed ${target.name}.`),
      result: { ok: false, summary: `${attacker.name} missed${coverNote}.`, breakdown: toHit, cover },
    };
  }

  if (target.unconscious || target.hp <= 0) {
    // Damage at 0 HP: one death-save failure, or two on a critical hit (5e).
    const failure = Math.min(3, target.deathSaves.failure + (critical ? 2 : 1));
    const died = failure >= 3;
    let next = updateCharacterInParty(state, target.id, (c) => ({ ...c, stable: false, deathSaves: { ...c.deathSaves, failure } }));
    if (died && next.party.every((p) => p.hp <= 0 && p.deathSaves.failure >= 3)) next = { ...next, sceneId: 'ending', combat: { ...next.combat, active: false } };
    const note = died
      ? `${target.name} has died!`
      : `${target.name} suffers ${critical ? 'two death-save failures' : 'a death-save failure'} (${failure}/3).`;
    return {
      state: appendLog(next, `${attacker.name} strikes the fallen ${target.name}. ${note}`),
      result: { ok: true, summary: `${attacker.name} strikes the fallen ${target.name}. ${note}`, breakdown: toHit },
    };
  }

  // A critical hit doubles the damage dice (5e).
  const dmg = rollFormula(critical ? critFormula(attack.damage) : attack.damage);
  const hp = Math.max(0, target.hp - dmg.total);
  const unconscious = hp === 0;
  // Massive damage: if the damage left over after dropping to 0 HP equals or
  // exceeds the character's HP maximum, they die outright.
  const instantDeath = unconscious && dmg.total - target.hp >= target.maxHp;
  let next = updateCharacterInParty(state, target.id, (c) => ({
    ...c,
    hp,
    unconscious,
    stable: false,
    deathSaves: instantDeath ? { success: 0, failure: 3 } : c.deathSaves,
  }));
  const critNote = critical ? ' Critical hit!' : '';
  let fallNote = '';
  if (instantDeath) {
    fallNote = ` ${target.name} is killed outright by massive damage!`;
    if (next.party.every((p) => p.hp <= 0 && p.deathSaves.failure >= 3)) next = { ...next, sceneId: 'ending', combat: { ...next.combat, active: false } };
  } else if (unconscious) {
    fallNote = ` ${target.name} has fallen unconscious!`;
  }

  // Riders such as a worg's bite: Strength save or be knocked prone.
  let riderNote = '';
  if (attack.onHitSave && !unconscious && !hasCondition(target, attack.onHitSave.condition)) {
    const save = rollFormula('1d20', saveBonus(target, attack.onHitSave.ability));
    if (save.total < attack.onHitSave.dc) {
      next = updateCharacterInParty(next, target.id, (c) => ({ ...c, conditions: [...c.conditions, attack.onHitSave!.condition] }));
      riderNote = ` ${target.name} fails a DC ${attack.onHitSave.dc} ${attack.onHitSave.ability.toUpperCase()} save (${save.total}) and is knocked ${attack.onHitSave.condition}!`;
    } else {
      riderNote = ` ${target.name} makes the DC ${attack.onHitSave.dc} ${attack.onHitSave.ability.toUpperCase()} save (${save.total}) and stays standing.`;
    }
  }
  return {
    state: appendLog(next, `${attacker.name} hit ${target.name} for ${dmg.total}.${critNote}${fallNote}${riderNote}`),
    result: { ok: true, summary: `${attacker.name} hit ${target.name} for ${dmg.total}.${critNote}${coverNote}${fallNote}${riderNote}`, breakdown: dmg, cover, critical },
  };
}

function tacticalResultToEngineResult(tactical: TacticalEngineResult): EngineResult {
  switch (tactical.kind) {
    case 'move_creature': {
      const r = tactical.result;
      if (!r.ok) {
        return { ok: false, summary: `Move failed: ${r.reason}${r.requiredDashFt ? ` (needs ${r.requiredDashFt} ft)` : ''}.`, tactical };
      }
      const oa = r.opportunityAttacks.length
        ? ` Provokes opportunity attack from: ${r.opportunityAttacks.join(', ')}.`
        : '';
      const final = r.finalPosition ? `(${r.finalPosition.x},${r.finalPosition.y})` : '';
      return { ok: true, summary: `Moved to ${final}; spent ${r.movementSpentFt} ft, ${r.movementRemainingFt} ft left.${oa}`, tactical };
    }
    case 'dash':
      return { ok: tactical.ok, summary: tactical.ok ? `Dashed; ${tactical.movementRemainingFt} ft available.` : `Dash failed: ${tactical.reason}.`, tactical };
    case 'disengage':
      return { ok: tactical.ok, summary: tactical.ok ? 'Disengaged; no opportunity attacks this turn.' : `Disengage failed: ${tactical.reason}.`, tactical };
    case 'query_reachable':
      return { ok: true, summary: `${tactical.cells.length} reachable cell(s).`, tactical };
    case 'query_targets_in_range':
      return { ok: true, summary: `${tactical.targets.length} target(s) in range.`, tactical };
    case 'check_line_of_sight':
      return { ok: tactical.ok, summary: tactical.ok ? `Line of sight clear${tactical.cover && tactical.cover !== 'none' ? ` (${tactical.cover} cover)` : ''}.` : `No clear shot: ${tactical.reason}.`, tactical };
  }
}

function isProne(state: GameState, actorId: string): boolean {
  const pc = state.party.find((p) => p.id === actorId);
  if (pc) return hasCondition(pc, 'prone') && !pc.unconscious;
  const m = state.monsters.find((x) => x.id === actorId);
  return Boolean(m && hasCondition(m, 'prone'));
}

function removeConditionFrom(state: GameState, actorId: string, condition: Condition): GameState {
  if (state.party.some((p) => p.id === actorId)) {
    return updateCharacterInParty(state, actorId, (c) => ({ ...c, conditions: c.conditions.filter((x) => x !== condition) }));
  }
  return { ...state, monsters: state.monsters.map((m) => (m.id === actorId ? { ...m, conditions: m.conditions.filter((x) => x !== condition) } : m)) };
}

/** Roll initiative, place everyone on a battle map, mark surprised creatures. */
function beginCombat(state: GameState, monsters: Monster[], surprisedIds: string[]): GameState {
  const adventure = getAdventure(state.adventureId);
  const marked = monsters.map((m) => (surprisedIds.includes(m.id) && !hasCondition(m, 'surprised') ? { ...m, conditions: [...m.conditions, 'surprised' as Condition] } : m));
  let draft: GameState = { ...state, monsters: marked };
  for (const id of surprisedIds) {
    if (draft.party.some((p) => p.id === id)) draft = updateCharacterInParty(draft, id, (c) => ({ ...c, conditions: c.conditions.includes('surprised') ? c.conditions : [...c.conditions, 'surprised'] }));
  }
  const init = rollInitiative(draft);
  draft = { ...draft, combat: { active: true, initiative: init, turnIndex: 0 }, activeCharacterId: draft.party.some((p) => p.id === init[0].actorId) ? init[0].actorId : draft.activeCharacterId };
  const existingMap = state.combat.battleMap;
  const map = existingMap && monsters.every((m) => existingMap.positions[m.id]) && state.party.every((p) => existingMap.positions[p.id])
    ? existingMap
    : buildBattleMap(draft, undefined, encounterBattleMap(adventure, draft.sceneId));
  // Surprised creatures can't take reactions until their first turn ends.
  const actors = { ...map.actors };
  for (const id of surprisedIds) if (actors[id]) actors[id] = { ...actors[id], reactionAvailable: false };
  return { ...draft, combat: { ...draft.combat, battleMap: { ...map, actors } } };
}

/** Reinforcements join an ongoing fight with their own initiative. */
function joinCombat(state: GameState, arrivals: Monster[]): GameState {
  const currentActor = state.combat.initiative[state.combat.turnIndex]?.actorId;
  const monsters = [...state.monsters.filter((m) => !arrivals.some((a) => a.id === m.id)), ...arrivals];
  const initiative = [
    ...state.combat.initiative.filter((e) => !arrivals.some((a) => a.id === e.actorId)),
    ...arrivals.map((m) => ({ actorId: m.id, roll: d20() + (m.initiativeBonus ?? 0) })),
  ].sort((a, b) => b.roll - a.roll);
  const draft: GameState = { ...state, monsters, combat: { ...state.combat, initiative, turnIndex: Math.max(0, initiative.findIndex((e) => e.actorId === currentActor)) } };
  const adventure = getAdventure(state.adventureId);
  const fresh = buildBattleMap(draft, undefined, encounterBattleMap(adventure, draft.sceneId));
  const old = state.combat.battleMap;
  const map = old
    ? { ...old, positions: { ...fresh.positions, ...old.positions }, actors: { ...fresh.actors, ...old.actors } }
    : fresh;
  return { ...draft, combat: { ...draft.combat, battleMap: map } };
}

/** Ends combat when no enemy can fight; a won fight in a combat scene moves the story on. */
function finishCombatIfResolved(state: GameState): GameState {
  if (state.monsters.some((m) => m.hp > 0)) return state;
  const ended: GameState = { ...state, combat: { ...state.combat, active: false } };
  const adventure = getAdventure(state.adventureId);
  return getSceneKind(adventure, state.sceneId) === 'combat' ? advanceScene(ended) : { ...ended, combat: { active: false, initiative: [], turnIndex: 0 } };
}

/** Take a monster out of the fight entirely (fled, surrendered, captured...). */
function removeMonster(state: GameState, id: string): GameState {
  const init = state.combat.initiative;
  const idx = init.findIndex((e) => e.actorId === id);
  const initiative = init.filter((e) => e.actorId !== id);
  let turnIndex = state.combat.turnIndex;
  if (idx >= 0 && idx < turnIndex) turnIndex -= 1;
  if (initiative.length) turnIndex %= initiative.length; else turnIndex = 0;
  const map = state.combat.battleMap;
  let battleMap = map;
  if (map) {
    const positions = { ...map.positions };
    const actors = { ...map.actors };
    delete positions[id];
    delete actors[id];
    battleMap = { ...map, positions, actors };
  }
  return { ...state, monsters: state.monsters.filter((m) => m.id !== id), combat: { ...state.combat, initiative, turnIndex, battleMap } };
}

function addMonsterCondition(state: GameState, id: string, condition: Condition): GameState {
  return { ...state, monsters: state.monsters.map((m) => (m.id === id && !m.conditions.includes(condition) ? { ...m, conditions: [...m.conditions, condition] } : m)) };
}

/** Shove (push): move the target one square directly away from the shover, if the square is free. */
function pushMonsterAway(state: GameState, fromId: string, targetId: string): GameState {
  const map = state.combat.battleMap;
  if (!map?.positions[fromId] || !map.positions[targetId]) return state;
  const a = map.positions[fromId];
  const t = map.positions[targetId];
  const dest = { x: t.x + Math.sign(t.x - a.x), y: t.y + Math.sign(t.y - a.y), z: t.z ?? 0 };
  const inBounds = dest.x >= 0 && dest.y >= 0 && dest.x < map.width && dest.y < map.height;
  const occupied = Object.entries(map.positions).some(([id, p]) => id !== targetId && p.x === dest.x && p.y === dest.y);
  const blocked = map.cells?.[`${dest.x},${dest.y}`]?.blocksMovement;
  if (!inBounds || occupied || blocked) return state;
  return { ...state, combat: { ...state.combat, battleMap: { ...map, positions: { ...map.positions, [targetId]: dest } } } };
}

/** Marks a character's action as used during combat (no-op outside combat). */
function spendAction(state: GameState, charId: string, uses: boolean | undefined): GameState {
  const map = state.combat.battleMap;
  if (!uses || !state.combat.active || !map?.actors[charId]) return state;
  return { ...state, combat: { ...state.combat, battleMap: { ...map, actors: { ...map.actors, [charId]: { ...map.actors[charId], actionUsed: true } } } } };
}

/** Damage to a character from a trap, fall or effect (handles 0 HP, massive damage). */
function applyPcDamage(state: GameState, id: string, dmg: number): GameState {
  return updateCharacterInParty(state, id, (c) => {
    if (c.hp <= 0) {
      const failure = Math.min(3, c.deathSaves.failure + 1);
      return { ...c, stable: false, deathSaves: { ...c.deathSaves, failure } };
    }
    const hp = Math.max(0, c.hp - dmg);
    const instantDeath = hp === 0 && dmg - c.hp >= c.maxHp;
    return { ...c, hp, unconscious: hp === 0, stable: false, deathSaves: instantDeath ? { success: 0, failure: 3 } : c.deathSaves };
  });
}

function defaultOpposingSkill(skill: string): string {
  return ({ stealth: 'perception', deception: 'insight', sleight_of_hand: 'perception', athletics: 'athletics', acrobatics: 'athletics', persuasion: 'insight', intimidation: 'insight', performance: 'insight' } as Record<string, string>)[skill] ?? skill;
}

function resolveSurpriseIds(state: GameState, monsters: Monster[], surprised: string[] | 'monsters' | 'party' | undefined): string[] {
  if (!surprised) return [];
  if (surprised === 'monsters') return monsters.map((m) => m.id);
  if (surprised === 'party') return state.party.map((p) => p.id);
  return surprised.filter((id) => monsters.some((m) => m.id === id) || state.party.some((p) => p.id === id));
}

function uniqueMonsterId(state: GameState, base: string, pending: Monster[]): string {
  const taken = new Set([...state.monsters, ...(state.reserveMonsters ?? []), ...pending].map((m) => m.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Enemy turns are engine-run: while it is a monster's turn (or a surprised
 * character's), resolve it and pass the turn on, until a character can act.
 */
export function runEnemyTurns(state: GameState): { state: GameState; results: Array<{ kind: string } & EngineResult> } {
  const results: Array<{ kind: string } & EngineResult> = [];
  for (let guard = 0; guard < 40 && state.combat.active; guard++) {
    const cur = state.combat.initiative[state.combat.turnIndex]?.actorId;
    if (!cur) break;
    const pc = state.party.find((p) => p.id === cur);
    if (pc) {
      if (!hasCondition(pc, 'surprised')) break;
      state = appendLog(removeConditionFrom(state, pc.id, 'surprised'), `${pc.name} is surprised and loses their turn.`);
      results.push({ kind: 'surprised', ok: true, summary: `${pc.name} is surprised and loses their turn.` });
    } else {
      const m = state.monsters.find((x) => x.id === cur);
      if (m && m.hp > 0) {
        const r = resolveEngineRequest(state, { kind: 'monster_turn' });
        state = r.state;
        results.push({ kind: 'monster_turn', ...r.result });
        if (!state.combat.active) break;
      }
    }
    if (state.party.every((p) => p.deathSaves.failure >= 3)) break;
    const e = resolveEngineRequest(state, { kind: 'end_turn' });
    state = e.state;
    results.push({ kind: 'end_turn', ...e.result });
  }
  return { state, results };
}

function appendLog(state: GameState, line: string): GameState {
  return { ...state, log: [...state.log, line] };
}

function slugifyTag(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Computes the set of gating tags currently satisfied by the party, so the
 * spatial engine can resolve `requires` on area connections (e.g. a locked
 * gate `{ tag: 'key:nandar_keep_gate' }`). Tags come from:
 *  - inventory items: each item yields `item:<slug>` and `key:<slug>`, and a
 *    trailing "key" is also stripped so "Nandar Keep Gate Key" satisfies
 *    `key:nandar_keep_gate`.
 *  - canon facts written as a literal tag, e.g. `flag:bridge_repaired`.
 */
function deriveSatisfiedTags(state: GameState): Set<string> {
  const tags = new Set<string>();
  for (const member of state.party) {
    for (const item of member.inventory) {
      const slug = slugifyTag(item);
      if (!slug) continue;
      tags.add(`item:${slug}`);
      tags.add(`key:${slug}`);
      const withoutKey = slug.replace(/_?key_?/g, '_').replace(/^_+|_+$/g, '');
      if (withoutKey && withoutKey !== slug) tags.add(`key:${withoutKey}`);
    }
  }
  for (const fact of state.canonLog) {
    const content = fact.content.trim();
    if (/^(flag|key|item|skill):/.test(content)) tags.add(content);
  }
  return tags;
}

function d20() {
  return Math.floor(randomProvider() * 20) + 1;
}

/** Rolls initiative for the whole party and all monsters, highest first. */
// Older saves could enter an authored encounter with only party initiative.
export function repairMissingEncounter(state: GameState): GameState {
  if (!state.combat.active || state.monsters.length > 0 || !state.party[0]) return state;
  const adventure = getAdventure(state.adventureId);
  if (getSceneKind(adventure, state.sceneId) !== 'combat') return state;
  const monsters = resolveCombatMonsters(adventure, state.sceneId, state.party[0].level);
  if (monsters.length === 0) return state;
  const currentActor = state.combat.initiative[state.combat.turnIndex]?.actorId;
  const initiative = [
    ...state.combat.initiative,
    ...monsters.map((monster) => ({ actorId: monster.id, roll: d20() + (monster.initiativeBonus ?? 0) })),
  ].sort((a, b) => b.roll - a.roll);
  const draft = {
    ...state, monsters,
    combat: { ...state.combat, initiative, turnIndex: Math.max(0, initiative.findIndex((entry) => entry.actorId === currentActor)) },
  };
  return { ...draft, combat: { ...draft.combat, battleMap: buildBattleMap(draft, undefined, encounterBattleMap(adventure, state.sceneId)) } };
}

function rollInitiative(state: GameState): { actorId: string; roll: number }[] {
  return [
    ...state.party.map((p) => ({ actorId: p.id, roll: d20() + Math.floor((p.abilities.dex - 10) / 2) })),
    ...state.monsters.map((m) => ({ actorId: m.id, roll: d20() + (m.initiativeBonus ?? 0) })),
  ].sort((a, b) => b.roll - a.roll);
}

/** Doubles the dice count for a critical hit (5e: double the dice, keep the flat modifier). */
function critFormula(formula: string): string {
  const m = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return formula;
  return `${Number(m[1]) * 2}d${m[2]}${m[3] ?? ''}`;
}

function rollFormula(
  formula: string,
  fallbackMod = 0,
  options?: { advantage?: boolean; disadvantage?: boolean; bonusFormula?: string }
): RollBreakdown {
  // Accept "2d6+3", "2d6 + 3", "1d8-1" and flat numbers like "4".
  formula = formula.replace(/\s+/g, '');
  const flat = /^(\d+)$/.exec(formula);
  if (flat) return { formula, rolls: [], modifier: Number(flat[1]), total: Number(flat[1]) };
  const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return { formula, rolls: [], modifier: fallbackMod, total: fallbackMod };
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const inlineMod = match[3] ? Number(match[3]) : fallbackMod;

  let rolls = Array.from({ length: count }, () => Math.floor(randomProvider() * sides) + 1);
  let keptRoll = rolls[0];

  if (count === 1 && sides === 20) {
    if (options?.advantage) {
      const secondRoll = Math.floor(randomProvider() * sides) + 1;
      rolls = [rolls[0], secondRoll];
      keptRoll = Math.max(...rolls);
    } else if (options?.disadvantage) {
      const secondRoll = Math.floor(randomProvider() * sides) + 1;
      rolls = [rolls[0], secondRoll];
      keptRoll = Math.min(...rolls);
    }
  }

  let total = (count === 1 && sides === 20 ? keptRoll : rolls.reduce((a, b) => a + b, 0)) + inlineMod;
  
  if (options?.bonusFormula) {
    const bonusBreakdown = rollFormula(options.bonusFormula);
    total += bonusBreakdown.total;
  }

  return {
    formula,
    rolls,
    modifier: inlineMod,
    total,
    advantage: options?.advantage,
    disadvantage: options?.disadvantage,
    keptRoll: count === 1 && sides === 20 ? keptRoll : undefined,
  };
}

