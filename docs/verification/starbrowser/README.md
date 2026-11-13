# StarBrowser browser evidence

Synthetic company fixture, not a customer, market finding or live company claim.
Produced by the unpacked extension in real Chromium on
`7d988414e6f8251c569b055aefcddfa914206e88`.
[CI: all gates pass, 73 browser tests](https://github.com/frankxai/kura/actions/runs/43361948369).

| Capture | Scope |
|---|---|
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

Hashes, dimensions, viewport, source and remaining limits are in
[the prototype receipt](../starbrowser-2026-11-13.json). The receipt records the
tested implementation revision; a later receipt commit cannot attest itself.
Current-head checks remain independently visible on the PR.

Download the unpacked build through the CI run's `dist` artifact, or rebuild
from source using the [prototype guide](../../product/STARBROWSER.md). CI
artifact retention is seven days; this committed evidence remains in source.
