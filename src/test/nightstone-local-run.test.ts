import { expect, it } from 'vitest';
import { resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';

it('plays through the authored Nightstone chapter using Table Rules', () => {
  let state = createInitialState('nightstone-chapter-qa', { adventureId: 'skt-nightstone-chapter1' });
  const hero = { ...state.player, hp: 200, maxHp: 200 };
  state = { ...state, player: hero, party: [hero] };
  const seen = new Set([state.sceneId]);
  setRandomProvider(() => 0.99);
  try {
    for (let i = 0; i < 60 && state.sceneId !== 'ending'; i++) {
      const action = ({
        'road-to-nightstone': 'I cross the drawbridge.',
        'open-palisade': 'I enter the village square.',
        'chapel-bell': 'I inspect the area for clues.',
        'trail-to-caves': 'I search for tracks.',
        'tower-of-zephyros': 'I ask the NPC what they know.',
      } as Record<string, string>)[state.sceneId] ?? 'I attack.';
      state = runTurn(state, deriveDmTurnFromInput(state, action), {
        mode: 'table_rules', aiUsed: false, fallbackUsed: true,
      }).state;
      seen.add(state.sceneId);
    }
    expect([...seen]).toEqual([
      'road-to-nightstone', 'open-palisade', 'village-square', 'chapel-bell',
      'goblin-scouts', 'trail-to-caves', 'dripping-caves', 'tower-of-zephyros', 'ending',
    ]);
  } finally {
    resetRandomProvider();
  }
});
