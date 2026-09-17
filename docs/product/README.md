# Kura extension product contract

Status: proposed requirements, 2026-09-17. These documents define the next build;
they do not certify existing adapters or announce a store release.

**Product:** a browser extension that preserves the user's AI work in a portable,
searchable local archive. Capture starts beside the provider. The library opens
inside the extension. Provider-authorized methods determine what can be captured.

Read in order:

1. [PRD](PRD.md): product promise, content requirements, scope and release outcomes.
2. [UI/UX specification](UI-UX.md): screens, behavior, state copy and usability gates.
3. [Engineering and delivery](ENGINEERING.md): adapters, persistence, branch integration,
   failure testing and implementation sequence.
4. [Open source and provider policy](OPEN-SOURCE-AND-PROVIDERS.md): reuse decisions,
   source evidence and provider-by-provider release constraints.
5. [Intelligence and updates](INTELLIGENCE-AND-UPDATES.md): screenshot diagnosis,
   optional AI/vision costs, installed-build identification and update channels.

This contract extends the capture purpose in the repository; it does not change
`FORMAT_SPEC.md` v0.2.0, existing vault paths, the MIT license or account permissions.
It takes precedence over aspirational roadmap wording for the next product build
once approved. Implementation branches remain separate and require integration review.

The hosted image pilot is an auxiliary preview/local-import surface. It is not the
primary product, an account downloader, a synchronization service or a Chrome Web
Store release. The next product milestone is an installable extension with a verified
capture-to-library journey, not another website deployment.

The UI and engineering targets below are release criteria, not measurements achieved
by the current implementation. No upstream code has been copied by this specification.
