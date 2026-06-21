# Campaign Framework

A typed, data-only foundation for running multi-chapter campaigns. It currently
**describes** a campaign (chapters, transitions, milestones, quests, knowledge,
travel) and is fully validated by tests — it is **not yet wired into GameState
or the turn loop**. That integration is the next pass (see "Status / honesty").

## Files
- `src/lib/game/campaign/types.ts` — `CampaignDefinition`, `CampaignChapter`,
  `CampaignTransition`, `CampaignMilestone`, `QuestFlag`, `KnowledgeFact`
  (`player_known` / `rumour` / `dm_secret`), `CampaignTravelNode`, `CampaignRoute`.
- `src/lib/game/campaign/validate.ts` — `validateCampaign()` (dangling refs,
  level ranges, transition graph, dead ends) + `allChaptersReachable()`.
- `src/lib/game/campaign/skt.ts` — the Storm King's Thunder campaign as
  structured scaffolds (Chapters 1–12). Chapter 1 links the authored module;
  Chapters 2–12 are `playableStatus: 'scaffold'`.
- Tests: `src/test/campaign-skt.test.ts`.

## How to add a new chapter
Add a `CampaignChapter` to the campaign's `chapters` (id, title, `levelRange`,
`playableStatus`, entry/exit conditions, locations, NPCs, monsters, quest +
knowledge flag ids), add a `CampaignTransition` into/out of it, add a
`CampaignMilestone`, then run `campaign-skt.test.ts` — the validator rejects
dangling references and dead ends.

## How to add a quest flag / knowledge fact
Add to `questFlags` / `knowledgeFacts` with a real `introducedInChapter` /
`revealedInChapter`, then reference its id from the chapter. Knowledge facts MUST
set `visibility`: keep late reveals `dm_secret` so player-facing narration never
states them as fact.

## Knowledge / spoiler model
`KnowledgeFact.visibility` distinguishes DM truth (`dm_secret`), rumour, and
player-known. The mock-DM already refuses to state SKT secrets (Iymrith/Hekaton/
Kraken Society) as player knowledge (`mock-dm.ts` lore-secret handler). The
campaign `knowledgeFacts` are the authoritative source the engine should consult
once integrated, replacing keyword-only gating.

## Status / honesty
**Foundation only.** Implemented & tested: the data model, the SKT 1–12
structure, validation, and the knowledge/spoiler visibility model.
**Not yet implemented (deferred):** GameState fields (campaignId/progress/
completedChapters/activeQuests/knownLore), chapter-transition resolution in the
turn loop, milestone levelling application, overland-travel resolver, a playable
Chapter 2 slice, and multiplayer seats. See `docs/skt-campaign-roadmap.md`.
