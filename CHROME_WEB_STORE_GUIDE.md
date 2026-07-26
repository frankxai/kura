# Kura Chrome Web Store release guide

> **Release state:** packaging and automated extension tests are available. This is **not yet ready to submit** until every blocker below has an evidence receipt.
>
> Product: **Kura** · package/schema: **0.2.0** · Chrome MV3 · local-first.

## What Kura truthfully does today

Kura captures the currently open conversation from ChatGPT, Claude, Gemini, Grok, DeepSeek, or Perplexity into local, Obsidian-compatible Markdown. It also includes a local side-panel library and a Suno harvester that writes only into a user-selected local folder.

- Capture is explicit: popup **Export to Kura** or `Alt+Shift+K` on a supported conversation.
- Raw output remains on the user's disk. Kura does not require an account or send conversation content to a Kura server.
- The optional `Send to Arcanea` integration is a separate, explicit user action. It must remain visibly opt-in and must never be described as part of the standard export path.
- Current output contract is `FORMAT_SPEC.md` v0.2.0. Do not advertise PDF, DOCX, CSV, automatic cloud sync, or a batch export of an entire provider history.

## Reproducible release commands

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:bridge
pnpm test:extension
pnpm package:store
```

`pnpm package:store` calls WXT and produces:

```text
dist/kura-0.2.0-chrome.zip
```

Upload that ZIP only after the manual acceptance gates are complete. Never zip source folders, `node_modules`, test results, or a stale build directory manually.

## Developer-mode dogfood

1. Build the extension with `pnpm build`.
2. Open `chrome://extensions/` in the intended Chrome profile.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this checkout's `dist/` directory.
5. Pin **Kura** to the toolbar.
6. On a non-sensitive, disposable conversation for each supported platform, use **Export to Kura**.
7. Confirm the export appears under the Chrome download location as `Kura/<platform>/<slug>/conversation.md` with the expected frontmatter and no duplicate suffix on re-capture.
8. Run the local bridge only after the two-platform dogfood capture passes. See `docs/KURA-SIS-DOGFOOD.md`.

Do not use unattended GUI/computer-use automation to crawl chat history. Kura is deliberately a user-triggered capture tool; signed-in browser state is needed only while a person chooses to export a rendered conversation.

## Manual Store blockers

All entries require dated evidence in the release PR or a release receipt.

- [ ] **Scraper compatibility:** one live, non-sensitive capture each from ChatGPT, Claude, Gemini, Grok, DeepSeek, and Perplexity. Record platform, date, extension version, and output path; never commit chat contents.
- [ ] **Re-capture behavior:** prove that re-capturing the same platform conversation does not create a duplicate conversation folder or destroy user-controlled frontmatter.
- [ ] **Real icons:** replace the current tiny placeholder assets with final 16, 48, and 128 px PNGs. Inspect the packaged assets, not just source files.
- [ ] **Store media:** create at least one accurate 1280×800 or 640×400 screenshot and a 440×280 promo tile. Screenshots must show actual current UI, never mocked future functionality.
- [ ] **Listing copy:** use the truthful description below and ensure it matches current permissions and UI.
- [ ] **Privacy disclosure:** publish and link the current Kura privacy policy before submission. It must disclose local file writes, every host-permission class, and the explicit optional Arcanea route.
- [ ] **Permissions audit:** validate that `wxt.config.ts` host permissions match active scrapers and the optional Arcanea integration. Do not add broad host permissions for marketing convenience.
- [ ] **Chrome developer account:** registration/payment and final public submission are an operator action; do not automate a payment or publish a package without explicit approval.

## Chrome Web Store listing draft

### Name

```text
Kura — Export AI conversations to Markdown
```

### Short description (132 characters maximum)

```text
Export the current AI conversation to local, Obsidian-ready Markdown. ChatGPT, Claude, Gemini, Grok, DeepSeek and Perplexity.
```

### Detailed description

```text
Kura exports the AI conversations you choose to keep.

On a supported ChatGPT, Claude, Gemini, Grok, DeepSeek or Perplexity conversation, click Export to Kura or use the Kura shortcut. Kura saves an Obsidian-compatible Markdown folder in your local Downloads/Kura directory, including the conversation, extracted prompts and adjacent media where available.

LOCAL-FIRST
- No Kura account required
- No analytics or tracking in the standard export flow
- Your exported conversations stay on your disk

SUPPORTED SURFACES
- ChatGPT
- Claude
- Google Gemini and Google AI Studio
- Grok
- DeepSeek
- Perplexity

Kura captures the currently open conversation. It does not automatically export an entire account history or upload conversations to a Kura service.
```

### Privacy answers (draft; verify against the submitted build)

| Store question | Accurate answer |
| --- | --- |
| Single purpose | Export user-selected AI conversations and associated local media into Markdown files. |
| Data collection | Standard export processing is local to the browser/device; Kura does not collect or sell conversation content. |
| Host permissions | Required only to detect and extract a user-selected conversation on explicitly supported AI and Suno domains, plus the explicit optional Arcanea integration. |
| Remote code | No remote executable code. |
| Optional network route | The separate Send to Arcanea action is user-triggered and must be disclosed as optional. |

## Release receipt

A release candidate is eligible for review only when it includes:

```text
Kura release candidate <version>
Commit: <sha>
Package: dist/kura-<version>-chrome.zip
Automated: typecheck / lint / bridge tests / extension tests
Manual platform captures: <six dated receipts>
Re-capture check: <receipt>
Store assets: <paths>
Privacy policy URL: <url>
Permissions reviewed by: <name/date>
Submission: NOT SUBMITTED | SUBMITTED <date> | APPROVED <date>
```

The ZIP, a green CI run, or a developer-mode install alone is not a Store release.
