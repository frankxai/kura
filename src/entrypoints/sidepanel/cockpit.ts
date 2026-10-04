// ============================================================
// Starlight Cockpit — Multi-Model Dispatcher UI Controller
// ============================================================

import type { Platform } from '@/core/types';
import type { ActivePlatformTab, DispatchBatchResult } from '@/core/dispatcher';

export function initCockpit(): { onShow: () => void } {
  const $prompt = document.getElementById('cockpit-prompt') as HTMLTextAreaElement | null;
  const $broadcastBtn = document.getElementById('cockpit-broadcast-btn') as HTMLButtonElement | null;
  const $autoOpen = document.getElementById('cockpit-auto-open') as HTMLInputElement | null;
  const $receipts = document.getElementById('cockpit-receipts') as HTMLDivElement | null;
  const $receiptsList = document.getElementById('cockpit-receipts-list') as HTMLUListElement | null;
  const $clearLog = document.getElementById('cockpit-clear-log') as HTMLButtonElement | null;

  const targetChips = document.querySelectorAll<HTMLLabelElement>('.target-chip');

  if (!$prompt || !$broadcastBtn) {
    return { onShow: () => {} };
  }

  // Toggle selection state on chip click
  targetChips.forEach((chip) => {
    const checkbox = chip.querySelector<HTMLInputElement>('.target-checkbox');
    if (!checkbox) return;

    chip.addEventListener('click', () => {
      setTimeout(() => {
        chip.classList.toggle('is-selected', checkbox.checked);
      }, 0);
    });
  });

  // Refresh active tab status indicators
  async function refreshTabStatus(): Promise<void> {
    try {
      const activeTabs = (await chrome.runtime.sendMessage({
        type: 'STARLIGHT_GET_ACTIVE_TABS',
      })) as ActivePlatformTab[] | undefined;

      const activePlatforms = new Set(activeTabs?.map((t) => t.platform) || []);

      const platforms: Platform[] = ['claude', 'chatgpt', 'grok', 'gemini'];
      for (const p of platforms) {
        const dot = document.getElementById(`status-${p}`);
        if (dot) {
          dot.classList.toggle('is-active', activePlatforms.has(p));
        }
      }
    } catch {
      // Ignore background communication error
    }
  }

  // Get selected target platforms
  function getSelectedTargets(): Platform[] {
    const selected: Platform[] = [];
    targetChips.forEach((chip) => {
      const checkbox = chip.querySelector<HTMLInputElement>('.target-checkbox');
      const platform = chip.dataset.platform as Platform | undefined;
      if (checkbox?.checked && platform) {
        selected.push(platform);
      }
    });
    return selected;
  }

  // Broadcast prompt handler
  async function handleBroadcast(): Promise<void> {
    const text = $prompt?.value.trim();
    if (!text) {
      $prompt?.focus();
      return;
    }

    const targets = getSelectedTargets();
    if (targets.length === 0) {
      alert('Please select at least one AI platform target.');
      return;
    }

    if ($broadcastBtn) {
      $broadcastBtn.disabled = true;
      $broadcastBtn.textContent = 'Broadcasting…';
    }

    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'STARLIGHT_DISPATCH_PROMPT',
        prompt: text,
        targets,
        openMissing: $autoOpen?.checked ?? true,
      })) as DispatchBatchResult | undefined;

      renderReceipt(res);
      if ($prompt) $prompt.value = '';
    } catch (err) {
      console.error('[Cockpit] Broadcast error:', err);
    } finally {
      if ($broadcastBtn) {
        $broadcastBtn.disabled = false;
        $broadcastBtn.textContent = '✦ Broadcast Prompt';
      }
      refreshTabStatus();
    }
  }

  function renderReceipt(batch?: DispatchBatchResult): void {
    if (!batch || !$receipts || !$receiptsList) return;
    $receipts.classList.remove('hidden');

    for (const r of batch.results) {
      const li = document.createElement('li');
      li.className = `receipt-item ${r.ok ? 'is-ok' : 'is-error'}`;
      li.innerHTML = `
        <span style="font-weight: 500; text-transform: capitalize;">${r.platform}</span>
        <span style="color: ${r.ok ? 'var(--ok)' : 'var(--err)'}; font-size: 11px;">
          ${r.ok ? 'Sent ✓' : r.error || 'Failed'}
        </span>
      `;
      $receiptsList.prepend(li);
    }
  }

  // Clear log
  $clearLog?.addEventListener('click', () => {
    if ($receiptsList) $receiptsList.innerHTML = '';
    $receipts?.classList.add('hidden');
  });

  // Event listeners
  $broadcastBtn.addEventListener('click', () => void handleBroadcast());

  $prompt.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleBroadcast();
    }
  });

  // Initial refresh
  refreshTabStatus();

  return {
    onShow: () => {
      refreshTabStatus();
      $prompt?.focus();
    },
  };
}
