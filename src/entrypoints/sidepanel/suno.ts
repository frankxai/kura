// ============================================================
// Kura — Side-panel Suno Harvester tab
// Index the public catalog, flag tracks, fetch flagged audio /
// video at human cadence — straight to the local intake folder.
// ============================================================

import {
  fetchFlagged,
  indexCatalog,
  readCatalog,
  readFlags,
  readLedger,
  setFlag,
} from '@/suno/harvester';
import type { DownloadLedger, HarvestProgress, SunoFlags, SunoTrack } from '@/suno/types';
import { onVaultChange } from './vault';

const HANDLE_KEY = 'kura_suno_handle';

const $handle = document.getElementById('suno-handle') as HTMLInputElement;
const $index = document.getElementById('suno-index') as HTMLButtonElement;
const $fetchAudio = document.getElementById('suno-fetch-audio') as HTMLButtonElement;
const $fetchAv = document.getElementById('suno-fetch-av') as HTMLButtonElement;
const $cancel = document.getElementById('suno-cancel') as HTMLButtonElement;
const $progress = document.getElementById('suno-progress')!;
const $progressFill = document.getElementById('suno-progress-fill')!;
const $progressText = document.getElementById('suno-progress-text')!;
const $search = document.getElementById('suno-search') as HTMLInputElement;
const $sort = document.getElementById('suno-sort') as HTMLSelectElement;
const $empty = document.getElementById('suno-empty')!;
const $list = document.getElementById('suno-list') as HTMLUListElement;

let root: FileSystemDirectoryHandle | null = null;
let catalog: SunoTrack[] = [];
let flags: SunoFlags = { version: 1, flags: {} };
let ledger: DownloadLedger = {};
let abort: AbortController | null = null;
let statsLine: (text: string) => void = () => {};

export function initSuno(setStats: (text: string) => void): { onShow: () => void } {
  statsLine = setStats;

  chrome.storage.local.get(HANDLE_KEY).then((v) => {
    if (typeof v[HANDLE_KEY] === 'string' && v[HANDLE_KEY]) $handle.value = v[HANDLE_KEY];
  });
  $handle.addEventListener('change', () => {
    chrome.storage.local.set({ [HANDLE_KEY]: $handle.value.trim() });
  });

  $index.addEventListener('click', () => run('index'));
  $fetchAudio.addEventListener('click', () => run('audio'));
  $fetchAv.addEventListener('click', () => run('av'));
  $cancel.addEventListener('click', () => abort?.abort());
  $search.addEventListener('input', renderList);
  $sort.addEventListener('change', renderList);

  // The vault folder is shared across tabs — adopt it whenever it changes.
  onVaultChange((handle) => void adoptRoot(handle));
  return { onShow: updateStats };
}

async function adoptRoot(handle: FileSystemDirectoryHandle | null): Promise<void> {
  root = handle;
  setBusy(false);
  if (handle) {
    await reloadFromDisk();
  } else {
    catalog = [];
    flags = { version: 1, flags: {} };
    ledger = {};
    renderList();
    updateStats();
  }
}

async function reloadFromDisk(): Promise<void> {
  if (!root) return;
  [catalog, flags, ledger] = await Promise.all([
    readCatalog(root),
    readFlags(root),
    readLedger(root),
  ]);
  renderList();
  updateStats();
}

// ---------------------------------------------------------- runs

async function run(kind: 'index' | 'audio' | 'av'): Promise<void> {
  if (!root || abort) return;
  abort = new AbortController();
  setBusy(true);

  try {
    if (kind === 'index') {
      catalog = await indexCatalog(root, $handle.value.trim() || 'frankx', onProgress, abort.signal);
    } else {
      await fetchFlagged(root, catalog, kind === 'av', onProgress, abort.signal);
      ledger = await readLedger(root);
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      onProgress({ phase: 'error', total: 0, completed: 0, failed: 0, message: String(err) });
    }
  } finally {
    abort = null;
    setBusy(false);
    renderList();
    updateStats();
  }
}

function onProgress(p: HarvestProgress): void {
  $progress.classList.remove('hidden');
  const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
  ($progressFill as HTMLElement).style.width = `${pct}%`;

  const label =
    p.phase === 'indexing'
      ? p.message ?? 'Indexing…'
      : p.phase === 'downloading'
        ? `${p.completed + 1}/${p.total} · ${p.currentTitle ?? ''}`
        : p.phase === 'cancelled'
          ? `Cancelled · ${p.completed} done`
          : p.phase === 'error'
            ? `Error: ${p.message}`
            : p.message ?? 'Done';
  $progressText.textContent = label;

  if (p.phase === 'done' || p.phase === 'cancelled' || p.phase === 'error') {
    ($progressFill as HTMLElement).style.width = p.phase === 'done' ? '100%' : `${pct}%`;
  }
}

function setBusy(busy: boolean): void {
  const connected = !!root;
  $index.disabled = busy || !connected;
  $fetchAudio.disabled = busy || !connected;
  $fetchAv.disabled = busy || !connected;
  $cancel.classList.toggle('hidden', !busy);
}

// ---------------------------------------------------------- list

function flaggedCount(): number {
  return Object.values(flags.flags).filter((f) => f.audio || f.video).length;
}

function updateStats(): void {
  if (!root) {
    statsLine('Connect a vault to begin');
    return;
  }
  const downloaded = Object.keys(ledger).length;
  statsLine(`${catalog.length} tracks · ${flaggedCount()} flagged · ${downloaded} fetched`);
}

function fmtDuration(sec: number | null): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderList(): void {
  const q = $search.value.trim().toLowerCase();
  let items = catalog;
  if (q) {
    items = items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.styleTags ?? '').toLowerCase().includes(q) ||
        (t.lyrics ?? '').toLowerCase().includes(q),
    );
  }

  const sort = $sort.value;
  items = [...items].sort((a, b) => {
    if (sort === 'plays') return b.plays - a.plays;
    if (sort === 'likes') return b.likes - a.likes;
    if (sort === 'flagged') {
      const fa = flags.flags[a.id] ? 1 : 0;
      const fb = flags.flags[b.id] ? 1 : 0;
      if (fb !== fa) return fb - fa;
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  if (items.length === 0) {
    $empty.classList.remove('hidden');
    $list.classList.add('hidden');
    return;
  }
  $empty.classList.add('hidden');
  $list.classList.remove('hidden');

  $list.innerHTML = '';
  for (const t of items) {
    const isFlagged = !!flags.flags[t.id] && (flags.flags[t.id].audio || flags.flags[t.id].video);
    const dl = ledger[t.id];
    const li = document.createElement('li');
    li.className = 'lib-item suno-item';
    li.dataset.id = t.id;
    const flagLabel = isFlagged ? `Unflag ${escapeHtml(t.title)}` : `Flag ${escapeHtml(t.title)} for harvest`;
    li.innerHTML = `
      <button class="suno-flag ${isFlagged ? 'is-flagged' : ''}" title="${isFlagged ? 'Unflag' : 'Flag for harvest'}" aria-label="${flagLabel}" aria-pressed="${isFlagged}">${isFlagged ? '★' : '☆'}</button>
      <div class="lib-item-body">
        <div class="lib-item-title">${escapeHtml(t.title)}</div>
        <div class="lib-item-meta">
          <span>${t.createdAt.slice(0, 10)}</span>
          <span class="lib-item-dot">·</span>
          <span>${t.plays} plays</span>
          <span class="lib-item-dot">·</span>
          <span>${fmtDuration(t.duration)}</span>
          ${dl ? '<span class="lib-item-dot">·</span><span class="suno-fetched">fetched</span>' : ''}
        </div>
      </div>
      <div class="lib-item-actions">
        <a class="lib-item-link" href="${escapeHtml(t.sunoUrl)}" target="_blank" rel="noopener" title="Open on Suno" aria-label="Open ${escapeHtml(t.title)} on Suno">↗</a>
      </div>
    `;
    li.querySelector('.suno-flag')!.addEventListener('click', () => void toggleFlag(t.id, isFlagged));
    $list.appendChild(li);
  }
}

async function toggleFlag(trackId: string, currentlyFlagged: boolean): Promise<void> {
  if (!root) return;
  flags = await setFlag(root, trackId, currentlyFlagged ? null : { audio: true, video: true });
  renderList();
  updateStats();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
