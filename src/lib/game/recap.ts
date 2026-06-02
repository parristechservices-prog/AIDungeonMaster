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
  itemsFound: string[];
  npcsMet: string[];
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
    partyName: `${input.state.party?.[0]?.name ?? 'Party'}'s party`,
    characters: input.state.party.map(p => ({
      id: p.id,
      name: p.name,
      role: p.className,
      hp: p.hp,
      maxHp: p.maxHp,
      status: p.hp <= 0 ? ['down'] : [],
    })),
    sceneId: input.state.sceneId,
    narration: input.narration,
    outcome: input.outcome,
    consequences: input.consequences ?? [],
    keyEvents: input.keyEvents ?? input.state.canonLog.slice(-3).map(f => f.content),
    openThreads: input.state.sceneId === 'ending' ? [] : ['Unresolved danger ahead'],
    itemsFound: input.state.party.flatMap(p => p.inventory.slice(-1)),
    npcsMet: input.state.npcs.filter(n => n.disposition !== 'hostile').map(n => n.name),
    nextChoices: input.nextChoices ?? [],
    nextHook: input.nextHook ?? 'What do you do next?',
    mode: input.mode,
    aiUsed: input.aiUsed,
    fallbackUsed: input.fallbackUsed,
  };
}

