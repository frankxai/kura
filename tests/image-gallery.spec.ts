import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

let context: BrowserContext;
let extensionUrl: string;
const DIST = path.resolve('dist');
test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-sandbox'],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionUrl = `chrome-extension://${worker.url().split('/')[2]}`;
});
test.afterAll(async () => { await context?.close(); });

async function setup(page: Page) {
  await page.goto(`${extensionUrl}/images.html`);
  // Test-only directory picker: use actual browser filesystem handles in OPFS.
  // The production entrypoint still requires an explicit user-selected disk folder.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const source = await root.getDirectoryHandle('fixture-source', { create: true });
    const destination = await root.getDirectoryHandle('fixture-vault', { create: true });
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
  });
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
  await page.goto(`${extensionUrl}/images.html`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/gallery-narrow.png', fullPage: true });
  await page.getByRole('button', { name: '＋ Import images', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bring your images home.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#import-dialog')).not.toBeVisible();
  await page.close();
});
