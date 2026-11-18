# Capture to your second brain

Connect a private capture folder through Kura's side panel. Open ChatGPT, Claude
and Gemini conversation pages save after the response settles. Capture compares
message content and source identity, so edits and navigation can trigger another
save even when the message count stays the same. Three delayed retries follow a
failed write; returning to the chat triggers another attempt.

A shorter view cannot overwrite a fuller saved transcript. Open the complete
thread and repeat the capture. Provider-side deletions and shorter branch views
also require deliberate reconciliation; they cannot silently replace the fuller
source. Changed transcripts retain Markdown and exact-role packets together in
the conversation's content-addressed `_history/` folders. Timestamp-only
recaptures preserve the existing bundle and do not grow history.

Automatic capture requires a writable connected folder. A `!` badge means the
save was not acknowledged: open Kura, connect or re-grant the folder, then return
to the chat. Automatic capture does not fall back to a stream of Downloads.
Manual thread capture also requires that folder. Explicit single-file exports
from the local library use non-overwriting Downloads and can be retried from
their preserved local source. A Downloads queue is not a completed capture.

The first captured folder is reused through the existing IndexedDB index across
title changes and later capture days. The writer preserves curated frontmatter
and refuses to overwrite a different conversation identity. Keep the folder as
your source of truth. If the index is cleared, the writer searches the selected
platform's bounded capture folders by source ID and restores the existing folder.
Duplicate on-disk identities require deliberate reconciliation. Temporary media
fetch failures preserve the text and flag the capture for retry. An `i` badge
means text is saved but unsupported media needs an explicit manual export; it
does not trigger repeated retries for an unreachable host. Supported media URLs
use HTTPS on the extension's existing AI host scope without redirects.

New bundles also carry `capture.json` packet v1.0.0. It records exact message
roles and spans that the importer verifies against the readable Markdown body.
Embedded role headings, Unicode text and incomplete code blocks stay message
data. Older Markdown-only captures retain conservative count and fence checks;
recapture ambiguous files with the current extension. A mismatched packet stops
ingestion until the capture finishes or is repeated. The Markdown schema remains
v0.2.0; existing processors can ignore the optional companion.

SBO now reads a v0.2.0 Kura capture or a complete `Kura/` capture root. Raw text
stays in its private vault; the brain vault receives pending summary notes.
Unchanged inputs are skipped, source changes retain a private revision, and
curated brain notes survive re-import. See
[the processing SOP](https://github.com/frankxai/second-brain-os/blob/main/docs/automation.md).

Capture sees the visible loaded thread, including provider UI limitations. Use
official account exports for historical coverage. API credentials do not grant
access to unseen consumer-app conversations. Gemini Takeout is a backfill source;
its archive parser still needs verified fixtures before production support.

Message bodies are saved as Markdown, as `FORMAT_SPEC.md` §3.3 requires. Headings,
lists, tables, links, fenced code with its language and the TeX behind rendered
math are kept; buttons, icons and hidden elements are left out
(`src/core/dom-markdown.ts`). Text the page shows with preserved line breaks, such
as a typed prompt, is copied verbatim. A message is empty exactly when its flat
text was empty, so message counts do not shift under threads already on disk.
A heading whose text equals a role line is written in closed form (`## You ##`),
so nothing in a message body can be read as the start of the next message. If
the serializer cannot walk a page, that message is saved as flat text instead.
Prompts in `prompts.md` and media sidecars stay plain text.

Gemini, Perplexity and DeepSeek captures take their identity from the thread in
the page URL (`src/core/thread-id.ts`). A reload updates the same folder, moving
to another chat never reuses the previous identity, and SBO can match the capture
to its source thread. A capture made before this change keeps its earlier random
identity, so the first re-capture of such a thread creates one new folder. A page
whose URL names no thread yet gets a provisional identity for that path, retired
as soon as a real thread is reached so the next new chat starts with a fresh one.

The serializer is tested in Chromium on synthetic markup. That does not certify
any provider's current page structure: selectors remain unverified against live
pages, and no host permission, enumeration or background navigation was added.

Kura stays local by default. No new remote collection service, scheduler or
cross-provider account crawler is installed.
