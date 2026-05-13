import type { DmTurn } from '@/lib/llm/contracts';
import type { GameState } from '@/lib/game/types';

export function deriveDmTurnFromInput(state: GameState, playerInput: string): DmTurn {
  const input = playerInput.toLowerCase();

  // Meta-questions about stats or skills
  if (input.includes('perception') || input.includes('skill') || input.includes('stat') || input.includes('ability')) {
    const skillName = (['perception', 'stealth', 'athletics', 'persuasion', 'insight', 'investigation'] as const)
      .find(s => input.includes(s));
    
    let info = '';
    if (skillName) {
      const bonus = state.player.skills[skillName] ?? 0;
      info = `Your ${skillName} skill bonus is +${bonus}.`;
    } else {
      info = `You have ${state.player.hp}/${state.player.maxHp} HP and an AC of ${state.player.ac}.`;
    }

    return {
      engineRequests: [],
      narration: `You take a moment to reflect on your capabilities. ${info}`,
      needsResultBeforeNarrating: false,
    };
  }

  // Social Scene logic
  if (state.sceneId === 'social') {
    const isAsking = input.includes('ask') || input.includes('question') || input.includes('tell') || input.includes('where') || input.includes('established') || input.includes('remember');
    
    if (isAsking) {
      return {
        engineRequests: [
          { kind: 'skill_check', skill: 'persuasion', dc: 12, reason: 'Convince Mira to share what she knows.' },
          { kind: 'update_npc', npcId: 'npc-mira', disposition: 'friendly' },
          { kind: 'add_canon_fact', content: 'The courier was seen heading to the boathouse with two cloaked figures.', importance: 'medium' }
        ],
        narration: 'Mira narrows her eyes, weighing your tone before speaking.',
        needsResultBeforeNarrating: true,
      };
    }

    if (input.includes('hey') || input.includes('hello') || input.includes('hi')) {
      return {
        engineRequests: [],
        narration: 'Mira looks up from the glass she\'s cleaning. "Well met, stranger. What can I do for you on a night like this?"',
        needsResultBeforeNarrating: false,
      };
    }

    return {
      engineRequests: [],
      narration: 'The inn is quiet, save for the rain. Mira waits for you to approach or speak.',
      needsResultBeforeNarrating: false,
    };
  }

  // Exploration Scene logic
  if (state.sceneId === 'exploration') {
    return {
      engineRequests: [{ kind: 'skill_check', skill: 'perception', dc: 12, reason: 'Track signs near the boathouse.' }],
      narration: 'You sweep the shoreline for clues while the tide pulls back.',
      needsResultBeforeNarrating: true,
    };
  }

  if (input.includes('second wind')) {
    return {
      engineRequests: [{ kind: 'use_feature', featureId: 'second_wind' }],
      narration: 'You draw a deep breath and steady your stance.',
      needsResultBeforeNarrating: true,
    };
  }

  if (state.sceneId !== 'combat') {
    return {
      engineRequests: [{ kind: 'start_combat' }],
      narration: 'Steel flashes in the rain as two ruffians close in.',
      needsResultBeforeNarrating: false,
    };
  }

  if (input.includes('attack') || input.includes('strike') || input.includes('hit')) {
    const living = state.monsters.find((m) => m.hp > 0);
    return {
      engineRequests: living ? [{ kind: 'player_attack', targetId: living.id }, { kind: 'monster_turn' }] : [],
      narration: 'You lunge forward with your blade.',
      needsResultBeforeNarrating: true,
    };
  }

  if (input.includes('hey') || input.includes('hello') || input.includes('hi')) {
    return {
      engineRequests: [],
      narration: 'Mira looks up from the glass she\'s cleaning. "Well met, stranger. What can I do for you on a night like this?"',
      needsResultBeforeNarrating: false,
    };
  }

  return {
    engineRequests: [],
    narration: 'The rain drums against the windows. Mira waits for you to speak or act.',
    needsResultBeforeNarrating: false,
  };
}
