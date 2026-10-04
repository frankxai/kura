# Capture to your second brain

Connect a private capture folder through Kura's side panel. Open ChatGPT, Claude
and Gemini conversation pages save after the response settles. Capture compares
message content and source identity, so edits and navigation can trigger another
save even when the message count stays the same. Three delayed retries follow a
failed write; returning to the chat triggers another attempt.

A shorter view cannot overwrite a fuller saved transcript. Open the complete
thread and repeat the capture. Changed transcripts retain content-addressed
Markdown revisions in the conversation's `_history/` folder.

Automatic capture requires a writable connected folder. A `!` badge means the
save was not acknowledged: open Kura, connect or re-grant the folder, then return
to the chat. Automatic capture does not fall back to a stream of Downloads.
Manual capture retains the existing Downloads fallback. A Downloads queue is
not evidence that a file has finished writing.

The first captured folder is reused through the existing IndexedDB index across
title changes and later capture days. The writer preserves curated frontmatter
and refuses to overwrite a different conversation identity. Keep the folder as
your source of truth. If the extension index is cleared, restore/reconcile it
with the existing files before continuing; automatic disk-index recovery remains
open work. Media fetch failures do not prevent the transcript from being saved.

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

Kura stays local by default. No new remote collection service, scheduler or
cross-provider account crawler is installed.
