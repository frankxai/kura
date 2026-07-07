# arcanea-vault â€” Agent Instructions

Read `CLAUDE.md` first when present. This file is the cross-agent entry point.

## Repo Role

`arcanea-vault` contains Arcanea storage/vault primitives. Treat persistence, migrations, and data contracts as high-risk surfaces.

## Work Pattern

1. Inspect schemas, storage adapters, and package scripts before editing.
2. Preserve backward compatibility for stored data.
3. Add migrations deliberately; do not silently reshape existing data.
4. Do not touch unrelated dirty/untracked files.

## Commands

```bash
pnpm test
pnpm build
git status
```

Run storage-adjacent tests before committing persistence changes.

## Design Taste Kernel

For any site, app, landing page, dashboard, visual identity, brand, motion, media, social, or frontend task, apply the shared Design Taste Kernel before handoff:

- C:\Users\frank\starlight\repos\DESIGN_TASTE.md
- C:\Users\frank\starlight\repos\WEB_EXPERIENCE_STANDARD.md
- C:\Users\frank\starlight\repos\MOTION_TASTE_RUBRIC.md
- C:\Users\frank\starlight\repos\MULTI_AGENT_DESIGN_COUNCIL.md
- C:\Users\frank\starlight\repos\VISUAL_QA_GATE.md

When motion, scroll, generated media, GIF/video, or premium polish matters, route through the Motion Design Studio plugin/skills and verify the result visually.

