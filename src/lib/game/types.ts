import type { BattleMap, CreatureSize } from '@/lib/engine/spatial/tactical/types';

/** Built-in one-shots use social → exploration → combat → ending; modules use custom ids. */
export type SceneId = string;

export const BUILTIN_SCENE_IDS = ['social', 'exploration', 'combat', 'ending'] as const;
export type BuiltinSceneId = (typeof BUILTIN_SCENE_IDS)[number];

export type Condition = 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious' | 'blessed' | 'shielded' | 'guiding_bolt_target';

export type Character = {
  id: string;
  name: string;
  race: string;
  className: string;
  subclass?: string;
  level: number;
  ac: number;
  maxHp: number;
  hp: number;
  proficiencyBonus: number;
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>;
  skills: Partial<Record<string, number>>;
  features: { id: string; name: string; usesMax: number; usesRemaining: number; rechargeOn: 'short_rest' | 'long_rest' }[];
  spells?: { id: string; name: string; level: number; school?: string; description?: string }[];
  spellSlots: Record<number, { max: number; remaining: number }>;
  knownSpells?: string[];
  weapon: { name: string; attackBonus: number; damage: string };
  gold: number;
  inventory: string[];
  deathSaves: { success: number; failure: number };
  unconscious: boolean;
  conditions: Condition[];
};

export type MonsterAttackKind = 'melee' | 'ranged';

export type MonsterAttack = {
  id: string;
  name: string;
  kind: MonsterAttackKind;
  attackBonus: number;
  damage: string;
  damageType?: string;
  /** Melee reach in feet (defaults to 5 when omitted). */
  reachFt?: number;
  /** Normal range in feet — required for ranged attacks. */
  rangeFt?: number;
  /** Long range in feet (tracked; no disadvantage applied yet). */
  longRangeFt?: number;
};

export type Monster = {
  id: string;
  name: string;
  ac: number;
  maxHp: number;
  hp: number;
  /** Legacy single melee attack — still the fallback when `attacks` is absent. */
  attackBonus: number;
  damage: string;
  /** Optional richer attack list; melee/ranged with reach/range metadata. */
  attacks?: MonsterAttack[];
  /** Default melee reach in feet when using the legacy attack (defaults to 5). */
  reachFt?: number;
  /** Walking speed in feet (defaults to the tactical-layer 30 ft when omitted). */
  speedFt?: number;
  /** Tactical footprint size (defaults to medium / single cell). */
  size?: CreatureSize;
  conditions: Condition[];
};

export type NPC = {
  id: string;
  name: string;
  description: string;
  disposition: 'friendly' | 'neutral' | 'hostile';
  knowledge: string[];
  lastInteraction?: string;
};

export type CanonFact = {
  id: string;
  content: string;
  importance: 'low' | 'medium' | 'high';
};

export type CombatState = {
  active: boolean;
  initiative: { actorId: string; roll: number }[];
  turnIndex: number;
  /**
   * Tactical spatial state. Only present while combat is active. Replaces the
   * old `{width,height,positions}` grid; `migrateGameState` upgrades old saves.
   */
  battleMap?: BattleMap;
};

export type { ExplorationState } from '@/lib/engine/spatial/types';
export type { BattleMap } from '@/lib/engine/spatial/tactical/types';

export type DMPersonaId = 'balanced' | 'gritty' | 'epic' | 'whimsical';

export type DMPersona = {
  id: DMPersonaId;
  name: string;
  description: string;
  tone: string;
};

export type GameState = {
  sessionId: string;
  adventureId: string;
  /** @deprecated Use characterTemplateIds[0]. */
  characterTemplateId: string;
  characterTemplateIds: string[];
  backgroundId?: string;
  personaId: DMPersonaId;
  sceneId: SceneId;
  log: string[];
  canonLog: CanonFact[];
  /** @deprecated Use party[0] or activeCharacterId. */
  player: Character;
  party: Character[];
  activeCharacterId: string;
  monsters: Monster[];
  npcs: NPC[];
  combat: CombatState;
  exploration?: import('@/lib/engine/spatial/types').ExplorationState;
};

export type NewGameOptions = {
  adventureId?: string;
  /** @deprecated Use characterIds. */
  characterId?: string;
  characterIds?: string[];
  /** @deprecated Use playerNames. */
  playerName?: string;
  playerNames?: string[];
  playerLevel?: number;
  backgroundId?: string;
  personaId?: DMPersonaId;
};
