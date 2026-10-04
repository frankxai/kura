# Kura — Chrome Web Store listing

> Submission package. Copy each section verbatim into the Web Store
> developer dashboard. Update only the URLs (privacy policy, repo) once
> the corresponding pages are live on `arcanea.ai`.

---

## 1. Listing metadata

| Field | Value |
|-------|-------|
| **Item name** | Kura |
| **Summary** (132 chars max) | Export your AI conversations from ChatGPT, Claude, Grok, Gemini, DeepSeek, Perplexity to a local Obsidian vault. Local-first. |
| **Category** | Productivity |
| **Language** | English (en) |
| **Item type** | Single-purpose extension |
| **Detailed description** | See §2 |
| **Privacy policy URL** | `https://arcanea.ai/privacy/kura` |
| **Homepage URL** | `https://arcanea.ai/kura` |
| **Support URL** | `https://github.com/frankxai/arcanea-vault/issues` |
| **Single purpose** | Capture conversations and AI-generated media from a fixed set of AI chat platforms and write them as Markdown to the user's local Downloads folder. |

---

## 2. Detailed description (Markdown — Web Store renders plain text)

```
Kura — export your most precious writing.

A 蔵 (kura) is the fireproof storehouse a family used to keep their most
valuable scrolls and records. This is the digital one for your AI work.

What Kura does
----------------------
- Detects when you're on ChatGPT, Claude, Grok, Gemini, DeepSeek or
  Perplexity.
- Pulls the current conversation, the user prompts, and any
  AI-generated images or videos.
- Writes it all to ~/Downloads/Kura/ on your computer as
  Obsidian-compatible Markdown with YAML frontmatter, wikilinks, and
  per-conversation asset folders.

Local-first. No tracking.
-------------------------
- Your captures live on your disk. Nowhere else.
- No account. No telemetry. No analytics.
- An optional "Send to Arcanea" button mirrors a capture to your
  Arcanea second-brain account — off by default, fires only when you
  explicitly click it.

Works with Obsidian out of the box
----------------------------------
- Open the Kura/ folder as an Obsidian vault. The graph view
  builds itself from the wikilinks in the frontmatter.
- Compatible with Dataview, Templater, and other Obsidian plugins that
  read frontmatter.

Works with Claude Code
----------------------
- The included /kura-process slash command walks the vault, extracts
  characters, locations, artifacts and lore from each conversation,
  and emits per-entity notes that link back to their sources.
- Idempotent. Never overwrites canon. Never invents.

Supported platforms
-------------------
- ChatGPT (chatgpt.com, chat.openai.com) — conversations, DALL·E images
- Claude (claude.ai) — conversations, inline images
- Google Gemini (gemini.google.com, aistudio.google.com) — conversations, generated images
- Grok (grok.com) — conversations, Imagine images + videos
- DeepSeek (chat.deepseek.com) — conversations
- Perplexity (perplexity.ai) — conversations

Why a Japanese name
-------------------
Kura (蔵) means a sacred, fireproof storehouse for things worth
preserving. The name says exactly what the extension does: it keeps
your most precious writing safe and private, on the one machine you
control.

Open source
-----------
MIT-licensed. Source: https://github.com/frankxai/arcanea-vault
```

---

## 3. Permissions justifications

The Web Store reviewer scrutinizes each permission. Paste these one-liners
into the matching fields.

| Permission | Justification |
|------------|---------------|
| `activeTab` | Read the current tab's URL to detect which AI platform the user is on, and inject a content script to extract the conversation. Only used when the user clicks the extension icon. |
| `downloads` | Write captured Markdown notes and media files to the user's Downloads folder under `Kura/`. The extension's entire purpose. |
| `storage` | Persist user preferences (export format, default platform filter) and an in-extension IndexedDB index of captured conversations for fast lookup. No data leaves the device. |
| `scripting` | Required to inject the per-platform content scripts that read the DOM of each supported AI tool. |
| `sidePanel` | Render the side-panel browser for captured conversations (in v0.2.1 — currently a placeholder). |

### Host permissions

Each host is justified by the corresponding scraper. Paste this single
block in the host-permissions justification field:

```
The extension scrapes conversations and prompts from the user's open
tab on each supported AI platform. Each host pattern matches exactly
one platform:
- grok.com, assets.grok.com, imagine-public.x.ai — Grok conversations,
  Imagine images and Imagine videos
- chatgpt.com, chat.openai.com — ChatGPT conversations and DALL·E images
- claude.ai — Claude conversations
- gemini.google.com, aistudio.google.com — Gemini conversations and
  generated images
- chat.deepseek.com — DeepSeek conversations
- www.perplexity.ai — Perplexity conversations
- arcanea.ai — optional, only used when the user explicitly clicks
  "Send to Arcanea" to mirror a capture to their Arcanea second-brain
  account. Off by default.
The extension does not make network requests to any host outside this
allow-list.
```

---

## 4. Privacy practices form

The form on the dashboard asks one yes/no per data type. Answers:

| Data type | Collected? | Notes |
|-----------|------------|-------|
| Personally identifiable information | **No** | The extension never collects user identity. |
| Health information | **No** | — |
| Financial information | **No** | — |
| Authentication information | **No** | No login flow inside the extension. |
| Personal communications | **Captured locally only** | The user's AI conversations are written to their own Downloads folder. The extension does not transmit them. |
| Location | **No** | — |
| Web history | **No** | — |
| User activity | **No** | — |
| Website content | **Captured locally only** | The text and media of supported AI platforms is read and written to disk on user action. |

Check the boxes:
- [x] I do not sell or transfer user data to third parties
- [x] I do not use or transfer user data for purposes unrelated to the
      item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness
      or for lending purposes

---

## 5. Assets to generate

The dist/ build is ready. These five image assets still need to be made
before submission. **Estimated total: 2–3 hours with the right prompt.**

### 5a. Promo tile — 440×280

Required. Shown on the Web Store search results page.

**Prompt for NB2 (`gemini-3.1-flash-image-preview`):**

```
A premium product image at 440×280, 1.57:1 aspect ratio.
Subject: a glowing Japanese kura (蔵) storehouse made of soft teal and
gold light, floating in deep cosmic blue space. The kura's door is
slightly open, with rays of teal light streaming out and forming the
outline of a stylized "A" (for Arcanea). On the foreground, in
restrained white sans-serif type, the words "Kura" with the
tagline "Export your most precious writing" beneath. Style: editorial,
Apple-level product photography, minimalist, no clutter. Color palette:
Atlantean teal (#00bcd4), cosmic blue (#0d47a1), gold (#ffd700),
near-black background (#09090b). High contrast. The image should feel
calm, valuable, sacred — like a vault for treasured things.
```

### 5b. Marquee promo tile — 1400×560 (optional)

Use the same prompt at 2.5:1 aspect ratio, with the kura centered and
more space for tagline + a single line: *"Local-first. No tracking. Open
source."*

### 5c. Screenshots — 1280×800 (5 total, required)

After running `pnpm build` and loading the unpacked `dist/` in Chrome:

| # | Screenshot | Caption (≤ 132 chars) |
|---|-----------|----------------------|
| 1 | Popup open on a ChatGPT tab, "Conversations 1" highlighted | One click captures the entire conversation, prompts and images to a folder on your disk. |
| 2 | Popup with format dropdown open, showing Markdown / JSON / HTML / Plain text | Pick a format. Markdown is Obsidian-ready out of the box. |
| 3 | Obsidian graph view of a 50-conversation Kura/ vault | Drop the folder into Obsidian. The knowledge graph builds itself. |
| 4 | Conversation.md file open in VS Code showing the YAML frontmatter | Every conversation gets a YAML contract that worldbuilding skills can read. |
| 5 | Claude Code terminal showing `/kura-process` extracting entities | Run /kura-process to turn raw captures into a linked entity graph. |

**For each screenshot:**
- Use the production build from `dist/`, not the dev server.
- Show the new teal/gold tokens, not the old purple.
- Use a real conversation about something creative (worldbuilding,
  writing) — not a tech support thread. The audience is creators.
- Background browser content should be a real platform UI, not stubbed.

### 5d. Icon set

Already present in `icons/icon-16.png`, `48.png`, `128.png`. Replace with
the new Kura-themed icon — a soft glowing 蔵 (kura) glyph on dark
background, teal/gold accent. Generate once at 1024×1024 with NB2 then
downsample.

**Icon prompt:**

```
A premium app icon at 1024×1024 px, square. Subject: a single calligraphic
Japanese kanji 蔵 (kura), rendered in liquid Atlantean teal gradient
(#00bcd4 → #0d47a1), with a single subtle gold highlight on the top
stroke. Background: deep near-black (#09090b) with a faint cosmic blue
glow radiating from behind the character. Style: Apple-level icon design,
restrained, sacred. The character should fill 75% of the canvas. No
border, no text, no embellishment.
```

---

## 6. Submission checklist

- [ ] `pnpm build` produces clean `dist/`
- [ ] Manifest version, package.json version, README badge all read `0.3.0`
- [ ] Privacy policy page is live at `https://arcanea.ai/privacy/kura`
- [ ] Marketing page is live at `https://arcanea.ai/kura`
- [ ] 5 screenshots + 1 promo tile + 1 marquee tile (optional) generated
- [ ] New icon set replaces placeholder icons
- [ ] `$5` Chrome developer fee paid (one-time)
- [ ] Submission form filled per §1, §3, §4
- [ ] Test the unpacked `dist/` against a real ChatGPT, Claude, and Grok
      conversation; verify files land in `~/Downloads/Kura/`
- [ ] Submit → expect 1-3 business days for review
