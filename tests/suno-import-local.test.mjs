import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importLocal } from '../scripts/suno-import-local.mjs'

const id = '11111111-1111-4111-8111-111111111111'
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'kura-intake-'))
  const source = join(root, 'exports'), intake = join(root, 'intake')
  await mkdir(source); await mkdir(intake)
  const wav = Buffer.alloc(48); wav.write('RIFF'); wav.writeUInt32LE(40, 4); wav.write('WAVE', 8)
  await writeFile(join(source, 'take.wav'), wav)
  return { source, intake, root, manifest: { schema: 'kura-suno-local-import/1', files: [{ sunoId: id, file: 'take.wav', contributionRefs: ['kura:conversation:example#user-3'] }] } }
}
test('plan is read only; apply copies exact bytes, stays private, and reruns are idempotent', async () => {
  const options = await fixture()
  const plan = await importLocal(options)
  assert.equal(plan.mode, 'plan'); assert.deepEqual(await readdir(options.intake), [])
  const applied = await importLocal({ ...options, apply: true })
  assert.deepEqual(applied.receipts, plan.receipts)
  const record = applied.receipts[0]
  assert.equal(record.publicationStatus, 'private'); assert.equal(record.rightsStatus, 'unreviewed'); assert.equal(record.decodeCheck, 'pending')
  assert.equal(record.sha256.length, 64)
  assert.deepEqual(await readFile(join(options.source, 'take.wav')), await readFile(join(options.intake, record.objectPath)))
  assert.deepEqual(await importLocal({ ...options, apply: true }), applied)
})
test('rejects traversal, symlink escape, wrong payloads and tampered archive copies', async () => {
  const options = await fixture()
  await writeFile(join(options.root, 'outside.wav'), 'not audio')
  const invalid = { ...options.manifest, files: [{ sunoId: id, file: '../outside.wav' }] }
  await assert.rejects(importLocal({ ...options, manifest: invalid }), /inside/)
  await symlink(join(options.root, 'outside.wav'), join(options.source, 'escape.wav'))
  await assert.rejects(importLocal({ ...options, manifest: { ...invalid, files: [{ sunoId: id, file: 'escape.wav' }] } }), /inside/)
  await writeFile(join(options.source, 'bad.mp3'), '<html>failed download</html>')
  await assert.rejects(importLocal({ ...options, manifest: { ...invalid, files: [{ sunoId: id, file: 'bad.mp3' }] } }), /header/)
  const result = await importLocal({ ...options, apply: true })
  await writeFile(join(options.intake, result.receipts[0].objectPath), 'tampered')
  await assert.rejects(importLocal({ ...options, apply: true }), /verification failed/)
})
test('refuses an output symlink before creating files beneath it', async () => {
  const options = await fixture()
  const outside = join(options.root, 'outside'); await mkdir(outside)
  await symlink(outside, join(options.intake, 'suno'))
  await assert.rejects(importLocal({ ...options, apply: true }), /symlinks/)
  assert.deepEqual(await readdir(outside), [])
})
