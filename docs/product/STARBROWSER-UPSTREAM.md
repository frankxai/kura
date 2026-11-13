# BrowserOS upstream compatibility report

Observed 13 November 2026. HEAD inspected:
`browseros-ai/BrowserOS@26d99d3586caa95bf2126bc6cbf34396401b676f`.
These are source observations, not an installed-browser compatibility verdict.

## Maintained integration surface

The current monorepo separates `packages/browseros` (Chromium patches, Python
build/signing resources) from `packages/browseros-agent` (TypeScript/Rust).
Neo's `apps/claw-server` provides the local MCP and JSON API; `apps/claw-app`
is a WXT/React dashboard extension; onboarding is separate. Neo is documented as
a secondary agent browser with local persistent profiles and session replay.

The next Starlight adapter should discover the endpoint shown by the installed
Neo MCP settings. Never assume an old `:9010` port. Pin the actual browser,
protocol and tool catalog; qualify observe, navigation, stop, reconnect, replay,
unknown-effect handling and profile isolation before activation. Existing
BrowserOS setup lives in the `claude-code-config` fleet work; reuse it.

## License and contribution checks

- Root LICENSE was read: GNU AGPL v3, blob
  `0ad25db4bd1d86c452db3f9602ccdbe172438f52`.
- CONTRIBUTING was read, blob `fdafe0e1f7d092e6b7209f3847870bc1675b02e9`.
  It directs Neo contributors to Bun and TypeScript/Rust; Chromium builds require
  roughly 100 GB source disk, platform toolchain, 16 GB+ RAM, Python/uv and hours.
- CLA was read, blob `4c756ae4ff11148b32c15dc82bbc1fb74ffa54a4`. Upstream
  requires the contributor's agreement; no CLA was signed and no upstream PR sent.
- Security policy was read, blob `57f06db07303100ad641e8f1f2b5d2ce48739c0c`.
  Vulnerabilities go through private GitHub security advisories.
- No BrowserOS code, browser binaries or upstream assets are vendored into Kura.
  This prototype remains under Kura's existing MIT license.

A future modified BrowserOS distribution must retain applicable notices,
provide its corresponding source and installation/build material, and satisfy
the applicable AGPL network-source requirements for modified network use.
It needs a rights review of the actual combined work; an API boundary alone is
not a blanket license exemption. Verify Chromium and third-party notices,
trademarks, codecs, installer and updater terms for the actual binary. Those
binary redistribution checks are not completed by this extension-only decision.

## Update and security ownership

For A/B, upstream distributes and patches the browser; Starlight owns extension
permission audits, dependency updates and adapter conformance. Keep a supported
version matrix and refuse unqualified tool/catalog versions. Use one feature
branch per adapter change, with existing build and review gates.

Before C can be admitted, name an owner for upstream tracking, Chromium security
advisories, patched release delivery, installer signing/notarization, update feed
integrity, rollback, telemetry disclosure and platform-specific smoke tests.
Proposed targets: triage critical upstream patches within one business day,
qualify an update within 48 hours where feasible; these are unstaffed targets,
not an operating SLA. A fork with no maintained patch owner must not ship.

No auto-updater, signing identity, telemetry setting, account profile or browser
credential was changed. Sentry/analytics and profile isolation remain explicit
inspection gates for the installed BrowserOS build. Upstream claims about local
execution do not establish zero telemetry or safe default cloud routing.

## Compatibility verdict

| Surface | Evidence | Verdict |
|---|---|---|
| Kura TypeScript/WXT extension | Built from existing repository with no added dependencies or hosts | Source candidate |
| Chromium integration tests | See exact release receipt | Never infer pass from source |
| BrowserOS MV3 load / side panel | Not installed in this session | Unverified |
| Neo MCP adapter | Public architecture inspected; endpoint not paired | Not implemented |
| Multi-OS install/update/signing | No binary built | Not applicable to first extension slice |
| Proprietary Comet source/assets | None consumed | Public patterns only |

References: [pinned source](https://github.com/browseros-ai/BrowserOS/tree/26d99d3586caa95bf2126bc6cbf34396401b676f),
[contributing](https://github.com/browseros-ai/BrowserOS/blob/26d99d3586caa95bf2126bc6cbf34396401b676f/CONTRIBUTING.md),
[CLA](https://github.com/browseros-ai/BrowserOS/blob/26d99d3586caa95bf2126bc6cbf34396401b676f/CLA.md),
[security](https://github.com/browseros-ai/BrowserOS/blob/26d99d3586caa95bf2126bc6cbf34396401b676f/.github/SECURITY.md).
