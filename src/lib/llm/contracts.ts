import { z } from 'zod';

const skillSchema = z.enum([
  'acrobatics', 'animal_handling', 'arcana', 'athletics',
  'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleight_of_hand',
  'stealth', 'survival',
]);

const conditionSchema = z.enum(['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'blessed', 'shielded', 'guiding_bolt_target']);

// NOTE: variants intentionally omit `.strict()`. LLMs frequently tack on stray
// keys (e.g. an extra `reason` or `target`); stripping them is far better than
// discarding the entire turn and falling back to table-rules narration.
const gridCoordSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().optional(),
});

const engineRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skill_check'), characterId: z.string(), skill: skillSchema, dc: z.number().int().min(1).max(30), reason: z.string(), advantage: z.boolean().optional(), disadvantage: z.boolean().optional() }),
  z.object({ kind: z.literal('start_combat') }),
  z.object({ kind: z.literal('player_attack'), characterId: z.string(), targetId: z.string(), advantage: z.boolean().optional(), disadvantage: z.boolean().optional(), ranged: z.boolean().optional() }),
  z.object({ kind: z.literal('monster_turn') }),
  z.object({ kind: z.literal('death_save'), characterId: z.string() }),
  z.object({ kind: z.literal('use_feature'), characterId: z.string(), featureId: z.string() }),
  z.object({ kind: z.literal('cast_spell'), characterId: z.string(), spellName: z.string(), level: z.number().int().min(0).max(9), targetId: z.string().optional() }),
  z.object({ kind: z.literal('short_rest') }),
  z.object({ kind: z.literal('long_rest') }),
  z.object({ kind: z.literal('advance_scene') }),
  z.object({ kind: z.literal('update_npc'), npcId: z.string(), disposition: z.enum(['friendly', 'neutral', 'hostile']).optional(), knowledge: z.string().optional() }),
  z.object({ kind: z.literal('add_canon_fact'), content: z.string(), importance: z.enum(['low', 'medium', 'high']) }),
  z.object({ kind: z.literal('update_inventory'), characterId: z.string(), add: z.array(z.string()).optional(), remove: z.array(z.string()).optional(), goldDelta: z.number().optional() }),
  z.object({ kind: z.literal('apply_condition'), targetId: z.string(), condition: conditionSchema }),
  z.object({ kind: z.literal('remove_condition'), targetId: z.string(), condition: conditionSchema }),
  z.object({ kind: z.literal('move_area'), actorId: z.string(), targetAreaId: z.string() }),
  z.object({ kind: z.literal('query_current_area'), actorId: z.string() }),
  z.object({ kind: z.literal('query_exits'), actorId: z.string() }),
  z.object({ kind: z.literal('query_actors_present'), actorId: z.string() }),
  z.object({ kind: z.literal('query_path_exists'), fromAreaId: z.string(), toAreaId: z.string() }),
  // Tactical combat spatial requests (only meaningful while combat is active).
  z.object({ kind: z.literal('move_creature'), actorId: z.string(), target: gridCoordSchema }),
  z.object({ kind: z.literal('dash'), actorId: z.string() }),
  z.object({ kind: z.literal('disengage'), actorId: z.string() }),
  z.object({ kind: z.literal('query_reachable'), actorId: z.string() }),
  z.object({ kind: z.literal('query_targets_in_range'), actorId: z.string(), rangeFt: z.number().int().min(0).max(1000) }),
  z.object({ kind: z.literal('check_line_of_sight'), actorId: z.string(), targetId: z.string(), rangeFt: z.number().int().min(0).max(1000).optional() }),
]);

export type EngineRequestInput = z.infer<typeof engineRequestSchema>;

const AMBIENT_VALUES = ['none', 'tavern', 'dungeon', 'combat', 'exploration', 'boss_fight'] as const;

/**
 * Normalizes a single raw engine request from the LLM before validation.
 * Models routinely emit `type` instead of `kind` and omit `reason` on skill
 * checks; we repair those rather than reject the request outright.
 */
function normalizeEngineRequest(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const obj = { ...(value as Record<string, unknown>) };
  if (obj.kind === undefined && typeof obj.type === 'string') obj.kind = obj.type;
  delete obj.type;
  if (obj.kind === 'skill_check' && typeof obj.reason !== 'string') obj.reason = 'Skill check';
  return obj;
}

const normalizedEngineRequest = z.preprocess(normalizeEngineRequest, engineRequestSchema);

export const dmTurnSchema = z.object({
  // Parse each request leniently and keep only the valid ones (max 5). A single
  // malformed request no longer discards the whole AI turn.
  engineRequests: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((arr) => {
      const out: EngineRequestInput[] = [];
      for (const item of arr) {
        const parsed = normalizedEngineRequest.safeParse(item);
        if (parsed.success) out.push(parsed.data);
        if (out.length >= 5) break;
      }
      return out;
    }),
  narration: z.string().min(1).max(2000),
  needsResultBeforeNarrating: z.boolean().optional().default(false),
  // Coerce invalid/free-text ambient values (e.g. "cozy inn") to undefined
  // instead of failing the turn.
  ambient: z.preprocess(
    (v) => (typeof v === 'string' && (AMBIENT_VALUES as readonly string[]).includes(v) ? v : undefined),
    z.enum(AMBIENT_VALUES).optional(),
  ),
}).strip().transform((turn) => ({
  // There is nothing to wait for if no engine request was issued. Models often
  // set this flag while refusing an impossible action and providing no request;
  // coercing it to false here keeps that valid refusal instead of having the
  // downstream validator discard the whole turn and fall back to table rules.
  ...turn,
  needsResultBeforeNarrating: turn.engineRequests.length > 0 ? turn.needsResultBeforeNarrating : false,
}));

export type DmTurn = z.infer<typeof dmTurnSchema>;
