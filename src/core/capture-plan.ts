// ============================================================
// Kura — Capture write-plan
// Turns a DetectionResult into a flat list of files destined for
// the vault. Pure (no IndexedDB, no chrome.*), so both the direct
// File System Access writer and the chrome.downloads fallback
// consume the same plan — and it can be unit-tested in isolation.
// ============================================================

import {
  exportConversationBundle,
  exportPrompts,
  renderMediaPromptSidecar,
} from './exporter';
import { assetName, buildSlug } from './frontmatter';
import type { DetectionResult, ExportOptions, MediaItem } from './types';

/** One text file to write, path relative to the vault root. */
export interface PlanTextFile {
  path: string;
  content: string;
}

/** One remote media asset to fetch and write, path relative to the vault root. */
export interface PlanMediaFile {
  path: string;
  url: string;
}

export interface WritePlan {
  textFiles: PlanTextFile[];
  mediaFiles: PlanMediaFile[];
  counts: { conversations: number; media: number; prompts: number };
  folders: string[];
}

/**
 * Build the complete set of vault files for a detection result, per
 * FORMAT_SPEC.md — conversation bundles, media assets routed into their
 * parent conversation folder (or `_loose/`), AI-media prompt sidecars, and
 * a loose-prompt collection. Paths are vault-relative; the caller decides
 * whether the root is a File System Access handle or `Kura/` under Downloads.
 */
export function buildWritePlan(
  detection: DetectionResult,
  options: ExportOptions,
): WritePlan {
  const textFiles: PlanTextFile[] = [];
  const mediaFiles: PlanMediaFile[] = [];
  const folders = new Set<string>();

  for (const conv of detection.conversations) {
    const bundle = exportConversationBundle(conv, options);
    folders.add(bundle.folder);
    for (const f of bundle.files) {
      textFiles.push({ path: f.path, content: f.content });
    }
  }

  let mediaCount = 0;
  for (const media of detection.media) {
    const parentSlug = inferParentSlug(media, detection);
    const ext = guessExt(media);
    const filename =
      sanitizeMediaFilename(media.filename) ||
      assetName(media.type === 'video' ? 'video' : 'img', mediaCount + 1, ext);

    const path = parentSlug
      ? `${media.platform}/${parentSlug}/assets/${filename}`
      : `${media.platform}/_loose/${filename}`;

    mediaFiles.push({ path, url: media.hdUrl || media.url });

    if (media.prompt && parentSlug) {
      const sidecar = renderMediaPromptSidecar(media, parentSlug, filename);
      textFiles.push({ path: sidecar.path, content: sidecar.content });
    }
    mediaCount += 1;
  }

  if (detection.prompts.length > 0) {
    const collection = exportPrompts(detection.prompts, 'markdown', detection.platform);
    textFiles.push({ path: `_index/${collection.filename}`, content: collection.content });
  }

  return {
    textFiles,
    mediaFiles,
    counts: {
      conversations: detection.conversations.length,
      media: detection.media.length,
      prompts: detection.prompts.length,
    },
    folders: Array.from(folders),
  };
}

/**
 * Best-effort association of a media item with a captured conversation. If the
 * scraper set `metadata.conversationId`, use it; otherwise fall back to the
 * first conversation of the same platform (e.g. a Grok Imagine gallery with no
 * parent thread).
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

/** Strip OS-reserved and control chars from a scraped media filename. */
export function sanitizeMediaFilename(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex -- intentional: strip OS-reserved + control chars
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 100)
  );
}
