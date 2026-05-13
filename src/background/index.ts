// ============================================================
// Arcanea Threads — Background Service Worker
// Orchestrates downloads into the local Obsidian-compatible vault.
// Local-first: every capture lands in ArcaneaThreads/ on disk.
// ============================================================

import { detectPlatform } from '@/core/detector';
import { vault } from '@/core/storage';
import {
  exportConversationBundle,
  exportConversation,
  exportPrompts,
  renderMediaPromptSidecar,
  assetPath,
} from '@/core/exporter';
import { VAULT_ROOT, assetName, buildSlug } from '@/core/frontmatter';
import type {
  ExportOptions,
  DetectionResult,
  Platform,
  MediaItem,
} from '@/core/types';

// ============================================================
// Download queue (rate-limited, sequential)
// ============================================================

interface DownloadJob {
  /** Pre-existing remote URL (http/https) OR a blob: URL we created locally. */
  url: string;
  /** Vault-relative path. The full chrome path is `ArcaneaThreads/<path>`. */
  vaultPath: string;
  /** When this job was created — used to clean up blob URLs we own. */
  isBlobUrl?: boolean;
}

const downloadQueue: DownloadJob[] = [];
let isDownloading = false;
const RATE_LIMIT_MS = 280;

async function processDownloadQueue(): Promise<void> {
  if (isDownloading || downloadQueue.length === 0) return;
  isDownloading = true;

  while (downloadQueue.length > 0) {
    const job = downloadQueue.shift()!;
    const fullPath = `${VAULT_ROOT}/${job.vaultPath}`;

    try {
      await chrome.downloads.download({
        url: job.url,
        filename: fullPath,
        saveAs: false,
        conflictAction: 'overwrite',
      });
    } catch (err) {
      console.error('[Threads] Download failed:', fullPath, err);
    } finally {
      if (job.isBlobUrl) {
        try { URL.revokeObjectURL(job.url); } catch { /* noop */ }
      }
    }

    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  isDownloading = false;
}

function queueDownload(job: DownloadJob): void {
  downloadQueue.push(job);
  processDownloadQueue();
}

/** Helper: create a blob URL for in-memory content and queue it. */
function queueText(vaultPath: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  queueDownload({ url, vaultPath, isBlobUrl: true });
}

// ============================================================
// Capture orchestration
// ============================================================

/**
 * Persist a detection result to disk per FORMAT_SPEC.md:
 *   - conversation.md + prompts.md inside ArcaneaThreads/<platform>/<slug>/
 *   - assets/<filename> for each media item
 *   - assets/<filename>-prompt.md sidecar for AI-generated media
 * Returns counts for the popup to display.
 */
async function persistDetection(
  detection: DetectionResult,
  options: ExportOptions,
): Promise<{ conversations: number; media: number; prompts: number; folders: string[] }> {
  const folders = new Set<string>();
  let conversationCount = 0;
  let mediaCount = 0;
  let promptCount = 0;

  // 1. Conversations: emit bundles
  for (const conv of detection.conversations) {
    await vault.saveConversation(conv);
    const bundle = exportConversationBundle(conv, options);
    folders.add(bundle.folder);
    for (const f of bundle.files) {
      queueText(f.path, f.content, f.mimeType);
    }
    conversationCount += 1;
  }

  // 2. Media: route each item into the right conversation folder if we can
  // associate it; otherwise it lands in a per-platform `_loose/` folder.
  for (const media of detection.media) {
    await vault.saveMedia(media);
    const parentSlug = inferParentSlug(media, detection);
    const ext = guessExt(media);
    const filename = sanitizeFilename(media.filename) || assetName(
      media.type === 'video' ? 'video' : 'img',
      mediaCount + 1,
      ext,
    );

    const vaultRelativePath = parentSlug
      ? `${media.platform}/${parentSlug}/assets/${filename}`
      : `${media.platform}/_loose/${filename}`;

    queueDownload({
      url: media.hdUrl || media.url,
      vaultPath: vaultRelativePath,
    });

    // Sidecar prompt note for AI-generated media (Imagine, DALL-E, etc.)
    if (media.prompt && parentSlug) {
      const sidecar = renderMediaPromptSidecar(media, parentSlug, filename);
      queueText(sidecar.path, sidecar.content, sidecar.mimeType);
    }

    mediaCount += 1;
  }

  // 3. Standalone prompts (not yet tied to a conversation, e.g. prompt-library
  // browsers): land in `_index/loose-prompts-YYYY-MM-DD.md`.
  if (detection.prompts.length > 0) {
    for (const p of detection.prompts) {
      await vault.savePrompt(p);
    }
    const collection = exportPrompts(detection.prompts, 'markdown', detection.platform);
    queueText(`_index/${collection.filename}`, collection.content, collection.mimeType);
    promptCount = detection.prompts.length;
  }

  return {
    conversations: conversationCount,
    media: mediaCount,
    prompts: promptCount,
    folders: Array.from(folders),
  };
}

/**
 * Best-effort association of a media item with a captured conversation.
 * If the media item came from inside a conversation, the scraper should set
 * `metadata.conversationId`. Otherwise we fall back to the first conversation
 * of the same platform (e.g. Grok Imagine gallery where there's no parent).
 */
function inferParentSlug(media: MediaItem, detection: DetectionResult): string | null {
  const convId = (media.metadata as Record<string, unknown> | undefined)?.conversationId;
  if (typeof convId === 'string') {
    const conv = detection.conversations.find((c) => c.id === convId);
    if (conv) return buildSlug(conv.title, conv.capturedAt);
  }
  if (detection.conversations.length > 0) {
    const conv = detection.conversations[0];
    return buildSlug(conv.title, conv.capturedAt);
  }
  return null;
}

function guessExt(media: MediaItem): string {
  const fromName = media.filename.match(/\.([a-z0-9]{2,4})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  return media.type === 'video' ? 'mp4' : 'png';
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

// ============================================================
// Message handling
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.type];
  if (handler) {
    handler(message, sender).then(sendResponse);
    return true;
  }
});

type MessageHandler = (
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown>;

const messageHandlers: Record<string, MessageHandler> = {
  THREADS_CONTENT_READY: async (message) => {
    console.log(`[Threads] Content script ready: ${message.platform}`);
    return { ok: true };
  },

  THREADS_DETECT_TAB: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return { error: 'No active tab' };

    const platform = detectPlatform(tab.url);
    if (!platform) return { error: 'Not on a supported AI platform' };

    try {
      // Accept both new and legacy detect messages while content scripts migrate.
      const result =
        (await chrome.tabs.sendMessage(tab.id, { type: 'THREADS_DETECT' }).catch(() => null)) ??
        (await chrome.tabs.sendMessage(tab.id, { type: 'VAULT_DETECT' }));
      return result as DetectionResult;
    } catch {
      return { error: `Content script not loaded on ${platform.name}. Refresh the page.` };
    }
  },

  THREADS_CAPTURE: async (message) => {
    const options = (message.options as ExportOptions) || defaultOptions();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return { error: 'No active tab' };

    const platform = detectPlatform(tab.url);
    if (!platform) return { error: 'Not on a supported AI platform' };

    let detection: DetectionResult;
    try {
      detection =
        (await chrome.tabs
          .sendMessage(tab.id, { type: 'THREADS_DETECT' })
          .catch(() => null)) ??
        ((await chrome.tabs.sendMessage(tab.id, { type: 'VAULT_DETECT' })) as DetectionResult);
    } catch {
      return { error: `Content script not loaded. Refresh ${platform.name}.` };
    }

    const counts = await persistDetection(detection, options);
    return {
      platform: platform.platform,
      vaultRoot: VAULT_ROOT,
      captured: counts,
    };
  },

  THREADS_EXPORT_ONE: async (message) => {
    const id = message.conversationId as string;
    const options = (message.options as ExportOptions) || defaultOptions();
    const conv = await vault.getConversation(id);
    if (!conv) return { error: 'Conversation not found in local index' };
    const out = exportConversation(conv, options);
    queueText(`_index/${out.filename}`, out.content, out.mimeType);
    return { filename: out.filename };
  },

  THREADS_EXPORT_PROMPTS: async (message) => {
    const platform = message.platform as Platform | undefined;
    const format = (message.format as 'markdown' | 'json') || 'markdown';
    const prompts = await vault.listPrompts(platform);
    const out = exportPrompts(prompts, format, platform ?? 'all');
    queueText(`_index/${out.filename}`, out.content, out.mimeType);
    return { filename: out.filename, count: prompts.length };
  },

  THREADS_SAVE: async (message) => {
    const detection = message.detection as DetectionResult;
    for (const conv of detection.conversations) await vault.saveConversation(conv);
    for (const m of detection.media) await vault.saveMedia(m);
    for (const p of detection.prompts) await vault.savePrompt(p);
    return {
      saved: {
        conversations: detection.conversations.length,
        media: detection.media.length,
        prompts: detection.prompts.length,
      },
    };
  },

  THREADS_STATS: async () => vault.getStats(),

  // Opt-in cloud bridge — disabled by default per the local-first manifesto.
  // The user must explicitly toggle "Send to Arcanea" in settings before this fires.
  THREADS_SEND_TO_ARCANEA: async (message) => {
    const detection = message.detection as DetectionResult;
    const endpoint =
      (message.endpoint as string) || 'https://arcanea.ai/api/threads/import';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'arcanea-threads',
          version: '0.2.0',
          platform: detection.platform,
          data: detection,
        }),
      });
      if (!response.ok) return { error: `Arcanea returned ${response.status}` };
      return await response.json();
    } catch (err) {
      return { error: `Failed to reach Arcanea: ${String(err)}` };
    }
  },

  // ----- Legacy message names (kept until popup + content scripts migrate) ---
  VAULT_CONTENT_READY: async (m) => messageHandlers.THREADS_CONTENT_READY(m, {} as any),
  VAULT_DETECT_TAB: async (m) => messageHandlers.THREADS_DETECT_TAB(m, {} as any),
  VAULT_QUICK_EXPORT: async (m) => messageHandlers.THREADS_CAPTURE(m, {} as any),
  VAULT_EXPORT: async (m) => messageHandlers.THREADS_EXPORT_ONE(m, {} as any),
  VAULT_EXPORT_PROMPTS: async (m) => messageHandlers.THREADS_EXPORT_PROMPTS(m, {} as any),
  VAULT_SAVE: async (m) => messageHandlers.THREADS_SAVE(m, {} as any),
  VAULT_STATS: async (m) => messageHandlers.THREADS_STATS(m, {} as any),
  VAULT_SEND_TO_PROMPT_BOOKS: async (m) => messageHandlers.THREADS_SEND_TO_ARCANEA(m, {} as any),

  // Download single media item by url (used by gallery scrapers)
  VAULT_DOWNLOAD_MEDIA: async (message) => {
    const items = message.items as Array<{ url: string; filename: string; platform?: Platform }>;
    const platform = (message.platform as Platform) || 'grok';
    for (const item of items) {
      queueDownload({
        url: item.url,
        vaultPath: `${platform}/_loose/${sanitizeFilename(item.filename)}`,
      });
    }
    return { queued: items.length };
  },
};

function defaultOptions(): ExportOptions {
  return {
    format: 'markdown',
    includeMedia: true,
    includeTimestamps: true,
    includeMetadata: true,
    embedMedia: false,
  };
}

// ============================================================
// Extension icon badge (per-tab platform indicator)
// ============================================================

const BADGE_COLOR = '#00bcd4'; // Atlantean Teal per @arcanea/design-system

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab.url) return;
    const platform = detectPlatform(tab.url);
    if (platform) {
      await chrome.action.setBadgeText({ text: platform.icon, tabId: activeInfo.tabId });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId: activeInfo.tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId: activeInfo.tabId });
    }
  } catch {
    // tab may have been closed
  }
});

console.log('[Arcanea Threads] Service worker initialized · schema v0.2.0');
