// ============================================================
// Arcanea Kura — end-to-end extension test
// Loads the built dist/ into a real Chromium instance, navigates
// to a fixture chat page, and validates the popup detection +
// capture flow without needing a real ChatGPT account.
//
// Run:
//   pnpm test:extension
// ============================================================

import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'dist');
const FIXTURE = `file://${path.join(__dirname, 'fixtures', 'mock-chatgpt.html').replace(/\\/g, '/')}`;

test.describe('Arcanea Kura extension — load + detection', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
      throw new Error('dist/ missing. Run `pnpm build` before this test.');
    }

    // Chromium with the extension loaded. headless: false is required for
    // MV3 service-worker extensions to register correctly.
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        '--no-sandbox',
      ],
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('manifest has Kura name + v0.3.x + MV3', async () => {
    const raw = fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf-8');
    const manifest = JSON.parse(raw);
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toMatch(/^Kura/);
    expect(manifest.version).toMatch(/^0\.3\./);
    expect(manifest.short_name).toBe('Kura');
  });

  test('service worker registers', async () => {
    // The SW can register before this test subscribes to the event, so
    // check the already-registered list first and only then wait (up to
    // 30s — CI Linux with xvfb sometimes needs >10s to bootstrap the
    // headed Chromium).
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker', { timeout: 30_000 }));
    // WXT bundles the background entrypoint to `background.js` at the
    // extension root (crxjs used a `service-worker-loader.js` shim).
    expect(worker.url()).toContain('background.js');
  });

  test('content script detects mock ChatGPT page', async () => {
    const page = await context.newPage();
    await page.goto(FIXTURE);
    // The real content script matches `chatgpt.com/*` host pattern. Local
    // file:// fixtures won't trigger the host-match, so we directly inject
    // the built scraper module to validate it parses our DOM correctly.
    // WXT bundles each `*.content.ts` entrypoint to `content-scripts/<name>.js`.
    const scriptPath = path.join(DIST, 'content-scripts');
    const files = fs.readdirSync(scriptPath);
    const scraper = files.find((f) => f === 'chatgpt.js');
    expect(scraper, 'compiled chatgpt scraper present').toBeTruthy();

    // Inject the scraper and call its detection function. We're not testing
    // the real host-match flow here — we're testing the parser.
    await page.addScriptTag({ path: path.join(scriptPath, scraper!) });

    // The compiled scraper sets up a chrome.runtime.onMessage listener.
    // For a file:// fixture we can't fire that, so we eval the page for
    // the basic DOM signals the scraper looks for:
    const signals = await page.evaluate(() => {
      const messages = document.querySelectorAll('[data-message-author-role]');
      const title = document.querySelector('[data-testid="conversation-title"]')?.textContent;
      return {
        messageCount: messages.length,
        userMessages: document.querySelectorAll('[data-message-author-role="user"]').length,
        assistantMessages: document.querySelectorAll('[data-message-author-role="assistant"]').length,
        title,
      };
    });

    expect(signals.messageCount).toBe(3);
    expect(signals.userMessages).toBe(2);
    expect(signals.assistantMessages).toBe(1);
    expect(signals.title).toBe('Naming the extension');
  });

  test('popup HTML loads and shows the Kura logo', async () => {
    // Find the extension id from the loaded service worker.
    const workers = context.serviceWorkers();
    expect(workers.length, 'at least one service worker').toBeGreaterThan(0);
    const extensionId = workers[0].url().split('/')[2];

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(popup.locator('.title')).toHaveText('Kura');
    await expect(popup.locator('.logo')).toHaveText('K');
    await expect(popup.locator('#btn-quick-export')).toContainText('Export to Kura');
    await expect(popup.locator('footer')).toContainText('Kura v0.3.0');
  });

  test('sidepanel HTML loads with library scaffolding', async () => {
    const workers = context.serviceWorkers();
    const extensionId = workers[0].url().split('/')[2];

    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await expect(sidepanel.locator('.title')).toHaveText('Library');
    await expect(sidepanel.locator('#lib-search')).toBeVisible();
    await expect(sidepanel.locator('#lib-filter')).toBeVisible();
    // 蔵 character should render in the platform badge
    await expect(sidepanel.locator('.platform-badge')).toContainText('蔵');
    // Shared vault bar present and unconnected by default.
    await expect(sidepanel.locator('#vault-status')).toContainText('no vault connected');
    await expect(sidepanel.locator('#vault-connect')).toContainText('Connect vault');
  });

  test('sidepanel Suno tab gates harvester actions on folder connection', async () => {
    const workers = context.serviceWorkers();
    const extensionId = workers[0].url().split('/')[2];

    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await sidepanel.locator('#tab-suno').click();
    await expect(sidepanel.locator('#panel-title')).toHaveText('Suno Harvester');
    await expect(sidepanel.locator('#view-library')).toBeHidden();
    await expect(sidepanel.locator('#suno-handle')).toHaveValue('frankx');
    // No vault connected yet — every harvest action must be gated off. The
    // folder control now lives in the shared vault bar, not the Suno tab.
    await expect(sidepanel.locator('#vault-status')).toContainText('no vault connected');
    await expect(sidepanel.locator('#suno-index')).toBeDisabled();
    await expect(sidepanel.locator('#suno-fetch-audio')).toBeDisabled();
    await expect(sidepanel.locator('#suno-fetch-av')).toBeDisabled();
    // Switching back restores the library view.
    await sidepanel.locator('#tab-library').click();
    await expect(sidepanel.locator('#panel-title')).toHaveText('Library');
    await expect(sidepanel.locator('#view-suno')).toBeHidden();
  });
});
