import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureGate } from '../src/core/auto-capture.ts';
import type { DetectionResult } from '../src/core/types.ts';
import { mergeRecapture } from '../src/core/recapture.ts';

test('recapture preserves curated fields and refuses identity collisions', () => {
  const old = '---\nid: chatgpt-a\nmessageCount: 1\nstatus: reviewed\ntags:\n  - keep-me\ncharacters: ["[[Alice]]"]\n---\nOld body';
  const next = '---\nid: chatgpt-a\nmessageCount: 2\nstatus: raw\ntags: []\ncharacters: []\n---\nNew body';
  const merged = mergeRecapture(old, next);
  assert.match(merged, /status: reviewed/);
  assert.match(merged, /  - keep-me/);
  assert.match(merged, /characters: \["\[\[Alice\]\]"\]/);
  assert.match(merged, /messageCount: 2/);
  assert.match(merged, /New body/);
  assert.throws(() => mergeRecapture(old, next.replace('chatgpt-a', 'chatgpt-b')));
  assert.throws(() => mergeRecapture('broken metadata', next));
  assert.throws(() => mergeRecapture(next, old), /more messages/);
});

test('recapture retains custom YAML keys and handles annotated identity', () => {
  const old = '---\n# User annotation\nid: "a" # ID comment\ntitle: old\n"custom.key": retained\n心: preserved\nstatus: reviewed\n---\nOld';
  const merged = mergeRecapture(old, '---\nid: a\ntitle: new\nstatus: raw\n---\nNew');
  assert.match(merged, /# User annotation/);
  assert.match(merged, /"custom.key": retained/);
  assert.match(merged, /心: preserved/);
  assert.match(merged, /status: reviewed/);
});

const page = (id = 'chatgpt-a', content = 'answer'): DetectionResult => ({
  platform: 'chatgpt', pageType: 'conversation', media: [], prompts: [],
  stats: { totalConversations: 1, totalImages: 0, totalVideos: 0, totalPrompts: 0 },
  conversations: [{ id, platform: 'chatgpt', title: 'Test', url: `https://chatgpt.com/c/${id}`,
    capturedAt: new Date().toISOString(), messages: [{ role: 'assistant', content }] }],
});

test('recaptures same-count edits and shorter/new chats; skips unchanged metadata', async () => {
  const writes: DetectionResult[] = [];
  const capture = createCaptureGate(async (detection) => { writes.push(detection); return true; });
  await capture(page());
  await capture(page());
  await capture(page('chatgpt-a', 'edited answer'));
  await capture(page('chatgpt-b'));
  assert.equal(writes.length, 3);
});

test('failed acknowledgement retries the same body', async () => {
  let attempts = 0;
  const capture = createCaptureGate(async () => ++attempts > 1);
  assert.equal(await capture(page()), false);
  assert.equal(await capture(page()), true);
  await capture(page());
  assert.equal(attempts, 2);
});

test('errors do not poison acknowledgement or concurrent writes', async () => {
  let finish: (accepted: boolean) => void = () => {};
  let writes = 0;
  const capture = createCaptureGate(async () => {
    writes += 1;
    if (writes === 1) throw new Error('worker disconnected');
    return new Promise<boolean>((resolve) => { finish = resolve; });
  });
  await assert.rejects(capture(page()));
  const pending = capture(page());
  assert.equal(await capture(page('chatgpt-b')), false);
  finish(true);
  assert.equal(await pending, true);
  assert.equal(writes, 2);
});
