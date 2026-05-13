import type { NPC, CanonFact } from '../game/types';

export type Skill =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight_of_hand'
  | 'stealth' | 'survival';

export type EngineRequest =
  | { kind: 'skill_check'; skill: Skill; dc: number; reason: string }
  | { kind: 'start_combat' }
  | { kind: 'player_attack'; targetId: string }
  | { kind: 'monster_turn' }
  | { kind: 'use_feature'; featureId: string }
  | { kind: 'cast_spell'; spellName: string; level: number; targetId?: string }
  | { kind: 'short_rest' }
  | { kind: 'long_rest' }
  | { kind: 'update_npc'; npcId: string; disposition?: NPC['disposition']; knowledge?: string }
  | { kind: 'add_canon_fact'; content: string; importance: CanonFact['importance'] }
  | { kind: 'update_inventory'; add?: string[]; remove?: string[]; goldDelta?: number };

export type RollBreakdown = {
  formula: string;
  rolls: number[];
  modifier: number;
  total: number;
};

export type EngineResult = {
  ok: boolean;
  summary: string;
  breakdown?: RollBreakdown;
  critical?: boolean;
};
