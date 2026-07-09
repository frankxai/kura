# Kura — Claude Code Configuration

Local-first Chrome MV3 extension that captures AI conversations into an
Obsidian-compatible vault on disk. The repo URL is still
`arcanea-vault`; the product is **Kura** v0.2.0.

## Source of truth

Read in this order before substantive work:

1. `FORMAT_SPEC.md` — the locked v0.2.0 vault format. **Do not modify
   without bumping `schemaVersion` everywhere.**
2. `README.md` — public-facing positioning.
3. `.claude/commands/kura-process.md` — the processing-layer skill that
   downstream tools (Obsidian users, the Arcanea second-brain) depend on.

## Behavioral rules

- The extension is **capture only**. Never add features that send data
  off-device by default. The single optional `THREADS_SEND_TO_ARCANEA`
  bridge requires an explicit click and is documented in the manifest.
- The filesystem is the source of truth. IndexedDB (`src/core/storage.ts`)
  is a query index, never canonical.
- Never break `FORMAT_SPEC.md` without bumping `schemaVersion` in
  `src/core/frontmatter.ts`, `CAPTURED_BY`, and the `kura-process`
  skill's schema gate.
- Idempotent re-capture: writing the same conversation twice must produce
  the same filesystem state, not duplicated files.
- Preserve user-edited frontmatter (`status`, `worldbuilding`, `tags`,
  curated entity arrays). The skill merges; it never clobbers.

## File organization

- `src/entrypoints/background.ts` — MV3 service worker (WXT `defineBackground`).
  Routes messages; builds a `WritePlan` and writes it to the connected vault
  via the offscreen document, falling back to `chrome.downloads`.
- `src/core/capture-plan.ts` — pure `buildWritePlan(detection, options)`; the
  single source for vault file paths, shared by the FSA writer and the
  Downloads fallback.
- `src/core/vault-writer.ts` + `src/entrypoints/offscreen/` — the File System
  Access writer. The SW can't hold a directory handle, so the offscreen doc
  re-reads it from IndexedDB (`kura_vault`, see `src/core/vault-keys.ts`) and
  writes. One connected folder holds conversations (`<platform>/`) and Suno
  (`suno/`). The side panel's shared Vault bar (`sidepanel/vault.ts`) owns the
  picker + re-grant; `sidepanel/suno.ts` consumes the shared handle.
- `src/entrypoints/<platform>.content.ts` — per-platform scrapers (WXT
  `defineContentScript`). Each exports a detector that returns a
  `DetectionResult` per `src/core/types.ts`.
- `src/core/frontmatter.ts` — single source for YAML frontmatter
  generation. **`SCHEMA_VERSION` and `VAULT_ROOT` live here.**
- `src/core/exporter.ts` — renders `conversation.md`, `prompts.md`, and
  HTML/JSON/text fallbacks. Emits `ConversationBundle`s.
- `src/core/storage.ts` — IndexedDB wrapper (the in-extension query index).
- `src/core/detector.ts` — URL → platform routing.
- `src/entrypoints/popup/main.ts` + `src/entrypoints/popup/index.html` +
  `src/styles/popup.css` — the user surface. Design tokens align to
  `@arcanea/design-system`: Atlantean Teal (`#00bcd4`), Cosmic Blue
  (`#0d47a1`), Gold (`#ffd700`), background `#09090b`. Fonts: Geist (UI),
  Instrument Serif (display), JetBrains Mono (mono). **Never Inter,
  Cinzel, or Space Grotesk.**
- `.claude/commands/kura-process.md` — the processing skill.

## Message namespace

Outgoing messages from popup / content scripts use the `KURA_*` prefix.
Legacy `THREADS_*` (v0.2.0 pre-rename) and `VAULT_*` (v0.1) names are
aliased in the background SW for backwards compatibility while content
scripts migrate. Remove the aliases when every content script is on the
new names — track in v0.3.

## Build & test

```bash
pnpm install
pnpm typecheck          # tsc --noEmit
pnpm build              # tsc + wxt build → dist/
pnpm lint               # eslint flat config
pnpm dev                # watch mode — only during active dev
pnpm clean              # rm -rf dist
```

Always `pnpm build` before claiming work is shippable. WXT generates
`dist/manifest.json` from `wxt.config.ts` + the `src/entrypoints/`
directory; the build catches manifest drift.

## Git discipline

- Commit message format: `type(scope): description` —
  `feat(exporter): emit Obsidian-compatible bundle`,
  `fix(background): correct vault path typo`.
- Stage files by name. **Never `git add .`** — this repo has WIP that
  must not slip into commits.
- Push: `origin` only. No GitHub repo rename without explicit user
  confirmation; the URL remains `arcanea-vault` for now.
- The 0.2.0 work lives on a feature branch until the user lands it.

## Privacy / security

- Host permissions in `manifest.json` are tightly scoped — only AI
  platform domains plus `arcanea.ai` for the opt-in bridge. **Do not
  add host permissions** without a corresponding scraper change.
- No analytics. No telemetry. No third-party scripts in popup/sidepanel.
- Never log conversation contents to the console at non-error levels.

## Design system

Inherits from the parent `~/Arcanea/.claude/CLAUDE.md` Arcanea design
system tokens. Local CSS lives in `src/styles/popup.css` and uses the
token vars (`--teal`, `--gold`, etc.) — never raw hex from a `*.tsx`
file. If you need a new color, add it to `:root` in popup.css first.

## What this repo is NOT

- Not a publishing tool. The `_entities/` notes are graph fuel, not
  publishable content. Use Library on `arcanea.ai` for that.
- Not a cloud product. The bridge is an opt-in mirror, not a substitute
  for the local vault.
- Not multi-vault. One `Kura/` root per machine. Multi-vault is
  a v0.5+ concern.
