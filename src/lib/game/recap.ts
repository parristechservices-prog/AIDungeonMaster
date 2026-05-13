import type { GameState } from './types';

export type PartyQuestRecap = {
  sessionId: string;
  turnNumber: number;
  timestamp: string;
  partyName: string;
  characters: Array<{
    id: string;
    name: string;
    role: string;
    hp: number;
    maxHp: number;
    status: string[];
  }>;
  sceneId: string;
  narration: string;
  outcome: string;
  consequences: string[];
  keyEvents: string[];
  openThreads: string[];
  nextChoices: string[];
  nextHook: string;
  mode: 'ai_director' | 'table_rules';
  aiUsed: boolean;
  fallbackUsed: boolean;
};

export function buildRecap(input: {
  state: GameState;
  turnNumber: number;
  narration: string;
  outcome: string;
  consequences?: string[];
  keyEvents?: string[];
  nextChoices?: string[];
  nextHook?: string;
  mode: 'ai_director' | 'table_rules';
  aiUsed: boolean;
  fallbackUsed: boolean;
}): PartyQuestRecap {
  return {
    sessionId: input.state.sessionId,
    turnNumber: input.turnNumber,
    timestamp: new Date().toISOString(),
    partyName: `${input.state.player.name}'s party`,
    characters: [
      {
        id: input.state.player.id,
        name: input.state.player.name,
        role: input.state.player.className,
        hp: input.state.player.hp,
        maxHp: input.state.player.maxHp,
        status: input.state.player.hp <= 0 ? ['down'] : [],
      },
    ],
    sceneId: input.state.sceneId,
    narration: input.narration,
    outcome: input.outcome,
    consequences: input.consequences ?? [],
    keyEvents: input.keyEvents ?? input.state.log.slice(-3),
    openThreads: input.state.sceneId === 'ending' ? [] : ['Unresolved danger ahead'],
    nextChoices: input.nextChoices ?? [],
    nextHook: input.nextHook ?? 'What do you do next?',
    mode: input.mode,
    aiUsed: input.aiUsed,
    fallbackUsed: input.fallbackUsed,
  };
}

