// Structural validation for a CampaignDefinition. Pure, deterministic, used by
// tests to guarantee a campaign is internally consistent (no dangling chapter
// references, valid transition graph, complete chapter metadata).

import type { CampaignDefinition } from './types';

export function validateCampaign(c: CampaignDefinition): string[] {
  const errors: string[] = [];
  const chapterIds = new Set(c.chapters.map((ch) => ch.id));
  const questIds = new Set(c.questFlags.map((q) => q.id));
  const knowledgeIds = new Set(c.knowledgeFacts.map((k) => k.id));
  const nodeIds = new Set(c.travelNodes.map((n) => n.id));

  if (!chapterIds.has(c.startChapterId)) {
    errors.push(`startChapterId "${c.startChapterId}" is not a defined chapter`);
  }

  for (const ch of c.chapters) {
    if (ch.levelRange[0] < 1 || ch.levelRange[1] < ch.levelRange[0]) {
      errors.push(`chapter ${ch.id}: invalid levelRange ${JSON.stringify(ch.levelRange)}`);
    }
    if (ch.entryConditions.length === 0) errors.push(`chapter ${ch.id}: no entryConditions`);
    if (ch.exitConditions.length === 0) errors.push(`chapter ${ch.id}: no exitConditions`);
    if (ch.majorLocations.length === 0) errors.push(`chapter ${ch.id}: no majorLocations`);
    for (const q of ch.questFlags) if (!questIds.has(q)) errors.push(`chapter ${ch.id}: unknown questFlag "${q}"`);
    for (const k of ch.knowledgeFacts) if (!knowledgeIds.has(k)) errors.push(`chapter ${ch.id}: unknown knowledgeFact "${k}"`);
  }

  for (const t of c.transitions) {
    if (!chapterIds.has(t.fromChapterId)) errors.push(`transition from unknown chapter "${t.fromChapterId}"`);
    if (!chapterIds.has(t.toChapterId)) errors.push(`transition to unknown chapter "${t.toChapterId}"`);
    if (t.requires && !questIds.has(t.requires) && !c.milestones.some((m) => m.id === t.requires)) {
      errors.push(`transition ${t.fromChapterId}->${t.toChapterId}: requires "${t.requires}" is not a quest flag or milestone`);
    }
  }

  for (const m of c.milestones) {
    if (!chapterIds.has(m.chapterId)) errors.push(`milestone ${m.id}: unknown chapter "${m.chapterId}"`);
  }

  for (const q of c.questFlags) {
    if (!chapterIds.has(q.introducedInChapter)) errors.push(`quest ${q.id}: unknown introducedInChapter "${q.introducedInChapter}"`);
  }

  for (const k of c.knowledgeFacts) {
    if (k.revealedInChapter && !chapterIds.has(k.revealedInChapter)) {
      errors.push(`knowledge ${k.id}: unknown revealedInChapter "${k.revealedInChapter}"`);
    }
  }

  for (const r of c.routes) {
    if (!nodeIds.has(r.fromNodeId)) errors.push(`route from unknown node "${r.fromNodeId}"`);
    if (!nodeIds.has(r.toNodeId)) errors.push(`route to unknown node "${r.toNodeId}"`);
    if (r.distanceMiles <= 0) errors.push(`route ${r.fromNodeId}->${r.toNodeId}: non-positive distance`);
  }

  for (const n of c.travelNodes) {
    if (n.unlockedByChapter && !chapterIds.has(n.unlockedByChapter)) {
      errors.push(`travel node ${n.id}: unknown unlockedByChapter "${n.unlockedByChapter}"`);
    }
  }

  // Every non-final chapter should have at least one outgoing transition so the
  // campaign graph is fully connected from the start.
  const hasOutgoing = new Set(c.transitions.map((t) => t.fromChapterId));
  const lastChapterId = c.chapters[c.chapters.length - 1]?.id;
  for (const ch of c.chapters) {
    if (ch.id !== lastChapterId && !hasOutgoing.has(ch.id)) {
      errors.push(`chapter ${ch.id}: no outgoing transition (dead end)`);
    }
  }

  return errors;
}

/** True when every chapter is reachable from the start via transitions. */
export function allChaptersReachable(c: CampaignDefinition): boolean {
  const adj = new Map<string, string[]>();
  for (const t of c.transitions) {
    adj.set(t.fromChapterId, [...(adj.get(t.fromChapterId) ?? []), t.toChapterId]);
  }
  const seen = new Set<string>([c.startChapterId]);
  const queue = [c.startChapterId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return c.chapters.every((ch) => seen.has(ch.id));
}
