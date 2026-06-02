import { isFeatureEnabled } from '@/lib/config/features';
import {
  DEFAULT_ADVENTURE_ID,
  getAdventure,
  getFirstPlayableSceneId,
  getSceneGoal,
} from '@/lib/game/adventures';
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
  ambient: TurnResponse['ambient'];
};

type BootstrapState = NonNullable<PlayBootstrap['state']>;
type BootstrapCharacter = BootstrapState['party'][number];

function isBootstrapCharacter(value: unknown): value is BootstrapCharacter {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
}

function defaultStarter(adventureId: string): string {
  const adventure = getAdventure(adventureId);
  const first = getFirstPlayableSceneId(adventure);
  return adventure.scenes[first]?.starter ?? 'Your adventure begins.';
}

export function readPlayBootstrap(): PlayBootstrap {
  const adventure = getAdventure(DEFAULT_ADVENTURE_ID);
  const firstScene = getFirstPlayableSceneId(adventure);
  const starter = defaultStarter(DEFAULT_ADVENTURE_ID);
  const base: PlayBootstrap = {
    sessionId: '',
    adventureId: DEFAULT_ADVENTURE_ID,
    adventureTitle: adventure.title,
    history: [starter],
    state: null,
    sceneId: firstScene,
    sceneGoal: getSceneGoal(adventure, firstScene),
    mode: 'table_rules',
    choices: [],
    ambient: 'none',
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
        const aid = snapshot.adventureId ?? DEFAULT_ADVENTURE_ID;
        const rawState = snapshot.state as Partial<PlayBootstrap['state']> & { player?: unknown };
        const party = rawState.party ?? (isBootstrapCharacter(rawState.player) ? [rawState.player] : []);
        const activeCharacterId = rawState.activeCharacterId ?? party[0]?.id ?? '';
        const migratedState = {
          ...rawState,
          party,
          activeCharacterId,
        } as PlayBootstrap['state'];

        return {
          sessionId: id,
          adventureId: aid,
          adventureTitle: snapshot.adventureTitle ?? getAdventure(aid).title,
          history: [defaultStarter(aid), '(Resumed from last visit.)'],
          state: migratedState,
          sceneId: snapshot.sceneId,
          sceneGoal: snapshot.sceneGoal,
          mode: snapshot.mode,
          choices: snapshot.nextChoices ?? [],
          ambient: snapshot.ambient ?? 'none',
        };
      }
    }

    return { ...base, sessionId: id };
  } catch {
    return { ...base, sessionId: newSessionId() };
  }
}
