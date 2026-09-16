# Image library pilot verification

Status: **draft; not released; real-account acceptance still open**.

## Evidence from this build

- Inspected main and all four remote feature branches, draft PRs #3/#4, current
  storage adapters, FORMAT_SPEC, README, CLAUDE and AGENTS instructions.
- Connected Vercel account inspection returned no Kura project among its projects.
  The initial implementation was extension-only. A subsequent production web companion uses the same local importer; image bytes are never uploaded.
- Official download routes checked: Midjourney Organize bulk selection/download;
  Grok Settings → Data Controls download. The APIs do not establish full accessible
  image-history enumeration for this feature.
- Runtime browser inspection: Midjourney displayed a Cloudflare security-verification
  page; Grok displayed Sign in/Sign up. No signed-in library was accessed or imported.
- TypeScript: PASS. ESLint: PASS. WXT production build: PASS.
- 10 image-import contract tests: PASS. Five existing Suno logic tests: PASS.
  Test originals are synthetic bytes; metadata is explicitly fixture metadata.
- Existing extension tests: initially locally BLOCKED before execution (Chromium absent).
  Downloading the official test browser timed out. xvfb package setup was unavailable
  in this environment. Verification was completed on the GitHub Chromium runner instead.
- Added end-to-end gallery tests for both providers, metadata/detail view, original
  opening, duplicate skip, provider/prompt filters, empty search, mobile width and
  keyboard dialog dismissal. They use synthetic images and test-only browser OPFS
  handles. GitHub run 35157822184 passed **all 23 tests in real Chromium**, including
  the six existing extension checks, two gallery browser tests, ten image contracts
  and five Suno tests. No private-account equivalence claim.
- Shared browser could not complete navigation to the local preview. GitHub CI
  captured empty, populated, import-preview and narrow-layout screenshots. These
  were downloaded and visually inspected: hierarchy, spacing, preview cards, provider
  choice and responsive layout are readable. Images shown are synthetic test fixtures.
  Corrected narrow navigation spacing and retained date filtering at narrow widths.

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

## Required before full-library release / bulk work

- [ ] Independent review, including persistence failure paths and existing-branch integration.
- [x] Run headed Chromium extension and gallery tests successfully (23 tests).
- [x] Inspect CI screenshots of empty, preview and populated-gallery states.
- [ ] Visually inspect progress, failure and detail states with actual provider images.
- [ ] Import a small actual authorized Midjourney sample (up to 10 images).
- [ ] Import a small actual authorized Grok sample (up to 10 images).
- [ ] Compare original dimensions and available metadata against sampled provider items.
- [ ] Open archived originals, close/reopen Kura, resume an interrupted actual import,
      repeat the same selection and confirm no duplicate bytes.
- [ ] Record selected-export totals versus provider-visible counts with limitations.
- [ ] Verify the intended local machine/destination and available disk space.

No bulk download, worker, full-history crawl or database migration was started. The bounded web pilot can be hosted separately from the extension release.
#5 stays open until these acceptance gates are met.

CI evidence: https://github.com/frankxai/kura/actions/runs/35157822184
