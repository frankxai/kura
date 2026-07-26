# Kura Privacy Policy

**Last updated:** July 26, 2026  
**Applies to:** Kura Chrome extension, version 0.2.0 and later

Kura is a local-first browser extension for exporting AI conversations, prompts, and selected media into files you control. This policy explains what Kura processes, where it goes, and which optional actions can send data to a third party.

## Summary

- Kura does **not** require a Kura account.
- Standard conversation export saves files locally through Chrome's Downloads API or a user-selected local folder.
- Kura does not include advertising SDKs or dedicated analytics/telemetry SDKs.
- Kura does not sell exported conversation content.
- Kura does not transmit conversation content to a Kura service during the standard local export flow.
- The **Send to Arcanea** action is optional and user-triggered. When selected, it sends the capture selected by the user to Arcanea. Do not use it for content you do not want to share with Arcanea.

## Information Kura processes

Depending on the feature you choose, Kura processes:

| Feature | Data processed | Where it is processed/stored |
| --- | --- | --- |
| AI conversation capture | Rendered conversation text, message metadata, prompts, and adjacent media URLs/content available in the supported page | In the browser, then in files downloaded to your device |
| Local library/index | Metadata for Kura captures, prompts, and media | Chrome extension local storage on your device |
| Suno harvester | A public Suno profile handle, public track metadata, and—only for tracks you flag—audio/video/cover URLs | Suno services and a local folder you explicitly select |
| Bridge availability check | A short request to Arcanea's Kura health endpoint, used only to decide whether to show the optional Send to Arcanea control | Arcanea receives ordinary network request metadata such as IP address and user-agent under its server logging practices; no conversation body is included in this check |
| Send to Arcanea (optional) | The platform, selected capture/detection data, and related metadata needed for the requested import | Sent to Arcanea only after you explicitly invoke this action |

## Local export

When you export a conversation with Kura, it writes an Obsidian-compatible Markdown folder under the location Chrome permits for downloads—normally a `Kura/` folder under your configured Downloads directory. The files remain under your control. Kura does not automatically upload those exports to a Kura-operated cloud service.

## Optional Arcanea connection

Kura contains an optional integration labelled **Send to Arcanea**. It is not required for local export.

- Kura checks whether the Arcanea bridge is reachable so it can hide an unavailable optional control.
- If you choose **Send to Arcanea**, Kura sends the selected capture to the Arcanea import endpoint over HTTPS.
- Do not use this action for data you are not willing to provide to Arcanea.
- The Arcanea integration may be unavailable; local export remains available without it.

## Suno feature

The optional Suno harvester contacts Suno public/API and media URLs only when you use the Suno interface. It can index a handle you enter and fetch only media you flag. Kura applies a modest request cadence, but your use of Suno remains subject to Suno's terms and privacy practices.

## Browser permissions

Kura requests these Chrome permissions for its stated functions:

| Permission | Purpose |
| --- | --- |
| `activeTab` / supported-site host permissions | Detect and capture the currently active supported AI conversation or Suno page only when you interact with Kura |
| `downloads` | Save exports and selected media to your device |
| `storage` | Keep local Kura settings and local library metadata |
| `scripting` | Run the capture logic on supported pages |
| `sidePanel` | Provide the local Kura library and Suno interface |

Supported host permissions cover ChatGPT, Claude, Gemini/AI Studio, Grok, DeepSeek, Perplexity, Suno, their relevant media/API domains, and Arcanea for the optional integration. Kura does not use those permissions to sell browsing data or inject advertising.

## Data retention and deletion

- **Local Kura data:** you can delete Kura downloads from your filesystem and clear extension data through Chrome's extension settings.
- **Optional Arcanea imports:** data sent through Send to Arcanea is governed by the applicable Arcanea service terms and retention practices. Avoid sending sensitive data unless you have reviewed those practices.
- **Suno data:** data accessed from Suno is subject to Suno's own retention and privacy practices.

## Security

Kura uses HTTPS for its optional Arcanea and Suno network requests. No system can guarantee absolute security; protect your device, Chrome profile, and local export folders appropriately.

## Changes to this policy

If Kura changes how it processes or transmits data, this policy will be updated before or with the relevant release. Material changes will also be reflected in the Chrome Web Store privacy disclosures.

## Contact

For privacy questions or requests, open a private report or issue through the [Kura repository](https://github.com/frankxai/kura).
