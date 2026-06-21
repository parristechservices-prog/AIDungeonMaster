import type { DmTurn } from '@/lib/llm/contracts';
import { getPlayableScene, getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import type { Adventure } from '@/lib/game/adventures/types';
import type { Character, GameState } from '@/lib/game/types';
import { findPath, getActorArea, pathDistance } from '@/lib/engine/spatial/area-graph';
import type { AreaId } from '@/lib/engine/spatial/types';

const EXPLORATION_PHRASES = ['inspect', 'track', 'search', 'scout', 'boathouse', 'quay', 'trail'];
const OBSERVATION_PHRASES = [
  'look',
  'look around',
  'listen',
  'observe',
  'scan',
  'study',
  'check the room',
  'check the windows',
  'describe the room',
  'who is here',
  'what is happening',
  'notice anything',
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

type DistanceTarget = {
  areaId: AreaId;
  target: string;
  note: string;
};

function getDistanceTarget(sceneId: string, input: string): DistanceTarget | null {
  const asksForDrawbridge = input.includes('drawbridge') || input.includes('bridge');
  const asksForGate = input.includes('gate') || input.includes('palisade');
  const asksForTower = input.includes('tower') || input.includes('watchtower');
  const asksForSquare = input.includes('square') || input.includes('village');
  const asksForBell = input.includes('bell') || input.includes('chapel') || input.includes('temple');
  const asksForKeep = input.includes('keep');
  const asksForInn = input.includes('inn');
  const asksForWindmill = input.includes('windmill');
  const asksForStable = input.includes('stable');
  const asksForTradingPost = input.includes('trading post') || input.includes('trading-post') || input.includes('post');

  if (asksForDrawbridge) {
    return { areaId: 'drawbridge', target: 'the drawbridge', note: 'The drawbridge spans the moat at the village entrance.' };
  }
  if (asksForGate) {
    return { areaId: 'drawbridge', target: 'the palisade gate', note: 'The gate sits by the drawbridge at the village entrance.' };
  }
  if (asksForSquare) {
    const areaId =
      sceneId === 'village-square' ||
      sceneId === 'temple-bell' ||
      sceneId === 'chapel-bell' ||
      sceneId === 'nightstone-inn' ||
      sceneId === 'trading-post-and-windmill' ||
      sceneId === 'nandar-keep'
        ? 'central_square'
        : 'south_square';
    return { areaId, target: 'the village square', note: 'The village square is the central landmark inside the palisade.' };
  }
  if (asksForBell || asksForTower) {
    return { areaId: 'bell_tower', target: 'the bell tower', note: 'The bell tower sits above the temple inside the village.' };
  }
  if (asksForKeep) {
    return { areaId: 'keep_gate', target: 'the keep gate', note: 'The keep gate is the guarded entrance to the damaged keep.' };
  }
  if (asksForInn) {
    return { areaId: 'nightstone_inn', target: 'the inn', note: 'The inn sits near the village edge and is easy to spot from the street.' };
  }
  if (asksForWindmill) {
    return { areaId: 'windmill', target: 'the windmill', note: 'The windmill overlooks the nearby village lanes.' };
  }
  if (asksForStable) {
    return { areaId: 'stable', target: 'the stable', note: 'The stable sits near the square and the inn.' };
  }
  if (asksForTradingPost) {
    return { areaId: 'trading_post', target: 'the trading post', note: 'The trading post is near the village square and main road.' };
  }
  return null;
}

function getSpatialDistanceHint(state: GameState, input: string): DistanceHint | null {
  if (!state.exploration) return null;
  const currentAreaId = getActorArea(state.exploration, state.activeCharacterId);
  if (!currentAreaId) return null;
  const target = getDistanceTarget(state.sceneId, input);
  if (!target) return null;
  const path = findPath(state.exploration, currentAreaId, target.areaId);
  if (!path) return null;
  const feet = pathDistance(state.exploration, path);
  return { ...target, feet, note: target.note };
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

function isGreeting(input: string): boolean {
  return /\b(hey|hello|hi|greet|greetings)\b/.test(input);
}

function isInventoryQuestion(input: string): boolean {
  return /\b(inventory|carrying|carry|equipment|items?)\b/.test(input);
}

function isHealthQuestion(input: string): boolean {
  return /\b(health|hp|hit points?|hurt|injured|wounded)\b/.test(input);
}

function isArmorClassQuestion(input: string): boolean {
  return /\b(armor class|armour class|ac)\b/.test(input);
}

function isHelpQuestion(input: string): boolean {
  return /\b(help|what can i do|options|suggestions?)\b/.test(input);
}

// Late-campaign Storm King's Thunder secrets a starting character should not
// simply "know". Asking about them must not leak the plot, and must not be
// mistaken for a search action.
const SKT_SECRET_TERMS = ['iymrith', 'hekaton', 'serissa', 'mirran', 'nym', 'neri', 'kraken society', 'kraken'];

function isLoreSecretQuestion(input: string): boolean {
  const interrogative = input.includes('?') || /\b(who|what|where|why|is|are|tell me|do you know|explain)\b/.test(input);
  return interrogative && SKT_SECRET_TERMS.some((term) => input.includes(term));
}

function isReadyWeaponIntent(input: string): boolean {
  return /\b(draw|ready|unsheathe|prepare)\b.*\b(sword|weapon|blade|bow|axe|staff)\b/.test(input);
}

function isRulesArgument(input: string): boolean {
  return /\b(dc|difficulty class|advantage|disadvantage|saving throw|save|rules?|wrong|demand|should be)\b/.test(input);
}

function isHomebrewRequest(input: string): boolean {
  return /\b(homebrew|wiki|godslayer|99d99|dragon wings|custom class|custom race|random internet)\b/.test(input);
}

function isAbusiveSpellIntent(input: string): boolean {
  return /\b(create water|water)\b.*\b(lungs?|throat|mouth|inside)\b/.test(input);
}

function isActionEconomyPileup(input: string): boolean {
  const actionWords = ['attack', 'cast', 'dash', 'disengage', 'drink', 'hide', 'help', 'dodge'];
  return actionWords.filter((word) => input.includes(word)).length >= 3 || /\b(three|3)\s+times\b/.test(input);
}

function isIntraPartyConflict(input: string): boolean {
  return /\b(hide|steal|keep|pocket|lie)\b.*\b(potion|loot|gold|treasure|party)\b/.test(input);
}

function isLorePumping(input: string): boolean {
  return /\b(full|entire|deep|unpublished|childhood|tax records?|family tree|backstory|history)\b/.test(input);
}

function isOpenCriminalPlanning(input: string): boolean {
  return /\b(loud|front of|in front of|announce|tell my party)\b.*\b(rob|steal|ambush|murder|kill|betray)\b/.test(input);
}

function sneakingRouteTarget(input: string): string {
  const wantsInn = input.includes('inn') || input.includes('area 8') || input.includes('building 8');
  const wantsGraveyard =
    input.includes('graveyard') ||
    input.includes('grave') ||
    input.includes('crypt') ||
    input.includes('area 6') ||
    input.includes('6a');
  const wantsTemple =
    input.includes('temple') ||
    input.includes('bell') ||
    input.includes('steeple') ||
    input.includes('belltower') ||
    input.includes('bell tower') ||
    input.includes('area 5');

  if (wantsInn && wantsGraveyard) return 'behind the temple, through the graveyard route, toward the inn';
  if (wantsInn) return 'east toward the inn';
  if (wantsGraveyard) return 'behind the temple into the graveyard and Nandar crypt area';
  if (wantsTemple) return 'toward the temple and its ringing steeple';
  return 'toward cover or the bell';
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

const GENERIC_DISTANCE_TARGET = 'the nearest clear landmark';

function explorationPositionHint(state: GameState, input: string, activeChar: Character): string {
  // Prefer the scene-aware authored distance (it tracks where the party
  // narratively is). Fall back to the area-graph route distance only when the
  // scene table has no specific landmark answer, so uncovered landmarks still
  // get a deterministic engine-backed number instead of vague prose.
  const sceneHint = getDistanceHint(state.sceneId, input);
  const distance =
    sceneHint.target === GENERIC_DISTANCE_TARGET ? getSpatialDistanceHint(state, input) ?? sceneHint : sceneHint;
  const distanceText = distance.feet === 0 ? `You are already at ${distance.target}.` : `You are about ${distance.feet} feet from ${distance.target}.`;
  const movementText = distance.feet > 0 ? ` ${movementCostText(activeChar, distance.feet)}` : '';
  return `${distanceText}${movementText} ${distance.note}`.trim();
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

function socialLookDescription(sceneStarter: string | undefined, npcName: string): string {
  return `${sceneStarter ?? `You take in the room while ${npcName} watches from nearby.`} The common room is warm with lantern light while rain traces the windows. ${npcName} keeps one eye on the patrons, and a few damp cloaks and guarded glances suggest someone here may know more about recent travelers. You can speak with ${npcName}, study a patron more closely, or ask about the missing courier.`;
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

  if (/\b(moon|machine gun|nuclear|infinite gold|gravity|final boss|every monster dead|skip (?:to|the)|invent the king|king'?s crown|final boss password|solve the puzzle|fly away|fireball|seduce the (?:locked )?door)\b/.test(input)) {
    return {
      engineRequests: [],
      narration: 'That is not possible in the current scene. Choose an action grounded in the people, places, equipment, and exits already established.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (input.startsWith('[appeal]') || input.includes('appeal the dm')) {
    return {
      engineRequests: [],
      narration:
        'The table pauses. In table-rules mode, describe what felt wrong — a failed roll, a contradiction, or a ruling you want reconsidered — and try the action again. With an AI director, appeals can retcon canon via the engine.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (isRulesArgument(input)) {
    return {
      engineRequests: [],
      narration:
        'Rules check: the engine owns DCs, advantage, saving throws, HP, and action limits. You can appeal a ruling or describe a new tactic that might earn advantage, but you cannot lower a DC by declaring it.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (isHomebrewRequest(input)) {
    return {
      engineRequests: [],
      narration:
        'That homebrew is not part of this adventure yet. You can use equipment already on your sheet, import a balanced module, or ask the DM to review a custom item between scenes.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (isAbusiveSpellIntent(input)) {
    return {
      engineRequests: [],
      narration:
        'No. Spells do only what the rules and table consent allow here; you cannot create water inside a creature to bypass combat, consent, or saving throws. Choose a grounded spell, social approach, or another action.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (isActionEconomyPileup(input)) {
    return {
      engineRequests: [],
      narration:
        'That tries to take too many actions at once. Pick one main action for this turn, then add movement or a legal bonus action only if your sheet supports it.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (isIntraPartyConflict(input)) {
    return {
      engineRequests: [],
      narration:
        'You can play selfishly, but the table needs clarity. Say whether this is a secret, who might notice, and what item or loot changes hands; the engine will only change inventory after a specific grounded action.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (isLorePumping(input)) {
    return {
      engineRequests: [],
      narration:
        'You can ask for rumours or visible details, but that deep history has not been established as relevant canon. Pick a specific person, clue, or question and the DM will answer only what this scene can plausibly reveal.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  if (isOpenCriminalPlanning(input)) {
    return {
      engineRequests: [{ kind: 'update_npc', npcId: mock.socialNpcId, disposition: 'hostile', knowledge: 'The party openly discussed robbing someone in front of her.' }],
      narration:
        `${mock.socialNpcName} hears you plainly. Her expression hardens, and the room goes quiet; if you keep pushing this, there will be consequences.`,
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
  if (isInventoryQuestion(input)) {
    return {
      engineRequests: [],
      narration: `${activeChar.name} is carrying ${activeChar.inventory.join(', ') || 'no notable items'} and ${activeChar.gold} gold.`,
      needsResultBeforeNarrating: false,
      ambient,
    };
  }
  if (isHealthQuestion(input)) {
    return {
      engineRequests: [],
      narration: `${activeChar.name} has ${activeChar.hp} of ${activeChar.maxHp} hit points${activeChar.unconscious ? ' and is unconscious' : ''}.`,
      needsResultBeforeNarrating: false,
      ambient,
    };
  }
  if (isArmorClassQuestion(input)) {
    return {
      engineRequests: [],
      narration: `${activeChar.name}'s Armor Class is ${activeChar.ac}.`,
      needsResultBeforeNarrating: false,
      ambient,
    };
  }
  if (isHelpQuestion(input)) {
    const choices = getPlayableScene(adventure, state.sceneId)?.choices ?? [];
    return {
      engineRequests: [],
      narration: `You can look around, talk to someone nearby, inspect something specific, move to a visible place, use an item or feature, or try one of these approaches: ${choices.join('; ')}.`,
      needsResultBeforeNarrating: false,
      ambient,
    };
  }

  // Answer lore questions about deep campaign secrets honestly without leaking
  // the plot or rolling a search. The engine owns what the character knows.
  if (isLoreSecretQuestion(input)) {
    return {
      engineRequests: [],
      narration:
        'That goes beyond what your character currently knows. Names and secrets like that would have to be uncovered through play — what you actually know here comes from the people, places, and clues in front of you.',
      needsResultBeforeNarrating: false,
      ambient,
    };
  }
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
    if (
      isPassiveObservation(input) ||
      input.includes('inspect the room') ||
      input.includes('inspect the inn') ||
      input.includes('inspect the patrons') ||
      input.includes('look for clues')
    ) {
      const scene = getPlayableScene(adventure, state.sceneId);
      return {
        engineRequests: [],
        narration: socialLookDescription(scene?.starter, mock.socialNpcName),
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (/\bdescribe (the )?(scene|room|inn)\b/.test(input)) {
      const scene = getPlayableScene(adventure, state.sceneId);
      return {
        engineRequests: [],
        narration: socialLookDescription(scene?.starter, mock.socialNpcName),
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (EXPLORATION_PHRASES.some((p) => input.includes(p))) {
      return {
        engineRequests: [],
        narration: `You do not find tracks or hidden evidence from the common room at a glance. ${mock.socialNpcName} and the patrons are the clearest leads; ask a question or inspect something specific.`,
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    const isAsking =
      input.includes('ask') ||
      input.includes('question') ||
      input.includes('talk') ||
      input.includes('speak') ||
      input.includes('tell') ||
      input.includes('where') ||
      input.includes('bribe') ||
      input.includes('offer coin') ||
      input.includes('persuade') ||
      input.includes('learn') ||
      input.includes('examine') ||
      input.includes('bless') ||
      input.includes('watch');

    if (isAsking) {
      const seeksCourierLead =
        input.includes('courier') ||
        input.includes('information') ||
        input.includes('ask') ||
        input.includes('question') ||
        input.includes('where') ||
        input.includes('learn') ||
        input.includes('tell') ||
        input.includes('know') ||
        input.includes('help') ||
        input.includes('persuade') ||
        input.includes('bribe') ||
        input.includes('offer coin');
      if (!seeksCourierLead) {
        return {
          engineRequests: [],
          narration: `${mock.socialNpcName} turns toward you. "What would you like to know?" You can ask about the missing courier, recent travelers, or anything unusual at the inn.`,
          needsResultBeforeNarrating: false,
          ambient,
        };
      }
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

    if (isGreeting(input)) {
      return {
        engineRequests: [],
        narration: `${mock.socialNpcName} looks up. "Well? State your business."`,
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (isReadyWeaponIntent(input)) {
      return {
        engineRequests: [],
        narration: `${activeChar.name} puts a hand on ${activeChar.weapon.name} and stays alert. The room notices the gesture, but no fight has begun.`,
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (/\b(attack|hit|punch|stab|strike|kill)\b/.test(input)) {
      return {
        engineRequests: [],
        narration: `Starting violence in the crowded inn would have serious consequences, and there is no active combat target. Name a specific grounded intent, or talk, investigate, or leave instead.`,
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    if (isMovementOnly(input) || /\b(outside|leave|upstairs|bar|door|road|approach)\b/.test(input)) {
      const approachesMira = input.includes('mira') || input.includes('bar');
      const leavesCurrentSocialScene =
        /\b(outside|leave|door|road|exit|walk out|go out|head out|north|south|east|west|away|farmland|opposite direction)\b/.test(input) &&
        !approachesMira;
      return {
        engineRequests: leavesCurrentSocialScene ? [{ kind: 'advance_scene' }] : [],
        narration: approachesMira
          ? `You move closer to the bar. ${mock.socialNpcName} watches your approach and waits for your question.`
          : `You leave the inn and step into the weather outside. The lead with ${mock.socialNpcName} remains available if you come back, but the road and nearby places are yours to explore.`,
        needsResultBeforeNarrating: false,
        ambient,
      };
    }

    return {
      engineRequests: [],
      narration: `I can work with that, but I need a little more detail. Are you trying to look for clues, talk to someone, move somewhere, or use an item?`,
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
        narration: explorationPositionHint(state, input, activeChar),
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
      narration: explorationPositionHint(state, input, activeChar),
      needsResultBeforeNarrating: false,
      ambient: 'combat',
    };
  }

  const living = state.monsters.filter((m) => m.hp > 0);
  const livingNames = living.map((m) => m.name).join(' and ');

  if (isStealthIntent(input)) {
    const routeTarget = sneakingRouteTarget(input);
    return {
      engineRequests:
        living.length > 0
          ? [
              {
                kind: 'skill_check',
                characterId: activeChar.id,
                skill: 'stealth',
                dc: 13,
                reason: `Slip ${routeTarget} without drawing the ${livingNames}'s full attention.`,
              },
            ]
          : [{ kind: 'advance_scene' }],
      narration:
        living.length > 0
          ? `You slow down, use the fallen stones and broken buildings as cover, and try to slip ${routeTarget} rather than charge through the square.`
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
          ? `${explorationPositionHint(state, input, activeChar)} The ${livingNames} are still an active threat in the square, so walking openly toward the bell risks drawing them after you. You can sneak, Disengage toward cover, Dash, attack, or try a distraction.`
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

export function mockNarrationAfterResult(state: GameState, kind: string, ok: boolean, summary = ''): string | null {
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
    const loweredSummary = summary.toLowerCase();
    if (loweredSummary.includes('graveyard') || loweredSummary.includes('crypt')) {
      return ok
        ? 'You make the route work, slipping behind the temple into the graveyard path near the Nandar crypt without giving the worgs a clean opening.'
        : 'The graveyard route is there, but your movement is not quiet enough; the worgs keep pressure on you before you can use it safely.';
    }
    if (loweredSummary.includes('inn')) {
      return ok
        ? 'You make the route work, keeping low behind the temple and graveyard line as you angle east toward the damaged inn.'
        : 'You spot the line toward the inn, but the worgs track your movement before you can slip across cleanly.';
    }
    if (loweredSummary.includes('temple') || loweredSummary.includes('bell') || loweredSummary.includes('steeple')) {
      return ok
        ? 'You make the route work, reaching the temple side of the square near the ringing steeple without giving the worgs a clean opening.'
        : 'You can see the temple route, but the worgs keep you pinned before you can reach the bell safely.';
    }
    return ok
      ? 'You make the tactical move work, gaining a better position without giving the enemy a clean opening.'
      : 'The attempt does not come off cleanly; the enemy keeps you pressured and you need to choose your next move fast.';
  }
  return null;
}
