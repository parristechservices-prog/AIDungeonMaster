import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { resetRandomProvider, setRandomProvider } from '@/lib/engine';

const normalPrompts = [
  'look around', 'i look around', 'what do i see', 'describe the room', 'where am i',
  'who is here', 'what is happening', 'do i notice anything unusual',
  'talk to mira', 'i talk to mira', 'ask mira about the courier',
  'i ask mira where the courier went', 'ask about the missing courier',
  'offer coin for information', 'persuade mira to help',
  'study the patrons', 'i study the inn patrons', 'look for clues', 'search for clues',
  'inspect the room', 'check the windows', 'listen for rumours', 'look for tracks',
  'go outside', 'leave the inn', 'walk to the door', 'head toward the road',
  'go upstairs', 'go to the bar', 'approach mira',
  'what am i carrying', 'open inventory', 'show inventory', 'what is my health',
  'how hurt am i', 'what is my armor class', 'what can i do', 'help',
  'draw my sword', 'ready my weapon', 'i attack', 'i attack mira', 'i punch a patron',
];

const sillyPrompts = [
  'i stab the moon', 'i seduce the locked door', 'i pull out a machine gun',
  'i skip to the treasure', 'i ask the goblin for the final boss password', 'i fly away', 'i become god',
  'i ask the goblin for the password', 'i kill everyone instantly', 'i burn down the whole town',
  'i loot the dragon hoard',
];

const curiousAndChaoticPrompts = [
  'can i buy food', 'who owns this inn', 'are there any guards here', 'do i recognise anyone',
  'is anyone suspicious', 'can i check the guestbook', 'can i rest here', 'i threaten mira',
  'i apologise', 'i throw a mug', 'i hide under a table', 'i sneak out the back',
  'i follow a suspicious patron', 'i shout for everyone to be quiet',
  'i offer 5 gold for information', 'i accuse mira of lying',
];

const stateAndMetaPrompts = [
  'what is this place?', 'what courier?', 'can i tell if she is hiding something?',
  'what is my goal', 'how do i play', 'what are my options', 'what does table rules mean',
  'are you using ai', 'why did that fail', 'appeal', 'that makes no sense', 'undo that',
  'what features do i have', 'drink healing potion', 'what can i do in combat',
  'what enemies are alive', 'who is hurt',
  'try again', 'same again', 'again', 'do that', 'i do it', 'continue', 'go on', 'ok', 'yes', 'no',
];

describe('basic first-minute player prompts', () => {
  const state = createInitialState('basic-player-prompts', {
    adventureId: 'brindlehook-inn',
    characterId: 'fighter',
    playerName: 'Seren Ashfall',
  });

  it.each(normalPrompts)('handles normal prompt: %s', (input) => {
    const turn = deriveDmTurnFromInput(state, input);
    expect(turn.narration).toBeTruthy();
    expect(turn.narration).not.toMatch(/not quite sure how to resolve|try naming who acts|invalid_character_id|i can work with that/i);
    for (const request of turn.engineRequests) {
      if ('characterId' in request) expect(request.characterId).toBe(state.activeCharacterId);
    }
    expect(turn.engineRequests).not.toContainEqual({ kind: 'advance_scene' });
  });

  it.each(sillyPrompts)('safely grounds impossible prompt: %s', (input) => {
    const turn = deriveDmTurnFromInput(state, input);
    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration).toMatch(/not possible|grounded/i);
    expect(turn.narration).not.toMatch(/name who acts/i);
  });

  it.each(curiousAndChaoticPrompts)('handles curious or chaotic social prompt: %s', (input) => {
    const turn = deriveDmTurnFromInput(state, input);
    expect(turn.narration).toBeTruthy();
    expect(turn.narration).not.toMatch(/i can work with that|not quite sure|name who acts/i);
    for (const request of turn.engineRequests) {
      if ('characterId' in request) expect(request.characterId).toBe(state.activeCharacterId);
    }
  });

  it.each(stateAndMetaPrompts)('handles state or meta prompt: %s', (input) => {
    const turn = deriveDmTurnFromInput(state, input);
    expect(turn.narration).toBeTruthy();
    expect(turn.narration).not.toMatch(/i can work with that|not quite sure|name who acts/i);
    for (const request of turn.engineRequests) {
      if ('characterId' in request) expect(request.characterId).toBe(state.activeCharacterId);
    }
  });

  it('does not expose future enemies in the social scene response', () => {
    const result = runTurn(state, deriveDmTurnFromInput(state, 'look around'), {
      mode: 'table_rules',
      aiUsed: false,
      fallbackUsed: true,
    });
    expect(result.response.ok).toBe(true);
    expect(result.response.state.monsters).toEqual([]);
    expect(result.response.sceneId).toBe('social');
  });

  it('uses social narration after a successful social check advances the scene', () => {
    setRandomProvider(() => 0.99);
    try {
      const result = runTurn(state, deriveDmTurnFromInput(state, 'ask Mira about the courier'), {
        mode: 'table_rules',
        aiUsed: false,
        fallbackUsed: true,
      });
      expect(result.response.sceneId).toBe('exploration');
      expect(result.response.narration).toMatch(/Mira|boathouse|cloaked/i);
      expect(result.response.narration).not.toMatch(/fresh tracks|dragged/i);
    } finally {
      resetRandomProvider();
    }
  });
});
