# Image library pilot verification

Status: **draft; not released; real-account acceptance still open**.

## Evidence from this build

- Inspected main and all four remote feature branches, draft PRs #3/#4, current
  storage adapters, FORMAT_SPEC, README, CLAUDE and AGENTS instructions.
- Connected Vercel account inspection returned no Kura project among its projects.
  This change stays a local extension; no cloud image upload/deployment was made.
- Official download routes checked: Midjourney Organize bulk selection/download;
  Grok Settings → Data Controls download. The APIs do not establish full accessible
  image-history enumeration for this feature.
- Runtime browser inspection: Midjourney displayed a Cloudflare security-verification
  page; Grok displayed Sign in/Sign up. No signed-in library was accessed or imported.
- TypeScript: PASS. ESLint: PASS. WXT production build: PASS.
- 10 image-import contract tests: PASS. Five existing Suno logic tests: PASS.
  Test originals are synthetic bytes; metadata is explicitly fixture metadata.
- Existing extension tests: locally BLOCKED before execution (Chromium absent).
  Downloading the official test browser timed out. xvfb package setup was unavailable
  in this environment. This is not a passing browser test result.
- Added end-to-end gallery tests for both providers, metadata/detail view, original
  opening, duplicate skip, provider/prompt filters, empty search, mobile width and
  keyboard dialog dismissal. They use synthetic images and test-only browser OPFS
  handles. They still require a browser runner; no private-account equivalence claim.
- Shared browser could not complete navigation to the local preview. Visual QA is
  pending; a successful build does not prove the final rendered design.

## Contract tests covered

1. Midjourney small local import: exact original bytes, metadata, counts, repeat skip.
2. Grok extensionless local import: the same checks, independently scoped by provider.
3. Pause after one item, read checkpoint from disk, resume remaining items without duplicates.
4. Simulated receipt-write failure after original save: recover without rewriting bytes.
5. Decoder failure stays visible while other files finish; retry skips previous successes.
6. Tampered original fails closed; unsafe receipt paths/traversal rejected.
7. Unknown metadata stays null; malformed raw sidecar retained with a warning.
8. Discovery totals reconcile; unsupported inputs excluded and scan limit marked incomplete.
9. More than 10 selected images rejected before any destination write.
10. Same bytes under different filenames produce one original, with both paths in the run ledger.

## Required before release / bulk work

- [ ] Independent review, including persistence failure paths and existing-branch integration.
- [ ] Run headed Chromium extension and gallery tests successfully.
- [ ] Visually inspect empty, preview, progress, failure, detail and populated-gallery states.
- [ ] Import a small actual authorized Midjourney sample (up to 10 images).
- [ ] Import a small actual authorized Grok sample (up to 10 images).
- [ ] Compare original dimensions and available metadata against sampled provider items.
- [ ] Open archived originals, close/reopen Kura, resume an interrupted actual import,
      repeat the same selection and confirm no duplicate bytes.
- [ ] Record selected-export totals versus provider-visible counts with limitations.
- [ ] Verify the intended local machine/destination and available disk space.

No bulk download, worker, full-history crawl, database migration or release was started.
#5 stays open until these acceptance gates are met.
