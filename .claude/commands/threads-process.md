---
name: threads-process
description: Walk the local ArcaneaThreads/ vault, extract characters / locations / artifacts / lore from each conversation, populate frontmatter, and emit Obsidian-linked entity notes under _entities/. Idempotent. Never overwrites canon.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# /threads-process

You are the processing layer for an **Arcanea Threads** vault. The browser
extension has already done the capture — `~/Downloads/ArcaneaThreads/` (or
the path the user names) is a folder of platform-keyed conversation notes
written in Obsidian-compatible Markdown per `FORMAT_SPEC.md` v0.2.0.

Your job: turn raw captures into a **linked knowledge graph** that
Obsidian's graph view (or any wikilink-aware tool) can render. You add
entity links to frontmatter and emit per-entity notes. You never invent
content; every claim traces back to a verbatim source line in the captured
conversations.

## Input

The user may pass a vault root path as `$ARGUMENTS`. If empty, default to
`~/Downloads/ArcaneaThreads/` (Windows: `%USERPROFILE%\Downloads\ArcaneaThreads\`).

Validate the path exists and contains a `chatgpt/`, `claude/`, `gemini/`,
`grok/`, `deepseek/`, or `perplexity/` subdirectory before proceeding. If
not, report what's missing and stop.

## Pipeline

Execute in order. Each step must succeed before the next begins.

### Step 1 — Scope discovery

1. Glob `**/conversation.md` under the vault root.
2. Read each file's frontmatter (the YAML block between the first pair of
   `---` lines).
3. Build a working list of `{path, slug, platform, schemaVersion, status,
   capturedAt, messageCount}` entries.
4. **Skip** any file where `status: canon` or `status: archived`.
5. **Skip** any file with `schemaVersion` newer than 0.2.0 — log and
   continue, do not error.
6. Report the count and platform breakdown before continuing.

### Step 2 — Per-conversation entity extraction

For each in-scope `conversation.md`:

1. Read the full body (not just frontmatter).
2. Identify entities. Apply this taxonomy strictly:
   - **characters**: proper-named beings with agency that the user is
     exploring as people or personas (`Talia`, `Yuna`, `Cassandra of the
     Veil`). Skip generic role words (`the user`, `the assistant`,
     `someone`). Skip historical/real public figures unless the
     conversation is clearly using them as a worldbuilding reference.
   - **locations**: named places, settings, realms, cities, regions
     (`Veldoria`, `the Hollow Marches`). Skip vague spatial nouns
     (`a room`, `the office`).
   - **artifacts**: named objects, devices, weapons, sacred items, books,
     systems with proper names (`the Starlight Mark`, `the Codex of Eight`,
     `Sacred Gear`). Skip generic items (`a sword`).
   - **lore**: named systems, magics, factions, prophecies, themes that
     recur as concepts (`the Sacred Gear system`, `the Eight Origins`,
     `the Tarrasian Compact`). One-off observations are not lore.
3. For each entity, record:
   - `name` (the canonical form — prefer the longest / most specific form
     across mentions)
   - `kind` (`character` | `location` | `artifact` | `lore`)
   - one or two verbatim quotes (≤ 240 chars each) where the entity
     appears, with their position in the conversation
4. Be conservative. **Three soft signals beats one weak signal** — only
   include an entity if it appears more than once, or once with strong
   specificity (proper name + descriptive context).

### Step 3 — Frontmatter update (in-place)

For each in-scope `conversation.md`:

1. Read the current frontmatter.
2. Merge your extracted entity arrays into `characters`, `locations`,
   `artifacts`, `lore`. Each becomes a quoted `[[wikilink]]` string.
3. **Preserve user-edited entries** — if an array already has values and
   `status: reviewed` or higher, append-only; never remove what the user
   curated. If `status: raw`, you may replace freely.
4. Leave alone: `id`, `slug`, `title`, `platform`, `source`, `capturedAt`,
   `capturedBy`, `schemaVersion`, `messageCount`, `hasMedia`, `hasCode`,
   `durationApprox`, `status`, `worldbuilding`, `tags`.
5. Write the file back **with the body unchanged**. Frontmatter only.

### Step 4 — Entity note synthesis

For each unique entity discovered across the run:

1. Compute its slug: lowercase, ASCII, non-alphanumeric → `-`.
   Path: `_entities/<kind>s/<slug>.md` (note plural directory: `characters/`,
   `locations/`, `artifacts/`, `lore/`).
2. If the file already exists:
   - Read its frontmatter.
   - If `canon: true`, **do not touch the file**. Add the conversation to
     a deferred report instead.
   - Otherwise, merge new `appearsIn` entries (dedupe), increment
     `mentionCount`, refresh `appearsIn` order by newest-first.
3. If the file does not exist, create it with this frontmatter:
   ```yaml
   ---
   name: <Entity Name>
   kind: <character|location|artifact|lore>
   firstSeenAt: <ISO timestamp of earliest source>
   mentionCount: <int>
   appearsIn:
     - "[[<platform>/<slug>/conversation]]"
   canon: false
   schemaVersion: 0.2.0
   ---
   ```
4. Body (regenerated each run unless canon):
   - `# <Name>`
   - A one-line disclaimer: *"Auto-extracted by /threads-process. Promote
     to canon by setting `canon: true` and moving this file."*
   - `## Mentions` — a 3-5 sentence synthesis of how the entity is used
     across the source conversations. Do not invent details not present
     in the sources. If the entity appears only once, say so.
   - `## Quotes` — bullet list of the verbatim quotes you captured in
     Step 2, each followed by `— [[<source>/conversation]]`.

### Step 5 — Platform index refresh

For each platform with new captures in this run:

1. Read `_index/<platform>.md` if it exists; otherwise create it.
2. Refresh the table with one row per `conversation.md` for that platform,
   newest-first.
3. The `Entities` column counts the total `characters + locations +
   artifacts + lore` after Step 3.

### Step 6 — Run report

Emit to stdout a single, terse report:

```
ArcaneaThreads / threads-process — <timestamp>

Scope:
  Vault root: <path>
  Conversations in scope: <n>  (skipped <m>: canon=<x> archived=<y> newer-schema=<z>)
  By platform: chatgpt=<n> claude=<n> gemini=<n> grok=<n> deepseek=<n> perplexity=<n>

Extracted (this run):
  Characters: <n>  (new: <n>, updated: <n>, canon-locked: <n>)
  Locations:  <n>  (new: <n>, updated: <n>, canon-locked: <n>)
  Artifacts:  <n>  (new: <n>, updated: <n>, canon-locked: <n>)
  Lore:       <n>  (new: <n>, updated: <n>, canon-locked: <n>)

Frontmatter updated: <n> conversations
Indexes refreshed:   <n> platform notes

Next:
  - Review _entities/characters/* for false positives (esp. one-mention names)
  - Promote canon: set `canon: true` and `worldbuilding: true` on
    conversations you want in your second-brain proper.
  - Open the vault in Obsidian to see the graph.
```

## Hard rules

- **Never invent.** If you don't find an entity in the captured text,
  don't add it. Worldbuilding hallucinations destroy the trust contract.
- **Never overwrite canon.** Files with `canon: true` are sacrosanct.
- **Never touch the body of `conversation.md`.** Frontmatter only.
- **Idempotent.** Re-running on the same vault must produce the same end
  state (modulo file mtime).
- **Append-only for reviewed/canon conversations.** You only add to
  entity arrays if the user has not promoted past `status: raw`.
- **No network calls.** Pure local processing.
- **Schema gate.** Refuse to operate if any in-scope file declares a
  `schemaVersion` numerically greater than `0.2.0`. Log and skip.

## Run-time behavior

1. Validate vault root exists. If not, abort with a single-line error
   pointing the user to the manual install instructions for the extension.
2. Use the Glob tool to enumerate files. Do not Read every file
   speculatively — only Read what you need for the current step.
3. Process conversations in batches of 10 to keep memory low.
4. Print the run report only after every step succeeds. If a step fails,
   abort and print what completed.

## Example invocation

```
/threads-process
/threads-process ~/Documents/Brain/ArcaneaThreads
/threads-process "C:\Users\frank\Downloads\ArcaneaThreads"
```

## Why this exists

Capture is the cheap step. Linking is the hard step. The extension
guarantees the format; this skill guarantees the graph. Together they
turn raw AI conversations into worldbuilding material that compounds
across sessions — which is the entire point.
