import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

let context: BrowserContext;
let extensionUrl: string;
let webBrowser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const WEB_URL = process.env.KURA_WEB_URL;
const galleryUrl = () => WEB_URL || `${extensionUrl}/images.html`;
const DIST = path.resolve('dist');
test.beforeAll(async () => {
  if (WEB_URL) {
    webBrowser = await chromium.launch({ headless: true });
    context = await webBrowser.newContext();
    return;
  }
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-sandbox'],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionUrl = `chrome-extension://${worker.url().split('/')[2]}`;
});
test.afterAll(async () => { await context?.close(); await webBrowser?.close(); });

async function setup(page: Page, namespace = 'fixture') {
  await page.goto(galleryUrl());
  // Test-only directory picker: use actual browser filesystem handles in OPFS.
  // The production entrypoint still requires an explicit user-selected disk folder.
  await page.evaluate(async namespace => {
    const root = await navigator.storage.getDirectory();
    const source = await root.getDirectoryHandle(`${namespace}-source`, { create: true });
    const destination = await root.getDirectoryHandle(`${namespace}-vault`, { create: true });
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 12;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#93d6c5'; ctx.fillRect(0, 0, 16, 12);
    const image = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
    for (const [name, value] of [
      ['content', image],
      ['content.json', JSON.stringify({ prompt: 'Synthetic archive fixture', sourceId: 'fixture-only', createdAt: '2026-09-01T12:00:00Z' })],
    ] as const) {
      const stream = await (await source.getFileHandle(name, { create: true })).createWritable();
      await stream.write(value); await stream.close();
    }
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async (options: { mode: string }) => options.mode === 'read' ? source : destination });
  }, namespace);
}

test('pilot UI imports both providers, searches, opens details, and skips repeated files', async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await expect(page.getByRole('heading', { name: /Your images/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/gallery-empty.png', fullPage: true });
  await page.getByRole('button', { name: '＋ Import images', exact: true }).click();
  for (const provider of ['Midjourney', 'Grok']) {
    await page.getByRole('radio', { name: new RegExp(provider) }).check();
    await page.getByRole('button', { name: 'Choose export folder', exact: true }).click();
    await expect(page.locator('#scan-summary')).toContainText('1 images found');
    await page.screenshot({ path: `test-results/import-${provider.toLowerCase()}.png`, fullPage: true });
    await expect(page.getByRole('button', { name: 'Import selected images' })).toBeDisabled();
    if (provider === 'Midjourney') await page.locator('#destination').click();
    await page.locator('#admission').check();
    await page.getByRole('button', { name: 'Import selected images' }).click();
    await expect(page.locator('#progress-counts')).toContainText('1 imported · 0 already saved · 0 failed');
    await expect(page.locator('#run-import')).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Import selected images' }).click();
  await expect(page.locator('#progress-counts')).toContainText('0 imported · 1 already saved · 0 failed');
  await page.getByRole('button', { name: 'Close import', exact: true }).click();
  await expect(page.locator('.image-card')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/gallery-populated.png', fullPage: true });
  await page.getByRole('searchbox').fill('Synthetic archive');
  await expect(page.locator('.image-card')).toHaveCount(2);
  await page.getByLabel('Filter by provider').selectOption('grok');
  await expect(page.locator('.image-card')).toHaveCount(1);
  await page.locator('.image-card').click();
  await expect(page.locator('#detail-prompt')).toHaveText('Synthetic archive fixture');
  await expect(page.locator('#detail-metadata')).toContainText('fixture-only');
  const opened = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open original ↗' }).click();
  const original = await opened;
  await expect(page.locator('#detail-status')).toContainText('Original verified');
  await original.close();
  await page.keyboard.press('Escape');
  await page.getByRole('searchbox').fill('no match');
  await expect(page.getByRole('heading', { name: 'No images match these filters.' })).toBeVisible();
  expect(errors).toEqual([]);
  await page.close();
});

test('mobile-sized layout stays within viewport and import remains keyboard accessible', async () => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(galleryUrl());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => page.locator('.image-card img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'test-results/gallery-narrow.png', fullPage: true });
  await page.getByRole('button', { name: '＋ Import images', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bring your images home.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#import-dialog')).not.toBeVisible();
  await page.close();
});

test('a delayed preview cannot replace a newer selection or its original action', async () => {
  const page = await context.newPage();
  await setup(page, 'selection-race');
  await page.evaluate(async () => {
    const source = await (await navigator.storage.getDirectory()).getDirectoryHandle('selection-race-source');
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 10;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#c94255'; ctx.fillRect(0, 0, 20, 10);
    const image = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
    for (const [name, value] of [['second.png', image], ['second.png.json', JSON.stringify({ prompt: 'Second selection' })]] as const) {
      const stream = await (await source.getFileHandle(name, { create: true })).createWritable();
      await stream.write(value); await stream.close();
    }
  });
  await page.getByRole('button', { name: '＋ Import images', exact: true }).click();
  await page.getByRole('radio', { name: /Grok/ }).check();
  await page.getByRole('button', { name: 'Choose export folder', exact: true }).click();
  await expect(page.locator('#scan-summary')).toContainText('2 images found');
  await page.locator('#destination').click();
  await page.locator('#admission').check();
  await page.getByRole('button', { name: 'Import selected images' }).click();
  await expect(page.locator('#progress-counts')).toContainText('2 imported · 0 already saved · 0 failed');
  await expect(page.locator('#run-import')).toBeEnabled();
  await page.getByRole('button', { name: 'Close import', exact: true }).click();
  await expect(page.locator('.image-card')).toHaveCount(2);
  await expect.poll(() => page.locator('.image-card img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.evaluate(() => {
    const state = window as unknown as { releasePreview: () => void; previewWaiting: boolean; previewReleased: boolean; originalReads: string[] };
    state.originalReads = [];
    const original = FileSystemFileHandle.prototype.getFile;
    let delayNextPreview = true;
    FileSystemFileHandle.prototype.getFile = async function () {
      if (this.name.endsWith('.webp') && delayNextPreview) {
        delayNextPreview = false;
        state.previewWaiting = true;
        await new Promise<void>(resolve => { state.releasePreview = resolve; });
        const file = await original.call(this);
        state.previewReleased = true;
        return file;
      }
      if (this.name.endsWith('.png')) state.originalReads.push(this.name);
      return original.call(this);
    };
  });
  await page.locator('.image-card').filter({ hasText: 'Synthetic archive fixture' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { previewWaiting: boolean }).previewWaiting)).toBe(true);
  await page.getByRole('button', { name: 'Close image details', exact: true }).click();
  await page.locator('.image-card').filter({ hasText: 'Second selection' }).click();
  await expect(page.locator('#detail-prompt')).toHaveText('Second selection');
  await expect(page.locator('#detail-image')).toHaveAttribute('src', /^blob:/);
  const currentPreview = await page.locator('#detail-image').getAttribute('src');
  const expectedOriginal = (await page.locator('#detail-metadata dt').filter({ hasText: /^Original$/ }).locator('+ dd').innerText()).split('/').at(-1);
  await page.evaluate(() => (window as unknown as { releasePreview: () => void }).releasePreview());
  await expect.poll(() => page.evaluate(() => (window as unknown as { previewReleased: boolean }).previewReleased)).toBe(true);
  await expect(page.locator('#detail-image')).toHaveAttribute('src', currentPreview!);
  const opened = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open original ↗' }).click();
  const original = await opened;
  expect(await page.evaluate(() => (window as unknown as { originalReads: string[] }).originalReads.at(-1))).toBe(expectedOriginal);
  await original.close();
  await page.close();
});
