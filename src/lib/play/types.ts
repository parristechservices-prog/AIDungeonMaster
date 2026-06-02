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
      hp: number;
      maxHp: number;
      ac: number;
      features: GameState['player']['features'];
      spellSlots: GameState['player']['spellSlots'];
      gold: number;
      inventory: string[];
    };
    monsters: { id: string; name: string; hp: number; maxHp: number; ac: number }[];
    npcs: GameState['npcs'];
    canonLog: GameState['canonLog'];
    combat: GameState['combat'];
    log: string[];
  };
  recap: { turnNumber: number };
};
