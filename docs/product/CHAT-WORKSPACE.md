# Starlight chat workspace within Kura

Owner: Frank. Slice: Kura issue #12; parent product issue #5. Date: 2026-10-04.
This extends the existing portable archive product. Kura remains the extension's
name and capture layer; Starlight is the existing workspace and intelligence layer.
It is not a new browser, mandatory cloud account or renamed repository.

## Valuable job and current slice

Find a decision or idea across AI tools and resume the original conversation
without opening another copy or losing an unsent draft. The alternative is Sider
plus each provider's separate history search and manual tab switching.

This slice implements local text/title/tag lookup across Kura's capture index and
currently open supported AI tabs. Results merge identical thread URLs, show saved
versus title-only observations, filter provider/source/capture date and paginate
40 bounded excerpts. Search, filtering and resume require no model calls. It does
not yet search coding-agent sessions. Second-brain search is a separate source: the
local host searches the selected brain root and returns cited, bounded notes.
The filesystem remains canonical; no storage migration or capture-format change.

| Before | After | Why |
| --- | --- | --- |
| Panel loads full transcripts | Background returns bounded result excerpts | Lower panel memory and smaller messages |
| Captures and open tabs have separate entry points | One local chat list with source filters | Find and resume from one place |
| Source link creates another tab | Resume focuses a revalidated existing tab | Preserve draft and avoid duplicate tabs |
| First panel is a multi-provider prompt broadcast | First panel is the user's chat list | Put existing work first |
| Empty state says no captures even after a failed search | Filter guidance names the actual search scope | Explain omissions and recovery |

No automatic tab closing, provider prompt submission, inbox reading, history
crawling, credential extraction, hidden model requests or telemetry is added.
Existing cockpit dispatch remains an explicit separate action. Open-tab lookup
uses titles and URLs, not page bodies. Private/incognito tabs are excluded.
Only extension pages may invoke the existing privileged background handlers;
provider content scripts cannot query this list or trigger resume.

## Architecture and implementation sequence

1. **Find and resume**, this slice: extension index plus open-tab metadata; safe
   provider URLs, bounded responses, preserved drafts and accessible filters.
2. **Search the second brain**: lexical search in Second Brain OS, scoped to the
   selected brain root and returned through the existing native host. Return title, short reviewed
   excerpt, provider/date/status, relative note citation and original source link.
   Pending records are metadata-only; private source bodies stay outside recall.
   Measure recall, latency and repair behavior on a named archive before adopting
   embeddings. Do not create a second canonical memory database.
3. **Organize selected work**: editable collections/project labels and suggested
   duplicate/related-thread groups. Store user curation separately from provider
   observations; proposals need review. Explicitly selected context can be copied
   into an active AI chat. Preview destination and byte/token budget before send.
4. **Archive backfill**: provider-specific export handoff with states requested,
   awaiting provider, downloaded, validated, imported, reviewed. Persist receipts,
   verify scope and hashes, resume from checkpoints. An export email integration
   is optional and separate; use documented OAuth and a focused export-mail query,
   preview the sender/link and never expose inbox contents to provider pages.
   Do not claim a Gemini Takeout adapter until a real format fixture is validated.
5. **Coding-agent work**: explicit source adapters for local Codex/Claude Code
   sessions with project, branch, session ID and visibility scope. Consume supported
   session interfaces or supplied exports; never infer access to all sessions.
6. **Optional AI curation**: on-demand inference over retrieved, selected excerpts.
   Capture/search/dedup remain deterministic. Track usage, cancel, limits, denial,
   token expiry and disconnect. One shared companion process when required;
   the existing native capture host stays narrow and demand-started.

Additional Kimi/GLM surfaces need provider-policy review, scraper/export fixtures
and explicit host permission. Grok/Gemini/Claude capture support does not imply
access to subscription billing, quotas or entire account histories. Subscription
labels can be user-entered until an authorized entitlement API is verified.
Visual-provider integration is a later provenance/original-file/import adapter,
not a chat-history connector. Higgsfield tooling is disabled in this estate.

## ChatGPT sign-in decision, official docs checked 2026-10-04

[Sign in with ChatGPT quickstart](https://developers.openai.com/siwc/quickstart)
distinguishes identity scopes from separately consented plan usage. Identity and
plan usage do not grant access to ChatGPT conversations or memories.

[The open-source flow](https://developers.openai.com/siwc/token-sharing-open-source)
supports locally hosted OSS apps with dynamic registration, a stable opaque host
ID, state, nonce, PKCE, a loopback callback, token validation and eligible Responses
API requests. A local implementation does not need a partner API key/client secret.
Tokens belong in an OS credential store, never a capture vault, public repo or
content-script-accessible extension storage. Inference scopes and plan limits must
be visible and optional. No sign-in button is shipped before its real flow works.

[Commercial client registration](https://developers.openai.com/siwc/request-client-id)
is currently a limited partner offering with an interest form. Commercial/hosted
approval and callback configuration are separate from an OSS local pilot. No
application was submitted and no OAuth connection was created in this slice.

[Sider's own troubleshooting](https://sider.ai/help-center/faqs/sider-error)
documents a ChatGPT web-app access mode that can break after provider changes.
That does not establish an approved identity integration or history-access API.
Use OpenAI's documented sign-in contract rather than provider session cookies.

## Browser controls and pipeline evidence

Use documented [Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs)
and [Windows](https://developer.chrome.com/docs/extensions/reference/api/windows)
APIs for explicit resume. Extension management and folder/native grants remain
browser/user controls. The connected Codex browser's URL policy currently blocks
extension management; an additional MCP or remote-debugging route does not remove
that boundary. User installation and grants are separate acceptance evidence.

The existing blocking CI runs types, lint, build, deterministic capture contracts,
Chromium extension tests and the hosted-gallery security test. Added cases exercise
exact-host rejection, 5,311 synthetic records, bounded pagination, title/text/tags,
draft preservation, inert hostile titles, keyboard focus, 320px layout, reduced
motion, 44px action targets, rapid state changes and source closure.

Next release gate: real Chrome-to-native-host transport with an isolated fixture
vault, then an authorized user capture into the selected vault. A mocked host,
synthetic Chromium fixture or provider-visible DOM capture cannot substitute for
that result. Keep exact source revision, artifact hash, browser/OS versions, test
scope, independent review and remaining blockers in the release receipt. No
extension-store release, account backfill or AI curator is certified by this file.

Daily operation: save opened work, retry actionable failures, review at most three
source packets with a combined 18,000-byte source budget and record citations.
Weekly operation: reconcile export freshness and gaps, validate any downloaded
exports, import only changed records, curate priority pending notes and verify
search on known decisions. Scheduling/n8n can orchestrate approved integrations
later; it is not required for local capture, deterministic import or search.
