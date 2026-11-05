// ============================================================
// Starlight Cortex — Multi-Model Dispatcher & Agent Mesh
// Dispatches prompts across active AI platform tabs simultaneously.
// Zero API tokens. 100% web subscription throughput.
// Connects browser sessions to the sovereign Starlight/Hermes agent harness.
// ============================================================

import type { Platform } from './types';
import { detectPlatform } from './detector';

export interface ActivePlatformTab {
  platform: Platform;
  tabId: number;
  title: string;
  url: string;
  active: boolean;
}

export interface DispatchTargetResult {
  platform: Platform;
  tabId?: number;
  ok: boolean;
  error?: string;
}

export interface DispatchBatchResult {
  prompt: string;
  timestamp: string;
  results: DispatchTargetResult[];
}

export const PLATFORM_NEW_CHAT_URLS: Record<Platform, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
  grok: 'https://grok.com/',
  gemini: 'https://gemini.google.com/app',
  deepseek: 'https://chat.deepseek.com/',
  perplexity: 'https://www.perplexity.ai/',
};

/** Query all open tabs and group them by supported AI platform */
export async function getActivePlatformTabs(): Promise<ActivePlatformTab[]> {
  const tabs = await chrome.tabs.query({});
  const activeTabs: ActivePlatformTab[] = [];

  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url || tab.incognito) continue;
    const match = detectPlatform(tab.url);
    if (match) {
      activeTabs.push({
        platform: match.platform,
        tabId: tab.id,
        title: tab.title || match.name,
        url: tab.url,
        active: Boolean(tab.active),
      });
    }
  }

  return activeTabs;
}

/** Open a new tab for a platform if not already open */
export async function ensurePlatformTab(platform: Platform): Promise<number> {
  const existing = await getActivePlatformTabs();
  const match = existing.find((t) => t.platform === platform);
  if (match) {
    return match.tabId;
  }

  const url = PLATFORM_NEW_CHAT_URLS[platform] || 'https://google.com';
  const newTab = await chrome.tabs.create({ url, active: false });
  if (!newTab.id) throw new Error(`Failed to create tab for ${platform}`);
  return newTab.id;
}

/** Dispatch a prompt to a specific tab via its content script */
export async function dispatchPromptToTab(
  tabId: number,
  platform: Platform,
  prompt: string,
  autoSubmit = true,
): Promise<DispatchTargetResult> {
  try {
    const res = (await chrome.tabs.sendMessage(tabId, {
      type: 'STARLIGHT_INJECT_PROMPT',
      prompt,
      autoSubmit,
    })) as { ok?: boolean; error?: string } | undefined;

    if (res && res.ok) {
      return { platform, tabId, ok: true };
    }
    return {
      platform,
      tabId,
      ok: false,
      error: res?.error || 'Content script did not confirm injection',
    };
  } catch {
    return {
      platform,
      tabId,
      ok: false,
      error: `Could not reach ${platform} tab. Please ensure page is loaded.`,
    };
  }
}

/** Broadcast a prompt to multiple platforms in parallel */
export async function broadcastPrompt(
  prompt: string,
  targets: Platform[],
  openMissing = false,
  autoSubmit = true,
): Promise<DispatchBatchResult> {
  const activeTabs = await getActivePlatformTabs();
  const results: DispatchTargetResult[] = [];

  const promises = targets.map(async (platform) => {
    const matchingTab = activeTabs.find((t) => t.platform === platform);
    let tabId = matchingTab?.tabId;

    if (!tabId) {
      if (openMissing) {
        try {
          tabId = await ensurePlatformTab(platform);
          // Wait briefly for content script initialization
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err) {
          results.push({
            platform,
            ok: false,
            error: `Failed to open tab for ${platform}: ${String(err)}`,
          });
          return;
        }
      } else {
        results.push({
          platform,
          ok: false,
          error: `No open tab found for ${platform}. Open it in your browser first.`,
        });
        return;
      }
    }

    const result = await dispatchPromptToTab(tabId, platform, prompt, autoSubmit);
    results.push(result);
  });

  await Promise.allSettled(promises);

  return {
    prompt,
    timestamp: new Date().toISOString(),
    results,
  };
}
