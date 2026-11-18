// ============================================================
// Kura — Thread identity from the URL
// A capture needs the provider's own thread ID, so a reload or an
// in-page navigation keeps one conversation in one folder. The
// receiving importer (second-brain-os `handlers/kura.py`) links a
// capture to an official export only when the whole path is exactly
// the thread path. The `/u/<n>/` prefix and a trailing slash accepted
// here still give a stable identity; the importer does not join them.
// ============================================================

import type { Platform } from './types';

const THREADS: Partial<Record<Platform, { hosts: string[]; path: RegExp }>> = {
  // `/u/<n>/` is Google's account-switch prefix.
  gemini: { hosts: ['gemini.google.com'], path: /^(?:\/u\/\d+)?\/app\/([^/]+)\/?$/ },
  perplexity: { hosts: ['www.perplexity.ai', 'perplexity.ai'], path: /^\/search\/([^/]+)\/?$/ },
  deepseek: { hosts: ['chat.deepseek.com'], path: /^\/a\/chat\/s\/([^/]+)\/?$/ },
};

// URL-unreserved characters only: no percent-escapes to decode two ways.
const SAFE_ID = /^[A-Za-z0-9._~-]{1,200}$/;
// Path segments that sit where a thread ID would, on a page that has no thread yet.
const NOT_A_THREAD = new Set(['new']);

/** The provider thread ID in `url`, or null when the URL does not name one yet. */
export function threadIdFromUrl(platform: Platform, url: string): string | null {
  const rule = THREADS[platform];
  if (!rule) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !rule.hosts.includes(parsed.hostname)) return null;
  const id = parsed.pathname.match(rule.path)?.[1];
  return id && SAFE_ID.test(id) && !NOT_A_THREAD.has(id) ? id : null;
}
