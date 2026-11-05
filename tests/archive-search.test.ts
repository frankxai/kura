import assert from 'node:assert/strict';
import test from 'node:test';
import { readArchiveReply } from '../src/core/archive-search.ts';

test('cited reply keeps review status and rejects pending excerpts', () => {
  const page = readArchiveReply({ ok: true, total: 1, cursor: null, searched: { notes: 12 }, items: [{
    citation: 'notes/decisions/kura.md', title: 'Kura archive decision', status: 'reviewed', platform: 'chatgpt',
    date: '2026-10-04', review: 'excerpt', excerpt: 'Keep the filesystem canonical', sourceUrl: 'https://chatgpt.com/c/decision' }] });
  assert.equal(page.available, true);
  assert.equal(page.items[0].sourceUrl, 'https://chatgpt.com/c/decision');
  assert.throws(() => readArchiveReply({ ok: true, total: 1, items: [{
    citation: 'notes/ideas/pending.md', title: 'Pending', status: 'needs-summary', platform: 'claude', date: '',
    review: 'metadata-only', excerpt: 'hidden body', sourceUrl: null }] }));
});

test('private paths and unconnected hosts fail closed', () => {
  assert.equal(readArchiveReply({ ok: false, code: 'index_changed' }).reason, 'The archive changed. Refresh to search the current notes.');
  assert.throws(() => readArchiveReply({ ok: true, total: 1, items: [{
    citation: '../private/secret.md', title: 'Secret', status: 'reviewed', platform: 'chatgpt', date: '',
    review: 'excerpt', excerpt: 'no', sourceUrl: null }] }));
  assert.throws(() => readArchiveReply({ ok: true, total: 1, items: [{
    citation: 'notes/a.md', title: 'Bad link', status: 'reviewed', platform: 'chatgpt', date: '',
    review: 'excerpt', excerpt: 'no', sourceUrl: 'https://evil.test/?chatgpt.com' }] }));
});
