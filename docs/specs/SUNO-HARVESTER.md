# Spec — Suno Harvester module (Kura 0.3)

Status: **build in progress** · Branch: `agent/claude/kura-godmode` · Owner: Claude (Fable 5) swarm

## Why

Frank's Suno catalog (817+ public tracks) feeds frankx.ai music surfaces and the
Arcanea release pipeline. Today indexing/downloading requires a Node scraper or an
LLM agent session. The durable end state: **the extension does the mechanics for
free (zero tokens, no agent session), the human + agents do taste and
orchestration.** The interconnect between extension and agents is **files on
disk**, not an in-extension LLM.

## Non-negotiables

- Zero LLM calls inside the extension. No API keys in extension storage.
- Zero auth against Suno — the public profile API only. Never touch Clerk tokens.
- Human cadence on downloads (2.8–6.5 s jitter, sequential, cancellable).
- Idempotent: re-index rewrites `catalog.jsonl` deterministically; re-fetch skips
  already-downloaded tracks via the ledger.
- Local-first: everything lands in a user-picked intake folder via the File
  System Access API. No Downloads-folder shuffle, no cloud.

## Surfaces

1. **Side panel → "Suno" tab** (primary surface):
   - Intake folder picker (FSA `showDirectoryPicker`, handle persisted in
     IndexedDB, permission re-granted on user gesture).
   - Profile handle input (default `frankx`, persisted in `chrome.storage.local`).
   - **Button 1 — Index**: walks `studio-api.prod.suno.com/api/profiles/<handle>?page=N`
     (24 clips/page, 200 ms page delay, retry w/ backoff on 429/5xx) and rewrites
     `suno/catalog.jsonl`.
   - **Button 2 — Fetch flagged (audio)**: downloads `audioUrl` for every flagged,
     not-yet-downloaded track at human cadence into `suno/audio/`.
   - **Button 3 — Fetch flagged (audio + video)**: same, plus `videoUrl` → `suno/video/`
     and cover → `suno/covers/`.
   - Track browser: search, sort (newest / plays / likes), flag toggle per track,
     flagged/downloaded badges, progress bar + live log during runs, Cancel.
2. **Popup**: when the active tab is `suno.com`, show a Harvester row with an
   "Open side panel" CTA. No Suno content script — the API needs no DOM.

## Intake folder layout

```
<intake root>/suno/
├── catalog.jsonl      # one JSON row per track (schema kura-suno/1)
├── flags.json         # flag interchange — extension AND agents may edit
├── downloads.json     # ledger of completed downloads (extension-owned)
├── audio/<yyyy-mm-dd>_<slug>_<id8>.mp3
├── video/<yyyy-mm-dd>_<slug>_<id8>.mp4
└── covers/<yyyy-mm-dd>_<slug>_<id8>.jpeg
```

### catalog.jsonl row (schema `kura-suno/1`)

```json
{"schema":"kura-suno/1","id":"…","title":"…","createdAt":"…","plays":0,"likes":0,
 "comments":0,"pinned":false,"public":true,"model":"chirp-v4-5","styleTags":"…",
 "duration":214.2,"lyrics":"…","audioUrl":"…","videoUrl":"…","imageUrl":"…",
 "sunoUrl":"https://suno.com/song/<id>","indexedAt":"ISO"}
```

### flags.json (the agent interconnect)

```json
{"version":1,"flags":{"<trackId>":{"audio":true,"video":false,"note":"release candidate"}}}
```

Claude Code / any agent can write flags.json from triage logic
(`scan-triage.mjs`, `/music-triage`); the extension's Fetch buttons consume it.
The extension merges its own UI toggles into the same file (write-through).
**This file replaces any need for an in-extension LLM.**

### downloads.json ledger

```json
{"<trackId>":{"audio":"suno/audio/<file>","video":null,"cover":null,"at":"ISO"}}
```

## Architecture

- `src/core/fs.ts` — FSA layer: pick/persist/re-grant directory handle (IndexedDB
  db `kura-fs`), nested-dir resolution, text/blob writers, JSON read/write.
  Shared with future core-vault FSA migration (0.3.1, via offscreen document).
- `src/suno/types.ts` — `SunoTrack`, `SunoFlags`, `DownloadLedger`.
- `src/suno/api.ts` — profile pagination + clip trimming (mirror of the proven
  `scrape-suno-profile.mjs` field mapping).
- `src/suno/harvester.ts` — index → catalog.jsonl; flags read/merge/write;
  cadenced fetch loop (AbortController, jitter, skip-if-downloaded, ledger update).
- `src/sidepanel/suno.ts` — tab controller (progress UI, list rendering, actions).
- All fetches run from the side panel (extension page → host_permissions grant
  cross-origin; MV3 content scripts do not). No background-SW involvement.

## Manifest deltas

- `host_permissions` += `https://studio-api.prod.suno.com/*`,
  `https://cdn1.suno.ai/*`, `https://cdn2.suno.ai/*`, `https://suno.com/*`.
- No new `permissions` (FSA needs none; it is a web API gated by user gesture).

## Cadence + safety

- Downloads sequential; delay = 2800 ms + random(0–3700 ms).
- Per-run cap default 40 tracks (configurable const), Cancel always available.
- Index pagination: 200 ms/page, 5-attempt backoff on 429/5xx (matches the
  Node scraper that has run cleanly against this API).
- Only the user's own public catalog; no auth, no scraping evasion.

## BYOK LLM — decision

**No LLM inside the extension.** Rationale:
1. Kura's brand moat is the privacy contract (local-first, no cloud, no keys).
   BYOK breaks it and complicates Web Store review.
2. The mechanical loop must stay token-free — that is the whole point.
3. Judgment lives where judgment already runs: Claude Code / MCP reading the
   vault + catalog.jsonl from disk and writing flags.json back. File-based
   interconnect is durable, debuggable, harness-agnostic.
4. If tighter coupling is ever wanted: a local MCP server reading the intake
   folder (zero extension changes) or Native Messaging (0.5+, only if a real
   use case appears).

## Out of scope (this pass)

- Authed/private clips, other users' catalogs, playlist-level indexing.
- DOM-click download fallback (only if CDN URLs ever stop working).
- Scheduled/background auto-index (needs `alarms` + offscreen FSA — 0.4).
