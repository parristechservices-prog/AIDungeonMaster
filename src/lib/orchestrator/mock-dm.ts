import type { DmTurn } from '@/lib/llm/contracts';
import { getPlayableScene, getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import type { Adventure } from '@/lib/game/adventures/types';
import type { Character, GameState } from '@/lib/game/types';

const EXPLORATION_PHRASES = ['inspect', 'track', 'search', 'scout', 'boathouse', 'quay', 'trail'];
const OBSERVATION_PHRASES = [
  'look',
  'look around',
  'listen',
  'observe',
  'survey',
  'take in',
  'what do i see',
  'what can i see',
  'where am i',
];
const DISTANCE_PHRASES = [
  'how far',
  'distance',
  'feet',
  'ft',
  'yards',
  'paces',
  'how many',
];
const SELF_DESCRIPTION_PHRASES = [
  'what do i look like',
  'how do i look',
  'describe me',
  'describe myself',
  'what am i wearing',
  'what am i carrying',
];
const MOVEMENT_PHRASES = [
  'move',
  'walk',
  'go ',
  'head',
  'approach',
  'closer',
  'cross',
  'enter',
];
const ACTIVE_SEARCH_PHRASES = ['inspect', 'track', 'search', 'scout', 'examine', 'investigate', 'trail'];
const STEALTH_PHRASES = ['sneak', 'hide', 'stealth', 'quietly', 'silent', 'creep'];
const RETREAT_PHRASES = ['retreat', 'withdraw', 'back away', 'fall back', 'disengage', 'flee', 'run away'];
const COVER_PHRASES = ['cover', 'duck behind', 'take shelter', 'circle', 'flank', 'left', 'right'];

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

function includesAny(input: string, phrases: string[]): boolean {
  return phrases.some((phrase) => input.includes(phrase));
}

function isPassiveObservation(input: string): boolean {
  return includesAny(input, OBSERVATION_PHRASES) && !includesAny(input, ACTIVE_SEARCH_PHRASES);
}

function isSelfDescriptionQuestion(input: string): boolean {
  return SELF_DESCRIPTION_PHRASES.some((phrase) => input.includes(phrase));
}

function isDistanceQuestion(input: string): boolean {
  return (
    includesAny(input, DISTANCE_PHRASES.filter((phrase) => phrase !== 'ft')) ||
    /\bft\.?\b/.test(input)
  );
}

function isMovementOnly(input: string): boolean {
  return includesAny(input, MOVEMENT_PHRASES) && !includesAny(input, ACTIVE_SEARCH_PHRASES);
}

function isStealthIntent(input: string): boolean {
  return includesAny(input, STEALTH_PHRASES);
}

function isRetreatIntent(input: string): boolean {
  return includesAny(input, RETREAT_PHRASES);
}

function isCoverIntent(input: string): boolean {
  return includesAny(input, COVER_PHRASES);
}

type DistanceHint = {
  target: string;
  feet: number;
  note: string;
};

function movementSpeedFeet(character: Character): number {
  const race = character.race.toLowerCase();
  if (race.includes('dwarf') || race.includes('halfling') || race.includes('gnome')) return 25;
  return 30;
}

function movementCostText(character: Character, feet: number): string {
  const speed = movementSpeedFeet(character);
  const moves = Math.max(1, Math.ceil(feet / speed));
  const owner = `${character.name}'s ${speed}-foot speed`;

  if (moves === 1) {
    return `With ${owner}, that is within one normal move.`;
  }
  if (moves === 2) {
    return `With ${owner}, that takes two normal moves, or one turn if you Dash.`;
  }
  return `With ${owner}, that takes about ${moves} normal moves; in combat you would need multiple turns unless you Dash.`;
}

function describeActiveCharacter(activeChar: Character): string {
  const armor = activeChar.inventory.find((item) => /chain shirt|leather|studded|plate|scale|mail/i.test(item)) ?? 'your armor';
  const weapon = activeChar.weapon?.name ?? 'your weapon';
  return `You are ${activeChar.name}, a level ${activeChar.level} ${activeChar.race} ${activeChar.className} wearing ${armor} and carrying ${weapon}.`;
}

function getDistanceHint(sceneId: string, input: string): DistanceHint {
  const asksForDrawbridge = input.includes('drawbridge') || input.includes('bridge');
  const asksForGate = input.includes('gate') || input.includes('palisade');
  const asksForTower = input.includes('tower') || input.includes('watchtower');
  const asksForSquare = input.includes('square') || input.includes('village');
  const asksForBell = input.includes('bell') || input.includes('chapel') || input.includes('temple');
  const asksForKeep = input.includes('keep');

  switch (sceneId) {
    case 'settlement-arrival':
    case 'road-to-nightstone':
      if (asksForKeep) return { target: 'the damaged keep', feet: 300, note: 'It is visible beyond the village and separated by the moat and broken bridge.' };
      if (asksForBell) return { target: 'the ringing bell', feet: 180, note: 'The sound is coming from deeper inside the village, past the open gate.' };
      if (asksForSquare) return { target: 'the village square', feet: 120, note: 'You would need to cross the drawbridge and pass through the open gate first.' };
      if (asksForGate || asksForTower) return { target: asksForTower ? 'the nearest watchtower' : 'the open palisade gate', feet: 60, note: 'The drawbridge lies between you and the gate opening.' };
      return { target: asksForDrawbridge ? 'the lowered drawbridge' : 'the lowered drawbridge ahead', feet: 30, note: 'You are still on the road outside the moat.' };
    case 'drawbridge-watchtowers':
    case 'open-palisade':
      if (asksForKeep) return { target: 'the damaged keep', feet: 250, note: 'It lies off to the south beyond the village route.' };
      if (asksForBell) return { target: 'the ringing bell', feet: 120, note: 'The bell is deeper inside Nightstone.' };
      if (asksForSquare) return { target: 'the village square', feet: 60, note: 'The square is just inside the palisade.' };
      if (asksForDrawbridge) return { target: 'the drawbridge behind you', feet: 15, note: 'You are at the gate threshold now.' };
      return { target: asksForTower ? 'the nearest watchtower' : 'the open gate', feet: 15, note: 'You are already at the bridge and gate area.' };
    case 'village-square':
      if (asksForBell) return { target: 'the ringing bell', feet: 60, note: 'The sound points toward the chapel area.' };
      if (asksForKeep) return { target: 'the damaged keep', feet: 180, note: 'It is south of the village and harder to reach because the bridge is damaged.' };
      if (asksForSquare) return { target: 'the center of the square', feet: 0, note: 'You are already in the village square.' };
      return { target: asksForDrawbridge || asksForGate ? 'the drawbridge and gate behind you' : 'the drawbridge and gate behind you', feet: 100, note: 'The exact route through the street can shift that by about 20 feet.' };
    case 'temple-bell':
    case 'chapel-bell':
      if (asksForBell || asksForTower) return { target: 'the bell tower', feet: 20, note: 'You are already at the chapel area.' };
      if (asksForSquare) return { target: 'the village square', feet: 60, note: 'It is back through the nearby streets.' };
      return { target: asksForDrawbridge || asksForGate ? 'the drawbridge and gate' : 'the drawbridge and gate', feet: 140, note: 'You would go back through the square and empty streets.' };
    case 'nightstone-inn':
      if (asksForSquare) return { target: 'the village square', feet: 40, note: 'It is nearby through the damaged street.' };
      if (asksForBell) return { target: 'the chapel bell', feet: 90, note: 'The bell carries clearly from across the village.' };
      return { target: asksForDrawbridge || asksForGate ? 'the drawbridge and gate' : 'the drawbridge and gate', feet: 120, note: 'The route leads back past the square.' };
    case 'trading-post-and-windmill':
      if (asksForSquare) return { target: 'the village square', feet: 60, note: 'The square remains the central landmark.' };
      if (asksForBell) return { target: 'the chapel bell', feet: 100, note: 'The ringing is still easy to track by sound.' };
      return { target: asksForDrawbridge || asksForGate ? 'the drawbridge and gate' : 'the drawbridge and gate', feet: 130, note: 'You can retrace the main village path.' };
    case 'nandar-keep':
      return { target: asksForDrawbridge || asksForGate ? 'the drawbridge and village gate' : 'the village gate', feet: 220, note: 'The moat and damaged bridge make the route awkward.' };
    case 'trail-to-caves':
    case 'cave-leads':
      return { target: asksForDrawbridge || asksForGate || asksForSquare ? 'Nightstone behind you' : 'the cave trail ahead', feet: 300, note: 'You are now outside the village on the trail.' };
    default:
      return { target: 'the nearest clear landmark', feet: 30, note: 'This is an approximate table distance.' };
  }
}

function explorationPositionHint(sceneId: string, input: string, activeChar: Character): string {
  const distance = getDistanceHint(sceneId, input);
  const distanceText =
    distance.feet === 0
      ? `You are already at ${distance.target}.`
      : `You are about ${distance.feet} feet from ${distance.target}.`;
  return `${distanceText} ${movementCostText(activeChar, Math.max(distance.feet, 1))} ${distance.note}`;
}

function explorationLocationSummary(sceneId: string): string {
  switch (sceneId) {
    case 'settlement-arrival':
    case 'road-to-nightstone':
      return 'You are on the road just outside Nightstone. The lowered drawbridge is ahead across the moat, with the open palisade gate and empty watchtowers beyond it.';
    case 'drawbridge-watchtowers':
    case 'open-palisade':
      return 'You are at the bridge and gate threshold. The road is behind you, the village streets are ahead, and the square lies only a short way inside the palisade.';
    case 'village-square':
      return 'You are inside the palisade near the village square. The drawbridge and gate are behind you, roughly 80 to 120 feet away depending on the exact path through the street.';
    case 'temple-bell':
    case 'chapel-bell':
      return 'You are near the chapel and its ringing bell, still within the village walls. The square is nearby, and the gate is back through the empty streets.';
    case 'nightstone-inn':
      return 'You are by the inn on the village edge. The square and chapel are nearby, while the gate sits back through the damaged streets.';
    case 'trading-post-and-windmill':
      return 'You are among the village outbuildings. The windmill, trading post, square, and chapel give you clear landmarks despite the damage.';
    case 'nandar-keep':
      return 'You are looking toward the damaged keep south of the village, separated by the moat and a broken bridge.';
    case 'trail-to-caves':
    case 'cave-leads':
      return 'You are following the tracks away from Nightstone toward the foothills. The village is behind you, and the cave trail is ahead.';
    default:
      return 'You pause long enough to orient yourself by the nearest landmarks. Nothing about your position calls for a roll; decide where you want to go next.';
  }
}

function explorationLookDescription(sceneId: string, sceneStarter?: string): string {
  switch (sceneId) {
    case 'settlement-arrival':
    case 'road-to-nightstone':
      return 'Nightstone is silent except for the bell. The drawbridge is lowered over the moat, the palisade gate stands open, and no guards answer from the watchtowers. Farther south, the keep looks damaged.';
    case 'drawbridge-watchtowers':
    case 'open-palisade':
      return 'The bridge and gate look abandoned rather than defended. Mud, damage, and the unanswered bell make the village feel recently emptied, not peacefully quiet.';
    case 'village-square':
      return 'The square is scarred by fallen stones and damaged buildings. A bare patch marks where the great central stone once stood, and the bell keeps pulling your attention toward the chapel.';
    case 'temple-bell':
    case 'chapel-bell':
      return 'The bell rings from the chapel area, but no orderly watch or village leader appears. The sound feels like a clue in an abandoned settlement, not a normal alarm.';
    case 'nightstone-inn':
      return 'The inn is quiet and unsettled. You can look around freely, but a careful room-by-room search would take time and may call for a check.';
    case 'trading-post-and-windmill':
      return 'The outbuildings show signs of hasty abandonment and looting. Supplies are disturbed, but nothing nearby behaves like a waiting guard post.';
    case 'nandar-keep':
      return 'The keep has been badly damaged, and the bridge connection is unsafe. The destruction here matches the sense that something huge struck Nightstone from above.';
    case 'trail-to-caves':
    case 'cave-leads':
      return 'The trail away from the village is churned with signs of panic and pursuit. A closer tracking effort can tell you more, but the direction of travel is clear.';
    default:
      return sceneStarter ?? 'You take in the area without committing to a detailed search. Ask a specific question, move to a landmark, or inspect a clue if you want to dig deeper.';
  }
}

function shouldAdvanceByMovement(sceneId: string, input: string): boolean {
  if (!isMovementOnly(input) || isDistanceQuestion(input)) return false;
  if (sceneId === 'settlement-arrival') {
    return input.includes('drawbridge') || input.includes('bridge') || input.includes('gate') || input.includes('enter') || input.includes('cross');
  }
  if (sceneId === 'road-to-nightstone') {
    return (
      input.includes('drawbridge') ||
      input.includes('bridge') ||
      input.includes('gate') ||
      input.includes('palisade') ||
      input.includes('enter') ||
      input.includes('cross') ||
      input.includes('village')
    );
  }
  if (sceneId === 'drawbridge-watchtowers' || sceneId === 'open-palisade') {
    return input.includes('village') || input.includes('square') || input.includes('enter') || input.includes('inside') || input.includes('cross');
  }
  return false;
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

    if (isSelfDescriptionQuestion(input)) {
      return {
        engineRequests: [],
        narration: describeActiveCharacter(activeChar),
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (isDistanceQuestion(input)) {
      return {
        engineRequests: [],
        narration: explorationPositionHint(state.sceneId, input, activeChar),
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (isPassiveObservation(input)) {
      return {
        engineRequests: [],
        narration: explorationLookDescription(state.sceneId, scene?.starter),
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (shouldAdvanceByMovement(state.sceneId, input)) {
      return {
        engineRequests: [{ kind: 'advance_scene' }],
        narration:
          'You move carefully, using the obvious route and watching the empty village for movement. No roll is needed just to cross open ground.',
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (isMovementOnly(input)) {
      return {
        engineRequests: [],
        narration: `${explorationLocationSummary(state.sceneId)} You can move there; tell me the destination if you want to commit, or inspect a specific clue if you want a roll.`,
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

  if (isSelfDescriptionQuestion(input)) {
    return {
      engineRequests: [],
      narration: describeActiveCharacter(activeChar),
      needsResultBeforeNarrating: false,
      ambient: 'combat',
    };
  }

  if (isDistanceQuestion(input)) {
    return {
      engineRequests: [],
      narration: explorationPositionHint(state.sceneId, input, activeChar),
      needsResultBeforeNarrating: false,
      ambient: 'combat',
    };
  }

  const living = state.monsters.filter((m) => m.hp > 0);
  const livingNames = living.map((m) => m.name).join(' and ');

  if (isStealthIntent(input)) {
    return {
      engineRequests:
        living.length > 0
          ? [
              {
                kind: 'skill_check',
                characterId: activeChar.id,
                skill: 'stealth',
                dc: 13,
                reason: `Slip toward cover or the bell without drawing the ${livingNames}'s full attention.`,
              },
            ]
          : [{ kind: 'advance_scene' }],
      narration:
        living.length > 0
          ? `You slow down, use the fallen stones and broken buildings as cover, and try to slip around the ${livingNames} rather than charge through the square.`
          : 'With no active enemy blocking you, you move quietly toward the next landmark.',
      needsResultBeforeNarrating: true,
      ambient: 'combat',
    };
  }

  if (isRetreatIntent(input)) {
    return {
      engineRequests: [],
      narration:
        living.length > 0
          ? `You can fall back toward the gate or another piece of cover. If you fully retreat, use your action to Disengage; if you run, the ${livingNames} may be able to chase or snap at you.`
          : 'With the immediate threat down, you can fall back safely or move to the next clue.',
      needsResultBeforeNarrating: false,
      ambient: 'combat',
    };
  }

  if (isCoverIntent(input)) {
    return {
      engineRequests:
        living.length > 0
          ? [
              {
                kind: 'skill_check',
                characterId: activeChar.id,
                skill: 'stealth',
                dc: 12,
                reason: `Use rubble and damaged buildings to reposition away from the ${livingNames}.`,
              },
            ]
          : [],
      narration:
        living.length > 0
          ? `You angle for cover instead of standing in the open square, keeping the ${livingNames} in sight while you reposition.`
          : 'You find cover among the broken stones and damaged buildings.',
      needsResultBeforeNarrating: living.length > 0,
      ambient: 'combat',
    };
  }

  if (isMovementOnly(input)) {
    const towardBell = input.includes('bell') || input.includes('chapel') || input.includes('temple');
    return {
      engineRequests: [],
      narration:
        living.length > 0 && towardBell
          ? `${explorationPositionHint(state.sceneId, input, activeChar)} The ${livingNames} are still an active threat in the square, so walking openly toward the bell risks drawing them after you. You can sneak, Disengage toward cover, Dash, attack, or try a distraction.`
          : living.length > 0
            ? `You can move, but the ${livingNames} are close enough to matter. Name the route and pace: sneak, circle to cover, Disengage, Dash, or stand and fight.`
            : 'You move through the square now that nothing is actively blocking you.',
      needsResultBeforeNarrating: false,
      ambient: 'combat',
    };
  }

  if (isPassiveObservation(input)) {
    const enemyText =
      living.length > 0
        ? `Visible enemies: ${living.map((m) => m.name).join(', ')}.`
        : 'No active enemies are visible.';
    const scene = getPlayableScene(adventure, state.sceneId);
    return {
      engineRequests: [],
      narration: `${scene?.starter ?? 'Combat is underway.'} ${enemyText} Decide whether to fight, retreat, take cover, or try a risky interaction.`,
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
    narration:
      living.length > 0
        ? `${living.map((m) => m.name).join(' and ')} threaten the area. Choose an action: attack, retreat, take cover, or try something risky.`
        : 'The immediate threat is down. Choose your next action.',
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
  if (sceneKind === 'combat' && kind === 'skill_check') {
    return ok
      ? 'You make the tactical move work, gaining a better position without giving the enemy a clean opening.'
      : 'The attempt does not come off cleanly; the enemy keeps you pressured and you need to choose your next move fast.';
  }
  return null;
}
