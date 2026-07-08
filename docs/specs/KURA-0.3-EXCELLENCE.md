# Spec — Kura 0.3 excellence pass

Status: **build in progress** · Branch: `agent/claude/kura-godmode`

Goal: close the gap to best-in-class (Obsidian Web Clipper polish, pionxzh
format breadth) while keeping Kura's leads: 6-platform coverage, versioned
format spec, entity-extraction skill, total local-first guarantee.

## Shipping in this pass

1. **Suno Harvester** — see `SUNO-HARVESTER.md`. First non-conversation
   harvester; proves the "mechanics for free" pattern and the FSA layer.
2. **File System Access foundation** (`src/core/fs.ts`) — directory handle
   pick/persist/re-grant + writers. Used by Suno now; the core vault migrates
   in 0.3.1 via an offscreen document so `chrome.downloads` stops being the
   only write path.
3. **Side panel information architecture** — tab bar (Library | Suno), so new
   harvester surfaces have a home. Library keeps search + platform filter.
4. **UI/UX polish (design-token discipline)** — Arcanea tokens only
   (`--teal`/`--gold`/zinc surfaces, Geist / Instrument Serif / JetBrains Mono;
   never Inter). Empty states with a next-action, progress feedback on every
   long operation, error surfaces that say what to do, focus-visible states,
   `prefers-reduced-motion` respected, aria labels on icon-only controls.

## Backlog to 0.4 / Web Store (ordered by leverage)

1. Scraper smoke test on all 6 platforms (DOM drift since Feb) — **store blocker**.
2. Real icons + 5 store screenshots + promo tile (NB2 prompts exist in
   STORE_LISTING.md; run through Higgsfield discipline: brief + ledger).
3. `/kura-process` real-run eval on fresh captures.
4. Bridge endpoint deploy verification (`/api/kura/health` 200).
5. Core vault → FSA write path (offscreen document), Downloads fallback kept.
6. Idempotent re-capture guarantee + tests.
7. In-panel full-text search over message bodies at scale (index in
   `storage.ts` instead of linear scan) — current scan is fine to ~1k captures.
8. Keyboard shortcut (`chrome.commands`) for capture; options page.
9. PNG screenshot export; i18n; Firefox port (webextension-polyfill) — post-store.

## Legacy debt tracked

- `THREADS_*` / `VAULT_*` message aliases removed once content scripts migrate
  (v0.3 close-out).
- `TIER_LIMITS` in `types.ts` is dead product scaffolding — remove or wire; do
  not ship half-implied paywalls in a local-first free tool.
