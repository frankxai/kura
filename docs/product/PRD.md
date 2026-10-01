# Kura — extension PRD

Version: proposal 1, 2026-09-17. Product owner: Frank. Related: issue #5.

## 1. Decision and value

Kura is the portable archive for work created with AI: conversations, prompts,
original images, generated documents/code/artifacts, music and video, linked to
their sources and versions. The primary experience is a Chrome extension with
a contextual side panel and a full library tab packaged inside the extension.

The differentiator is preservation with usable context: find the final output,
recover the prompt and source conversation, inspect what was actually preserved,
and use the files without Kura. Download count alone is not the product.

"All AI apps" is the expansion objective. A release claims an explicit tuple of
provider, account surface, content kind, acquisition method and tested version.
There is no blanket claim that all histories, private assets or formats are accessible.
Capability breadth must not outrun provider permission, capture fidelity or recovery.

## 2. User jobs

| Job | Outcome | First release obligation |
| --- | --- | --- |
| Save what I just made | A durable output with available prompt and source | One primary action after setup on an approved direct route; native-export guidance otherwise |
| Rescue an existing library | A reconciled archive with visible omissions | Preview scope, select, estimate storage, run, pause/resume, inspect receipt |
| Find an idea again | Search across provider boundaries | Local text/prompt/filename search, filters, source links, collections |
| Reuse a creation | Open original, copy prompt, export a collection | Open formats, original bytes, locally generated derivatives labeled separately |
| Give my agent context | Selected, scoped local records with provenance | File-based interchange first; a local MCP companion later |

Initial reference user: a creator using Midjourney/Grok, ChatGPT/Claude and Suno
whose output spans images, reasoning, code and music. Existing Gemini, DeepSeek
and Perplexity captures must retain compatibility. Expansion follows verified demand
and provider feasibility, not the number of logos in the popup.

## 3. Product boundaries

| Surface | Owns | Does not own |
| --- | --- | --- |
| Extension side panel | Provider state, capture selection, jobs, native-export handoff | General-purpose chatbot or provider password entry |
| Extension library tab | Local search, previews, collections, provenance, archive health | Mandatory cloud account or remote image storage |
| Provider site | Authentication, entitlement, native generation/export, account controls | Kura's local metadata/collections |
| Optional website | Installation, documentation, compatibility notices | Basic capture execution |
| Optional local companion | Later large-file/offline indexing and authenticated local MCP | Bypassing provider restrictions or mandatory setup for first capture |
| SIS/Arcanea/GenCreator integrations | Explicit downstream actions over selected records | Automatic ingestion of private archives or source-of-truth ownership |

No mandatory LLM calls, API key, cloud subscription, native daemon, or Codex install
for the core product. Mechanical export must be deterministic and token-free.
No provider generation, hidden history crawl, credential export, source deletion,
training-data harvesting, automatic publishing or default synchronization.

## 4. Content fidelity requirements

| ID | Kind | Required preservation | Never imply |
| --- | --- | --- | --- |
| C01 | Conversations | Ordered roles/messages, paragraphs, lists, tables, fenced code/language, links/citations, available times and attachments | Visible branch is the complete conversation tree; rendered reasoning is hidden model reasoning |
| C02 | Prompts | Verbatim available prompt, links to resulting items and containing message; separate user notes | A filename, caption, alt text or AI summary is the generation prompt |
| C03 | Images | Exact downloaded bytes; observed format, dimensions, source ID/URL, original-vs-preview status; separate thumbnails | A resized preview is original resolution or a guessed CDN URL is a verified original |
| C04 | Artifacts/code/files | Actual downloadable source/files, filenames/MIME, available version relationships, source conversation/message and dependencies that are exposed | A screenshot is editable source; exported code includes the provider's hosted runtime, secrets, data store or backend |
| C05 | Music/audio | Available authorized MP3/WAV/other original, cover, supplied lyrics/style/model, duration, source track ID; versions/stems only when offered | MP3-to-WAV conversion is a lossless source, inferred lyrics are original, or downloading confers commercial rights |
| C06 | Video | Authorized original, cover/poster, supplied prompt, observed dimensions/duration and related source images/audio | Higher resolution, stem separation or frame interpolation without an explicit derived operation |
| C07 | Mixed creations | Relations between chat, prompt, artifact, image and music; distinct source observations pointing to shared bytes | Identical bytes mean identical provenance or ownership |

Metadata fields distinguish provider-supplied, file-observed, user-entered and
derived values. Missing values remain null with a reason. Original metadata and
user curation are separate; re-capture never overwrites user tags/notes. Provider
IDs are scoped to a local account/workspace identity to avoid cross-account merging.

Canonical output: existing Markdown/YAML conversation format plus original files
and additive versioned manifests. JSON and sanitized HTML are portable exports.
PDF/PNG are optional presentation derivatives, not canonical records. DOCX/CSV
must not appear as implemented options until their actual writers pass tests.
ZIP is a transport container: preview and explain its contents, then show normal
library cards. The user should not have to understand JSON or archive layout.

## 5. Acquisition and completeness

P01: Prefer a provider-documented, permitted API/export integration when it covers
the actual consumer surface. API access does not establish access to the user's
consumer chat history. Record permission evidence for the exact integration.

P02: Where direct acquisition is not cleared, guide the user through the provider's
own export/download and accept the selected result locally. The side panel keeps
context and explains the next action; it must not simulate prohibited automation.
User clicks and ownership of output alone do not waive provider terms.

P03: Unknown or restricted routes remain disabled. No silent fallback from an
official route into private endpoints, token extraction or scripted crawling.
See [provider policy](OPEN-SOURCE-AND-PROVIDERS.md).

P04: Display the actual scope: current selection, open conversation branch,
selected export, public catalog, or provider-account collection. Every discovered
candidate ends as selected, excluded, unsupported or discovery-error. Every selected
item ends as saved, already saved, failed, canceled or pending. Show these counts
separately; do not mix candidate counts with unique binary counts.

P05: "Complete" requires a documented scope, end-of-pagination/export marker and
reconciliation. Without a provider total show "All items in this export processed;
account total unknown." Scrolling until no new cards appear proves neither history
exhaustion nor completeness. Track snapshot time and additions during discovery.

P06: Start with five authorized items each from Midjourney and Grok (maximum ten
per pilot batch), then three Suno tracks through a permitted route and representative
chat/artifact samples. The current pilot cap remains until real acceptance passes.
Native-export-assisted success and direct-download success are recorded separately.

## 6. Functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| F01 | Connect one destination with clear location and permission state | Deny/regrant/reload/reconnect tests on a real desktop folder |
| F02 | Provider capability view with route, scope, content and limitations | No unsupported action presented as available; account switching invalidates stale discovery |
| F03 | Preview before capture; inspect item/metadata and select a subset | Selection survives sort/filter/pagination; large originals are not eagerly decoded |
| F04 | Persistent jobs with pause, cancel, resume and failed-item retry | Browser/worker interruption preserves completed files and pending work |
| F05 | Integrity and deduplication | Original bytes read back and verified; repeat selection adds no duplicate bytes or user-note loss |
| F06 | Searchable mixed-media library | Type/provider/date/collection/status filters; sort and pagination; usable audio/video controls |
| F07 | Detail view with provenance and versions | Original opens; unavailable metadata has an honest state; source and relationships resolve |
| F08 | Local collections/favorites/tags | One item in multiple collections without file duplication; user edits survive re-capture |
| F09 | Portable collection export | Opens without Kura; relative links work; dependencies/missing assets listed |
| F10 | Diagnose and recover | Redacted job report, reconnect, retry, rescan and missing-file repair without automatic destructive action |
| F11 | Permission and route control | Site permissions requested when needed; revoke disables acquisition without deleting the archive |
| F12 | Accessible operation | All critical tasks completed using keyboard and screen reader; reduced-motion and zoom evidence |

## 7. Release scorecard

These are proposed targets, measured on a named Windows laptop with 32 GB RAM,
current stable Chrome/Edge, with OS/browser/build versions recorded. Also test
current stable Chrome on macOS. External provider latency is measured separately.

| Metric | Release target | Method |
| --- | --- | --- |
| First successful save | 4 of 5 new test users finish an available direct/local route within 90 seconds, excluding provider export wait | Moderated task, no coaching; report handoff completion separately |
| Find saved item | 4 of 5 retrieve a specified item within 20 seconds | Mixed library usability task |
| Integrity | 100% of saved originals match their acquired source hash in the acceptance corpus | Read-back verification; no success on queue submission |
| Recovery | Zero duplicate originals/user-edit loss in the fault matrix | Forced worker shutdown, browser restart and disk faults |
| Fidelity | All supported features in golden corpus preserved; omissions explicitly labeled | Human/source comparison plus structural assertions |
| Search | p95 under 250 ms over 10,000 indexed records | Fixed corpus, warm index; report cold rebuild separately |
| Local UI | p95 action feedback under 100 ms; initial usable panel under 500 ms | 30-run trace on the reference machine |
| Footprint | Library metadata/search working set under 150 MB on that corpus; media decoded on demand | Chromium memory traces; codec peaks separately reported |
| Accessibility | No critical/serious automated findings and manual WCAG 2.2 AA critical-flow review | Keyboard, NVDA/VoiceOver, 200% zoom, narrow panel |
| Privacy | No capture content or credentials leave the device except the explicitly selected, disclosed integration | Network audit, permission tests, redacted diagnostics |

No telemetry by default. Compute local job metrics and use consented usability
sessions/redacted support reports. "Best" is a benchmark target, not marketing
copy until comparison data exists.

## 8. Expansion and business model

Sequence: reliable common engine + image pilot; conversation/artifact fidelity;
music/video packs; collection export and large-archive search; then optional local
MCP and additional providers. Each new provider must be cheap to add because the
adapter owns discovery/normalization, not its own queue, gallery or database.

Retain the current free MIT core and unrestricted access to the user's existing
archive. Potential paid services belong around it: managed organization policy,
support, optional encrypted sync and team curation. No prices, billing or recurring
infrastructure are authorized by this PRD. No data-lock-in or paid access to already
saved files. Measure repeat retrieval and reuse before expanding cloud surfaces.

For scheduling and work-package acceptance, see [engineering delivery](ENGINEERING.md).
