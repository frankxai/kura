import type { ExportEntry } from './adapters';
import type { ImageDisk, Preview } from './types';

export function safeParts(path: string): string[] {
  const parts = path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[\\:\x00-\x1f]/.test(p))) { // eslint-disable-line no-control-regex
    throw new Error('Unsafe relative path');
  }
  return parts;
}

export function directoryDisk(root: FileSystemDirectoryHandle): ImageDisk {
  async function directory(parts: string[], create = false) {
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }
  return {
    async read(path) {
      const parts = safeParts(path);
      try { return await (await (await directory(parts.slice(0, -1))).getFileHandle(parts.at(-1)!)).getFile(); }
      catch (e) { if (e instanceof DOMException && e.name === 'NotFoundError') return null; throw e; }
    },
    async write(path, data) {
      const parts = safeParts(path);
      const handle = await (await directory(parts.slice(0, -1), true)).getFileHandle(parts.at(-1)!, { create: true });
      const stream = await handle.createWritable();
      try { await stream.write(data); await stream.close(); }
      catch (e) { await stream.abort().catch(() => {}); throw e; }
    },
    async list(path) {
      let dir: FileSystemDirectoryHandle;
      try { dir = await directory(safeParts(path)); }
      catch (e) { if (e instanceof DOMException && e.name === 'NotFoundError') return []; throw e; }
      const names: string[] = [];
      for await (const [name, entry] of (dir as DirectoryWithEntries).entries()) if (entry.kind === 'file') names.push(name);
      return names.sort();
    },
  };
}

interface DirectoryWithEntries extends FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

export async function* folderEntries(root: FileSystemDirectoryHandle, prefix = '', depth = 0): AsyncGenerator<ExportEntry> {
  if (depth > 30) throw new Error('Export nesting exceeds 30 folders; choose the image folder directly');
  for await (const [name, entry] of (root as DirectoryWithEntries).entries()) {
    if (name.startsWith('.') || name === '_image-library') continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'directory') yield* folderEntries(entry as FileSystemDirectoryHandle, path, depth + 1);
    else yield { path, file: await (entry as FileSystemFileHandle).getFile() };
  }
}

/** Decode before persistence; originals are copied byte-for-byte, only the preview is resized. */
export async function createPreview(blob: Blob): Promise<Preview> {
  const bitmap = await createImageBitmap(blob);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 100_000_000) throw new Error('Image dimensions exceed the pilot limit');
    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const thumbnail = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Thumbnail creation failed')), 'image/webp', 0.82));
    return { thumbnail, width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close(); }
}
