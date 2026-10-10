# Kura

**Next extension release:** [product requirements, UI/UX, engineering and provider-policy proposal](docs/product/README.md).
This proposal distinguishes implemented behavior from verified provider support and does not announce new integrations.

> **Kura — export your most precious writing.**

A 蔵 (*kura*) is the fireproof storehouse a family used to keep their
most precious scrolls, swords and records. This is the digital one.

Capture the loaded conversation from supported AI pages as Markdown with
frontmatter, source references and optional assets. Open the output in Obsidian,
or process it into Second Brain OS. Official account exports backfill history
that was never opened in the browser.

*Your AI work belongs on your disk, not on someone else's server.*

[![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-0.3.0-00bcd4?style=flat-square)](package.json)
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

1. Install an unpacked extension build using
   [the manual install guide](CHROME_WEB_STORE_GUIDE.md). Chrome Web Store
   availability is not verified by this repository.
2. Open the side panel and **Connect vault** to select a private capture root,
   such as `D:/private-captures/Kura`. Keep raw captures outside the MCP brain vault.
3. Open a supported conversation. ChatGPT, Claude and Gemini threads save after
   streaming settles; use **Export to Kura** or **Alt+Shift+K** for manual capture.
4. Files land at:
   ```
   <selected-capture-root>/<platform>/<YYYY-MM-DD>_<slug>/
   ├── conversation.md
   ├── capture.json
   ├── prompts.md
   └── assets/
   ```
5. Follow [capture and recovery](docs/CAPTURE-TO-BRAIN.md) and
   [the Second Brain processing SOP](https://github.com/frankxai/second-brain-os/blob/main/docs/automation.md).
   Intake creates pending summaries; source review and distillation turn them
   into useful memory.

---

## Supported platforms

The table lists implemented scraper targets. Native folder permission and live
provider DOM checks still need verification. Media availability varies by host
permissions. Google AI Studio archive intake is not claimed by the SBO adapter.

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

### Direct-to-disk vault

Open the side panel and **Connect vault** to pick a private folder. Conversation
capture requires a writable grant. Sources go under `<platform>/`; Suno tracks
go under `suno/`. Repeated captures preserve curated frontmatter and source
revisions. A partial view cannot replace a fuller thread. The writer recovers
existing folders by source ID if the browser index is cleared.

An `!` badge asks for recovery. An `i` badge means text is saved but unsupported
media needs a manual export. Explicit single-file library exports use
non-overwriting Downloads; they do not constitute a completed thread capture.

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

Already exported WAV/MP3 files through Suno's download menu? The
[official-export importer](docs/SUNO-OFFICIAL-INTAKE.md) produces a read-only plan,
then copies selected files into an external intake with SHA-256 receipts and
optional human contribution references. It uses no network or credentials;
rights review and publishing remain separate downstream decisions.

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
git clone https://github.com/frankxai/kura kura
cd kura
pnpm install
pnpm build
```

Then in Chrome:

1. Open `chrome://extensions/`.
2. Toggle **Developer mode** (top right).
3. **Load unpacked** → select the `dist/` folder.
4. Pin the extension to the toolbar.

The repository is `frankxai/kura`; the product name is **Kura** v0.2.0.

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

## Image library pilot — Midjourney + Grok

Open **Library → Open image library** for a full-window local gallery and guided import.
Choose a provider, select an extracted official export folder (or individual images),
preview up to 10 images, connect the Kura folder, check disk space, then import.
A checksum verifies each original after writing. Pause between files, reselect the
same export after restarting, and retry failures without duplicating saved originals.

The pilot supports PNG, JPEG, WebP, GIF and AVIF, including extensionless Grok
image files identified by their headers. Originals keep their exact bytes; thumbnails
are separate. Prompt, generation date, model, settings and source URLs remain
unknown unless explicitly supplied in a companion metadata file. Search covers
available prompts and source filenames; filters cover provider and import date.

**Scope:** imports from local downloads, not an account crawler. Midjourney's Organize
page provides native downloads; Grok provides data download under Settings → Data
Controls. Extract ZIPs before choosing their image folder. Folder totals are measured;
provider-wide history totals remain unknown. Unsupported/non-image files and failures
are counted. There is no claim to have imported your entire provider history.

**Viewing:** desktop Chrome/Edge extension; files remain portable on disk. Mobile,
Vercel hosting and cloud sync are not implemented. No new provider permissions,
credentials, remote fetches, background workers or AI calls are introduced.

**Release gate:** fixture tests prove the intake engine, not access to your accounts.
Real samples from both providers, source metadata comparison, original-file viewing,
restart/resume, available-drive-space checks and independent review must pass before
bulk import is added. See [image intake contract](docs/specs/IMAGE-LIBRARY-PILOT.md)
and [verification record](docs/verification/image-library-pilot.md).

---

## Roadmap

| Version | Scope |
|---------|-------|
| **0.2.0** *(current)* | Sovereign Kura: local-first vault, Obsidian-compatible markdown, generic `kura-process` skill, optional `arcanea-kura-process` worldbuilding skill, redesigned popup, sidepanel library, Playwright extension test. |
| **0.3.0** *(in progress)* | Direct-to-disk vault via File System Access — one connected folder holds conversations (`<platform>/`) and Suno tracks (`suno/`), no Downloads-folder hop; Suno Harvester; sidepanel tabs; capture keyboard shortcut; WXT build migration; per-platform scraper hardening. |
| 0.3.1 | PNG "conversation card" export; ID3 tags + cover art on harvested audio. |
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

<!-- STARLIGHT:OPERATING:BEGIN v2 sha=9f8fecc91edc source=794db1e51a55a128816f7aa266eb0ac1dbd452c3 -->

## Agent operating guidance

Repository agents use the shared Starlight operating contract in `AGENTS.md` alongside local instructions.
The contract asks agents to establish a useful outcome, select relevant skills, complete authorized work,
verify current sources, refine the actual artifact, and report evidence and remaining gates.
It covers human agency, privacy, rights, resource stewardship and bounded proactivity.
Repository identity, brand, canon, build commands and release gates remain local.

[Pinned contract](https://github.com/frankxai/Starlight-Intelligence-System/blob/794db1e51a55a128816f7aa266eb0ac1dbd452c3/docs/architecture/agents-md/band-a.md)
· [Projection and verification](https://github.com/frankxai/Starlight-Intelligence-System/blob/794db1e51a55a128816f7aa266eb0ac1dbd452c3/docs/architecture/AGENTS-MD-CONTRACT.md)

These files supply operating guidance. They do not activate an agent, grant tool permissions,
schedule recurring work, certify compliance or prove a live capability.

<!-- STARLIGHT:OPERATING:END -->
