// ============================================================
// Kura — Suno Harvester engine
// Index → suno/catalog.jsonl · flags.json interchange ·
// cadenced flagged-track downloads via File System Access.
// Zero LLM tokens, zero auth — mechanics only.
// ============================================================

import { readJson, writeFile, writeJson } from '@/core/fs';
import { fetchCatalog } from './api';
import type { DownloadLedger, HarvestProgress, SunoFlags, SunoTrack } from './types';

const SUNO_DIR = 'suno';
const CATALOG = 'catalog.jsonl';
const FLAGS = 'flags.json';
const LEDGER = 'downloads.json';

// Human cadence: sequential downloads, 2.8s base + up to 3.7s jitter.
const CADENCE_BASE_MS = 2800;
const CADENCE_JITTER_MS = 3700;
/** Per-run safety cap on downloads. */
export const MAX_PER_RUN = 40;

export type ProgressFn = (p: HarvestProgress) => void;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'untitled';
}

function trackFilename(track: SunoTrack, ext: string): string {
  const date = (track.createdAt || track.indexedAt).slice(0, 10);
  return `${date}_${slugify(track.title)}_${track.id.slice(0, 8)}.${ext}`;
}

// ---------------------------------------------------------- catalog

/** Button 1 — Index: fetch the public catalog and rewrite catalog.jsonl. */
export async function indexCatalog(
  root: FileSystemDirectoryHandle,
  handle: string,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<SunoTrack[]> {
  onProgress({ phase: 'indexing', total: 0, completed: 0, failed: 0, message: 'Contacting Suno…' });

  const tracks = await fetchCatalog(
    handle,
    (fetched, total) =>
      onProgress({
        phase: 'indexing',
        total,
        completed: fetched,
        failed: 0,
        message: `Indexed ${fetched}${total ? ` of ${total}` : ''} tracks`,
      }),
    signal,
  );

  const jsonl = tracks.map((t) => JSON.stringify(t)).join('\n') + '\n';
  await writeFile(root, [SUNO_DIR, CATALOG], jsonl);

  onProgress({
    phase: 'done',
    total: tracks.length,
    completed: tracks.length,
    failed: 0,
    message: `catalog.jsonl · ${tracks.length} tracks`,
  });
  return tracks;
}

/** Read catalog.jsonl back from the intake folder (empty when missing). */
export async function readCatalog(root: FileSystemDirectoryHandle): Promise<SunoTrack[]> {
  try {
    const dir = await root.getDirectoryHandle(SUNO_DIR);
    const fileHandle = await dir.getFileHandle(CATALOG);
    const text = await (await fileHandle.getFile()).text();
    return text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as SunoTrack);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------- flags

export async function readFlags(root: FileSystemDirectoryHandle): Promise<SunoFlags> {
  return readJson<SunoFlags>(root, [SUNO_DIR, FLAGS], { version: 1, flags: {} });
}

export async function setFlag(
  root: FileSystemDirectoryHandle,
  trackId: string,
  value: { audio: boolean; video: boolean } | null,
): Promise<SunoFlags> {
  const flags = await readFlags(root);
  if (value === null) {
    delete flags.flags[trackId];
  } else {
    flags.flags[trackId] = { ...flags.flags[trackId], ...value };
  }
  await writeJson(root, [SUNO_DIR, FLAGS], flags);
  return flags;
}

// ---------------------------------------------------------- ledger

export async function readLedger(root: FileSystemDirectoryHandle): Promise<DownloadLedger> {
  return readJson<DownloadLedger>(root, [SUNO_DIR, LEDGER], {});
}

// ---------------------------------------------------------- fetch flagged

async function downloadTo(
  root: FileSystemDirectoryHandle,
  url: string,
  subdir: string,
  filename: string,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const blob = await res.blob();
  await writeFile(root, [SUNO_DIR, subdir, filename], blob);
  return `${SUNO_DIR}/${subdir}/${filename}`;
}

/**
 * Buttons 2 & 3 — Fetch flagged tracks at human cadence.
 * Audio always; video + cover when `includeVideo`. Skips anything already in
 * the ledger, so re-runs are idempotent. Sequential, jittered, cancellable.
 */
export async function fetchFlagged(
  root: FileSystemDirectoryHandle,
  catalog: SunoTrack[],
  includeVideo: boolean,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<{ completed: number; failed: number; skipped: number }> {
  const flags = await readFlags(root);
  const ledger = await readLedger(root);

  const wanted = catalog.filter((t) => {
    const flag = flags.flags[t.id];
    if (!flag || (!flag.audio && !flag.video)) return false;
    const done = ledger[t.id];
    const audioDone = !t.audioUrl || !!done?.audio;
    const videoDone = !includeVideo || !t.videoUrl || !!done?.video;
    return !(audioDone && videoDone);
  });

  const queue = wanted.slice(0, MAX_PER_RUN);
  const skipped = wanted.length - queue.length;
  let completed = 0;
  let failed = 0;

  for (const track of queue) {
    if (signal?.aborted) {
      onProgress({ phase: 'cancelled', total: queue.length, completed, failed });
      return { completed, failed, skipped };
    }

    onProgress({
      phase: 'downloading',
      total: queue.length,
      completed,
      failed,
      currentTitle: track.title,
    });

    const entry = ledger[track.id] ?? { audio: null, video: null, cover: null, at: '' };
    try {
      if (track.audioUrl && !entry.audio) {
        entry.audio = await downloadTo(root, track.audioUrl, 'audio', trackFilename(track, 'mp3'));
      }
      if (includeVideo && track.videoUrl && !entry.video) {
        entry.video = await downloadTo(root, track.videoUrl, 'video', trackFilename(track, 'mp4'));
      }
      if (includeVideo && track.imageUrl && !entry.cover) {
        entry.cover = await downloadTo(root, track.imageUrl, 'covers', trackFilename(track, 'jpeg'));
      }
      entry.at = new Date().toISOString();
      ledger[track.id] = entry;
      await writeJson(root, [SUNO_DIR, LEDGER], ledger);
      completed += 1;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        onProgress({ phase: 'cancelled', total: queue.length, completed, failed });
        return { completed, failed, skipped };
      }
      console.error('[Kura suno] download failed:', track.title, err);
      failed += 1;
    }

    try {
      await sleep(CADENCE_BASE_MS + Math.random() * CADENCE_JITTER_MS, signal);
    } catch {
      onProgress({ phase: 'cancelled', total: queue.length, completed, failed });
      return { completed, failed, skipped };
    }
  }

  onProgress({
    phase: 'done',
    total: queue.length,
    completed,
    failed,
    message:
      `Fetched ${completed}` +
      (failed ? ` · ${failed} failed` : '') +
      (skipped ? ` · ${skipped} deferred to next run (cap ${MAX_PER_RUN})` : ''),
  });
  return { completed, failed, skipped };
}
