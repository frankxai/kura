import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformForUrl, searchChats, resumeChat } from '../src/core/chat-library.ts';
import type { Conversation } from '../src/core/types.ts';

function chat(id: string, changes: Partial<Conversation> = {}): Conversation {
  return { id, platform: 'chatgpt', title: 'Newsletter idea', url: `https://chatgpt.com/c/${id}`,
    capturedAt: '2026-10-04T12:00:00Z', tags: ['writing'],
    messages: [{ role: 'user', content: 'Find the Resend integration decision.' }], ...changes };
}
test('only exact HTTPS provider hosts are accepted', () => {
  assert.equal(platformForUrl('https://chatgpt.com/c/1'), 'chatgpt');
  assert.equal(platformForUrl('https://chat.openai.com/c/1'), 'chatgpt');
  assert.equal(platformForUrl('https://aistudio.google.com/prompts/1'), 'gemini');
  for (const url of ['https://chatgpt.com.evil.test/c/1', 'https://evil.test/?next=claude.ai',
    'https://claude.ai@evil.test/', 'https://user:pass@claude.ai/chat/1', 'javascript:alert(1)',
    'http://chatgpt.com/c/1', 'https://chatgpt.com:8443/c/1', 'chrome://extensions/',
    'https://constructor/', 'https://__proto__/', 'https://toString/', 'https://chatgpt.com/c/' + 'x'.repeat(2048)]) {
    assert.equal(platformForUrl(url), null, url);
  }
});

test('multi-account Gemini and AI Studio new-chat pages keep separate drafts', () => {
  for (const url of ['https://gemini.google.com/u/1/app', 'https://gemini.google.com/u/2/app/',
    'https://aistudio.google.com/prompts/new_chat', 'https://aistudio.google.com/u/1/prompts/new_chat']) {
    const result = searchChats([], [1, 2].map(tabId => ({ platform: 'gemini', tabId, url, title: `Draft ${tabId}`, active: tabId === 2 })), {});
    assert.equal(result.total, 2, url);
    assert.ok(result.items.every(item => item.openCount === 1));
  }
});

test('accent-folded snippets include the match and capture ties are deterministic', () => {
  const source = chat('accent', { messages: [{ role: 'user', content: 'Earlier text. '.repeat(100) + 'Café decision.' }] });
  assert.match(searchChats([source], [], { query: 'cafe' }).items[0].snippet, /Café decision/);
  const a = chat('a', { url: 'https://chatgpt.com/c/same', title: 'First', capturedAt: '2026-10-04T14:00:00+02:00' });
  const b = chat('b', { url: a.url, title: 'Second' });
  assert.deepEqual(searchChats([a, b], [], {}), searchChats([b, a], [], {}));
  assert.equal(searchChats([a, b], [], {}).items[0].title, 'Second');
});
test('a saved thread and multiple open tabs form one result; prefer the active tab', () => {
  const result = searchChats([chat('1')], [
    { platform: 'chatgpt', tabId: 1, url: 'https://chat.openai.com/c/1?utm_source=test', title: 'Updated subject', active: false },
    { platform: 'chatgpt', tabId: 2, url: 'https://chatgpt.com/c/1', title: 'Updated subject', active: true },
  ], { query: 'updated' });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].tabId, 2);
  assert.equal(result.items[0].openCount, 2);
  assert.equal(result.items[0].saved, true);
  assert.equal(result.items[0].title, 'Newsletter idea');
});
test('new-chat drafts stay separate; newest saved observation wins without mutation', () => {
  const captures = [chat('old', { url: 'https://chatgpt.com/c/same', capturedAt: '2026-10-01T00:00:00Z' }),
    chat('new', { url: 'https://chatgpt.com/c/same', title: 'New title' }),
    chat('draft1', { url: 'https://chatgpt.com/' }), chat('draft2', { url: 'https://chatgpt.com/' })];
  const before = JSON.stringify(captures);
  const result = searchChats(captures, [
    { platform: 'chatgpt', tabId: 1, url: 'https://chatgpt.com/', title: 'Draft one', active: false },
    { platform: 'chatgpt', tabId: 2, url: 'https://chatgpt.com/', title: 'Draft two', active: true },
  ], {});
  assert.equal(result.total, 5);
  assert.equal(result.items.find(c => c.url.endsWith('/c/same'))?.title, 'New title');
  assert.equal(JSON.stringify(captures), before);
});
test('literal AND search spans title, tags and saved text with provider/date/scope filters', () => {
  const captures = [chat('1', { title: 'Café Newsletter' }), chat('2', { platform: 'claude', url: 'https://claude.ai/chat/2' }),
    chat('3', { capturedAt: '2026-09-01T00:00:00Z' })];
  assert.equal(searchChats(captures, [], { query: 'cafe resend writing', platform: 'chatgpt', since: '2026-10-01' }).total, 1);
  assert.equal(searchChats(captures, [], { query: 'resend missing' }).total, 0);
  assert.equal(searchChats(captures, [], { scope: 'open' }).total, 0);
  assert.match(searchChats(captures, [], { query: 'integration' }).items[0].snippet, /integration/);
  assert.equal(searchChats([chat('1', { url: 'https://claude.ai/chat/1' })], [], {}).total, 0);
});
test('5,311 synthetic chats return bounded, stable pages and no transcripts', () => {
  const captures = Array.from({ length: 5311 }, (_, i) => chat(String(i), {
    title: `Topic ${String(i).padStart(5, '0')}`, messages: [{ role: 'user', content: 'archive '.repeat(100) }] }));
  const first = searchChats(captures, [], { query: 'archive' });
  const second = searchChats(captures, [], { query: 'archive', offset: first.nextOffset! });
  assert.equal(first.total, 5311);
  assert.equal(first.items.length, 40);
  assert.equal(first.nextOffset, 40);
  assert.equal(new Set([...first.items, ...second.items].map(i => i.key)).size, 80);
  assert.ok(first.items.every(i => i.snippet.length <= 242 && !('messages' in i)));
  assert.ok(Buffer.byteLength(JSON.stringify(first)) < 35000);
});
test('invalid filters and oversized queries fail explicitly', () => {
  for (const query of [{ query: 'x'.repeat(201) }, { offset: -1 }, { offset: 0.5 }, { scope: 'private' }, { since: '../' }]) {
    assert.throws(() => searchChats([], [], query as never));
  }
});
test('resume focuses the existing window and preserves navigation; stale tabs fail closed', async () => {
  const calls: unknown[] = [];
  let url = 'https://chatgpt.com/c/1';
  Object.assign(globalThis, { chrome: { tabs: {
    get: async () => ({ id: 10, url, windowId: 2 }),
    update: async (...args: unknown[]) => { calls.push(['update', ...args]); },
    query: async () => [{ id: 10, url, windowId: 2 }],
    create: async (...args: unknown[]) => { calls.push(['create', ...args]); },
  }, windows: { update: async (...args: unknown[]) => { calls.push(['focus', ...args]); } } } });
  await resumeChat({ tabId: 10, url, tabUrl: url });
  assert.deepEqual(calls, [['update', 10, { active: true }], ['focus', 2, { focused: true }]]);
  calls.length = 0;
  const expected = url;
  url = 'https://chatgpt.com/c/another';
  await assert.rejects(resumeChat({ tabId: 10, url: expected, tabUrl: expected }));
  assert.equal(calls.length, 0);
  await assert.rejects(resumeChat({ url: 'https://evil.test/?chatgpt.com' }));
  await assert.rejects(resumeChat({ url: 'https://constructor/' }));
  await resumeChat({ url });
  assert.deepEqual(calls, [['update', 10, { active: true }], ['focus', 2, { focused: true }]]);
});

test('saved sources open only in an explicit non-incognito window', async () => {
  const calls: unknown[] = [];
  let windows = [{ id: 1, incognito: true, focused: true }, { id: 2, incognito: false, focused: false }];
  Object.assign(globalThis, { chrome: { tabs: { query: async () => [], create: async (options: unknown) => calls.push(options) },
    windows: { getAll: async () => windows, update: async () => undefined } } });
  await resumeChat({ url: 'https://chatgpt.com/c/saved' });
  assert.deepEqual(calls, [{ url: 'https://chatgpt.com/c/saved', active: true, windowId: 2 }]);
  windows = windows.slice(0, 1);
  await assert.rejects(resumeChat({ url: 'https://chatgpt.com/c/saved' }));
  assert.equal(calls.length, 1);
});
