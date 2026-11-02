# Kura and the Starlight browser workbench

Implementation candidate · 2 November 2026 · Kura 0.3.2

## Decision

Keep Kura independently installable as the local browser companion. Integrate its portable outputs with the existing Starlight application. Ship Starlight, Arcanea, GenCreator and Agentic Income as task packs over one browser runtime before considering separately listed extensions.

The browser companion owns local capture, source selection, browser permissions and export. The main application retains identity, projects, mission admission, entitlements and reviewed shared state. A brand changes the job and output contract; it does not acquire another database, browser permission system or model gateway.

This change implements one complete local path: choose a captured conversation → choose a brand/task and objective → inspect a deterministic brief → copy or save JSON/Markdown. It performs no inference, remote upload, browser action or publication. Existing capture, Cockpit and native intake remain separate existing capabilities.

## Competitive mechanisms inspected

These are documented features, not independently benchmarked speed or reliability claims. No competitor source or assets were copied.

| Product | Useful mechanism | What to adopt |
|---|---|---|
| [ChatGPT browser extension](https://learn.chatgpt.com/docs/chrome-extension) | Existing signed-in browser access, selected tabs and per-site access settings | A thin browser execution adapter connected to an existing agent experience |
| [Claude in Chrome](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide) | Explicit website/action scope and inspectable permission modes | Visible scope, bounded plans and review of consequential effects |
| [MindStudio extension](https://github.com/mindstudio-ai/mindstudio-chrome-extension) | Side-panel workflows using page context and selections | Reusable typed tasks close to the user's current material |
| [Merlin](https://www.getmerlin.in/) | Immediate contextual interaction, repurposing and project context | Short path from selected material to a useful artifact |
| [Sider](https://sider.ai/) | A persistent multi-model browser workspace | Coherent navigation and consistent context across specialist jobs |

Provider help pages and product pages describe current public behavior; feature availability depends on the user's account, plan and workspace. These observations establish design patterns, not access to those products' private implementations.

Do not reproduce proprietary interfaces, names, artwork, hidden endpoints or commercial claims. Kura already has WXT/TypeScript, capture adapters, a side panel, a local vault and Cockpit. Reuse that implementation rather than replacing it with a fresh extension framework.

## The product system

| Pack | First implemented jobs | Later differentiated capabilities |
|---|---|---|
| Starlight | Continue a project; review an architecture | Project-scoped mission handoff, visible source/effect receipts, recoverable browser tasks |
| Arcanea | Develop a world seed; review story continuity | Canon-linked references, original character/world assets, proposals kept distinct from locked canon |
| GenCreator | Prepare a creator release; repurpose source material | Editable release artifacts, brand/rights checks and reviewed channel delivery |
| Agentic Income | Design an offer test; audit a revenue workflow | Evidence-backed product/offer research, funnel checks and measured delivery experiments |

The current task recipes generate instructions and source packets; their named outputs are requested future model artifacts. The extension does not claim those outputs have already been produced or reviewed. AI subscriptions, model inference, hosted execution and customer billing remain distinct costs.

Consider a separate public extension only when the audience, primary purpose, required permissions or release/support boundary differs materially. Four reskinned listings would add maintenance and may conflict with Chrome Web Store rules on repetitive content. Unrelated new browser functionality also requires its own clearly disclosed purpose. See [Chrome policies](https://developer.chrome.com/docs/webstore/program-policies/policies/) and [repetitive-content guidance](https://developer.chrome.com/docs/webstore/program-policies/spam-faq).

## Primitive boundaries

| Primitive | Contract | Owner / present state |
|---|---|---|
| Capture | Loaded provider conversation → local capture with stable identity and revision | Existing Kura scrapers and locked vault format |
| Context snapshot | Explicit source/range → copied role-marked text + source URL/time + SHA-256 | Implemented in `src/studio/task.ts` |
| Task pack | Brand + stable recipe/version + objective → expected artifact contract | Eight bundled local recipes; no downloaded executable rules |
| Portable packet | Versioned JSON + readable Markdown + deterministic packet digest | Implemented; independent of vault schema |
| Browser capability | Typed observe/navigate/fill/submit operation bound to exact tab, origin and current grant | Future extension of existing browser execution; absent from Studio |
| Handoff | Explicitly reviewed packet + paired destination → received/rejected receipt | Manual copy/export implemented; authenticated bridge pending |
| Fast routing | Qualified model response → ranking among already permitted task choices | Proposed server adapter; no model calls in this change |
| Durable mission | Existing app admission → bounded execution, recovery and evidence | Existing main-app owner; no second mission scheduler introduced |

Checksums establish content consistency. They do not authenticate the origin, certify factual truth, or authorize an action. Prompt text, source messages, routing scores and imported skill instructions cannot grant browser permissions or sign an approval.

## Main-app integration

Keep the extension's installation and release cadence independent. Integrate at a versioned packet boundary and share the app's existing project identity and mission contracts. Do not embed authenticated third-party AI websites in iframes or silently proxy the user's signed-in session.

The next bridge should let the person pair the extension with an existing account/project, preview exact source scope and destination, explicitly transfer one packet, and receive a revision-bound acceptance receipt. Reuse the app's existing identity and scoped operation tickets. Resolve its current routes and source revision before implementing; this document creates no claimed live endpoint.

The bridge must include origin/tenant/project/operation checks, expiry, replay protection, packet revision, explicit cancellation and unambiguous received/rejected/unknown states. Use OAuth/PKCE or the existing pairing contract; do not store provider cloud keys in the extension, put private text in query parameters, or add wildcard `externally_connectable` access.

A second existing client was verified at `frankxai/starlightintelligence.ai@66cc23a53e2ede253199e527136400bbe47b4f90`: [`apps/extension`](https://github.com/frankxai/starlightintelligence.ai/tree/66cc23a53e2ede253199e527136400bbe47b4f90/apps/extension). Its README describes a built MV3 side panel, shared UI/client contracts, PKCE client flow and `read_active_tab`, `capture_visible`, `open_url`, `send_to_mission` tools. It explicitly describes the live client as awaiting platform routes and staying in recorded preview until those exist. This is source evidence, not a verified paired production service.

Reconcile this client with Kura before another browser shell is built or listed. Kura retains capture and vault portability; reuse the existing app client's auth/tool contracts through a narrow adapter where compatible. A unified installable experience is the target, while the precise package boundary requires source/license/version review. Do not ship two competing identity flows or silently merge their permission sets. The next concrete acceptance is one approved `send_to_mission` packet with a versioned digest/idempotency receipt, tenant/mission validation and tested size limits. Confirm its actual server route and schema before coding the adapter.

The existing local NativeIntake adapter remains the path to private Second Brain processing. Preserve its queue, receipt and recovery semantics. Do not introduce a second local ingestion queue or use the main app as canonical storage for raw captures by default.

## Browser-use execution

Distinguish three execution surfaces:

| Surface | Good use | Important boundary |
|---|---|---|
| Local Chrome through the extension | User-selected signed-in tabs, visible UI assistance and capture | Exact tab/origin/document, user scope and observable effects |
| Existing native host / coding CLI | Local files, deterministic scripts, repository work and paired MCP tools | Explicit pairing, typed tools and local permission boundary |
| [Cloudflare Browser Rendering](https://developers.cloudflare.com/browser-rendering/) | Qualified remote browser sessions, rendered public research and server-side automation | Separate remote identity/session, existing mission admission and payer |

Prefer a supported service API/MCP tool for structured actions, a bundled deterministic adapter for a stable UI, and a model-driven browser step when rendered state requires it. Keep all three behind one operation contract. The model plans; a deterministic capability boundary decides what is permitted.

Define observe, read-selection, screenshot, navigate, fill and submit separately. Bind actions to the exact tab and document revision; re-observe after navigation. Distinguish prepared draft, injected text, attempted submit and confirmed provider outcome. Existing Cockpit dispatch does not establish arbitrary browser automation or successful model execution. Audit and qualify its default automatic submission and first-tab selection before using it as an autonomous agent transport.

Use bounded step/time/cost limits, cancellation, checkpoints and explicit unknown-effect reconciliation. Do not replay a submit after a lost acknowledgement without checking the actual destination. Keep sensitive fields, cookies, credentials and session profiles out of snapshots and handoffs. Source content is untrusted data even when it looks like an instruction or originally carried a system role.

Arbitrary generated JavaScript and remotely downloaded scripts are not the extension's skill system. Chrome Web Store policy constrains remote executable logic. Bundle narrow typed capabilities, keep portable skills declarative, and qualify any `userScripts` or debugger-based execution as a separately disclosed permission boundary.

## Cloudflare System One and Clef-omni

[Cloudflare's model reference](https://developers.cloudflare.com/workers-ai/models/clef-omni/) describes `@cf/cloudflare/clef-omni` as a multimodal decision model. It evaluates state against typed questions and returns option probabilities; it is not a prose-generation model. Its [9 October announcement](https://developers.cloudflare.com/changelog/post/2026-10-09-clef-omni-workers-ai/) documents text/image/audio/video inputs and the System One API.

Use it as an optional fast classifier: choose an already admitted recipe, rank approved adapters, detect uncertainty or propose escalation. Deterministic validation comes first. Low confidence must preserve the existing scope and ask for review or use a known deterministic path. A probability never authorizes execution, promotion or data transfer.

Run inference through the existing Starlight server adapter and accounting boundary. Keep provider keys server-side. Snapshot the selected model, credential path, routing version and authorized ceiling for each mission; never silently switch to another payer. Native Workers AI and optional AI Gateway/external provider billing are separate. Startup credits are not evidence of eligible balance or free inference for a particular route.

The Studio implementation makes no Workers AI or Browser Rendering calls and provisions no resources. Qualified Cloudflare integration belongs in the current main-app/runtime owner, not a new extension backend.

## Studio and skills

Use the existing Software Studio for product delivery and the existing Capability Foundry for future deterministic extension adapter/package generation. Extend their admitted contracts rather than creating a new hosted builder, compiler authority or catalog.

A Browser Studio execution guide composes repository discovery, MV3 implementation, exact-source packets, browser/native/cloud boundaries, independent review and release evidence. It supplements the Chrome Extensions and Software Studio skills. An installed guide does not activate an agent or connector.

Admit another task recipe only with a demonstrated user job, stable ID/version, declared input range, expected artifact, allowed effects, failure path and evaluation fixture. Ship deterministic validators and typed tools with the source; do not fetch executable skills at runtime. Keep new permissions opt-in and tied to an actual implemented capability.

No additional paid plugin is required for this local slice. GitHub, the available extension/runtime skills and the existing build/test tools cover it. Add an integration only when a concrete next operation lacks a supported capability; installation alone does not pair a local browser or grant cloud credentials.

## Verification, rollout and economics

The task compiler is local and deterministic: zero model requests per compilation. This is not a claim that existing AI subscriptions, remote browser execution, development effort or future hosted features cost nothing.

Acceptance is one real person capturing a conversation, preparing a source-faithful brief, resuming work in a chosen tool and recovering the original sources. Compare with manual copy/native export. Measure completion, source fidelity, time to first useful artifact, interrupted-flow recovery, repeat use and support burden. Customer adoption, time savings, revenue and production integration remain unmeasured.

Before release: pass build/type/lint, task/capture tests, real Chromium interaction/download tests and independent review; inspect narrow/wide panels and keyboard paths. Store submission additionally needs truthful existing-feature privacy disclosures, valid screenshots, a live privacy policy and authorized publisher access. A build or a draft PR is not an installed Chrome extension or a published listing.

Rollback removes the Studio UI/module and restores the prior extension build. This change performs no capture migration and creates no background cloud state. Already exported briefs remain plain portable files. Reverting cannot retract a brief the person manually pasted elsewhere.

## Scope and source receipt

- Product/source owner: `frankxai/kura`, base `653f4c999fe8012eadbe3ca4b525055327794bcf`.
- Portfolio input: `frankxai/agentic-ops`, source `316f194c6e0853e86845b5c4948ce9d0b510b03d`.
- The Registry has no explicit Kura row in `repositories.yaml` at that input revision; current owner instruction names the existing Kura product. This branch is reversible product work, not a new canonical portfolio/runtime admission.
- Related open work was inspected: Kura #15/#16 own search/Second Brain projection, #17 continuity documentation and #18 a separate feature branch. This slice does not replace those branches or claim their acceptance.
- Locked capture format, existing IndexedDB schema and host-permission set remain intact. The separate task schema is `kura.browser-task/v1`.
- Primary source observations above were read on 2 November 2026. Provider features and policy require revalidation before their implementation/release.
