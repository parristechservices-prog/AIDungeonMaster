# Storm King's Thunder — Campaign Roadmap

Honest status of how much of the full SKT campaign the app can run.

## Today
- **Chapter 1 (Nightstone)** is authored and playable (`skt-nightstone-chapter1`).
- **Chapters 1–12 exist as a validated structural scaffold** (`campaign/skt.ts`):
  order, level ranges, entry/exit conditions, locations, NPCs, monsters, quest &
  knowledge flags, transition graph, milestone levelling, and a small travel map.
- The knowledge/spoiler model marks late reveals (Iymrith, Hekaton, Kraken
  Society) as `dm_secret`; the mock-DM refuses to leak them.

## Chapter status

| # | Chapter | Levels | Status |
|---|---|---|---|
| 1 | A Great Upheaval (Nightstone) | 1–3 | **authored** |
| 2 | Rumblings (Triboar/Goldenfields/Bryn Shander) | 1–5 | scaffold |
| 3 | The Savage Frontier (Harshnag) | 5 | scaffold |
| 4 | The Chosen Path (Eye of the All-Father) | 5 | scaffold |
| 5 | Den of the Hill Giants (Grudd Haug) | 5–10 | scaffold |
| 6 | Canyon of the Stone Giants (Deadstone Cleft) | 5–10 | scaffold |
| 7 | Berg of the Frost Giants (Svardborg) | 5–10 | scaffold |
| 8 | Forge of the Fire Giants (Ironslag) | 5–10 | scaffold |
| 9 | Castle of the Cloud Giants (Lyn Armaal) | 5–10 | scaffold |
| 10 | Hold of the Storm Giants (Maelstrom) | 10–11 | scaffold |
| 11 | Caught in the Tentacles (Kraken Society) | 11 | scaffold |
| 12 | Doom of the Desert (Iymrith) | 11–12 | scaffold |

## Remaining work to actually play the full campaign (ordered)
1. **Engine integration of the framework** — add campaign fields to GameState
   (campaignId, currentChapterId, completedChapters, activeQuests, knownLore),
   migrate old saves, resolve chapter transitions deterministically in the turn
   loop, persist across turns.
2. **Milestone levelling application** — apply `grantsLevel` on milestone
   completion (currently a safe level field only; class-feature levelling is not
   implemented and must not be hallucinated).
3. **Author Chapters 2–12** as real modules (the bulk of the content effort).
   Recommended first vertical slice: Chapter 2 → Triboar.
4. **Overland travel resolver** — validate region travel against unlocked nodes.
5. **High-level 5e rules** for later chapters: multiattack, damage types +
   resistance/vulnerability/immunity, Huge/Gargantuan footprints, saving-throw
   spells, concentration (see `5e-rules-coverage.md`).
6. **Player-knowledge state in GameState** — consult `knowledgeFacts.visibility`
   instead of keyword gating.
7. **Multiplayer seats**, **AI Director consistency harness**, **Playwright** UI.

## Honesty
Full Storm King's Thunder is **not playable yet** — only Chapter 1. This pass
delivered the validated campaign data foundation; everything in "Remaining work"
is deferred and must not be claimed as done.
