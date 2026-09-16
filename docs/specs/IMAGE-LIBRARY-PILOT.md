# Image library pilot contract

Related: #5. This is additive local image intake, independent of locked conversation
FORMAT_SPEC v0.2.0. No migration, database rename, existing conversation rewrite, or
change to the Suno catalog/ledger. A future breaking image contract gets its own
version namespace; this feature does not change the conversation schemaVersion.

## Branch inspection and ownership

Base: `main` at `e6034b0`. Audited `agent/c940/kura-sis-bridge` (draft PR #3),
`agent/codex/suno-official-intake` (draft PR #4), `agent/claude/kura-godmode`,
and its cleanup successor `agent/claude/untrack-asph-wip`.
The Claude branches contain an unmerged FSA/offscreen capture writer and Gemini
hardening. Do not blindly merge their WIP. This feature uses the same `kura_vault`
handle key to converge with that work; it leaves the existing conversation path alone.

Owned surfaces: `src/images/`, `src/entrypoints/images/`, `src/styles/images.css`,
`tests/image-import.spec.ts`, the sidepanel image-library link, Grok media URL honesty,
repo identity corrections, README/spec/verification docs, package test script,
explicit ESLint browser globals, and the isolated image-import CI gate.

The Windows-only shared design kernel files named in AGENTS.md were not available
in this checkout. The UI follows the existing Kura typography/palette direction,
keyboard focus, native accessible dialogs, responsive sizing, reduced motion and
text-first progress/error feedback. No font downloads or third-party scripts.

## Supported entry points and limitations

- Midjourney: native downloads from the user's Organize page, extracted locally.
  Official guide: https://docs.midjourney.com/hc/en-us/articles/33329462451469-Organizing-Your-Creations
- Grok: native image downloads or extracted data export via Settings → Data Controls.
  Official guide: https://x.ai/legal/faq
- These providers' documented exports do not establish a stable public full-history
  image API contract. No guessed endpoints, cookie extraction or credential storage.
- Native download expiry belongs to the provider: request a fresh export there.
  Kura consumes the resulting local files, so it neither guesses nor retries expired
  remote URLs. No remote download/resume adapter is claimed.
- Source folder selection is read-only. A normal file picker is also supported.
  ZIP extraction is explicit, done by the user's OS; no archive parser executes.
- Header recognition supports PNG/JPEG/WebP/GIF/AVIF (including Grok `content` files).
  Decode must succeed before import. SVG, video and arbitrary attachments are excluded.
  Grok export contents are not guaranteed complete by xAI's export documentation.
- At most 2,000 entries are examined per scan, 10 images selected per import,
  32 MiB per image, 200 MiB estimated per batch, 30 nested folders. Cap exhaustion
  is shown as incomplete; it never becomes a provider completeness claim.
- No automatic library pagination is implemented. Folder traversal is incremental,
  selection and saved-gallery views are paginated. This is a pilot intake path.

## Persistence

Below the chosen Kura root:

```
_image-library/v1/
  imports/<run-uuid>.json
  midjourney/  (and grok/)
    originals/<sha256>.<detected-extension>
    thumbnails/<sha256>.webp
    receipts/<sha256>.json
    metadata/<sha256>.json  (only when a raw companion sidecar exists)
```

Originals and receipts are canonical. IndexedDB holds only the permissioned directory
handle using the existing FSA utility. No images are copied to browser storage.
Generation metadata stays null unless explicitly exposed in a sidecar. File mtime is
stored as `sourceFileModifiedAt`, never used as a generation date. Receipts distinguish
`kind: imported-image` from new generation. The original byte stream preserves embedded
metadata even when Kura cannot interpret it. No re-encoding of originals.

A Kura companion sidecar is named `<image-filename>.json`; for example
`creation.png.json` or `content.json`. This is an optional explicit interchange
format, **not a claim about native vendor JSON schemas**. Original sidecar bytes are
kept even when parsing fails. Fields: `prompt`, ISO `createdAt`, `sourceId`, HTTPS
`sourceUrl`, HTTPS `originalUrl`, `model`, string/number `seed`, object `settings`.
Other export JSON files are ignored; Kura does not infer metadata from names or titles.

Filenames are derived from SHA-256 only. All disk adapter paths reject traversal,
absolute paths, controls, backslashes and drive separators. Receipts validate their
original/thumbnail paths before reads. Arbitrary source text renders via textContent.

## Pause, resume and duplicates

One item runs at a time, serialized across Kura tabs using a Web Lock. The original
is copied, read back and hashed, then its thumbnail/metadata/receipt are recorded.
Each result and each pause is checkpointed. The filesystem write is closed before a
success is reported. A failed receipt can be recovered from the already-written
identical original. Existing different bytes are never overwritten.

Pause finishes the current item. On restart, reconnect the same destination and
reselect the same export and selection. Receipts are re-read and originals re-hashed;
completed files are skipped. New runs keep separate result ledgers. A duplicate with a
new filename retains its source path in that run's checkpoint, pointing to the same
receipt; first-import metadata is preserved. Duplicate sidecar enrichment is not done.

Retries (200/400 ms, at most two) are limited to transient disk contention errors.
Permission, quota, decode and integrity failures stay visible for intervention.
Failed-item retry uses the same selection; successful originals are verified/skipped.
A checkpoint write failure stops the batch; no false success is presented.

## Reconciliation and admission

`examined = image candidates + ignored non-images/sidecars + discovery failures`.
Every selected item is pending/imported/skipped/failed. ProviderTotal is always null.
DiscoveryComplete means the selected folder scan finished, not that all account
history was exported. The gallery counts saved receipts and surfaces invalid receipts.

Admission shows exact selected source bytes + raw sidecar bytes + 512 KiB/image
allowance for previews/receipts. Desktop browsers cannot inspect free space on a
picked physical drive; the operator explicitly checks available space and destination.
No full-history worker or bulk import option exists in this pilot.

## Viewing and cost

Local desktop Chrome/Edge full-tab gallery: thumbnails, provider filter, imported-date
filter, filename/prompt search, details, verified original-file opening, 24 cards/page.
Mobile/cloud/shared viewing are separate future products. No Vercel deployment was
created because this is an extension-owned local archive, not a server application.
No added AI tokens, provider API charges, cloud storage or egress; local bytes shown
before import. Never publish the user's library as a design preview.
