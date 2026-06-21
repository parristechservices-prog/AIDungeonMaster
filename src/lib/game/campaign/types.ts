// Campaign-scale data model. This is the structural foundation for running a
// multi-chapter campaign (e.g. Storm King's Thunder). It is intentionally PURE
// DATA + TYPES — it does not yet wire into GameState/the turn loop (see
// docs/campaign-framework.md for the integration roadmap). Keeping it standalone
// means it can be authored and validated without risking the live engine.

export type PlayableStatus = 'authored' | 'partial' | 'scaffold';

/** How a campaign knows what's true vs what the party has actually learned. */
export type KnowledgeVisibility =
  | 'player_known' // the party has learned this; safe to state plainly
  | 'rumour' // heard but unconfirmed
  | 'dm_secret'; // DM truth not yet known to players — never leak as fact

export type KnowledgeFact = {
  id: string;
  /** Concise paraphrased fact — never copyrighted prose. */
  fact: string;
  visibility: KnowledgeVisibility;
  /** Chapter id where this typically becomes player-known, if applicable. */
  revealedInChapter?: string;
};

export type QuestFlag = {
  id: string;
  title: string;
  /** Chapter that introduces this quest objective. */
  introducedInChapter: string;
};

export type CampaignMilestone = {
  id: string;
  /** Chapter completion (or key event) that grants the milestone. */
  chapterId: string;
  /** Party level granted/confirmed when this milestone completes. */
  grantsLevel: number;
};

export type CampaignTransition = {
  fromChapterId: string;
  toChapterId: string;
  /** Quest flag / milestone that must be set before this transition is legal. */
  requires?: string;
  note?: string;
};

export type CampaignTravelNode = {
  id: string;
  name: string;
  /** Region grouping for overland travel. */
  region: string;
  /** Chapter that gates discovery/availability of this node, if any. */
  unlockedByChapter?: string;
};

export type CampaignRoute = {
  fromNodeId: string;
  toNodeId: string;
  distanceMiles: number;
  danger: 'safe' | 'risky' | 'dangerous';
};

export type CampaignChapter = {
  id: string;
  title: string;
  levelRange: [number, number];
  playableStatus: PlayableStatus;
  /** Optional id of an authored adventure/module that plays this chapter. */
  moduleId?: string;
  entryConditions: string[];
  exitConditions: string[];
  majorLocations: string[];
  majorNpcs: string[];
  majorMonsters: string[];
  questFlags: string[]; // QuestFlag ids introduced/advanced here
  knowledgeFacts: string[]; // KnowledgeFact ids that may become known here
};

export type CampaignDefinition = {
  id: string;
  title: string;
  premise: string;
  startChapterId: string;
  chapters: CampaignChapter[];
  transitions: CampaignTransition[];
  milestones: CampaignMilestone[];
  questFlags: QuestFlag[];
  knowledgeFacts: KnowledgeFact[];
  regions: string[];
  travelNodes: CampaignTravelNode[];
  routes: CampaignRoute[];
};
