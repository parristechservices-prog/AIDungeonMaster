import { isFeatureEnabled } from '@/lib/config/features';
import { DEFAULT_ADVENTURE_ID, getScenario } from '@/lib/game/scenarios';
import { loadClientSnapshot } from '@/lib/persistence/client-snapshot';
import type { TurnResponse } from '@/lib/play/types';

export function newSessionId(): string {
  return `sess-${crypto.randomUUID().slice(0, 8)}`;
}

export type PlayBootstrap = {
  sessionId: string;
  adventureId: string;
  adventureTitle: string;
  history: string[];
  state: TurnResponse['state'] | null;
  sceneId: TurnResponse['sceneId'];
  sceneGoal: string;
  mode: TurnResponse['mode'];
  choices: string[];
};

export function readPlayBootstrap(): PlayBootstrap {
  const scenario = getScenario(DEFAULT_ADVENTURE_ID);
  const starter = scenario.scenes.social.starter;
  const base: PlayBootstrap = {
    sessionId: '',
    adventureId: DEFAULT_ADVENTURE_ID,
    adventureTitle: scenario.title,
    history: [starter],
    state: null,
    sceneId: 'social',
    sceneGoal: scenario.scenes.social.goal,
    mode: 'table_rules',
    choices: [],
  };

  if (typeof window === 'undefined') return base;

  try {
    let id = localStorage.getItem('partyquest-session-id');
    if (!id) {
      id = newSessionId();
      localStorage.setItem('partyquest-session-id', id);
    }

    if (isFeatureEnabled('clientSessionSnapshot')) {
      const snapshot = loadClientSnapshot(id);
      if (snapshot?.state) {
        return {
          sessionId: id,
          adventureId: snapshot.adventureId ?? DEFAULT_ADVENTURE_ID,
          adventureTitle: snapshot.adventureTitle ?? getScenario(snapshot.adventureId ?? DEFAULT_ADVENTURE_ID).title,
          history: [starter, '(Resumed from last visit.)'],
          state: snapshot.state,
          sceneId: snapshot.sceneId,
          sceneGoal: snapshot.sceneGoal,
          mode: snapshot.mode,
          choices: snapshot.nextChoices,
        };
      }
    }

    return { ...base, sessionId: id };
  } catch {
    return { ...base, sessionId: newSessionId() };
  }
}
