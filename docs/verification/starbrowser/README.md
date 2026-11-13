# StarBrowser browser evidence

Synthetic company fixtures, not customers, market findings or live company claims.
The research comparison captures were produced by real Chromium on
`504c6ebbfe50e1385d85938f0065add36b2ae93a`.
[Multi-source CI: all gates pass, 75 browser tests](https://github.com/frankxai/kura/actions/runs/43454073893).
The original five single-company captures remain unchanged, produced on
`7d988414e6f8251c569b055aefcddfa914206e88`.
[Original CI: all gates pass, 73 browser tests](https://github.com/frankxai/kura/actions/runs/43361948369).

| Capture | Scope |
|---|---|
| [Research board at 1024px](research-board-1024.png) | Two invited company snapshots, source comparison, saved dossier and portable brief controls |
| [Research sidebar at 320px](research-sidebar-320.png) | Comparison scroll stays within its keyboard-focusable region; controls and page reflow |
| [420px sidebar](sidebar-420.png) | Saved dossier, source-linked excerpts, approved navigation and collection |
| [320px sidebar](sidebar-320.png) | Narrow-panel reflow; no horizontal overflow |
| [1024px workspace](workspace-1024.png) | Same working surface at desktop width |
| [Approval dialog](approval.png) | Exact initial target, scope, budget, expiry and redirect limitation |
| [Activity](timeline.png) | Capture/save/approval/navigation outcomes; explicitly local evidence |

The hostile instruction excerpt is an adversarial fixture. It remains literal
page evidence; it did not gain authority or execute a capability. The test
checks omitted forms/hidden fields and absence of panel network traffic.

The flagship test opens the company page, invokes a real installed extension
shortcut, reads the source, saves, approves and verifies the browser's final URL,
then reloads the panel and checks durable state. Additional tests cover stale
same-URL documents, cancellation, plaintext export/deletion, Investor lens,
exact selected text and keyboard palette. Native key input is used in CI so
Chrome, rather than a mocked permission flag, grants activeTab.

The multi-source journey independently invites and saves both tabs, leaves an
uninvited private tab untouched, compiles a comparison, exports real JSON and
Markdown downloads, verifies packet/text hashes, changes to the Investor lens,
selects the research-to-PRD recipe and checks persistence after reload. A separate
case rejects a tampered saved snapshot without replacing the current dossier.

Hashes, dimensions, viewport, source and remaining limits are in
[the multi-source receipt](../starbrowser-research-2026-11-13.json) and
[original prototype receipt](../starbrowser-2026-11-13.json). Each receipt records the
tested implementation revision; a later receipt commit cannot attest itself.
Current-head checks remain independently visible on the PR.

Download the unpacked build through the CI run's `dist` artifact, or rebuild
from source using the [prototype guide](../../product/STARBROWSER.md). CI
artifact retention is seven days; this committed evidence remains in source.
