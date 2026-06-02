# SKT Nightstone starter (scaffold)

**Not** official *Storm King's Thunder* content. This is an **original placeholder** scene structure for you to replace with brief notes from the book you own.

## Setup

From the repo root:

```bash
npm run module:scaffold -- skt-nightstone-starter skt-nightstone
```

That copies `module.json` to `content/private/skt-nightstone/` (gitignored).

Edit `content/private/skt-nightstone/module.json`:

1. Change `"id"` to `skt-nightstone` (or keep a unique slug).
2. Replace every `YOUR NOTE:` string with **your own** one-line summaries.
3. Adjust DCs, monster stats (SRD-only in public repos), and `sceneOrder` if you add scenes.
4. Restart `npm run dev` and pick the module on `/start`.

Keep your PDF **outside git**. See `docs/published-adventures-guide.md`.

## Validate

```bash
npm run module:validate -- content/private/skt-nightstone/module.json
```
