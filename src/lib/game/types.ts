/** Built-in one-shots use social → exploration → combat → ending; modules use custom ids. */
export type SceneId = string;

export const BUILTIN_SCENE_IDS = ['social', 'exploration', 'combat', 'ending'] as const;
export type BuiltinSceneId = (typeof BUILTIN_SCENE_IDS)[number];

export type Character = {
  id: string;
  name: string;
  level: number;
  className: string;
  ac: number;
  maxHp: number;
  hp: number;
  proficiencyBonus: number;
  abilities: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>;
  skills: Partial<Record<string, number>>;
  features: { id: string; name: string; usesMax: number; usesRemaining: number; rechargeOn: 'short_rest' | 'long_rest' }[];
  spellSlots: Record<number, { max: number; remaining: number }>;
  weapon: { name: string; attackBonus: number; damage: string };
  gold: number;
  inventory: string[];
  deathSaves: { success: number; failure: number };
  unconscious: boolean;
};

export type Monster = {
  id: string;
  name: string;
  ac: number;
  maxHp: number;
  hp: number;
  attackBonus: number;
  damage: string;
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
};

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
  characterTemplateId: string;
  backgroundId?: string;
  personaId: DMPersonaId;
  sceneId: SceneId;
  log: string[];
  canonLog: CanonFact[];
  player: Character;
  monsters: Monster[];
  npcs: NPC[];
  combat: CombatState;
};

export type NewGameOptions = {
  adventureId?: string;
  characterId?: string;
  playerName?: string;
  backgroundId?: string;
  personaId?: DMPersonaId;
};
