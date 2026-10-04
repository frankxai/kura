import type { Conversation, Platform } from './types';

// Local lookup only. This module never reads a provider page or calls a model.
const HOSTS: Record<string, Platform> = {
  'chatgpt.com': 'chatgpt', 'chat.openai.com': 'chatgpt', 'claude.ai': 'claude',
  'gemini.google.com': 'gemini', 'aistudio.google.com': 'gemini', 'grok.com': 'grok',
  'chat.deepseek.com': 'deepseek', 'perplexity.ai': 'perplexity', 'www.perplexity.ai': 'perplexity',
};

export function platformForUrl(value: string): Platform | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      ? HOSTS[url.hostname] ?? null : null;
  } catch { return null; }
}

/** A stable thread URL may merge observations; a new-chat page never does. */
function threadKey(value: string): string | null {
  const platform = platformForUrl(value);
  if (!platform) return null;
  const url = new URL(value);
  if (!url.pathname.replace(/\/$/, '') || /^\/(new|app|chat|settings|login|auth)\/?$/.test(url.pathname)) return null;
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
  url.searchParams.sort();
  if (platform === 'chatgpt') url.hostname = 'chatgpt.com';
  if (platform === 'perplexity') url.hostname = 'www.perplexity.ai';
  return url.href;
}

export interface OpenChat {
  platform: Platform; tabId: number; title: string; url: string; active: boolean;
}
export interface ChatResult {
  key: string; platform: Platform; title: string; url: string;
  capturedAt?: string; messageCount?: number; snippet: string; tags: string[];
  saved: boolean; tabId?: number; tabUrl?: string; openCount: number; active: boolean;
}
export interface ChatQuery {
  query?: string; platform?: Platform | ''; scope?: 'all' | 'open' | 'saved';
  since?: string; offset?: number;
}
export interface ChatPage { items: ChatResult[]; total: number; offset: number; nextOffset: number | null }

function folded(value: string): string { return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase(); }
function excerpt(text: string, terms: string[]): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  // Locate in the original string to keep display offsets correct for Unicode.
  const at = terms.map(t => clean.toLocaleLowerCase().indexOf(t)).find(n => n >= 0) ?? 0;
  const start = Math.max(0, at - 60);
  return (start ? '…' : '') + clean.slice(start, start + 240) + (clean.length > start + 240 ? '…' : '');
}

/** Returns at most 40 excerpts; raw transcripts never cross into the library UI. */
export function searchChats(captures: Conversation[], tabs: OpenChat[], request: ChatQuery): ChatPage {
  if (!request || typeof request !== 'object' || (request.query !== undefined && typeof request.query !== 'string')
    || (request.query?.length ?? 0) > 200
    || (request.scope !== undefined && !['all', 'open', 'saved'].includes(request.scope))
    || (request.platform && !Object.values(HOSTS).includes(request.platform))
    || (request.since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(request.since))
    || (request.offset !== undefined && (!Number.isSafeInteger(request.offset) || request.offset < 0 || request.offset > 100_000))) {
    throw new Error('Check the search filters and try again.');
  }
  const terms = [...new Set(folded(request.query?.trim() ?? '').split(/\s+/).filter(Boolean))];
  const rows = new Map<string, { result: ChatResult; capture?: Conversation; titles: string[] }>();
  for (const capture of captures) {
    if (platformForUrl(capture.url) !== capture.platform) continue;
    const key = threadKey(capture.url) ?? `capture:${capture.platform}:${capture.id}`;
    const previous = rows.get(key);
    if (previous?.result.capturedAt && previous.result.capturedAt > capture.capturedAt) continue;
    rows.set(key, { capture, titles: [capture.title], result: { key, platform: capture.platform, title: capture.title.slice(0, 300) || 'Untitled',
      url: capture.url, capturedAt: capture.capturedAt, messageCount: capture.messages.length,
      tags: (capture.tags ?? []).filter(t => typeof t === 'string').slice(0, 8).map(t => t.slice(0, 60)),
      snippet: '', saved: true, openCount: 0, active: false } });
  }
  for (const tab of tabs) {
    if (platformForUrl(tab.url) !== tab.platform || !Number.isSafeInteger(tab.tabId) || tab.tabId < 0) continue;
    const key = threadKey(tab.url) ?? `tab:${tab.tabId}`;
    const existing = rows.get(key);
    const result = existing?.result ?? { key, platform: tab.platform, title: tab.title.slice(0, 300) || 'Untitled',
      url: tab.url, tags: [], snippet: '', saved: false, openCount: 0, active: false };
    result.openCount++;
    if (result.tabId === undefined || tab.active) { result.tabId = tab.tabId; result.tabUrl = tab.url; }
    result.active ||= tab.active;
    // Both titles are searchable when the provider and capture names differ.
    rows.set(key, { capture: existing?.capture, result, titles: [...(existing?.titles ?? []), tab.title] });
  }
  const ranked: { result: ChatResult; score: number }[] = [];
  for (const { result, capture, titles } of rows.values()) {
    if (request.platform && result.platform !== request.platform) continue;
    if (request.scope === 'open' && !result.openCount) continue;
    if (request.scope === 'saved' && !result.saved) continue;
    // Date means capture date, not a guessed provider creation date.
    if (request.since && (!result.capturedAt || result.capturedAt.slice(0, 10) < request.since)) continue;
    const title = folded(titles.join(' '));
    const tags = folded(result.tags.join(' '));
    const messages = capture?.messages ?? [];
    const matches = messages.map(m => folded(m.content));
    if (!terms.every(t => title.includes(t) || tags.includes(t) || matches.some(m => m.includes(t)))) continue;
    const matchIndex = matches.findIndex(m => terms.some(t => m.includes(t)));
    result.snippet = matchIndex >= 0 ? excerpt(messages[matchIndex].content, terms) : '';
    const score = terms.reduce((n, t) => n + (title.includes(t) ? 4 : tags.includes(t) ? 2 : 1), 0);
    ranked.push({ result, score });
  }
  ranked.sort((a, b) => b.score - a.score || Number(b.result.active) - Number(a.result.active)
    || (b.result.capturedAt ?? '').localeCompare(a.result.capturedAt ?? '') || a.result.key.localeCompare(b.result.key));
  const offset = request.offset ?? 0;
  return { items: ranked.slice(offset, offset + 40).map(r => r.result), total: ranked.length, offset,
    nextOffset: offset + 40 < ranked.length ? offset + 40 : null };
}

/** Revalidate tab identity immediately before focusing; never navigate an existing tab. */
export async function resumeChat(request: { tabId?: number; url: string; tabUrl?: string }): Promise<void> {
  if (!platformForUrl(request.url)) throw new Error('This source is unavailable.');
  if (request.tabId !== undefined) {
    if (!Number.isSafeInteger(request.tabId) || request.tabId < 0 || !request.tabUrl) throw new Error('Refresh the chat list and try again.');
    const tab = await chrome.tabs.get(request.tabId);
    if (tab.incognito || tab.url !== request.tabUrl || !platformForUrl(tab.url)) throw new Error('This tab changed. Refresh the chat list before resuming.');
    await chrome.tabs.update(request.tabId, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
    return;
  }
  const tabs = await chrome.tabs.query({});
  const key = threadKey(request.url);
  const existing = key && tabs.find(t => !t.incognito && t.id !== undefined && t.url && threadKey(t.url) === key);
  if (existing && existing.id !== undefined && existing.url) {
    await resumeChat({ ...request, tabId: existing.id, tabUrl: existing.url });
  } else { await chrome.tabs.create({ url: request.url, active: true }); }
}
