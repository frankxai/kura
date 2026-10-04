# Connect Kura to your second brain

Version 0.3.1 adds optional local intake. Capture still writes the original files
first. After you connect the local host, Kura sends only the saved capture's
relative path and packet hash to that host. The importer creates pending summary
notes without calling a model. Reviewing and distilling those notes is separate.

## Setup

Prepare and register the
[SBO local host](https://github.com/frankxai/second-brain-os/blob/main/docs/native-intake.md)
for your exact Chrome extension ID, existing Python environment and selected
capture, brain and private roots. Select that same capture folder through
**Connect vault**. Then use **Connect second brain** to grant the optional native
permission and verify the host. New captures are queued after this connection.
Recapture an older thread or use the existing local importer for historical files.

Only the configured extension origin can connect to the host. Web pages cannot
select roots, submit transcript bodies, run commands or enable paid summarization.
The host checks the actual capture packet and its Markdown before import. A
folder mismatch or source race stops that input rather than processing a guess.

## Recovery and resource limits

An intake failure leaves the original capture and pending queue intact. Restore
the host or repeat a changed capture, then use **Retry intake**. Pausing intake
preserves its queue. A worker restart also preserves pending work, and the
importer's existing receipts make repeated processing safe.

The queue holds at most 256 distinct capture paths and retains the latest packet
for each path. A full queue is reported; use the local importer for a larger
backfill. A processing pass handles at most three queued captures, with a
120-second bound per native request. Another capture or **Retry intake** resumes
remaining work. No new scheduler, network server or always-on MCP is installed.

Native setup and real-provider tests must be verified separately from CI's
transport tests. Chrome folder permission and a host registration cannot be
established by mocked browser checks. An installed older extension stays usable
without granting the optional native permission.

## Production test plan

Use a real workflow conversation in a connected logged-in browser. Save it,
confirm a private source and pending brain note, repeat the save and intake, then
distill one useful cited note with bounded packets. Read the note back from the
selected brain and compare its decisions with the source. Test host disconnect
and retry, source changes, a shorter visible thread and native folder permission.
Compare model calls, source bytes, duplicate count and recovery with manual
export/import. Keep provider account history outside the scope of open-page capture.

References: [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging),
[optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions).
