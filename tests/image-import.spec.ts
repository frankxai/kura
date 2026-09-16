import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverExport, imageFormat, parseMetadata } from '../src/images/adapters';
import { importPilot, loadGallery, sha256, totals, validateReceipt } from '../src/images/importer';
import { safeParts } from '../src/images/disk';
import { IMAGE_ROOT, type ImageDisk, type Provider } from '../src/images/types';

// Synthetic PNG fixtures. These prove persistence, not access to a user's account.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=', 'base64');
function sample(name: string, suffix = '') { return new File([png, suffix], name, { type: 'image/png', lastModified: 1700000000000 }); }
async function* entries(files: File[]) { for (const file of files) yield { path: file.name, file }; }
const preview = async () => ({ thumbnail: new Blob([png]), width: 1, height: 1 });
let root: string, disk: ImageDisk;
test.beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'kura-image-test-'));
  disk = {
    async read(p) { try { return new Blob([await fs.readFile(path.join(root, ...safeParts(p)))]); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; } },
    async write(p, data) { const target = path.join(root, ...safeParts(p)); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, typeof data === 'string' ? data : Buffer.from(await data.arrayBuffer())); },
    async list(p) { try { return await fs.readdir(path.join(root, ...safeParts(p))); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; } },
  };
});
test.afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

for (const provider of ['midjourney', 'grok'] as Provider[]) {
  test(`${provider}: small import preserves exact bytes, metadata, totals, and repeat idempotency`, async () => {
    const file = sample(provider === 'grok' ? 'content' : 'my-image.png');
    const metadata = { prompt: 'A quiet archive', sourceId: 'job-123', model: 'exposed-model', seed: 42, settings: { quality: 1 }, createdAt: '2026-09-10T11:00:00Z', sourceUrl: `https://${provider === 'grok' ? 'grok.com' : 'www.midjourney.com'}/example`, originalUrl: null };
    const discovery = await discoverExport(provider, entries([file, new File([JSON.stringify(metadata)], `${file.name}.json`)]));
    expect(discovery.images).toHaveLength(1);
    expect(discovery.providerTotal).toBeNull();
    const first = await importPilot({ disk, discovery, images: discovery.images, preview });
    expect(totals(first)).toMatchObject({ discovered: 1, selected: 1, imported: 1, failed: 0, pending: 0 });
    const gallery = await loadGallery(disk);
    expect(gallery.errors).toEqual([]);
    expect(gallery.images[0]).toMatchObject({ ...metadata, kind: 'imported-image', provider, bytes: file.size });
    const stored = await disk.read(gallery.images[0].originalPath);
    expect(Buffer.from(await stored!.arrayBuffer())).toEqual(Buffer.from(await file.arrayBuffer()));
    expect(await sha256(stored!)).toBe(gallery.images[0].sha256);
    const second = await importPilot({ disk, discovery, images: discovery.images, preview });
    expect(totals(second)).toMatchObject({ imported: 0, skipped: 1, failed: 0 });
    expect((await loadGallery(disk)).images).toHaveLength(1);
    expect((await disk.list(`${IMAGE_ROOT}/${provider}/originals`))).toHaveLength(1);
  });
}

test('interrupted batch resumes after reopening without duplicating originals', async () => {
  const discovery = await discoverExport('grok', entries([sample('one.png'), sample('two.png', 'two'), sample('three.png', 'three')]));
  const abort = new AbortController();
  const first = await importPilot({ disk, discovery, images: discovery.images, preview, signal: abort.signal, onProgress(job) { if (totals(job).imported === 1) abort.abort(); } });
  expect(first.status).toBe('paused');
  expect(totals(first)).toMatchObject({ imported: 1, pending: 2 });
  const durable = JSON.parse(await (await disk.read(`${IMAGE_ROOT}/imports/${first.id}.json`))!.text());
  expect(durable.status).toBe('paused');
  const next = await importPilot({ disk, discovery, images: discovery.images, preview });
  expect(totals(next)).toMatchObject({ imported: 2, skipped: 1, pending: 0, failed: 0 });
  expect((await loadGallery(disk)).images).toHaveLength(3);
});

test('receipt failure after original write recovers without rewriting the original', async () => {
  const discovery = await discoverExport('midjourney', entries([sample('a.png')]));
  const write = disk.write.bind(disk);
  let crash = true, originalWrites = 0;
  disk.write = async (p, data) => { if (p.includes('/originals/')) originalWrites++; if (p.includes('/receipts/') && crash) throw new Error('Simulated power loss'); await write(p, data); };
  const first = await importPilot({ disk, discovery, images: discovery.images, preview });
  expect(totals(first).failed).toBe(1);
  crash = false;
  const next = await importPilot({ disk, discovery, images: discovery.images, preview });
  expect(totals(next).imported).toBe(1);
  expect(originalWrites).toBe(1);
});

test('failed item remains visible, other items finish, and retry skips successes', async () => {
  const discovery = await discoverExport('grok', entries([sample('good.png'), sample('bad.png', 'bad')]));
  const first = await importPilot({ disk, discovery, images: discovery.images, preview: async blob => { if (blob.size !== png.length) throw new Error('Decoder rejected image'); return preview(); } });
  expect(totals(first)).toMatchObject({ imported: 1, failed: 1 });
  expect(first.items.find(i => i.state === 'failed')?.error).toBe('Decoder rejected image');
  const next = await importPilot({ disk, discovery, images: discovery.images, preview });
  expect(totals(next)).toMatchObject({ imported: 1, skipped: 1, failed: 0 });
});

test('modified archives and malformed receipts fail closed without overwriting', async () => {
  const discovery = await discoverExport('grok', entries([sample('a.png')]));
  await importPilot({ disk, discovery, images: discovery.images, preview });
  const receipt = (await loadGallery(disk)).images[0];
  await disk.write(receipt.originalPath, 'user-edited');
  const next = await importPilot({ disk, discovery, images: discovery.images, preview });
  expect(totals(next).failed).toBe(1);
  expect(await (await disk.read(receipt.originalPath))!.text()).toBe('user-edited');
  expect(() => validateReceipt({ ...receipt, originalPath: '../../private' }, 'grok', receipt.sha256)).toThrow();
  expect(() => safeParts('../private')).toThrow();
  expect(() => safeParts('a\\b')).toThrow();
  expect(() => safeParts('/absolute')).toThrow();
});

test('unknown metadata stays unknown; invalid sidecar is retained and warned', async () => {
  const discovery = await discoverExport('grok', entries([sample('a-prompt_2026-01-01.png'), new File(['broken json'], 'a-prompt_2026-01-01.png.json')]));
  expect(discovery.images[0].metadata.prompt).toBeNull();
  expect(discovery.images[0].metadata.createdAt).toBeNull();
  expect(discovery.images[0].warnings).toHaveLength(1);
  await importPilot({ disk, discovery, images: discovery.images, preview });
  const receipt = (await loadGallery(disk)).images[0];
  expect(await (await disk.read(receipt.metadataPath!))!.text()).toBe('broken json');
  expect(parseMetadata({ sourceUrl: 'javascript:alert(1)', originalUrl: 'https://user:secret@host/image', createdAt: 'not a date' })).toMatchObject({ sourceUrl: null, originalUrl: null, createdAt: null });
});

test('discovery reconciles images, ignored files and failures with bounded scan', async () => {
  const result = await discoverExport('midjourney', entries([sample('a.png'), new File(['not png'], 'bad.png'), new File(['<svg/>'], 'unsafe.svg')]));
  expect(result.examined).toBe(3);
  expect(result.images.length + result.ignored + result.failures.length).toBe(result.examined);
  expect(result.failures[0].path).toBe('bad.png');
  const limit = await discoverExport('grok', entries(Array.from({ length: 2001 }, (_, i) => new File(['text'], `${i}.txt`))));
  expect(limit.examined).toBe(2000); expect(limit.complete).toBe(false);
  expect(imageFormat(new TextEncoder().encode('<svg></svg>'))).toBeNull();
});

test('pilot count gate is enforced in engine and does not write anything', async () => {
  const discovery = await discoverExport('grok', entries(Array.from({ length: 11 }, (_, i) => sample(`${i}.png`, String(i)))));
  await expect(importPilot({ disk, discovery, images: discovery.images, preview })).rejects.toThrow('1–10');
  expect(await fs.readdir(root)).toEqual([]);
});

test('duplicate bytes with different filenames produce one original and trace both source paths', async () => {
  const discovery = await discoverExport('grok', entries([sample('one.png'), sample('copy.png')]));
  const job = await importPilot({ disk, discovery, images: discovery.images, preview });
  expect(totals(job)).toMatchObject({ imported: 1, skipped: 1 });
  expect(new Set(job.items.map(i => i.receiptPath)).size).toBe(1);
  expect(job.items.map(i => i.path).sort()).toEqual(['copy.png', 'one.png']);
});
