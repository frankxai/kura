# Music producer integration

Proposal, 2026-09-17. This document adds product requirements, not an installed
plugin, generation service, scheduled job or approval to spend credits. It does
not change Kura's capture-only runtime boundary or FORMAT_SPEC.md v0.2.0.

## Decision

Keep one Kura browser extension. Add music-specific views within its local library:
album collections, related takes, playback, listening notes and provenance.
Develop creative planning and orchestration in the existing producer system,
exposed through portable skills and an optional scoped file/MCP handoff.
Do not create a second extension, another music repository or a required website.

Kura owns preserved assets and user curation. The producer owns briefs, plans,
prompt packets and proposed decisions. Suno owns its native generation/editing
surface. A DAW owns editable production sessions. A release workflow owns delivery
to distributors. These tools exchange versioned records rather than sharing
credentials or silently acquiring authority over each other's actions.

## Existing foundations inspected

| Repository | Observed evidence | Integration decision |
| --- | --- | --- |
| [Agentic Music Producer OS](https://github.com/frankxai/agentic-music-producer-os) | README and architecture describe a Hermes profile, portable skills, session receipts, album ledger and local Chrome operator | Reuse its brief/packet/session concepts; reconcile its operator with current provider permission before execution |
| [Suno MCP Server](https://github.com/frankxai/suno-mcp-server) | README explicitly labels Phase 1 prompt strategy scaffolded; generation router is later work | Evaluate prompt preparation contracts; do not present it as an official Suno generation API |
| [Music Intelligence Systems](https://github.com/frankxai/music-intelligence-systems) | README labels public vertical charter v0.1 and says no shipped runtime is claimed | Use domain boundaries as reference, not proof of functioning automation |

Evidence snapshot: README blobs respectively
`bc58ccd49a717adc6309a7fc78c4f2377de40228`,
`c834307f4086c88b0d3a3e5d60c516ada05e8daf`,
`26ad9a66df4b9866ea0af33625bae03a81ccae88`.
Producer architecture blob: `c6df61001570bc871a232e588e73690810540865`.
This is a documentation inspection, not a runtime or local-install audit.
No code was copied. Pin code revision and inspect licenses before reuse.

Existing Media Studio and Original Songcraft skills supply useful quality rules:
exact prompt/lyric preservation, explicit sonic identity, controlled changes,
listening evidence and separate release decisions. General music projects must
not inherit Arcanea characters, lore or artist identities without selection.

## A complete production loop

1. **Album brief:** audience, emotional premise, artist identity, language/locale,
   track count, sonic palette, exclusions, reference rights and spending ceiling.
2. **Track map:** each track has a distinct role, hook, lyrical scene, energy and
   arrangement arc. Sequence for contrast and cohesion; do not mass-produce the
   same song with different titles.
3. **Versioned packets:** exact title, lyrics, style, settings, model and selected
   Voice/Persona where offered. Maintain desired identity separately from observed
   provider settings; a text description does not guarantee vocal continuity.
4. **Generation handoff:** user executes in Suno's native UI initially. Record actual
   returned take IDs and the packet used. A planned generation is never a generated
   take. Any future programmatic route requires provider permission and a budget.
5. **Listening:** compare actual audio, annotate timestamps, evaluate hook, diction,
   voice continuity, structure and audible defects. Keep/revise/reject are producer
   decisions. An LLM's critique of lyrics is not an audio listening receipt.
6. **Controlled revision:** change one intended variable per iteration; record
   parent take and reason. Preserve successful originals before edits and exports.
7. **Production:** native edits/stems where available, then DAW arrangement/mix/master.
   Preserve source versus derived files; label MP3-derived WAV honestly.
8. **Release preparation:** selected masters, lyrics, artwork, credits, rights evidence
   and checklist. Publishing/distribution requires a separate explicit instruction.

## Multilingual music

Model one composition with multiple language adaptations and separate recordings.
Do not collapse composition identity, translation identity and take identity.
Store locale (for example en-GB, de-DE, es-MX), original language, lyric revision,
adaptation relationship, pronunciation notes and review evidence.

Adapt meaning, stress, syllable length, rhyme, register and singability together.
Preserve Unicode in titles and lyrics. For mixed-language songs, track section
languages and intended switches. Support right-to-left scripts in the review UI;
transliteration is an optional aid, never a replacement for the original script.

Language checks must cover actual sung words and pronunciation, not only written
grammar. Machine suggestions remain unverified until listening review; commercially
important language versions need a fluent reviewer. Never promise every language
works equally well in every model. Test the selected locale/model combination.

## Music-library UI requirements

| Surface | Required behavior |
| --- | --- |
| Side panel | Show selected album, current task and one clear next action: prepare packet, open provider, import downloads or review takes |
| Album collection | Track order, language versions, missing audio/metadata, shortlisted recordings and unresolved work; never infer completion from indexed count |
| Take comparison | Two playable originals, seek/loop, timestamp notes, keyboard controls, no autoplay; optional comparison gain affects playback only |
| Version detail | Parent take, exact lyric/style/settings, source URL, observed download format, file hash, user decision and missing-evidence labels |
| Selection | Checkboxes for transfer selection; favorites separate. Zero selected disables transfer with an explanation |
| Handoff | Preview selected records and destination before export to an assistant; no full-library upload by default |
| Away queue | Explicit scope, planned versus observed counts, reserved versus actual spend, stop reason and next human action |

Transfer status and creative status are separate. A saved file may be unreviewed;
a liked take may be missing its source audio. Suggested creative labels: Unreviewed,
Shortlisted, Needs revision, Selected master. None implies cleared commercial rights.

## Away mode and provider constraints

Useful unattended work begins with preparing briefs, language alternatives,
prompt packets, selected-file inventory and release drafts. Local technical audio
checks may run when implemented and authorized. Cloud model processing requires
selected data scope and its own allowance; do not automatically upload Suno output
to another model without checking the applicable use terms.

Suno's current terms restrict robots, scraping and similar extraction, prohibit
bypasses and constrain use of outputs with other AI tools. A logged-in session,
MCP wrapper, vision model or one-click budget does not establish provider permission.
The existing producer browser operator is therefore not a cleared Kura integration.
This review did not establish an official public Suno generation API.
Use native generation/export and local intake until the exact automated route is
documented as permitted. [Suno terms](https://suno.com/terms).

The official help center documents native editing, Workspaces, Voices/Style Personas,
stem separation and export options. Plan/model availability must be checked at use;
do not duplicate those tools in Kura. Current voice-model terms allow a user's own
voice, not another person's voice. [Suno help](https://help.suno.com/en/categories/550017).

If unattended generation becomes essential, evaluate a provider-documented music
API or a properly licensed local model as a separate adapter. Recheck current rights,
prices, export conditions and hardware before selecting one. Do not route Suno
output into that provider as reference material by default.

An eventual executor needs: a pinned brief and versions, permitted provider/actions,
generation and cash/credit ceilings, retry limits, deadline, cancellation, durable
receipts and crash recovery. Reserve budget before submission; reconcile ambiguous
results before retrying a chargeable action. Stop on auth challenges, changed terms,
uncertain submission, exhausted allowance or repeated quality failures. Never use
an MV3 worker or a chat tab as the sole persistent scheduler. No job is scheduled
by this proposal.

ChatGPT Work can be the initial planning/review surface; its cloud browser is a
separate browser, not the user's installed Chrome session. Supported tasks can
continue after the user leaves, subject to inputs and confirmations. This is useful
orchestration capability, not Suno-specific authorization or a production SLA.
Local tooling is useful for the existing installation, folder access and DAW work.
[Work documentation](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex),
[cloud browser](https://help.openai.com/en/articles/20001280-using-cloud-browser-in-chatgpt).

## Bounded delivery and acceptance

Keep issue #5's small real Midjourney/Grok import gate first; a music initiative
does not certify or replace it. After that, integrate the official Suno intake
work from PR #4 before expanding the music UI.

Music pilot: one song, two chosen languages and four total existing authorized
takes, or four newly generated takes only under a separately approved budget.
Prepare a three-track mini-album map, but prove the loop on one song first.

Acceptance: exact original bytes read back; source/take/language associations
reviewed; missing metadata honestly null; two takes playable and comparable;
timestamp notes survive reload; re-import does not duplicate files or erase notes;
selected packet round-trips to the producer without exposing unrelated records.
Test canceled import and restart. Report technical checks separately from listening,
language and rights review. Measure producer time to a selected usable take and
cost per accepted take, not only download or generation volume.

Implementation order: reconcile existing producer contracts; prove manual file
handoff; build Kura album/take views; add scoped companion integration; consider
permitted bounded automation only after that loop works. This specification claims
none of those runtime milestones are complete.
