# Kura → SIS operating model

**Status:** design contract. Only the capture, bridge, and bridge-state boundaries described below are implemented in this repository. This document does **not** claim that SIS triage, router processing, roadmap promotion, or coding-agent dispatch is automated today.

## Purpose

Turn an explicitly exported AI conversation into reviewable knowledge and potential work without creating a second memory system, leaking private chat text, or allowing an idea to autonomously start coding agents.

Kura is the local capture layer. The local Kura vault remains the canonical raw source. SIS is the knowledge and decision system. `agentic-ops` remains the operating control plane.

## Implemented boundary

```text
User-opened supported AI chat
  → explicit Kura export
  → local Kura/<platform>/<slug>/conversation.md
  → kura-sis-bridge
  → metadata-only SIS intake envelope
```

The bridge validates frontmatter, uses a stable SHA-256 of the conversation body for deduplication, writes only a pointer envelope, and retains private idempotency state outside git. A raw conversation body must never enter a tracked intake file.

## Target flow and gates

```text
Kura vault (canonical raw source)
  → bridge envelope (privacyClass: unknown)
  → local privacy/secret review
  → sanitized candidate extraction
  → SIS candidate memories / ideas / decisions / work packets
  → weekly evidence-based proposal
  → agentic-ops CANDIDATE
  → independent/human approval to READY
  → path-scoped coding-agent work
  → verified outcome recorded in existing operations ledger
```

| Boundary | Required rule | Current status |
| --- | --- | --- |
| Capture → vault | User-initiated export of the already-open page; no history crawler or signed-in browser automation | Implemented in Kura; live provider compatibility still needs manual dogfood receipts |
| Vault → intake | Metadata pointer only; validated frontmatter; content-body hash; private state | Implemented and regression-tested |
| Intake → triage | `privacyClass: unknown` remains local until privacy/secret review succeeds | Not implemented; mandatory activation gate |
| Triage → SIS | Emit candidate-only structured output with source evidence | Not implemented; SIS target contract must be verified first |
| SIS → operations | Candidate work cannot dispatch work; promotion requires evidence, scope, evaluator, and approval | Operating policy; no Kura automation |
| READY → coding agent | One owner, repo and path scope, acceptance criteria, verification, rollback | Existing agentic-ops discipline; intentionally manual at this boundary |

## Minimal data contracts

### 1. Kura capture

Kura supplies its canonical `conversation.md` metadata: platform, stable conversation ID, title, source URL, capture time, schema version, message count, and a Kura-generated kebab slug.

### 2. Bridge envelope (`kura-bridge/1`)

The implemented envelope contains:

```yaml
kind: kura-intake-envelope
status: pending-triage
privacyClass: unknown
sourcePlatform: chatgpt
sourceId: "..."
sourcePath: "chatgpt/2026-.../conversation.md"
sourceSha256: "..." # canonical conversation body only
capturedAt: "..."
bridgedAt: "..."
```

It is deliberately a pointer. It must not contain messages, attachments, credentials, or an LLM-produced summary.

### 3. Candidate extraction (design contract)

A future daily triage command may emit only bounded candidate records:

```json
{
  "source": "kura:<platform>:<conversation-id>",
  "privacyClass": "reviewed",
  "memories": [],
  "ideas": [],
  "decisions": [],
  "workPackets": [
    {
      "objective": "...",
      "repo": "...",
      "pathScope": ["..."],
      "evidence": ["kura:<platform>:<conversation-id>"],
      "acceptance": ["..."],
      "status": "candidate"
    }
  ]
}
```

This is a proposed contract, not a live SIS schema. Verify the canonical SIS and `agentic-ops` write targets before implementing it.

## Cadence

| Cadence | Job | Model boundary | Output |
| --- | --- | --- | --- |
| Hourly or on demand | Run the bridge with `--quiet-if-idle` | No model | New/changed envelopes only |
| Daily | Review newly queued envelopes, sanitize locally, then extract bounded candidates | No model by default; a free router may receive only approved redacted material | Candidate JSON and a receipt; no external operations write |
| Weekly | Deduplicate approved candidates and propose evidence-backed repo work | Primary model may read summaries/evidence only | `CANDIDATE` work packets, never `READY` |
| Per work packet | Independent review and human approval | No automatic model decision | A path-scoped `READY` handoff or rejection |

A scheduler belongs **outside Kura** and must not be created until a real local Kura capture, the canonical SIS intake target, and the selected model/privacy route are verified. It needs a lock, dry-run mode, bounded retries, structured receipts, and an alert on fatal failure.

## Model ladder

1. **No model:** discover, validate, hash, deduplicate, create receipts.
2. **Local privacy gate:** classify and redact before any optional external route.
3. **Free router:** only small, redacted, reversible extraction/classification jobs with a schema and fallback. Never make durable routing or archival decisions.
4. **Primary model:** weekly synthesis of validated summaries/evidence only.

**Hard rule:** raw or `unknown`-privacy conversations never leave the local machine for a free or remote model.

## Failure and observability

- Invalid captures are reported and must not advance bridge state.
- Corrupt bridge state fails loudly and must not be overwritten automatically.
- Every stage records counts, provenance, model/version (if any), and explicit status—not raw chat text.
- A no-signal daily run emits a compact receipt and creates no filler memories or tasks.
- Operational truth is the existing ledger and git/queue deltas, not chat scrollback.

## Explicit non-goals

- No unattended scraping of logged-in ChatGPT, Claude, or other chat histories.
- No body copies in SIS intake, git, agent queues, or telemetry.
- No second database, in-extension daemon, cloud sync layer, or parallel scheduler.
- No analytics SDKs, new broad host permissions, or automatic Arcanea contact during standard local export.
- No candidate-to-`READY` auto-promotion.
- No coding-agent dispatch from a Kura envelope or candidate record.
- No model-generated change without repository scope, acceptance criteria, verification, and rollback conditions.

## Activation checklist

Before scheduling the first recurring run:

1. Manually dogfood Kura with one non-sensitive conversation for each supported provider being claimed.
2. Confirm the bridge output against that real local vault using `--dry-run` first.
3. Verify SIS's canonical candidate/intake write target and its privacy gate API; do not infer it from a document name.
4. Repair and probe the chosen router without chat content. Record only a non-sensitive health receipt.
5. Run a redacted fixture through the candidate schema and inspect the result.
6. Create the scheduler with no external model enabled; enable bounded free-router work only after the privacy/review controls pass.
