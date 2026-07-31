// Maps an adventure id to its authored area graph and starting area, and builds
// the initial ExplorationState for a session. Kept separate from `state.ts` so
// area-graph content can be registered without touching core state plumbing.
//
// Adventures without an entry here simply get `exploration: undefined` — the
// spatial engine requests then no-op gracefully (see resolveEngineRequest).

import { createExplorationState, type AreaGraph, type ExplorationState } from '@/lib/engine/spatial';
import { nightstoneAreas, nightstoneStartAreaId } from './skt-nightstone/areas';
import {
  brindlehookAreas,
  brindlehookStartAreaId,
  cryptOfWhispersAreas,
  cryptOfWhispersStartAreaId,
  smugglersCoveAreas,
  smugglersCoveStartAreaId,
  tutorialAreas,
  tutorialStartAreaId,
} from './builtin-areas';

type AreaGraphConfig = { graph: AreaGraph; startAreaId: string };

const AREA_GRAPHS: Record<string, AreaGraphConfig> = {
  'skt-nightstone-starter': { graph: nightstoneAreas, startAreaId: nightstoneStartAreaId },
  'skt-nightstone-chapter1': { graph: nightstoneAreas, startAreaId: nightstoneStartAreaId },
  'brindlehook-inn': { graph: brindlehookAreas, startAreaId: brindlehookStartAreaId },
  'crypt-of-whispers': { graph: cryptOfWhispersAreas, startAreaId: cryptOfWhispersStartAreaId },
  'smugglers-cove': { graph: smugglersCoveAreas, startAreaId: smugglersCoveStartAreaId },
  'tutorial': { graph: tutorialAreas, startAreaId: tutorialStartAreaId },
};

/**
 * Builds the starting ExplorationState for an adventure, placing every party
 * member in the adventure's start area. Returns undefined for adventures that
 * have no authored area graph.
 */
export function buildExplorationState(adventureId: string, actorIds: string[]): ExplorationState | undefined {
  const config = AREA_GRAPHS[adventureId];
  if (!config) return undefined;
  const locations: Record<string, string> = {};
  for (const id of actorIds) locations[id] = config.startAreaId;
  return createExplorationState(config.graph, locations);
}
