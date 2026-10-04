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
    if (!key || blocks.has(key)) throw new Error('Ambiguous capture frontmatter.');
    blocks.set(key, block);
  }
  return { blocks, body: match[2] };
}

function identity(blocks: Map<string, string>): string {
  const value = blocks.get('id')?.slice(3).trim();
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
  for (const [key, block] of old.blocks) {
    if (!CAPTURE_FIELDS.has(key)) next.blocks.set(key, block);
  }
  return `---\n${[...next.blocks.values()].join('\n')}\n---\n${next.body}`;
}
