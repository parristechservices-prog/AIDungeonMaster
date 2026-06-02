---
doc: Playing Storm King's Thunder in PartyQuest
audience: Josh (owned book + digital)
---

# SKT playbook (PartyQuest)

You own *Storm King's Thunder*. This app runs **5e mechanics + your notes** — not the book text.

## One-time setup (15 min)

```bash
cd Projects/AIDungeonMaster
npm install
npm run module:scaffold -- skt-nightstone-starter skt-nightstone
```

1. Open `content/private/skt-nightstone/module.json` (gitignored).
2. Replace every `YOUR NOTE:` with **short bullets** from your book (names, DCs, clues — not full pages).
3. Fill `campaignGuide` with 5–15 bullets the AI should treat as truth.
4. Validate:
   ```bash
   npm run module:validate -- content/private/skt-nightstone/module.json
   ```
5. Add API keys to `.env.local` for AI narration, or play in **table-rules** mode without keys.

Keep `docs/__Storm King's Thunder*.pdf` **out of git**.

## Start a session

```bash
npm run dev
```

Open [http://localhost:3000/start?adventureId=skt-nightstone](http://localhost:3000/start?adventureId=skt-nightstone)

### Optional: import a local module file via UI

On `/start`, use **Import local module JSON (dev only)** to upload a `module.json` file from your machine.

- The app validates it and saves to `content/private/<module-id>/module.json`.
- This keeps your owned/copyrighted SKT notes local to your computer.
- Imported modules appear in the scenario list immediately after upload.

- Pick class (level 3 templates; use level slider if shown).
- Choose **private** SKT module.
- Play on `/play` with the PDF beside you for read-aloud and maps.

## Scene flow (scaffold)

| Scene | Kind | You do at the table |
|-------|------|---------------------|
| settlement-arrival | social | Arrival, tone, hook |
| village-briefing | social | NPC facts, quests |
| breach-investigation | exploration | Clues at wall/breach |
| trail-to-hideout | exploration | Travel to next locale |
| goblin-ambush | combat | SRD goblins/hobgoblins spawn when scene starts |
| ending | — | Cliffhanger note |

Add scenes: edit `sceneOrder` and `scenes`, then validate.

## Combat & monsters

- Repo uses **SRD** creatures: goblin, hobgoblin, orc, ogre, bugbear, etc.
- `sceneEncounters.goblin-ambush` auto-builds a medium fight for solo level 3.
- Edit `preferredTemplates` or list explicit `templates: ["goblin","goblin","orc"]`.

Giants in the book often use **large** stat blocks — for early levels, narrate giant attacks as environmental threats and use ogre/hobgoblin stats for “raiders” until you add custom stats locally.

## AI vs table-rules

| Mode | When |
|------|------|
| **AI director** | `GROQ_API_KEY` set — creative narration, must follow engine |
| **Table rules** | No key — mock DM, good for testing your module JSON |

Use **Appeal the DM** if a ruling feels wrong.

## After Chapter 1

```bash
npm run module:scaffold -- skt-nightstone-starter skt-ch02
```

Copy structure, new `sceneOrder`, new `campaignGuide` bullets. One `module.json` per chapter keeps load times sane.

## Legal reminder

- Private `module.json` = your notes.
- Public GitHub = no WotC adventure text, maps, or art.

See also: `docs/scenario-authoring.md`, `docs/published-adventures-guide.md`.
