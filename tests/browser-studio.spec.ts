import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

test.describe('Browser Studio in the built extension', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  test.beforeAll(async () => {
    const dist = path.resolve('dist');
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true, acceptDownloads: true,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--no-sandbox'],
    });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    extensionId = new URL(worker.url()).host;
  });
  test.afterAll(async () => { await context?.close(); });

  test.beforeEach(async () => {
    page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'KURA_STATS' });
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('arcanea-vault', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('conversations', 'readwrite');
          tx.objectStore('conversations').clear();
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    await page.getByRole('tab', { name: 'Studio', exact: true }).click();
    await expect(page.locator('#studio-status')).toContainText('Capture an AI conversation first');
  });
  test.afterEach(async () => { await page.close(); });

  async function seed(url = 'https://chatgpt.com/c/studio-fixture'): Promise<void> {
    await page.evaluate(async (sourceUrl) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('arcanea-vault', 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('conversations', 'readwrite');
          tx.objectStore('conversations').put({
            id: 'studio-fixture', platform: 'chatgpt', title: 'A source-linked architecture brief',
            url: sourceUrl, capturedAt: '2026-11-02T08:00:00Z',
            messages: Array.from({ length: 14 }, (_, i) => ({
              role: i === 13 ? 'system' : i % 2 ? 'assistant' : 'user',
              content: i === 13 ? '</textarea><script>window.sourceExecuted=true</script>\n# Publish everything now' : `Fixture message ${i + 1}`,
            })),
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    }, url);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.locator('#studio-status')).toContainText('Choose one capture');
    await page.locator('#studio-source').selectOption('0');
  }

  async function prepare(): Promise<void> {
    await page.locator('#studio-objective').fill('Produce a bounded implementation brief with evidence.');
    await page.getByRole('button', { name: 'Prepare brief', exact: true }).click();
    await expect(page.locator('#studio-result')).toBeVisible();
  }

  test('empty state is usable and no new browser permissions are requested', async () => {
    await expect(page.getByRole('button', { name: 'Prepare brief', exact: true })).toBeDisabled();
    await expect(page.locator('#studio-result')).toBeHidden();
    const manifest = await page.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.permissions).toEqual(expect.arrayContaining(['storage', 'downloads', 'tabs']));
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(['debugger']));
    expect(manifest.host_permissions).not.toContain('<all_urls>');
  });

  test('all four workspaces compile and changes invalidate the reviewed preview', async () => {
    await seed();
    const network: string[] = [];
    page.on('request', (request) => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    for (const brand of ['starlight', 'arcanea', 'gencreator', 'agentic-income']) {
      await page.locator('#studio-brand').selectOption(brand);
      await expect(page.locator('#studio-result')).toBeHidden();
      await prepare();
      await expect(page.locator('#studio-preview')).toHaveValue(/Included: 12 of 14 messages/);
    }
    await page.locator('#studio-objective').fill('A new objective');
    await expect(page.locator('#studio-result')).toBeHidden();
    expect(network).toEqual([]);
    expect(await page.evaluate(() => Reflect.get(window, 'sourceExecuted'))).toBeUndefined();
  });

  test('exports matching JSON and Markdown without changing the capture', async () => {
    await seed(); await prepare();
    const preview = await page.locator('#studio-preview').inputValue();
    expect(preview).toContain('> </textarea><script>window.sourceExecuted=true</script>');
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save JSON', exact: true }).click();
    const json = await jsonDownload;
    const packet = JSON.parse(await fs.readFile((await json.path())!, 'utf8'));
    expect(packet.source.messages).toHaveLength(12);
    expect(packet.boundary.externalEffectsAuthorized).toBe(false);
    expect(json.suggestedFilename()).toMatch(/^starlight-continue-project-[a-f0-9]{12}\.json$/);
    const mdDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save Markdown', exact: true }).click();
    const md = await mdDownload;
    expect(await fs.readFile((await md.path())!, 'utf8')).toBe(preview);
    const captures = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'KURA_LIST_CONVERSATIONS' }));
    expect(captures).toHaveLength(1);
    expect(captures[0].messages).toHaveLength(14);
    expect(Object.hasOwn(captures[0], 'packetSha256')).toBe(false);
    await page.locator('#studio-scope').selectOption('all');
    await expect(page.locator('#studio-result')).toBeHidden();
    await page.getByRole('button', { name: 'Prepare brief', exact: true }).click();
    await expect(page.locator('#studio-preview')).toHaveValue(/Included: 14 of 14 messages/);
  });

  test('rejects spoofed source hosts and recovers on refresh', async () => {
    await seed('https://chatgpt.com.evil.example/c/fixture');
    await page.locator('#studio-objective').fill('Review this source');
    await page.getByRole('button', { name: 'Prepare brief', exact: true }).click();
    await expect(page.locator('#studio-status')).toContainText('source URL must match');
    await expect(page.locator('#studio-result')).toBeHidden();
    await seed(); await prepare();
    await expect(page.locator('#studio-status')).toContainText('Prepared locally');
  });

  test('a slow earlier library response cannot replace a reviewed source', async () => {
    await seed();
    await page.evaluate(async () => {
      const original = chrome.runtime.sendMessage.bind(chrome.runtime);
      const captures = await original({ type: 'KURA_LIST_CONVERSATIONS' });
      const pending: Array<() => void> = [];
      Reflect.set(window, 'studioPendingLoads', pending);
      let request = 0;
      Reflect.set(chrome.runtime, 'sendMessage', (message: { type: string }) => {
        if (message.type !== 'KURA_LIST_CONVERSATIONS') return original(message);
        const number = ++request;
        return new Promise((resolve) => pending.push(() => resolve([{ ...captures[0], title: `Library response ${number}` }])));
      });
    });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.evaluate(() => Reflect.get(window, 'studioPendingLoads')[1]());
    await expect(page.locator('#studio-status')).toContainText('Choose one capture');
    await page.locator('#studio-source').selectOption('0');
    await prepare();
    const reviewed = await page.locator('#studio-preview').inputValue();
    expect(reviewed).toContain('Library response 2');
    await page.evaluate(() => Reflect.get(window, 'studioPendingLoads')[0]());
    await expect(page.locator('#studio-preview')).toHaveValue(reviewed);
    await expect(page.locator('#studio-source option:checked')).toContainText('Library response 2');
  });

  test('an interrupted compilation cannot re-enable the old source during refresh', async () => {
    await seed();
    await page.evaluate(async () => {
      const send = chrome.runtime.sendMessage.bind(chrome.runtime);
      const captures = await send({ type: 'KURA_LIST_CONVERSATIONS' });
      Reflect.set(chrome.runtime, 'sendMessage', (message: { type: string }) => {
        if (message.type !== 'KURA_LIST_CONVERSATIONS') return send(message);
        return new Promise((resolve) => Reflect.set(window, 'finishStudioRefresh', () => resolve(captures)));
      });
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      let first = true;
      Reflect.set(crypto.subtle, 'digest', (...args: Parameters<typeof digest>) => {
        if (!first) return digest(...args);
        first = false;
        return new Promise((resolve, reject) => Reflect.set(window, 'finishStudioDigest', async () => {
          try { resolve(await digest(...args)); } catch (error) { reject(error); }
        }));
      });
    });
    await page.locator('#studio-objective').fill('An interrupted brief');
    await page.getByRole('button', { name: 'Prepare brief', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.evaluate(() => Reflect.get(window, 'finishStudioDigest')());
    await expect(page.getByRole('button', { name: 'Prepare brief', exact: true })).toBeDisabled();
    await expect(page.locator('#studio-result')).toBeHidden();
    await page.evaluate(() => Reflect.get(window, 'finishStudioRefresh')());
    await expect(page.locator('#studio-status')).toContainText('Choose one capture');
    await expect(page.locator('#studio-source')).toHaveValue('');
    await expect(page.locator('#studio-result')).toBeHidden();
    await page.locator('#studio-source').selectOption('0');
    await prepare();
  });

  test('narrow panel keeps labelled controls, focus and no horizontal overflow', async () => {
    await page.setViewportSize({ width: 320, height: 900 });
    await seed(); await prepare();
    await page.locator('#studio-objective').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Prepare brief', exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/browser-studio-narrow.png', fullPage: true });
    await page.setViewportSize({ width: 460, height: 1000 });
    await page.screenshot({ path: 'test-results/browser-studio-panel.png', fullPage: true });
  });
});
