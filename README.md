# Arcanea Vault — Universal AI Export

> *"What you create across a thousand conversations deserves a home."*

[![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square&logo=opensourceinitiative)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-0.1.0-8b5cf6?style=flat-square)](package.json)
[![Arcanea Ecosystem](https://img.shields.io/badge/Arcanea-Ecosystem-7fffd4?style=flat-square)](https://arcanea.ai)

Export your AI conversations, generated images, videos, and prompts from any major AI platform — directly into your local library or your Arcanea Prompt Books.

---

## Supported Platforms

| Platform | Conversations | Images | Videos | Artifacts |
|----------|:---:|:---:|:---:|:---:|
| ChatGPT (incl. DALL-E) | Yes | Yes | - | - |
| Claude.ai | Yes | - | - | Yes |
| Google Gemini | Yes | Yes | - | - |
| Grok (incl. Imagine) | Yes | Yes | Yes | - |
| DeepSeek | Yes | - | - | - |
| Perplexity | Yes | - | - | - |
| Google AI Studio | Yes | Yes | - | - |

---

## Features

### Core Export
- **Quick Export** — one click captures everything on the current page: conversations, images, prompts
- **Smart Detection** — automatically identifies content type (conversation, gallery, imagine page) and adjusts accordingly
- **Download Queue** — rate-limited background queue downloads media to `ArcaneanVault/<platform>/` subfolders
- **Organized File Naming** — files saved as `ConversationTitle_platform.md` with sanitized filenames

### Export Formats

| Format | Free | Pro | Creator |
|--------|:---:|:---:|:---:|
| Markdown (.md) | Yes | Yes | Yes |
| JSON | Yes | Yes | Yes |
| HTML (styled) | - | Yes | Yes |
| Plain Text (.txt) | - | Yes | Yes |
| PDF | - | Yes | Yes |
| Word (.docx) | - | Yes | Yes |
| CSV | - | Yes | Yes |

### Content Capture
- Conversations with full message history (user + assistant turns)
- Timestamps per message when available
- Inline attachments (images, code blocks)
- Prompt extraction — captures your prompts as a separate indexed collection
- Media items with HD URLs, dimensions, and generation prompt metadata

### Local Storage
- All data stored in IndexedDB — no server, no cloud, no tracking
- Indexed by platform, content type, and capture date
- Queryable by platform for filtered exports
- Settings persisted across sessions

### Arcanea Bridge
- **Send to Prompt Books** — exports content directly to `arcanea.ai/api/vault/import`
- Preserves source platform, conversation structure, and media references
- Enables search and organization within the Arcanea platform

### Extension UI
- Popup shows live detection stats for the current tab (conversations, images, videos, prompts found)
- Badge indicator on the extension icon when on a supported platform
- Side panel for browsing captured content (v0.2.0 roadmap)

---

## Install

### Chrome Web Store

Coming soon. See [CHROME_WEB_STORE_GUIDE.md](CHROME_WEB_STORE_GUIDE.md) for submission status.

### Manual Install (Developer Mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/frankxai/arcanea-vault.git
   cd arcanea-vault
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle, top right)
   - Click **Load unpacked**
   - Select the `dist/` folder

5. Test on a supported platform. Navigate to `https://chatgpt.com` or `https://grok.com`, click the Vault icon in the toolbar, and verify content is detected.

---

## How It Works

### Architecture

```
Browser Tab (ChatGPT, Grok, Claude, etc.)
        |
        | Page content
        v
Content Script (src/content/<platform>.ts)
        |
        | DetectionResult
        v
Background Service Worker (src/background/index.ts)
        |
        +-- IndexedDB (src/core/storage.ts)   <- local vault
        |
        +-- Downloads API                      <- ArcaneanVault/ folder
        |
        +-- arcanea.ai/api/vault/import        <- Arcanea bridge
        |
        v
Popup (src/popup/index.ts)                     <- UI + controls
```

### Content Scripts

Each platform has a dedicated scraper in `src/content/`:

| File | Platform | What it scrapes |
|------|----------|----------------|
| `chatgpt.ts` | ChatGPT / OpenAI | Conversation turns, DALL-E image URLs |
| `claude.ts` | Claude.ai | Conversation turns, artifacts, code blocks |
| `gemini.ts` | Google Gemini + AI Studio | Conversation turns, generated images |
| `grok.ts` | Grok | Conversation turns, Imagine images, Imagine videos |
| `deepseek.ts` | DeepSeek | Conversation turns |
| `perplexity.ts` | Perplexity | Conversation turns, source citations |

Each scraper returns a `DetectionResult` with the same shape, enabling the background worker and popup to handle all platforms uniformly.

### Export Engine

`src/core/exporter.ts` handles format conversion:

- **Markdown**: Full conversation with role headings, timestamps, and inline image references. Appends an Arcanea Vault attribution footer.
- **JSON**: Raw `Conversation` object, structured for programmatic use.
- **HTML**: Self-contained offline viewer with Arcanea-themed styling (dark mode, purple/teal accents).
- **Text**: Plain transcript — compatible with any tool.

### Storage Model

`src/core/storage.ts` uses IndexedDB with three object stores:

| Store | Key | Indexes |
|-------|-----|---------|
| `conversations` | `id` | `platform`, `capturedAt` |
| `media` | `id` | `platform`, `type`, `capturedAt` |
| `prompts` | `id` | `platform`, `capturedAt` |

---

## Development

### Prerequisites

- Node.js 18+
- Chrome 120+ (for MV3 + Side Panel API)

### Commands

```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Type check only
npm run typecheck

# Lint
npm run lint

# Clean dist
npm run clean
```

### Stack

| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | 5.7 | Strict type safety |
| Vite | 5.x | Build tooling |
| @crxjs/vite-plugin | beta.28 | Chrome extension HMR |
| Tailwind CSS | 3.x | Popup/panel styling |
| Chrome MV3 | - | Extension platform |

**Important:** Vite 6 is not compatible with `@crxjs/vite-plugin` beta.28. The project is pinned to Vite 5.

### Project Structure

```
arcanea-vault/
├── manifest.json          # Extension manifest (MV3)
├── popup.html             # Popup entry point
├── sidepanel.html         # Side panel entry point
├── src/
│   ├── background/
│   │   └── index.ts       # Service worker — download queue, message handlers
│   ├── content/
│   │   ├── chatgpt.ts     # ChatGPT scraper
│   │   ├── claude.ts      # Claude.ai scraper
│   │   ├── gemini.ts      # Google Gemini scraper
│   │   ├── grok.ts        # Grok scraper
│   │   ├── deepseek.ts    # DeepSeek scraper
│   │   └── perplexity.ts  # Perplexity scraper
│   ├── core/
│   │   ├── types.ts       # Shared type definitions
│   │   ├── detector.ts    # Platform URL detection
│   │   ├── scraper.ts     # Shared scraping utilities
│   │   ├── storage.ts     # IndexedDB wrapper
│   │   └── exporter.ts    # Format conversion engine
│   ├── popup/
│   │   └── index.ts       # Popup logic and UI
│   └── styles/
│       └── popup.css      # Tailwind entry
├── icons/                 # Extension icons (16, 48, 128px)
└── dist/                  # Built extension (load this in Chrome)
```

### Message Protocol

The popup communicates with the service worker via `chrome.runtime.sendMessage`. Available message types:

| Message Type | Description |
|---|---|
| `VAULT_DETECT_TAB` | Trigger detection on the active tab |
| `VAULT_QUICK_EXPORT` | Detect + save + download in one action |
| `VAULT_SAVE` | Persist a DetectionResult to IndexedDB |
| `VAULT_EXPORT` | Export a stored conversation by ID |
| `VAULT_EXPORT_PROMPTS` | Export all captured prompts |
| `VAULT_DOWNLOAD_MEDIA` | Queue media file downloads |
| `VAULT_SEND_TO_PROMPT_BOOKS` | Bridge content to arcanea.ai |
| `VAULT_STATS` | Get vault storage stats |

---

## Privacy

Arcanea Vault is local-first and privacy-first:

- No data collection
- No analytics
- No tracking or cookies
- All processing happens in your browser
- All data stored in your browser's IndexedDB
- Network requests made only to: the AI platform you are currently on, and `arcanea.ai` when you explicitly use "Send to Prompt Books"

Full privacy policy: [arcanea.ai/vault/privacy](https://arcanea.ai/vault/privacy)

---

## Roadmap

| Version | Feature |
|---------|---------|
| 0.1.0 | Core export — conversations, images, prompts. 6 platforms. IndexedDB storage. |
| 0.2.0 | Side panel library — browse and search captured content |
| 0.3.0 | Bulk session export, date range filtering |
| 0.4.0 | Google Drive and Notion sync integrations |
| 1.0.0 | Chrome Web Store release |

---

## Part of the Arcanea Ecosystem

| Project | Purpose |
|---------|---------|
| [arcanea.ai](https://arcanea.ai) | The Arcanea platform — Prompt Books, Guardian AI, universe building |
| [Arcanea Monorepo](https://github.com/frankxai/Arcanea) | Core SDK, CLI, MCP server, web app |
| [Arcanea Realm](https://github.com/frankxai/arcanea-realm) | AI CLI with Guardian intelligence (OpenCode fork) |
| [Arcanea On-Chain](https://github.com/frankxai/arcanea-onchain) | Blockchain IP and creator economy infrastructure |
| [Starlight Intelligence System](https://github.com/frankxai/Starlight-Intelligence-System) | Persistent context and memory layer for AI agents |

---

## License

[MIT](LICENSE) — Build freely. Create boldly. Own what you make.

---

*Built by [Arcanea](https://arcanea.ai) — Imagine a Good Future. Build It Here.*
