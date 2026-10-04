// ============================================================
// Kura — Background Service Worker
// Orchestrates downloads into the local Obsidian-compatible vault.
// Local-first: every capture lands in Kura/ on disk.
// ============================================================

import { defineBackground } from 'wxt/utils/define-background';
import { detectPlatform } from '@/core/detector';
import { vault } from '@/core/storage';
import { exportConversation, exportPrompts } from '@/core/exporter';
import { VAULT_ROOT, buildSlug } from '@/core/frontmatter';
import { buildWritePlan, sanitizeMediaFilename } from '@/core/capture-plan';
import {
  getActivePlatformTabs,
  broadcastPrompt,
  ensurePlatformTab,
  dispatchPromptToTab,
} from '@/core/dispatcher';
import type { WritePlan } from '@/core/capture-plan';
import type { ExportOptions, DetectionResult, Platform } from '@/core/types';

/** Where a capture actually landed — surfaced to the popup. */
type CaptureSink = 'fsa' | 'downloads';

export default defineBackground({
  type: 'module',
  main() {
    // ============================================================
    // Download queue (rate-limited, sequential)
    // ============================================================

    interface DownloadJob {
      /** Pre-existing remote URL (http/https) OR a blob: URL we created locally. */
      url: string;
      /** Vault-relative path. The full chrome path is `Kura/<path>`. */
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
            conflictAction: 'uniquify',
          });
        } catch (err) {
          console.error('[Kura] Download failed:', fullPath, err);
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
      // Object URLs are unavailable in MV3 service workers. Explicit downloads
      // use data URLs; their source stays in the local index for manual retry.
      const url = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
      queueDownload({ url, vaultPath });
    }

    // ============================================================
    // Capture orchestration
    // ============================================================

    /**
     * Persist a detection result. IndexedDB gets the structured records (the
     * query index); the files land either straight in the connected vault
     * folder via the File System Access API, or — when no vault is connected /
     * its grant has lapsed — in `Kura/` under Downloads. Returns counts + the
     * sink so the popup can tell the user where it wrote.
     */
    let captureQueue: Promise<unknown> = Promise.resolve();
    function persistDetection(detection: DetectionResult, options: ExportOptions, requireVault = false) {
      const pending = captureQueue.then(() => persistDetectionNow(detection, options, requireVault));
      captureQueue = pending.catch(() => {});
      return pending;
    }
    async function persistDetectionNow(
      detection: DetectionResult,
      options: ExportOptions,
      requireVault = false,
    ): Promise<{
      conversations: number;
      media: number;
      prompts: number;
      folders: string[];
      sink: CaptureSink;
    }> {
      // Reuse the first folder even after a title change or a later capture day.
      const known = await vault.listConversations();
      const occupied = new Set(known.map((conv) => `${conv.platform}/${conv.metadata?.kuraSlug ?? buildSlug(conv.title, conv.capturedAt)}`));
      for (const conv of detection.conversations) {
        const previous = known.find((item) => item.id === conv.id && item.platform === conv.platform);
        let slug = previous?.metadata?.kuraSlug as string | undefined;
        if (previous && !slug) slug = buildSlug(previous.title, previous.capturedAt);
        if (!slug) {
          const base = buildSlug(conv.title, conv.capturedAt);
          slug = base;
          for (let suffix = 2; occupied.has(`${conv.platform}/${slug}`); suffix += 1) slug = `${base}-${suffix}`;
        }
        occupied.add(`${conv.platform}/${slug}`);
        conv.metadata = { ...conv.metadata, kuraSlug: slug };
      }
      const plan = buildWritePlan(detection, options);
      let sink: CaptureSink;
      if (requireVault) {
        const result = await tryWriteViaOffscreen(plan);
        if (!result) throw new Error('Connect or re-grant your capture folder in Kura.');
        if (result.failedMedia?.length) throw new Error('Text was saved; some media could not be fetched. Retry capture to save those assets.');
        reconcileIndexFolders(detection, result);
        sink = 'fsa';
      } else {
        const result = await tryWriteViaOffscreen(plan);
        if (result) {
          if (result.failedMedia?.length) throw new Error('Text was saved; some media could not be fetched. Retry capture to save those assets.');
          reconcileIndexFolders(detection, result);
          sink = 'fsa';
        } else {
          sink = await writePlanToVaultOrDownloads(plan);
        }
      }
      for (const conv of detection.conversations) await vault.saveConversation(conv);
      for (const m of detection.media) await vault.saveMedia(m);
      for (const p of detection.prompts) await vault.savePrompt(p);

      return {
        conversations: plan.counts.conversations,
        media: plan.counts.media,
        prompts: plan.counts.prompts,
        folders: detection.conversations.map((conv) => `${conv.platform}/${conv.metadata?.kuraSlug}`),
        sink,
      };
    }

    // ============================================================
    // Direct-to-disk vault write (File System Access via offscreen doc)
    // ============================================================

    let offscreenReady: Promise<void> | null = null;

    /** Ensure the single offscreen writer document exists. */
    async function ensureOffscreen(): Promise<void> {
      if (await chrome.offscreen.hasDocument()) return;
      if (!offscreenReady) {
        offscreenReady = (async () => {
          try {
            await chrome.offscreen.createDocument({
              url: 'offscreen.html',
              reasons: [chrome.offscreen.Reason.BLOBS],
              justification:
                'Write captured conversations into the local vault folder via the File System Access API.',
            });
          } catch (err) {
            // A concurrent caller may have created it first — tolerate that.
            if (!(await chrome.offscreen.hasDocument())) throw err;
          }
        })().finally(() => {
          offscreenReady = null;
        });
      }
      await offscreenReady;
    }

    interface OffscreenWriteResult {
      ok: boolean;
      reason?: string;
      error?: string;
      folderMap?: Record<string, string>;
      failedMedia?: { path: string; url: string }[];
    }

    function reconcileIndexFolders(detection: DetectionResult, result: OffscreenWriteResult) {
      for (const conv of detection.conversations) {
        const key = `${conv.platform}/${conv.metadata?.kuraSlug}`;
        if (result.folderMap?.[key]) conv.metadata = { ...conv.metadata, kuraSlug: result.folderMap[key].split('/')[1] };
      }
    }

    /** Ask the offscreen document to write the plan to the connected vault.
     *  Returns null when FSA is unavailable (no offscreen API, no vault, or a
     *  lapsed permission grant) so the caller can fall back to Downloads. */
    async function tryWriteViaOffscreen(plan: WritePlan): Promise<OffscreenWriteResult | null> {
      let res: OffscreenWriteResult | undefined;
      try {
        if (!chrome.offscreen) return null;
        await ensureOffscreen();
        res = (await chrome.runtime.sendMessage({
          type: 'KURA_OFFSCREEN_WRITE',
          plan,
        })) as OffscreenWriteResult | undefined;
      } catch {
        return null;
      }
      if (res?.reason === 'error') throw new Error(res.error || 'Saved capture was protected. Inspect the connected folder.');
      return res?.ok ? res : null;
    }

    async function writePlanToVaultOrDownloads(plan: WritePlan): Promise<CaptureSink> {
      const res = await tryWriteViaOffscreen(plan);
      if (res) {
        // Media the offscreen doc couldn't fetch (a CDN host outside our
        // host_permissions) still goes through Downloads, which bypasses CORS,
        // so nothing is silently dropped.
        for (const m of res.failedMedia ?? []) {
          queueDownload({ url: m.url, vaultPath: m.path });
        }
        return 'fsa';
      }
      if (plan.counts.conversations > 0) throw new Error('Connect or re-grant your capture folder in Kura before capturing a thread.');
      enqueuePlanToDownloads(plan);
      return 'downloads';
    }

    function enqueuePlanToDownloads(plan: WritePlan): void {
      for (const f of plan.textFiles) {
        queueText(f.path, f.content, f.path.endsWith('.json') ? 'application/json' : 'text/markdown');
      }
      for (const m of plan.mediaFiles) {
        queueDownload({ url: m.url, vaultPath: m.path });
      }
    }

    /** Detect + persist the active tab's conversation. Shared by the popup's
     *  Export button and the keyboard command. */
    async function captureActiveTab(
      options: ExportOptions,
    ): Promise<{ error: string } | { platform: Platform; vaultRoot: string; captured: unknown }> {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) return { error: 'No active tab' };

      const platform = detectPlatform(tab.url);
      if (!platform) return { error: 'Not on a supported AI platform' };

      let detection: DetectionResult;
      try {
        detection =
          (await chrome.tabs
            .sendMessage(tab.id, { type: 'KURA_DETECT' })
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
    }

    // ============================================================
    // Message handling
    // ============================================================

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return;
      const contentMessage = ['KURA_CONTENT_READY', 'VAULT_CONTENT_READY', 'THREADS_CONTENT_READY', 'STARLIGHT_AUTO_SAVE'].includes(message?.type);
      const extensionPage = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));
      if (!extensionPage && !contentMessage) {
        sendResponse({ ok: false, error: 'Open Kura to perform this action.' });
        return;
      }
      const handler = messageHandlers[message.type];
      if (handler) {
        handler(message, sender).then(sendResponse).catch(() => sendResponse({ ok: false, error: 'Capture failed. Check the connected folder and try again.' }));
        return true;
      }
    });

    type MessageHandler = (
      message: Record<string, unknown>,
      sender: chrome.runtime.MessageSender,
    ) => Promise<unknown>;

    const messageHandlers: Record<string, MessageHandler> = {
      KURA_CONTENT_READY: async (message) => {
        console.log(`[Kura] Content script ready: ${message.platform}`);
        return { ok: true };
      },

      KURA_DETECT_TAB: async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url) return { error: 'No active tab' };

        const platform = detectPlatform(tab.url);
        if (!platform) return { error: 'Not on a supported AI platform' };

        try {
          // Accept both new and legacy detect messages while content scripts migrate.
          const result =
            (await chrome.tabs.sendMessage(tab.id, { type: 'KURA_DETECT' }).catch(() => null)) ??
            (await chrome.tabs.sendMessage(tab.id, { type: 'VAULT_DETECT' }));
          return result as DetectionResult;
        } catch {
          return { error: `Content script not loaded on ${platform.name}. Refresh the page.` };
        }
      },

      KURA_CAPTURE: async (message) =>
        captureActiveTab((message.options as ExportOptions) || defaultOptions()),

      KURA_EXPORT_ONE: async (message) => {
        const id = message.conversationId as string;
        const options = (message.options as ExportOptions) || defaultOptions();
        const conv = await vault.getConversation(id);
        if (!conv) return { error: 'Conversation not found in local index' };
        const out = exportConversation(conv, options);
        queueText(`_index/${out.filename}`, out.content, out.mimeType);
        return { filename: out.filename };
      },

      KURA_EXPORT_PROMPTS: async (message) => {
        const platform = message.platform as Platform | undefined;
        const format = (message.format as 'markdown' | 'json') || 'markdown';
        const prompts = await vault.listPrompts(platform);
        const out = exportPrompts(prompts, format, platform ?? 'all');
        queueText(`_index/${out.filename}`, out.content, out.mimeType);
        return { filename: out.filename, count: prompts.length };
      },

      KURA_SAVE: async (message) => {
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

      KURA_STATS: async () => vault.getStats(),

      KURA_LIST_CONVERSATIONS: async (message) => {
        const platform = message.platform as Platform | undefined;
        return vault.listConversations(platform);
      },

      // ============================================================
      // Starlight Multi-Model Mesh & Dispatcher Handlers
      // ============================================================

      STARLIGHT_GET_ACTIVE_TABS: async () => getActivePlatformTabs(),

      STARLIGHT_DISPATCH_PROMPT: async (message) => {
        const prompt = (message.prompt as string) || '';
        const targets = (message.targets as Platform[]) || ['claude', 'chatgpt', 'grok', 'gemini'];
        const openMissing = Boolean(message.openMissing);
        const autoSubmit = message.autoSubmit !== false;
        return broadcastPrompt(prompt, targets, openMissing, autoSubmit);
      },

      STARLIGHT_RELAY_PROMPT: async (message) => {
        const to = message.to as Platform;
        const prompt = (message.prompt as string) || '';
        const autoSubmit = message.autoSubmit !== false;
        const tabId = await ensurePlatformTab(to);
        return dispatchPromptToTab(tabId, to, prompt, autoSubmit);
      },

      STARLIGHT_AUTO_SAVE: async (message, sender) => {
        const detection = message.detection as DetectionResult;
        if (!detection || !detection.conversations) return { ok: false };
        const platform = sender.tab?.url && detectPlatform(sender.tab.url)?.platform;
        if (!platform || detection.platform !== platform || detection.conversations.some((conv) => conv.platform !== platform)) return { ok: false };
        try {
          const counts = await persistDetection(detection, defaultOptions(), true);
          if (sender.tab?.id) {
            await chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
            await chrome.action.setTitle({ title: 'Kura', tabId: sender.tab.id });
          }
          return { ok: true, counts };
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Open Kura and check your capture folder.';
          if (sender.tab?.id) {
            await chrome.action.setBadgeText({ text: '!', tabId: sender.tab.id });
            await chrome.action.setTitle({ title: `Kura: ${reason}`, tabId: sender.tab.id });
          }
          return { ok: false, reason };
        }
      },

      // Opt-in Arcanea integration — disabled by default per the local-first
      // manifesto. The user must explicitly click "Send to Arcanea" to fire.
      // This is the only Arcanea-aware code in the sovereign Kura extension;
      // everything else is brand-neutral.
      KURA_SEND_TO_ARCANEA: async (message) => {
        const detection = message.detection as DetectionResult;
        const endpoint = 'https://arcanea.ai/api/kura/import';
        if (message.endpoint && message.endpoint !== endpoint) return { error: 'Unsupported Arcanea endpoint.' };

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Kura-Source': 'kura/0.2.0',
            },
            body: JSON.stringify({
              source: 'kura',
              integration: 'arcanea',
              version: '0.2.0',
              schemaVersion: '0.2.0',
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
      // VAULT_* are from v0.1 (Arcanea Vault).
      // THREADS_* are from v0.2.0 pre-rename (Arcanea Threads). Both alias to KURA_*.
      VAULT_CONTENT_READY: async (m) => messageHandlers.KURA_CONTENT_READY(m, {} as any),
      VAULT_DETECT_TAB: async (m) => messageHandlers.KURA_DETECT_TAB(m, {} as any),
      VAULT_QUICK_EXPORT: async (m) => messageHandlers.KURA_CAPTURE(m, {} as any),
      VAULT_EXPORT: async (m) => messageHandlers.KURA_EXPORT_ONE(m, {} as any),
      VAULT_EXPORT_PROMPTS: async (m) => messageHandlers.KURA_EXPORT_PROMPTS(m, {} as any),
      VAULT_SAVE: async (m) => messageHandlers.KURA_SAVE(m, {} as any),
      VAULT_STATS: async (m) => messageHandlers.KURA_STATS(m, {} as any),
      VAULT_SEND_TO_PROMPT_BOOKS: async (m) => messageHandlers.KURA_SEND_TO_ARCANEA(m, {} as any),
      THREADS_CONTENT_READY: async (m) => messageHandlers.KURA_CONTENT_READY(m, {} as any),
      THREADS_DETECT_TAB: async (m) => messageHandlers.KURA_DETECT_TAB(m, {} as any),
      THREADS_CAPTURE: async (m) => messageHandlers.KURA_CAPTURE(m, {} as any),
      THREADS_EXPORT_ONE: async (m) => messageHandlers.KURA_EXPORT_ONE(m, {} as any),
      THREADS_EXPORT_PROMPTS: async (m) => messageHandlers.KURA_EXPORT_PROMPTS(m, {} as any),
      THREADS_SAVE: async (m) => messageHandlers.KURA_SAVE(m, {} as any),
      THREADS_STATS: async (m) => messageHandlers.KURA_STATS(m, {} as any),
      THREADS_SEND_TO_ARCANEA: async (m) => messageHandlers.KURA_SEND_TO_ARCANEA(m, {} as any),

      // Download single media item by url (used by gallery scrapers)
      VAULT_DOWNLOAD_MEDIA: async (message) => {
        const items = message.items as Array<{ url: string; filename: string; platform?: Platform }>;
        const platform = (message.platform as Platform) || 'grok';
        for (const item of items) {
          queueDownload({
            url: item.url,
            vaultPath: `${platform}/_loose/${sanitizeMediaFilename(item.filename)}`,
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

    // Keyboard command: capture the active conversation without opening the
    // popup. Feedback lands on the action badge since there is no UI surface.
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'starlight-dispatch') {
        void (async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.windowId && chrome.sidePanel) {
            await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
          }
        })();
        return;
      }

      if (command !== 'kura-capture') return;
      void (async () => {
        const result = await captureActiveTab(defaultOptions());
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const ok = !('error' in result);
        await chrome.action.setBadgeText({ text: ok ? '✓' : '!', tabId: tab.id });
        await chrome.action.setBadgeBackgroundColor({
          color: ok ? '#4ade80' : '#f87171',
          tabId: tab.id,
        });
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {});
        }, 2500);
      })();
    });

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

    console.log('[Kura] Service worker initialized · schema v0.2.0');
  },
});
