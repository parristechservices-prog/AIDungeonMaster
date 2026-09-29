# Podcast Integration TODO

**Decision:** Remove podcasts to keep game startup responsive.

**Status:** Removed 29 September 2026 after a loading freeze in the shared launcher.
**Topic bank:** D&D, dungeon mastering, encounter design, improv, worldbuilding, RPG rules, actual-play discussion.

## Historical implementation (removed)
- [x] Curate 25 Spotify episodes across D&D/DM topics in the shared JoshHub `dnd` bank.
- [x] Add a collapsed bottom dock: **🎲 Listen to a different D&D podcast**.
- [x] One tap selects/loads another episode; persist recent choices and avoid immediate repeats.
- [x] Use Spotify embed/deep links without assuming autoplay.
- [x] Tag episodes by DM advice, rules, encounters, improv, lore and worldbuilding.
- [x] Keep the dock out of live `/play` entirely, avoiding narration, ambient audio and immersive game-audio conflicts.
- [x] Keep gameplay state and adjudication controls primary.
- [x] Shared dock provides mobile/a11y, reduced-motion, selection and persistence behaviour; repo-specific automated tests can be added later.

## Implementation
The root layout no longer loads either the shared podcast launcher or dock on any route. The launcher observed subtree child-list changes and unconditionally rewrote its own button text from the observer callback, creating a self-triggering mutation loop. Do not restore the integration without fixing that loop and verifying responsive startup and navigation in a browser.
