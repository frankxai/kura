import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeIntake, validCaptureRef } from '../src/core/native-intake.ts';
import type { CaptureRef, IntakeState, NativeTransport } from '../src/core/native-intake.ts';

const ref: CaptureRef = { path: 'chatgpt/2026-10-04_test/conversation.md', sha256: 'a'.repeat(64) };
function harness(transport?: NativeTransport) {
  let state: IntakeState | undefined;
  const requests: Record<string, unknown>[] = [];
  const storage = { read: async () => state ? structuredClone(state) : undefined,
    write: async (next: IntakeState) => { state = structuredClone(next); } };
  const send: NativeTransport = async (request) => {
    requests.push(request);
    if (transport) return transport(request);
    return request.op === 'hello' ? { ok: true, mode: 'agent', paidApiCalls: 0, vault: 'test-vault' }
      : { ok: true, receipt: request.sha256, processed: 1, unchanged: false, paidApiCalls: 0 };
  };
  return { intake: new NativeIntake(storage, send), storage, send, requests };
}

test('native pointers reject path traversal, unknown platforms and malformed hashes', () => {
  assert.equal(validCaptureRef(ref), true);
  for (const path of ['../secret/conversation.md', '/chatgpt/2026-10-04-test/conversation.md',
    'chatgpt/2026-10-04-test/secret.md', 'chatgpt/2026-10-04-test:stream/conversation.md',
    'aistudio/2026-10-04-test/conversation.md']) assert.equal(validCaptureRef({ ...ref, path }), false);
  assert.equal(validCaptureRef({ ...ref, sha256: 'invalid' }), false);
});

test('capture without explicit enable never starts a native host', async () => {
  const h = harness();
  await h.intake.enqueue([ref]);
  await h.intake.drain();
  assert.equal(h.requests.length, 0);
  assert.equal((await h.intake.snapshot()).enabled, false);
});

test('queue survives disconnect and worker restart; retry needs a verified receipt', async () => {
  let offline = false;
  const h = harness(async (request) => {
    if (request.op === 'hello') return { ok: true, mode: 'agent', paidApiCalls: 0, vault: 'test' };
    if (offline) throw new Error('offline');
    return { ok: true, receipt: request.sha256, processed: 0, unchanged: true, paidApiCalls: 0 };
  });
  await h.intake.enable();
  await h.intake.enqueue([ref]);
  offline = true;
  await h.intake.drain();
  assert.equal((await h.intake.snapshot()).pending.length, 1);
  const restarted = new NativeIntake(h.storage, h.send);
  offline = false;
  await restarted.drain();
  assert.equal((await restarted.snapshot()).pending.length, 0);
  assert.equal((await restarted.snapshot()).processed, 0);
  assert.ok(h.requests.every((request) => !('content' in request) && !('brainRoot' in request)));
});

test('a newer capture queued during intake is not acknowledged by the old receipt', async () => {
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  let first = true;
  const h = harness(async (request) => {
    if (request.op === 'hello') return { ok: true, mode: 'agent', paidApiCalls: 0, vault: 'test' };
    if (first) { first = false; await waiting; }
    return { ok: true, receipt: request.sha256, processed: 1, unchanged: false, paidApiCalls: 0 };
  });
  await h.intake.enable();
  await h.intake.enqueue([ref]);
  const running = h.intake.drain();
  while (!h.requests.some((request) => request.op === 'process')) await new Promise((resolve) => setTimeout(resolve, 0));
  await h.intake.enqueue([{ ...ref, sha256: 'b'.repeat(64) }]);
  release!();
  await running;
  assert.deepEqual(h.requests.filter((request) => request.op === 'process').map((request) => request.sha256), [ref.sha256, 'b'.repeat(64)]);
  assert.equal((await h.intake.snapshot()).pending.length, 0);
});

test('malformed acknowledgement and paid mode leave work pending', async () => {
  const h = harness(async (request) => request.op === 'hello'
    ? { ok: true, mode: 'agent', paidApiCalls: 0, vault: 'test' }
    : { ok: true, receipt: 'b'.repeat(64), processed: 1, unchanged: false, paidApiCalls: 0 });
  await h.intake.enable(); await h.intake.enqueue([ref]); await h.intake.drain();
  assert.equal((await h.intake.snapshot()).pending.length, 1);
  const paid = harness(async () => ({ ok: true, mode: 'api', paidApiCalls: 1, vault: 'test' }));
  await assert.rejects(paid.intake.enable());
});

test('processing is bounded and pause preserves remaining queue', async () => {
  const h = harness(); await h.intake.enable();
  const refs = Array.from({ length: 5 }, (_, index) => ({ ...ref, path: `chatgpt/2026-10-04_test-${index}/conversation.md` }));
  await h.intake.enqueue(refs); await h.intake.drain();
  assert.equal((await h.intake.snapshot()).pending.length, 2);
  await h.intake.disable(); await h.intake.drain();
  assert.equal((await h.intake.snapshot()).pending.length, 2);
});

test('a rejected capture remains queued while healthy captures can progress', async () => {
  const h = harness(async (request) => request.op === 'hello'
    ? { ok: true, mode: 'agent', paidApiCalls: 0, vault: 'test' }
    : request.path === ref.path ? { ok: false, code: 'capture_rejected' }
    : { ok: true, receipt: request.sha256, processed: 1, unchanged: false, paidApiCalls: 0 });
  await h.intake.enable();
  await h.intake.enqueue([ref, { ...ref, path: 'claude/2026-10-04_healthy/conversation.md' }]);
  await h.intake.drain();
  const state = await h.intake.snapshot();
  assert.deepEqual(state.pending, [ref]);
  assert.equal(state.processed, 1);
  assert.equal(state.status, 'retry');
  assert.equal(h.requests.filter((request) => request.op === 'process').length, 2);
});

test('overflow and invalid pointers preserve valid work and report missed intake', async () => {
  const h = harness(); await h.intake.enable();
  const refs = Array.from({ length: 257 }, (_, index) => ({ ...ref, path: `chatgpt/2026-10-04_item-${index}/conversation.md` }));
  assert.equal(await h.intake.enqueue([...refs, { ...ref, path: '../invalid' }]), 256);
  const state = await h.intake.snapshot();
  assert.equal(state.pending.length, 256);
  assert.equal(state.missed, 2);
  assert.equal(state.status, 'queue-full');
});

test('corrupt state can be paused and reset without touching saved captures', async () => {
  const h = harness();
  await h.storage.write({ ...await h.intake.snapshot(), pending: 'invalid' } as unknown as IntakeState);
  await assert.rejects(h.intake.snapshot());
  assert.equal((await h.intake.disable()).enabled, false);
  await h.intake.enable(); await h.intake.enqueue([ref]);
  assert.equal((await h.intake.reset()).pending.length, 0);
  assert.equal((await h.intake.snapshot()).enabled, false);
});
