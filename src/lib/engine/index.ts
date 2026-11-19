import { getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { encounterBattleMap, resolveCombatMonsters } from '@/lib/game/adventures/encounters';
import type { GameState, Character } from '@/lib/game/types';
import { advanceScene, buildBattleMap } from '@/lib/game/state';
import type { EngineRequest, EngineResult, RollBreakdown, OpportunityAttackOutcome, CoverOutcome } from './types';
import { resolveSpatialRequest, type SpatialEngineResult } from './spatial';
import { resolveTacticalRequest, lineOfSight, coverAcBonus, reachableCells, resolveMove, distanceFt, distanceBetweenActors, type TacticalEngineRequest, type TacticalEngineResult, type BattleMap, type CoverKind, type GridCoord } from './spatial/tactical';
import { monsterAttacks } from '@/lib/game/monsters';
import { abilityMod, getHitDice, saveBonus } from '@/lib/game/rules';
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
  options?: { physicalDice?: boolean; advanceOnSkillSuccess?: boolean }
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

      if (hasCondition(char, 'poisoned')) disadvantage = true;
      if (hasCondition(char, 'restrained') && (request.skill === 'acrobatics' || request.skill === 'athletics')) disadvantage = true;
      if (hasCondition(char, 'blinded') && (request.skill === 'perception')) disadvantage = true;

      if (options?.physicalDice && request.manualRoll === undefined) {
        return {
          state,
          result: {
            ok: false,
            summary: `Waiting for manual ${request.skill} roll for ${char.name}...`,
            needsManualRoll: true,
            manualRollContext: {
              kind: 'skill_check',
              formula: `1d20+${mod}`,
              dc: request.dc,
              advantage,
              disadvantage,
            },
          },
        };
      }

      const breakdown = request.manualRoll !== undefined 
        ? { formula: `1d20+${mod}`, rolls: [request.manualRoll], modifier: mod, total: request.manualRoll + mod }
        : rollFormula('1d20', mod, { advantage, disadvantage });
      
      const ok = breakdown.total >= request.dc;
      breakdown.dc = request.dc;
      breakdown.ok = ok;
      const inCombatScene =
        getSceneKind(getAdventure(state.adventureId), state.sceneId) === 'combat';
      const next = ok && !inCombatScene && options?.advanceOnSkillSuccess !== false ? advanceScene(state) : state;
      return {
        state: appendLog(next, `${char.name}: ${request.skill} check ${ok ? 'passed' : 'failed'} (${breakdown.total} vs DC ${request.dc})`),
        result: { ok, summary: `${request.reason}: ${ok ? 'success' : 'failure'}`, breakdown },
      };
    }
    case 'start_combat': {
      if (state.combat.active) {
        const repaired = repairMissingEncounter(state);
        return { state: repaired, result: { ok: repaired !== state, summary: repaired !== state
          ? 'Missing enemies restored to initiative.' : 'Combat is already active.' } };
      }
      const adventure = getAdventure(state.adventureId);
      const combatSceneId = getSceneKind(adventure, state.sceneId) === 'combat'
        ? state.sceneId
        : adventure.sceneOrder.find((id) => adventure.scenes[id]?.kind === 'combat') ?? 'combat';
      const monsters = getSceneKind(adventure, combatSceneId) === 'combat' &&
          (state.monsters.length === 0 || (state.sceneId !== combatSceneId && adventure.sceneEncounters?.[combatSceneId]))
        ? resolveCombatMonsters(adventure, combatSceneId, state.party[0].level)
        : state.monsters;
      if (!monsters.some((monster) => monster.hp > 0)) {
        return { state, result: { ok: false, summary: 'No active enemies to roll initiative for.' } };
      }
      const init = rollInitiative({ ...state, monsters });
      const draft = {
        ...state,
        monsters,
        combat: { active: true, initiative: init, turnIndex: 0 },
        sceneId: combatSceneId,
        activeCharacterId: init[0].actorId,
      };
      const authoredMap = encounterBattleMap(adventure, combatSceneId);
      const next = {
        ...draft,
        combat: { ...draft.combat, battleMap: buildBattleMap(draft, undefined, authoredMap) },
      };
      return { state: appendLog(next, 'Combat started. Roll for initiative!'), result: { ok: true, summary: 'Initiative rolled.' } };
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

      // 5e move-then-attack: a melee attacker out of reach first spends their
      // remaining movement to close in (as monster turns already do). If they
      // still can't reach, they end up as close as possible with the action unspent.
      const approach = approachForMelee(state, char.id, target.id, Boolean(request.ranged));
      if (approach.result) return { state: approach.state, result: approach.result };
      state = approach.state;
      const approachNote = approach.note;

      const map = state.combat.battleMap;
      if (map && !request.ranged) {
        const distance = distanceBetweenActors(map, char.id, target.id);
        const reach = map.actors[char.id]?.reachFt ?? 5;
        if (distance !== undefined && distance > reach) {
          return { state, result: { ok: false, summary: `${target.name} is ${distance} ft away, outside your ${reach} ft melee reach.` } };
        }
      }
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
      if (request.ranged) {
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

      const attackMod = char.weapon.attackBonus;
      let advantage = request.advantage;
      let disadvantage = request.disadvantage;
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
        if (request.ranged) disadvantage = true; else advantage = true;
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
        ? { formula: `1d20+${attackMod}`, rolls: [request.manualRoll], modifier: attackMod, total: request.manualRoll + attackMod + (bonusFormula ? rollFormula(bonusFormula).total : 0), dc: effectiveTargetAc }
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
        return { state: appendLog(nextState, `${char.name} missed ${target.name}.`), result: { ok: false, summary: `${approachNote}Attack missed${coverNote}.`, breakdown: toHit, cover: coverOutcome } };
      }
      // Use the attacker's actual weapon damage; a crit doubles the dice (5e).
      const damage = rollFormula(critical ? critFormula(char.weapon.damage) : char.weapon.damage);
      const monsters = nextState.monsters.map((m) => m.id === target.id ? { ...m, hp: Math.max(0, m.hp - damage.total) } : m);
      let next = { ...nextState, monsters };
      const battleMap = next.combat.battleMap;
      if (battleMap && monsters.some((monster) => monster.id === target.id && monster.hp === 0)) {
        const positions = { ...battleMap.positions };
        delete positions[target.id];
        next = { ...next, combat: { ...next.combat, battleMap: { ...battleMap, positions } } };
      }
      const allDown = monsters.every((m) => m.hp <= 0);
      if (allDown) {
        next = advanceScene({ ...next, combat: { ...next.combat, active: false } });
      } else if (!next.combat.active) {
        // Attacking living enemies starts combat, so the HUD shows them and
        // monster turns / initiative proceed instead of the fight staying hidden.
        const initiative = rollInitiative(next);
        const encounter = {
          ...next,
          activeCharacterId: initiative[0].actorId,
          combat: { active: true, initiative, turnIndex: 0 },
        };
        const authoredMap = encounterBattleMap(getAdventure(next.adventureId), next.sceneId);
        next = {
          ...encounter,
          combat: { ...encounter.combat, battleMap: buildBattleMap(encounter, undefined, authoredMap) },
        };
      }
      return {
        state: appendLog(next, `${char.name} hit ${target.name} for ${damage.total}.`),
        result: { ok: true, summary: `${approachNote}Hit ${target.name} for ${damage.total} damage.${coverOutcome ? ` (${coverOutcome.kind.replace('_', '-')} cover applied, AC ${coverOutcome.effectiveAc})` : ''}`, breakdown: damage, critical, cover: coverOutcome },
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
      const afterStand = standing ? removeConditionFrom(nextState, nextActorId, 'prone') : nextState;
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
      const attacker = wantedId
        ? state.monsters.find((m) => m.id === wantedId && m.hp > 0)
        : state.monsters.find((m) => m.hp > 0);
      if (!attacker) {
        const anyAlive = state.monsters.some((m) => m.hp > 0);
        return { state, result: { ok: true, summary: anyAlive ? 'That monster is down and cannot act.' : 'No monsters remain.' } };
      }

      const consciousPlayers = state.party.filter((p) => !p.unconscious);
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
      if (melee) {
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
      if (allDead) next = { ...next, sceneId: 'ending' };
      
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
    const hit = natural !== 1 && (toHit.total >= target.ac || critical);
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
  if (hasCondition(attacker, 'blessed')) bonusFormula = '1d4';

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
    if (died && next.party.every((p) => p.hp <= 0 && p.deathSaves.failure >= 3)) next = { ...next, sceneId: 'ending' };
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
    if (next.party.every((p) => p.hp <= 0 && p.deathSaves.failure >= 3)) next = { ...next, sceneId: 'ending' };
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

function removeConditionFrom(state: GameState, actorId: string, condition: 'prone'): GameState {
  if (state.party.some((p) => p.id === actorId)) {
    return updateCharacterInParty(state, actorId, (c) => ({ ...c, conditions: c.conditions.filter((x) => x !== condition) }));
  }
  return { ...state, monsters: state.monsters.map((m) => (m.id === actorId ? { ...m, conditions: m.conditions.filter((x) => x !== condition) } : m)) };
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
  const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return { formula, rolls: [], modifier: fallbackMod, total: fallbackMod };
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const inlineMod = match[3] ? Number(match[3]) : fallbackMod;

  let rolls = Array.from({ length: count }, () => Math.floor(randomProvider() * sides) + 1);
  let keptRoll = rolls[0];

  if (count === 1 && sides === 20) {
    if (options?.advantage && !options.disadvantage) {
      const secondRoll = Math.floor(randomProvider() * sides) + 1;
      rolls = [rolls[0], secondRoll];
      keptRoll = Math.max(...rolls);
    } else if (options?.disadvantage && !options.advantage) {
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

