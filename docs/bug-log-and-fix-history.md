# AI Dungeon Master — Bug Log, Fix History, and Next Work Queue

**Project:** AIDungeonMaster / PartyQuest V0  
**Repo:** https://github.com/parristechservices-prog/AIDungeonMaster  
**Live app:** https://ai-dungeon-master-azure.vercel.app/play  
**Created from:** ChatGPT/Claude/Copilot QA conversation and user browser playtests through 2026-09-25.  

This document preserves the bugs, fixes, open issues, and next prompts discovered during the recent project session so work can resume cleanly next time.

---

## Current quick status

### 2026-09-29: loading freeze — podcasts removed

Removed the shared podcast script from the root layout on every route. Its
MutationObserver watched subtree child-list changes, while its callback
unconditionally assigned the launcher's textContent. That write generated
another observed mutation, repeatedly scheduling the callback and starving
browser input/rendering. The production homepage timed out in browser automation.
Podcast removal is the requested resolution; game narration and audio are unchanged.

Verification: production build/typecheck and ESLint passed; existing mobile and
desktop startup browser tests both passed through to the game composer. Blocking
only podcast scripts on the old production site also restored homepage navigation
to `/start` with no uncaught browser errors, confirming the integration as the cause.

### Fixed or materially improved

| Area | Status |
|---|---|
| DM View discoverability | Fixed/improved |
| SKT/Nightstone drawbridge distance | Fixed locally and regression-tested |
| “No tactical battle map is active” leaking into exploration distance answers | Fixed/improved |
| Failed-action message with no dismiss control | Fixed |
| Desktop `/play` layout scroll/cutoff | Improved |
| Mobile header/theme/audio overlay | Improved |
| Tactical battlemap view-model | Added |
| Player-facing Map button/drawer | Added |
| Exploration map for normal scenes | Added |
| Display Settings show/hide toggles | Added |
| SKT full-campaign scaffold | Added, not fully playable |
| Browser/e2e baseline | Some e2e exists, but not broad enough |

### Still open / needs next pass

| Area | Status |
|---|---|
| Nightstone compass directions | Open |
| Direct dialogue mishandled as skill checks | Open |
| Scene continuity contradictions | Open |
| Levitate/effect state tracking | Open |
| Level 1 wizard incorrectly showing 2nd-level slots | Open |
| Per-character backgrounds in party creation | Open |
| Comprehensive browser QA/self-playtest loop | Open |
| Full SKT campaign playable beyond Chapter 1 | Open |
| Campaign framework wired into GameState/turn loop | Open |
| Higher-level 5e rules: multiattack, resistance, concentration, saving-throw spells, Huge+ footprints | Open |
| Real multiplayer seats | Open |
| Worldbuilding generators / TTS / image generation | Open/scaffold only |

---

# Fixed / improved bugs

## 1. DM View was hard to find or missing on deployed `/play`

### Symptom
A live browser playtest could not find the Dungeon Master/dev screen. The only obvious control was the Light/Dark mode toggle.

### Expected
A clear **DM View** control should be visible in `/play`. DM-only info must remain hidden by default, but discoverable when intentionally toggled.

### Fix summary
The app now preserves and wires:

- `DevPanelToggle`
- `DmPanels`
- DM View header control
- toggles for engine log, monster stat blocks, action economy, terrain overlay, cover/LOS, opportunity attacks, narration warnings

### Verification reported
Tests/typecheck/lint/build passed. Later screenshots show `DM View (7)` visible in the header.

### Remaining
Browser QA should assert DM View opens on desktop and mobile and that DM details remain hidden by default.

---

## 2. SKT/Nightstone drawbridge distance was vague

### Symptom
Player asked:

```text
how far away is the drawbridge from me?
```

The app gave vague prose instead of a grounded distance.

### Expected
The DM should answer from deterministic spatial/area data with a numeric or grounded distance.

### Fix summary
Claude Code reported:

- repaired half-finished distance code
- added `distanceFt` to `query_path_exists`
- preferred authored scene-aware distance where area graph state was stale
- added regression tests for the exact drawbridge prompt

### Commit reported
`4090a89`

### Verification reported
Tests, typecheck, lint, build passed. Exact prompt returned a useful distance like “about 30 feet.”

### Remaining
`currentAreaId` still needs to sync properly with scene transitions so authored fallback data can eventually be retired.

---

## 3. “No tactical battle map is active” leaked into exploration questions

### Symptom
In Brindlehook, player asked:

```text
How far from me to the water
```

The app answered:

```text
No tactical battle map is active.
• No tactical battle map is active.
```

### Root cause
The live AI Director emitted a tactical spatial request for an ordinary exploration distance question. The engine correctly refused because there was no battle map, but the refusal was shown to the player.

### Expected
Exploration distance questions should use exploration/scene/landmark context. If exact distance is unknown, answer honestly without inventing a number.

### Fix summary
Reported fix included:

- `isExplorationDistanceQuestion`
- `extractSpatialTarget`
- top-level distance handling in `deriveDmTurnFromInput`
- aliases for water/shore/river, boathouse, dock/pier, drawbridge/gate/square/inn/keep/bell tower/trail
- system prompt guardrail not to use tactical battle-map requests for normal exploration distance questions
- filtered internal tactical refusals from player narration

### Commit reported
`b340349`

### Verification reported
`exploration-distance.test.ts` added with 13 tests; suite passed.

### Remaining
Brindlehook still needs authored landmark distances if exact numbers are desired.

---

## 4. Failed-action message could not be dismissed

### Symptom
Popup/status said:

```text
That approach didn’t work this time, try another angle
```

There was no close/dismiss mechanism.

### Expected
A non-critical status message must be dismissible and/or auto-dismiss.

### Fix summary
Reported fix:

- updated `FailedCheckRecovery.tsx`
- made it inline `role="status"`
- added close button with `aria-label="Dismiss message"`
- Escape dismisses it
- auto-dismisses after around 6 seconds
- new failed check can show again
- dismissal is local UI state only

### Commit reported
`c35c20c`

### Verification reported
`failed-check-recovery.test.ts` added. Suite/typecheck/lint/build passed.

### Remaining
Click/Escape/auto-dismiss were not fully DOM-tested; add Playwright test later.

---

## 5. `/play` desktop layout had awkward scroll/cutoff

### Symptom
Desktop screenshots showed page scroll, story scroll, sidebar scroll, controls below the fold, cut-off right panel, and an awkward floating close/back affordance.

### Expected
Stable viewport app shell: story scrolls internally, composer stays reachable, sidebar scrolls separately.

### Fix summary
Reported layout pass:

- `page.tsx`: full-height app shell (`h-[100dvh]`, `overflow-hidden`, `flex flex-col`)
- story owns scroll; composer pinned with `shrink-0`
- sidebar owns its own scroll
- `NarrationPanel.tsx`: removed fixed `h-[380px]`, now flex scroll
- `InputBox.tsx`: removed sticky/backdrop hack

### Commit reported
`6487b4d`

### Remaining
Browser visual verification was not done in that environment.

---

## 6. Mobile UI was cramped and controls overlapped

### Symptom
Mobile screenshots showed enormous title, cramped controls, Light Mode floating over header, tiny story panel, awkward Send button, cut-off suggestions, and audio over content.

### Fix summary
Reported mobile pass:

- Theme toggle gained a non-floating variant
- global floating theme toggle hidden on `/play`
- inline theme chip added
- `AmbientAudio` moved from fixed bottom-right overlay into normal flow
- header chips made compact/wrapping
- mobile title smaller/clamped
- safe-area composer padding added

### Commit reported
`c49962f`

### Remaining
Not browser-verified by Claude; input/Send still may need polish; no More overflow menu yet.

---

## 7. Map only worked in combat

### Symptom
The Map/Battlemap feature was useful only in active combat.

### Expected
Map should be useful in regular scenes too, showing current area, exits, landmarks/leads, and movement suggestions.

### Fix summary
Reported exploration map pass:

- added `src/lib/play/map-view.ts`
- introduced modes: `combat`, `exploration`, `empty`
- `Battlemap.tsx` now renders tactical combat map, exploration zone/node map, or useful fallback
- exploration map shows current area, exits, distances, gated exits, party/NPC chips, prompts
- taps suggest commands only

### Commit reported
`2a20f1e`

### Remaining
Exploration map is zone/node cards, not a 2D spatial grid. Some adventures still lack authored exploration graphs.

---

## 8. Player-facing battlemap added

### Symptom
There was battlemap/spatial data but no visible player-facing map.

### Fix summary
Foundation and UI were added:

- `src/lib/play/battlemap-view.ts`
- `buildBattlemapView`
- `interpretCellTap`
- `src/components/play/Battlemap.tsx`
- desktop Character | Map tab
- mobile Map drawer
- tap cells/tokens to suggest input commands, no direct mutation

### Commits reported
`d838224` for view-model/AI harness; `c775d48` for player-facing map.

### Remaining
No drag/drop, pan/zoom, or DOM component tests. Browser visual QA still needed.

---

## 9. Display Settings show/hide toggles added

### Symptom
Mobile UI remained busy; user wanted toggles like “show/hide suggestions.”

### Fix summary
Reported Display Settings pass:

- `src/lib/play/display-settings.ts`
- `src/components/play/DisplaySettingsPanel.tsx`
- toggles for scene meta, mode pill, active character, turn number, narration, dice panel, suggested actions, Appeal DM, physical dice, audio, Character button, Map button, DM View, Export, Theme, Back
- compact mode
- presets: Full, Minimal, Combat, Story
- persists via localStorage
- Display opener and input cannot be hidden

### Commit reported
`cfd48e1`

### Remaining
Not browser-verified. Compact mode is light-touch. No font-size/reduced-motion settings yet.

---

## 10. SKT campaign scaffold added

### Finding
Only Chapter 1/Nightstone is authored/playable. Full SKT is not playable.

### Improvement
Added campaign data foundation:

- campaign/chapter types
- transitions
- milestones
- quest flags
- knowledge facts
- full SKT chapter scaffold
- validators/tests

### Commit reported
`300543a`

### Remaining
Scaffold not fully wired into GameState/turn loop. Chapters 2–12 are scaffolds, not playable.

---

## 11. AI consistency harness added

### Symptom
Most tests used mock/table-rules mode; live AI-style outputs were less constrained.

### Improvement
Added deterministic contract tests for structured AI-style outputs, malformed requests, invented movement/hits, monster HP contradictions, etc.

### Commit reported
`d838224`

### Remaining
Still not a live model smoke test; add optional live AI smoke later.

---

# Open bugs / next fixes

## 12. Nightstone compass directions are wrong

### Symptom
At the west drawbridge/gate, the app answered compass questions incorrectly:

- north = damaged keep across water
- south = inner cart track to south village square
- east = vague
- west = road away

### Why wrong
On the map, the main drawbridge/gate is on the west side. West is road back out; east leads into the village; the keep is south/southeast, not north. The app may be treating `south_square` as a compass direction.

### Required fix

- add explicit compass/bearing metadata to area graph connections
- do not infer compass direction from area IDs
- correct Nightstone orientation
- add regression tests for north/south/east/west from west gate

### Suggested commit
`Fix Nightstone compass directions`

---

## 13. Direct dialogue misclassified as skill checks

### Symptom
Player said:

```text
I say "hello Elder Sarra"
```

The app made this an emotional-reading/Insight failure instead of dialogue. Player asked `"Who are you?"` and got mixed trail narration plus another check-like result.

### Required fix

- direct speech is dialogue first
- skill checks only when requested/justified
- Sarra should answer direct questions
- add tests for greeting, “Who are you?”, and explicit Insight attempts

---

## 14. Scene continuity contradiction: trail text injected during Sarra conversation

### Symptom
While speaking to Sarra, app inserted unrelated trail text:

```text
Crushed ferns and wheel ruts lead north. Crows circle somewhere ahead.
```

### Required fix

- track current interaction/focus
- do not inject unrelated scene snippets unless player moves/advances
- add tests for Sarra conversation continuity

---

## 15. Levitate/effect state not tracked

### Symptom
Player levitated Sarra, said full 20 feet, then app said 10 feet.

### Required fix

- add/strengthen ongoing effects state model
- if levitate legal, track target/caster/height/duration/concentration subset
- answer height from state
- pronoun/reference resolution
- if spell illegal, reject honestly

---

## 16. Level 1 wizard incorrectly has Level 2 spell slots

### Symptom
Character sheet showed Level 1 Elf Wizard with Level 2 Slots 2/2.

### Required fix

- fix character template
- reject Level 2 spell casting at level 1
- add tests for slots/spell legality

---

## 17. Party creation uses one shared background

### Symptom
Create Adventure allows multiple party members but only one background selection.

### Required fix

- per-character creation selections
- each party member has own background
- GameState preserves each character background
- campaign memory/facts reflect individual backgrounds
- add tests and e2e for party builder

### Suggested commit
`Improve party character creation backgrounds`

---

## 18. Browser QA/self-playtest loop is not broad enough

### Symptom
Bugs are being found manually by the user.

### Required fix

Add a real Playwright QA harness:

- mobile/desktop viewports
- natural-language prompt smoke tests
- known-bug regressions
- UI health invariant checks
- screenshots/traces on failure
- no console errors
- tests for map, DM View, Display Settings, popups, exploration distance, Nightstone compass, start flow

### Suggested commit
`Add automated browser playtest QA`

---

# Larger product gaps

## 19. Full Storm King’s Thunder not playable

Current: Chapter 1 authored; Chapters 2–12 scaffolded. Need GameState integration, chapter transitions, milestone levelling, quest flags, player knowledge, region travel, and playable Chapter 2.

## 20. Campaign framework not fully integrated

Need campaign fields in `GameState`, transition resolver, milestone application, quest/knowledge updates, progress UI, old save migration.

## 21. High-level 5e systems missing

Recommended priority:

1. damage types + resistance/vulnerability/immunity
2. monster multiattack
3. Huge/Gargantuan footprints
4. saving-throw spells
5. concentration

## 22. Multiplayer seats not implemented

Need `playerSeatId`, controlled character IDs, active controlled character, turn ownership, local/async foundation.

## 23. Competitor-level skin still mostly missing

Missing or partial:

- polished browser/mobile UX
- visual map polish
- campaign/session library
- worldbuilding generators
- character portraits
- TTS
- image generation
- share/invite links
- onboarding
- accessibility settings

---

# Recommended next work order

## Next 1: Fix correctness bugs

1. Nightstone compass directions
2. Direct dialogue / scene continuity
3. Level 1 wizard spell slots
4. Levitate/effect state or honest rejection
5. Per-character backgrounds in party creation

## Next 2: Browser QA agent loop

Add Playwright tests that permanently catch the bug classes discovered manually.

## Next 3: Campaign integration

Wire SKT/campaign scaffold into GameState and turn transitions.

## Next 4: High-value 5e rule system

Implement damage types and resistance/vulnerability/immunity.

## Next 5: Character creation overhaul

After the per-background bug fix, improve the whole start flow:

- party builder
- validation
- mobile layout
- clear solo/party modes
- quick party preset

---

# Prompt for next session

```text
Read docs/bug-log-and-fix-history.md, docs/player-qa-matrix.md, docs/spatial-qa.md, docs/5e-rules-coverage.md, and the latest git log.

Start with the open bugs section.

Do not add new features until these are fixed:

1. Nightstone compass directions.
2. Direct dialogue being misclassified as skill checks.
3. Scene continuity contradictions.
4. Level 1 wizard 2nd-level slots.
5. Levitate/effect state tracking or honest rejection.
6. Per-character background selection in party creation.
7. Comprehensive Playwright browser QA for known bug classes.

For each bug:
- reproduce it with a deterministic test or browser test
- fix the smallest root cause
- add a regression test
- run pnpm test, tsc, lint, build, and e2e if relevant
- commit only when green
```
