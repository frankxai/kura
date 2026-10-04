# Kura production web pilot

The hosted gallery runs the same importer as the extension. Hosting serves only
application code. Originals, thumbnails, metadata and checkpoints stay in the
folder you select on your desktop. There is no account crawler or cloud sync.

## Use

1. Open the production URL in desktop Chrome or Edge.
2. Download a small sample from Midjourney or Grok using the provider's native
   download controls. Extract ZIP files first. Keep original files unchanged.
3. Choose **Import images**, select the provider, then select the export folder
   or individual files. Review up to 10 images and the required disk space.
4. Choose a separate archive folder, confirm available space, then import.
5. Inspect the saved counts, open an original from its detail view, repeat the
   selection to confirm duplicate skipping, and reopen the archive after reload.

Prompts and other metadata are shown only when supplied in supported sidecars;
plain image downloads can legitimately have unknown metadata. Pilot verification
must include actual provider samples before increasing the limit. Read
`verification/image-library-pilot.md` for the outstanding acceptance checks.

## Chat versus local execution

ChatGPT's connected GitHub and Vercel tools can maintain code, run CI and deploy
the web app. They cannot access your desktop filesystem or control your private
import session. Opening the hosted app does not grant ChatGPT access to it.

Codex is not required to use the gallery. A local Codex/browser session is useful
for machine-side setup and supervised automation. Kura does not yet expose an
authenticated job API or MCP bridge for remote import control. Such a bridge
would require a separate implementation and explicit access to the local runner.

## Deployment

Run `npm run build:web`. `web-dist/` contains only the gallery and its shared
assets. Root `vercel.json` supports source builds; when deploying prebuilt files,
include its headers but omit `buildCommand` and `outputDirectory`. Never include
an archive folder, exports, extension storage or credentials in a deployment.

The web CI job runs the same two gallery browser tests over HTTP with production
security headers and is blocking. The CSP blocks application network connections
(`connect-src 'none'`); blob images are allowed for local previews. These tests use
synthetic images and do not establish real provider-account acceptance.

The hosted pilot and the Chrome extension are separate release surfaces. Hosting
the web app does not publish a Chrome Web Store extension or complete issue #5.
