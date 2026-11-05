# Chrome Web Store — Kura

Last updated: 2026-11-02. Version 0.3.2 candidate; submission and publication are unverified. This file consolidates the current candidate metadata. Older STORE_LISTING.md and CHROME_WEB_STORE_GUIDE.md contain historical guidance and must not be copied as current release claims.

## Store listing

Name: Kura — Export your most precious writing from ChatGPT, Claude, Grok, Gemini

Short description: Export AI conversations to a local vault and prepare source-linked briefs for your next session. No tracking.

Category: Productivity. Primary language: English.

Single purpose: Preserve and reuse the user's AI conversation work through local capture, source-linked review and portable exports.

Detailed description draft:

Capture conversations from supported AI pages into a local vault and prepare a source-linked brief for your next session.

Choose one saved conversation, a workspace and a task. Review the included messages, copy the brief or save it as Markdown or JSON. Starlight, Arcanea, GenCreator and Agentic Income provide focused task templates for architecture, storytelling, creator releases and offer tests. Preparing a brief does not run an AI model or send its contents to an app.

Existing Kura features include local conversation capture, optional native Second Brain intake, selected-provider prompt dispatch, opt-in Arcanea transfer and Suno/media intake. Provider support and available assets vary by page and host. Review the selected source and destination before transferring your work.

Connect a private capture folder in the side panel, capture a supported conversation, then choose Studio to prepare a brief. Opening a workspace app does not automatically transfer the brief.

Your capture files remain local unless you explicitly use an existing transfer feature or paste/export them elsewhere. No analytics are added. Existing interface fonts may request Google Fonts. A full release privacy review is required before store submission.

Support: https://github.com/frankxai/kura/issues
Homepage: https://github.com/frankxai/kura

## Graphics and assets

| Asset | Dimensions | Status | File |
|---|---|---|---|
| Store icon | 128 × 128 PNG | Existing source file | public/icons/icon-128.png |
| Toolbar icons | 16 × 16; 48 × 48 PNG | Existing source files | public/icons/icon-16.png; public/icons/icon-48.png |
| Studio screenshot | 1280 × 800 or 640 × 400 | Pending actual browser inspection and store composition | Not supplied |
| Promo tiles | Store-specific | Existing historical assets need review | store_assets/ |

Do not substitute a generated mockup for an observed functioning-extension screenshot.

## Permissions justification

No permission or host is added by Studio. Recheck this table against the generated manifest before every submission.

| Permission | Type | User-facing reason |
|---|---|---|
| activeTab | Required | Read the user-selected supported conversation when the user invokes capture. |
| tabs | Required | Identify supported open AI tabs and expose explicit source navigation and selected-provider dispatch. |
| downloads | Required | Save conversation/media exports and the user's reviewed task briefs to disk. |
| storage | Required | Remember local settings and capture/intake progress across browser restarts. |
| scripting | Required | Run bundled capture or prompt-assistance code on supported AI pages. |
| sidePanel | Required | Show the local library, Studio, Cockpit and intake controls beside the source page. |
| offscreen | Required | Write captures through the connected local vault where the background worker cannot hold the folder handle. |
| nativeMessaging | Optional | Connect an explicitly enabled local Second Brain host for pending intake and verified receipts. |
| https://chatgpt.com/*; https://chat.openai.com/* | Host | Capture the loaded ChatGPT conversation and support user-requested prompt assistance. |
| https://claude.ai/* | Host | Capture the loaded Claude conversation and support user-requested prompt assistance. |
| https://gemini.google.com/*; https://aistudio.google.com/* | Host | Capture supported Gemini/AI Studio page content; prompt assistance availability varies by adapter. |
| https://grok.com/* | Host | Capture Grok conversations and supported generated media; support user-requested prompt assistance. |
| https://assets.grok.com/*; https://imagine-public.x.ai/* | Host | Retrieve media referenced by a user-requested Grok capture. |
| https://chat.deepseek.com/* | Host | Capture the loaded DeepSeek conversation. |
| https://www.perplexity.ai/* | Host | Capture the loaded Perplexity conversation. |
| https://suno.com/*; https://studio-api.prod.suno.com/* | Host | Read the selected public Suno catalog for the existing local music intake. |
| https://cdn1.suno.ai/*; https://cdn2.suno.ai/* | Host | Save selected Suno audio/media assets locally. |
| https://arcanea.ai/* | Host | Existing explicit opt-in transfer to the fixed Arcanea import endpoint. |

## Privacy and data use

The extension handles user data. Local-first processing is not the same as having no data-handling obligations. Final dashboard disclosures require review of the complete extension, not only Studio.

| Data | Stored or processed | Off-device transfer |
|---|---|---|
| Conversation content, prompts and source URLs | Local vault/index; Studio only reads the selected text range | Only through existing explicit transfer/dispatch features or user-chosen paste/export destinations |
| Media and public music metadata | Existing local media/music intake | Provider requests fetch selected assets; destination/rights vary by provider |
| Native intake state and receipts | Local browser/native host | Local paired host; no new cloud path in Studio |
| Reviewed task briefs | In-memory preview; user-selected export file | Copying to clipboard is explicit; Studio makes no automatic upload |
| Authentication tokens, financial or health details inside source text | May occur in the user's content | Do not claim these categories are absent; minimize inclusion and review selected material |
| Analytics/advertising telemetry | No new telemetry | None added |
| Interface fonts | Existing external font loading | Google Fonts requests may include connection metadata |

Data is not sold, used for unrelated purposes or used for creditworthiness/lending by Studio. Full-extension certification remains a publisher review task.

Privacy policy URL: pending verification of a live policy matching all current data flows. The historical proposed URL is https://arcanea.ai/privacy/kura; its availability and completeness were not verified in this change.

## Distribution and developer information

Visibility/regions: not changed or submitted.
Publisher: Frank Riemer; the current Chrome Web Store publisher account is unverified.
Public contact email: confirm before submission; do not infer publisher-account identity from a source-code author field.
Support: https://github.com/frankxai/kura/issues

## Version history

| Version | Date | Changes | Status |
|---|---|---|---|
| 0.3.2 | 2026-11-02 | Local source-linked Browser Studio, four workspaces/eight task recipes, JSON/Markdown export, bounded source validation and review invalidation. Description shortened for listing constraints. | Draft candidate |

## Review notes

Real Chromium/visual acceptance, actual download inspection, full existing-feature privacy review, live policy, store screenshots and authorized publisher submission remain required. Local source tests or a draft PR do not establish installation or publication. Existing provider selectors, opt-in Arcanea service and Cockpit runtime success are not newly certified by this change.
