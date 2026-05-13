// ============================================================
// Arcanea Threads — Frontmatter generation
// YAML frontmatter conforming to FORMAT_SPEC.md v0.2.0
// ============================================================

import type { Conversation, MediaItem, PromptItem, Platform } from './types';

export const SCHEMA_VERSION = '0.2.0';
export const CAPTURED_BY = 'arcanea-threads/0.2.0';
export const VAULT_ROOT = 'ArcaneaThreads';

const ASSISTANT_LABEL: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
};

/** Display label for the assistant role in a given platform. */
export function assistantLabel(platform: Platform): string {
  return ASSISTANT_LABEL[platform] ?? 'Assistant';
}

/** Per FORMAT_SPEC §2.1 — date prefix + kebab title, max 60 chars. */
export function buildSlug(title: string, capturedAt: string): string {
  const date = capturedAt.slice(0, 10); // YYYY-MM-DD
  const kebab = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${date}_${kebab || 'untitled'}`;
}

/** Serialize a single frontmatter value as YAML. */
function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '\n' + value.map((v) => `  - ${quoteIfNeeded(String(v))}`).join('\n');
  }
  return quoteIfNeeded(String(value));
}

/** Quote a YAML string if it contains special chars or starts with a reserved token. */
function quoteIfNeeded(s: string): string {
  if (s === '') return '""';
  if (/^[a-zA-Z0-9_\-./:+]+$/.test(s) && !/^(true|false|null|yes|no|on|off)$/i.test(s)) {
    return s;
  }
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Render an ordered key/value object as a YAML frontmatter block. */
export function renderFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const serialized = serializeValue(value);
    if (serialized.startsWith('\n')) {
      lines.push(`${key}:${serialized}`);
    } else {
      lines.push(`${key}: ${serialized}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** Approximate conversation duration as a compact label (e.g. "47m"). */
function approxDuration(conv: Conversation): string | undefined {
  const stamped = conv.messages
    .map((m) => m.timestamp)
    .filter((t): t is string => !!t)
    .map((t) => Date.parse(t))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (stamped.length < 2) return undefined;
  const ms = stamped[stamped.length - 1] - stamped[0];
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h${rem}m`;
}

/** True if any message has at least one image/video attachment. */
function hasMedia(conv: Conversation): boolean {
  return conv.messages.some((m) =>
    m.attachments?.some((a) => a.type === 'image' || a.type === 'video'),
  );
}

/** True if any message has a code attachment. */
function hasCode(conv: Conversation): boolean {
  return conv.messages.some((m) => m.attachments?.some((a) => a.type === 'code'));
}

/** Build the frontmatter for a conversation.md note. */
export function conversationFrontmatter(
  conv: Conversation,
  slug: string,
): Record<string, unknown> {
  return {
    id: conv.id,
    slug,
    title: conv.title,
    platform: conv.platform,
    source: conv.url,
    capturedAt: conv.capturedAt,
    capturedBy: CAPTURED_BY,
    schemaVersion: SCHEMA_VERSION,
    messageCount: conv.messages.length,
    hasMedia: hasMedia(conv),
    hasCode: hasCode(conv),
    durationApprox: approxDuration(conv),
    characters: [],
    locations: [],
    artifacts: [],
    lore: [],
    themes: [],
    status: 'raw',
    worldbuilding: false,
    tags: conv.tags ?? [],
  };
}

/** Build the frontmatter for a prompts.md companion note. */
export function promptsFrontmatter(
  conv: Conversation,
  slug: string,
  promptCount: number,
): Record<string, unknown> {
  return {
    slug,
    platform: conv.platform,
    capturedAt: conv.capturedAt,
    promptCount,
    linksTo: '[[conversation]]',
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Build the frontmatter for a per-platform index note. */
export function platformIndexFrontmatter(
  platform: Platform,
  conversationCount: number,
  updatedAt: string,
): Record<string, unknown> {
  return {
    kind: 'index',
    platform,
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    conversationCount,
  };
}

/** Frontmatter for a media item's prompt sidecar (e.g. img-01-prompt.md). */
export function mediaPromptFrontmatter(
  media: MediaItem,
  parentSlug: string,
): Record<string, unknown> {
  return {
    kind: 'media-prompt',
    parent: `[[${parentSlug}/conversation]]`,
    platform: media.platform,
    mediaType: media.type,
    filename: media.filename,
    width: media.width,
    height: media.height,
    duration: media.duration,
    sourceUrl: media.url,
    hdUrl: media.hdUrl,
    capturedAt: media.capturedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Frontmatter for an extracted prompts collection (cross-conversation). */
export function promptCollectionFrontmatter(
  platform: Platform | 'all',
  promptCount: number,
): Record<string, unknown> {
  return {
    kind: 'prompt-collection',
    platform,
    promptCount,
    capturedAt: new Date().toISOString(),
    capturedBy: CAPTURED_BY,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Sanitize an arbitrary string for use as a filename segment. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

/** Reference the suggested asset filename for an attachment of index n (1-based). */
export function assetName(kind: 'img' | 'snippet' | 'video', index: number, ext: string): string {
  const padded = String(index).padStart(2, '0');
  return `${kind}-${padded}.${ext.replace(/^\./, '')}`;
}

export { sanitizeFilename as sanitize };
