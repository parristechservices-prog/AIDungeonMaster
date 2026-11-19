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
