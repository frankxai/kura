// ============================================================
// Arcanea Threads — Export Engine
// Emits Obsidian-compatible markdown per FORMAT_SPEC.md v0.2.0
// ============================================================

import type {
  Conversation,
  MediaItem,
  PromptItem,
  Platform,
  ExportFormat,
  ExportOptions,
} from './types';
import {
  SCHEMA_VERSION,
  CAPTURED_BY,
  VAULT_ROOT,
  assistantLabel,
  buildSlug,
  renderFrontmatter,
  conversationFrontmatter,
  promptsFrontmatter,
  platformIndexFrontmatter,
  mediaPromptFrontmatter,
  promptCollectionFrontmatter,
  sanitizeFilename,
  assetName,
} from './frontmatter';

/** A single file destined for the local vault. */
export interface VaultFile {
  /** Relative path under VAULT_ROOT, e.g. `chatgpt/2026-05-13_slug/conversation.md` */
  path: string;
  /** UTF-8 content. */
  content: string;
  /** MIME for the blob the background SW writes. */
  mimeType: string;
}

/** A complete capture bundle for one conversation: the .md + companions + media manifests. */
export interface ConversationBundle {
  slug: string;
  folder: string; // e.g. `chatgpt/2026-05-13_slug`
  files: VaultFile[];
}

// ============================================================
// Public API
// ============================================================

/**
 * Export a conversation as an Obsidian-compatible bundle.
 *
 * Emits:
 *   - <folder>/conversation.md   (always)
 *   - <folder>/prompts.md        (if the conversation has user messages)
 */
export function exportConversationBundle(
  conv: Conversation,
  options: ExportOptions = defaultOptions(),
): ConversationBundle {
  const slug = buildSlug(conv.title, conv.capturedAt);
  const folder = `${conv.platform}/${slug}`;
  const files: VaultFile[] = [];

  files.push({
    path: `${folder}/conversation.md`,
    content: renderConversation(conv, slug, options),
    mimeType: 'text/markdown',
  });

  const userPrompts = conv.messages.filter((m) => m.role === 'user');
  if (userPrompts.length > 0) {
    files.push({
      path: `${folder}/prompts.md`,
      content: renderPromptsCompanion(conv, slug, userPrompts.map((m) => m.content)),
      mimeType: 'text/markdown',
    });
  }

  return { slug, folder, files };
}

/**
 * Legacy single-file export — kept for the popup's "download just the .md" path
 * and for non-markdown formats (JSON, HTML, TXT).
 */
export function exportConversation(
  conv: Conversation,
  options: ExportOptions,
): { content: string; filename: string; mimeType: string } {
  const slug = buildSlug(conv.title, conv.capturedAt);
  switch (options.format) {
    case 'markdown':
      return {
        content: renderConversation(conv, slug, options),
        filename: `${slug}.md`,
        mimeType: 'text/markdown',
      };
    case 'json':
      return {
        content: JSON.stringify(serializeConversation(conv, slug), null, 2),
        filename: `${slug}.json`,
        mimeType: 'application/json',
      };
    case 'html':
      return {
        content: renderHtml(conv, slug, options),
        filename: `${slug}.html`,
        mimeType: 'text/html',
      };
    case 'txt':
      return {
        content: renderText(conv),
        filename: `${slug}.txt`,
        mimeType: 'text/plain',
      };
    default:
      return {
        content: renderConversation(conv, slug, options),
        filename: `${slug}.md`,
        mimeType: 'text/markdown',
      };
  }
}

/** Export a flat collection of prompts (cross-conversation). */
export function exportPrompts(
  prompts: PromptItem[],
  format: ExportFormat = 'markdown',
  platform: Platform | 'all' = 'all',
): { content: string; filename: string; mimeType: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `prompts_${platform}_${stamp}`;

  if (format === 'markdown') {
    const fm = renderFrontmatter(promptCollectionFrontmatter(platform, prompts.length));
    const body = prompts
      .map((p, i) => `## ${i + 1}\n\n${p.text}\n\n> Captured ${p.capturedAt} · platform: \`${p.platform}\``)
      .join('\n\n---\n\n');
    return {
      content: `${fm}\n\n# Prompt archive\n\n${body}\n`,
      filename: `${base}.md`,
      mimeType: 'text/markdown',
    };
  }

  return {
    content: JSON.stringify(prompts, null, 2),
    filename: `${base}.json`,
    mimeType: 'application/json',
  };
}

/**
 * Build/refresh the per-platform index note.
 * Caller passes the rows (newest-first) for the platform.
 */
export function renderPlatformIndex(
  platform: Platform,
  rows: Array<{
    slug: string;
    title: string;
    capturedAt: string;
    messageCount: number;
    entityCount: number;
  }>,
): VaultFile {
  const updatedAt = new Date().toISOString();
  const fm = renderFrontmatter(platformIndexFrontmatter(platform, rows.length, updatedAt));

  const header = `# ${capitalize(platform)} captures\n`;
  const tableHeader = `| Date | Title | Messages | Entities |\n|------|-------|---------:|---------:|`;
  const tableRows = rows
    .map((r) => {
      const date = r.capturedAt.slice(0, 10);
      const display = r.title.replace(/\|/g, '\\|');
      const link = `[[${r.slug}/conversation\\|${display}]]`;
      return `| ${date} | ${link} | ${r.messageCount} | ${r.entityCount} |`;
    })
    .join('\n');

  const content = [fm, '', header, '', tableHeader, tableRows, ''].join('\n');
  return {
    path: `_index/${platform}.md`,
    content,
    mimeType: 'text/markdown',
  };
}

/** Generate the sidecar prompt note for a generated media asset (Imagine/DALL-E). */
export function renderMediaPromptSidecar(
  media: MediaItem,
  parentSlug: string,
  assetFilename: string,
): VaultFile {
  const fm = renderFrontmatter(mediaPromptFrontmatter(media, parentSlug));
  const sidecarName = assetFilename.replace(/\.[^.]+$/, '') + '-prompt.md';
  const content = [
    fm,
    '',
    `# Prompt for \`${assetFilename}\``,
    '',
    media.prompt || '*(no prompt captured)*',
    '',
    media.sourceImageUrl ? `> Source image: ${media.sourceImageUrl}` : '',
    '',
    `*From [[${parentSlug}/conversation]]*`,
    '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    path: `${media.platform}/${parentSlug}/assets/${sidecarName}`,
    content,
    mimeType: 'text/markdown',
  };
}

// ============================================================
// Renderers
// ============================================================

function renderConversation(conv: Conversation, slug: string, options: ExportOptions): string {
  const fm = renderFrontmatter(conversationFrontmatter(conv, slug));
  const label = assistantLabel(conv.platform);

  const header = [
    `# ${conv.title}`,
    '',
    `> **Platform:** ${conv.platform} · **Source:** [${truncate(conv.url, 60)}](${conv.url}) · **Captured:** ${conv.capturedAt}`,
    '',
  ].join('\n');

  let imgCounter = 0;
  let snippetCounter = 0;

  const body = conv.messages
    .map((msg) => {
      const role = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? label : 'System';
      const tsTag = options.includeTimestamps && msg.timestamp ? ` <sub>· ${msg.timestamp}</sub>` : '';
      const blocks: string[] = [];
      blocks.push(`## ${role}${tsTag}`);
      blocks.push('');
      blocks.push(msg.content.trim());
      blocks.push('');

      if (options.includeMedia && msg.attachments?.length) {
        for (const att of msg.attachments) {
          if (att.type === 'image') {
            imgCounter += 1;
            const ext = guessExtension(att.mimeType, att.url, 'png');
            const name = assetName('img', imgCounter, ext);
            const alt = att.filename ? att.filename : `image ${imgCounter}`;
            blocks.push(`![${alt}](assets/${name})`);
            blocks.push('');
          } else if (att.type === 'video') {
            imgCounter += 1;
            const ext = guessExtension(att.mimeType, att.url, 'mp4');
            const name = assetName('video', imgCounter, ext);
            blocks.push(`![[assets/${name}]]`);
            blocks.push('');
          } else if (att.type === 'code') {
            const lineCount = att.url.split('\n').length;
            if (lineCount >= 30) {
              snippetCounter += 1;
              const ext = guessExtension(att.mimeType, att.filename ?? '', 'txt');
              const name = assetName('snippet', snippetCounter, ext);
              blocks.push(`![[assets/${name}]]`);
              blocks.push('');
            } else {
              blocks.push('```' + (att.mimeType ?? ''));
              blocks.push(att.url);
              blocks.push('```');
              blocks.push('');
            }
          }
        }
      }

      blocks.push('');
      return blocks.join('\n');
    })
    .join('\n');

  const footer = [
    '---',
    '',
    `*Captured by [Arcanea Threads](https://github.com/frankxai/arcanea-vault) · schema v${SCHEMA_VERSION}*`,
    '',
  ].join('\n');

  return `${fm}\n\n${header}${body}${footer}`;
}

function renderPromptsCompanion(conv: Conversation, slug: string, prompts: string[]): string {
  const fm = renderFrontmatter(promptsFrontmatter(conv, slug, prompts.length));
  const header = `# Prompts from "${conv.title}"`;
  const body = prompts.map((p, i) => `## ${i + 1}\n\n${p.trim()}\n`).join('\n');
  return `${fm}\n\n${header}\n\n${body}`;
}

function renderHtml(conv: Conversation, _slug: string, options: ExportOptions): string {
  const label = assistantLabel(conv.platform);
  const messages = conv.messages
    .map((msg) => {
      const cls = msg.role === 'user' ? 'user' : 'assistant';
      const who = msg.role === 'user' ? 'You' : label;
      const ts =
        options.includeTimestamps && msg.timestamp
          ? `<span class="timestamp">${msg.timestamp}</span>`
          : '';
      return `<div class="message ${cls}"><div class="role">${who} ${ts}</div><div class="content">${escapeHtml(msg.content)}</div></div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(conv.title)} — Arcanea Threads</title>
  <style>
    :root {
      --bg: #09090b;
      --fg: #e7e7ea;
      --muted: #71717a;
      --primary: #00bcd4;
      --secondary: #0d47a1;
      --accent: #ffd700;
      --user-tint: rgba(0, 188, 212, 0.08);
      --assistant-tint: rgba(255, 215, 0, 0.05);
      --card: rgba(255, 255, 255, 0.03);
      --border: rgba(255, 255, 255, 0.06);
    }
    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--fg);
      max-width: 760px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
      line-height: 1.65;
    }
    h1 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; color: var(--primary); font-size: 2rem; letter-spacing: -0.01em; margin: 0 0 .5rem; }
    .meta { color: var(--muted); font-size: .85rem; margin-bottom: 2.5rem; }
    .meta a { color: var(--primary); }
    .message { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem 1.5rem; margin: 1rem 0; backdrop-filter: blur(8px); }
    .message.user { background: linear-gradient(180deg, var(--user-tint), var(--card)); }
    .message.assistant { background: linear-gradient(180deg, var(--assistant-tint), var(--card)); }
    .role { font-weight: 600; font-size: .9rem; letter-spacing: .02em; text-transform: uppercase; margin-bottom: .5rem; }
    .user .role { color: var(--primary); }
    .assistant .role { color: var(--accent); }
    .timestamp { font-weight: 400; font-size: .75rem; color: var(--muted); margin-left: .5rem; text-transform: none; letter-spacing: 0; }
    .content { white-space: pre-wrap; }
    code, pre { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: .9em; }
    .footer { margin-top: 3rem; color: var(--muted); font-size: .8rem; text-align: center; }
    .footer a { color: var(--primary); }
  </style>
</head>
<body>
  <h1>${escapeHtml(conv.title)}</h1>
  <div class="meta">
    <div>${escapeHtml(conv.platform)} · captured ${escapeHtml(conv.capturedAt)}</div>
    <div>Source: <a href="${escapeAttr(conv.url)}">${escapeHtml(conv.url)}</a></div>
  </div>
  ${messages}
  <div class="footer">Captured by <a href="https://github.com/frankxai/arcanea-vault">Arcanea Threads</a></div>
</body>
</html>`;
}

function renderText(conv: Conversation): string {
  const label = assistantLabel(conv.platform);
  const lines: string[] = [conv.title, `Platform: ${conv.platform}`, `Source: ${conv.url}`, ''];
  for (const msg of conv.messages) {
    const who = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? label : 'System';
    lines.push(`[${who}]`);
    lines.push(msg.content);
    lines.push('');
  }
  return lines.join('\n');
}

function serializeConversation(conv: Conversation, slug: string) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capturedBy: CAPTURED_BY,
    slug,
    ...conv,
  };
}

// ============================================================
// Path helpers (used by the background SW)
// ============================================================

/** Full vault-relative path for a bundle file. */
export function vaultPath(file: VaultFile): string {
  return `${VAULT_ROOT}/${file.path}`;
}

/** Path for a media asset inside a conversation folder. */
export function assetPath(platform: Platform, slug: string, filename: string): string {
  return `${VAULT_ROOT}/${platform}/${slug}/assets/${filename}`;
}

/** Path for a stand-alone prompt collection. */
export function promptCollectionPath(filename: string): string {
  return `${VAULT_ROOT}/_index/${filename}`;
}

// ============================================================
// Internal utilities
// ============================================================

function defaultOptions(): ExportOptions {
  return {
    format: 'markdown',
    includeMedia: true,
    includeTimestamps: true,
    includeMetadata: true,
    embedMedia: false,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function guessExtension(mime: string | undefined, urlOrName: string, fallback: string): string {
  const fromName = urlOrName.match(/\.([a-z0-9]{2,4})(?:\?|$)/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (!mime) return fallback;
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'text/typescript': 'ts',
    'text/javascript': 'js',
    'text/x-python': 'py',
    'text/markdown': 'md',
    'text/plain': 'txt',
  };
  return map[mime.toLowerCase()] ?? fallback;
}

export { sanitizeFilename };
