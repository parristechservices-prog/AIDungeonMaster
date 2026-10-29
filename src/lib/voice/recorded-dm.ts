import catalogue from './recorded-dm-lines.json';

export type RecordedDmClip = (typeof catalogue.clips)[number];
export type DmCueContext = {
  adventureId: string;
  sceneId: string;
  turnCount: number;
  characterClass: string;
  combatActive: boolean;
  lowHealth: boolean;
  pendingRoll: boolean;
  engineResults: {kind: string; ok: boolean}[];
};

// A suggestion is not an automatic assertion. The player must explicitly choose Play.
export function suggestRecordedDmCues(context: DmCueContext): string[] {
  const ids: string[] = [];
  if (context.turnCount === 0) ids.push('VO081');
  const scenes: Record<string,string> = {
    'brindlehook-inn':'VO082',
    'crypt-of-whispers':'VO083',
    'smugglers-cove':'VO084',
  };
  if (scenes[context.adventureId]) ids.push(scenes[context.adventureId]);
  const classes: Record<string,string> = {
    fighter:'VO085',wizard:'VO086',rogue:'VO087',cleric:'VO088',
  };
  const classCue = classes[context.characterClass.toLowerCase()];
  if (classCue) ids.push(classCue);
  if (context.pendingRoll) ids.push('VO089');
  for (const outcome of context.engineResults) {
    if (outcome.kind === 'skill_check') ids.push(outcome.ok?'VO090':'VO091');
  }
  if (context.combatActive) ids.push('VO092','VO093');
  if (context.lowHealth) ids.push('VO094');
  // Victory, loot, chapter changes and ending outcomes need authoritative game
  // events; never invent them from generic narration or a scene label.
  return [...new Set(ids)];
}
export const RECORDED_DM_CLIPS = catalogue.clips;
