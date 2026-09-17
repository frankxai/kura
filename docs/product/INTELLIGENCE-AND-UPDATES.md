# Intelligence, installed-build diagnosis and updates

Proposal, 2026-09-17. Extends the product contract; no runtime, keys, billing,
installed extension, update channel or browser automation is changed by this document.

## Current installed experience: what is known

The user supplied screenshots of Kura's Suno Harvester showing 880 indexed tracks,
zero flagged tracks and zero fetched tracks. The repository contains that Suno
module. Its selection mechanism is the star; `fetchFlagged` only queues flagged
catalog entries. An empty selection currently reaches `done` with `Fetched 0`,
and the UI fills the progress bar to 100%. This explains the screenshot's zero-work
result but does not establish that an actual download attempt succeeded or failed.

Audited files: `src/entrypoints/sidepanel/suno.ts`, `src/suno/harvester.ts`,
`src/suno/api.ts`. The engine is unchanged between inspected main and godmode heads.
Additional concerns: ledger paths are accepted without hash/read-back verification;
failed transfers largely surface as counts/console errors; cancellation is not
passed into the media `fetch`; missing cover-only work can be skipped when other
assets are complete; run cap is 40. Catalog scope is a public profile, not proof
of complete private-account history. A title alone is not track identity.

The screenshot also has a Cockpit tab. That string was absent across source in
main, godmode, its cleanup branch, SIS bridge and image pilot at the inspected
GitHub heads. The screenshot cannot establish the installed extension ID, source
folder, git revision or distribution channel. Local/unpushed modifications or a
different build are possibilities, not conclusions. Do not overwrite that build
before identifying and preserving its source.

Canonical repo: https://github.com/frankxai/kura . The local path recorded in issue
#5 is `C:/Users/frank/starlight/repos/kura`; the current Chrome-loaded path has not
been verified from this workspace. GitHub is source, `dist/` is a built package,
and the folder Chrome loaded can lag behind either. A Vercel deployment updates
none of those installed extension files.

## Product intelligence: three distinct levels

| Level | Behavior | Execution and cost | Delivery decision |
| --- | --- | --- | --- |
| Deterministic core | Detect route, explain selection, identify duplicates, compare metadata, resume jobs, report failures, search/filter | Local code; zero model tokens; provider plan/network/storage costs remain separate | Required first |
| Optional assistant | Explain selected content/errors, suggest tags/collections, draft search filters, compare selected creations; optional screenshot interpretation | Explicit bounded request to external client/API or evaluated local model | Read-only proposals first; user approves archive edits |
| Browser operator | Navigate and act on permitted sites, observe UI, recover within an approved task | Model/tool loop plus browser execution environment; variable cost and failure rate | Separate later experiment with allowed sites/actions, hard step/time/cost caps and independent review |

Use structured observations first, vision only where pixels add information. A
single explicitly captured viewport can answer "what am I looking at?" without
creating a continuously watching browser agent. Chrome provides a visible-tab
capture API with permission requirements and rate limits; it does not provide
automatic semantic understanding. [Chrome tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs).

For initial intelligence, prefer local library records and selected user content.
Offer "Explain this failure", "Suggest a collection" and "Turn my request into
filters". Do not use a model to decide whether a disk write succeeded or whether
a route is permitted. Model-derived labels stay separate from provider metadata;
original prompts/lyrics/timestamps cannot be reconstructed as fact by vision.

An optional screenshot request previews the exact crop/data and intended model
destination before transmission. No screenshots of unrelated tabs, background
monitoring or automatic page uploads. Treat page text as untrusted input, not tool
authority. Evidence and permission checks remain deterministic outside the model.

The existing Suno specification forbids keys/LLM calls inside the extension. Keep
that core boundary. The optional assistant is a proposed companion boundary, not
a silent repeal: external supported client or local process first. Any later
in-extension cloud feature requires an explicit architecture/privacy change.

## Keys, subscriptions and cost

Core: no key. Optional assistant choices, in preferred implementation order:

1. External local agent/client reads only selected archive records through a scoped
   file/MCP interface. That client's subscription/API terms govern its execution;
   no assumption that a consumer subscription can be embedded or resold by Kura.
2. BYOK local companion stores a restricted/revocable key in the OS credential
   store and calls the chosen API. No permanent secrets in content scripts, page
   storage, source files, archive receipts or a shipped JavaScript bundle.
3. A future managed gateway can remove user key setup, but adds authentication,
   metering, abuse control, privacy obligations and our inference bill. It is not
   needed for the first functioning exporter.

ChatGPT and API billing are separate. The computer-use APIs also require an
execution environment/tool loop supplied by the integrator; they do not give
Kura access to the user's existing ChatGPT or Claude browser session.
[OpenAI billing](https://help.openai.com/en/articles/9039756),
[OpenAI computer use](https://developers.openai.com/api/docs/guides/tools-computer-use),
[Claude computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool).

Budget formula: `(input tokens × input rate + output tokens × output rate) / 1e6`
plus tool/hosting charges. Include images, replayed context, retries and cached-token
rates in actual metering. Token-free export and optional inference have separate meters.

Illustrative text request at the documented Claude Haiku 4.5 standard rates of
$1/input-million and $5/output-million: 3,000 input + 500 output tokens costs $0.0055,
or $5.50 for 1,000 equivalent calls, excluding taxes/tools/hosting. This is arithmetic,
not a Kura measured workload or a vision/browser-operation quote. Screenshot and
multi-step tasks require separate measurement and may cost substantially more.
[Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).

Proposed pilot controls: assistant off by default; user-set monthly allowance;
estimate before a batch; maximum output tokens, steps, elapsed time and aggregate
spend enforced by the executor; no automatic model upgrade. Any example allowance
is a limit the user elects, not an assurance of a particular number of tasks.
Cache derived results by content hash + model + prompt/schema version. Infer over
new/changed selected records, never repeatedly over the whole 880-track catalog.

## Provider terms and browser use

Using Claude, ChatGPT, vision or human-looking clicks does not change the target
site's rules. Permission depends on the action, account and access method, not
which model chose it. Do not use visual automation as a fallback around a denied
API, CAPTCHA, rate limit, plan restriction or download entitlement. Preserve a
native user-operated route when automation is not cleared.

Suno documents native batch ZIP downloading and its terms restrict scraping/data
extraction. The current public-profile harvester is not certified by this audit;
review/disable or replace its unapproved route before distribution. Do not fix its
UX in a way that advertises it as cleared. Importing user-obtained originals and
organizing them locally is the initial supported design direction.
[Suno downloads](https://help.suno.com/en/articles/2409921),
[Suno terms](https://suno.com/terms).

## Update channels and build identity

| Channel | How new code reaches the user | Requirement |
| --- | --- | --- |
| Unpacked development | Update the correct checkout, build, reload extension; refresh affected provider tabs | First preserve dirty/unpushed work; verify Chrome-loaded directory and intended revision |
| Private store beta | Publish reviewed version to a test channel; Chrome distributes package updates | Store setup/submission required; stable extension identity and migrations tested |
| Public store stable | Publish a higher version through the Chrome Web Store | Review, release receipt, truthful listing and rollback plan |
| Hosted web companion | Deploy website assets | Does not update an installed extension |

For unpacked builds, reinstalling from scratch is normally unnecessary: replace
the built files in the same loaded folder and reload. Avoid removing the extension
or changing identity to "update" it; extension-local settings/handles can be lost
or belong to another origin. Reconnect the existing archive rather than copying it.
[Chrome reload instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

Store releases require a new package/version and review. A separate test item can
run beside production; its separate identity also means separate extension-local
state. Record that distinction and prevent competing writers to the same archive.
[Chrome Web Store updates](https://developer.chrome.com/docs/webstore/update).

Required About/Diagnostics fields: product version, build SHA, build date, channel,
dirty-build marker, adapter versions and capability review dates; Copy diagnostics
excludes secrets and local paths by default. Do not rely on a repeated `0.2.0`
manifest version to distinguish development builds. CI produces an installable ZIP,
SHA-256, changelog, test report and versioned release receipt from one exact commit.
No automatic git pull/remote-code loading in a distributed extension.

## Next implementation work

1. Identify installed source path/version and preserve Cockpit/local changes before
   consolidating branches. Add build identity to every test package.
2. Replace ambiguous stars with explicit selection, reserve favorites separately,
   disable zero-item actions and show actual destination and supported route.
3. Unify verified transfers: individual errors, restart recovery, data integrity,
   folder permission handling and original opening. Native intake stays available.
4. Package a reproducible beta update; prove update/reload preserves the local archive.
5. Add a separately evaluated read-only assistant. Autonomous browser operation
   remains gated on proven incremental value and provider permission.

Success is a reliable archive without AI; optional AI improves retrieval, curation
and explanation. The user must be able to turn it off without losing core functionality.
