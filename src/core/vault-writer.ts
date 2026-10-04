// ============================================================
// Kura — Vault writer
// Writes a WritePlan straight to a File System Access directory
// handle: text files first (fast), then remote media fetched at a
// polite cadence. Overwrites in place, so re-capturing a
// conversation produces the same tree — never duplicates.
// Runs in a Window context (offscreen document / side panel); the
// MV3 service worker cannot hold a directory handle.
// ============================================================

import { getDir, writeFile } from './fs';
import { mergeRecapture, captureIdentity } from './recapture';
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
  folderMap: Record<string, string>;
}

const MEDIA_CADENCE_MS = 280;
const PLATFORMS = new Set(['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity', '_index']);
const MEDIA_HOSTS = new Set(['grok.com', 'assets.grok.com', 'imagine-public.x.ai', 'chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'aistudio.google.com', 'chat.deepseek.com', 'www.perplexity.ai']);

function validatePath(path: string) {
  const parts = path.split('/');
  if (!PLATFORMS.has(parts[0]) || parts.length < 2 || parts.some((part) => !part || part === '.' || part === '..' || part.includes('\\') || part.includes(':') || [...part].some((char) => char.charCodeAt(0) < 32))) {
    throw new Error('Invalid capture path.');
  }
}

function renderedBody(note: string) {
  return note.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

function stablePacket(packet: string) {
  const value = JSON.parse(packet);
  return JSON.stringify({ id: value.capture?.id, platform: value.capture?.platform, title: value.capture?.title, source: value.capture?.source, messages: value.messages });
}

async function readText(root: FileSystemDirectoryHandle, parts: string[]): Promise<string | null> {
  try {
    let dir = root;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    return await (await (await dir.getFileHandle(parts[parts.length - 1])).getFile()).text();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

async function reconcileFolders(root: FileSystemDirectoryHandle, original: WritePlan) {
  const folderMap: Record<string, string> = {};
  for (const file of original.textFiles.filter((item) => item.path.endsWith('/conversation.md'))) {
    const [platform, slug] = file.path.split('/');
    const wanted = `${platform}/${slug}`;
    const id = captureIdentity(file.content);
    const existing = await readText(root, file.path.split('/'));
    if (existing !== null && captureIdentity(existing) === id) continue;
    const directory = await getDir(root, [platform]);
    // Test adapters may provide only the minimal write surface. Real browser
    // handles enumerate the bounded selected platform when its index is lost.
    const entries = (directory as FileSystemDirectoryHandle & { entries?: () => AsyncIterableIterator<[string, FileSystemHandle]> }).entries;
    if (!entries) continue;
    const occupied = new Set<string>();
    let found: string | undefined;
    for await (const [name, handle] of entries.call(directory)) {
      if (handle.kind !== 'directory') continue;
      occupied.add(name);
      if (occupied.size > 10_000) throw new Error('Capture folder exceeds the 10000-thread reconciliation limit.');
      if (!/^\d{4}-\d{2}-\d{2}_[a-z0-9-]+$/.test(name)) continue;
      let candidateId: string | undefined;
      try {
        const note = await (await (await (handle as FileSystemDirectoryHandle).getFileHandle('conversation.md')).getFile()).slice(0, 65536).text();
        try { candidateId = captureIdentity(note); } catch { /* unknown occupied folder is preserved */ }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
        const packet = await readText(root, [platform, name, 'capture.json']);
        try { candidateId = packet ? JSON.parse(packet).capture?.id : undefined; } catch { /* interrupted packet remains preserved */ }
      }
      if (candidateId === id) {
        if (found) throw new Error('Duplicate capture identities on disk. Reconcile those folders before saving.');
        found = name;
      }
    }
    let target = found ?? slug;
    if (!found) {
      for (let suffix = 2; occupied.has(target); suffix++) target = `${slug}-${suffix}`;
    }
    if (target !== slug) folderMap[wanted] = `${platform}/${target}`;
  }
  const relocate = (path: string) => {
    const from = Object.keys(folderMap).find((folder) => path.startsWith(`${folder}/`));
    return from ? `${folderMap[from]}${path.slice(from.length)}` : path;
  };
  const plan: WritePlan = {
    ...original,
    textFiles: original.textFiles.map((file) => ({ ...file, path: relocate(file.path), content: file.path.endsWith('.md') && relocate(file.path) !== file.path ? file.content.replace(/^slug:[^\n]*$/m, `slug: ${relocate(file.path).split('/')[1]}`) : file.content })),
    mediaFiles: original.mediaFiles.map((file) => ({ ...file, path: relocate(file.path) })),
  };
  return { plan, folderMap };
}

/**
 * Persist every file in `plan` under `root`. Text is written synchronously in
 * order; media is fetched one-at-a-time with a small delay so a large capture
 * never hammers a CDN. A failed media fetch is collected rather than thrown —
 * the conversation markdown (the irreplaceable part) is always written.
 */
export async function writePlan(
  root: FileSystemDirectoryHandle,
  incomingPlan: WritePlan,
  onProgress?: (p: VaultWriteProgress) => void,
  signal?: AbortSignal,
): Promise<VaultWriteResult> {
  if (!Array.isArray(incomingPlan.textFiles) || !Array.isArray(incomingPlan.mediaFiles)) throw new Error('Invalid capture plan.');
  for (const file of [...incomingPlan.textFiles, ...incomingPlan.mediaFiles]) validatePath(file.path);
  const { plan, folderMap } = await reconcileFolders(root, incomingPlan);
  const total = plan.textFiles.length + plan.mediaFiles.length;
  let written = 0;
  let failed = 0;
  const failedMedia: { path: string; url: string }[] = [];

  const report = (current?: string) => onProgress?.({ total, written, failed, current });

  // Validate and preserve existing sources before writing any companion. A new
  // packet is written before Markdown, so interruption cannot silently create
  // a new capture that falls back to the conservative legacy role parser.
  const replacements = new Map<string, string>();
  const unchangedFolders = new Set<string>();
  for (const file of plan.textFiles.filter((item) => item.path.endsWith('/conversation.md'))) {
    const parts = file.path.split('/');
    const folder = parts.slice(0, -1).join('/');
    const existing = await readText(root, parts);
    if (existing === null) continue;
    const merged = mergeRecapture(existing, file.content);
    replacements.set(file.path, merged);
    const priorPacket = await readText(root, [...parts.slice(0, -1), 'capture.json']);
    const nextPacket = plan.textFiles.find((item) => item.path === `${folder}/capture.json`);
    try {
      if (priorPacket && nextPacket && JSON.parse(priorPacket).renderedBody === renderedBody(existing) && stablePacket(priorPacket) === stablePacket(nextPacket.content)) {
        unchangedFolders.add(folder);
        continue;
      }
    } catch { /* preserve malformed old packets as evidence, then repair */ }
    if (existing !== merged) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${existing}\u0000${priorPacket ?? ''}`));
      const key = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('').slice(0, 32);
      const history = [...parts.slice(0, -1), '_history', key];
      await writeFile(root, [...history, 'conversation.md'], existing);
      if (priorPacket) await writeFile(root, [...history, 'capture.json'], priorPacket);
    }
  }

  const ordered = [...plan.textFiles].sort((a, b) => Number(!a.path.endsWith('/capture.json')) - Number(!b.path.endsWith('/capture.json')));
  for (const file of ordered) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if ([...unchangedFolders].some((folder) => file.path.startsWith(`${folder}/`))) continue;
    await writeFile(root, file.path.split('/'), replacements.get(file.path) ?? file.content);
    written += 1;
    report(file.path);
  }

  for (const media of plan.mediaFiles) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const url = new URL(media.url);
      if (url.protocol !== 'https:' || !MEDIA_HOSTS.has(url.hostname) || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Unsupported media source.');
      const res = await fetch(media.url, { signal, redirect: 'error' });
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

  return { written, failed, failedMedia, folderMap };
}
