# Kura → SIS dogfood bridge

Kura is the **capture layer**, not the second brain or task dispatcher. This bridge keeps that boundary intact:

```text
Signed-in AI chat → Kura extension → local Kura/ Markdown vault
                                   ↓
                     metadata-only bridge envelope
                                   ↓
                SIS intake + private bridge state
                                   ↓
          local sanitization → bounded triage → candidate work packets
                                   ↓
        SIS vaults / agentic-ops queue / human-approved coding lanes
```

## Invariants

1. `Kura/` remains the canonical raw conversation archive.
2. The bridge writes only source metadata and hashes to the SIS intake queue; it never duplicates a conversation body into a tracked intake file.
3. `privacyClass: unknown` is a hard gate: no external/free-model route may receive the source until a local sanitization pass classifies it.
4. The bridge only creates **candidate** memories, ideas, decisions, and work packets. It never starts a coding agent, edits a roadmap, opens an issue, or changes a repository.
5. The bridge state lives in a private, ignored location. It records hashes and paths, not conversation content.

## Local command

```bash
cd C:/path/to/kura
pnpm bridge:sis -- \
  --source "C:/Users/<you>/Downloads/Kura" \
  --intake "C:/path/to/Starlight-Intelligence-System/memory/intake/kura" \
  --state "C:/path/to/Starlight-Intelligence-System/private/kura-bridge-state.json"
```

Use `--dry-run` to inspect a vault without writing, `--json` for a machine-readable receipt, and `--quiet-if-idle` for a changed-only watchdog.

An emitted intake note contains:

- Kura platform, stable conversation ID, title, capture time, and source URL
- a source path **relative to the selected Kura root**
- SHA-256 of the canonical `conversation.md`
- a pending-triage privacy gate

It intentionally does **not** contain the conversation body.

## Automation design

### 1. Deterministic watcher — every hour, no LLM

Run the bridge with `--quiet-if-idle`. Empty output means silence. It is cheap, idempotent, and only queues new or changed Kura captures.

### 2. Daily triage — once, bounded

A scheduled agent reads only envelopes queued since its last receipt, opens the referenced source locally, applies SIS/The Veil sanitization, then emits strict JSON candidates:

```json
{
  "memories": [],
  "ideas": [],
  "decisions": [],
  "workPackets": [
    {
      "objective": "…",
      "repo": "…",
      "pathScope": ["…"],
      "confidence": 0.0,
      "evidence": ["kura:<platform>:<id>"],
      "acceptance": ["…"],
      "status": "candidate"
    }
  ]
}
```

Cap the daily pass by both item count and redacted character budget. A no-signal pass writes a receipt and does not synthesize filler.

### 3. Weekly distillation and routing

A higher-quality model receives the daily candidate summaries, never the whole raw vault. It deduplicates themes, promotes only patterns seen at least three times, and proposes a repo-aware work packet using `REPO-REGISTRY.md` and `agentic-ops` ownership rules.

Candidate work packets are written to the control plane as `CANDIDATE`, with evidence and an explicit evaluator. They become `READY` only after a human or independent evaluator accepts the routing. Coding agents consume `READY` packets only, under a path-scoped lease.

## Model ladder

- **No model:** discovery, hashing, validation, dedupe, receipts.
- **Local/sanitization pass:** privacy classification and redaction before any remote inference.
- **Free router:** low-risk, redacted extraction only; never raw personal/private chats. The router must pass an explicit health probe before cron is enabled.
- **Primary model:** weekly strategic synthesis and ambiguous repo routing; it receives only validated summaries/evidence.

## Dogfood acceptance

- [ ] Extension built and loaded from `dist/` in Chrome developer mode.
- [ ] Capture one non-sensitive conversation each from ChatGPT and Claude.
- [ ] Bridge emits metadata-only envelopes for both.
- [ ] Re-run reports both captures unchanged.
- [ ] Daily triage produces candidates with provenance and no external write.
- [ ] Weekly routing produces candidates, not autonomous coding runs.
- [ ] User reviews the first weekly report before any `READY` task is dispatched.

## Store boundary

Chrome Web Store distribution comes **after** the dogfood acceptance above. The Store release must separately prove all platform scrapers, final icons/assets, accurate privacy disclosures, and user-visible functionality. No SIS integration changes Kura's local-first extension promise or adds an automatic network route.
