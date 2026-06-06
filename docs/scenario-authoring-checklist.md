# Scenario Authoring Checklist

## Structure

- [ ] Use an original/SRD-safe module ID, title, tone, and notes
- [ ] List every playable scene in `sceneOrder`
- [ ] Keep `ending` as the final scene ID
- [ ] Ensure every chapter references existing scenes
- [ ] Provide a clear goal, starter, choices, and concise DM guidance

## Grounding Boundaries

- [ ] `allowedNpcs` contains only NPC IDs defined by the module
- [ ] `allowedMonsters` contains only module monster IDs or names
- [ ] `allowedExits` names only routes the scene should expose
- [ ] `forbidden` lists reveals, rewards, or transitions the DM must not invent
- [ ] `successConditions` describes observable completion conditions
- [ ] NPC knowledge contains only facts that NPC can reveal

## Offline Play

- [ ] Social scene has a recoverable failed-check response
- [ ] Exploration scene has a recoverable failed-check response
- [ ] Combat has active monsters and a valid completion path
- [ ] Table Rules mode can complete the adventure without an API key
- [ ] Choices do not expose future/private scenes or NPCs

## Validation

```bash
pnpm module:validate -- path/to/module.json
pnpm test
pnpm build
```

Never commit owned-book text, PDFs, private modules, or playtest session files.
