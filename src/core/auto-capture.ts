import type { DetectionResult } from './types';

/** Capture metadata and scraper-generated IDs are deliberately excluded. */
export function captureFingerprint(detection: DetectionResult): string {
  return JSON.stringify(detection.conversations.map((conversation) => ({
    id: conversation.id,
    url: conversation.url,
    title: conversation.title,
    messages: conversation.messages.map((message) => ({
      role: message.role,
      content: message.content,
      attachments: message.attachments?.map(({ type, url }) => ({ type, url })),
    })),
  })));
}

/** One in-flight write; acknowledge only a completed durable save. */
export function createCaptureGate(save: (detection: DetectionResult) => Promise<boolean>) {
  let saved = '';
  let busy = false;
  return async (detection: DetectionResult): Promise<boolean> => {
    if (busy) return false;
    if (!detection.conversations.some((conversation) => conversation.messages.length)) return true;
    const fingerprint = captureFingerprint(detection);
    if (fingerprint === saved) return true;
    busy = true;
    try {
      const accepted = await save(detection);
      if (accepted) saved = fingerprint;
      return accepted;
    } finally {
      busy = false;
    }
  };
}

/** Watches an open page only. No account-history enumeration or keepalive. */
export function installAutoCapture(
  detect: () => Promise<DetectionResult>,
  streamingSelector: string,
  stablePath: RegExp,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let failures = 0;
  const capture = createCaptureGate(async (detection) => {
    const response = await chrome.runtime.sendMessage({ type: 'STARLIGHT_AUTO_SAVE', detection });
    return response?.ok === true;
  });
  const schedule = (delay = 2500) => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void run(); }, delay);
  };
  const run = async () => {
    if (stopped || !stablePath.test(location.pathname) || document.querySelector(streamingSelector)) return;
    const url = location.href;
    try {
      const detection = await detect();
      // A SPA navigation during extraction must not save the previous page's body.
      if (stopped || location.href !== url || document.querySelector(streamingSelector)) return;
      if (await capture(detection)) { failures = 0; return; }
    } catch { /* retry a failed message/write; never log transcript contents */ }
    failures += 1;
    if (failures <= 3) schedule(1000 * 2 ** failures);
  };
  const changed = () => { failures = 0; schedule(); };
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['data-is-streaming', 'aria-label', 'class'],
  });
  window.addEventListener('popstate', changed);
  window.addEventListener('pageshow', changed);
  document.addEventListener('visibilitychange', changed);
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    observer.disconnect();
    window.removeEventListener('popstate', changed);
    window.removeEventListener('pageshow', changed);
    document.removeEventListener('visibilitychange', changed);
  };
}
