// ============================================================
// Kura — Vault writer
// Writes a WritePlan straight to a File System Access directory
// handle: text files first (fast), then remote media fetched at a
// polite cadence. Overwrites in place, so re-capturing a
// conversation produces the same tree — never duplicates.
// Runs in a Window context (offscreen document / side panel); the
// MV3 service worker cannot hold a directory handle.
// ============================================================

import { writeFile } from './fs';
import type { WritePlan } from './capture-plan';

export interface VaultWriteProgress {
  total: number;
  written: number;
  failed: number;
  current?: string;
}

export interface VaultWriteResult {
  written: number;
  failed: number;
  /** Media that could not be fetched (e.g. a CDN host outside host_permissions).
   *  The caller can retry these through chrome.downloads, which bypasses CORS. */
  failedMedia: { path: string; url: string }[];
}

const MEDIA_CADENCE_MS = 280;

/**
 * Persist every file in `plan` under `root`. Text is written synchronously in
 * order; media is fetched one-at-a-time with a small delay so a large capture
 * never hammers a CDN. A failed media fetch is collected rather than thrown —
 * the conversation markdown (the irreplaceable part) is always written.
 */
export async function writePlan(
  root: FileSystemDirectoryHandle,
  plan: WritePlan,
  onProgress?: (p: VaultWriteProgress) => void,
  signal?: AbortSignal,
): Promise<VaultWriteResult> {
  const total = plan.textFiles.length + plan.mediaFiles.length;
  let written = 0;
  let failed = 0;
  const failedMedia: { path: string; url: string }[] = [];

  const report = (current?: string) => onProgress?.({ total, written, failed, current });

  for (const file of plan.textFiles) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await writeFile(root, file.path.split('/'), file.content);
    written += 1;
    report(file.path);
  }

  for (const media of plan.mediaFiles) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(media.url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await writeFile(root, media.path.split('/'), blob);
      written += 1;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      failed += 1;
      failedMedia.push(media);
    }
    report(media.path);
    if (plan.mediaFiles.length > 1) {
      await new Promise((r) => setTimeout(r, MEDIA_CADENCE_MS));
    }
  }

  return { written, failed, failedMedia };
}
