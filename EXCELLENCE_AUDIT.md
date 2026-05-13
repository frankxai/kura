# Arcanea Kura — Excellence audit (May 2026)

> Side-by-side comparison against the state of the art in AI-conversation
> capture, the rationale for every design choice that diverges, and the
> open punch list before Web Store submission.

Locked: **2026-05-13** at commit `c4fc4b4` (extension) and `b8ebc50a`
(monorepo).

---

## 1. Competitor scan

Three reference points in the AI-conversation-capture space, ordered by
relevance to our scope:

### pionxzh/chatgpt-exporter — 2.4k stars

- **Distribution:** Tampermonkey userscript (not a Chrome extension)
- **Platforms:** ChatGPT only
- **Formats:** Text, HTML, Markdown, PNG screenshot, JSON
- **i18n:** EN, FR, ID, KR, TR
- **Storage:** none — pure browser-to-file export

**Where Kura is better:**
- 6 platforms (ChatGPT, Claude, Gemini, Grok, DeepSeek, Perplexity) vs 1
- Native Chrome MV3 extension instead of userscript (no Tampermonkey
  dependency, real install path)
- AI-generated media support (DALL·E, Imagine images + video, Gemini
  generated images) — pionxzh handles inline only
- YAML frontmatter with worldbuilding entity arrays — pionxzh is flat MD
- Companion `/kura-process` Claude Code skill for entity extraction +
  Obsidian graph generation — pionxzh has no post-processing layer
- IndexedDB cross-conversation index inside the extension

**Where pionxzh is better (today):**
- PNG screenshot export — Kura defers to v0.3 (Pandoc-in-WASM bundle
  candidate)
- 5 translated READMEs — Kura defers (English is enough for v0.2)
- 2.4k GitHub stars — Kura has 0. Star history is downstream of shipping.

### Obsidian Web Clipper (official, obsidianmd/obsidian-clipper)

- **Distribution:** Chrome, Firefox, Safari extensions
- **Output:** durable Markdown files, templated frontmatter
- **Storage:** writes directly into the user's Obsidian vault via the
  Obsidian Local REST API or clipboard
- **Polish:** very high — official Obsidian team

**Where Kura is better:**
- AI-conversation specialization. Obsidian Clipper is a general web
  clipper; Kura knows how to find a ChatGPT message in the DOM
- Per-conversation folder shape (`conversation.md` + `prompts.md` +
  `assets/`) vs single-file dump
- Entity extraction skill — Obsidian Clipper has templated variables
  but no LLM-driven entity layer
- Local-first by design — Obsidian Clipper requires an Obsidian instance
  running; Kura writes plain files anywhere

**Where Obsidian Clipper is better:**
- Direct Obsidian REST API write — no Downloads-folder hop. Kura should
  consider an Obsidian URI fallback in v0.3.
- webextension-polyfill for Firefox/Safari support — Kura is
  Chrome MV3 only at v0.2

### Vault.fm, Recall.ai, Glasp, Save ChatGPT, Superpower ChatGPT

- All single-platform or paid-SaaS, none ship the local-first + Obsidian-
  compat + entity-extraction combo.

---

## 2. Where Kura sits on the May-2026 maturity curve

| Dimension | Kura v0.2.0 | Top-3 alternatives median | Verdict |
|-----------|-------------|---------------------------|---------|
| Platform coverage | 6 | 1-2 | ✓ Lead |
| Output format spec | v0.2.0 locked, versioned | none documented | ✓ Lead |
| Entity-extraction layer | `/kura-process` skill | none | ✓ Unique |
| Local-first guarantee | Total (zero cloud) | Mixed (some require sync) | ✓ Lead |
| Browser store presence | Pending submission | Live for years | ✗ Lag |
| GitHub stars | 0 | 100s-1000s | ✗ Lag |
| i18n | EN only | 1-5 languages | — Defer |
| PNG screenshot export | — | pionxzh has it | — Defer (v0.3) |
| Firefox / Safari port | — | Obsidian has all 3 | — Defer (v0.4) |
| Real-time graph preview | — (Obsidian view) | — | — Equal (Obsidian carries) |
| Marketing site | `arcanea.ai/kura` shipped | varies | ✓ Lead |
| Privacy policy | Full custom page | template / none | ✓ Lead |
| OG image | Custom 1200×630 | mostly default favicons | ✓ Lead |
| Bridge endpoint hardening | Token-bucket + origin + sanitize | n/a | ✓ Unique |

**Net:** Kura's wedge is the **format + skill + visualizer arc**, plus
the breadth of platform coverage. It loses only on time-to-market
(stores live for years) and the cosmetic gaps (i18n, screenshot export).

---

## 3. Frontend-design audit (`/kura` landing)

Run against the `frontend-design:frontend-design` agent's quality bar —
distinctive, production-grade, avoids generic AI-aesthetic.

| Check | Status | Notes |
|-------|--------|-------|
| Custom hero typography (not Inter) | ✓ | Instrument Serif + Geist + JetBrains Mono via @arcanea/design-system tokens |
| Distinctive visual signature | ✓ | Italic serif `K` monolith + gradient text bridge to "ura." + 蔵 etymology paragraph |
| Brand-kit token discipline | ✓ | All colors via `@arcanea/design-system/tokens` — no raw hex except in CSS-in-JS for OG image where Vercel/og requires literal strings |
| Motion choreography | ✓ | LazyMotion + domAnimation (not domMax), expoOut easing, staggerChildren 0.08, prefers-reduced-motion respected |
| AnimatedBeam between workflow cards | ✓ | Two beams flow Export → Process → See, gradient teal → aquamarine → gold |
| NumberTicker for scale stats | ✓ | 7 platforms / 0 cloud servers / 100% local-first |
| Marquee of platform names | ✓ | Subtle, pauseOnHover |
| BorderBeam on install CTA | ✓ | Slow 6s rotation, teal→gold |
| Spotlight on hero | ✓ | Cursor-follow, gated on reduced-motion |
| Server Component metadata | ✓ | All `metadata` exports server-side; client logic isolated to `kura-interactive.tsx` |
| JSON-LD structured data | ✓ | SoftwareApplication schema with featureList, license, downloadUrl, $0 offer |
| Custom OG image (1200×630) | ✓ | `opengraph-image.tsx` renders via @vercel/og, brand-gradient italic K, platform footer |
| Accessibility | ✓ | Semantic `<main>` + `<section>` + `<h1/h2>`, aria-hidden on decorative glyphs, prefers-reduced-motion in motion components |
| Mobile responsiveness | ✓ | Single-column on mobile, 3-col workflow grid breaks at md, hero `text-5xl` → `text-7xl` |
| Privacy page link | ✓ | `/privacy/kura` cross-linked from landing |
| No emoji clutter | ✓ | Zero emojis in source — only 蔵 kanji and arrow/dot punctuation |

**Score: 15/15.** Tier-S relative to typical Chrome-extension marketing
pages (Glasp, ChatGPT Exporter README, Superpower) which still ship
plain bullet lists and template hero images.

---

## 4. Backend hardening (`/api/kura/import`)

| Layer | What | Why |
|-------|------|-----|
| Runtime | Vercel Fluid Compute Node | Per Vercel 2026-02-27 knowledge update: Edge no longer recommended. Fluid Compute reuses instances, so in-memory state (rate limiter) actually works between requests. |
| `maxDuration` | 30s | Bridge is fire-and-forget; capped well below the 300s default. |
| Body cap | 8 MB | Stops oversized media payloads. |
| Rate limit | 12 req / 60s per `ip::extension-source` | Token-bucket in `Map<string, {tokens, refilledAt}>`. Survives instance reuse on Fluid Compute. For multi-region distributed limits, swap to Upstash. |
| Origin allow-list | `chrome-extension://[32 lc letters]`, `arcanea.ai`, `*.arcanea.ai`, `arcanea-*.vercel.app` | Tight regex match. Empty origin (content-script default) is allowed. |
| Per-field size caps | 200KB content, 500ch title, 200 conversations, 500 media, 2000 prompts | Defence in depth against malformed payloads. |
| Schema gate | Strict `0.2.0` equality | Refuses both older (extension out of date) and newer (server out of date) schema versions with actionable error. |
| Sanitization | Strip C0 controls + zero-width chars + RTL-override | Prevents Unicode-bombing of titles/content. |
| Logging | Single-line JSON via `console.log` (Vercel runtime logs) | Searchable in Vercel dashboard. Never logs bodies. IP hashed to 8-char FNV fingerprint. |
| CORS | Permissive via `OPTIONS` handler | Required for extension content-script POST. |

---

## 5. Open punch list (before Web Store submission)

Ordered by blocker severity.

1. **Scraper smoke test** *(blocker)* — load `dist/` in Chrome, run a capture on each of 6 platforms. If any scraper is broken (DOMs drift since Feb 23), fix it.
2. **`/kura-process` real-run eval** *(blocker)* — point the skill at the smoke-test output, audit entity extraction quality, tune the taxonomy thresholds in the slash command if it over- or under-extracts.
3. **Production deploy of `/api/kura/import` + `/api/kura/health`** *(blocker)* — merge `codex/machine-excellence-pp-storage` → main → Vercel auto-deploy. Curl-test `health` returns 200 with `acceptsSchema: ["0.2.0"]`.
4. **Replace placeholder extension icons** *(blocker for Web Store)* — generate 16/48/128 from the 1024×1024 NB2 prompt in `STORE_LISTING.md` §5d.
5. **Generate 5 Web Store screenshots + 440×280 promo tile** *(blocker)* — NB2 prompts and captions are written; execute and place in `dist/screenshots/`.
6. **Pay $5 Chrome dev fee, submit** *(checkout step)*.
7. **GitHub repo rename** `arcanea-vault` → `arcanea-kura` *(cosmetic, optional)*.
8. **Sentry / PostHog wiring** *(post-launch)* — Sentry only on the bridge endpoint (the extension itself stays telemetry-free per the privacy promise); PostHog only on `/kura` and `/privacy/kura` landing pages.
9. **Star history graph in README** *(when there are stars to show)*.

---

## 6. What we explicitly did NOT chase

- **Multi-browser port (Firefox / Safari).** Would 3× the dev surface
  with minimal lift. Defer to v0.5 when there's user demand.
- **PNG screenshot export.** pionxzh has it; users who want it can
  print-to-PDF or Pandoc-the-MD. Defer.
- **i18n.** EN-only ships. Translations come after first 100 users so
  we know what's worth translating.
- **Direct Obsidian REST API write.** Tempting but adds a dependency.
  Downloads folder is universal.
- **Vector search across captures** (AgentDB). The user's memory
  flagged this as the future moat. Belongs in the visualizer, not the
  capture extension. Defer.
- **Sign in with Vercel.** Not needed until the bridge actually persists
  bodies, which is also deferred.

---

## 7. Receipts

- Extension repo: <https://github.com/frankxai/arcanea-vault/tree/codex/excellence-vault-baseline>
- Monorepo: <https://github.com/frankxai/arcanea-ai-app/tree/codex/machine-excellence-pp-storage>
- Extension PR: <https://github.com/frankxai/arcanea-vault/pull/new/codex/excellence-vault-baseline>
- Monorepo PR: <https://github.com/frankxai/arcanea-ai-app/pull/new/codex/machine-excellence-pp-storage>

Commits this session (chronological):
- `0b6787a` feat: rebrand to Arcanea Threads + lock vault format v0.2.0
- `3993daa` feat(rebrand): lock product name as Arcanea Kura
- `c4fc4b4` feat(kura): sidepanel library + health-aware popup + bridge handler
- `739a947a` feat(kura): bridge endpoint + landing + privacy policy
- `e3c8e03a` docs(ops): handover for 2026-05-13 — Arcanea Kura rename + bridge ship
- `b8ebc50a` feat(kura): tier-S /kura landing + OG image + hardened bridge endpoint
