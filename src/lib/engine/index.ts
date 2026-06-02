import { getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import type { GameState } from '@/lib/game/types';
import { advanceScene } from '@/lib/game/state';
import type { EngineRequest, EngineResult, RollBreakdown } from './types';

export function resolveEngineRequest(
  state: GameState,
  request: EngineRequest,
  options?: { physicalDice?: boolean }
): { state: GameState; result: EngineResult } {
  switch (request.kind) {
    case 'skill_check': {
      const mod = state.player.skills[request.skill] ?? 0;
      
      if (options?.physicalDice && request.manualRoll === undefined) {
        return {
          state,
          result: {
            ok: false,
            summary: `Waiting for manual ${request.skill} roll...`,
            needsManualRoll: true,
            manualRollContext: {
              kind: 'skill_check',
              formula: `1d20+${mod}`,
              dc: request.dc,
              advantage: request.advantage,
              disadvantage: request.disadvantage,
            },
          },
        };
      }

      const breakdown = request.manualRoll !== undefined 
        ? { formula: `1d20+${mod}`, rolls: [request.manualRoll], modifier: mod, total: request.manualRoll + mod }
        : rollFormula('1d20', mod, { advantage: request.advantage, disadvantage: request.disadvantage });
      
      const ok = breakdown.total >= request.dc;
      breakdown.dc = request.dc;
      breakdown.ok = ok;
      const inCombatScene =
        getSceneKind(getAdventure(state.adventureId), state.sceneId) === 'combat';
      const next = ok && !inCombatScene ? advanceScene(state) : state;
      return {
        state: appendLog(next, `${request.skill} check ${ok ? 'passed' : 'failed'} (${breakdown.total} vs DC ${request.dc})`),
        result: { ok, summary: `${request.reason}: ${ok ? 'success' : 'failure'}`, breakdown },
      };
    }
    case 'start_combat': {
      const init = [
        { actorId: state.player.id, roll: d20() + 1 },
        ...state.monsters.map((m) => ({ actorId: m.id, roll: d20() + 1 })),
      ].sort((a, b) => b.roll - a.roll);
      const adventure = getAdventure(state.adventureId);
      const combatSceneId =
        adventure.sceneOrder.find((id) => adventure.scenes[id]?.kind === 'combat') ?? 'combat';
      const next = {
        ...state,
        combat: { active: true, initiative: init, turnIndex: 0 },
        sceneId: combatSceneId,
      };
      return { state: appendLog(next, 'Combat started.'), result: { ok: true, summary: 'Initiative rolled.' } };
    }
    case 'player_attack': {
      const target = state.monsters.find((m) => m.id === request.targetId && m.hp > 0);
      if (!target) return { state, result: { ok: false, summary: 'No valid target.' } };

      const attackMod = state.player.weapon.attackBonus;

      if (options?.physicalDice && request.manualRoll === undefined) {
        return {
          state,
          result: {
            ok: false,
            summary: `Waiting for manual attack roll against ${target.name}...`,
            needsManualRoll: true,
            manualRollContext: {
              kind: 'player_attack',
              formula: `1d20+${attackMod}`,
              dc: target.ac,
              advantage: request.advantage,
              disadvantage: request.disadvantage,
            },
          },
        };
      }

      const toHit = request.manualRoll !== undefined
        ? { formula: `1d20+${attackMod}`, rolls: [request.manualRoll], modifier: attackMod, total: request.manualRoll + attackMod, dc: target.ac }
        : rollFormula('1d20', attackMod, { advantage: request.advantage, disadvantage: request.disadvantage });
      
      toHit.dc = target.ac;
      const critical = toHit.rolls[0] === 20 || (request.advantage && (toHit.rolls[0] === 20 || toHit.rolls[1] === 20));
      toHit.ok = toHit.total >= target.ac || critical;

      if (toHit.total < target.ac && !critical) {
        return { state: appendLog(state, `Attack missed ${target.name}.`), result: { ok: false, summary: 'Attack missed.', breakdown: toHit } };
      }
      const damage = rollFormula(critical ? '2d8' : '1d8', 3);
      const monsters = state.monsters.map((m) => m.id === target.id ? { ...m, hp: Math.max(0, m.hp - damage.total) } : m);
      let next = { ...state, monsters };
      const allDown = monsters.every((m) => m.hp <= 0);
      if (allDown) next = advanceScene({ ...next, combat: { ...next.combat, active: false } });
      return {
        state: appendLog(next, `${state.player.name} hit ${target.name} for ${damage.total}.`),
        result: { ok: true, summary: `Hit ${target.name} for ${damage.total} damage.`, breakdown: damage, critical },
      };
    }
    case 'monster_turn': {
      const attacker = state.monsters.find((m) => m.hp > 0);
      if (!attacker) return { state, result: { ok: true, summary: 'No monsters remain.' } };
      const toHit = rollFormula('1d20', attacker.attackBonus);
      if (toHit.total < state.player.ac) {
        return { state: appendLog(state, `${attacker.name} missed.`), result: { ok: false, summary: `${attacker.name} missed.`, breakdown: toHit } };
      }
      const dmg = rollFormula('1d6', 1);
      const hp = Math.max(0, state.player.hp - dmg.total);
      const unconscious = hp === 0;
      const next = { ...state, player: { ...state.player, hp, unconscious } };
      return { 
        state: appendLog(next, `${attacker.name} hit for ${dmg.total}.${unconscious ? ' You have fallen unconscious!' : ''}`), 
        result: { ok: true, summary: `${attacker.name} hit you.${unconscious ? ' You are unconscious!' : ''}`, breakdown: dmg } 
      };
    }
    case 'death_save': {
      if (!state.player.unconscious) return { state, result: { ok: false, summary: 'You are not unconscious.' } };

      if (options?.physicalDice && request.manualRoll === undefined) {
        return {
          state,
          result: {
            ok: false,
            summary: 'Waiting for manual Death Save...',
            needsManualRoll: true,
            manualRollContext: { kind: 'skill_check', formula: '1d20' }, // Reusing skill_check kind for UI
          },
        };
      }

      const breakdown = request.manualRoll !== undefined
        ? { formula: '1d20', rolls: [request.manualRoll], modifier: 0, total: request.manualRoll }
        : rollFormula('1d20', 0);
      
      const natural = breakdown.rolls[0];
      let { success, failure } = state.player.deathSaves;
      let hp = 0;
      let unconscious = true;
      let msg = '';

      if (natural === 20) {
        success = 0;
        failure = 0;
        hp = 1;
        unconscious = false;
        msg = 'Critical Success! You regain 1 HP and are no longer unconscious.';
      } else if (natural === 1) {
        failure += 2;
        msg = 'Critical Failure! You mark 2 failures.';
      } else if (natural >= 10) {
        success += 1;
        msg = 'Success! You mark 1 success.';
      } else {
        failure += 1;
        msg = 'Failure. You mark 1 failure.';
      }

      let dead = false;
      if (failure >= 3) {
        dead = true;
        msg += ' You have died.';
      } else if (success >= 3) {
        success = 0;
        failure = 0;
        unconscious = true; // Still unconscious but stable
        msg += ' You are now stable.';
      }

      const next = { 
        ...state, 
        player: { 
          ...state.player, 
          hp, 
          unconscious, 
          deathSaves: { success, failure } 
        },
        sceneId: dead ? 'ending' : state.sceneId
      };
      
      return { 
        state: appendLog(next, `Death Save: ${msg}`), 
        result: { ok: natural >= 10, summary: msg, breakdown } 
      };
    }
    case 'use_feature': {
      const idx = state.player.features.findIndex((f) => f.id === request.featureId);
      if (idx < 0) return { state, result: { ok: false, summary: `Feature ${request.featureId} not found.` } };
      const feature = state.player.features[idx];
      if (feature.usesRemaining <= 0) return { state, result: { ok: false, summary: `No uses of ${feature.name} remaining.` } };
      
      let next = state;
      let summary = `${feature.name} used.`;
      let breakdown: RollBreakdown | undefined;

      // Logic for specific features
      if (feature.id === 'second_wind') {
        breakdown = rollFormula('1d10', state.player.level);
        const hp = Math.min(state.player.maxHp, state.player.hp + breakdown.total);
        next = { ...state, player: { ...state.player, hp } };
        summary = `Second Wind restored ${breakdown.total} HP.`;
      }

      const features = next.player.features.map((f, i) => i === idx ? { ...f, usesRemaining: f.usesRemaining - 1 } : f);
      next = { ...next, player: { ...next.player, features } };
      
      return { state: appendLog(next, summary), result: { ok: true, summary, breakdown } };
    }
    case 'cast_spell': {
      const level = request.level;
      const slot = state.player.spellSlots[level];
      if (level > 0) { // Cantrips don't use slots
        if (!slot || slot.remaining <= 0) {
          return { state, result: { ok: false, summary: `No level ${level} spell slots remaining.` } };
        }
      }

      let next = state;
      if (level > 0) {
        const spellSlots = { ...state.player.spellSlots, [level]: { ...slot, remaining: slot.remaining - 1 } };
        next = { ...state, player: { ...state.player, spellSlots } };
      }

      let summary = `Cast ${request.spellName} (Level ${level})`;
      let breakdown: RollBreakdown | undefined;

      const spellName = request.spellName.toLowerCase();
      
      // Basic Spell Logic
      if (spellName.includes('cure wounds')) {
        breakdown = rollFormula(`${level}d8`, 3); // Assuming +3 modifier
        const hp = Math.min(next.player.maxHp, next.player.hp + breakdown.total);
        const unconscious = hp > 0 ? false : next.player.unconscious;
        const deathSaves = hp > 0 ? { success: 0, failure: 0 } : next.player.deathSaves;
        next = { ...next, player: { ...next.player, hp, unconscious, deathSaves } };
        summary = `Cure Wounds restored ${breakdown.total} HP.`;
      } else if (spellName.includes('healing word')) {
        breakdown = rollFormula(`${level}d4`, 3);
        const hp = Math.min(next.player.maxHp, next.player.hp + breakdown.total);
        const unconscious = hp > 0 ? false : next.player.unconscious;
        const deathSaves = hp > 0 ? { success: 0, failure: 0 } : next.player.deathSaves;
        next = { ...next, player: { ...next.player, hp, unconscious, deathSaves } };
        summary = `Healing Word restored ${breakdown.total} HP.`;
      } else if (spellName.includes('magic missile')) {
        const missileCount = 2 + level; // 3 missiles at level 1, +1 per level
        breakdown = rollFormula(`${missileCount}d4`, missileCount); // Each missile is 1d4+1
        if (request.targetId) {
          const monsters = next.monsters.map(m => 
            m.id === request.targetId ? { ...m, hp: Math.max(0, m.hp - (breakdown?.total ?? 0)) } : m
          );
          next = { ...next, monsters };
          const target = next.monsters.find(m => m.id === request.targetId);
          summary = `Magic Missile hit ${target?.name} for ${breakdown.total} damage.`;
        } else {
          summary = `Magic Missile fired ${missileCount} darts for ${breakdown.total} total damage.`;
        }
      }

      return { state: appendLog(next, summary), result: { ok: true, summary, breakdown } };
    }
    case 'short_rest': {
      const features = state.player.features.map(f => f.rechargeOn === 'short_rest' ? { ...f, usesRemaining: f.usesMax } : f);
      const next = { ...state, player: { ...state.player, features } };
      return { state: appendLog(next, 'Took a short rest. Features recharged.'), result: { ok: true, summary: 'Short rest complete.' } };
    }
    case 'long_rest': {
      const features = state.player.features.map(f => ({ ...f, usesRemaining: f.usesMax }));
      const spellSlots = Object.fromEntries(
        Object.entries(state.player.spellSlots).map(([lvl, s]) => [lvl, { ...s, remaining: s.max }])
      );
      const next = { ...state, player: { ...state.player, hp: state.player.maxHp, features, spellSlots } };
      return { state: appendLog(next, 'Took a long rest. HP, features, and slots restored.'), result: { ok: true, summary: 'Long rest complete.' } };
    }
    case 'update_npc': {
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
      // Check for duplicate content in the existing log to avoid repetition
      const isDuplicate = state.canonLog.some(f => f.content === request.content);
      if (isDuplicate) return { state, result: { ok: true, summary: 'Fact already established.' } };

      const fact = { id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, content: request.content, importance: request.importance };
      return { state: { ...state, canonLog: [...state.canonLog, fact] }, result: { ok: true, summary: 'Added canon fact.' } };
    }
    case 'update_inventory': {
      const gold = state.player.gold + (request.goldDelta ?? 0);
      let inventory = [...state.player.inventory];
      
      if (request.add) {
        inventory = [...inventory, ...request.add];
      }
      
      if (request.remove) {
        inventory = inventory.filter(item => !request.remove?.includes(item));
      }

      const next = { ...state, player: { ...state.player, gold, inventory } };
      return { state: next, result: { ok: true, summary: 'Inventory updated.' } };
    }
  }
}

function appendLog(state: GameState, line: string): GameState {
  return { ...state, log: [...state.log, line] };
}

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

function rollFormula(
  formula: string,
  fallbackMod = 0,
  options?: { advantage?: boolean; disadvantage?: boolean }
): RollBreakdown {
  const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return { formula, rolls: [], modifier: fallbackMod, total: fallbackMod };
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const inlineMod = match[3] ? Number(match[3]) : fallbackMod;

  let rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  let keptRoll = rolls[0];

  if (count === 1 && sides === 20) {
    if (options?.advantage) {
      const secondRoll = Math.floor(Math.random() * sides) + 1;
      rolls = [rolls[0], secondRoll];
      keptRoll = Math.max(...rolls);
    } else if (options?.disadvantage) {
      const secondRoll = Math.floor(Math.random() * sides) + 1;
      rolls = [rolls[0], secondRoll];
      keptRoll = Math.min(...rolls);
    }
  }

  const total = (count === 1 && sides === 20 ? keptRoll : rolls.reduce((a, b) => a + b, 0)) + inlineMod;
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
