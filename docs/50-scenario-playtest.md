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
- **38–39. Refresh and restart.** A pending dice prompt currently lives in browser component state and server process memory. Recovery across a refresh or process restart remains open.
- **46. Table Rules.** The API smoke suite starts Brindlehook, greets Mira, looks around, and safely rejects an impossible action with the AI provider disabled. Live UI coverage remains open.
