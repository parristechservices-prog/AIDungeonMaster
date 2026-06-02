import type { DmTurn } from '@/lib/llm/contracts';
import { getScenario } from '@/lib/game/scenarios';
import type { GameState } from '@/lib/game/types';

export function deriveDmTurnFromInput(state: GameState, playerInput: string): DmTurn {
  const input = playerInput.toLowerCase();
  const scenario = getScenario(state.adventureId);
  const mock = scenario.mock;

  if (input.includes('perception') || input.includes('skill') || input.includes('stat') || input.includes('ability')) {
    const skillName = (
      ['perception', 'stealth', 'athletics', 'persuasion', 'insight', 'investigation', 'religion', 'deception'] as const
    ).find((s) => input.includes(s));

    const info = skillName
      ? `Your ${skillName} skill bonus is +${state.player.skills[skillName] ?? 0}.`
      : `You have ${state.player.hp}/${state.player.maxHp} HP and AC ${state.player.ac}.`;

    return {
      engineRequests: [],
      narration: `You take a moment to reflect on your capabilities. ${info}`,
      needsResultBeforeNarrating: false,
    };
  }

  const feature = state.player.features.find(
    (f) => input.includes(f.id.replace(/_/g, ' ')) || input.includes(f.name.toLowerCase()),
  );
  if (feature) {
    return {
      engineRequests: [{ kind: 'use_feature', featureId: feature.id }],
      narration: `You invoke ${feature.name}.`,
      needsResultBeforeNarrating: true,
    };
  }

  if (state.sceneId === 'social') {
    const isAsking =
      input.includes('ask') ||
      input.includes('question') ||
      input.includes('tell') ||
      input.includes('where') ||
      input.includes('bribe') ||
      input.includes('learn') ||
      input.includes('examine') ||
      input.includes('bless') ||
      input.includes('watch');

    if (isAsking) {
      return {
        engineRequests: [
          {
            kind: 'skill_check',
            skill: mock.socialSkill,
            dc: mock.socialDc,
            reason: `Convince ${mock.socialNpcName} to share what they know.`,
          },
          { kind: 'update_npc', npcId: mock.socialNpcId, disposition: 'friendly' },
          {
            kind: 'add_canon_fact',
            content: mock.canonFactOnSocialSuccess,
            importance: 'medium',
          },
        ],
        narration: `${mock.socialNpcName} studies you before answering.`,
        needsResultBeforeNarrating: true,
      };
    }

    if (input.includes('hey') || input.includes('hello') || input.includes('hi') || input.includes('greet')) {
      return {
        engineRequests: [],
        narration: `${mock.socialNpcName} looks up. "Well? State your business."`,
        needsResultBeforeNarrating: false,
      };
    }

    return {
      engineRequests: [],
      narration: `${mock.socialNpcName} waits for you to speak or act.`,
      needsResultBeforeNarrating: false,
    };
  }

  if (state.sceneId === 'exploration') {
    return {
      engineRequests: [
        {
          kind: 'skill_check',
          skill: mock.explorationSkill,
          dc: mock.explorationDc,
          reason: 'Search the area for a lead.',
        },
      ],
      narration: 'You work the scene for anything out of place.',
      needsResultBeforeNarrating: true,
    };
  }

  if (state.sceneId !== 'combat') {
    return {
      engineRequests: [{ kind: 'start_combat' }],
      narration: scenario.scenes.combat.starter,
      needsResultBeforeNarrating: false,
    };
  }

  if (input.includes('attack') || input.includes('strike') || input.includes('hit')) {
    const living = state.monsters.find((m) => m.hp > 0);
    return {
      engineRequests: living ? [{ kind: 'player_attack', targetId: living.id }, { kind: 'monster_turn' }] : [],
      narration: 'You lunge forward.',
      needsResultBeforeNarrating: true,
    };
  }

  return {
    engineRequests: [],
    narration: 'The moment hangs — what do you do?',
    needsResultBeforeNarrating: false,
  };
}

export function mockNarrationAfterResult(state: GameState, kind: string, ok: boolean): string | null {
  const mock = getScenario(state.adventureId).mock;
  if (state.sceneId === 'social' && kind === 'skill_check') {
    return ok ? mock.socialSuccess : mock.socialFailure;
  }
  if (state.sceneId === 'exploration' && kind === 'skill_check') {
    return ok ? mock.explorationSuccess : mock.explorationFailure;
  }
  return null;
}
