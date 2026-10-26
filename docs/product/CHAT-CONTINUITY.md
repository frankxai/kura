# Chat continuity and Second Brain integration

Status: proposal saved 2026-10-09. This document extends the existing product
plan for review. It changes no runtime, format, permissions or release status.
Tracking: [Kura #12](https://github.com/frankxai/kura/issues/12) and
[Second Brain OS #10](https://github.com/frankxai/second-brain-os/issues/10).

## User outcome

A creator returns to a project, finds its original conversations and accepted
decisions, sees the next unfinished action with evidence, and resumes in the
chosen assistant. The result must remain useful after an extension reinstall
or an interrupted import.

Reuse the [product contract](README.md), [capture-to-brain contract](../CAPTURE-TO-BRAIN.md),
[native intake](../NATIVE-INTAKE.md) and
[Second Brain architecture](https://github.com/frankxai/second-brain-os/blob/main/docs/architecture.md).
The private portfolio proposal holds the suite, commercial and ROI analysis;
this public plan contains the reusable product requirements.

## Component boundaries

| Component | Responsibility |
| --- | --- |
| Kura | Capture loaded conversations, save portable sources, search saved/open chats and open the original source. Files remain canonical; the extension index is rebuildable. |
| Second Brain OS | Official-export backfill, deterministic identity joins, private source revisions, pending notes and reviewed knowledge. Raw captures remain outside the MCP brain. |
| SIS | Shared project, decision, provenance, continuation and evaluation semantics, subject to reviewed artifact ownership. |
| Existing Starlight views | Render authorized records and evidence. Select a verified existing surface before implementation; do not create a second command center. |
| Supported browser harness | Execute a bounded browser action, stop on uncertainty and return a verified receipt. Kura's capture contract does not grant arbitrary execution. |

No access to unopened account history is implied. Official exports supply
backfill. Logged-in page controls are not a stable public history API.

## Proposed records and intake contract

These are design requirements, not additions to the locked v0.2.0 format.
Breaking persistence changes need a separately reviewed version/migration plan.

- Source identity: provider, account/workspace scope and conversation ID. Titles
  and project-wrapped URLs must not create duplicate conversations.
- Source evidence: original URL, message IDs, parent/edited branch lineage,
  selected branch, provider project ID when actually present, timestamp, hash,
  capture coverage and privacy class. Missing provider metadata stays unknown.
- Project association: a stable internal project ID, verified provider mappings,
  explicit owner and optional verified repository/issue links. Allow proposed
  mappings to be reviewed before promotion.
- Decision: proposed, accepted, superseded or unresolved, with source references,
  actor, time and revision. A newer assistant answer does not automatically
  supersede an accepted decision.
- Work state: needs continuation, blocked, unknown or done with artifact/external
  verification evidence. Link existing issues; avoid a competing task queue.
- Continuation packet: objective, accepted choices, changed evidence, open
  questions, original sources, permitted next action, budget and stop condition.
- Action receipt: operation, scoped target, before/after evidence, attempt ID,
  idempotency key, result, verification time and measured cost when available.

Preserve full conversation URLs plus local message references where a provider
lacks stable message deep links. Partial page captures must not replace richer
official exports. Repeated imports preserve curated notes and source revisions.

## Browser behavior

The first supported journey is select project, inspect context, choose assistant,
reuse an existing source tab or open it explicitly, and inspect the result.
Automatic bulk tab opening is not the default. Project moves require a bounded
scope and confirmation that the visible UI reached the requested destination.
One controller owns a tab at a time; local and browser sessions reconcile through
a checkpoint rather than steering it simultaneously.

Evaluate the supported OpenAI Chrome integration first. Stagehand and Browser Use
are alternative adapters to compare after the capture/resume journey works.
Messages, publication, purchases, deletion and visibility changes need their own
action scope. Bundle extension behavior in the reviewed MV3 package and retain
the existing site permission and no-telemetry boundaries.

## Installation and model diagnosis

An installation doctor should check native registration, exact extension origin,
app/CLI compatibility, resources-path existence, protocol handshake, folder grant,
write acknowledgement, index recovery and the current authenticated model catalog.
Paths tied to an old installed app and a stale bundled CLI can produce different
failures and need separate checks. This plan does not implement those repairs.

Read available models from the executing runtime. Record provider, model,
capabilities, authentication route and price version where applicable. A model
visible in Codex need not be available under the same name in ChatGPT or an API.
Use deterministic code for identity, ingest and permissions; evaluate economical
classification and stronger conflict/continuation reasoning on the same fixtures.
Keep hosted-model processing explicit even when captures are stored locally.

## First acceptance slice

1. Resolve the existing destination vault in Second Brain #10 without migrating,
   deleting or repointing an archive on assumption.
2. Select ten consented project conversations, record their expected identities,
   branches and mappings privately, and include one incomplete capture.
3. Verify one live browser capture and one official-export backfill. Import twice
   without duplicate conversations or loss of edited branches/curated notes.
4. Review a cited note and one continuation packet. Inspect accepted versus
   proposed decisions and done versus unknown work state.
5. Resume the correct original conversation, preferentially reusing its tab.
   Verify any scoped project organization with a before/after receipt.
6. Revoke/regrant folder access, interrupt an import and rebuild the extension
   index from disk. Confirm richer sources and accepted notes survive recovery.
7. Bind checks and independent review to the exact revision. Compare task success,
   recovery time, correction effort and cost with native projects/manual search
   and an Obsidian import workflow. Record failures as well as successes.

No full live capture-to-reviewed-memory cycle or customer savings was established
by the research behind this proposal. Existing issue acceptance remains open.

## References

- [OpenAI Chrome extension](https://learn.chatgpt.com/docs/chrome-extension)
- [OpenAI MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Chrome MV3 policy](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Stagehand](https://docs.stagehand.dev/v4/first-steps/introduction)
- [Browser Use](https://github.com/browser-use/browser-use)

No upstream implementation was copied, browser controller activated or public
pricing established by this documentation save.
