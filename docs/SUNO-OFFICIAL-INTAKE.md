# Official Suno exports into the media ledger

Kura's existing public-profile harvester remains a separate intake path. This
local importer handles WAV/MP3 files the operator has already downloaded through
Suno's supported interface. It has no network, credentials, cloud uploads, or
platform download workaround. The existing vault and kura-suno/1 formats do not change.

Create an external export directory and an external intake directory. Map files
to the actual Suno IDs observed in the UI; do not infer IDs from song titles.

```json
{
  "schema": "kura-suno-local-import/1",
  "files": [{
    "sunoId": "11111111-1111-4111-8111-111111111111",
    "file": "my-official-export.wav",
    "contributionRefs": ["kura:conversation:YOUR_CAPTURE_ID#user-3"]
  }]
}
```

The UUID and reference above are examples, not real track or contribution evidence.

```bash
node scripts/suno-import-local.mjs --source /path/to/exports --intake /path/to/intake --manifest /path/to/mapping.json
node scripts/suno-import-local.mjs --source /path/to/exports --intake /path/to/intake --manifest /path/to/mapping.json --apply
node --test tests/suno-import-local.test.mjs
```

The first invocation validates and hashes all inputs without writing. The second
copies immutable audio and creates starlight.music-intake/1 receipts under
suno/imports/. Existing copies are rehashed; collisions never overwrite bytes.
Duplicate imports reuse identical receipts. Different contribution reference sets
produce new receipts. Only WAV and MP3 headers are accepted. This is a checksum
and header check, not a decoder or listening-quality test; downstream ffprobe/ffmpeg
validation remains pending. Large files are hashed as streams and copied on disk.

The Suno ID mapping, official-export claim, and contribution references are
operator declarations. Receipts do not establish platform entitlements, source
authenticity, legal authorship, copyright, or release approval. Files remain
private and rights remain unreviewed until the publisher records separate evidence.
Do not put runtime mappings, audio, receipts, private prompts, or capture data in Git.

## Downstream contract

The private archive controller can adopt these receipts through a separate
validated importer. Preserve sourceId as provenance; assign canonical work,
take, master, asset, version and rendition IDs in the media control plane.
Supabase records metadata and approval events; an R2/Blob adapter handles binaries.
Kura never uploads these files automatically. No downstream connector is claimed
to be installed by this change.

## Download budget

On 9 September 2026 Suno documented 20 song downloads/month on Pro and 60 on
Premier; repeat formats and stems of the same song count together, and unused
allowances do not roll over. Use official batch ZIP downloads for approved
selections. Inspect the account's current allowance before automation; never use
the historical CDN harvester as a way around an account limit or download gate.

Sources: https://help.suno.com/en/articles/2409921 and
https://help.suno.com/en/articles/13926209.
