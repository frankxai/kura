#!/usr/bin/env node
// Agent-side helper for the Suno Harvester flags interchange.
// Edits <intake>/suno/flags.json — the same file the extension's Fetch
// buttons consume — so any agent or human can queue downloads without
// opening the extension UI. See docs/specs/SUNO-HARVESTER.md.
//
// Usage:
//   node scripts/suno-flags.mjs <intake-dir> list
//   node scripts/suno-flags.mjs <intake-dir> add <trackId...> [--note "reason"]
//   node scripts/suno-flags.mjs <intake-dir> remove <trackId...>
//   node scripts/suno-flags.mjs <intake-dir> top <n>        # flag n most-played from catalog.jsonl

import fs from 'node:fs'
import path from 'node:path'

const [intake, cmd, ...rest] = process.argv.slice(2)
if (!intake || !cmd) {
  console.error('usage: suno-flags.mjs <intake-dir> list|add|remove|top ...')
  process.exit(1)
}

const sunoDir = path.join(intake, 'suno')
const flagsPath = path.join(sunoDir, 'flags.json')
const catalogPath = path.join(sunoDir, 'catalog.jsonl')

function readFlags() {
  try {
    return JSON.parse(fs.readFileSync(flagsPath, 'utf8'))
  } catch {
    return { version: 1, flags: {} }
  }
}

function writeFlags(flags) {
  fs.mkdirSync(sunoDir, { recursive: true })
  fs.writeFileSync(flagsPath, JSON.stringify(flags, null, 2) + '\n')
}

function readCatalog() {
  if (!fs.existsSync(catalogPath)) {
    console.error(`no catalog at ${catalogPath} — run Index in the extension first`)
    process.exit(1)
  }
  return fs
    .readFileSync(catalogPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

const flags = readFlags()

if (cmd === 'list') {
  const ids = Object.keys(flags.flags)
  console.log(`${ids.length} flagged`)
  for (const id of ids) {
    const f = flags.flags[id]
    console.log(`  ${id}  audio:${f.audio} video:${f.video}${f.note ? `  # ${f.note}` : ''}`)
  }
} else if (cmd === 'add' || cmd === 'remove') {
  const noteIdx = rest.indexOf('--note')
  const note = noteIdx >= 0 ? rest[noteIdx + 1] : undefined
  const ids = rest.filter((a, i) => !a.startsWith('--') && (noteIdx < 0 || i !== noteIdx + 1))
  if (ids.length === 0) {
    console.error(`no track ids given`)
    process.exit(1)
  }
  for (const id of ids) {
    if (cmd === 'add') flags.flags[id] = { audio: true, video: true, ...(note ? { note } : {}) }
    else delete flags.flags[id]
  }
  writeFlags(flags)
  console.log(`${cmd === 'add' ? 'flagged' : 'unflagged'} ${ids.length} · total ${Object.keys(flags.flags).length}`)
} else if (cmd === 'top') {
  const n = Number(rest[0]) || 10
  const top = readCatalog()
    .sort((a, b) => b.plays - a.plays)
    .slice(0, n)
  for (const t of top) {
    flags.flags[t.id] = { audio: true, video: true, note: `top-${n} by plays (${t.plays})` }
  }
  writeFlags(flags)
  console.log(`flagged top ${top.length} by plays:`)
  for (const t of top) console.log(`  ${t.plays.toString().padStart(6)}  ${t.title}`)
} else {
  console.error(`unknown command: ${cmd}`)
  process.exit(1)
}
