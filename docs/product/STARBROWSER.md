# StarBrowser: Founder Intelligence

Implementation candidate, 13 November 2026. Source owner: `frankxai/kura`.
This extends the existing Kura Browser Studio; it does not create another browser,
identity provider, hosted orchestrator, vault schema or production service.

## Architecture decision

**Choose B, an MV3 extension mode, before A, BrowserOS integration.** Preserve
BrowserOS as the agent browser and personal Chrome as the human browser. Use
BrowserOS's released agent surface for the next local runtime adapter; do not
maintain a Chromium fork to validate the assistant's research job.

| Option | Functional control | Distribution | Update/security burden | Disposition |
|---|---|---|---|---|
| A. BrowserOS integration | Local agent/MCP sessions and browser tools | Requires installed BrowserOS and pairing | Upstream owns binary updates; we qualify adapter versions and grants | Next adapter after pinned live conformance |
| B. Extension | Invited tab reads, sidebar, typed approved navigation | Existing Kura unpacked build; store review remains separate | Host browser patches stay upstream; extension permissions and updates stay ours | Implemented first slice |
| C. BrowserOS fork | Full chrome UI and engine control | Signed installers, updater, multi-OS support | Chromium rebases, security response, AGPL source delivery, telemetry and signing | Defer until unique browser-level requirement is proven |
| D. Desktop companion | CLI/native/MCP and filesystem reach | Additional installer and local pairing | IPC, process lifecycle, native updater and platform support | Reuse existing NativeIntake; no new daemon |

This decision narrows the next implementation step of Ops #575; it does not
silently reverse the earlier BrowserOS fleet ruling. Ops #576 was closed without
merge. Its interfaces are proposals, not production evidence. No accessible
BrowserOS fork was found in bounded frankxai/Starlight-Intelligence repository
searches; private or unindexed experiments remain unknown.

## Source reconciliation and ownership

| Layer | Existing source / inspected state | Boundary in this candidate |
|---|---|---|
| Local capture and portability | Kura main `fed3fc5f138aa945ef439ae69a1de5c73cc9cf22`; Studio #30 merged | New independent `kura_founder_v1` state; locked conversation vault is unchanged |
| Main-app extension client | Starlight site main `f4e7631e3ba3ceb0b2d7ca0b7cc22f955ee88fab`, `apps/extension` | Reuse its future PKCE, grant, tickets and shared platform tool contracts; no second auth flow |
| Cloud knowledge | Same site's `lib/platform/memory-capture.mjs` and memory route | Export a compatible create command; do not call an endpoint that denies extension origins |
| Mission authority | Existing Queen/Mission Control and platform contract | Local navigation task is not a hosted mission or admission grant |
| Independent receipts | Starlight Kernel, browser-evidence spike #23, closed at inspection | Local log explicitly lacks independent attestation; do not mint a competing Kernel schema |
| Design | `starlight-design-intelligence@4426ddc83c4a14238e15b262fb1dfc8d3c018624`, SIS Operator and material roles | Opaque ink/ivory reading, gold human decision, cyan evidence. Candidate material tokens are not claimed as fleet adoption |
| Portfolio | agentic-ops main `349ef7c55a87076989d9b14c88f355d6977464fb` | No Registry mutation. Kura still lacks an explicit repository row; reversible work follows the current request and existing Kura owner |

The existing Starlight extension already has `read_active_tab`, `capture_visible`,
`open_url`, `send_to_mission`, PKCE and shared package imports. Its README labels
live platform routes as pending. This candidate supplies Kura's local dossier
slice, not another implementation of that auth, crew or server surface.

Exclusive implementation scope: `src/founder`, `src/entrypoints/founder`,
`src/styles/founder.css`, named tests and this specification. Popup/background
edits are thin registration and consent entry points. No capture migration.

## The working customer path

Open an HTTPS company site → invoke **Alt+Shift+Y**, or Kura's popup and
**Research this company** → inspect the company-stated excerpts and exact
source → **Save dossier** → select a captured company link → **Review follow-up**
→ **Approve & open** → inspect the navigation result and activity log.

The extractor is deterministic, not an LLM researcher. It returns attributable
company statements and explicit open questions, not invented revenue, funding,
valuation or market findings. Selected eligible text takes priority. A company
website is one source, not independent corroboration.

The saved dossier persists across panel/browser sessions in this browser profile.
Export JSON for portable retention: extension storage can be cleared/evicted and
is plaintext. Up to 20 dossiers, 50 tasks and 100 activity entries are retained.
Shared browser-profile users are not separate tenants. Cloud sync is off.

## Capability map

| Requested capability | Status here | Next acceptance |
|---|---|---|
| Authorized current tab and selection | Implemented | Real Chromium gesture/capture tests |
| Source-linked company dossier | Implemented local extractor | Human usefulness and independent evidence review |
| Sources, questions, collection, command palette, workspace lens, timeline | Implemented | Narrow/wide, keyboard and dialog checks |
| Governed task and approved browser workflow | Implemented one `open-source` action | Exact document, stale-source, expiry, cancel, single-use and redirect tests |
| Durable task state and recovery | Implemented bounded local state | Reopen; interrupted `executing` becomes `uncertain`, never replayed |
| Starlight knowledge integration | Compatible import command only | Existing account/project pairing and destination receipt |
| Multiple tabs and source comparison | Implemented over separately invited and saved snapshots | Two-to-six-source comparison, v1 compatibility, hash validation and uninvited-tab exclusion tests |
| Portable research task briefs | Ten bundled recipes; local JSON/Markdown/copy compilation | Recipient execution and acceptance remain separate; synthesis is not generated here |
| BYOK or local model inference | Planned | User-owned keys in session/native host, explicit provider/cost grant, no default cloud call |
| MCP skills / portable agents | Existing platform-client contracts inspected; runtime not connected here | Paired adapter, typed grants and qualified execution receipts |
| Continuous monitoring and remote execution | Planned in existing runtime owner | Budget admission, scheduler ownership, cancellation and accepted results |

## Founder and Investor task packs

Each bundled recipe uses the same evidence/dossier/task boundary. The local
compiler prepares portable instructions and source snapshots for these jobs.
The named outputs below are requests for the recipient agent, not model outputs
already produced by this extension.

| Pack | Required input | Useful output and next gate |
|---|---|---|
| Company and market research | Company site, independently approved market sources | Cited dossier with contradictions and unknowns |
| Competitor monitoring | Approved URLs and cadence | Change digest; admit schedule through existing mission owner |
| Ecosystem discovery | Region, criteria, event/company sources | Deduplicated organizations with evidence dates |
| Technical due diligence | Repositories, docs, disclosed architecture | Version/license/security findings, measured vs asserted separated |
| Thesis capture | Owner thesis plus cited evidence | Versioned thesis, falsifiers and open questions |
| Portfolio research | Explicit portfolio scope | Company evidence and concentration hypotheses; no trades |
| Funding and grants | Official eligibility, deadlines and geography | Dated eligibility table and application preparation |
| Deal room | Explicit documents and rights | Private cited memo, ACL, retention and zero implicit cloud transfer |
| Outreach preparation | Public research and owner objective | Draft brief/message; sending requires separate authorization |
| Research to PRD/product | Accepted evidence and project | Portable product brief into existing main-app mission intake |

## Contracts, permissions and threat model

`starlight.company-dossier.v1` is a local artifact, independent of the locked
capture schema. Page evidence records sanitized HTTPS URL, title, description,
eligible visible text, selection, eligible links, time, tab, document and SHA-256.
Hash input is the exact serialized sanitized snapshot. Hashes establish
consistency, not authenticity or factual correctness.

`starlight.research-dossier.v2` adds two to six selected source snapshots,
source-specific claim hashes, an owner objective and a dossier digest. Original
v1 captures are preserved. A compiled comparison is a new unsaved dossier until
explicitly saved. Exact duplicate snapshots are deduplicated; different versions
of the same URL remain distinct. Compilation does not enumerate or read tabs.

The research board uses the existing local collection as its input boundary.
Select saved dossiers in the intended order, enter an objective, then compile.
The first selected source remains primary for the existing navigation capability.
The comparison table presents attributable excerpts and observation times without
inventing market facts, rankings, pricing or independent corroboration.

`kura.browser-research-task/v1` exports one of ten bundled recipes with full
source references, exact exported-text hashes and an immutable packet digest.
It reuses Browser Studio's `REFERENCE_BOUNDARY`: text only, untrusted references,
no model executed, no external effects authorized. It is a source-format adapter,
not a second hosted orchestrator or authenticated transport. Markdown quotes
source text and escapes embedded HTML. JSON keeps the original captured data.

The memory draft remains a bounded projection. Both v1 and v2 drafts respect
the existing 8,000-character field bounds and 32,768-byte UTF-8 request ceiling.
Truncation and omitted claims are explicit; the full local dossier/packet remains
the portable artifact. An overlong URI is left empty instead of inventing a
truncated source address. No API request is sent by this compiler.

Local follow-ups retain the proposed mission contract fields `missionId`,
`tenantId`, `actorId`, `policyVersion`, `allowedOrigins`, `maxCostUsd`, `expiresAt`.
`tenantId=local:<extension-id>` is a local scope marker, never a cloud identity.
Local activity receipts are not `starlight.receipt.v1` attestations.

- New code adds no host, cookies, debugger, external messaging or native grant.
- Capture starts only from the invited shortcut tab or trusted popup, with exact
  tab ID and full transient URL bound before queueing. Navigation during capture
  invalidates it; the full query/fragment are not saved in the dossier URL.
- Read only the top document. Exclude forms, editable fields, hidden content,
  navigation chrome, scripts and iframes. Never read cookie/profile stores.
  Visible page prose may itself contain private information: review before export.
- Page instructions are literal evidence. They cannot add tool kinds, origins,
  budgets, grants or approval state. Render all captured prose with `textContent`.
- The only effect is one explicitly approved initial navigation. Require a saved
  source, a captured same-origin HTTPS link, no query/fragment, five-minute expiry,
  current source hash and original document. No forms, messages or financial actions.
- Execute the bundled navigation in that exact `documentId`. Re-extract and
  compare the sanitized snapshot synchronously in the same capability before
  navigation, closing the storage-await/replaced-tab race.
- A website may redirect. A different final URL/timeout/disconnect is `uncertain`;
  it is never automatically captured or replayed. No redirect-containment claim.
- Persist `executing` before effects. On interruption, require inspection rather
  than retry. A rejected stale approval does not navigate.
- Service-worker state is durable; the in-memory queue only serializes local
  mutations. Failed persistence prevents dispatch.
- Existing Kura content scripts/host grants and Cockpit remain inherited product
  surfaces requiring their existing review; the new capability does not certify them.

Future cloud transport must use the existing extension PKCE contract and
short-lived scoped operation tickets, tenant/project validation, exact audience,
replay protection, cancellation, cost reservation and a returned receipt. Keep
BYOK material in session storage/native secret owner; never in the dossier,
transcript, URL, log or public source. Local signed-in profiles never implicitly
become remote browser profiles. Imported skills remain data, not permission.

## Experience decision

Recipient: a founder reading a company site who needs a defensible next move.
Promise: keep the source attached to every statement and browser action.
Primary action: save the dossier. Proof: inspect the captured text and bound
follow-up. Feeling: focused, calm, accountable.

Three directions were compared before the new surface was written: (1) a dense
crew/chat console, reusing the existing app client's conversation focus; (2) an
evidence notebook with a strong company heading, sequential evidence and a
separate decision dialog; (3) a desktop research board with tab columns.
Choose **2** for a narrow sidebar. The others compete with source reading or need
more width. These are design decisions, not measured user preferences.

Use the SIS Operator roles from the pinned design owner. Reading is opaque; no
backdrop effects, animated particles or invented agent portrait. System fonts
are deliberate offline fallbacks rather than a claim that Instrument Sans is
bundled. No remote fonts or telemetry on the new research panel. No new motion
is shipped; reduced-motion behavior is static. Kura's existing panels retain
their previous styles and remote font behavior.

Once evidence is captured, the introduction collapses so the company and source
lead the working sidebar. The introduction remains available in the empty state.

## Commercial packaging recommendation

Keep the local evidence/capture extension free and open source. Sell the useful
work through existing Starlight editions: qualified managed research, team
collections and governed missions with transparent usage. Do not introduce a
browser-specific subscription before repeat research demand is measured.

An optional founder research pack can be evaluated as a one-time product, but no
price/listing is activated here. BYOK inference has provider charges and support
cost even when Starlight hosts no model. Managed contribution margin must deduct
inference, search, remote browser time, retries, storage, payment and support.
Track accepted dossiers and repeat use, not generated tokens or open tabs.
No current customer demand, revenue, production pairing or price is asserted.

## Build, support and recovery

`pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `pnpm test:capture`,
`pnpm test:studio`, `pnpm test:founder`, `pnpm exec playwright test`.
`CHROMIUM_EXECUTABLE` selects a supported installed Chromium for the new tests.
The existing CI already runs all browser specs and uploads Playwright results.

Prototype target: Chromium 123+ MV3, Chrome desktop. BrowserOS, Edge, macOS and
Windows binary compatibility remain unexecuted. This is not an Android extension.
No production promotion, store submission or installation in the owner's browser.
Use the release receipt for actual checks, screenshots and remaining gates.

Rollback: revert this additive feature and restore the prior unpacked build.
No migration is needed. Clear research removes only `kura_founder_v1`; exported
files remain user-owned. No background cloud process needs cancellation.

## Primary sources read

- [BrowserOS source and Neo architecture](https://github.com/browseros-ai/BrowserOS/tree/26d99d3586caa95bf2126bc6cbf34396401b676f).
- [Upstream compatibility and maintenance report](STARBROWSER-UPSTREAM.md).
- [Comet visibility, guidance and sensitive-action permission pattern](https://www.perplexity.ai/en-GB/hub/blog/comet-assistant-puts-you-in-control).
- [Chrome activeTab grants](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and [side panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).
- [Stagehand deterministic control alongside act/extract/observe](https://docs.stagehand.dev/v4/first-steps/introduction).
- [MCP consent/security principles](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/index.mdx).

Publicly documented interaction patterns are design evidence only. No Comet
code, assets, names or proprietary implementation were copied.
