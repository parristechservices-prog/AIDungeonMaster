// Unified play-map view-model. The Map panel works in two modes:
//   - 'combat'      → tactical battlemap (see battlemap-view.ts)
//   - 'exploration' → zone/node map of the current area + connected exits
//   - 'empty'       → useful fallback when neither spatial model exists
//
// Pure + deterministic: it renders engine state and produces SUGGESTED command
// strings. It never mutates game state — taps still go through the turn/API.

import { getArea, getNeighbors } from '@/lib/engine/spatial/area-graph';
import type { TurnResponse } from '@/lib/play/types';

type PlayState = NonNullable<TurnResponse['state']>;

export type PlayMapMode = 'combat' | 'exploration' | 'empty';

export type ExplorationExit = {
  areaId: string;
  name: string;
  label?: string;
  difficulty: string;
  distanceFt?: number;
  locked: boolean;
  /** Suggested (non-submitting) command for tapping this exit. */
  command: string;
};

export type ExplorationActorChip = {
  id: string;
  name: string;
  kind: 'party' | 'npc';
  command: string;
};

export type ExplorationNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
};

export type ExplorationEdge = {
  from: string;
  to: string;
  locked: boolean;
};

export type ExplorationMapView = {
  mode: 'exploration';
  currentAreaId: string;
  currentAreaName: string;
  currentAreaDescription?: string;
  exits: ExplorationExit[];
  actorsPresent: ExplorationActorChip[];
  baseSuggestions: string[];
  nodes: ExplorationNode[];
  edges: ExplorationEdge[];
};

export type EmptyMapView = {
  mode: 'empty';
  sceneId: string;
  areaName?: string;
  baseSuggestions: string[];
};

const BASE_SUGGESTIONS = ['Where am I?', 'What exits are available?', 'Who is here?'];

const DIFFICULTY_LABEL: Record<string, string> = {
  trivial: 'easy',
  normal: 'normal',
  slow: 'slow',
  hazardous: 'hazardous',
  blocked: 'blocked',
};

/** Combat takes priority; then exploration if a current area resolves; else empty. */
export function resolveMapMode(state: PlayState | null): PlayMapMode {
  if (state?.combat?.active && state.combat.battleMap) return 'combat';
  if (state?.exploration && currentAreaId(state)) return 'exploration';
  return 'empty';
}

function currentAreaId(state: PlayState): string | undefined {
  return state.exploration?.locations[state.activeCharacterId];
}

/**
 * Builds the exploration (zone) map for the party's current area: the area
 * itself, its connected exits, and any NPCs the scene exposes — each with a
 * ready-to-send suggested command. Returns null if no current area resolves.
 */
export function buildExplorationMapView(state: PlayState): ExplorationMapView | null {
  const exploration = state.exploration;
  if (!exploration) return null;
  const areaId = currentAreaId(state);
  if (!areaId) return null;

  let area;
  try {
    area = getArea(exploration, areaId);
  } catch {
    return null;
  }

  const exits: ExplorationExit[] = getNeighbors(exploration, areaId).map((conn) => {
    const target = exploration.graph.areas[conn.to];
    const name = target?.name ?? conn.to;
    return {
      areaId: conn.to,
      name,
      label: conn.label,
      difficulty: DIFFICULTY_LABEL[conn.difficulty] ?? conn.difficulty,
      distanceFt: conn.distanceFt,
      // We don't compute satisfiedTags client-side; a gated exit is shown as
      // locked so the player knows it needs a key/condition.
      locked: !!conn.requires,
      command: `Move to ${name}`,
    };
  });

  // Party members in the same area, plus scene NPCs (player-known only — DM-only
  // hidden monsters are never surfaced here).
  const actorsPresent: ExplorationActorChip[] = [];
  for (const member of state.party) {
    if (member.id !== state.activeCharacterId && exploration.locations[member.id] === areaId) {
      actorsPresent.push({ id: member.id, name: member.name, kind: 'party', command: `Talk to ${member.name}` });
    }
  }
  for (const npc of state.npcs ?? []) {
    actorsPresent.push({ id: npc.id, name: npc.name, kind: 'npc', command: `Talk to ${npc.name}` });
  }

  const nodes: ExplorationNode[] = [];
  const edges: ExplorationEdge[] = [];
  const seenEdges = new Set<string>();

  for (const [id, a] of Object.entries(exploration.graph.areas)) {
    nodes.push({
      id,
      name: a.name,
      x: a.x ?? 0,
      y: a.y ?? 0,
      isCurrent: id === areaId,
    });
    for (const conn of a.connections) {
      const edgeKey = [id, conn.to].sort().join('--');
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        edges.push({
          from: id,
          to: conn.to,
          locked: !!conn.requires,
        });
      }
    }
  }

  return {
    mode: 'exploration',
    currentAreaId: areaId,
    currentAreaName: area.name,
    currentAreaDescription: area.description,
    exits,
    actorsPresent,
    baseSuggestions: BASE_SUGGESTIONS,
    nodes,
    edges,
  };
}

/** The useful fallback when there is no battlemap and no area graph. */
export function buildEmptyMapView(state: PlayState | null): EmptyMapView {
  return {
    mode: 'empty',
    sceneId: state?.combat?.active ? 'combat' : 'scene',
    baseSuggestions: BASE_SUGGESTIONS,
  };
}
