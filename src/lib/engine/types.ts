import type { NPC, CanonFact, Condition } from '../game/types';
import type { SpatialEngineRequest, SpatialEngineResult } from './spatial';
import type { TacticalEngineRequest, TacticalEngineResult } from './spatial/tactical';

export type Skill =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight_of_hand'
  | 'stealth' | 'survival';

export type EngineRequest =
  | { kind: 'skill_check'; characterId: string; skill: Skill; dc: number; reason: string; manualRoll?: number; advantage?: boolean; disadvantage?: boolean }
  | { kind: 'start_combat' }
  | { kind: 'player_attack'; characterId: string; targetId: string; manualRoll?: number; advantage?: boolean; disadvantage?: boolean; ranged?: boolean }
  | { kind: 'monster_turn' }
  | { kind: 'end_turn' }
  | { kind: 'death_save'; characterId: string; manualRoll?: number }
  | { kind: 'use_feature'; characterId: string; featureId: string }
  | { kind: 'cast_spell'; characterId: string; spellName: string; level: number; targetId?: string }
  | { kind: 'short_rest' }
  | { kind: 'long_rest' }
  | { kind: 'advance_scene' }
  | { kind: 'complete_objective'; objectiveId: string }
  | { kind: 'update_npc'; npcId: string; disposition?: NPC['disposition']; knowledge?: string }
  | { kind: 'add_canon_fact'; content: string; importance: CanonFact['importance'] }
  | { kind: 'update_inventory'; characterId: string; add?: string[]; remove?: string[]; goldDelta?: number }
  | { kind: 'apply_condition'; targetId: string; condition: Condition }
  | { kind: 'remove_condition'; targetId: string; condition: Condition }
  | SpatialEngineRequest
  | TacticalEngineRequest;

/** One resolved opportunity attack from a creature whose reach a mover left. */
export type OpportunityAttackOutcome = {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  hit: boolean;
  damage: number;
  breakdown?: RollBreakdown;
  /** Set when no attack was rolled (e.g. attacker lacks usable melee data). */
  warning?: string;
};

/** Cover applied to an attack for narration/debug visibility. */
export type CoverOutcome = {
  kind: 'none' | 'half' | 'three_quarters' | 'total';
  baseAc: number;
  bonus: number;
  effectiveAc: number;
};

export type RollBreakdown = {
  formula: string;
  rolls: number[];
  modifier: number;
  total: number;
  advantage?: boolean;
  disadvantage?: boolean;
  keptRoll?: number;
  dc?: number;
  ok?: boolean;
};

export type EngineResult = {
  ok: boolean;
  summary: string;
  breakdown?: RollBreakdown;
  critical?: boolean;
  needsManualRoll?: boolean;
  manualRollContext?: {
    kind: 'skill_check' | 'player_attack';
    formula: string;
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
  };
  spatial?: SpatialEngineResult;
  tactical?: TacticalEngineResult;
  /** Opportunity attacks resolved as a side effect of a move_creature request. */
  opportunityAttacks?: OpportunityAttackOutcome[];
  /** Cover that modified this attack's effective AC. */
  cover?: CoverOutcome;
};
