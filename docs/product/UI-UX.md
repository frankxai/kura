# Kura — UI/UX requirements

Status: proposed interaction specification, 2026-09-17. Implements requirements
F01–F12 in [PRD](PRD.md). This is not evidence of implemented UI or user testing.

## 1. Information architecture

The toolbar action opens the side panel. Avoid a popup that starts a long task and
disappears on blur. The panel has **Capture**, **Transfers**, **Library**. Provider
selection is context, not a separate competing navigation system per provider.
Library opens the extension's full tab when more space is needed.

| Screen | Primary question | Primary action | Secondary information |
| --- | --- | --- | --- |
| First use | Where will my work live? | Choose Kura folder | Local-data explanation, provider permission requested later |
| Capture | What can Kura preserve here? | Save selection / Open provider export | Current provider, account/workspace label, content counts, route and scope |
| Preview | Is this the right work and quality? | Save N selected items | Original/preview distinction, metadata availability, estimated bytes |
| Transfers | What is happening; what needs me? | Pause / Resume / Retry failed | Item counts, transfer bytes, destination, provider wait or permission state |
| Library | Where is my saved work? | Search | Type/provider/date/collection filters, list/grid, sort |
| Detail | What is this, where did it come from? | Open original / Read conversation | Prompt, source, provenance, versions, integrity, related creations |
| Settings | What does Kura access and retain? | Change relevant preference | Destination, permissions, limits, appearance, local diagnostics, compatibility |

No marketing hero between install and first capture. Put the user's content ahead
of branding. Reuse the image pilot's gallery/detail/import foundation, removing
the standalone-site assumptions from the primary flow.

## 2. Capture flow and handoff

On panel open, determine provider without capturing content on unrelated tabs.
Unknown provider shows "This app has no verified capture integration yet" and
**Import downloaded files**. Do not offer a generic "capture everything" escape hatch.

For a permitted direct route, show a compact preview, selected scope and destination.
After first setup, one explicit primary action starts the bounded transfer. Advanced
format and naming options stay collapsed; remember choices per provider/content kind.

For native exports, use an inline handoff card: **Open [provider] export** →
**Choose downloaded export** → preview. Explain any provider wait. Kura may remember
the handoff locally but does not monitor the inbox or claim it requested an export
unless it actually did through an approved integration. A native ZIP opens as
recognizable chats/tracks/images in preview once ZIP support passes its limits tests.
Until then explicitly request an extracted folder; never show an inert ZIP drop zone.

When metadata is absent: "Prompt not included in this download." Offer an optional
user note. Do not prefill a generated guess. When only a preview is available:
"Preview · 512 × 512. Original unavailable through this route." Do not silently
downgrade quality or label that preview as an original.

Selection is stable by identity, not DOM position. "Select page" and "Select all
discovered" are different actions, with count and pilot cap shown. Filtering does
not unexpectedly add or clear hidden selections. On account/tab change, preserve
the job's identity and require a new preview before acquiring new items.

## 3. Transfer states and copy

| State | Example copy | Action/behavior |
| --- | --- | --- |
| Discovering | Finding items in this selection… | Indeterminate indicator, observed count, stop control; no fake percent |
| Ready | 5 selected · 42 MB originals · additional preview space estimated | Confirm destination and known constraints |
| Saving | 3 saved · 1 saving · 1 pending | Per-item status, byte progress when known, pause/cancel |
| Verifying | Checking saved original… | Not yet counted as saved |
| Pausing | Finishing this file, then pausing | State pause granularity honestly; large transfers can cancel safely |
| Paused | Progress saved. 2 items remain. | Resume; show required source/folder reconnection |
| Source closed | Open Grok to continue this transfer | Preserve queue; no repeated hidden attempts |
| Permission lost | Reconnect your Kura folder to continue | Regrant on explicit click; preserve selection |
| Provider wait | Provider asked us to wait. Retry available in 45 seconds. | Respect retry time; pause all affected jobs |
| Sign-in required | Sign in on [provider], then resume | Open provider; never ask for password/token inside Kura |
| Link expired | Download link expired. Reopen the source to refresh it. | Refresh only through approved route |
| Storage problem | This file could not be saved. Check the drive and available space. | Keep completed items; retry/reconnect |
| Conflict | Original already saved; new metadata needs review | Compare details; preserve both observations and user edits |
| Finished | 4 saved · 1 already saved · 0 failed | Open library; receipt and scope remain accessible |
| Partial result | 4 saved · 1 failed | Review failure and retry; never a green "all complete" banner |
| Unsupported route | Direct capture is unavailable for this provider | Show native export/local import when available |

Cancel stops further acquisition; it does not delete successfully saved files.
Closing the panel must not lose the job. If execution requires an open extension
library tab, say so before starting and checkpoint when it closes. Never promise
continued execution with the browser closed. A success toast is insufficient;
completion is also in Transfers and the item detail.

## 4. Library and detail behavior

Use a virtualized grid for visual work and a structured list for conversations and
music. Preserve original aspect ratio; any cropped thumbnail has an uncropped detail
view. Do not download remote thumbnails when browsing a saved library. Search query,
filters and scroll position survive returning from detail.

Each card/row shows title, content type, provider and one useful property (image
dimensions, audio duration, conversation date). Avoid a wall of technical badges.
Integrity/metadata issues surface only when actionable. Selection affordance is
separate from opening the item, and every hover action has a keyboard equivalent.

Detail adapts to kind: readable conversation with code/citations; image lightbox;
music player with supplied lyrics and cover; video player with supplied captions;
artifact file list and source preview. Never autoplay audio/video. Use native
accessible controls initially. Waveforms are derived previews, generated lazily;
no server transcoding or eager decoding of an entire music library.

Provenance panel: source link, source ID, created-at versus captured-at, available
model/settings, route, fidelity, saved bytes, verified-at and missing metadata.
Keep this collapsed by default while leaving "Open source" immediately available.
Show versions and related items as navigable records, not decorative graph nodes.

Artifact previews are inert by default. Render code as text and sanitized documents
without executing scripts, loading remote resources, or giving embedded content
extension privileges. A runtime-dependent artifact says what was saved and which
hosted services/state were not exported.

Local deletion is a separate, explicit operation; source deletion is outside scope.
First release can offer "Remove from collection" without shipping archive deletion.
An edited or missing disk file prompts reconcile/locate actions, never silent cleanup.

## 5. Visual system

Retain Kura's restrained teal/gold identity. Use neutral surfaces, strong type
hierarchy, generous but efficient spacing, and the actual saved work as the visual
focus. No neon gradients, persistent shimmer, oversized branding or unrelated
generative imagery in capture controls. Do not copy upstream brand assets or trade dress.

Specify tokens for light/dark/system themes, semantic success/warning/error states,
4 px spacing increments, 8/12 px control/surface radii and consistent borders.
Use a locally bundled, licensed UI font or system fallback. Existing preferred
Geist/Instrument Serif/JetBrains Mono assets require license notices when packaged.
Use display serif sparingly in the full library; dense operational controls use
readable sans-serif. No remote font requests.

Panel width targets: 320, 400 and 600 CSS px. Library targets: 1024, 1440 and
1920 px, plus 200% zoom/reflow. Important actions and progress never depend on
horizontal scrolling. At narrow widths convert multi-column controls into rows.

Motion: 120–180 ms state transitions; opacity/transform only when useful; no
motion delaying capture. Reduced-motion removes nonessential animation. Focus
never moves because a job count updates. Announce progress at meaningful intervals
rather than every downloaded byte.

Accessibility target: [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/). Contrast 4.5:1
for normal text, 3:1 for large text and relevant UI boundaries; visible focus,
semantic dialogs, focus restoration, escape dismissal and accessible labels.
Aim for 44 × 44 px primary targets; compact desktop actions at least 32 × 32 px
with adequate separation. These are product targets, not a blanket conformance claim.

## 6. Required design and QA deliverables

Create a component/state inventory before replacing the existing UI. Required
components: provider capability card, selection row/card, fidelity badge, destination
control, persistent job row, failure detail, empty state, detail viewer, metadata
field with provenance, and collection selector.

Capture screenshots of empty, populated, selected, transferring, paused, partial,
permission-denied, expired-link and narrow/zoom states. Verify both themes. Use
synthetic content in public fixtures; private provider examples stay local.

Run five task scenarios with five representative users: first save, native-export
handoff, interruption recovery, find an earlier creation, export/open it without Kura.
Measure confusion about scope, originals, destination and whether data was uploaded.
One unresolved confusion that causes the user to lose or expose work blocks release.

Benchmark tasks against the same content using provider-native exports and relevant
open-source clippers/exporters; record steps, fidelity, recovery and retrieval time.
Do not claim competitive superiority from screenshots or star counts.
