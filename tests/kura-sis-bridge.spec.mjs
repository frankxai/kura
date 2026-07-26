import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const bridge = join(repoRoot, 'scripts', 'kura-sis-bridge.mjs');

function fixtureConversation({ id = 'chat-123', title = 'Bridge test idea' } = {}) {
  return `---
id: ${id}
slug: 2026-07-26_bridge-test-idea
title: "${title}"
platform: chatgpt
source: https://chatgpt.com/c/${id}
capturedAt: 2026-07-26T12:00:00+02:00
capturedBy: kura/0.2.0
schemaVersion: 0.2.0
messageCount: 2
status: raw
---

# ${title}

## You

A private build idea.

## ChatGPT

A possible response.
`;
}

function runBridge(args) {
  const result = spawnSync(process.execPath, [bridge, ...args, '--json'], {
    encoding: 'utf8',
  });
  return {
    ...result,
    json: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

test('queues a metadata-only intake envelope for a new valid Kura capture', () => {
  const root = mkdtempSync(join(tmpdir(), 'kura-sis-bridge-'));
  try {
    const source = join(root, 'Kura');
    const intake = join(root, 'sis-intake');
    const state = join(root, 'private', 'kura-bridge-state.json');
    const conversation = join(source, 'chatgpt', '2026-07-26_bridge-test-idea', 'conversation.md');
    mkdirSync(join(source, 'chatgpt', '2026-07-26_bridge-test-idea'), { recursive: true });
    writeFileSync(conversation, fixtureConversation());

    const first = runBridge(['--source', source, '--intake', intake, '--state', state]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.json.discovered, 1);
    assert.equal(first.json.queued, 1);
    assert.equal(first.json.invalid, 0);
    assert.equal(first.json.records[0].platform, 'chatgpt');

    const envelope = readFileSync(first.json.records[0].intakePath, 'utf8');
    assert.match(envelope, /kind: kura-intake-envelope/);
    assert.match(envelope, /privacyClass: unknown/);
    assert.match(envelope, /sourceSha256:/);
    assert.match(envelope, /sourcePath:/);
    assert.doesNotMatch(envelope, /A private build idea\./);

    const second = runBridge(['--source', source, '--intake', intake, '--state', state]);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.json.queued, 0);
    assert.equal(second.json.unchanged, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects malformed captures without advancing bridge state', () => {
  const root = mkdtempSync(join(tmpdir(), 'kura-sis-bridge-'));
  try {
    const source = join(root, 'Kura');
    const intake = join(root, 'sis-intake');
    const state = join(root, 'private', 'kura-bridge-state.json');
    const folder = join(source, 'chatgpt', '2026-07-26_broken-capture');
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'conversation.md'), '---\nid: broken\nplatform: chatgpt\n---\n');

    const result = runBridge(['--source', source, '--intake', intake, '--state', state]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.json.discovered, 1);
    assert.equal(result.json.queued, 0);
    assert.equal(result.json.invalid, 1);
    assert.match(result.json.errors[0].reason, /missing required frontmatter/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
