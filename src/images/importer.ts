import { IMAGE_ROOT, MAX_BATCH_BYTES, PILOT_LIMIT, type Checkpoint, type Discovery, type ImageDisk, type Preview, type Provider, type Receipt, type SourceImage } from './types';

export async function sha256(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const receiptPath = (provider: Provider, hash: string) => `${IMAGE_ROOT}/${provider}/receipts/${hash}.json`;
export function estimateBytes(images: SourceImage[]): number {
  return images.reduce((sum, i) => sum + i.file.size + (i.metadataFile?.size ?? 0) + 512 * 1024, 0);
}
export function totals(job: Checkpoint) {
  return {
    discovered: job.discovered, selected: job.selected,
    imported: job.items.filter(i => i.state === 'imported').length,
    skipped: job.items.filter(i => i.state === 'skipped').length,
    failed: job.items.filter(i => i.state === 'failed').length,
    pending: job.items.filter(i => i.state === 'pending').length,
  };
}
export function validateReceipt(value: unknown, provider: Provider, hash: string): Receipt {
  const r = value as Receipt;
  const base = `${IMAGE_ROOT}/${provider}`;
  if (!r || r.schemaVersion !== 1 || r.kind !== 'imported-image' || r.provider !== provider || r.sha256 !== hash || !/^[a-f0-9]{64}$/.test(hash)
    || !['png','jpg','webp','gif','avif'].includes(r.format)
    || r.originalPath !== `${base}/originals/${hash}.${r.format}`
    || r.thumbnailPath !== `${base}/thumbnails/${hash}.webp`
    || (r.metadataPath !== null && r.metadataPath !== `${base}/metadata/${hash}.json`)
    || !Number.isSafeInteger(r.bytes) || r.bytes <= 0 || typeof r.importedAt !== 'string'
    || typeof r.sourcePath !== 'string' || !Array.isArray(r.warnings)) throw new Error('Invalid image receipt; original left untouched');
  return r;
}

async function retry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (e) {
      // Only transient disk contention is retryable. Quota/permission/corruption require intervention.
      if (attempt >= 2 || !(e instanceof DOMException) || !['AbortError', 'InvalidStateError', 'NoModificationAllowedError'].includes(e.name)) throw e;
      await new Promise(resolve => setTimeout(resolve, 200 * 2 ** attempt));
    }
  }
}

async function preserve(disk: ImageDisk, path: string, blob: Blob): Promise<void> {
  const current = await disk.read(path);
  if (current) {
    if (await sha256(current) !== await sha256(blob)) throw new Error('Existing archive file differs; not overwritten');
    return;
  }
  await retry(() => disk.write(path, blob));
  const saved = await disk.read(path);
  if (!saved || await sha256(saved) !== await sha256(blob)) throw new Error('Read-back checksum failed');
}

export async function importPilot(options: {
  disk: ImageDisk; discovery: Discovery; images: SourceImage[];
  preview: (blob: Blob) => Promise<Preview>;
  signal?: AbortSignal; onProgress?: (job: Checkpoint) => void;
}): Promise<Checkpoint> {
  const { disk, discovery, images, preview, signal, onProgress = () => {} } = options;
  if (!images.length || images.length > PILOT_LIMIT) throw new Error(`Select 1–${PILOT_LIMIT} images for the pilot`);
  if (new Set(images.map(i => i.path)).size !== images.length || images.some(i => !discovery.images.includes(i))) throw new Error('Selection does not match this export');
  const estimatedBytes = estimateBytes(images);
  if (estimatedBytes > MAX_BATCH_BYTES) throw new Error('This pilot exceeds 200 MiB. Select fewer images');
  const id = crypto.randomUUID();
  const job: Checkpoint = {
    schemaVersion: 1, id, provider: discovery.provider, scope: discovery.scope,
    providerTotal: null, discovered: discovery.images.length, discoveryComplete: discovery.complete,
    selected: images.length, estimatedBytes, status: 'running', updatedAt: new Date().toISOString(),
    items: images.map(i => ({ path: i.path, state: 'pending' })),
  };
  async function checkpoint() {
    job.updatedAt = new Date().toISOString();
    await retry(() => disk.write(`${IMAGE_ROOT}/imports/${id}.json`, JSON.stringify(job, null, 2)));
    onProgress(structuredClone(job));
  }
  await checkpoint();
  // Concurrency 1 bounds memory and allows pause after the current atomic item.
  // Re-selection after restart reconciles receipts against disk; completed bytes are never duplicated.
  for (const [index, source] of images.entries()) {
    if (signal?.aborted) { job.status = 'paused'; break; }
    const item = job.items[index];
    try {
      const hash = await sha256(source.file);
      const path = receiptPath(discovery.provider, hash);
      const existing = await disk.read(path);
      if (existing) {
        const receipt = validateReceipt(JSON.parse(await existing.text()), discovery.provider, hash);
        const original = await disk.read(receipt.originalPath);
        if (!original || original.size !== receipt.bytes || await sha256(original) !== hash) throw new Error('Archived original missing or changed; restore it before retrying');
        item.state = 'skipped'; item.receiptPath = path;
      } else {
        const rendered = await preview(source.file);
        const base = `${IMAGE_ROOT}/${discovery.provider}`;
        const originalPath = `${base}/originals/${hash}.${source.format}`;
        const thumbnailPath = `${base}/thumbnails/${hash}.webp`;
        await preserve(disk, originalPath, source.file);
        await retry(() => disk.write(thumbnailPath, rendered.thumbnail));
        const metadataPath = source.metadataFile ? `${base}/metadata/${hash}.json` : null;
        if (metadataPath) await preserve(disk, metadataPath, source.metadataFile!);
        const receipt: Receipt = {
          ...source.metadata, schemaVersion: 1, kind: 'imported-image', provider: discovery.provider,
          sha256: hash, bytes: source.file.size, format: source.format,
          originalPath, thumbnailPath, metadataPath, sourcePath: source.path,
          sourceFileModifiedAt: new Date(source.file.lastModified).toISOString(), importedAt: new Date().toISOString(),
          width: rendered.width, height: rendered.height, warnings: source.warnings,
        };
        await retry(() => disk.write(path, JSON.stringify(receipt, null, 2)));
        item.state = 'imported'; item.receiptPath = path;
      }
    } catch (e) { item.state = 'failed'; item.error = e instanceof Error ? e.message : String(e); }
    await checkpoint();
  }
  if (job.status === 'running') job.status = 'finished';
  await checkpoint();
  return job;
}

export async function loadGallery(disk: ImageDisk): Promise<{ images: Receipt[]; errors: string[] }> {
  const images: Receipt[] = [], errors: string[] = [];
  for (const provider of ['midjourney', 'grok'] as const) {
    for (const name of await disk.list(`${IMAGE_ROOT}/${provider}/receipts`)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      try {
        const blob = await disk.read(`${IMAGE_ROOT}/${provider}/receipts/${name}`);
        if (!blob) throw new Error('Receipt disappeared');
        images.push(validateReceipt(JSON.parse(await blob.text()), provider, name.slice(0, -5)));
      } catch { errors.push(`${provider}/${name}: unreadable receipt`); }
    }
  }
  return { images: images.sort((a, b) => b.importedAt.localeCompare(a.importedAt)), errors };
}

export async function loadLatestImport(disk: ImageDisk): Promise<Checkpoint | null> {
  let latest: Checkpoint | null = null;
  for (const name of await disk.list(`${IMAGE_ROOT}/imports`)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
    const file = await disk.read(`${IMAGE_ROOT}/imports/${name}`);
    if (!file) continue;
    const job = JSON.parse(await file.text()) as Checkpoint;
    if (job.schemaVersion !== 1 || !['midjourney', 'grok'].includes(job.provider) || !Array.isArray(job.items)
      || job.selected !== job.items.length || job.items.length > PILOT_LIMIT || typeof job.updatedAt !== 'string'
      || job.items.some(i => typeof i.path !== 'string' || !['pending', 'imported', 'skipped', 'failed'].includes(i.state))) {
      throw new Error('An import checkpoint is invalid. Its file has been left untouched.');
    }
    if (!latest || latest.updatedAt < job.updatedAt) latest = job;
  }
  return latest;
}
