const CAPTURE_FIELDS = new Set([
  'id', 'slug', 'title', 'platform', 'source', 'capturedAt', 'capturedBy',
  'schemaVersion', 'messageCount', 'hasMedia', 'hasCode', 'durationApprox',
]);

function splitNote(note: string) {
  const match = note.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error('Existing capture has invalid frontmatter; restore it before recapturing.');
  const blocks = new Map<string, string>();
  for (const block of match[1].split(/\n(?=[a-zA-Z][\w-]*:)/)) {
    const key = block.match(/^([a-zA-Z][\w-]*):/)?.[1];
    if (!key) continue;
    if (blocks.has(key)) throw new Error('Ambiguous capture frontmatter.');
    blocks.set(key, block);
  }
  return { blocks, yaml: match[1], body: match[2] };
}

function identity(blocks: Map<string, string>): string {
  const value = blocks.get('id')?.slice(3).trim().match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^#\n]+)/)?.[1].trim();
  if (!value) throw new Error('Missing capture identity.');
  if (value.startsWith('"')) return JSON.parse(value) as string;
  if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/** Preserve curated YAML verbatim and refuse to overwrite another conversation. */
export function mergeRecapture(existing: string, incoming: string): string {
  const old = splitNote(existing);
  const next = splitNote(incoming);
  if (identity(old.blocks) !== identity(next.blocks)) throw new Error('Capture folder belongs to another conversation.');
  const count = (blocks: Map<string, string>) => {
    const value = blocks.get('messageCount')?.match(/^messageCount:\s*(\d+)(?:\s+#.*)?$/)?.[1];
    return value === undefined ? null : Number(value);
  };
  const before = count(old.blocks), after = count(next.blocks);
  if (before !== null && after !== null && after < before) {
    throw new Error('The saved thread has more messages. Open the full conversation before saving again.');
  }
  // Update only capture-owned keys in the existing YAML. Unknown keys, Unicode
  // keys, quoted keys and comments remain exactly where the user put them.
  let yaml = old.yaml;
  for (const key of CAPTURE_FIELDS) {
    const block = next.blocks.get(key);
    if (!block) continue;
    const expression = new RegExp(`^${key}:[^\\n]*(?:\\n[ \\t]+[^\\n]*)*`, 'm');
    const replacement = block.split(/\n(?=[^ \t])/)[0];
    yaml = expression.test(yaml) ? yaml.replace(expression, () => replacement) : `${yaml}\n${replacement}`;
  }
  return `---\n${yaml}\n---\n${next.body}`;
}
