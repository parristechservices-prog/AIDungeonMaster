/**
 * Feature flags for gradual rollout beyond V0.
 * Flip flags as capabilities ship; UI reads these for "coming soon" surfaces.
 */
export const FEATURE_FLAGS = {
  voiceInput: false,
  voiceOutput: false,
  multiplayerRooms: false,
  userAccounts: false,
  cloudSave: false,
  /** Client-side localStorage snapshot of last turn state */
  clientSessionSnapshot: true,
  appealTheDm: true,
  physicalDice: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
