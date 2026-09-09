#!/usr/bin/env node
// Import files downloaded through Suno's supported UI. No network or credentials.
import { createHash } from 'node:crypto'
import { createReadStream, constants } from 'node:fs'
import { copyFile, lstat, mkdir, open, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const within = (root, path) => { const p = relative(root, path); return p === '' || (!p.startsWith(`..${sep}`) && p !== '..' && !isAbsolute(p)) }

async function hashFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function audioKind(path) {
  const file = await open(path, 'r')
  try {
    const bytes = Buffer.alloc(12)
    const { bytesRead } = await file.read(bytes, 0, 12, 0)
    if (bytesRead < 12) throw new Error('File is too short to identify as audio')
    if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') return { extension: 'wav', mimeType: 'audio/wav' }
    if (bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return { extension: 'mp3', mimeType: 'audio/mpeg' }
    throw new Error('Expected WAV or MP3 header; no format is inferred from a filename')
  } finally { await file.close() }
}

/** Returns a plan by default. apply writes immutable binaries and private receipts. */
export async function importLocal({ source, intake, manifest, apply = false }) {
  const sourceRoot = await realpath(source)
  // The operator creates/selects a dedicated intake first. Resolve symlinks before
  // enforcing that runtime output stays out of the code checkout.
  const intakeRoot = await realpath(intake)
  if (!(await stat(sourceRoot)).isDirectory() || !(await stat(intakeRoot)).isDirectory()) throw new Error('Source and intake must be directories')
  if (within(REPO, intakeRoot) || within(intakeRoot, REPO)) throw new Error('Intake must be outside the repository and cannot contain it')
  if (!manifest || manifest.schema !== 'kura-suno-local-import/1' || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Expected a nonempty kura-suno-local-import/1 manifest')
  const plans = []
  // Validate and hash every input before writing anything.
  for (const item of manifest.files) {
    if (!item || !UUID.test(item.sunoId) || typeof item.file !== 'string' || isAbsolute(item.file)) throw new Error('Each file requires a Suno UUID and a relative filename')
    const input = await realpath(resolve(sourceRoot, item.file))
    if (!within(sourceRoot, input) || !(await stat(input)).isFile()) throw new Error('Input file must stay inside the selected source directory')
    if (item.contributionRefs !== undefined && (!Array.isArray(item.contributionRefs) || item.contributionRefs.some(ref => typeof ref !== 'string' || ref.length > 500))) throw new Error('Contribution references must be short strings')
    const kind = await audioKind(input)
    const sha256 = await hashFile(input)
    const sunoId = item.sunoId.toLowerCase()
    const objectPath = `suno/imports/${sunoId}/${sha256}.${kind.extension}`
    const receipt = {
      schema: 'starlight.music-intake/1', sourceId: `suno:${sunoId}`, sunoId,
      sourceUrl: `https://suno.com/song/${sunoId}`,
      sourceMethod: 'operator-declared-official-export',
      sha256, bytes: (await stat(input)).size, mimeType: kind.mimeType,
      objectPath, headerCheck: 'passed', decodeCheck: 'pending',
      rightsStatus: 'unreviewed', publicationStatus: 'private',
      contributionRefs: item.contributionRefs ?? [],
    }
    plans.push({ input, receipt })
  }
  if (apply) {
    for (const { input, receipt } of plans) {
      const target = join(intakeRoot, receipt.objectPath)
      let directory = intakeRoot
      for (const segment of ['suno', 'imports', receipt.sunoId]) {
        directory = join(directory, segment)
        try { await mkdir(directory) } catch (error) { if (error.code !== 'EEXIST') throw error }
        if (!(await lstat(directory)).isDirectory()) throw new Error('Output directory is not a real directory; symlinks are refused')
      }
      try { await copyFile(input, target, constants.COPYFILE_EXCL) }
      catch (error) { if (error.code !== 'EEXIST') throw error }
      if (!within(intakeRoot, await realpath(target)) || await hashFile(target) !== receipt.sha256) throw new Error('Archive copy verification failed; existing bytes were not overwritten')
      // Different human reference sets create different immutable receipts.
      const receiptHash = createHash('sha256').update(JSON.stringify(receipt)).digest('hex')
      const receiptPath = join(dirname(target), `${receipt.sha256}.${receiptHash}.receipt.json`)
      const serialized = JSON.stringify(receipt, null, 2) + '\n'
      try { await writeFile(receiptPath, serialized, { flag: 'wx' }) }
      catch (error) {
        if (error.code !== 'EEXIST') throw error
        if (!within(intakeRoot, await realpath(receiptPath)) || await readFile(receiptPath, 'utf8') !== serialized) throw new Error('Existing receipt differs; refusing overwrite')
      }
    }
  }
  return { mode: apply ? 'applied' : 'plan', receipts: plans.map(plan => plan.receipt) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.includes('--help') || !args.length) {
    console.log('node scripts/suno-import-local.mjs --source <official-exports> --intake <existing-external-intake> --manifest <mapping.json> [--apply]')
  } else {
    try {
      const value = flag => { const index = args.indexOf(flag); if (index < 0 || !args[index + 1]) throw new Error(`Missing ${flag}`); return args[index + 1] }
      const result = await importLocal({ source: value('--source'), intake: value('--intake'), manifest: JSON.parse(await readFile(value('--manifest'), 'utf8')), apply: args.includes('--apply') })
      console.log(JSON.stringify(result, null, 2))
    } catch (error) { console.error(error.message); process.exitCode = 1 }
  }
}
