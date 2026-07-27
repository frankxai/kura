#!/usr/bin/env node
/**
 * Kura → SIS local bridge.
 *
 * Validates Kura conversation files, then writes a metadata-only intake envelope
 * and an external-to-git state file. Conversation bodies remain canonical in the
 * Kura vault and are never copied into the SIS intake queue by this tool.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SUPPORTED_PLATFORMS = new Set(['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity']);
const REQUIRED_FIELDS = [
  'id',
  'slug',
  'title',
  'platform',
  'source',
  'capturedAt',
  'capturedBy',
  'schemaVersion',
  'messageCount',
  'status',
];

function usage() {
  return `Usage: node scripts/kura-sis-bridge.mjs --source <Kura-root> --intake <SIS-intake-root> --state <private-state.json> [--dry-run] [--quiet-if-idle] [--json]\n`;
}

function parseArgs(argv) {
  const options = { dryRun: false, quietIfIdle: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--dry-run') options.dryRun = true;
    else if (value === '--quiet-if-idle') options.quietIfIdle = true;
    else if (value === '--json') options.json = true;
    else if (value === '--source' || value === '--intake' || value === '--state') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) throw new Error(`Missing value for ${value}`);
      options[value.slice(2)] = resolve(next);
      i += 1;
    } else if (value === '--help' || value === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return options;
}

function walkConversationFiles(root) {
  const files = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name === 'conversation.md') files.push(absolute);
    }
  }
  visit(root);
  return files.sort();
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) {
    throw new Error('missing opening frontmatter delimiter');
  }
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const closing = lines.indexOf('---', 1);
  if (closing === -1) throw new Error('missing closing frontmatter delimiter');

  const frontmatter = {};
  for (const line of lines.slice(1, closing)) {
    const match = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    frontmatter[key] = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return { frontmatter, body: lines.slice(closing + 1).join('\n') };
}

function validateCapture(frontmatter) {
  const missing = REQUIRED_FIELDS.filter((field) => !frontmatter[field]);
  if (missing.length > 0) return `missing required frontmatter: ${missing.join(', ')}`;
  if (!SUPPORTED_PLATFORMS.has(frontmatter.platform)) return `unsupported platform: ${frontmatter.platform}`;
  if (!/^https:\/\//.test(frontmatter.source)) return 'source must be an https URL';
  if (!/^\d{4}-\d{2}-\d{2}_[a-z0-9-]{1,60}$/.test(frontmatter.slug)) {
    return 'slug must be YYYY-MM-DD_ followed by a kebab-case title';
  }
  if (!/^\d{4}-\d{2}-\d{2}(?:T|\s)/.test(frontmatter.capturedAt)) {
    return 'capturedAt must start YYYY-MM-DD followed by a time';
  }
  return null;
}

function readState(statePath) {
  if (!existsSync(statePath)) return { version: 1, captures: {} };
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8'));
    if (parsed?.version === 1 && parsed.captures && typeof parsed.captures === 'object') return parsed;
  } catch {
    // Corrupt state must not silently overwrite prior bridge history.
  }
  throw new Error(`Invalid bridge state: ${statePath}`);
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

function yamlScalar(value) {
  return JSON.stringify(String(value).replace(/[\r\n]+/g, ' ').trim());
}

function intakeEnvelope({ capture, sourcePath, sha256, capturedAt }) {
  return `---
kind: kura-intake-envelope
status: pending-triage
privacyClass: unknown
sourcePlatform: ${capture.platform}
sourceId: ${yamlScalar(capture.id)}
sourcePath: ${yamlScalar(sourcePath)}
sourceSha256: ${sha256}
capturedAt: ${yamlScalar(capture.capturedAt)}
bridgedAt: ${yamlScalar(capturedAt)}
schemaVersion: kura-bridge/1
---

# Kura capture pending triage: ${capture.title.replace(/[\r\n]+/g, ' ').trim()}

This is a **metadata-only pointer**. The canonical conversation remains in the local Kura vault at the relative path above. Before any LLM use, the downstream processor must read the canonical source locally, apply the SIS sanitization gate, and keep the privacy class unknown out of external model routes.

- Platform: ${capture.platform}
- Kura conversation ID: ${capture.id}
- Kura schema: ${capture.schemaVersion}
- Message count: ${capture.messageCount}
- Source URL: ${capture.source}
- Source content hash: ${sha256}
- Routing rule: emit candidate memories, ideas, decisions, and work-packets only; never auto-dispatch a coding agent from this envelope.
`;
}

function renderTextReport(report) {
  const lines = [
    'Kura → SIS bridge',
    `discovered=${report.discovered} queued=${report.queued} unchanged=${report.unchanged} invalid=${report.invalid}`,
  ];
  for (const error of report.errors) lines.push(`invalid: ${error.sourcePath} — ${error.reason}`);
  for (const record of report.records) lines.push(`queued: ${record.sourcePath} → ${record.intakePath}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  for (const key of ['source', 'intake', 'state']) {
    if (!options[key]) throw new Error(`Required --${key} was not provided`);
  }
  if (!existsSync(options.source)) throw new Error(`Kura source root does not exist: ${options.source}`);

  const state = readState(options.state);
  const nextState = structuredClone(state);
  const report = { discovered: 0, queued: 0, unchanged: 0, invalid: 0, errors: [], records: [] };
  const bridgedAt = new Date().toISOString();

  for (const file of walkConversationFiles(options.source)) {
    report.discovered += 1;
    const sourcePath = relative(options.source, file).split(sep).join('/');
    let capture;
    try {
      const raw = readFileSync(file, 'utf8');
      const { frontmatter: parsedCapture, body } = parseFrontmatter(raw);
      capture = parsedCapture;
      const validationError = validateCapture(capture);
      if (validationError) throw new Error(validationError);
      // Kura refreshes capturedAt on every export. Hash only the conversation body so
      // an unchanged re-capture stays idempotent while meaningful content changes queue.
      const sha256 = createHash('sha256').update(body).digest('hex');
      const captureKey = `${capture.platform}:${capture.id}`;
      const prior = state.captures[captureKey];
      if (prior?.sha256 === sha256 && prior?.sourcePath === sourcePath) {
        report.unchanged += 1;
        continue;
      }

      const date = String(capture.capturedAt).slice(0, 10);
      const hashPrefix = sha256.slice(0, 12);
      const intakeRoot = resolve(options.intake);
      const intakePath = resolve(intakeRoot, `intake-${date}-kura-${capture.platform}-${capture.slug}-${hashPrefix}.md`);
      if (dirname(intakePath) !== intakeRoot) {
        throw new Error('intake filename must not contain path separators');
      }
      const record = { sourcePath, intakePath, platform: capture.platform, sourceId: capture.id, sha256 };
      report.records.push(record);
      report.queued += 1;
      nextState.captures[captureKey] = { ...record, bridgedAt };
      if (!options.dryRun) {
        mkdirSync(dirname(intakePath), { recursive: true });
        writeFileSync(intakePath, intakeEnvelope({ capture, sourcePath, sha256, capturedAt: bridgedAt }), 'utf8');
      }
    } catch (error) {
      report.invalid += 1;
      report.errors.push({ sourcePath, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!options.dryRun && report.queued > 0) writeJsonAtomic(options.state, nextState);
  if (options.quietIfIdle && report.queued === 0 && report.invalid === 0) return;
  process.stdout.write(options.json ? `${JSON.stringify(report)}\n` : renderTextReport(report));
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage()}`);
  process.exitCode = 1;
}
