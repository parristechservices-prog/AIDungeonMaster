# PartyQuest V0 - Pre-Coding Decision Register

**Date:** 12 May 2026  
**Owner:** Josh Parris  
**Project:** PartyQuest  
**V0 repo/app:** `partyquest-v0`  
**Internal codename:** DM-in-a-Box  
**Status:** Historical pre-coding decisions; superseded where code and newer docs differ

> **Accuracy note (2026-06-02):** This document records the decisions before the first scaffold. It is useful design history, but it is not a current implementation inventory. The current repo is `AIDungeonMaster`, uses Next.js 16, defaults to Groq chat-completions with optional comma-separated provider/key failover, supports multiple character templates/party setup on one device, writes local sessions under `.data/`, uses client snapshots, and includes private module tooling. Use `README.md` and `docs/todo.md` for current behavior and roadmap.

## Executive decision

Start coding **V0 only**: a solo, browser-only, text-only, deterministic-rules + AI-narrator proof of concept.

Do **not** build the full multiplayer voice product yet.

The governing principle is:

> **The engine owns truth. The AI owns words. The event log records everything.**

V0 succeeds if one person can open a browser, click **Start**, play a coherent 30-minute fantasy one-shot with a pre-generated level-3 Fighter, complete one social scene, one exploration scene, and one combat, and come away thinking: "that was actually fun."

---

## 1. Frozen decisions

| Area | Decision | Implementation implication |
|---|---|---|
| Product name | **PartyQuest** | Use this in UI title, README, repo description, and docs. |
| V0 repo/app name | **partyquest-v0** | Create repo as `partyquest-v0`. Package name should also be `partyquest-v0`. |
| Internal codename | **DM-in-a-Box** | May appear in docs, not as final product branding. |
| Product type | AI-assisted fantasy tabletop RPG app | Avoid official D&D branding in public-facing names. |
| V0 scope | Solo, browser-only, text-only one-shot | No voice, multiplayer, accounts, maps, campaign memory, or character creation. |
| Architecture | Hybrid deterministic engine + LLM narrator | Engine and LLM modules must be physically separated. |
| Rules truth | Engine only | LLM never mutates HP, AC, dice, spell slots, conditions, initiative, inventory, or death saves. |
| AI role | Narration, NPC dialogue, intent interpretation, fuzzy adjudication | AI can propose actions/checks; engine validates and resolves. |
| LLM provider | **Historical target: OpenAI Responses API** | Current code defaults to Groq chat completions and can try a comma-separated provider list such as `groq,openai`. |
| Primary model | **Historical target: `gpt-5.4-mini`** | Current defaults are `llama-3.3-70b-versatile` for Groq and `gpt-4o-mini` for OpenAI unless env vars override them. |
| Fallback model | **Historical target: none in code** | Current code falls back from Groq/OpenAI failures to the table-rules mock DM. |
| JSON contract | Strict structured JSON schema | Current implementation uses chat-completions JSON mode plus Zod validation, not OpenAI Responses structured outputs. |
| Framework | Next.js App Router + TypeScript | Use current stable Next.js at scaffold time, but keep the source layout from this document. |
| Package manager | pnpm | Agents should not introduce npm/yarn lockfiles. |
| Test runner | Vitest | Engine tests must run without hitting the LLM. |
| Runtime validation | Zod | All LLM outputs are parsed through Zod before engine dispatch. |
| Styling | Tailwind CSS | Keep UI simple and legible; no component-library dependency required for V0. |
| State | Historical target: in-memory session state | Current local dev writes `.data/session-*.json`; Vercel remains process memory; the client stores a `localStorage` snapshot. |
| Dev logging | JSONL dev logs | Server-side orchestrator writes local JSONL logs in dev only. |
| Deployment | Vercel after local playthrough works | Do not deploy until engine + stubbed UI pass tests locally. |
| Legal source | SRD 5.2.1 / CC-BY-4.0-compatible mechanics + original setting flavour | No official settings, official adventures, official art, official maps, or non-SRD trademarked content. |
| Adventure format | TypeScript module | Put hardcoded one-shot in `lib/game/one-shot.ts`, not Markdown or JSON. |
| Pregen format | TypeScript seed data | Put one Fighter in `lib/game/pregens.ts`. |
| Monster format | TypeScript seed data | Put V0 monsters in `lib/game/monsters.ts`. |
| Combat positioning | Theatre-of-mind only | No grid, no distance counting, no AoE, no cover, no line of sight. |
| Position tags | None in engine | LLM may describe distance qualitatively; engine ignores it. |
| Action economy | Enforced for action and bonus action | Movement is flavour-only in V0. |
| Class features | Explicit `use_feature` request | Player says "use Second Wind" -> LLM emits `use_feature` -> engine resolves. |
| Hidden monster HP | Hidden from narrator | Narrator receives HP bands only: unhurt, scratched, wounded, bloodied, near death, down. |
| Critical hits | Engine returns `critical: true` | LLM narrates flavour only. |
| Rest mechanics | Not reachable in V0 | Keep `rechargeOn` metadata, but no rest UI or rest request in V0. |
| Spell slots | Placeholder only | Fighter has no spellcasting. No spell action API in V0. |
| Safety | Prompt + output validator | No full Session 0 UI yet. V0 still blocks unsafe or out-of-tone narration. |
| Cost cap | AUD $20 dev cap | Set provider dashboard budget manually and log estimated per-turn usage. |
| Playtest gate | 10 Josh runs + 5 outside players | Do not add voice/multiplayer until at least 3 of 5 outside players say it was fun enough to replay. |

---

## 2. Project identity and repo

### Final naming hierarchy

- **Product / public name:** PartyQuest
- **V0 repo/app:** `partyquest-v0`
- **Internal codename:** DM-in-a-Box
- **First adventure title:** The Last Lantern at Brindlehook Inn

### Repo location decision

Create a new GitHub repo:

```txt
joshualparris/partyquest-v0
```

Do not build this inside an existing unrelated project. This project needs clean separation because multiple coding agents will touch it.

### Branding rule

Public UI copy should say **PartyQuest**, not D&D, not Dungeon Master, not 5e, and not any official setting name.

Internal docs may say "AI DM" or "DM-in-a-Box" as shorthand, but public-facing language should be legally cautious:

- "fantasy tabletop RPG"
- "game guide"
- "narrator"
- "rules engine"
- "one-shot adventure"

---

## 3. Legal and content rules

### Legal decision

V0 uses **SRD 5.2.1 / Creative Commons-compatible rules material** and original adventure content only.

### Explicitly forbidden in V0

Do not include:

- D&D in product names, repo names, metadata, landing page copy, or marketing copy
- Forgotten Realms, Faerun, Waterdeep, Baldur's Gate, Neverwinter, Greyhawk, Eberron, Planescape, Ravenloft, Dragonlance, Spelljammer, or other official settings
- Beholders, mind flayers, displacer beasts, owlbears, or other non-SRD / protected monsters unless verified as permitted
- Official adventures, maps, boxed text, NPCs, named locations, or art
- Official D&D Beyond assets or content scraped from commercial products

### Allowed

- Original fantasy setting names and NPCs
- Generic fantasy creatures permitted in the SRD, once verified before inclusion
- Mechanics expressed in original words
- Engine-owned numeric stat blocks written as seed data

### Source notes

- Wizards of the Coast's SRD page states that SRD v5.2.1 contains rules content creators can use and reference under Creative Commons, and lists English SRD v5.2.1 as published 1 May 2025 with the page last updated 2 March 2026.
- The provider and pricing notes below were pre-coding research notes. They are not maintained as current pricing or model availability claims.

---

## 4. V0 scope freeze

### In scope

V0 includes exactly:

1. Browser web app.
2. Single player.
3. Text input and text output.
4. One pre-generated level-3 Fighter.
5. One hardcoded 30-minute one-shot.
6. Three scenes: social, exploration, combat.
7. Deterministic TypeScript rules engine.
8. LLM narrator via server-side API call.
9. Visible dice results and mechanical breakdowns.
10. Character sheet side panel.
11. Combat HUD when initiative is active.
12. Engine tests and scripted scenario tests.
13. Dev-only event/LLM logging.
14. README + root agent instructions.

### Out of scope

Do not build:

- Multiplayer
- Room codes
- WebSockets
- Voice input
- Text-to-speech
- Accounts
- Billing
- Persistent campaigns
- Database
- Character creation
- Levelling
- Maps
- Grid combat
- Image generation
- Adventure generation
- Full monster catalogue
- Full spell catalogue
- Mobile native wrapper
- Session 0 wizard
- Analytics dashboard
- Homebrew support
- VTT features

### Scope rule for agents

If a task would require a database, WebSocket, audio model, map renderer, account system, or full rules catalogue, it is not V0.

---

## 5. Technology stack

### Chosen stack

```txt
Next.js App Router
TypeScript
pnpm
Tailwind CSS
Vitest
Zod
Historical target: OpenAI Responses API
Vercel deployment
```

### Why this stack

- Next.js keeps frontend, server API routes, and deployment simple.
- TypeScript is essential because the rules engine must be deterministic and strongly typed.
- Zod gives runtime validation at the LLM boundary.
- Vitest is quick for pure engine tests.
- OpenAI structured outputs suit the engine-request JSON contract.
- Vercel is the simplest deploy path for a Next.js proof of concept.

### Environment variables

```txt
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
PARTYQUEST_DEV_LOGS=true
PARTYQUEST_MAX_DEV_SPEND_AUD=20
```

The app-level spend variable is advisory only. The real hard cap must be set in the provider dashboard/project budget settings.

---

## 6. Repo structure

Use this exact initial structure:

```txt
partyquest-v0/
  app/
    api/
      turn/
        route.ts
    page.tsx
    layout.tsx
    globals.css
  components/
    CharacterPanel.tsx
    CombatHud.tsx
    DiceLog.tsx
    NarrationPanel.tsx
    PlayerInput.tsx
  lib/
    contracts/
      engine-contract.ts
      llm-contract.ts
    engine/
      actions.ts
      combat.ts
      dice.ts
      features.ts
      index.ts
      initiative.ts
      skillChecks.ts
      state.ts
      types.ts
      validateRequest.ts
    game/
      monsters.ts
      one-shot.ts
      pregens.ts
      sceneState.ts
    llm/
      client.ts
      prompts/
        dm-system-v0.1.md
        narrator-v0.1.md
        intent-adjudicator-v0.1.md
      schemas.ts
    logging/
      devLog.ts
    orchestrator/
      turnOrchestrator.ts
      summariseForNarrator.ts
      validateNarration.ts
  tests/
    engine/
      dice.test.ts
      skillChecks.test.ts
      combat.test.ts
      features.test.ts
    scenarios/
      v0-one-shot.test.ts
      llm-contract.test.ts
  docs/
    DECISIONS.md
    PLAYTEST_DEBRIEF.md
    V0_SCOPE.md
  .cursor/
    rules/
      partyquest-v0.mdc
  AGENTS.md
  CLAUDE.md
  README.md
  package.json
  pnpm-lock.yaml
```

### Module boundary rules

- `/lib/engine` imports no LLM code.
- `/lib/engine` writes no prose.
- `/lib/llm` mutates no game state.
- `/lib/orchestrator` is the only place engine and LLM interact.
- `/lib/contracts` holds shared types and schemas.
- Coding agents may not refactor outside their assigned module without explicit instruction.

---

## 7. Engine and LLM contract

### Turn flow

```txt
Player input
-> server route /api/turn
-> orchestrator builds visible state summary
-> LLM call 1: classify/adjudicate intent
-> Zod validates LLM output
-> engine validates each EngineRequest
-> engine resolves dice/state/events
-> LLM call 2: narrate engine results, if mechanics occurred
-> narration validator checks for contradictions and unsafe content
-> UI displays narration, dice log, state updates
```

### Two-call pattern

Use two LLM calls when mechanics are involved.

- **Call 1:** intent/adjudication only. It may request engine actions.
- **Call 2:** narration only. It receives engine results and must not invent numbers.

Use one LLM call only for pure-fiction responses that need no mechanical resolution.

### LLM output shape

```ts
type LlmTurnPlan = {
  intent: 'dialogue' | 'exploration' | 'combat' | 'ooc' | 'invalid';
  engineRequests: EngineRequest[];
  narration: string | null;
  needsResultBeforeNarrating: boolean;
  reasoningSummary: string;
};
```

`reasoningSummary` is short and visible only in dev logs. It is not shown to the player.

### EngineRequest union for V0

```ts
type EngineRequest =
  | { type: 'skill_check'; actorId: string; skill: Skill; dc: number; reason: string }
  | { type: 'attack'; attackerId: string; targetId: string; weaponId: string }
  | { type: 'start_combat'; combatantIds: string[] }
  | { type: 'end_turn'; actorId: string }
  | { type: 'use_feature'; actorId: string; featureId: 'second_wind' | 'action_surge'; targetId?: string }
  | { type: 'advance_scene'; fromSceneId: string; toSceneId: string; reason: string }
  | { type: 'end_session'; endingId: string; reason: string };
```

### EngineResult union for V0

```ts
type EngineResult =
  | { type: 'skill_check_result'; actorId: string; skill: Skill; dc: number; roll: RollResult; outcome: 'success' | 'failure' }
  | { type: 'attack_result'; attackerId: string; targetId: string; attackRoll: RollResult; hit: boolean; critical: boolean; damage?: RollResult; targetHpBand: HpBand }
  | { type: 'combat_started'; order: InitiativeEntry[]; currentActorId: string }
  | { type: 'turn_ended'; actorId: string; nextActorId: string }
  | { type: 'feature_used'; actorId: string; featureId: string; roll?: RollResult; hpBand?: HpBand; usesRemaining: number }
  | { type: 'scene_advanced'; fromSceneId: string; toSceneId: string }
  | { type: 'session_ended'; endingId: string }
  | { type: 'invalid_request'; reason: string; suggestion?: string };
```

### GameEvent types for V0

```ts
type GameEventType =
  | 'session_started'
  | 'player_input_received'
  | 'llm_turn_planned'
  | 'engine_request_validated'
  | 'engine_request_rejected'
  | 'dice_rolled'
  | 'skill_check_resolved'
  | 'initiative_started'
  | 'turn_started'
  | 'turn_ended'
  | 'attack_resolved'
  | 'damage_applied'
  | 'feature_used'
  | 'scene_advanced'
  | 'session_ended'
  | 'narration_validated'
  | 'narration_rejected';
```

### NarratorContext

```ts
type NarratorContext = {
  sceneId: string;
  sceneTitle: string;
  playerInput: string;
  visibleState: VisibleGameState;
  recentEvents: GameEvent[];
  engineResults: EngineResult[];
  allowedTone: ToneRules;
  safetyRules: SafetyRules;
  instruction: 'Narrate only the supplied results. Do not invent rolls, HP, damage, conditions, inventory, or scene outcomes.';
};
```

### Hidden information rule

The narrator does not receive exact monster HP. It receives:

```ts
type HpBand = 'unhurt' | 'scratched' | 'wounded' | 'bloodied' | 'near_death' | 'down';
```

---

## 8. Uncodified actions

### Decision

For actions not explicitly implemented by the engine, the LLM may convert the player intent into a skill check.

Examples:

| Player says | LLM emits | Engine does |
|---|---|---|
| "I climb the wet wall." | `skill_check` Athletics DC 13 | Rolls d20 + Athletics. |
| "I bribe the goblin." | `skill_check` Persuasion DC 15 | Rolls d20 + Persuasion. |
| "I search the mud for tracks." | `skill_check` Survival or Investigation DC 12 | Rolls and returns success/failure. |
| "I leap across the stream." | `skill_check` Athletics or Acrobatics DC 12 | Rolls and resolves. |

### Limits

The LLM may not use uncodified actions to:

- apply damage
- kill an enemy
- apply a condition
- spend or restore a feature use
- change HP
- add inventory
- finish a scene
- end combat
- reveal hidden facts not in the scene module

If the action would require one of those, the LLM must request a valid engine action or narrate why it cannot be resolved yet.

### Fail-forward rule

Failed checks should usually create complications, not dead ends. V0 should avoid "you failed, nothing happens" unless the action was obviously impossible.

---

## 9. V0 one-shot adventure

### Title

**The Last Lantern at Brindlehook Inn**

### Synopsis

The player character, Rowan Ash, arrives at the isolated Brindlehook Inn during a cold rainstorm. The innkeeper, Marra Vale, is worried because a young courier named Tamsin Reed vanished while carrying a sealed packet of fever medicine to the nearby hamlet of Greywick. Tracks lead from the road toward the Briarfen, where a small band of goblins has been stealing lantern oil, food, and tools. The twist is that the goblins are not raiding for sport; their den flooded, one of their young is sick, and they panicked. The player can resolve the situation by fighting, frightening, negotiating, or rescuing Tamsin and recovering the medicine.

The one-shot ends when Tamsin is rescued and the medicine is recovered, or when Rowan retreats and reports the danger, or when Rowan is defeated.

### Scene 1 - Social: Brindlehook Inn

**Location:** The Brindlehook Inn, an old roadside inn with a leaking roof, warm hearth, and nervous locals.  
**Key NPC:** Marra Vale, innkeeper. Practical, tired, protective, not dramatic.  
**Hook:** Tamsin Reed has not returned. The medicine packet matters because children in Greywick are feverish.  
**Useful checks:**

- Insight DC 12: Marra is more frightened than she admits.
- Persuasion DC 13: Marra shares the last exact place Tamsin was seen.
- Investigation DC 12: Player notices muddy bootprints and a dropped strip of green-dyed lantern wick near the stable door.

**Scene transition:** advance to Scene 2 when the player chooses to follow the trail, search outside, or leave the inn to investigate.

### Scene 2 - Exploration: The Briarfen Trail

**Location:** A wet track through reeds, black mud, and leaning trees.  
**Goal:** Follow clues to the goblin ambush site.  
**Clues:** broken lantern glass, bootprints, drag marks, green wax, a torn courier satchel strap.  
**Useful checks:**

- Survival DC 12: follow the trail cleanly.
- Investigation DC 13: identify that Tamsin was dragged, not killed.
- Perception DC 14: notice a goblin watcher before the ambush.
- Athletics or Acrobatics DC 12: cross a washed-out ditch without losing time.

**Fail-forward complications:**

- Failed Survival: arrive noisily; goblins are ready.
- Failed Perception: goblins get the first hostile beat, but normal initiative still decides combat order.
- Failed Athletics/Acrobatics: Rowan slips, takes no damage, but loses advantage on the first check to negotiate or surprise.

**Scene transition:** advance to Scene 3 when Rowan reaches the old stone culvert.

### Scene 3 - Combat / Resolution: Old Stone Culvert

**Location:** A half-collapsed stone culvert beside floodwater.  
**Enemies:** 2 Goblin Cutpurses + 1 Goblin Scout.  
**Captive:** Tamsin Reed, bound but alive, hidden behind a fallen crate.  
**Goal:** Survive the encounter and resolve Tamsin's rescue.  
**Twist reveal:** If Rowan talks, succeeds on a check, or captures a goblin, the goblins admit they wanted lantern oil and food because their den flooded.

**Combat win condition:** all goblins are down, fled, surrendered, or successfully intimidated/negotiated into standing down.  
**Combat lose condition:** Rowan is unconscious or flees the scene.  
**Best ending:** Rowan rescues Tamsin, recovers the medicine, and chooses whether to show mercy to the goblins.  
**Partial ending:** Rowan escapes and warns Marra, but Tamsin and the medicine remain unresolved.  
**Bad ending:** Rowan falls unconscious; Marra later finds the trail cold and the medicine lost.

---

## 10. Pregen Fighter

Use this exact V0 character.

```ts
export const ROWAN_ASH = {
  id: 'pc_rowan_ash',
  name: 'Rowan Ash',
  level: 3,
  ancestry: 'Human',
  className: 'Fighter',
  subclass: 'Champion',
  background: 'Road Warden',
  abilityScores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
  proficiencyBonus: 2,
  savingThrowProficiencies: ['str', 'con'],
  skills: {
    athletics: 5,
    perception: 3,
    survival: 3,
    insight: 3,
    intimidation: 2
  },
  armorClass: 18,
  speed: 30,
  hp: { current: 28, max: 28, temp: 0 },
  hitDice: { total: 3, remaining: 3, die: 'd10' },
  deathSaves: { successes: 0, failures: 0 },
  equipment: {
    mainHand: 'longsword',
    offHand: 'shield',
    armor: 'chain_mail'
  },
  weapons: {
    longsword: { attackBonus: 5, damage: '1d8+5', damageType: 'slashing' },
    handaxe: { attackBonus: 5, damage: '1d6+5', damageType: 'slashing' },
    light_crossbow: { attackBonus: 4, damage: '1d8+2', damageType: 'piercing' }
  },
  features: [
    { id: 'second_wind', name: 'Second Wind', actionType: 'bonus_action', heal: '1d10+3', uses: { max: 1, remaining: 1 }, rechargeOn: 'short_rest' },
    { id: 'action_surge', name: 'Action Surge', actionType: 'free', grants: 'extra_action', uses: { max: 1, remaining: 1 }, rechargeOn: 'short_rest' },
    { id: 'improved_critical', name: 'Improved Critical', critRange: [19, 20] }
  ]
};
```

### Character backstory hook

Rowan is a road warden who once failed to protect a travelling family from an avoidable ambush. Rowan does not need melodrama, but should care about missing travellers, vulnerable children, and roads becoming unsafe.

The LLM may use this lightly for tone. It must not force Rowan's emotions or choices.

---

## 11. V0 monster seed data

Use these simple original V0 stat blocks. Keep them engine-friendly.

```ts
export const V0_MONSTERS = {
  goblin_cutpurse: {
    id: 'goblin_cutpurse',
    name: 'Goblin Cutpurse',
    armorClass: 15,
    hp: { current: 7, max: 7, temp: 0 },
    abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    attacks: [
      { id: 'scimitar', name: 'Scimitar', attackBonus: 4, damage: '1d6+2', damageType: 'slashing', reach: 'melee' },
      { id: 'shortbow', name: 'Shortbow', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', reach: 'ranged' }
    ]
  },
  goblin_scout: {
    id: 'goblin_scout',
    name: 'Goblin Scout',
    armorClass: 13,
    hp: { current: 9, max: 9, temp: 0 },
    abilityScores: { str: 8, dex: 14, con: 12, int: 10, wis: 12, cha: 8 },
    attacks: [
      { id: 'knife', name: 'Knife', attackBonus: 4, damage: '1d4+2', damageType: 'piercing', reach: 'melee' },
      { id: 'shortbow', name: 'Shortbow', attackBonus: 4, damage: '1d6+2', damageType: 'piercing', reach: 'ranged' }
    ]
  }
};
```

No special monster abilities in V0. If the LLM describes goblins ducking, hiding, or scrambling, that is flavour unless the engine has a matching request.

---

## 12. UI wireframes

### Default play screen

```txt
+--------------------------------------------------------------+
| PartyQuest                         Scene: Brindlehook Inn    |
+--------------------------------------------------------------+
|                                                              |
|  NARRATION PANEL                                             |
|  ----------------------------------------------------------  |
|  The rain taps against the shutters...                       |
|  Marra Vale lowers her voice...                              |
|                                                              |
|  Dice / result chips appear inline after relevant events.    |
|                                                              |
+------------------------------------------+-------------------+
| PLAYER INPUT                             | CHARACTER PANEL   |
| [ I greet the innkeeper...            ]  | Rowan Ash         |
| [ Send ]                                 | HP 28/28          |
|                                          | AC 18             |
|                                          | Longsword +5      |
|                                          | Second Wind 1/1   |
+------------------------------------------+-------------------+
```

### Dice log component

```txt
Dice
- Survival check DC 12: d20(14) + 3 = 17 - Success
- Goblin attack: d20(8) + 4 = 12 - Miss vs AC 18
- Longsword damage: 1d8(6) + 5 = 11 slashing
```

### Combat HUD

```txt
Combat
Current turn: Rowan Ash
Initiative:
> Rowan Ash       HP healthy
  Goblin Scout    wounded
  Goblin Cutpurse scratched
  Goblin Cutpurse unhurt

Available:
[Attack] [Second Wind] [Action Surge] [End Turn]
```

### Ending screen

```txt
The one-shot is complete.
Ending: Tamsin rescued; medicine recovered.

What happened:
- You learned the hook from Marra Vale.
- You followed the Briarfen trail.
- You survived the culvert ambush.
- You chose mercy / force / retreat.

[Play again]
```

---

## 13. Safety and tone

### V0 safety rule

V0 is solo, but safety still matters. The narrator must avoid:

- sexual content
- graphic violence
- graphic harm to children
- hateful or dehumanising content
- real-world political persuasion
- player-agency violations
- forcing Rowan's thoughts, emotions, or choices
- describing the player character as doing something the player did not choose

### Tone

Tone should be:

- grounded fantasy
- warm but tense
- clear rather than purple
- suitable for a mature but not grimdark adventure
- no gore
- no comedy derailments unless the player leads that way

### Player agency rule

Allowed:

> "The sight might make Rowan uneasy."

Not allowed:

> "Rowan feels terrified and drops his sword."

The engine may force mechanical outcomes. The narrator may not force internal emotional states.

---

## 14. Tests and evals

### Engine tests required before real LLM wiring

1. Dice formula parsing.
2. Advantage/disadvantage.
3. Skill check success/failure.
4. Attack vs AC.
5. Critical hit range for Champion Fighter.
6. Damage application and HP clamping.
7. Initiative order.
8. End turn progression.
9. Second Wind healing and use consumption.
10. Action Surge extra action.
11. Unconscious at 0 HP.
12. Death save successes/failures.

### Scenario tests required

1. Player attacks before combat starts.
2. Player tries to attack while unconscious.
3. LLM tries to invent direct damage without an attack.
4. LLM tries to reveal exact hidden monster HP.
5. Player uses Second Wind twice.
6. Player asks a pure OOC question.
7. Failed exploration check still advances with complication.
8. Combat ends when all goblins are down, fled, or surrendered.
9. Narrator output contains a number contradicting engine state.
10. Invalid target ID from LLM is rejected and retried once.

### Prompt evals

Create a small prompt regression set in `tests/scenarios/llm-contract.test.ts` with mocked LLM outputs first. Real provider evals can come later.

---

## 15. Logging and observability

### Dev logging decision

Write JSONL logs in development only:

```txt
.partyquest/logs/session-YYYYMMDD-HHMMSS.jsonl
```

Each line should be one event:

```json
{"type":"player_input_received","timestamp":"...","text":"I search the mud"}
{"type":"llm_turn_planned","timestamp":"...","model":"gpt-5.4-mini","engineRequests":[...]}
{"type":"skill_check_resolved","timestamp":"...","roll":{"total":17}}
```

### Do not log

- API keys
- full provider response metadata unless needed
- personal user identifiers
- anything from environment variables

### Why this matters

Debugging hybrid AI + deterministic systems is painful without a replay trail. The event log lets you see whether the LLM, orchestrator, or engine caused a failure.

---

## 16. Required repo instruction files

### `AGENTS.md`

```md
# PartyQuest V0 Agent Rules

You are working on PartyQuest V0, a solo text-only AI fantasy RPG proof of concept.

The core rule is: the engine owns truth, the AI owns words, the event log records everything.

## Hard boundaries

- Do not build multiplayer, voice, accounts, billing, persistence, maps, character creation, spell catalogues, or adventure generation.
- Do not use official D&D branding, settings, adventures, art, or non-SRD content.
- Do not let the LLM mutate game state.
- Do not put AI calls inside `/lib/engine`.
- Do not put prose generation inside `/lib/engine`.
- Do not refactor outside your assigned module without explicit instruction.

## Module rules

- `/lib/engine` is pure TypeScript deterministic rules code.
- `/lib/llm` handles provider calls and prompt files.
- `/lib/orchestrator` connects player input, LLM plans, engine results, and narration.
- `/lib/contracts` holds shared schemas/types.
- Tests must pass before UI polish.

## V0 success

A user can play The Last Lantern at Brindlehook Inn end-to-end as Rowan Ash, a level-3 Fighter, through one social scene, one exploration scene, and one combat.
```

### `CLAUDE.md`

```md
# Claude / Coding Assistant Context

PartyQuest V0 is not the full product. It is a tiny proof of concept.

Build only a solo, browser-only, text-only one-shot with:

- one pre-generated level-3 Fighter: Rowan Ash
- one hand-authored adventure: The Last Lantern at Brindlehook Inn
- one deterministic TypeScript rules engine
- one LLM narrator connected through strict JSON contracts

The engine owns all numbers and state. The LLM only interprets intent and narrates validated results.

Do not add multiplayer, voice, auth, billing, persistence, maps, image generation, character creation, full SRD catalogues, or campaign memory.

Before changing code, identify which module you are editing:

- engine
- llm
- orchestrator
- game content
- UI
- tests
- docs

Only edit files in that module unless explicitly asked.
```

### `.cursor/rules/partyquest-v0.mdc`

```md
# PartyQuest V0 Cursor Rule

This repo is a strict-scope proof of concept.

The engine owns truth. The AI owns words. The event log records everything.

Do not allow the LLM to mutate HP, AC, dice, initiative, conditions, inventory, feature uses, spell slots, or death saves.

Do not add multiplayer, voice, accounts, database persistence, character creation, maps, image generation, adventure generation, or full rules catalogues.

Keep `/lib/engine` pure and testable. Engine code must not import `/lib/llm`.

Use TypeScript, Zod, Vitest, pnpm, and strict structured JSON at the LLM boundary.
```

---

## 17. Build order

### Phase 0 - Repo and guardrails

1. Create repo `partyquest-v0`.
2. Add README, AGENTS.md, CLAUDE.md, `.cursor/rules/partyquest-v0.mdc`.
3. Add this decision document as `docs/DECISIONS.md`.
4. Scaffold Next.js App Router with TypeScript, Tailwind, pnpm.
5. Add Vitest and Zod.

### Phase 1 - Engine only

1. Build dice parser/roller.
2. Build GameState.
3. Build skill checks.
4. Build attacks/damage.
5. Build initiative/turns.
6. Build Second Wind and Action Surge.
7. Add tests.

No LLM calls yet.

### Phase 2 - Game seed data

1. Add Rowan Ash.
2. Add Brindlehook one-shot module.
3. Add goblin stat blocks.
4. Add scene transitions.
5. Add ending conditions.

### Phase 3 - UI with stubbed narrator

1. Home/start screen.
2. Narration panel.
3. Input box.
4. Character panel.
5. Dice log.
6. Combat HUD.
7. Ending screen.

Still no real LLM calls.

### Phase 4 - Orchestrator and LLM

1. Add `/api/turn`.
2. Add OpenAI client.
3. Add strict schemas.
4. Add intent/adjudicator prompt.
5. Add narrator prompt.
6. Add narration validator.
7. Add dev logs.

### Phase 5 - Playtest and tighten

1. Josh plays 10 times.
2. Fix engine/contract bugs.
3. Five non-Josh people play end-to-end.
4. At least three say it was fun enough to replay.
5. Only then discuss voice/multiplayer.

---

## 18. Playtest debrief template

Use this after every outside playtest.

```md
# PartyQuest V0 Playtest Debrief

Player:
Date:
Build/commit:
Session completed? yes/no
Approx time:

## 1. Did you understand what to do in the first 2 minutes?

## 2. Did the AI/game ever feel unfair, confusing, or wrong?

## 3. Was combat clear enough to follow?

## 4. Did you care about Tamsin, Marra, Rowan, or the situation?

## 5. Would you play another short adventure like this?

## Notes from observer

- Where did they pause?
- Where did they smile/laugh/lean in?
- Where did they look confused?
- Did they need help?
- Did they try anything the system could not handle?
```

---

## 19. Final pre-code checklist

Before writing feature code, confirm these are true:

- [ ] Repo is named `partyquest-v0`.
- [ ] Package manager is pnpm.
- [ ] Root docs exist: `README.md`, `AGENTS.md`, `CLAUDE.md`.
- [ ] `.cursor/rules/partyquest-v0.mdc` exists.
- [ ] `docs/DECISIONS.md` exists.
- [ ] `OPENAI_API_KEY` is not committed.
- [ ] Provider dashboard budget cap is set to AUD $20 equivalent or lower for dev.
- [ ] Engine folder has no LLM imports.
- [ ] LLM folder has no direct state mutation.
- [ ] Orchestrator is the only bridge.
- [ ] Adventure seed data is original.
- [ ] No public-facing D&D branding appears in UI or metadata.
- [ ] First tests are written before real LLM calls.

---

## 20. The first coding prompt to use

Use this with Codex / Claude Code / Cursor / Windsurf once the repo exists:

```txt
Create the PartyQuest V0 scaffold exactly as described in docs/DECISIONS.md.

Build only the repo structure, package setup, root instruction files, placeholder UI components, core TypeScript type files, and Vitest setup.

Do not implement multiplayer, voice, accounts, persistence, maps, character creation, adventure generation, image generation, or full SRD catalogues.

The core architecture is:
player input -> orchestrator -> LLM turn plan -> Zod validation -> deterministic engine -> engine events/results -> narrator -> narration validator -> UI.

The engine owns truth. The AI owns words. The event log records everything.

After scaffolding, add a README section explaining how to run:

pnpm install
pnpm test
pnpm dev

Do not call the OpenAI API yet. Stub LLM responses until the engine and UI loop work locally.
```

---

## 21. Known deferrals

These are not forgotten. They are intentionally deferred.

| Deferred item | Earliest version |
|---|---|
| Voice input/output | V1 after V0 fun is proven |
| Multiplayer room codes | V1 |
| Host controls | V1 |
| Safety/session-zero UI | V1 |
| Campaign persistence | V1/V2 |
| Character creation | V2 |
| Spellcasting | V2 |
| Full SRD data import | V2 |
| Grid/maps | V2/V3 |
| Ambient music | V2 |
| Private whispers/secrets | V2 |
| Analytics dashboard | V2 |
| Homebrew rules | V3 |
| Native mobile app | V3 |

---

## 22. Final statement

This is now ready to scaffold.

There are no remaining architectural decisions required before first commit.

The next real blocker is not architecture. It is implementation discipline: keep V0 tiny, test the engine first, stub the LLM before spending tokens, and do not let agents expand the scope.
