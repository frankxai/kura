// ============================================================
// Kura — Side-panel Suno Harvester tab
// Index the public catalog, flag tracks, fetch flagged audio /
// video at human cadence — straight to the local intake folder.
// ============================================================

import { hasStoredDirectory, loadDirectory, pickDirectory } from '@/core/fs';
import {
  fetchFlagged,
  indexCatalog,
  readCatalog,
  readFlags,
  readLedger,
  setFlag,
} from '@/suno/harvester';
import type { DownloadLedger, HarvestProgress, SunoFlags, SunoTrack } from '@/suno/types';

const HANDLE_KEY = 'kura_suno_handle';
const DIR_KEY = 'sunoIntake';

const $pick = document.getElementById('suno-pick-folder') as HTMLButtonElement;
const $folderName = document.getElementById('suno-folder-name')!;
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

  $pick.addEventListener('click', connectFolder);
  $index.addEventListener('click', () => run('index'));
  $fetchAudio.addEventListener('click', () => run('audio'));
  $fetchAv.addEventListener('click', () => run('av'));
  $cancel.addEventListener('click', () => abort?.abort());
  $search.addEventListener('input', renderList);
  $sort.addEventListener('change', renderList);

  void restoreQuietly();
  return { onShow: updateStats };
}

/** On load: reuse a stored handle when permission is still granted. */
async function restoreQuietly(): Promise<void> {
  if (await hasStoredDirectory(DIR_KEY)) {
    $pick.textContent = 'Reconnect intake folder';
    const handle = await loadDirectory(DIR_KEY, false);
    if (handle) await adoptRoot(handle);
  }
}

/** User gesture: re-grant permission on the stored handle or pick fresh. */
async function connectFolder(): Promise<void> {
  try {
    const restored = await loadDirectory(DIR_KEY, true);
    const handle = restored ?? (await pickDirectory(DIR_KEY));
    await adoptRoot(handle);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    $folderName.textContent = `folder error: ${String(err)}`;
    $folderName.classList.add('is-error');
    $folderName.classList.remove('is-connected');
  }
}

async function adoptRoot(handle: FileSystemDirectoryHandle): Promise<void> {
  root = handle;
  $folderName.textContent = `${handle.name}/suno/`;
  $folderName.classList.add('is-connected');
  $folderName.classList.remove('is-error');
  $pick.textContent = 'Change folder';
  setBusy(false);
  await reloadFromDisk();
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
    statsLine('Connect an intake folder to begin');
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
