import { getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { encounterBattleMap } from '@/lib/game/adventures/encounters';
import type { GameState, Character } from '@/lib/game/types';
import { advanceScene, buildBattleMap } from '@/lib/game/state';
import type { EngineRequest, EngineResult, RollBreakdown, OpportunityAttackOutcome, CoverOutcome } from './types';
import { resolveSpatialRequest, type SpatialEngineResult } from './spatial';
import { resolveTacticalRequest, lineOfSight, coverAcBonus, reachableCells, resolveMove, distanceFt, distanceBetweenActors, type TacticalEngineRequest, type TacticalEngineResult, type BattleMap, type CoverKind, type GridCoord } from './spatial/tactical';
import { monsterAttacks } from '@/lib/game/monsters';
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
      const inCombatScene =
        getSceneKind(getAdventure(state.adventureId), state.sceneId) === 'combat';
      const next = ok && !inCombatScene ? advanceScene(state) : state;
      return {
        state: appendLog(next, `${char.name}: ${request.skill} check ${ok ? 'passed' : 'failed'} (${breakdown.total} vs DC ${request.dc})`),
        result: { ok, summary: `${request.reason}: ${ok ? 'success' : 'failure'}`, breakdown },
      };
    }
    case 'start_combat': {
      const init = rollInitiative(state);

      const adventure = getAdventure(state.adventureId);
      const combatSceneId =
        adventure.sceneOrder.find((id) => adventure.scenes[id]?.kind === 'combat') ?? 'combat';

      const draft = {
        ...state,
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
      const critical = naturalRoll === 20;
      toHit.ok = toHit.total >= effectiveTargetAc || critical;

      if (!toHit.ok) {
        const coverNote = coverOutcome ? ` (${coverOutcome.kind.replace('_', '-')} cover: AC ${coverOutcome.baseAc}+${coverOutcome.bonus})` : '';
        return { state: appendLog(state, `${char.name} missed ${target.name}.`), result: { ok: false, summary: `Attack missed${coverNote}.`, breakdown: toHit, cover: coverOutcome } };
      }
      // Use the attacker's actual weapon damage; a crit doubles the dice (5e).
      const damage = rollFormula(critical ? critFormula(char.weapon.damage) : char.weapon.damage);
      const monsters = state.monsters.map((m) => m.id === target.id ? { ...m, hp: Math.max(0, m.hp - damage.total) } : m);
      let next = { ...state, monsters };
      const allDown = monsters.every((m) => m.hp <= 0);
      if (allDown) {
        next = advanceScene({ ...next, combat: { ...next.combat, active: false } });
      } else if (!next.combat.active) {
        // Attacking living enemies starts combat, so the HUD shows them and
        // monster turns / initiative proceed instead of the fight staying hidden.
        next = { ...next, combat: { active: true, initiative: rollInitiative(next), turnIndex: 0 } };
      }
      return {
        state: appendLog(next, `${char.name} hit ${target.name} for ${damage.total}.`),
        result: { ok: true, summary: `Hit ${target.name} for ${damage.total} damage.${coverOutcome ? ` (${coverOutcome.kind.replace('_', '-')} cover applied, AC ${coverOutcome.effectiveAc})` : ''}`, breakdown: damage, critical, cover: coverOutcome },
      };
    }
    case 'monster_turn': {
      const attacker = state.monsters.find((m) => m.hp > 0);
      if (!attacker) return { state, result: { ok: true, summary: 'No monsters remain.' } };

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
      const placed = consciousPlayers.filter((p) => battleMap.positions[p.id]);
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

      let next = updateCharacterInParty(state, char.id, (c) => ({ 
        ...c, hp, unconscious, deathSaves: { success, failure } 
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
      if (feature.usesRemaining <= 0) return { state, result: { ok: false, summary: `No uses of ${feature.name} remaining.` } };
      
      let next = state;
      let summary = `${char.name} used ${feature.name}.`;
      let breakdown: RollBreakdown | undefined;

      // Logic for specific features
      if (feature.id === 'second_wind') {
        breakdown = rollFormula('1d10', char.level);
        const hp = Math.min(char.maxHp, char.hp + breakdown.total);
        next = updateCharacterInParty(state, char.id, (c) => ({ ...c, hp }));
        summary = `${char.name} used Second Wind and restored ${breakdown.total} HP.`;
      } else if (feature.id === 'lay_on_hands') {
          // Simplistic implementation for now
          const amount = Math.min(feature.usesRemaining, 5);
          next = updateCharacterInParty(state, char.id, (c) => ({ ...c, hp: Math.min(c.maxHp, c.hp + amount) }));
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

      const spellName = request.spellName.toLowerCase();
      const knownSpells = ['cure wounds', 'healing word', 'magic missile', 'shield', 'bless'];
      if (!knownSpells.some((known) => spellName.includes(known))) {
        return { state, result: { ok: false, summary: `${request.spellName} is not a recognized spell.` } };
      }
      if (char.knownSpells && !char.knownSpells.some((known) => known.toLowerCase() === spellName)) {
        return { state, result: { ok: false, summary: `${char.name} does not know ${request.spellName}.` } };
      }

      let next = state;
      if (level > 0) {
        next = updateCharacterInParty(state, char.id, (c) => {
          const spellSlots = { ...c.spellSlots, [level]: { ...slot, remaining: slot.remaining - 1 } };
          return { ...c, spellSlots };
        });
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
    case 'short_rest': {
      const party = state.party.map(p => ({
        ...p,
        features: p.features.map(f => f.rechargeOn === 'short_rest' ? { ...f, usesRemaining: f.usesMax } : f)
      }));
      const next = {
        ...state,
        party,
        player: party[0],
      };
      return { state: appendLog(next, 'The party took a short rest.'), result: { ok: true, summary: 'Short rest complete.' } };
    }
    case 'long_rest': {
      const party = state.party.map(p => ({
        ...p,
        hp: p.maxHp,
        features: p.features.map(f => ({ ...f, usesRemaining: f.usesMax })),
        spellSlots: Object.fromEntries(
          Object.entries(p.spellSlots).map(([lvl, s]) => [lvl, { ...s, remaining: s.max }])
        )
      }));
      const next = {
        ...state,
        party,
        player: party[0],
      };
      return { state: appendLog(next, 'The party took a long rest. Everyone is restored.'), result: { ok: true, summary: 'Long rest complete.' } };
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

  const baseAc = hasCondition(target, 'shielded') ? target.ac + 5 : target.ac;
  const coverBonus = opts.coverBonus ?? 0;
  const effectiveAc = baseAc + coverBonus;
  const cover: CoverOutcome | undefined =
    opts.coverKind && opts.coverKind !== 'none' ? { kind: opts.coverKind, baseAc, bonus: coverBonus, effectiveAc } : undefined;
  const coverNote = cover ? ` (${cover.kind.replace('_', '-')} cover: AC ${baseAc}+${coverBonus})` : '';

  const toHit = rollFormula('1d20', attack.attackBonus, { advantage, disadvantage, bonusFormula });
  if (toHit.total < effectiveAc) {
    return {
      state: appendLog(state, `${attacker.name} missed ${target.name}.`),
      result: { ok: false, summary: `${attacker.name} missed${coverNote}.`, breakdown: toHit, cover },
    };
  }

  if (target.unconscious || target.hp <= 0) {
    const failure = Math.min(3, target.deathSaves.failure + 2);
    const died = failure >= 3;
    let next = updateCharacterInParty(state, target.id, (c) => ({ ...c, deathSaves: { ...c.deathSaves, failure } }));
    if (died && next.party.every((p) => p.hp <= 0 && p.deathSaves.failure >= 3)) next = { ...next, sceneId: 'ending' };
    const note = died ? `${target.name} has died!` : `${target.name} suffers two death-save failures (${failure}/3).`;
    return {
      state: appendLog(next, `${attacker.name} strikes the fallen ${target.name}. ${note}`),
      result: { ok: true, summary: `${attacker.name} strikes the fallen ${target.name}. ${note}`, breakdown: toHit },
    };
  }

  const dmg = rollFormula(attack.damage);
  const hp = Math.max(0, target.hp - dmg.total);
  const unconscious = hp === 0;
  const next = updateCharacterInParty(state, target.id, (c) => ({ ...c, hp, unconscious }));
  return {
    state: appendLog(next, `${attacker.name} hit ${target.name} for ${dmg.total}.${unconscious ? ` ${target.name} has fallen unconscious!` : ''}`),
    result: { ok: true, summary: `${attacker.name} hit ${target.name}.${coverNote}${unconscious ? ` ${target.name} is unconscious!` : ''}`, breakdown: dmg, cover },
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
function rollInitiative(state: GameState): { actorId: string; roll: number }[] {
  return [
    ...state.party.map((p) => ({ actorId: p.id, roll: d20() + Math.floor((p.abilities.dex - 10) / 2) })),
    ...state.monsters.map((m) => ({ actorId: m.id, roll: d20() + 1 })),
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
