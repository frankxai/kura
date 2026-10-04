import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

// CI-owned browser, synthetic public fixtures. Never loads the user's profile.
test.describe('Chat library in real Chromium', () => {
  let context: BrowserContext;
  let panel: Page;
  let chat: Page;
  const url = 'https://chatgpt.com/c/library-fixture';
  test.beforeAll(async () => {
    await mkdir('test-results', { recursive: true });
    const dist = path.resolve('dist');
    context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
    await context.route('https://chatgpt.com/**', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><html><title>Open newsletter draft</title><body><textarea aria-label="Draft">Keep my draft</textarea></body></html>' }));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    chat = await context.newPage();
    await chat.goto(url);
    panel = await context.newPage();
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await panel.evaluate(async chatUrl => {
      const conversations = [
        { id: 'fixture1', platform: 'chatgpt', title: 'Newsletter planning', url: chatUrl,
          capturedAt: new Date().toISOString(), tags: ['publishing'],
          messages: [{ role: 'user', content: 'A saved decision about Resend and Vercel.' }] },
        { id: 'fixture2', platform: 'claude', title: '<img src=x onerror=alert(1)>', url: 'https://claude.ai/chat/synthetic-fixture',
          capturedAt: '2026-08-01T12:00:00Z', tags: [], messages: [{ role: 'assistant', content: 'A historical Claude proposal.' }] },
      ];
      await chrome.runtime.sendMessage({ type: 'KURA_SAVE', detection: { conversations, media: [], prompts: [] } });
    }, url);
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  });
  test.afterAll(async () => { await context?.close(); });

  test('find saved text and tags, merge the open thread, resume without losing its draft', async () => {
    await panel.getByRole('searchbox', { name: 'Search chats' }).fill('resend publishing');
    await expect(panel.locator('.chat-row')).toHaveCount(1);
    await expect(panel.locator('.chat-row')).toContainText('Newsletter planning');
    await expect(panel.locator('.chat-row')).toContainText('Open · Saved');
    await expect(panel.locator('.chat-excerpt')).toContainText('Resend');
    await panel.getByRole('button', { name: 'Resume Newsletter planning', exact: true }).click();
    await expect(panel.locator('#lib-status')).toContainText('Your draft stays');
    expect(chat.url()).toBe(url);
    await expect(chat.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep my draft');
    const tabs = await panel.evaluate(async chatUrl => chrome.tabs.query({ url: chatUrl }), url);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].active).toBe(true);
  });
  test('provider, source and date filters are honest; saved titles render as inert text', async () => {
    await panel.getByRole('searchbox', { name: 'Search chats' }).fill('');
    await panel.getByRole('combobox', { name: 'Filter by platform' }).selectOption('claude');
    await expect(panel.locator('.chat-row')).toHaveCount(1);
    await expect(panel.locator('.lib-item-title')).toContainText('<img src=x onerror=alert(1)>');
    expect(await panel.locator('.chat-row img').count()).toBe(0);
    await panel.getByRole('combobox', { name: 'Filter by source' }).selectOption('open');
    await expect(panel.locator('.chat-row')).toHaveCount(0);
    await expect(panel.locator('#lib-empty')).toContainText('second-brain archive is not connected');
    await panel.getByRole('combobox', { name: 'Filter by source' }).selectOption('saved');
    await panel.getByRole('combobox', { name: 'Filter by capture date' }).selectOption('7');
    await expect(panel.locator('.chat-row')).toHaveCount(0);
    await panel.getByRole('combobox', { name: 'Filter by platform' }).selectOption('');
    await panel.getByRole('combobox', { name: 'Filter by capture date' }).selectOption('');
    await panel.getByRole('combobox', { name: 'Filter by source' }).selectOption('all');
  });
  test('keyboard tabs, visible focus, 320px width, reduced motion and touch targets', async ({}, testInfo) => {
    await panel.setViewportSize({ width: 320, height: 820 });
    await panel.emulateMedia({ reducedMotion: 'no-preference' });
    expect(await panel.getByRole('tab', { name: 'Chats', exact: true }).evaluate(e => getComputedStyle(e, '::after').transitionDuration)).toBe('0s');
    await panel.getByRole('tab', { name: 'Chats', exact: true }).focus();
    await panel.getByRole('tab', { name: 'Chats', exact: true }).press('ArrowRight');
    await expect(panel.getByRole('tab', { name: 'Cockpit', exact: true })).toBeFocused();
    await panel.getByRole('tab', { name: 'Cockpit', exact: true }).press('Home');
    await expect(panel.getByRole('tab', { name: 'Chats', exact: true })).toBeFocused();
    await expect(panel.locator('.chat-row')).toHaveCount(2);
    await expect(panel.locator('#lib-list')).toHaveAttribute('aria-busy', 'false');
    await expect(panel.getByRole('button', { name: 'Show more chats', exact: true })).toBeHidden();
    await panel.emulateMedia({ reducedMotion: 'reduce' });
    const measurements = await panel.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')].filter(e => {
        const rect = e.getBoundingClientRect();
        return rect.width && (rect.right > innerWidth || rect.left < 0);
      }).map(e => ({ tag: e.tagName, id: e.id, className: e.className, right: e.getBoundingClientRect().right })),
      outline: getComputedStyle(document.activeElement!).outlineStyle,
      rows: [...document.querySelectorAll('.chat-row')].map(e => getComputedStyle(e).transitionDuration),
      targets: [...document.querySelectorAll('.chat-resume')].map(e => e.getBoundingClientRect().height),
    }));
    await testInfo.attach('chat-library-narrow.png', { body: await panel.screenshot({ fullPage: true, path: 'test-results/chat-library-narrow.png' }), contentType: 'image/png' });
    expect(measurements.overflow, JSON.stringify(measurements)).toBe(false);
    expect(measurements.outline).toBe('solid');
    expect(measurements.rows.every(d => d === '0s')).toBe(true);
    expect(measurements.targets.every(height => height >= 44)).toBe(true);
    await panel.setViewportSize({ width: 480, height: 820 });
    await testInfo.attach('chat-library-wide.png', { body: await panel.screenshot({ fullPage: true, path: 'test-results/chat-library-wide.png' }), contentType: 'image/png' });
  });
  test('rapid query changes and panel switches leave the latest query in place', async () => {
    await panel.getByRole('searchbox', { name: 'Search chats' }).fill('claude');
    await panel.getByRole('searchbox', { name: 'Search chats' }).fill('resend');
    await panel.getByRole('tab', { name: 'Cockpit', exact: true }).click();
    await panel.getByRole('tab', { name: 'Chats', exact: true }).click();
    await expect(panel.getByRole('searchbox', { name: 'Search chats' })).toHaveValue('resend');
    await expect(panel.locator('.chat-row')).toHaveCount(1);
    await expect(panel.locator('.chat-row')).toContainText('Newsletter planning');
    await expect(panel.locator('#lib-list')).toHaveAttribute('aria-busy', 'false');
  });
  test('closed source becomes a saved result and never submits a prompt', async () => {
    await chat.close();
    await expect(panel.getByRole('button', { name: 'Open source for Newsletter planning', exact: true })).toBeVisible();
    await expect(panel.locator('.chat-row')).not.toContainText('Open · Saved');
    const state = await panel.evaluate(async () => {
      const db = await new Promise<IDBDatabase>(resolve => {
        const request = indexedDB.open('arcanea-vault', 1);
        request.onsuccess = () => resolve(request.result);
      });
      const value = await new Promise(resolve => {
        const request = db.transaction('conversations').objectStore('conversations').get('fixture1');
        request.onsuccess = () => resolve(request.result);
      });
      db.close();
      return value;
    });
    expect(state).toMatchObject({ tags: ['publishing'], messages: [{ role: 'user', content: 'A saved decision about Resend and Vercel.' }] });
  });

  test('a late older reply cannot replace the latest results; failed lookup can retry', async () => {
    await panel.evaluate(() => {
      const original = chrome.runtime.sendMessage.bind(chrome.runtime);
      const state = { started: false, finished: false, fail: false };
      Object.assign(window, { libraryTest: state, originalSendMessage: original });
      chrome.runtime.sendMessage = (async (message: { type: string; query?: { query?: string } }) => {
        if (message.type === 'STARLIGHT_LIBRARY_SEARCH' && message.query?.query === 'historical') {
          const result = await original(message);
          state.started = true;
          await new Promise(resolve => setTimeout(resolve, 800));
          state.finished = true;
          return result;
        }
        if (message.type === 'STARLIGHT_LIBRARY_SEARCH' && state.fail) {
          state.fail = false;
          throw new Error('Synthetic worker interruption');
        }
        return original(message);
      }) as typeof chrome.runtime.sendMessage;
    });
    await panel.getByRole('searchbox', { name: 'Search chats' }).fill('historical');
    await expect.poll(() => panel.evaluate(() => (window as unknown as { libraryTest: { started: boolean } }).libraryTest.started)).toBe(true);
    await panel.getByRole('searchbox', { name: 'Search chats' }).fill('resend');
    await expect(panel.locator('.chat-row')).toContainText('Newsletter planning');
    await expect.poll(() => panel.evaluate(() => (window as unknown as { libraryTest: { finished: boolean } }).libraryTest.finished)).toBe(true);
    await expect(panel.locator('.chat-row')).toHaveCount(1);
    await expect(panel.locator('.chat-row')).toContainText('Newsletter planning');
    await panel.evaluate(() => { (window as unknown as { libraryTest: { fail: boolean } }).libraryTest.fail = true; });
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(panel.locator('#lib-status')).toContainText('Search is unavailable');
    await expect(panel.locator('.chat-row')).toHaveCount(0);
    await expect(panel.getByRole('searchbox', { name: 'Search chats' })).toHaveValue('resend');
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(panel.locator('#lib-status')).toContainText('1 of 1 matching chats');
    await panel.evaluate(() => { chrome.runtime.sendMessage = (window as unknown as { originalSendMessage: typeof chrome.runtime.sendMessage }).originalSendMessage; });
  });

  test('pagination stays bounded and its action fits the narrow panel', async () => {
    // Seed only this empty-profile query index; exercise search rather than Downloads.
    await panel.evaluate(async () => {
      const db = await new Promise<IDBDatabase>(resolve => {
        const request = indexedDB.open('arcanea-vault', 1);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('conversations', 'readwrite');
        for (let i = 0; i < 45; i++) transaction.objectStore('conversations').put({
          id: `page-fixture-${i}`, platform: 'claude', title: `Paginationfixture ${i}`,
          url: `https://claude.ai/chat/page-fixture-${i}`, capturedAt: '2026-10-01T12:00:00Z', tags: [], messages: [],
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    });
    await panel.setViewportSize({ width: 320, height: 820 });
    await panel.getByRole('searchbox', { name: 'Search chats' }).fill('paginationfixture');
    await expect(panel.locator('.chat-row')).toHaveCount(40);
    const more = panel.getByRole('button', { name: 'Show more chats', exact: true });
    await expect(more).toBeVisible();
    expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.evaluate(() => {
      const original = chrome.runtime.sendMessage.bind(chrome.runtime);
      let fail = true;
      Object.assign(window, { paginationOriginal: original });
      chrome.runtime.sendMessage = (async (message: { type: string; query?: { offset?: number } }) => {
        if (message.type === 'STARLIGHT_LIBRARY_SEARCH' && message.query?.offset === 40 && fail) {
          fail = false;
          throw new Error('Synthetic next-page failure');
        }
        return original(message);
      }) as typeof chrome.runtime.sendMessage;
    });
    await more.click();
    await expect(panel.locator('#lib-status')).toContainText('Could not load more chats');
    await expect(panel.locator('.chat-row')).toHaveCount(40);
    await expect(more).toBeVisible();
    await more.click();
    await expect(panel.locator('.chat-row')).toHaveCount(45);
    await expect(more).toBeHidden();
    await expect(panel.locator('#lib-status')).toContainText('45 of 45');
    expect(new Set(await panel.locator('.lib-item-title').allTextContents()).size).toBe(45);
    const other = await context.newPage();
    await other.goto(`${url}-other`);
    await expect(panel.locator('#lib-status')).toContainText('Refresh to update');
    await expect(panel.locator('.chat-row')).toHaveCount(45);
    await other.close();
    await panel.evaluate(() => { chrome.runtime.sendMessage = (window as unknown as { paginationOriginal: typeof chrome.runtime.sendMessage }).paginationOriginal; });
  });
});
