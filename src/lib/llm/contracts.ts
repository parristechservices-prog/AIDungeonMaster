import { z } from 'zod';

const skillSchema = z.enum([
  'acrobatics', 'animal_handling', 'arcana', 'athletics',
  'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleight_of_hand',
  'stealth', 'survival',
]);

const conditionSchema = z.enum(['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'blessed', 'shielded', 'guiding_bolt_target']);

const engineRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skill_check'), characterId: z.string().optional(), skill: skillSchema, dc: z.number().int().min(1).max(30), reason: z.string(), advantage: z.boolean().optional(), disadvantage: z.boolean().optional() }),
  z.object({ kind: z.literal('start_combat') }),
  z.object({ kind: z.literal('player_attack'), characterId: z.string().optional(), targetId: z.string(), advantage: z.boolean().optional(), disadvantage: z.boolean().optional() }),
  z.object({ kind: z.literal('monster_turn') }),
  z.object({ kind: z.literal('death_save'), characterId: z.string().optional() }),
  z.object({ kind: z.literal('use_feature'), characterId: z.string().optional(), featureId: z.string() }),
  z.object({ kind: z.literal('cast_spell'), characterId: z.string().optional(), spellName: z.string(), level: z.number().int().min(0).max(9), targetId: z.string().optional() }),
  z.object({ kind: z.literal('short_rest') }),
  z.object({ kind: z.literal('long_rest') }),
  z.object({ kind: z.literal('advance_scene') }),
  z.object({ kind: z.literal('update_npc'), npcId: z.string(), disposition: z.enum(['friendly', 'neutral', 'hostile']).optional(), knowledge: z.string().optional() }),
  z.object({ kind: z.literal('add_canon_fact'), content: z.string(), importance: z.enum(['low', 'medium', 'high']) }),
  z.object({ kind: z.literal('update_inventory'), characterId: z.string().optional(), add: z.array(z.string()).optional(), remove: z.array(z.string()).optional(), goldDelta: z.number().optional() }),
  z.object({ kind: z.literal('apply_condition'), targetId: z.string(), condition: conditionSchema }),
  z.object({ kind: z.literal('remove_condition'), targetId: z.string(), condition: conditionSchema }),
]);

export const dmTurnSchema = z.object({
  engineRequests: z.array(engineRequestSchema).max(5),
  narration: z.string().min(1).max(2000),
  needsResultBeforeNarrating: z.boolean(),
  ambient: z.enum(['none', 'tavern', 'dungeon', 'combat', 'exploration', 'boss_fight']).optional(),
});

export type DmTurn = z.infer<typeof dmTurnSchema>;
