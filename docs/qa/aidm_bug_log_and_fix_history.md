# AI Dungeon Master — Bug Log, Fix History, and Next Work Queue

**Project:** AIDungeonMaster / PartyQuest V0  
**Repo:** https://github.com/parristechservices-prog/AIDungeonMaster  
**Live app:** https://ai-dungeon-master-azure.vercel.app/play  
**Purpose:** Consolidate every bug, gap, and fix discovered during the recent QA/playtest cycle so the project can resume cleanly next time.

> Note: This document is based on the playtests, Claude Code reports, screenshots, and prompts from the working session. Some items are already fixed and pushed; some are partially fixed; some are still open and need the next coding pass.

---

## Quick Status Summary

### Fixed or materially improved

| Area | Status |
|---|---|
| DM View discoverability | Fixed/improved |
| Drawbridge distance in SKT/Nightstone | Fixed locally and regression-tested |
| “No tactical battle map is active” leaking into normal exploration distance answers | Fixed/improved |
| Un-dismissable failed-action message | Fixed |
| Desktop `/play` layout scroll/cutoff | Improved |
| Mobile header/theme/audio overlay | Improved |
| Combat battlemap view-model | Added |
| Player-facing tactical map | Added |
| Exploration map for normal scenes | Added |
| Display Settings show/hide toggles | Added |
| SKT campaign scaffold | Added |
| Browser/e2e baseline | Some e2e exists, but not enough |

### Still open / needs next pass

| Area | Status |
|---|---|
| Nightstone compass directions | Open |
| Direct dialogue mishandled as skill checks | Open |
| Scene continuity contradictions | Open |
| Levitate/effect state tracking | Open |
| Level 1 wizard incorrectly showing 2nd-level slots | Open |
| Per-character backgrounds in party creation | Open |
| Comprehensive browser QA agent loop | Open |
| Full SKT campaign playable beyond Chapter 1 | Open |
| Campaign framework wired into GameState/turn loop | Open |
| High-level 5e rules: multiattack, resistance, concentration, saving-throw spells, Huge+ footprints | Open |
| Real multiplayer seats | Open |
| Worldbuilding generators / TTS / image generation | Open/scaffold only |

---

# Fixed / Improved Bugs

## 1. DM View was hard to find or missing on the deployed app

### Symptom

The app had DM/dev tooling locally, but a live browser playtest could not find the DM screen. The only obvious control was Light/Dark mode.

### Expected behaviour

There should be a clear **DM View** button in `/play`. DM-only data should remain hidden by default, but the controls should be discoverable.

### Fix

Claude/Copilot work preserved and wired:

- `DevPanelToggle`
- `DmPanels`
- DM View header button
- toggles for:
  - engine log
  - monster stat blocks
  - action economy
  - terrain overlay
  - cover/LOS
  - opportunity attacks
  - narration warnings

### Verification reported

- Unit tests passed.
- Typecheck/lint/build passed.
- DM View defaults off.
- DM View visible in later screenshots as `DM View (7)`.

### Remaining limitation

Browser QA should still assert that DM View opens and that toggles work on mobile and desktop.

---

## 2. SKT/Nightstone drawbridge distance gave vague narration

### Symptom

Player asked:

```text
how far away is the drawbridge from me?
```

The app answered vaguely, e.g. “you see the drawbridge in the distance,” rather than giving a usable distance.

### Expected behaviour

The DM should use deterministic spatial/area data and answer with numeric or grounded distance information.

### Fix

Reported in Claude Code pass:

- Repaired Copilot’s half-finished distance code.
- Added `distanceFt` to `query_path_exists`.
- Preferred scene-aware authored distance data where area graph position was stale.
- Added regression tests for the exact drawbridge prompt.

### Commit reported

- `4090a89`

### Verification reported

- `pnpm test` → 322 tests passed at that time.
- `npx tsc --noEmit` clean.
- `pnpm lint` clean.
- `pnpm build` clean.
- Exact prompt returned distance like “about 30 feet.”

### Remaining limitation

The deeper architectural issue remained: `currentAreaId` did not reliably advance with scene transitions, so authored scene-aware distance data was still used as a fallback.

---

## 3. “No tactical battle map is active” leaked into normal exploration questions

### Symptom

Player asked in Brindlehook:

```text
How far from me to the water
```

The app answered:

```text
No tactical battle map is active.
• No tactical battle map is active.
```

### Root cause

The live AI Director emitted a tactical spatial request for an ordinary exploration distance question. The engine correctly refused because no tactical battle map existed, but that refusal leaked into player narration.

### Expected behaviour

Normal distance/location questions should work in exploration scenes. If exact distance is unknown, the app should answer honestly using scene context:

```text
I don’t have an exact mapped distance to the water, but you are near the shore/boathouse lead...
```

It should not answer as if the user asked for a combat battlemap.

### Fix

Reported in Task 1:

- Added `isExplorationDistanceQuestion`.
- Added `extractSpatialTarget`.
- Added top-level distance handling in `deriveDmTurnFromInput`.
- Added alias handling:
  - water / shore / river
  - boathouse
  - dock / pier
  - drawbridge / gate / square / inn / keep / bell tower / trail
- Added system prompt guardrail:
  - Do not use tactical battle-map requests for normal exploration distance questions.
- Filtered internal tactical refusals from player narration echo in `page.tsx`.
- Added regression tests.

### Commit reported

- `b340349`

### Verification reported

- `exploration-distance.test.ts` — 13 tests.
- Full suite at that point: 410 tests.
- Typecheck/lint/build passed.

### Remaining limitation

Brindlehook still gives approximate/unknown answers because it does not yet have a full authored area/landmark distance graph.

---

## 4. Failed-action message could not be dismissed

### Symptom

A popup/status message said:

```text
That approach didn’t work this time, try another angle
```

There was no close button and no way to dismiss it.

### Expected behaviour

A non-critical status message should be dismissible and/or auto-dismiss.

### Fix

Reported in Task 2:

- Updated `FailedCheckRecovery.tsx`.
- Changed from blocking/sticky alert style to inline `role="status"`.
- Added close button with `aria-label="Dismiss message"`.
- Escape dismisses it.
- Auto-dismiss after about 6 seconds.
- New failed check can re-show it.
- Dismissal is local UI state only and does not mutate game state.

### Commit reported

- `c35c20c`

### Verification reported

- Added `failed-check-recovery.test.ts`.
- Full suite at that point: 413 tests.
- Typecheck/lint/build passed.
- Playwright baseline still passed: 12 e2e tests.

### Remaining limitation

The click/Escape/auto-dismiss behaviours were described as not fully DOM-tested due to no component DOM test environment; only pure visibility rule was tested.

---

## 5. `/play` desktop layout had awkward scrolling and cut-off controls

### Symptom

Desktop screenshots showed:

- page scroll, story scroll, and sidebar scroll competing
- input and suggested actions below the fold
- right panel cut off
- story box too large
- close/back control floating awkwardly

### Expected behaviour

A stable game app shell:

- main page fits viewport
- story/history scrolls internally
- composer stays reachable
- sidebar scrolls separately
- no weird floating close button

### Fix

Reported in layout pass:

- `page.tsx`: full-height app shell:
  - `h-[100dvh]`
  - `overflow-hidden`
  - `flex flex-col`
  - story owns scroll
  - composer pinned with `shrink-0`
  - sidebar gets own scroll
- `NarrationPanel.tsx`: removed fixed height, now `flex-1 min-h-0 overflow-y-auto`.
- `InputBox.tsx`: removed sticky/backdrop hack.

### Commit reported

- `6487b4d`

### Verification reported

- 348 tests passed.
- Typecheck/lint/build passed.

### Remaining limitation

Claude said no browser was available at that time, so visual verification was not done.

---

## 6. Mobile UI was cramped and controls overlapped

### Symptom

Mobile screenshots showed:

- title enormous
- Character / Export / DM View cramped
- Light Mode floating over header
- story panel tiny
- Send awkward
- suggested actions cut off
- audio player overlaying actions

### Expected behaviour

Mobile `/play` should be usable:

- compact title/header
- no floating Light Mode over content
- no floating audio over input/suggestions
- controls wrap cleanly
- story/input usable

### Fix

Reported in mobile pass:

- `ThemeToggle` got non-floating variant.
- Global floating theme toggle hidden on `/play`.
- Inline theme chip added to `/play` header.
- `AmbientAudio` changed from `fixed bottom-right` overlay to in-flow compact bar.
- Header chips made compact and wrapping.
- Mobile title changed to smaller/clamped style.
- Composer safe-area padding added.

### Commit reported

- `c49962f`

### Verification reported

- 379 tests passed.
- Typecheck/lint/build passed.

### Remaining limitations

- Not browser-verified by Claude.
- Input/Send not deeply redesigned.
- No full “More” overflow menu; chips wrap instead.

---

## 7. Map only worked in combat

### Symptom

The map/battlemap feature was only useful when a tactical battle map existed. Regular scenes showed little useful spatial information.

### Expected behaviour

The Map tab/button should be useful during normal scenes too:

- current area
- exits
- landmarks
- known actors
- basic movement suggestions

### Fix

Reported in exploration map pass:

- Added `src/lib/play/map-view.ts`.
- Added unified mode:
  - `combat`
  - `exploration`
  - `empty`
- `Battlemap.tsx` renders:
  - tactical grid in combat
  - exploration zone/node map outside combat
  - useful fallback if no map exists
- Exploration map can show:
  - current area
  - connected exits
  - distances
  - gated/locked exits
  - party/NPC chips
  - prompts
- Tapping exits/NPCs suggests commands only.

### Commit reported

- `2a20f1e`

### Verification reported

- Added `map-view.test.ts`.
- Full suite: 387 tests.
- Typecheck/lint/build passed.

### Remaining limitations

- Exploration map is zone/node cards, not a 2D grid.
- Some adventures still lack authored exploration graphs.
- No hidden/DM-only exploration overlays yet.
- Not browser-verified.

---

## 8. Combat battlemap foundation was invisible/player-inaccessible

### Symptom

The app had tactical/spatial battle-map logic, but not a player-facing rendered map.

### Expected behaviour

The player should be able to open Map and see a grid/tokens when battle map data exists.

### Fix

Two-phase map work:

#### Foundation

- `src/lib/play/battlemap-view.ts`
- `buildBattlemapView`
- `interpretCellTap`
- tested pure helpers

Commit reported:

- `d838224`

#### Player-facing component

- Added `src/components/play/Battlemap.tsx`.
- Wired Map into `/play`.
- Desktop: Character | Map sidebar tab.
- Mobile: Map header button opens drawer.
- Tapping cells/tokens suggests commands into input, not direct mutations.

Commit reported:

- `c775d48`

### Verification reported

- Full suite grew to 379 tests after later map/UI work.
- Typecheck/lint/build passed.

### Remaining limitations

- No drag/drop.
- No pan/zoom.
- Component rendering not DOM-tested.
- Browser visual verification still needed.

---

## 9. UI not flexible enough; wanted show/hide sections

### Symptom

Even after mobile improvements, the UI was busy. User wanted settings to show/hide UI parts, e.g. hide suggestions.

### Expected behaviour

A Display Settings panel should let the player hide optional UI sections and restore them.

### Fix

Reported Display Settings pass:

- Added `src/lib/play/display-settings.ts`.
- Added `src/components/play/DisplaySettingsPanel.tsx`.
- Added show/hide toggles for:
  - scene meta
  - mode pill
  - active character
  - turn number
  - narration
  - dice panel
  - suggested actions
  - Appeal DM
  - physical dice toggle
  - ambient audio
  - Character button
  - Map button
  - DM View button
  - Export button
  - Theme button
  - Back button
- Added compact mode.
- Added presets:
  - Full
  - Minimal
  - Combat
  - Story
- Settings persist in localStorage.
- Display opener and input cannot be hidden.

### Commit reported

- `cfd48e1`

### Verification reported

- Added `display-settings.test.ts`.
- Full suite: 397 tests.
- Typecheck/lint/build passed.

### Remaining limitations

- Not browser-verified.
- Compact mode only light-touch.
- No font-size/reduced-motion settings yet.
- Suggested actions still wrapping chips rather than horizontal scroll rail.

---

## 10. SKT campaign was assumed bigger than actual app content

### Symptom

There was confusion about whether the app could run all of Storm King’s Thunder.

### Finding

Only Chapter 1/Nightstone is actually authored/playable. The full campaign was not playable.

### Fix / Improvement

Added campaign data foundation:

- `CampaignDefinition`
- `CampaignChapter`
- transitions
- milestones
- quest flags
- knowledge facts
- SKT campaign scaffold for all canonical chapters
- validation tests

### Commit reported

- `300543a`

### Verification reported

- 356 tests after foundation.
- Typecheck/lint/build passed.

### Remaining limitations

- Campaign scaffold not fully wired into GameState/turn loop.
- Chapters 2–12 are scaffolds, not playable.
- No playable Chapter 2 vertical slice yet.
- No milestone levelling application yet.
- No overland resolver yet.

---

## 11. AI consistency was not tested enough

### Symptom

Most tests used deterministic mock/table-rules mode. Live AI Director consistency was not well covered.

### Fix / Improvement

Added deterministic contract harness:

- `src/test/ai-consistency-harness.test.ts`
- Tests structured AI-style outputs through real schema/validators.
- Checks invented movement, invented hits, monster HP contradictions, malformed requests.

### Commit reported

- `d838224`

### Verification reported

- +10 AI consistency tests.
- Full suite later passed.

### Remaining limitations

- Not live model testing.
- Need optional live smoke command and broader browser QA loop.

---

# Open / Not Yet Fixed Bugs

## 12. Nightstone compass directions are wrong

### Symptom

At the western drawbridge/gate, the app answered compass questions incorrectly.

Observed bad answers:

- North: damaged keep across the water.
- South: inner cart track to south village square.
- East: vague.
- West: road away.

### Why this is wrong

On the Nightstone map:

- Main entrance/drawbridge is on the west side.
- West is road back toward the Trade Way.
- East leads into the village interior.
- Nandar Keep is south/southeast across the water, not north.
- The app may be treating `south_square` as a compass direction instead of an area label.

### Status

Open. A prompt was written but no fix report has been received yet.

### Required fix

- Add explicit compass metadata to area graph connections.
- Do not infer direction from area ids.
- Correct Nightstone orientation.
- Add regression tests:
  - north does not say keep
  - east points into village
  - west points to road/Trade Way
  - south does not blindly map to `south_square`

### Suggested commit message

```text
Fix Nightstone compass directions
```

---

## 13. Direct dialogue is being misclassified as skill checks

### Symptom

Player said:

```text
I say "hello Elder Sarra"
```

The app made it an emotional-reading/Insight-type failure instead of letting Sarra respond.

Player asked:

```text
"Who are you?"
```

The app mixed unrelated trail narration and then narrated Sarra’s emotional response with another success/failure reading.

### Expected behaviour

Direct speech should be dialogue first. Skill checks should happen only if the player attempts something check-worthy.

### Status

Open. A prompt was written but no fix report yet.

### Required fix

- Improve dialogue intent handling.
- Separate dialogue from Insight/Persuasion/Deception/Intimidation.
- Ensure NPC answers direct questions.
- Add tests:
  - greeting Sarra does not trigger Insight
  - “Who are you?” receives relevant answer
  - explicit “read her emotions” can trigger Insight

---

## 14. Scene continuity contradiction: trail text injected during Sarra conversation

### Symptom

While talking to Elder Sarra, app inserted:

```text
Crushed ferns and wheel ruts lead north. Crows circle somewhere ahead.
```

This ignored current focus and contradicted the active interaction.

### Expected behaviour

The app should track active conversation/focus and not inject unrelated scene snippets unless the player moves/follows the trail.

### Status

Open.

### Required fix

- Track active NPC/conversation focus.
- Prevent unrelated scene text from overriding current dialogue.
- Add tests for Sarra conversation continuity.

---

## 15. Levitate state not tracked; height contradicted player action

### Symptom

Player cast *levitate* on Sarra.

The app said she was 5 feet up, then player said:

```text
I raise them the full 20 feet up off the ground
```

Then app answered:

```text
Elder Sarra is now about 10 feet off the ground
```

### Expected behaviour

If levitate succeeds, the app should track:

- target
- caster
- height
- max height
- duration
- concentration if supported
- saving throw if unwilling

After “full 20 feet,” height should be 20 feet, not 10.

### Status

Open.

### Required fix

- Add ongoing effects model.
- Add supported subset of levitate.
- Track height.
- Answer height questions from state.
- Resolve pronouns conservatively.

---

## 16. Level 1 wizard incorrectly has Level 2 spell slots

### Symptom

Character sheet showed:

```text
Level 1 Elf Wizard
Level 1 Slots 4/4
Level 2 Slots 2/2
```

A level 1 wizard should not have 2nd-level slots in normal 5e.

### Expected behaviour

Level 1 wizard should have only level 1 spell slots.

### Status

Open.

### Required fix

- Audit character templates.
- Remove level 2 slots from level 1 wizard.
- Reject level 2 spells like *levitate* unless character has legal slot/access.
- Add tests:
  - level 1 wizard has no level 2 slots
  - attempted levitate rejected at level 1
  - no slot decrement on illegal spell

---

## 17. Party creation uses one shared background for all characters

### Symptom

In Create Adventure / start flow, selecting multiple people only allows one background selection. That makes the whole party share a single background.

### Expected behaviour

Each party member should have their own:

- name
- class/template
- species/race if supported
- background
- possibly role/personality

### Status

Open. A prompt was written but no fix report yet.

### Required fix

- Add per-character creation selections.
- Start page party builder list.
- Each party member card gets own background selector.
- Preserve per-character backgrounds in GameState.
- Campaign facts should reflect individual backgrounds.
- Add tests:
  - multi-character party can choose Soldier/Scholar/Criminal independently
  - changing member 2 does not alter member 1
  - single-character flow still works

### Suggested commit message

```text
Improve party character creation backgrounds
```

---

## 18. Browser QA / automated self-playtest is not comprehensive enough

### Symptom

User is finding bugs manually in the browser, then asking Claude to fix them.

### Expected behaviour

The repo should have a browser QA loop that:

- starts the app
- opens in Playwright
- plays common flows
- asks natural-language questions
- detects known-bad phrases
- captures screenshots/traces
- fails with usable reports

### Current state

Some e2e exists and later reported:

```text
npx playwright test → 12 e2e passed
```

But there is no comprehensive browser playtest harness for all manually discovered bug classes.

### Status

Open.

### Required fix

Add tests for:

- mobile UI controls/no overlap
- exploration distance no tactical fallback
- map regular scene mode
- failed popup dismissible
- Display Settings hide/show suggestions
- Nightstone compass directions
- DM View safe by default
- natural-language fuzz smoke tests
- UI health invariants
- screenshot/trace reporting

### Suggested commit message

```text
Add automated browser playtest QA
```

---

# Larger Product Gaps Discovered

These are not one-off bugs, but important project gaps.

## 19. Full Storm King’s Thunder is not playable

### Current

- Chapter 1/Nightstone is authored.
- Chapters 2–12 are scaffolded, not playable.

### Needed

- Campaign framework wired into GameState.
- Chapter transitions.
- Milestone levelling.
- Quest flags.
- Player knowledge.
- Region/overland travel.
- Playable Chapter 2 vertical slice.
- Then author chapters progressively.

---

## 20. Campaign framework is scaffolded but not integrated

### Current

Campaign types/data/scaffolds exist, but docs/report said the system is not fully wired into the turn loop.

### Needed

- `GameState` campaign fields.
- Transition resolver.
- Milestone application.
- Quest/knowledge updates in engine/orchestrator.
- UI progress display.
- Migration for old sessions.

---

## 21. High-level 5e rules missing

### Missing or partial

- damage types
- resistance/vulnerability/immunity
- monster multiattack
- Huge/Gargantuan footprints
- saving-throw spells
- concentration
- reactions beyond opportunity attacks
- encumbrance/exhaustion
- inspiration/flanking if desired

### Needed

Implement one clean system at a time with engine tests.

Recommended priority:

1. Damage types + resistance/vulnerability/immunity.
2. Monster multiattack.
3. Huge/Gargantuan footprints.
4. Saving-throw spells.
5. Concentration.

---

## 22. Multiplayer seats not implemented

### Current

The app supports a party array, but not true player seats.

### Needed

- playerSeatId
- controlledCharacterIds
- activeControlledCharacterId
- turn ownership
- local/async foundation
- eventual invite/session sharing

---

## 23. Competitor-level “skin” still mostly missing

### Missing

- polished browser/mobile UX
- visual map polish
- campaign/session library
- worldbuilding generators
- character portraits
- TTS
- image generation
- share/invite links
- better onboarding
- accessibility settings

### Some foundation exists

- competitor gap roadmap
- battlemap view-model
- player-facing map
- display settings
- campaign scaffold

---

# Recommended Next Work Order

## Next 1: Finish open correctness bugs

1. Nightstone compass directions.
2. Direct dialogue/scene continuity.
3. Level 1 wizard spell slots.
4. Levitate/effect state or honest rejection.
5. Per-character backgrounds in party creation.

## Next 2: Browser QA agent loop

Add Playwright tests that permanently catch the bug classes above.

## Next 3: Campaign integration

Wire campaign scaffold into GameState and transitions.

## Next 4: High-value 5e rule system

Implement damage types/resistance/vulnerability/immunity.

## Next 5: Character creation overhaul

Improve start flow after per-background bug fix:

- party builder
- validation
- mobile layout
- clear solo/party modes
- quick party preset

---

# Suggested File Path for This Document

Add this document to the repo as:

```text
docs/bug-log-and-fix-history.md
```

# Suggested Commit

```bash
git add docs/bug-log-and-fix-history.md
git commit -m "Add bug log and fix history"
git push
```

---

# Quick Prompt for Next Session

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
