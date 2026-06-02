After the recent round of implementations, here is the prioritized list of what is still left to do to complete the vision outlined in the documentation:

**Core Game Mechanics (High Priority)**
- **Tactical Spatial Combat Grid**: The biggest missing mechanical piece. Currently, combat is "theater of the mind." We need a 2D grid to track positioning, movement, and area-of-effect spells (like *Fireball*).
- **Conditions & Status Effects**: While narrated, we need the [rules engine](file:///c%3A/Users/joshu_w0zb8cp/Projects/AIDungeonMaster/src/lib/engine/index.ts) to mathematically enforce effects like *Prone* (disadvantage on attacks), *Restrained* (0 speed), or *Blinded*.
- **Expanded Spell Library**: We've added 3 spells, but we need to model the unique logic for another 20–30 core SRD spells (e.g., *Shield*, *Bless*, *Guiding Bolt*) so the engine can handle their specific math.

**Infrastructure & Quality (Medium Priority)**
- **Prompt Versioning & Eval Framework**: We need a formal system to track versions of the [system prompt](file:///c%3A/Users/joshu_w0zb8cp/Projects/AIDungeonMaster/src/lib/llm/system-prompt.ts) and run "eval" tests to ensure new updates don't make the DM less accurate or more repetitive.
- **Durable Session Persistence**: Currently, sessions are saved to local storage or session storage. We need a backend database (like Vercel KV or Postgres) so players can resume their adventure on any device.
- **Real Ambient Audio Playback**: The UI shows the "Mood," but we need to integrate actual royalty-free audio loops that crossfade when the DM changes the scene atmosphere.

**Multiplayer & Social (Long-term)**
- **Multiplayer Session Support**: Implementing WebSockets for real-time group play, including room codes and automated turn tracking for multiple players.
- **DM "Whispers"**: A way for the AI DM to send secret information or hidden checks to a single player in a group.

**User Experience (Polish)**
- **Mobile Layout Optimization**: Improving the [PlayPage](file:///c%3A/Users/joshu_w0zb8cp/Projects/AIDungeonMaster/src/app/play/page.tsx) for phone screens, specifically a "Character Sheet" drawer and sticky input bar.
- **Cost Controls & Rate Limiting**: Implementing daily token caps per user/IP to prevent API budget drain.

You can find the full detailed breakdown of these remaining tasks in [full-improvement-plan.md](file:///c%3A/Users/joshu_w0zb8cp/Projects/AIDungeonMaster/docs/full-improvement-plan.md).