---
doc: Running published D&D adventures (e.g. Storm King's Thunder)
project: PartyQuest / AIDungeonMaster
date: 2026-06-02
audience: Josh (rights holder for personal copy — do not redistribute)
---

# Published adventures in PartyQuest

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

Today: one **hardcoded** `Scenario` = 3 scenes (`social` → `exploration` → `combat`) in TypeScript.

SKT needs a **campaign layer**:

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

### Module file shape (target)

Store under `content/private/storm-kings-thunder/` (gitignored):

```yaml
# module.meta.yaml — facts YOU summarize, not pasted chapters
id: skt-private
title: "Giants campaign (private)"
levelRange: [1, 5]   # start with a slice, not the whole book
source: "Owned physical/digital; not for distribution"

chapters:
  - id: ch01-nightstone
    scenes:
      - id: nightstone-arrival
        type: social
        goal: "Learn what happened to the village."
        guidance: "Hook from ch1; keep to facts in your notes."
        encounters: []
      - id: goblin-ambush
        type: combat
        encounterRef: enc-goblin-skt-01
```

Encounters reference **engine monsters** (SRD or your stat summaries), not PDF text.

### Phased delivery

| Phase | Scope | Outcome |
|-------|--------|---------|
| **1** | `.gitignore` + private folder + loader API | App can load `content/private/*/module.meta.yaml` locally |
| **2** | Scene graph > 3 scenes | `sceneId` is dynamic; chapter/scene navigation |
| **3** | Encounter library | CR-based encounters; SKT fights you define privately |
| **4** | Optional **local-only RAG** | Desktop script indexes PDF on your PC; never uploads to Vercel |
| **5** | Official integration | D&D Beyond / WotC only if you get a proper license |

**Storm King’s Thunder** is a full campaign (levels 1–11+, many chapters). Realistic first milestone: **Chapter 1 (Nightstone)** as a private module, solo or small party, not the entire book in v1.

---

## Practical workflow for SKT (today, no code change)

1. Keep the PDF **outside git** (or in gitignored `content/private/`).
2. Play **Brindlehook-style** one-shots in the app to harden the engine.
3. In a notebook, for **one scene at a time**, write:
   - Scene goal (1 sentence)
   - 2–3 canon facts
   - DCs and skills
   - Monster IDs + counts (SRD names where possible)
4. When Phase 1 loader exists, paste that into `module.meta.yaml`.
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

1. Gitignore `content/private/` and `*.pdf` under `docs/`.
2. `loadPrivateModule(moduleId)` reading gitignored YAML.
3. Replace fixed `SceneId` union with `string` scene keys for modules.
4. Catalog API: list only modules present in `content/private/`.
5. Document SRD attribution in README when importing Open5e data.

---

## Related docs

- `docs/published-adventures-implementation.md` — phased build status and module JSON format
- `docs/v0-feature-spec.md` — current scope (no official adventures in repo)
- `docs/full-improvement-plan.md` — Phase B/C content tooling
- `docs/audit-2026-06-02.md` — current play limitations
- `content/templates/example-frontier/module.json` — copyable template (original content)
