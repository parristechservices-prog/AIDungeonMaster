# Podcast Integration TODO

**Decision:** Add — excellent fit.  
**Status:** ✅ Core one-click podcast bank added 13 September 2026.
**Topic bank:** D&D, dungeon mastering, encounter design, improv, worldbuilding, RPG rules, actual-play discussion.

## TODO
- [x] Curate 25 Spotify episodes across D&D/DM topics in the shared JoshHub `dnd` bank.
- [x] Add a collapsed bottom dock: **🎲 Listen to a different D&D podcast**.
- [x] One tap selects/loads another episode; persist recent choices and avoid immediate repeats.
- [x] Use Spotify embed/deep links without assuming autoplay.
- [x] Tag episodes by DM advice, rules, encounters, improv, lore and worldbuilding.
- [x] Keep the dock out of live `/play` entirely, avoiding narration, ambient audio and immersive game-audio conflicts.
- [x] Keep gameplay state and adjudication controls primary.
- [x] Shared dock provides mobile/a11y, reduced-motion, selection and persistence behaviour; repo-specific automated tests can be added later.

## Implementation
The Next.js root layout loads the shared `dnd` bank only on `/`, `/start` and `/builder`. It is completely hidden on `/play`.
