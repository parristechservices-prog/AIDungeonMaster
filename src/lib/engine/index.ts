import { getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import type { GameState, Character } from '@/lib/game/types';
import { advanceScene, buildTacticalGrid } from '@/lib/game/state';
import type { EngineRequest, EngineResult, RollBreakdown } from './types';

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
      const init = [
        ...state.party.map((p) => ({ actorId: p.id, roll: d20() + Math.floor((p.abilities.dex - 10) / 2) })),
        ...state.monsters.map((m) => ({ actorId: m.id, roll: d20() + 1 })),
      ].sort((a, b) => b.roll - a.roll);
      
      const adventure = getAdventure(state.adventureId);
      const combatSceneId =
        adventure.sceneOrder.find((id) => adventure.scenes[id]?.kind === 'combat') ?? 'combat';
      
      const draft = {
        ...state,
        combat: { active: true, initiative: init, turnIndex: 0 },
        sceneId: combatSceneId,
        activeCharacterId: init[0].actorId,
      };
      const next = {
        ...draft,
        combat: { ...draft.combat, grid: buildTacticalGrid(draft) },
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
              dc: target.ac,
              advantage,
              disadvantage,
            },
          },
        };
      }

      const toHit = request.manualRoll !== undefined
        ? { formula: `1d20+${attackMod}`, rolls: [request.manualRoll], modifier: attackMod, total: request.manualRoll + attackMod, dc: target.ac }
        : rollFormula('1d20', attackMod, { advantage, disadvantage, bonusFormula });
      
      toHit.dc = target.ac;
      const critical = toHit.rolls[0] === 20 || (request.advantage && (toHit.rolls[0] === 20 || toHit.rolls[1] === 20));
      toHit.ok = toHit.total >= target.ac || critical;

      if (!toHit.ok) {
        return { state: appendLog(state, `${char.name} missed ${target.name}.`), result: { ok: false, summary: 'Attack missed.', breakdown: toHit } };
      }
      const damage = rollFormula(critical ? '2d8' : '1d8', 3);
      const monsters = state.monsters.map((m) => m.id === target.id ? { ...m, hp: Math.max(0, m.hp - damage.total) } : m);
      let next = { ...state, monsters };
      const allDown = monsters.every((m) => m.hp <= 0);
      if (allDown) next = advanceScene({ ...next, combat: { ...next.combat, active: false } });
      return {
        state: appendLog(next, `${char.name} hit ${target.name} for ${damage.total}.`),
        result: { ok: true, summary: `Hit ${target.name} for ${damage.total} damage.`, breakdown: damage, critical },
      };
    }
    case 'monster_turn': {
      const attacker = state.monsters.find((m) => m.hp > 0);
      if (!attacker) return { state, result: { ok: true, summary: 'No monsters remain.' } };
      
      // Target a random conscious player
      const consciousPlayers = state.party.filter(p => !p.unconscious);
      const target = consciousPlayers.length > 0 
        ? consciousPlayers[Math.floor(Math.random() * consciousPlayers.length)]
        : state.party[0];

      let advantage = false;
      let disadvantage = false;
      let bonusFormula = undefined;

      // Attacker conditions
      if (hasCondition(attacker, 'blinded')) disadvantage = true;
      if (hasCondition(attacker, 'poisoned')) disadvantage = true;
      if (hasCondition(attacker, 'prone')) disadvantage = true;
      if (hasCondition(attacker, 'restrained')) disadvantage = true;
      if (hasCondition(attacker, 'blessed')) bonusFormula = '1d4';

      // Target conditions
      if (hasCondition(target, 'blinded')) advantage = true;
      if (hasCondition(target, 'paralyzed') || hasCondition(target, 'stunned') || hasCondition(target, 'unconscious')) advantage = true;
      if (hasCondition(target, 'restrained')) advantage = true;

      const targetAc = hasCondition(target, 'shielded') ? target.ac + 5 : target.ac;

      const toHit = rollFormula('1d20', attacker.attackBonus, { advantage, disadvantage, bonusFormula });
      if (toHit.total < targetAc) {
        return { state: appendLog(state, `${attacker.name} missed ${target.name}.`), result: { ok: false, summary: `${attacker.name} missed.`, breakdown: toHit } };
      }
      const dmg = rollFormula('1d6', 1);
      const hp = Math.max(0, target.hp - dmg.total);
      const unconscious = hp === 0;
      
      const next = updateCharacterInParty(state, target.id, (c) => ({ ...c, hp, unconscious }));
      
      return { 
        state: appendLog(next, `${attacker.name} hit ${target.name} for ${dmg.total}.${unconscious ? ` ${target.name} has fallen unconscious!` : ''}`), 
        result: { ok: true, summary: `${attacker.name} hit ${target.name}.${unconscious ? ` ${target.name} is unconscious!` : ''}`, breakdown: dmg } 
      };
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

function appendLog(state: GameState, line: string): GameState {
  return { ...state, log: [...state.log, line] };
}

function d20() {
  return Math.floor(randomProvider() * 20) + 1;
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
