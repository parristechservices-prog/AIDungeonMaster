export type AreaId = string;
export type ActorId = string;

export type TravelDifficulty =
  | 'trivial'
  | 'normal'
  | 'slow'
  | 'hazardous'
  | 'blocked';

export interface AreaConnection {
  to: AreaId;
  label?: string;
  difficulty: TravelDifficulty;
  requires?: {
    tag: string;
  };
  distanceFt?: number;
}

export interface Area {
  id: AreaId;
  name: string;
  description?: string;
  connections: AreaConnection[];
  tags?: string[];
}

export interface AreaGraph {
  areas: Record<AreaId, Area>;
}

export interface ActorLocation {
  actorId: ActorId;
  areaId: AreaId;
}

export interface ExplorationState {
  graph: AreaGraph;
  locations: Record<ActorId, AreaId>;
}
