// ============================================================
// Kura — Offscreen writer
// The service worker cannot hold a File System Access handle, so it
// delegates vault writes here. This document re-reads the persisted
// handle from IndexedDB (handles are NOT transferable over
// chrome.runtime messaging — IndexedDB is the per-origin hand-off
// channel) and writes the plan. Writing needs no user activation
// once the side panel has granted readwrite this session; if the
// grant has lapsed we report back so the SW falls back to Downloads.
// ============================================================

import { loadDirectory } from '@/core/fs';
import { writePlan } from '@/core/vault-writer';
import { VAULT_DIR_KEY } from '@/core/vault-keys';
import type { WritePlan } from '@/core/capture-plan';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'KURA_OFFSCREEN_WRITE') return;

  void (async () => {
    try {
      const root = await loadDirectory(VAULT_DIR_KEY, false);
      if (!root) {
        // No stored handle, or permission is 'prompt'/'denied' — the offscreen
        // document has no user gesture to re-prompt with. Tell the SW to fall back.
        sendResponse({ ok: false, reason: 'no-vault' });
        return;
      }
      const result = await writePlan(root, message.plan as WritePlan);
      sendResponse({ ok: true, ...result });
    } catch (err) {
      sendResponse({ ok: false, reason: 'error', error: String(err) });
    }
  })();

  return true; // async sendResponse
});
