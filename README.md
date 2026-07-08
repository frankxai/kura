# Kura

> **Kura — export your most precious writing.**

A 蔵 (*kura*) is the fireproof storehouse a family used to keep their
most precious scrolls, swords and records. This is the digital one.

ChatGPT, Claude, Grok, Gemini, DeepSeek, Perplexity — one click, every
conversation becomes a Markdown note with YAML frontmatter, wikilinks
and asset folders, written straight to your disk. Drop the folder into
Obsidian and the knowledge graph builds itself.

*Your AI work belongs on your disk, not on someone else's server.*

[![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-0.2.0-00bcd4?style=flat-square)](package.json)
[![Schema](https://img.shields.io/badge/schema-v0.2.0-7fffd4?style=flat-square)](FORMAT_SPEC.md)
[![Local-first](https://img.shields.io/badge/local--first-yes-22c55e?style=flat-square)](#privacy)

---

## Why this exists

You spend hours per week inside AI tools. Every conversation is real
intellectual work — outlines, drafts, characters, lore, code, decisions.
Almost all of it dies in someone else's sidebar.

Kura is the **export layer**. It does one thing well:

1. Detect the platform you're on.
2. Pull the conversation cleanly.
3. Write it to `Kura/` on disk as Obsidian-compatible Markdown.

What you do with it after is *yours*. Point Obsidian at the folder and
get the graph. Run a Claude Code skill to extract entities. Pipe it
into your second brain of choice. Kura never assumes.

---

## Quick start

1. Install the extension *(Chrome Web Store link coming with v0.2.0
   submission — see [CHROME_WEB_STORE_GUIDE.md](CHROME_WEB_STORE_GUIDE.md)
   for manual install while it's in review)*.
2. Open a conversation on ChatGPT, Claude, Gemini, Grok, DeepSeek or
   Perplexity.
3. Click the Kura icon → **Export to Kura**.
4. Files land at:
   ```
   ~/Downloads/Kura/<platform>/<YYYY-MM-DD>_<slug>/
   ├── conversation.md
   ├── prompts.md
   └── assets/
   ```
5. Open `~/Downloads/Kura/` as a new Obsidian vault — the wikilinks,
   backlinks and graph view light up immediately.

---

## Supported platforms

| Platform     | Conversations | Inline media | Generated media |
|--------------|:-------------:|:------------:|:---------------:|
| ChatGPT      | ✓ | ✓ | ✓ (DALL·E) |
| Claude       | ✓ | ✓ | — |
| Gemini       | ✓ | ✓ | ✓ |
| Grok         | ✓ | ✓ | ✓ (Imagine images + video) |
| DeepSeek     | ✓ | — | — |
| Perplexity   | ✓ | — | — |
| Google AI Studio | ✓ | ✓ | ✓ |

Capture the current conversation from the popup, or hit
**Alt+Shift+K** anywhere on a supported platform.

---

## Suno Harvester

The side panel's **Suno** tab turns Kura into a music-catalog harvester —
the first non-conversation surface built on the same local-first spine:

1. **Index** — walks your public Suno profile (no auth, no tokens) and
   writes `suno/catalog.jsonl`, one JSON row per track.
2. **Flag** — star tracks in the panel, or let an agent write
   `suno/flags.json` (`node scripts/suno-flags.mjs <intake> top 10`).
3. **Fetch flagged** — downloads audio (or audio + video + cover) at human
   cadence straight into your intake folder via the File System Access
   API. A `downloads.json` ledger makes re-runs idempotent.

Spec: [docs/specs/SUNO-HARVESTER.md](docs/specs/SUNO-HARVESTER.md).

---

## What gets written

Every exported conversation becomes a folder. Inside, a single Markdown
file is the canonical record:

```markdown
---
id: a8d9e1c4-...
slug: 2026-05-13_naming-the-extension
title: "Naming the extension"
platform: chatgpt
source: https://chatgpt.com/c/a8d9e1c4
capturedAt: 2026-05-13T22:14:00+02:00
capturedBy: kura/0.2.0
schemaVersion: 0.2.0
messageCount: 24
hasMedia: true
hasCode: false
durationApprox: 47m
characters: []
locations: []
artifacts: []
lore: []
themes: []
status: raw
worldbuilding: false
tags: []
---

# Naming the extension

> **Platform:** chatgpt · **Source:** [chatgpt.com/c/a8d9e1c4](…) · **Captured:** 2026-05-13T22:14:00+02:00

## You

What if we renamed the vault to something more iconic?

## ChatGPT

Three candidates — Kura, Mnemosyne, Stele …
```

The frontmatter is the **contract** — anything you build on top of the
vault (skills, dashboards, automations) reads from those fields.

Full schema: **[FORMAT_SPEC.md](FORMAT_SPEC.md)**.

---

## The Kura workflow

The extension is one piece of a three-stage system:

```
┌──────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  Export          │ →  │  Process           │ →  │  See               │
│  (this ext)      │    │  (Claude Code skill│    │  (Obsidian graph,  │
│                  │    │   /kura-process)   │    │   your second brain)│
└──────────────────┘    └────────────────────┘    └────────────────────┘
   browser → disk         disk → clean notes        disk → visual graph
```

- **Export** (this repo): the extension. Local-first. No account.
- **Process** (Claude Code): the [`kura-process`](.claude/commands/kura-process.md)
  skill walks your `Kura/` vault and emits clean per-conversation notes
  in Obsidian-ready form.
- **See**: Obsidian's native graph view shows the connections forming in
  real time from the wikilinks in your frontmatter.

The moat is **not the extension**. It is the format + the skill + the
ecosystem of integrations that build on top. The extension is the on-ramp.

---

## Integrations

Kura is the open standard. Anyone can build on top.

### Arcanea Kura — worldbuilding specialization

Arcanea (the creator universe that originally built Kura) ships its own
specialization layer for storytellers and worldbuilders:

- **[`/arcanea-kura-process`](.claude/commands/arcanea-kura-process.md)** —
  a richer processing skill that extracts characters, locations,
  artifacts, and lore from each captured conversation, emitting per-entity
  notes under `_entities/` for Obsidian graph view.
- **Opt-in mirror** to the Arcanea second-brain via the
  `Send to Arcanea` button in the popup. Off by default, fires only on
  explicit click. See [`arcanea.ai/kura`](https://arcanea.ai/kura) for
  the specialization page and [`arcanea.ai/privacy/kura`](https://arcanea.ai/privacy/kura)
  for the policy.

The Arcanea layer is purely additive. The sovereign Kura extension never
calls Arcanea on its own.

### Build your own

The format spec is stable at v0.2.0. Build a Logseq integration, a
Notion sync, a vector-index over your Kura vault, a Quartz publisher —
anything that reads YAML frontmatter and Markdown can read Kura.

PRs welcome.

---

## Install (manual / developer mode)

```bash
git clone https://github.com/frankxai/arcanea-vault kura
cd kura
pnpm install
pnpm build
```

Then in Chrome:

1. Open `chrome://extensions/`.
2. Toggle **Developer mode** (top right).
3. **Load unpacked** → select the `dist/` folder.
4. Pin the extension to the toolbar.

The repo URL is still `arcanea-vault` until the GitHub rename to `kura`
lands — the product name is **Kura** v0.2.0.

---

## Privacy

- Everything captured lives on **your disk** inside `Kura/`.
- IndexedDB is used only as an in-extension lookup index for fast
  cross-conversation queries. The filesystem is the source of truth.
- No telemetry. No analytics. No account required.
- A single optional **Send to Arcanea (opt-in)** button exists in the
  popup for users who want to mirror exports to their Arcanea second-brain.
  It is off by default and never fires without an explicit click.
- Host permissions are limited to the AI platforms the scrapers run on,
  plus `arcanea.ai` for the optional bridge. Nothing else.

Full policy: [arcanea.ai/privacy/kura](https://arcanea.ai/privacy/kura).

---

## Roadmap

| Version | Scope |
|---------|-------|
| **0.2.0** *(current)* | Sovereign Kura: local-first vault, Obsidian-compatible markdown, generic `kura-process` skill, optional `arcanea-kura-process` worldbuilding skill, redesigned popup, sidepanel library, Playwright extension test. |
| **0.3.0** *(in progress)* | Suno Harvester (catalog index + flagged downloads via File System Access), sidepanel tabs, capture keyboard shortcut, WXT build migration, per-platform scraper hardening. |
| 0.3.1 | Core vault writes via File System Access (offscreen document) — no more Downloads-folder hop. |
| 0.4.0 | Real-time graph preview inside the side panel (D3 + frontmatter links); PNG screenshot export. |
| 0.5.0 | Logseq / Anytype integration recipes; Firefox port. |

---

## Development

```bash
pnpm install
pnpm typecheck        # tsc --noEmit
pnpm build            # one-shot production build to dist/
pnpm dev              # watch mode (active dev only)
pnpm lint             # eslint
pnpm test:extension   # Playwright end-to-end against built dist/
```

Stack: TypeScript 5, [WXT](https://wxt.dev) for MV3, Playwright
for browser integration tests.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Kura is built by [Arcanea](https://arcanea.ai) and given to everyone.
Use it for fiction, for code, for therapy notes, for anything you write
with an AI that you want to keep.*
