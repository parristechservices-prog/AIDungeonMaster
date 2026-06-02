import type { GameState } from '@/lib/game/types';
import type { RollBreakdown } from '@/lib/engine/types';

export type TurnResponse = {
  ok: boolean;
  sessionId: string;
  adventureId: string;
  adventureTitle: string;
  mode: 'ai_director' | 'table_rules';
  sceneId: GameState['sceneId'];
  sceneGoal: string;
  sceneStarter?: string;
  nextChoices: string[];
  nextHook: string;
  narration: string;
  ambient?: 'none' | 'tavern' | 'dungeon' | 'combat' | 'exploration' | 'boss_fight';
  needsManualRoll?: boolean;
  manualRollContext?: {
    kind: 'skill_check' | 'player_attack';
    formula: string;
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
  };
  narrationWarnings?: string[];
  engineResults: {
    kind: string;
    summary: string;
    ok: boolean;
    breakdown?: RollBreakdown;
    critical?: boolean;
  }[];
  recentRolls: RollBreakdown[];
  state: {
    player: {
      name: string;
      className: string;
      hp: number;
      maxHp: number;
      ac: number;
      unconscious: boolean;
      deathSaves: { success: number; failure: number };
      features: GameState['player']['features'];
      spellSlots: GameState['player']['spellSlots'];
      gold: number;
      inventory: string[];
      conditions: import('@/lib/game/types').Condition[];
    };
    monsters: { id: string; name: string; hp: number; maxHp: number; ac: number; conditions: import('@/lib/game/types').Condition[] }[];
    npcs: GameState['npcs'];
    canonLog: GameState['canonLog'];
    combat: GameState['combat'];
    log: string[];
  };
  recap: { turnNumber: number };
};
