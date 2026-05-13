# Arcanea Threads

**Capture every AI conversation into a local, Obsidian-compatible vault on
your machine.**

ChatGPT, Claude, Grok, Gemini, DeepSeek, Perplexity — one click, every
thread becomes a Markdown note with YAML frontmatter, wikilinks, and
asset folders. Drop the folder into Obsidian and you get the knowledge
graph for free.

> *Your AI work belongs on your disk, not on someone else's server.*

[![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-0.2.0-00bcd4?style=flat-square)](package.json)
[![Schema](https://img.shields.io/badge/schema-v0.2.0-7fffd4?style=flat-square)](FORMAT_SPEC.md)
[![Local-first](https://img.shields.io/badge/local--first-yes-22c55e?style=flat-square)](#privacy)

---

## Why this exists

You spend hours per week inside AI tools. Every conversation is real
intellectual work — outlines, drafts, characters, lore, code, decisions.
And almost all of it dies in someone else's sidebar.

Arcanea Threads is the **capture layer**. It does one thing well:

1. Detect the platform you're on.
2. Scrape the thread cleanly.
3. Write it to `ArcaneaThreads/` on disk as Obsidian-compatible Markdown.

What you do with it after is *yours*. Point Obsidian at the folder and
get the graph. Run a Claude Code skill to extract worldbuilding entities.
Pipe it into your second brain of choice. The extension never assumes.

---

## Quick start

1. Install the extension *(Chrome Web Store link coming with v0.2.0
   submission — see [CHROME_WEB_STORE_GUIDE.md](CHROME_WEB_STORE_GUIDE.md)
   for manual install while it's in review)*.
2. Open a conversation on ChatGPT, Claude, Gemini, Grok, DeepSeek or
   Perplexity.
3. Click the Arcanea Threads icon → **Capture to vault**.
4. Files land at:
   ```
   ~/Downloads/ArcaneaThreads/<platform>/<YYYY-MM-DD>_<slug>/
   ├── conversation.md
   ├── prompts.md
   └── assets/
   ```
5. Open `~/Downloads/ArcaneaThreads/` as a new Obsidian vault — the
   wikilinks, backlinks, and graph view light up immediately.

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

---

## What gets written

Every captured thread becomes a folder. Inside, a single Markdown file
is the canonical record:

```markdown
---
id: a8d9e1c4-...
slug: 2026-05-13_naming-the-extension
title: "Naming the extension"
platform: chatgpt
source: https://chatgpt.com/c/a8d9e1c4
capturedAt: 2026-05-13T22:14:00+02:00
capturedBy: arcanea-threads/0.2.0
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

What if we renamed the vault to something that points at the connection-graph end state?

## ChatGPT

Three candidates worth considering — Threads, Capture, Scribe …
```

The frontmatter is the **contract** — anything you build on top of the
vault (skills, dashboards, automations) reads from those fields.

Full schema: **[FORMAT_SPEC.md](FORMAT_SPEC.md)**.

---

## The workflow this enables

The extension is one piece of a three-stage system:

```
┌──────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  Capture         │ →  │  Process           │ →  │  See               │
│  (this ext)      │    │  (Claude Code skill│    │  (Obsidian graph,  │
│                  │    │   /threads-process)│    │   second-brain UI) │
└──────────────────┘    └────────────────────┘    └────────────────────┘
   browser → disk         disk → entity links        disk → visual graph
```

- **Capture** (this repo): the extension. Local-first. No account.
- **Process** (Claude Code): the [`threads-process`](.claude/commands/threads-process.md)
  skill walks `ArcaneaThreads/` and emits `_entities/` notes for
  characters, locations, artifacts, lore — fully Obsidian-linked.
- **See**: Obsidian's native graph view shows the connections forming in
  real time. Later, the Arcanea second-brain visualizer rebuilds this in
  3D, but that is deferred — Obsidian carries day one.

The moat is **not the extension**. It is the format + the skill + the
eventual visualizer. The extension is the on-ramp.

---

## Install (manual / developer mode)

```bash
git clone https://github.com/frankxai/arcanea-vault arcanea-threads
cd arcanea-threads
pnpm install
pnpm build
```

Then in Chrome:

1. Open `chrome://extensions/`.
2. Toggle **Developer mode** (top right).
3. **Load unpacked** → select the `dist/` folder.
4. Pin the extension to the toolbar.

The repo URL is still `arcanea-vault` until the GitHub rename lands — the
product name is **Arcanea Threads** v0.2.0.

---

## Privacy

- Everything captured lives on **your disk** inside `ArcaneaThreads/`.
- IndexedDB is used only as an in-extension lookup index for fast
  cross-conversation queries. The filesystem is the source of truth.
- No telemetry. No analytics. No account required.
- A single optional **"Send to Arcanea"** button exists in the popup for
  users who want to mirror captures to their Arcanea second-brain. It is
  off by default and never fires without an explicit click.
- Host permissions are limited to the AI platforms the scrapers run on,
  plus `arcanea.ai` for the optional bridge. Nothing else.

---

## Roadmap

| Version | Scope |
|---------|-------|
| **0.2.0** *(current)* | Local-first vault, Obsidian-compatible markdown, `threads-process` skill, redesigned popup. |
| 0.2.1 | Side-panel browser for the local vault; in-extension search. |
| 0.3.0 | Per-platform scraper hardening (DOM drift fixes); idempotent re-capture. |
| 0.4.0 | Real-time graph preview inside the side panel (D3 + frontmatter links). |
| 0.5.0 | Arcanea second-brain bridge: opt-in mirror of `_entities/` into the user's Living Worlds graph. |

---

## Development

```bash
pnpm install          # workspace install
pnpm typecheck        # TS check
pnpm build            # one-shot production build to dist/
pnpm dev              # watch mode (for active development only)
pnpm lint             # eslint
```

Stack: TypeScript 5, Vite 5, `@crxjs/vite-plugin` for MV3, Tailwind 3
(currently only for the unused side-panel scaffold).

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built by [Frank](https://arcanea.ai) as the capture on-ramp for the
Arcanea creative OS.*
