/** Validate a cited archive reply. The host, not this panel, reads the vault. */

export interface ArchiveHit {
  citation: string;
  title: string;
  status: string;
  platform: string;
  date: string;
  review: 'excerpt' | 'metadata-only';
  excerpt: string | null;
  sourceUrl: string | null;
}
export interface ArchivePage {
  available: boolean;
  reason?: string;
  total: number;
  cursor: string | null;
  notes?: number;
  items: ArchiveHit[];
}

const citation = /^(?!_)(?!.*\/private\/)[a-zA-Z0-9][a-zA-Z0-9._/-]{0,220}\.md$/;
const hosts = new Set(['chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'grok.com', 'x.com', 'chat.deepseek.com', 'perplexity.ai', 'www.perplexity.ai']);

function sourceUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('Invalid source link');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.port || !hosts.has(url.hostname)) throw new Error('Invalid source link');
  return url.toString();
}

export function readArchiveReply(reply: unknown): ArchivePage {
  const value = reply as { ok?: boolean; code?: string; total?: number; cursor?: unknown; items?: unknown; searched?: { notes?: number } };
  if (!value || value.ok === false) {
    const reason = value?.code === 'index_changed'
      ? 'The archive changed. Refresh to search the current notes.'
      : 'Second brain search is not connected. Connect local intake, then refresh. Captures on this device are unchanged.';
    return { available: false, reason, total: 0, cursor: null, items: [] };
  }
  if (!Array.isArray(value.items) || !Number.isSafeInteger(value.total) || value.total < 0) throw new Error('Invalid archive reply');
  const items = value.items.slice(0, 3).map(item => {
    const hit = item as ArchiveHit;
    if (!citation.test(hit.citation) || typeof hit.title !== 'string' || hit.title.length > 180) throw new Error('Invalid citation');
    if (hit.review !== 'excerpt' && hit.review !== 'metadata-only') throw new Error('Invalid review status');
    if (hit.review === 'metadata-only' && hit.excerpt !== null) throw new Error('Pending note included an excerpt');
    if (hit.excerpt !== null && (typeof hit.excerpt !== 'string' || hit.excerpt.length > 160)) throw new Error('Invalid excerpt');
    return { citation: hit.citation, title: hit.title, status: String(hit.status).slice(0, 40),
      platform: String(hit.platform).slice(0, 40), date: String(hit.date).slice(0, 10), review: hit.review,
      excerpt: hit.excerpt, sourceUrl: sourceUrl(hit.sourceUrl) };
  });
  return { available: true, total: value.total, cursor: typeof value.cursor === 'string' ? value.cursor : null,
    notes: value.searched?.notes, items };
}
