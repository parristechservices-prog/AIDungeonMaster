import { z } from 'zod';

const sceneKindSchema = z.enum(['social', 'exploration', 'combat']);

const sceneSchema = z.object({
  kind: sceneKindSchema,
  goal: z.string().min(1).max(500),
  starter: z.string().min(1).max(2000),
  choices: z.array(z.string()).max(20),
  guidance: z.string().max(3000),
});

const npcSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  disposition: z.enum(['friendly', 'neutral', 'hostile']),
  knowledge: z.array(z.string()).max(20),
});

const monsterSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  ac: z.number().int().min(1).max(30),
  maxHp: z.number().int().min(1).max(999),
  hp: z.number().int().min(0).max(999).optional(),
  attackBonus: z.number().int().min(-5).max(20),
  damage: z.string().max(32),
});

const chapterSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  sceneIds: z.array(z.string().min(1)).min(1).max(100),
});

const sceneEncounterSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard', 'deadly']).optional(),
  templates: z.array(z.string()).max(12).optional(),
  auto: z.boolean().optional(),
  preferredTemplates: z.array(z.string()).max(8).optional(),
});

const playConfigSchema = z.object({
  defaultLevel: z.number().int().min(1).max(20).default(3),
  partySize: z.number().int().min(1).max(6).default(1),
  defaultDifficulty: z.enum(['easy', 'medium', 'hard', 'deadly']).default('medium'),
  spawnMonstersOnCombatOnly: z.boolean().default(true),
  preferredMonsterTemplates: z.array(z.string()).default(['goblin', 'orc', 'hobgoblin']),
});

const mockSchema = z.object({
  socialNpcId: z.string(),
  socialNpcName: z.string(),
  socialSuccess: z.string().max(2000),
  socialFailure: z.string().max(2000),
  explorationSuccess: z.string().max(2000),
  explorationFailure: z.string().max(2000),
  socialSkill: z.enum(['persuasion', 'insight', 'deception', 'intimidation']),
  explorationSkill: z.enum(['perception', 'investigation', 'survival', 'stealth']),
  socialDc: z.number().int().min(1).max(30),
  explorationDc: z.number().int().min(1).max(30),
  canonFactOnSocialSuccess: z.string().max(500),
});

export const adventureModuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(120),
    tagline: z.string().max(300),
    estimatedMinutes: z.number().int().min(5).max(5000),
    tone: z.string().max(80),
    recommendedCharacters: z.array(z.string()).min(1).max(8),
    levelRange: z.tuple([z.number().int().min(1).max(20), z.number().int().min(1).max(20)]).optional(),
    sourceNote: z.string().max(500).optional(),
    campaignGuide: z.string().max(8000).optional(),
    playConfig: playConfigSchema.optional(),
    sceneEncounters: z.record(z.string(), sceneEncounterSchema).optional(),
    chapters: z.array(chapterSchema).max(30).optional(),
    sceneOrder: z.array(z.string().min(1)).min(2).max(200),
    scenes: z.record(z.string(), sceneSchema),
    endingMessage: z.string().max(3000),
    npcs: z.array(npcSchema).max(80),
    monsters: z.array(monsterSchema).min(1).max(60),
    mock: mockSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.sceneOrder.includes('ending')) {
      ctx.addIssue({
        code: 'custom',
        message: 'sceneOrder must include "ending" as the final scene id',
        path: ['sceneOrder'],
      });
    }
    const last = data.sceneOrder[data.sceneOrder.length - 1];
    if (last !== 'ending') {
      ctx.addIssue({
        code: 'custom',
        message: 'Last entry in sceneOrder must be "ending"',
        path: ['sceneOrder'],
      });
    }
    for (const sceneId of data.sceneOrder) {
      if (sceneId === 'ending') continue;
      if (!data.scenes[sceneId]) {
        ctx.addIssue({
          code: 'custom',
          message: `Missing scene definition for "${sceneId}"`,
          path: ['scenes'],
        });
      }
    }
    for (const sceneId of Object.keys(data.scenes)) {
      if (!data.sceneOrder.includes(sceneId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Scene "${sceneId}" is not listed in sceneOrder`,
          path: ['scenes'],
        });
      }
    }
    if (data.chapters) {
      for (const ch of data.chapters) {
        for (const sceneId of ch.sceneIds) {
          if (sceneId !== 'ending' && !data.scenes[sceneId]) {
            ctx.addIssue({
              code: 'custom',
              message: `Chapter "${ch.id}" references unknown scene "${sceneId}"`,
              path: ['chapters'],
            });
          }
        }
      }
    }
  });

export type AdventureModuleFile = z.infer<typeof adventureModuleSchema>;
