---
doc: Running published D&D adventures (e.g. Storm King's Thunder)
project: PartyQuest / AIDungeonMaster
date: 2026-06-02
audience: Josh (rights holder for personal copy — do not redistribute)
---

# Published adventures in PartyQuest

> **Accuracy note (2026-06-02):** Private JSON module loading, module validation, scaffolding, dev-only module import, and `/start` private-module selection are implemented. This guide still describes future optional work for richer encounter packs, Open5e imports, local authoring UI, and local-only RAG.

> Status: Current app supports private module loading and gitignored private module files. This guide explains the repo-safe workflow for using owned adventure books privately.

You own *Storm King's Thunder* — that lets **you** run it at your table. It does **not** let this app (or a public GitHub repo) **store, ship, or auto-extract** the book’s text, maps, art, or stat blocks for other people. Wizards of the Coast’s **SRD** (mechanics under CC) is separate from **adventure products** (copyright, not in the SRD).

PartyQuest’s V0 spec already commits to: **SRD mechanics + original scenario flavour, no official adventures in the repo.**

This guide is how to get SKT-style play **legally** and **technically** without breaking that line.

---

## What you cannot do (in this repo / on Vercel)

| Don’t | Why |
|-------|-----|
| Commit the SKT PDF (or chunks) to git | Redistribution; ~90MB binary; public repo = high risk |
| Paste read-aloud text, maps, or full encounters into `src/` | Adventure product is not open content |
| Ask the LLM to “read the PDF” from the deployed app using your book | Same issue if book text is served from your server |
| Ship “Storm King’s Thunder” branding as a built-in module to strangers | Trademark + adventure copyright |

**Your PDF path** `docs/__Storm King's Thunder (1-10).pdf` should stay **local-only**. Add it to `.gitignore` (see below) before any push.

---

## What you *can* do

1. **Play SKT yourself** using the book/PDF at the table (or beside the app).
2. **Build a private “module”** — structured data **you** write (scene goals, DCs, creature IDs), informed by your book, stored only on your machine or in a **private** repo.
3. **Use SRD/Open5e** for monsters/spells/rules the SRD actually includes; rename or homebrew anything not in the SRD.
4. **Pursue official digital access** later (D&D Beyond marketplace, Roll20 module, etc.) if you want licensed text inside software — that’s a **partnership/license** path, not a PDF drop-in.

---

## How PartyQuest would support this (architecture)

Current app: built-in scenarios and JSON adventure modules both load through the adventure registry. Private modules live at `content/private/<module-id>/module.json` and are gitignored.

SKT-sized campaigns use the **module layer**:

```
┌─────────────────────────────────────────────────────────────┐
│  Adventure module (your private JSON/YAML, not in public git) │
│  - chapters → scenes (many more than 3)                      │
│  - encounter refs, NPC ids, canon seeds, DCs               │
│  - NO long read-aloud prose from the book                    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Engine (SRD stats, HP, dice, combat)                        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LLM narrator — only sees: current scene goal, canon log,    │
│  monster/NPC sheet summaries you allow, player input         │
└─────────────────────────────────────────────────────────────┘
```

### Module file shape

Store under `content/private/storm-kings-thunder/` (gitignored):

```yaml
{
  "id": "skt-private",
  "title": "Giants campaign (private)",
  "tagline": "Private notes from your owned book",
  "estimatedMinutes": 120,
  "tone": "frontier fantasy",
  "recommendedCharacters": ["fighter"],
  "levelRange": [1, 5],
  "sceneOrder": ["nightstone-arrival", "goblin-ambush", "ending"],
  "scenes": {
    "nightstone-arrival": {
      "kind": "exploration",
      "goal": "Learn what happened to the settlement.",
      "starter": "A short original/paraphrased opening written in your own words.",
      "choices": ["Cross the drawbridge", "Follow the ringing bell"],
      "guidance": "Brief facts and DCs from your notes, not pasted book text."
    }
  }
}
```

See `content/templates/example-frontier/module.json` and `src/lib/game/adventures/module-schema.ts` for the full current JSON schema. Encounters reference **engine monsters** or your private stat summaries, not PDF text.

### Phased delivery

| Phase | Scope | Outcome |
|-------|--------|---------|
| **1** | `.gitignore` + private folder + JSON loader API | Done |
| **2** | Scene graph > 3 scenes | Done; `sceneId` is dynamic and modules define `sceneOrder` |
| **3** | Encounter library | Partial; simple scene encounter specs and balancer exist, richer encounter packs are planned |
| **4** | Optional **local-only RAG** | Planned; desktop script would index PDF on your PC and never upload to Vercel |
| **5** | Official integration | Future only; D&D Beyond / WotC requires a proper license |

**Storm King’s Thunder** is a full campaign (levels 1–11+, many chapters). Realistic first milestone: **Chapter 1 (Nightstone)** as a private module, solo or small party, not the entire book in v1.

---

## Practical workflow for SKT

1. Keep the PDF **outside git** (or in gitignored `content/private/`).
2. Play **Brindlehook-style** one-shots in the app to harden the engine.
3. In a notebook, for **one scene at a time**, write:
   - Scene goal (1 sentence)
   - 2–3 canon facts
   - DCs and skills
   - Monster IDs + counts (SRD names where possible)
4. Paste those notes into `content/private/<module-id>/module.json` or import the JSON through the dev-only `/start` module import UI.
5. Use the book for read-aloud, maps, and art; use the app for **dice, HP, and structured memory**.

---

## SRD vs SKT content

- **SRD 5.2.1**: Rules, many monsters/spells — OK in open repo with attribution.
- **SKT**: Story, maps, many NPCs, giant lords, chapter structure — **not** SRD.
- **Giants / specific SKT NPCs**: Often **not** freely reproducible; use generic “hill giant raid” SRD creatures or private notes the LLM never logs to git.

See `docs/PartyQuest_V0_PreCoding_Decision_Register.md` (legal source row).

---

## Optional: local RAG over your PDF (personal machine only)

If you want the AI to quote **your** book during play:

- Run a **local** indexer (e.g. LlamaIndex, private Chroma) against the PDF on your PC.
- Expose it only to `localhost` dev, or a desktop wrapper — **not** the public Vercel deployment.
- Still avoid committing embeddings or extracted text to GitHub.

PartyQuest would call `http://127.0.0.1:PORT/query?q=...` only when `PARTYQUEST_LOCAL_RAG_URL` is set.

---

## Official “full adventure in app” path

To ship SKT **inside the product for all users**, you need a **Wizards-approved** channel (D&D Beyond content keys, AL program, explicit license). PDF ownership does not grant redistribution rights to your SaaS users.

Until then: **private modules + SRD engine + your book at the table**.

---

## Next engineering tasks (repo-safe)

1. Add richer encounter packs or `encounters.yaml` references.
2. Import and validate SRD/Open5e monster data.
3. Build a local scene/module editor.
4. Add optional `PARTYQUEST_LOCAL_RAG_URL` support for a localhost-only PDF index.
5. Document SRD attribution in README when importing Open5e data.

---

## Related docs

- `docs/published-adventures-implementation.md` — phased build status and module JSON format
- `docs/v0-feature-spec.md` — current scope (no official adventures in repo)
- `docs/full-improvement-plan.md` — Phase B/C content tooling
- `docs/audit-2026-06-02.md` — current play limitations
- `content/templates/example-frontier/module.json` — copyable template (original content)
