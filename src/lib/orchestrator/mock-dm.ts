import type { DmTurn } from '@/lib/llm/contracts';
import { getPlayableScene, getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import type { Adventure } from '@/lib/game/adventures/types';
import type { GameState } from '@/lib/game/types';

const EXPLORATION_PHRASES = ['inspect', 'track', 'search', 'scout', 'boathouse', 'quay', 'trail'];

const SOCIAL_RETRY_HINT =
  ' Try offering coin, using a different approach, or asking again with Insight or Persuasion.';

const EXPLORATION_RETRY_HINT =
  ' Search again, try Investigation instead, or look for another clue.';

function mockAmbientForKind(kind: ReturnType<typeof getSceneKind>): DmTurn['ambient'] {
  switch (kind) {
    case 'social':
      return 'tavern';
    case 'exploration':
      return 'exploration';
    case 'combat':
      return 'combat';
    default:
      return 'none';
  }
}

function getCombatStarter(adventure: Adventure): string {
  const combatSceneId = adventure.sceneOrder.find((id) => adventure.scenes[id]?.kind === 'combat');
  if (combatSceneId) return adventure.scenes[combatSceneId].starter;
  return 'Combat begins.';
}

export function deriveDmTurnFromInput(state: GameState, playerInput: string): DmTurn {
  const input = playerInput.toLowerCase();
  const adventure = getAdventure(state.adventureId);
  const mock = adventure.mock;
  const sceneKind = getSceneKind(adventure, state.sceneId);
  const ambient = mockAmbientForKind(sceneKind);

  if (input.startsWith('[appeal]') || input.includes('appeal the dm')) {
    return {
      engineRequests: [],
      narration:
        'The table pauses. In table-rules mode, describe what felt wrong — a failed roll, a contradiction, or a ruling you want reconsidered — and try the action again. With an AI director, appeals can retcon canon via the engine.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (input.includes('perception') || input.includes('skill') || input.includes('stat') || input.includes('ability')) {
    const skillName = (
      ['perception', 'stealth', 'athletics', 'persuasion', 'insight', 'investigation', 'religion', 'deception'] as const
    ).find((s) => input.includes(s));

    const activeChar = state.party.find(p => p.id === state.activeCharacterId) || state.party[0];
    const info = skillName
      ? `Your ${skillName} skill bonus is +${activeChar.skills[skillName] ?? 0}.`
      : `You have ${activeChar.hp}/${activeChar.maxHp} HP and AC ${activeChar.ac}.`;

    return {
      engineRequests: [],
      narration: `You take a moment to reflect on your capabilities. ${info}`,
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  const activeChar = state.party.find(p => p.id === state.activeCharacterId) || state.party[0];
  const feature = activeChar.features.find(
    (f) => input.includes(f.id.replace(/_/g, ' ')) || input.includes(f.name.toLowerCase()),
  );
  if (feature) {
    return {
      engineRequests: [{ kind: 'use_feature', characterId: activeChar.id, featureId: feature.id }],
      narration: `You invoke ${feature.name}.`,
      needsResultBeforeNarrating: true,
      ambient,
    };
  }

  if (sceneKind === 'social') {
    if (EXPLORATION_PHRASES.some((p) => input.includes(p))) {
      return {
        engineRequests: [],
        narration: `${mock.socialNpcName} is still here. Finish gathering leads in this scene before moving on.`,
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

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
            characterId: activeChar.id,
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
        ambient,
      };
    }

    if (input.includes('hey') || input.includes('hello') || input.includes('hi') || input.includes('greet')) {
      return {
        engineRequests: [],
        narration: `${mock.socialNpcName} looks up. "Well? State your business."`,
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    return {
      engineRequests: [],
      narration: `${mock.socialNpcName} waits for you to speak or act.`,
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (sceneKind === 'exploration') {
    const scene = getPlayableScene(adventure, state.sceneId);
    const abandonedScene =
      scene?.guidance.toLowerCase().includes('no leader') ||
      scene?.guidance.toLowerCase().includes('no village leader') ||
      scene?.guidance.toLowerCase().includes('no guards') ||
      scene?.guidance.toLowerCase().includes('abandoned');

    if (
      abandonedScene &&
      (input.includes('greet') ||
        input.includes('hello') ||
        input.includes('hi') ||
        input.includes('call out') ||
        input.includes('speak to') ||
        input.includes('talk to'))
    ) {
      return {
        engineRequests: [],
        narration:
          'No one answers. The bell keeps ringing over the empty street, and the silence makes the damaged village feel even more exposed.',
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    return {
      engineRequests: [
        {
          kind: 'skill_check',
          characterId: activeChar.id,
          skill: mock.explorationSkill,
          dc: mock.explorationDc,
          reason: 'Search the area for a lead.',
        },
      ],
      narration: 'You work the scene for anything out of place.',
      needsResultBeforeNarrating: true,
      ambient,
    };
  }

  if (sceneKind !== 'combat' && sceneKind !== 'ending') {
    return {
      engineRequests: [{ kind: 'start_combat' }],
      narration: getCombatStarter(adventure),
      needsResultBeforeNarrating: false,
      ambient: 'combat',
    };
  }

  if (input.includes('attack') || input.includes('strike') || input.includes('hit')) {
    const living = state.monsters.find((m) => m.hp > 0);
    return {
      engineRequests: living ? [{ kind: 'player_attack', characterId: activeChar.id, targetId: living.id }, { kind: 'monster_turn' }] : [],
      narration: 'You lunge forward.',
      needsResultBeforeNarrating: true,
      ambient: 'combat',
    };
  }

  return {
    engineRequests: [],
    narration: 'The moment hangs — what do you do?',
    needsResultBeforeNarrating: false,
    ambient: 'combat',
  };
}

export function mockNarrationAfterResult(state: GameState, kind: string, ok: boolean): string | null {
  const adventure = getAdventure(state.adventureId);
  const mock = adventure.mock;
  const sceneKind = getSceneKind(adventure, state.sceneId);

  if (sceneKind === 'social' && kind === 'skill_check') {
    return ok ? mock.socialSuccess : `${mock.socialFailure}${SOCIAL_RETRY_HINT}`;
  }
  if (sceneKind === 'exploration' && kind === 'skill_check') {
    return ok ? mock.explorationSuccess : `${mock.explorationFailure}${EXPLORATION_RETRY_HINT}`;
  }
  return null;
}
