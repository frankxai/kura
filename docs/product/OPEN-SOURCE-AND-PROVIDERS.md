# Open-source reuse and provider policy

Research date: 2026-09-17. Decisions below distinguish code-license evidence,
technical functionality and permission to interact with a third-party service.
This is an engineering release policy and source inventory, not a legal opinion
or a certification that all existing Kura behavior complies with every provider.

## 1. Reuse strategy

Keep `frankxai/kura` as the canonical product. Prefer maintained dependencies for
generic functions and small attributed reuse for specialized parsers. Study other
extensions' interaction design and failure cases. Do not fork an entire competing
product just to acquire a handful of exporters, a second build system and its debt.

The repository pages/license metadata below were inspected. This is not a full
source/security audit of their default branches. Before installing or copying,
pin an exact release/commit, inspect that revision's LICENSE and relevant files,
review dependencies/assets, and record a provenance receipt. Versions deliberately
are not guessed or described as "latest" without a release check.

| Repository | Observed license | Decision for Kura | Reuse boundary |
| --- | --- | --- | --- |
| [wxt-dev/wxt](https://github.com/wxt-dev/wxt) | MIT | Keep existing framework; learn supported MV3 lifecycle, SPA cleanup and packaging | Upgrade only with changelog review and extension regression tests; no framework migration |
| [obsidianmd/obsidian-clipper](https://github.com/obsidianmd/obsidian-clipper) | MIT | Primary interaction/reference project: clipping, templates, durable Markdown and browser integration | Adapt small suitable components/parser ideas with attribution; keep Kura identity and storage contract |
| [pionxzh/chatgpt-exporter](https://github.com/pionxzh/chatgpt-exporter) | MIT | Study export fidelity and format UX; evaluate offline serialization separately | Do not transplant its account extraction merely because it works or is open source |
| [mixmark-io/turndown](https://github.com/mixmark-io/turndown) | MIT | Candidate dependency for HTML-to-Markdown fallback | Golden tests for code, tables, math and citations; do not round-trip already available raw Markdown |
| [cure53/DOMPurify](https://github.com/cure53/DOMPurify) | Apache-2.0 OR MPL-2.0 | Candidate dependency for sanitized document previews; evaluate Apache option for distribution | Choose/document license path, keep notices, enforce CSP and safe URLs; sanitizer alone is not an execution sandbox |
| [101arrowz/fflate](https://github.com/101arrowz/fflate) | MIT | Candidate dependency for provider ZIP import and portable pack export | Streaming/worker use, byte/file/ratio limits, traversal tests; no unbounded unzipSync on user archives |
| [gildas-lormeau/SingleFile](https://github.com/gildas-lormeau/SingleFile) | AGPL-3.0 | Learn from observable page-preservation behavior and regression cases | Do not copy its code into the MIT product without an explicit compatible licensing/distribution decision |

The clipper's current README also points to extraction libraries such as Defuddle;
evaluate a single extraction/conversion path against Kura's corpus before adding
overlapping libraries. Do not add an indexing framework, UI framework or full AI
SDK merely because another extension uses it. Existing WXT/TypeScript/Playwright
are sufficient to start the reliability work.

Fork only for a concrete necessary upstream patch that cannot be maintained as a
small dependency update: name owner, upstream base SHA, patch list, license notices,
upstream contribution plan and retirement condition. Keep the fork visibly derived.
Open source does not grant upstream trademarks, user data or provider endorsement.

## 2. Reuse receipt and supply-chain gate

For every dependency, vendored file or derivative: upstream URL, exact tag/commit,
retrieval date, license/SPDX expression, chosen dual-license option, copyright/NOTICE,
changed paths, rationale, maintainer and update source. Produce a distributable
THIRD_PARTY_NOTICES and SBOM from the actual package. Preserve required attribution
in source and shipped notices; do not label copied work as original.

No-license or unclear-license code is not approved for incorporation. Copyleft is
not "bad"; it requires a deliberate distribution decision instead of accidental
relicensing. Font/icon/media licenses are reviewed separately from code. Review
transitive dependencies, install scripts and remote resources. Pin releases via
lockfile; scan for applicable advisories and re-run the adapter/security corpus
on updates. Never replace review with GitHub star counts.

## 3. Provider routes: current evidence and disposition

The public promise is broad portability through verified methods, not unrestricted
automated downloading. A native export being offered does not establish that Kura
may automate the website, call private endpoints or retrieve every asset. Likewise,
the user's ownership of output does not necessarily authorize a particular access
method. A user click is not by itself a terms exemption.

| Provider / target content | Kura evidence | Official evidence reviewed | Release disposition |
| --- | --- | --- | --- |
| ChatGPT: chats, images, files/canvas | Current-page scraper exists on main; new full-history adapter not verified | [Export guidance](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data); [EU terms](https://openai.com/policies/eu-terms-of-use/); [other-region terms](https://openai.com/policies/row-terms-of-use/) | Prioritize local parsing of user-obtained exports. Consumer terms prohibit automated/programmatic extraction; do not certify current scraper or enable crawling without an applicable exception/permission and review |
| Claude: chats, artifacts/files/versions | Conversation scraper exists; artifact completeness unverified | [Data export](https://support.claude.com/en/articles/9450526-export-your-claude-data); [artifact downloads and versions](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them); [consumer terms](https://www.anthropic.com/legal/consumer-terms) | Native export/file intake first. Retrieved terms prohibit scraping and restrict automated access; verify applicable locale/account terms before any direct integration |
| Midjourney: original images/video and generation metadata | PR #6 imports selected local images; no Midjourney content adapter | [Organize/download guidance](https://docs.midjourney.com/hc/en-us/articles/33329462451469-Organizing-Your-Creations); [terms](https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service) | Build excellent native-download handoff and local intake. Whole-account direct automation permission and completeness are not established by this research |
| Grok: chats, Imagine images/video | Rendered-media scraper exists; PR #6 local image intake | [Consumer FAQ](https://x.ai/legal/faq); [consumer terms](https://x.ai/legal/terms-of-service) | Treat current scraper as unverified for production claims. Local native-download intake; full review of relevant restrictions/export schema and real samples still required |
| Suno: songs, covers, lyrics, available stems/video | Public-profile harvester on main; official local intake in PR #4 | [Native single/multi-song download](https://help.suno.com/en/articles/2409921); [current help index](https://help.suno.com/en/categories/550017); [terms](https://suno.com/terms) | Native download then local ingest. Terms prohibit robots/scraping/extraction; legacy public endpoint/CDN reachability is not clearance. Review and disable/replace unapproved harvesting before store release |
| Gemini / AI Studio: chats, generated assets/files | Gemini scraper exists and has unmerged changes | [Google terms](https://policies.google.com/terms) inspected; surface-specific data export and API terms not yet fully reviewed | Separate consumer Gemini from AI Studio/API; no broad clearance. Require exact export/docs/account review and real samples |
| DeepSeek / Perplexity: chats, code, citations/files | Current-page scrapers on main | Current applicable export/automation terms not successfully verified in this research | Remain unverified; no new automation or support expansion until sources and route approval are recorded |
| Other apps: e.g. Udio, ElevenLabs, Runway, Kling, Sora, Leonardo, Canva, v0 | No adapter certification in this work | Not reviewed | Backlog only; distinguish API-created assets from consumer history, and native project exports from screenshots |

Do not present the last rows as installed integrations. No provider in this table
receives a blanket "compliant" badge. This specification does not itself disable
legacy runtime behavior: packet E0 must reconcile the shipping configuration.

Specific source findings that affect design:

- OpenAI's EU terms expressly restrict programmatic data/output extraction. Its
  official export help describes eligible account exports and workspace limitations.
  Therefore archive import and consumer-site extraction require separate decisions.
- Anthropic artifact documentation distinguishes source/file export, versions and
  hosted functionality. Preserving an artifact's source is not preserving its cloud
  runtime or state. The terms retrieval returned Korean; automated-access restrictions
  are present, but the applicable English/region version must be confirmed for release.
- Suno documents native batch downloading as ZIP and currently lists plan-dependent
  download limits in its help center. Its terms restrict scraping/extraction. Prefer
  official exports; account entitlement cannot be bypassed with a public CDN URL.
- The Midjourney native download documentation supports a user-operated export route.
  It does not establish a general third-party library API or our permission to crawl.

These are bounded source observations and engineering decisions, not an exhaustive
legal review. Maintain a dated, region/account-specific review and obtain qualified
legal review or provider clarification where permission remains ambiguous. No
provider outreach has been sent by this work.

## 4. Per-route approval record

Required before enabling an acquisition route in a distributable extension:

| Evidence | Required record |
| --- | --- |
| Applicable contract | Provider/product, consumer vs business/API, region, effective terms date, URL and checked-on date |
| Method basis | Native user export, documented API scope, written authorization or other reviewed basis; exact actions covered |
| Account rights | User-owned/authorized workspace, allowed formats, plan limits and administrative restrictions |
| Data scope | Minimum fields, destination, retention, third-party data, privacy disclosures and source attribution |
| Implementation | Allowed hosts/methods, rate/backoff policy, no credential export, no protection bypass |
| Technical proof | Exact adapter/build version, real sample, fidelity/completeness report and failure cases |
| Decision | Approved, restricted, unknown, blocked; reviewer, expiry/review date, permitted fallback |

Unknown/blocked routes do not execute. Approved routes are reviewed on provider
terms/API changes and before each release; set a maximum 30-day evidence age for
direct integration releases as an internal policy. A lapsed review pauses that
acquisition route while local browsing/export stays functional. No automatic
deletion of saved data. Store policy review and provider policy review are separate.

A future maintained compatibility registry can publish non-sensitive route status,
tested adapter versions and limitations. It must not download executable code into
the extension. A docs/status update is not permission to activate new behavior.
No scheduled monitor or recurring task is created by this specification.

## 5. Chrome distribution and privacy

The extension's single purpose is user-controlled preservation/export of their AI
work. All features, host permissions and store claims must serve that purpose.
Package execution code locally; do not remotely load scripts. Explain site and
download access at use time, store minimum local state, and expose deletion/export
controls for Kura-owned records. Use the same accurate data handling language in
the extension, privacy policy and store dashboard.

Chrome requires truthful metadata, a stated single purpose, testing and compliance
with its data policies. Passing an automated build is not store approval.
[Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies).

Use provider names descriptively; do not imply affiliation, approval or certification.
Preserve available source attribution/licensing metadata. Saving media and granting
commercial reuse rights are different questions; Kura records supplied rights evidence
and unknowns rather than certifying ownership. Optional public sharing/sync requires
its own privacy/data-rights design before implementation.

## 6. Keeping current without constant rewrites

Maintain one source ledger per adapter: official export docs, API references,
applicable terms, changelog/status source, authorized sample dates and revision-tested
capabilities. Review changed material before enabling a new route or updating a parser.
Record broken/retired endpoints rather than silently replacing them with unofficial
ones. Fixture tests run every relevant PR; live tests use dedicated authorized accounts
and samples at release, never private accounts in unattended shared CI.

Maintain one upstream ledger per reused project: exact package/commit, advisories,
license notices, upstream patch delta and owner. Accept an upgrade when it improves a
measured requirement and passes the corpus. "Latest" means checked and verified,
not automatically installed.
