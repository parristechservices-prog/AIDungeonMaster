# SKT Nightstone Chapter 1 expanded

**Not** official *Storm King's Thunder* content. This is a richer scaffold for Chapter 1 and not a replacement for the book.

## Setup

From the repo root:

```bash
npm run module:scaffold -- skt-nightstone-chapter1 skt-nightstone-chapter1
```

That copies `module.json` to `content/private/skt-nightstone-chapter1/` (gitignored).

Edit `content/private/skt-nightstone-chapter1/module.json`:

1. Change the `id` if you want a custom slug.
2. Replace `Nightstone` narrative placeholders with your own notes from the book.
3. Adjust DCs, monster details, and scene order to fit your session.
4. Restart `npm run dev` and open `/start?adventureId=skt-nightstone-chapter1`.

Keep your owned book/PDF outside git. See `docs/published-adventures-guide.md`.
