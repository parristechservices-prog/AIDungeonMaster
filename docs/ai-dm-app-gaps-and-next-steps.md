# DM-in-a-Box — Gaps, Flaws, and Next Steps

> **Accuracy note (2026-06-02):** This is an early critical planning document. Parts 1, 2, 3, and 5 remain useful product analysis. Part 4 is a historical scaffold prompt and does not match the current repo exactly: the app is now `partyquest-v0` inside `AIDungeonMaster`, uses Next.js 16, defaults to Groq chat-completions with optional comma-separated provider/key failover, has private module tooling, multiple character templates, local `.data` persistence, client snapshots, physical dice, tutorial scenario, recap export, and partial encounter balancing/canon summarization. For current remaining work, use `docs/todo.md`.

Companion to the project brief. This is the critical pass: what the first document missed, where its plan is fragile, what needs to be written before any real code is, and how to scaffold the V0 prototype.

---

## Part 1 — What's missing from the brief

These are real omissions, not just nice-to-haves. Roughly ranked by how much they'd hurt you if you skipped them.

### 1. Music and ambient audio
The brief is fixated on voice and forgot atmosphere entirely. A tavern scene with light hubbub and a lute in the background is not optional — it's half the immersion. You need an ambient layer: combat music, tavern, dungeon, exploration, downtime. Can be a curated royalty-free library tagged by mood, switched by the LLM via simple `<ambient:combat>` tokens.

### 2. The "appeal the DM" mechanism
The LLM will make wrong calls — rules misreadings, contradictions, unfair outcomes. Real DMs handle this with table conversation. The app needs a "wait, can we revisit that?" button that lets players raise a concern without breaking fiction. The DM should be system-prompted to take appeals gracefully and either retcon or explain its ruling. Without this, one bad ruling tanks the session.

### 3. Spatial reasoning in combat
The brief waved this off with "theatre of mind or simple grid." But spatial reasoning is one of the things LLMs are *worst* at. Tracking who's adjacent to whom, line of sight, area-of-effect overlap — the LLM will get this wrong constantly. Either the rules engine owns spatial state (positions on a grid, distances) and feeds it to the LLM, or you commit to theatre-of-mind with fuzzy spatial rules. Don't pretend the LLM can handle both.

### 4. The party-split problem
Players split up in fiction all the time: "I go to the library, you go to the inn." For a human DM this is a pacing problem. For an AI DM it's structurally hard — who is the DM talking to? Whose turn is it to act? The brief assumes the party is together. It often isn't. Solutions: require players to be in the same scene (a constraint, but not a bad one), or alternate scenes explicitly ("we'll cut between groups"), or actually run parallel scenes on different parts of the screen.

### 5. Whispers, secrets, and PvP-adjacent play
Player A wants to pick player B's pocket. Player A wants to lie about their backstory. Player A is secretly a cultist. None of this works in a fully shared channel. The app needs private DM-to-player communication: secret rolls, whispers, asides. Without this, the social texture of D&D collapses to "everyone tells the truth all the time."

### 6. Accessibility — specifically deafness
The DM's main channel is voice. Deaf or hard-of-hearing players will not have a viable experience without text transcripts of every DM utterance, rendered prominently. Not a settings toggle — a first-class feature. Same applies to screen-reader support for blind players (where audio actually becomes an advantage, but the player sheet UI must be readable).

### 7. Network drops and AFK handling
Real sessions involve snack breaks, bathroom trips, kids interrupting, lost wifi. The brief assumes everyone is engaged all the time. You need: graceful reconnect (player phone reloads and finds the session), AFK detection ("Sylvie's gone quiet for 3 minutes, skip her turn or wait?"), and a way for the host to pause the whole session without losing state.

### 8. Encounter and content balancing
Who builds the goblin ambush? If the LLM does, balance will be all over the place. Encounter math (CR vs party level) is a known formula — let the engine generate balanced encounters from a monster library, and let the LLM dress them with flavour. Same for treasure, magic items, NPC stat blocks. LLM picks the flavour, engine enforces the numbers.

### 9. Long-context drift
A 4-hour session generates more text than fits in any context window. The brief mentioned summarisation but didn't address how summarised content interacts with new content. The DM will eventually contradict an earlier scene because it summarised away the key fact. Mitigation: an append-only "canon log" of facts the DM has stated as true, fed back into every prompt, with explicit instructions to check against it before introducing new world facts.

### 10. The cold-start UX
First-time users open the app and have no idea what to do. They've maybe never played D&D. The brief skipped this almost entirely. There needs to be a guided first-session mode: simplified characters, on-rails opening, scaffolded prompts ("Try saying: I attack the goblin"). Most users will quit if the first 5 minutes don't show them what to do.

### 11. Music's evil twin: silence handling
Voice apps fall apart when nobody speaks. The LLM finishes narrating, players are thinking, 15 seconds of dead air pass. The app needs gentle nudges: a soft "What do you do?" prompt after silence, or table-tone suggestions ("Anyone want to investigate the door?"). Pacing is a real product concern.

### 12. Real dice vs digital dice
Some players will *want* to roll their own physical dice and tell the app the result. Trust is a feature, not a bug. The app should support both: digital roller (animated, fair) and "I rolled a 17" manual entry. Phone dice rolls feel dead after the first session.

### 13. DM personality and continuity
The brief treats the DM as a faceless narrator. But part of what makes a real DM great is voice — dry, theatrical, playful, mean. The app should pick a DM persona at campaign start and stick with it across sessions. Players should feel like *their* DM is back when they return, not a fresh instance.

### 14. Localisation and Australian English
You're in Australia. The DM defaulting to American English ("sword on the dais") versus something more neutral matters less than you'd think, but it's still worth tagging as a known limitation. Multi-language is a V3 problem.

### 15. Analytics and observability
You can't improve what you can't measure. From day one: session length, drop-off points, "fun proxy" metrics (player utterance frequency, laughter detection if you want to get fancy, return rate to next session). Without this you're guessing whether changes help.

### 16. Prompt versioning
The DM is fundamentally a prompt (or a stack of them). You will iterate on it dozens of times. Without prompt versioning, an eval set, and rollback, you'll break things you didn't realise were working. Treat prompts like code.

### 17. Per-user cost caps
Without budget caps, one user with insomnia can rack up $200 of API costs in a weekend. Need hard ceilings per user per period, with graceful "you've hit your limit" messaging.

### 18. Host succession
Host has special powers. Host's phone dies mid-session. Now what? Need automatic host transfer to another player, or session-pause until host returns.

### 19. Crafting, downtime, and weird player asks
"I want to spend a week brewing potions." "Can I bribe the guard with a magic item?" "I cast Detect Thoughts on the king." 5e has loose rules for half of this. The engine can't enforce what isn't codified. Solution: a clear escalation path — if the engine doesn't know, the LLM rules, and the players can appeal.

### 20. Custom mechanics and house rules
Some tables play with max-damage criticals, inspiration as a metacurrency, custom resting rules. A minority feature but a deeply emotional one for D&D enthusiasts. Worth a checkbox list of common house rules even at MVP.

---

## Part 2 — Flaws in the plan and how to fix them

### Flaw 1 — The rules engine is bigger than it looks
Building a full 5e rules engine is genuinely months of work. Hundreds of spells, hundreds of conditions, edge cases everywhere. The brief made it sound like a weekend module.
**Fix:** Don't build the full thing. Define a "core engine" surface — HP, AC, attack rolls, saving throws, spell slots, basic conditions, action economy, rest mechanics. Everything else is "DM ruling" handled by the LLM with engine-validated outputs (damage applied via engine even if the spell came from LLM judgement). Lean on open-source 5e data sources for spell/monster JSON, don't transcribe from PDFs.

### Flaw 2 — The voice latency budget was optimistic
1.5–3.5 seconds end-to-end is achievable in benchmarks, not in real-world cold starts. Realistic is 4–7s, and users will *feel* every second.
**Fix:** Aggressive streaming (start TTS before LLM finishes), "DM thinking" filler audio (a thoughtful "Hmm…"), pre-loading the LLM context before the player even finishes speaking, and accepting that text input will always feel faster than voice for impatient players.

### Flaw 3 — "Begin" is a much harder moment than it sounds
Cold-starting a campaign means generating world flavour, opening NPCs, an inciting scene, three plot hooks. That's a multi-thousand-token LLM call that will take 10–30 seconds. Players will stare at a loading screen.
**Fix:** Pre-generated campaign skeletons. The LLM customises an existing structure rather than inventing from scratch. Show generated content progressively (region first, then town, then opening scene) so something is on screen within 2 seconds.

### Flaw 4 — PWA on iOS is unreliable for the things you need most
Microphone access, persistent audio, background processing — Safari PWAs are notoriously janky here. The brief was too breezy about this.
**Fix:** Test on iOS Safari from week 1. If audio is flaky, plan for a thin native iOS wrapper (Capacitor) earlier than V2. Don't discover this six months in.

### Flaw 5 — "The ability to say no" was a wish, not a system
The brief said the DM must be able to enforce limits. It didn't say how.
**Fix:** Make this an architectural principle. The rules engine returns hard, structured results ("0 slots remaining," "out of range," "not your turn"). The LLM is system-prompted to *never* override engine results — only narrate them. Same for safety: a post-generation content classifier checks every DM utterance against session 0 settings before it's spoken; failures trigger regeneration with a tightened prompt. Both of these need to be code, not vibes.

### Flaw 6 — Session 0 settings aren't real-time enough
Groups don't always think about every content area upfront. Things come up.
**Fix:** Add an in-session preference panel any player can open. "Lower the violence." "No more horror." "More puzzles." Updates the active system prompt mid-session. The X-card is one specific lever; this is the general one.

### Flaw 7 — The cost model was rosy
Per-session API cost of $2–15 assumed average usage. Power users will be 3–5× that. With a $9.99/mo subscription and 5 sessions/month for a power user, you're underwater on every customer.
**Fix:** Tiered model with hard caps. Free tier capped at one short session. Paid tier capped at, say, 20 hours of voice play per month. Above that, top-up packs. Build cost monitoring on day one. Treat compute cost like physical inventory.

### Flaw 8 — "Hybrid LLM + rules engine" was named but not designed
The brief identified this as the most important architectural decision but didn't actually describe the interface between the two systems.
**Fix:** This needs its own document (see Part 3). At minimum: every player turn flows engine → LLM → engine. Engine validates the action is legal, LLM narrates the attempt, engine resolves the mechanical outcome, LLM narrates the result. Engine is always the gate at both ends.

### Flaw 9 — No eval framework
The brief said "playtest." That's not a plan.
**Fix:** Build a regression suite of scenarios — "player tries to attack a wall," "player casts Fireball at three goblins," "player tries to seduce a dragon," "player runs out of spell slots and tries to cast anyway." Run them against every prompt change. Track pass/fail. This is your tripwire when a prompt change quietly breaks the engine handoff.

### Flaw 10 — The roadmap was too generous to itself
V1 in 3–6 months part-time, with multiplayer rooms, voice DM, save/resume, session 0, X-card, four classes, three races — that's an experienced full-stack indie team's six months, not a part-time solo build.
**Fix:** V0 should be smaller than the brief said. See Part 4 below for what "actually achievable as a first build" looks like.

---

## Part 3 — Documents needed before MVP coding

Don't write code yet. These docs save you from rewrites later. Roughly in priority order.

### 3.1 Rules engine technical spec
The most important document. Defines:
- Data model (Character, Monster, Spell, Item, Encounter, Action, Condition)
- The public API surface (`attackRoll(attacker, target, weapon)`, `castSpell(caster, spell, targets)`, etc.)
- What's in scope (HP, slots, action economy, conditions, rest) and what's explicitly out (homebrew crafting, complex environmental hazards)
- How the engine and the LLM exchange information (structured JSON in, structured JSON out)

### 3.2 DM system prompt design doc
The actual prompts:
- Core DM persona prompt (with variants for tone settings)
- Intent classifier prompt
- Skill check adjudicator prompt
- Narrator prompt (the one that produces final spoken output)
- Safety / post-generation classifier prompt
- Versioning convention from day one (`v0.1`, `v0.2`, etc., with a changelog)

### 3.3 Session 0 and safety taxonomy
- Specific list of content domains (violence, body horror, romance, substance use, animal harm, religious content, sexual content, death of characters, etc.)
- Default levels for each
- The X-card mechanic specified
- How safety state is enforced (passed into every prompt; checked on output)

### 3.4 Data model and schema
- Postgres schema for Users, Characters, Campaigns, Sessions, Rooms, Turns, Messages
- The shape of the canon log
- Session state vs character state vs campaign state — where does each live?

### 3.5 Voice pipeline architecture
- Detailed sequence diagram: player speaks → STT → intent classifier → engine validates → LLM narrates → safety check → TTS → playback
- Latency budget per step
- Streaming strategy
- Failure modes (STT mis-hears, LLM stalls, TTS errors)

### 3.6 V0 feature spec — narrow, ruthless
What's actually being built first. Specifically:
- What's in (e.g. solo player, text-only, one combat, one social, one exploration encounter, level 3 pregen Fighter)
- What's out (everything else)
- What "done" looks like

### 3.7 Cost model spreadsheet
Real numbers, not vibes:
- Tokens per session for each model option
- TTS chars per session at average pace
- STT minutes per session
- Three pricing scenarios (cheap voices, mixed, premium)
- Break-even per user per tier

### 3.8 Playtest protocol
- How you find playtesters
- Scenarios you ask them to run
- What you observe (drop-off, confusion, laughter, frustration)
- The structured debrief questions

### 3.9 Legal compliance checklist
- SRD 5.1 / 5.2 attribution where required
- Trademark exclusions audit
- TOS draft outline (key clauses)
- Privacy policy outline (voice data, retention, deletion, GDPR + AU Privacy Act)
- Age gating decision

### 3.10 UX wireframes for the critical screens
Don't need Figma. Even paper sketches are fine. Critical screens:
- Lobby (host + player)
- Character creation flow
- Mobile character sheet
- Combat HUD
- Settings / safety panel

If you skip the wireframes, you'll build the wrong layout and have to redo it once a real player sees it.

---

## Part 4 — Codex Prompt 1: scaffolding the V0

This is what you paste into Codex/Copilot in a fresh VS Code workspace to set up the bones. It assumes WSL Ubuntu, Node 20+, your usual Vercel/GitHub Pages deployment habits.

The V0 it scaffolds: a single-player, text-only, web-based 30-minute D&D one-shot. No multiplayer. No voice. No accounts. Just enough to prove the hybrid engine-plus-LLM model is fun.

```
Scaffold a Next.js 14 web app called "dm-in-a-box-v0" with the following architecture and structure. This is a single-player, text-only proof-of-concept for an AI Dungeon Master. The architectural bet is a HYBRID system: a deterministic TypeScript rules engine owns all mechanical state (HP, dice, slots, conditions), and an LLM owns narration, NPC dialogue, and fuzzy intent interpretation. The LLM never tracks numbers; the engine never writes prose.

PROJECT SETUP

- Next.js 14, App Router, TypeScript strict mode
- Tailwind CSS, shadcn/ui
- ESLint + Prettier configured
- pnpm as package manager
- .env.example with OPENAI_API_KEY and ANTHROPIC_API_KEY placeholders
- README.md explaining the hybrid architecture and how to run locally

FOLDER STRUCTURE

/app
  /page.tsx               -- landing, "Start a one-shot"
  /play
    /page.tsx             -- the main play loop screen
  /api
    /turn/route.ts        -- POST endpoint: takes player input, returns DM response
/lib
  /engine                 -- the rules engine. PURE TYPESCRIPT. No AI calls in this folder.
    /types.ts             -- Character, Monster, Spell, Item, Action, Condition, EncounterState
    /character.ts         -- character creation, HP, AC, level mechanics
    /dice.ts              -- d20, advantage/disadvantage, damage rolls (deterministic, seedable)
    /combat.ts            -- attackRoll(), savingThrow(), applyDamage(), initiative
    /skills.ts            -- skill check resolution with DC
    /spells.ts            -- spell slot tracking, cast validation (no actual spell effects yet)
    /encounter.ts         -- encounter state, turn order, action economy
    /index.ts             -- public surface
  /llm                    -- the narrator. ALL AI CALLS LIVE HERE.
    /client.ts            -- thin wrapper over OpenAI/Anthropic SDK (configurable)
    /prompts
      /dm-system.ts       -- the core DM persona prompt
      /intent-classifier.ts
      /skill-adjudicator.ts
      /narrator.ts
    /orchestrator.ts      -- the brain: routes player input -> engine -> LLM -> response
  /game
    /pregens.ts           -- one pre-built level-3 Fighter character to start
    /one-shot.ts          -- a hardcoded short adventure: 1 social, 1 exploration, 1 combat
    /session.ts           -- session state management (in-memory for V0)
/components
  /play
    /Narration.tsx        -- DM text display
    /InputBox.tsx         -- player text input
    /CharacterSheet.tsx   -- side panel with HP, AC, spell slots, inventory
    /DiceRoller.tsx       -- animated dice with manual-entry fallback
    /CombatHUD.tsx        -- turn order, action economy display
/data
  /spells.json            -- subset of SRD spells (start with ~20)
  /monsters.json          -- subset of SRD monsters (start with ~10, levels 1-5)
  /classes.json           -- Fighter only for V0

KEY IMPLEMENTATION NOTES

1. The engine module must be pure: same inputs always produce same outputs. Mock the random seed for tests. Every engine function returns a structured result, never narrative prose.

2. The LLM orchestrator follows this flow on every player turn:
   a. Classify intent (action, dialogue, exploration, OOC question)
   b. If mechanical, validate against engine (can player do this? legal action?)
   c. If engine says no, narrate the refusal
   d. If skill check needed, engine rolls dice, LLM narrates outcome
   e. If combat action, engine resolves mechanics, LLM narrates flavour
   f. Return structured response: {narration, engineEvents[], sheetChanges}

3. The DM system prompt MUST include explicit instructions: "Never invent HP, AC, dice rolls, or spell slots. Use only values provided by the engine in context. If the engine result says a player has 0 HP remaining, the player has 0 HP."

4. Build a regression test suite from day one in /tests/scenarios. Each scenario is a sequence of player inputs and expected engine state changes (not exact wording — assert structure, not prose).

5. The one-shot adventure should be a 30-minute experience: arrival at a remote inn (social), investigating a missing person (exploration), a single goblin ambush combat (combat), resolution. Hardcoded scene structure with LLM-generated flavour.

6. Include a "/api/turn" endpoint that takes {sessionId, playerInput} and returns {narration, sheetUpdates, options}. Use server actions where appropriate.

7. README must include:
   - The hybrid architecture diagram
   - "Why the engine never narrates and the LLM never tracks numbers"
   - How to run a regression test
   - Deployment steps for Vercel

8. Do NOT scaffold: multiplayer, websockets, voice, auth, persistence beyond in-memory, image generation. These are explicitly out of V0 scope.

9. Set up a /CHANGELOG.md and commit history convention. Prompts are versioned (v0.1, v0.2) in /lib/llm/prompts with a header comment explaining what changed.

10. Initial commit message: "scaffold v0: hybrid engine + LLM narrator, solo one-shot"

When scaffolding is done, the dev experience should be: pnpm install, set OPENAI_API_KEY in .env, pnpm dev, navigate to localhost:3000, click "Start one-shot," and play through a 30-minute solo adventure with text-only input and output.
```

That's the prompt. Paste it whole. Codex will likely produce 60–80% of what's described and fudge the rest — iterate from there. The most important thing it gives you is the *folder structure*, which forces the architectural separation. If the engine and LLM live in the same folder, they'll bleed into each other within a week.

---

## Part 5 — The order to work in

A pragmatic sequence:

1. **Write the V0 feature spec** (3.6) — one page. What's in, what's out, what "done" looks like.
2. **Sketch the rules engine spec** (3.1) — even rough. Forces you to commit to scope.
3. **Draft the DM system prompt** (3.2) — even just v0.1. You'll iterate it forever.
4. **Run the Codex scaffold prompt above**
5. **Stub the LLM responses with hardcoded text first** — get the engine + UI loop working before you spend a cent on tokens
6. **Wire in the real LLM** — start with the cheapest model, only upgrade when quality is the blocker
7. **Play through your own one-shot 10 times** — find every place it falls apart
8. **Then** invite one trusted person to play it
9. **Then** worry about voice, multiplayer, accounts, all of it

The brief promised an epic. This sequence delivers a 30-minute proof. If the 30-minute proof is fun, the epic is worth building. If it isn't, nothing else matters.
