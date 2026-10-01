# Music integration adapter

This is a source/configuration handoff; it does not install an account, start a service or activate a workflow.

## Current craft and production integration

Checked 2026-10-01. Use the public [music fundamentals](https://github.com/frankxai/agentic-music-producer-os/blob/18dc9bee02001befb3a2a3bd7747b78f798dff13/docs/MUSIC-FUNDAMENTALS.md), [provider register](https://github.com/frankxai/agentic-music-producer-os/blob/18dc9bee02001befb3a2a3bd7747b78f798dff13/docs/PROVIDER-CAPABILITIES.md) and [factory contract](https://github.com/frankxai/agentic-music-producer-os/blob/18dc9bee02001befb3a2a3bd7747b78f798dff13/docs/MUSIC-FACTORY-CONTRACT.md). They cover harmony/voice leading, groove, motif, prosody, hooks, form, vocals, arrangement, low end, mixing, measured delivery, provenance and durable jobs. Load only the modules needed for this task.

Keep local artist/persona canon, identity, preferences and account entitlements scoped to this project. Shared craft does not assign a singer or overwrite canon. Select the current account-visible Suno model (documented baseline v6); no official public Suno generation API was verified. Lyria, Eleven Music and fal MiniMax Music 3 have separate documented API routes and constraints. A skill or MCP tool is not a connected generation account.

Preserve approved lyrics across adapters. Prepare, authorize/reserve, submit, reconcile, archive, listen, measure, attest rights and stage release separately. Bind receipts to exact contract/asset hashes. Never infer audio quality, measured BPM, playback, rights or publication from a text review or completed job. Unknown paid submissions remain held for reconciliation; no blind rerender.

The music MCP workbench revision `2ad81c4414e19a1f3e7b6546db1796d68f2c8865` provides `prepare_music_session` only: https://github.com/frankxai/suno-mcp-server/tree/2ad81c4414e19a1f3e7b6546db1796d68f2c8865. Its owner is a planning label, not authorization. Read the actual tool list before executing; configure an authenticated executor and external owner archive separately. A stdio MCP registration is local-host tooling, not a mobile ChatGPT connector.
