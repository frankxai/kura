# Arcanea Threads — Vault Format Specification

> Version 0.2.0 · Locked 2026-05-13

This document is the contract between the **Arcanea Threads** browser extension
(the *capture layer*) and any downstream processor (Obsidian, Logseq, the
Claude Code `threads-process` skill, the Arcanea second-brain visualizer).

If a capture conforms to this spec, **any tool that reads it gets the graph for
free**. Obsidian's native graph view renders the connections without further
work — that is the day-one viral demo.

---

## 1. Design principles

1. **Local-first.** Captures land in the user's filesystem. No server. No
   account. No cloud round-trip. Privacy is the product.
2. **Obsidian-compatible by default.** YAML frontmatter, `[[wikilinks]]`,
   relative asset paths. Drop the folder into any Obsidian vault and it works.
3. **Plain Markdown everywhere.** The format is readable in `cat`, in
   GitHub, in any editor, in 30 years. No proprietary container.
4. **Entity-aware frontmatter.** Each note declares the worldbuilding entities
   it touches (`characters`, `locations`, `artifacts`, `lore`). The skill
   populates these; humans can override.
5. **Atomic notes.** One conversation = one folder. Media stays adjacent.
   Cross-references via `[[wikilinks]]`, never copy-paste.
6. **Idempotent.** Re-capturing the same conversation overwrites cleanly. No
   duplicate-suffix `(1).md` files.

---

## 2. Folder layout

The capture root is `ArcaneaThreads/` inside the user's default download
directory. Inside it:

```
ArcaneaThreads/
├── _index/
│   ├── chatgpt.md         # rollup note linking every chatgpt conversation
│   ├── claude.md
│   ├── gemini.md
│   ├── grok.md
│   ├── deepseek.md
│   ├── perplexity.md
│   └── all.md             # master rollup across platforms
├── _entities/             # populated by threads-process skill (see §5)
│   ├── characters/
│   │   └── <name>.md
│   ├── locations/
│   │   └── <name>.md
│   ├── artifacts/
│   │   └── <name>.md
│   └── lore/
│       └── <topic>.md
├── chatgpt/
│   └── 2026-05-13_naming-the-extension/
│       ├── conversation.md
│       ├── prompts.md           # extracted user prompts only
│       └── assets/              # images, code blocks as files, attachments
│           ├── img-01.png
│           └── snippet-01.ts
├── claude/
│   └── 2026-05-13_format-spec-review/
│       ├── conversation.md
│       └── assets/
├── grok/
│   └── 2026-05-12_imagine-character-set/
│       ├── conversation.md
│       └── assets/
│           ├── frame-01.mp4
│           └── frame-01-prompt.md
└── …
```

### 2.1 Slug rules

`<slug>` = `YYYY-MM-DD_<kebab-title>` where:

- `YYYY-MM-DD` is the capture date in the user's local timezone.
- `<kebab-title>` is the conversation title, lowercased, ASCII-only,
  non-alphanumeric runs collapsed to `-`, max 60 chars, trailing `-` trimmed.
- If a slug already exists, append `-2`, `-3`, etc. — never `(1)`, never
  timestamps in filenames.

### 2.2 Per-platform asset conventions

- **All platforms:** images that appeared inline → `assets/img-NN.<ext>`,
  preserving order of appearance.
- **Grok Imagine / DALL-E / Gemini Image:** generated media gets a sidecar
  `<asset>-prompt.md` with the generation prompt, model, and any
  Grok/OpenAI/Google metadata.
- **Code blocks** ≥ 30 lines are extracted to `assets/snippet-NN.<lang>` and
  referenced by `![[snippet-01.ts]]` in `conversation.md`.

---

## 3. `conversation.md` schema

Every conversation file is one Markdown document with three sections:
**frontmatter**, **header**, **body**.

### 3.1 Frontmatter

```yaml
---
# --- identity ---
id: <stable-id-from-source-platform>
slug: 2026-05-13_naming-the-extension
title: "Naming the extension"
platform: chatgpt              # one of: chatgpt | claude | gemini | grok | deepseek | perplexity
source: https://chatgpt.com/c/abc123

# --- capture ---
capturedAt: 2026-05-13T22:14:00+02:00
capturedBy: arcanea-threads/0.2.0
schemaVersion: 0.2.0

# --- shape ---
messageCount: 24
hasMedia: true
hasCode: false
durationApprox: 47m            # earliest → latest assistant message

# --- entity tags (populated by threads-process skill; user-editable) ---
characters: []                 # e.g. ["[[Talia]]", "[[Yuna]]"]
locations: []                  # e.g. ["[[Veldoria]]"]
artifacts: []                  # e.g. ["[[Starlight Mark]]"]
lore: []                       # e.g. ["[[Sacred Gear]]"]
themes: []                     # free-text strings, not wikilinks

# --- user-controlled ---
status: raw                    # raw | reviewed | canon | archived
worldbuilding: false           # true if user marked this as worldbuilding material
tags: []                       # any flat tags
---
```

**Required:** `id`, `slug`, `title`, `platform`, `source`, `capturedAt`,
`capturedBy`, `schemaVersion`, `messageCount`, `status`.

**Convention:** All entity arrays (`characters`, `locations`, `artifacts`,
`lore`) contain Obsidian wikilinks as quoted strings. Empty array on initial
capture; the `threads-process` skill fills them.

### 3.2 Header

```markdown
# {{title}}

> **Platform:** {{platform}} · **Source:** [{{source}}]({{source}}) ·
> **Captured:** {{capturedAt}}
```

### 3.3 Body

Messages render as alternating blockquoted sections:

```markdown
## You

{message content here, markdown preserved}

## {{assistantLabel}}

{message content here, markdown preserved}
```

Where `assistantLabel` is the platform-specific name:

| Platform   | assistantLabel |
|------------|----------------|
| chatgpt    | ChatGPT        |
| claude     | Claude         |
| gemini     | Gemini         |
| grok       | Grok           |
| deepseek   | DeepSeek       |
| perplexity | Perplexity     |

### 3.4 Inline references

- Images: `![](assets/img-NN.png)` (alt text is the original image's
  attached caption, if any)
- Code snippets ≥ 30 lines: `![[assets/snippet-NN.ts]]` (Obsidian embed
  syntax). Shorter snippets stay inline as fenced blocks.
- Quoted prompts inside the conversation: kept inline; no extraction.

### 3.5 Footer

```markdown
---

*Captured by [Arcanea Threads](https://github.com/frankxai/arcanea-threads).*
```

---

## 4. `prompts.md` schema

The same conversation's user prompts, extracted and numbered, for fast prompt
search:

```markdown
---
slug: 2026-05-13_naming-the-extension
platform: chatgpt
capturedAt: 2026-05-13T22:14:00+02:00
promptCount: 12
linksTo: "[[conversation]]"
schemaVersion: 0.2.0
---

# Prompts from "Naming the extension"

## 1
{first user message}

## 2
{second user message}

...
```

Empty `prompts.md` is omitted entirely (no zero-content files).

---

## 5. `_entities/` directory (skill-managed)

When the user runs `/threads-process` (the Claude Code skill), it scans
`ArcaneaThreads/**/conversation.md`, extracts named entities, and emits one
Markdown note per entity under `_entities/`.

### 5.1 Entity note schema

```yaml
---
name: Talia
kind: character                # character | location | artifact | lore
firstSeenAt: 2026-04-03T14:22:00+02:00
mentionCount: 7
appearsIn:
  - "[[chatgpt/2026-05-13_naming-the-extension/conversation]]"
  - "[[claude/2026-05-12_character-revisions/conversation]]"
canon: false                   # user-promoted to canon when confirmed
schemaVersion: 0.2.0
---

# Talia

> Auto-extracted by Arcanea Threads. Promote to canon by setting `canon: true`
> and moving this file to `.arcanea/canon/characters/`.

## Mentions
{auto-summarized synthesis of how Talia appears across the source conversations}

## Quotes
> "{verbatim quote 1}"
> — [[chatgpt/2026-05-13_naming-the-extension/conversation]]

> "{verbatim quote 2}"
> — [[claude/2026-05-12_character-revisions/conversation]]
```

The skill is **purely additive** within `_entities/`. It never modifies user
canon files, never overwrites `canon: true` entities.

---

## 6. `_index/` directory

Rollup notes per platform plus an `all.md` master rollup. Updated on every
capture.

```markdown
---
kind: index
platform: chatgpt
schemaVersion: 0.2.0
updatedAt: 2026-05-13T22:14:00+02:00
conversationCount: 47
---

# ChatGPT captures

| Date       | Title                                  | Messages | Entities |
|------------|----------------------------------------|----------|----------|
| 2026-05-13 | [[2026-05-13_naming-the-extension/conversation\|Naming the extension]] | 24 | 3 |
| 2026-05-12 | [[2026-05-12_format-spec-review/conversation\|Format spec review]]    | 18 | 1 |
| …          | …                                      | …        | …        |
```

Sorted newest-first. Pipe-escaped wikilinks for display titles.

---

## 7. Idempotence rules

A re-capture of the same conversation (matched by `id` + `platform`):

1. Overwrites `conversation.md` in place. The frontmatter's `capturedAt`
   updates; `slug` does not change.
2. Diffs `assets/`: new attachments are appended (`img-13.png`, `img-14.png`),
   existing files keep their numbering.
3. Re-runs `prompts.md` from scratch.
4. Re-appends to `_index/<platform>.md` only if the row didn't exist.
5. Leaves user-edited frontmatter fields alone: `status`, `worldbuilding`,
   `tags`, and any entity arrays the user manually curated. The skill
   re-merges, never clobbers.

---

## 8. Out of scope (intentionally)

- **PDF / DOCX / CSV exports.** Power users can run Pandoc on the markdown.
  Shipping a Pandoc-in-WASM bundle is a v0.3 decision.
- **Cloud sync (Drive / Notion / Obsidian Sync).** Out of scope by design.
  Users sync their own filesystem if they want sync. The extension stays
  zero-cloud, which is the privacy story.
- **Real-time graph visualizer.** Obsidian graph view does this for free
  on day one. The proprietary Arcanea second-brain visualizer is v0.4+.
- **Multi-vault.** One capture root per machine. Users with multiple Obsidian
  vaults symlink.

---

## 9. Version policy

`schemaVersion` is bumped on **any** breaking change to:
- Required frontmatter keys
- Folder layout
- Filename conventions

The skill refuses to operate on a vault with a newer `schemaVersion` than it
knows. It auto-migrates older vaults on first run, writing a one-line note to
`ArcaneaThreads/.migration.log`.

Current: **0.2.0** (locked 2026-05-13).
