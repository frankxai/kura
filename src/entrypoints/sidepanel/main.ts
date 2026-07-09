// ============================================================
// Kura — Side-panel Library
// Lists captured conversations from IndexedDB. Opens each in
// Obsidian via the obsidian:// URI scheme when the user clicks.
// ============================================================

import type { Conversation, Platform } from '@/core/types';
import { initSuno } from './suno';
import { initVault } from './vault';

const $list = document.getElementById('lib-list') as HTMLUListElement;
const $stats = document.getElementById('lib-stats')!;
const $empty = document.getElementById('lib-empty')!;
const $search = document.getElementById('lib-search') as HTMLInputElement;
const $filter = document.getElementById('lib-filter') as HTMLSelectElement;
const $title = document.getElementById('panel-title')!;
const $tabLibrary = document.getElementById('tab-library') as HTMLButtonElement;
const $tabSuno = document.getElementById('tab-suno') as HTMLButtonElement;
const $viewLibrary = document.getElementById('view-library')!;
const $viewSuno = document.getElementById('view-suno')!;

let all: Conversation[] = [];
let activeTab: 'library' | 'suno' = 'library';

// ---------------------------------------------------------- tabs

initVault();

const suno = initSuno((text) => {
  if (activeTab === 'suno') $stats.textContent = text;
});

function switchTab(tab: 'library' | 'suno'): void {
  activeTab = tab;
  const library = tab === 'library';
  $tabLibrary.classList.toggle('is-active', library);
  $tabSuno.classList.toggle('is-active', !library);
  $tabLibrary.setAttribute('aria-selected', String(library));
  $tabSuno.setAttribute('aria-selected', String(!library));
  $viewLibrary.classList.toggle('hidden', !library);
  $viewSuno.classList.toggle('hidden', library);
  $title.textContent = library ? 'Library' : 'Suno Harvester';
  if (library) {
    applyFilters();
  } else {
    suno.onShow();
  }
}

$tabLibrary.addEventListener('click', () => switchTab('library'));
$tabSuno.addEventListener('click', () => switchTab('suno'));

const PLATFORM_GLYPH: Record<Platform, string> = {
  chatgpt: '◐',
  claude: '◈',
  gemini: '✦',
  grok: '𝕏',
  deepseek: '◇',
  perplexity: '⊕',
};

async function fetchAll(): Promise<Conversation[]> {
  // Warm the background SW with a stats ping so the next message is
  // served from a hot service worker (KURA_STATS is a no-op on the UI).
  await chrome.runtime.sendMessage({ type: 'KURA_STATS' });
  // The background handler returns VaultStats not full convos; use the
  // direct vault.listConversations message instead. We expose a dedicated
  // KURA_LIST message — fall back gracefully if the SW is older.
  const list = await chrome.runtime.sendMessage({ type: 'KURA_LIST_CONVERSATIONS' });
  if (Array.isArray(list)) return list as Conversation[];
  return [];
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function render(items: Conversation[]): void {
  if (items.length === 0) {
    $empty.classList.remove('hidden');
    $list.classList.add('hidden');
    return;
  }
  $empty.classList.add('hidden');
  $list.classList.remove('hidden');

  $list.innerHTML = '';
  for (const c of items) {
    const li = document.createElement('li');
    li.className = 'lib-item';
    li.dataset.id = c.id;

    const glyph = PLATFORM_GLYPH[c.platform] ?? '·';
    li.innerHTML = `
      <div class="lib-item-glyph" aria-hidden="true">${glyph}</div>
      <div class="lib-item-body">
        <div class="lib-item-title">${escape(c.title || 'Untitled')}</div>
        <div class="lib-item-meta">
          <span class="lib-item-platform">${escape(c.platform)}</span>
          <span class="lib-item-dot">·</span>
          <span>${fmtDate(c.capturedAt)}</span>
          <span class="lib-item-dot">·</span>
          <span>${c.messages?.length ?? 0} msgs</span>
        </div>
      </div>
      <div class="lib-item-actions">
        <a class="lib-item-link" href="${escapeAttr(c.url)}" target="_blank" rel="noopener" title="Open source" aria-label="Open ${escape(c.title || 'conversation')} source">↗</a>
      </div>
    `;
    $list.appendChild(li);
  }
}

function applyFilters(): void {
  const q = $search.value.trim().toLowerCase();
  const platform = $filter.value as Platform | '';
  let items = all;
  if (platform) items = items.filter((c) => c.platform === platform);
  if (q) {
    items = items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }
  items.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  render(items);
  if (activeTab !== 'library') return;
  $stats.textContent =
    items.length === all.length
      ? `${all.length} capture${all.length === 1 ? '' : 's'}`
      : `${items.length} of ${all.length} captures`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escape(s).replace(/'/g, '&#39;');
}

$search.addEventListener('input', applyFilters);
$filter.addEventListener('change', applyFilters);

(async () => {
  try {
    all = await fetchAll();
    applyFilters();
  } catch (err) {
    $stats.textContent = 'Failed to load';
    console.error('[Kura sidepanel]', err);
  }
})();
