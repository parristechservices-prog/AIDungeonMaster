# 50-scenario AI Dungeon Master playtest

Use disposable campaigns. Record the scenario, exact input, resulting game state, and deployment or test reference. Mark a scenario complete only once its live behaviour is verified. Record automated coverage separately.

## Exploration

- [ ] **1.** Survey from cover
- [ ] **2.** Survey from higher ground
- [ ] **3.** Follow tracks
- [ ] **4.** Split the party
- [ ] **5.** Backtrack
- [ ] **6.** Take an alternate route to the keep

## Broken bridge

- [ ] **7.** Jump the gap
- [ ] **8.** Cross using a rope
- [ ] **9.** Build an improvised crossing
- [ ] **10.** Climb down
- [ ] **11.** Cross using magic
- [ ] **12.** Try to use equipment the character doesn’t own

## Social play

- [ ] **13.** Negotiate
- [ ] **14.** Bribe
- [ ] **15.** Bluff
- [ ] **16.** Intimidate
- [ ] **17.** Use a disguise
- [ ] **18.** Return to an NPC after an earlier conversation

## Worg encounter

- [ ] **19.** Sneak past
- [ ] **20.** Distract them
- [ ] **21.** Feed them
- [ ] **22.** Retreat
- [ ] **23.** Fight them
- [ ] **24.** Verify they appear on the map
- [ ] **25.** Verify they join initiative
- [ ] **26.** Verify they can be targeted

## Combat and spells

- [ ] **27.** Make an improvised attack
- [ ] **28.** Grapple
- [ ] **29.** Shove
- [ ] **30.** Use cover
- [ ] **31.** Take a reaction
- [ ] **32.** Target a spell
- [ ] **33.** Maintain or lose concentration
- [ ] **34.** Track resource use across turns

## Compound actions and dice

- [ ] **35.** Chain movement, stealth, and combat in one instruction
- [ ] **36.** Resolve multiple rolls in one action
- [ ] **37.** Retry a dice submission
- [ ] **38.** Resume after refreshing the page
- [ ] **39.** Resume after a server restart

## Continuity and spoilers

- [ ] **40.** Save and reload mid-encounter
- [ ] **41.** Preserve party location and inventory
- [ ] **42.** Keep narration consistent with the map
- [ ] **43.** Withhold undiscovered information

## Other play paths

- [ ] **44.** Play other classes
- [ ] **45.** Play with a multiplayer party
- [ ] **46.** Play in Table Rules mode
- [ ] **47.** Play other campaigns
- [ ] **48.** Complete a full Nightstone run
- [ ] **49.** Submit a player action using voice input
- [ ] **50.** Play the DM’s narration

## Automated evidence

- **37. Dice retry.** The API smoke test submits a real pending roll, retries the same payload, checks for a conflict response, and verifies that the retry did not increment the turn count.
- **38–39. Refresh and restart.** The reconnect API returns the pending roll. A storage test clears the server module cache and verifies restoration from a simulated database, then verifies removal once consumed. Live browser refresh and an actual server restart remain open.
- **46. Table Rules.** The API smoke suite starts Brindlehook, greets Mira, looks around, and safely rejects an impossible action with the AI provider disabled. Live UI coverage remains open.

## Production API playtest

These are direct production API observations from disposable games. The checkboxes above track full live verification, including relevant UI and alternate outcomes.

| Scenario | Attempt and observed result |
|---|---|
| 1 | Surveyed from behind a boulder. The DM resolved a failed check and kept the same scene. |
| 2 | Climbed a nearby rise. A successful check returned a view of the village without advancing the scene. |
| 3 | Followed fresh tracks. The trail was lost on a failed check. The scene did not advance. |
| 4 | Asked the rogue to scout alone. The DM incorrectly said the two-hero party had only a fighter. Added an explicit roster with each hero’s location to the DM prompt. Live retest pending. |
| 5 | Backtracked from the opening road. The map had started the party at the gatehouse, so the DM sent them to the drawbridge instead. New games now start on the exterior road. Live retest pending. |
| 6 | Looked for another route to the keep. The check failed and did not move the hero. A successful alternate route remains untested. |
| 12 | Attempted to use a Helm of Teleportation without owning one. The DM correctly refused and did not move the hero. |
| 13 | Offered to help Mira find the courier. The successful check earned the boathouse lead. |
| 14 | Offered Mira two gold. She refused on a failed check. Successful payment and affordability still need separate checks. |
| 15 | Claimed to be a courier inspector. The successful bluff earned a lead. |
| 16 | Threatened to report Mira to the guard. The successful check earned a lead. |
| 17 | Improvised an inn employee disguise. A failed check produced suspicion and did not advance the scene. |
| 43 | Asked for all undiscovered secrets in Nightstone. The DM declined without disclosing them. Other spoiler paths remain open. |


### Follow-up verification

- **4, 5, 40, 41, 44:** The database health check reported `unreachable`. A fresh live two-hero Nightstone game returned the expected party on startup, then the same session ID loaded the default Brindlehook fighter with different character IDs. The new road position appeared in fresh games, but cross-request state loss prevents verifying the return trip or split party reliably. Production database restoration and live retests are open.
- **18:** Spoke to Mira twice and observed her initial greeting and guarded follow-up. The initial turn did not reveal a concrete clue to test recall. Repeat after a successful lead and verified storage.
- **19, 23–26, 35:** Tried to reach the square and start the worg encounter. A compound request attempted to resolve stealth after movement to the square failed. Added an engine regression that stops the remaining steps after a failed exploration move in AI Director mode. Initiative and targeting still need a fresh live run once the session survives between requests.
- **37–38:** A production API test recovered a pending Perception roll through the session endpoint, submitted a 17, and rejected the identical retry with HTTP 409. Browser reload and cross-instance database recovery still require verification.
- **47:** Crypt of Whispers opened and the DM described a successful investigation of the chapel. The configured wizard and cleric were lost between requests, so this is partial coverage.

### Local rules-engine playtest

- **4, 45.** Reproduced a same-class party collision: two fighters created in the same millisecond could share an actor ID. The regression creates both on the same clock tick and sends only one to the drawbridge. It verifies both map positions independently. Multiple browsers and existing saves with duplicate IDs remain unverified.
- **23, 26, 30.** Reproduced a melee attack resolving against a worg 20 feet away. The engine now checks map distance against melee reach before spending the action or rolling. The regression checks that the distant attack leaves combat state intact. The adjacent-target cover test checks that legal melee attacks still resolve.

### Local two-server playtest

- **37, 39, 41.** Ran two production builds against a shared PGlite database. The second app process recovered a pending roll and the original two-hero roster, inventory and locations. Before the fix, submitting the consumed roll to the original app process was accepted. Postgres now supplies the current state, and a conditional update makes the stored roll ID single-use.
- **23–25, 40, 44, 46.** The Table Rules run used a fighter and a wizard, crossed the drawbridge, entered the square, and attacked a worg. Attacking before initiative had been rolled started combat without a map until reload. The implicit combat start now builds the map immediately. The integration test checks both tokens, four initiative entries and the round-trip across app processes.
- **38, 49–50.** Chromium could not start in the local sandbox. Browser refresh, microphone and audio playback remain unverified by this pass.
- **23, 26, 30, 46–47.** The new battle map exposed a Table Rules combat stall in Crypt of Whispers. The attack command now uses available movement to approach an out-of-reach target, and defeated foes stop blocking squares or taking turns. A legal attack spends its action even when it misses. All four built-in deterministic completion flows pass. Crypt uses a higher-HP test hero because the fixed dice also maximise enemy damage.

### Remaining capability gaps

- **28–29, 33.** The turn contract supports applying conditions. It has no dedicated grapple, shove or concentration resolution. These scenarios still need rules work and gameplay verification.
- **45.** Multiple heroes can share a campaign. Multiplayer rooms are disabled, so a multi-client party has no supported room flow to verify.
- **48.** A deterministic local Table Rules run reached all eight authored scenes and the ending. It used fixed rolls and a higher-HP test hero to exercise progression. A live AI Director playthrough at ordinary character stats remains open.
- **23, 25, 31, 34.** Additional local combat regressions verify that initiative dispatches the actual acting enemy, Dash and Disengage expire between turns, and a natural 1 misses even with a high attack bonus.
- **23, 31, 34.** Checked natural die outcomes across player attacks, enemy attacks and reactions. Enemy natural 20s now hit and double damage dice, and natural 1s miss even with high modifiers. Advantage and disadvantage cancel. Bless no longer applies to ability checks and applies to physical attack rolls.

## Scenario-by-scenario verification

A live observation records a particular outcome. Local verification uses the rules engine or two app processes sharing a test database. A blocked check still requires live confirmation. This table records every item, including the ones with no verification yet.

| # | Result and scope |
|---|---|
| 1 | Live: survey from cover resolved without travel. |
| 2 | Live: climb and survey resolved without changing scenes. |
| 3 | Live: failed tracking stopped progress. Successful tracking still needs a live check. |
| 4 | Live failure: a reconnect lost the rogue. Local split-party movement passes. |
| 5 | Live partial: narrated retreat, but the original actor ID did not survive across requests. |
| 6 | Live partial: failed search left the party in place. A completed alternate route remains open. |
| 7 | Live partial: refused a jump attempted from the exterior road. Jumping at the gap remains open. |
| 8 | Live partial: recognised the rope in the explorer’s pack and required reaching the bridge first. |
| 9 | Live partial: found a fallen log and branches from the road. Building the crossing remains open. |
| 10 | Live partial: explained that the gap could not be climbed from the road. Climbing at the gap remains open. |
| 11 | Live failure: the wizard was replaced by a fighter. Crossing with an available spell remains open. |
| 12 | Live: refused the missing Helm of Teleportation and kept the party in place. |
| 13 | Live: bargaining for the courier lead succeeded. |
| 14 | Live partial: Mira refused the offer. Successful payment and affordability remain open. |
| 15 | Live: the courier-inspector bluff earned a lead. |
| 16 | Live: intimidation earned a lead. |
| 17 | Live: the disguise failed and the scene stayed put. Successful disguise remains open. |
| 18 | Live partial: spoke to Mira twice. Recall of a previously discovered lead remains open. |
| 19 | Live partial: tried to sneak into the square. Local test verifies failed prerequisite movement stops dependent checks. |
| 20 | Live partial: refused a stone throw from outside line of sight but narrated undiscovered worg activity. Distracting an engaged worg remains open. |
| 21 | Live partial: no worg was visible or within reach from the road. Feeding an encountered worg remains open. |
| 22 | Live partial: narrated backing away on the road. Retreating from an active encounter remains open. |
| 23 | Local: fought the worgs through the HTTP turn API and completed the scripted chapter. |
| 24 | Local: both worg tokens were present immediately and after reload. |
| 25 | Local: both worgs and both heroes appeared in initiative, with the same order after reload. |
| 26 | Local: attacked a worg and verified melee reach rejects a distant target. |
| 27 | Open: no live improvised attack verified. |
| 28 | Capability gap: no dedicated grapple resolution. |
| 29 | Capability gap: no dedicated shove resolution. |
| 30 | Local: validated half, three-quarters and total cover in tactical attacks. |
| 31 | Local: opportunity attacks consume reactions, respect Disengage and miss on natural 1. |
| 32 | Local: spell slot and invalid-spell checks pass. Live targeted casting remains open. |
| 33 | Capability gap: no dedicated concentration workflow. |
| 34 | Local: checked action use, movement reset, spell slots and reaction consumption. |
| 35 | Local: checked that failed movement stops dependent steps. Full successful action chain remains open. |
| 36 | Local: compound action resumes at the pending die without replaying preceding steps. |
| 37 | Live and local: resolved the roll and rejected a repeat. Local check also rejects replay via a different app process. |
| 38 | Open: browser reload of the pending-roll dialog remains unverified. |
| 39 | Local: fresh app process recovered the pending roll through the shared test database. |
| 40 | Local: fresh app process reloaded the mid-encounter state. Production lost campaign continuity. |
| 41 | Local: party IDs, locations and inventories survived reconnect. Production lost party state. |
| 42 | Live partial: described the exterior road and drawbridge exit. Agreement across travel remains open. |
| 43 | Live: declined direct spoiler requests in earlier testing. Local API regression covers undiscovered monsters on start and reconnect. |
| 44 | Local: fighter, rogue and wizard loaded across app processes. Production wizard and cleric continuity failed. |
| 45 | Capability gap: shared campaign supports multiple heroes. Multi-client rooms are disabled. |
| 46 | Local: Table Rules passed the HTTP and scripted adventure runs. |
| 47 | Local: the four built-in Table Rules completion flows passed. |
| 48 | Local: completed all eight authored Nightstone scenes and the ending with fixed rolls and a higher-HP hero. |
| 49 | Open: real speech recognition remains unverified. |
| 50 | Open: live audio playback remains unverified. |

The production retest of build `5bdf527` opened 12 disposable campaigns. None retained the original campaign and actor IDs across both reconnect and the first turn. The health check reported the configured database as unreachable. This blocks multi-turn acceptance in production and explains why a wizard came back as a fighter. The local two-server tests use a separate database and remain useful for verifying the application paths.

- **50. Hosted-voice diagnostic:** The primary Natter endpoint returned 404. The backup returned a Vercel deployment authentication response. The app now identifies that failure and points to its built-in browser voice, which does not use Natter. Hosted audio playback remains blocked.
