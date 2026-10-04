// ============================================================
// Kura — capture-plan + vault-writer tests (node context)
// Proves the shared write plan matches FORMAT_SPEC paths and that
// writing it to a File System Access handle is idempotent and
// degrades gracefully when a media CDN fetch fails.
// ============================================================

import { test, expect } from '@playwright/test';
import { buildWritePlan } from '../src/core/capture-plan';
import { writePlan } from '../src/core/vault-writer';
import type { Conversation, DetectionResult, MediaItem } from '../src/core/types';

const realFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

function conversation(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    platform: 'chatgpt',
    title: 'Naming the extension',
    url: 'https://chatgpt.com/c/c1',
    capturedAt: '2026-05-13T22:14:00.000Z',
    messages: [
      { role: 'user', content: 'What should we call it?' },
      { role: 'assistant', content: 'Kura.' },
    ],
    ...over,
  };
}

function detection(over: Partial<DetectionResult> = {}): DetectionResult {
  return {
    platform: 'chatgpt',
    pageType: 'conversation',
    conversations: [conversation()],
    media: [],
    prompts: [],
    stats: { totalConversations: 1, totalImages: 0, totalVideos: 0, totalPrompts: 0 },
    ...over,
  };
}

const OPTIONS = {
  format: 'markdown' as const,
  includeMedia: true,
  includeTimestamps: true,
  includeMetadata: true,
  embedMedia: false,
};

test.describe('buildWritePlan', () => {
  test('emits conversation.md + prompts.md under <platform>/<slug>/', () => {
    const plan = buildWritePlan(detection(), OPTIONS);
    const paths = plan.textFiles.map((f) => f.path).sort();
    expect(paths).toContain('chatgpt/2026-05-13_naming-the-extension/conversation.md');
    expect(paths).toContain('chatgpt/2026-05-13_naming-the-extension/prompts.md');
    expect(paths).toContain('chatgpt/2026-05-13_naming-the-extension/capture.json');
    expect(plan.counts).toEqual({ conversations: 1, media: 0, prompts: 0 });
    expect(plan.folders).toEqual(['chatgpt/2026-05-13_naming-the-extension']);
  });

  test('routes media into its parent conversation folder with a prompt sidecar', () => {
    const media: MediaItem = {
      id: 'm1',
      platform: 'chatgpt',
      type: 'image',
      url: 'https://assets.grok.com/img.png',
      hdUrl: 'https://assets.grok.com/img-hd.png',
      prompt: 'a teal storehouse',
      filename: 'dalle.png',
      capturedAt: '2026-05-13T22:15:00.000Z',
    };
    const plan = buildWritePlan(detection({ media: [media] }), OPTIONS);
    expect(plan.mediaFiles).toEqual([
      { path: 'chatgpt/2026-05-13_naming-the-extension/assets/dalle.png', url: 'https://assets.grok.com/img-hd.png' },
    ]);
    // Sidecar prompt note lands beside the asset.
    expect(plan.textFiles.map((f) => f.path)).toContain(
      'chatgpt/2026-05-13_naming-the-extension/assets/dalle-prompt.md',
    );
  });

  test('media with no parent conversation lands in _loose/', () => {
    const media: MediaItem = {
      id: 'm2',
      platform: 'grok',
      type: 'image',
      url: 'https://assets.grok.com/x.jpg',
      prompt: '',
      filename: 'x.jpg',
      capturedAt: '2026-05-13T22:15:00.000Z',
    };
    const plan = buildWritePlan(
      detection({ platform: 'grok', conversations: [], media: [media] }),
      OPTIONS,
    );
    expect(plan.mediaFiles[0].path).toBe('grok/_loose/x.jpg');
  });
});

// ---------------------------------------------------------- fake FSA

interface FakeFile {
  content: string | Blob;
}

function fakeDirectory(files = new Map<string, FakeFile>(), prefix = ''): FileSystemDirectoryHandle {
  const dirs = new Map<string, FileSystemDirectoryHandle>();
  return {
    name: prefix || 'vault',
    async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
      if (!dirs.has(name)) {
        if (!opts?.create) throw new DOMException('NotFound', 'NotFoundError');
        dirs.set(name, fakeDirectory(files, `${prefix}${name}/`));
      }
      return dirs.get(name)!;
    },
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      const key = `${prefix}${name}`;
      if (!files.has(key)) {
        if (!opts?.create) throw new DOMException('NotFound', 'NotFoundError');
        files.set(key, { content: '' });
      }
      const entry = files.get(key)!;
      return {
        async getFile() { return new File([entry.content], name); },
        async createWritable() {
          const chunks: (string | Blob)[] = [];
          return {
            async write(chunk: string | Blob) {
              chunks.push(chunk);
            },
            async close() {
              entry.content = chunks.length === 1 ? chunks[0] : chunks.map(String).join('');
            },
          };
        },
      };
    },
  } as unknown as FileSystemDirectoryHandle;
}

test.describe('writePlan', () => {
  test('keeps source revisions and refuses a shorter DOM view', async () => {
    const files = new Map<string, FakeFile>();
    const root = fakeDirectory(files);
    const original = buildWritePlan(detection(), OPTIONS);
    await writePlan(root, original);
    const shorter = buildWritePlan(detection({ conversations: [conversation({ messages: [{ role: 'user', content: 'Only a partial view' }] })] }), OPTIONS);
    await expect(writePlan(root, shorter)).rejects.toThrow('more messages');
    const note = original.textFiles.find((file) => file.path.endsWith('/conversation.md'))!;
    expect(files.get(note.path)!.content).toBe(note.content);
    const updated = buildWritePlan(detection({ conversations: [conversation({ messages: [{ role: 'user', content: 'Question' }, { role: 'assistant', content: 'Edited answer' }] })] }), OPTIONS);
    await writePlan(root, updated);
    const history = [...files.entries()].filter(([key]) => key.includes('/_history/') && key.endsWith('/conversation.md'));
    expect(history).toHaveLength(1);
    expect(history[0][1].content).toBe(note.content);
    expect([...files.keys()].filter((key) => key.includes('/_history/') && key.endsWith('/capture.json'))).toHaveLength(1);
    const after = files.get(note.path)!.content;
    await writePlan(root, buildWritePlan(detection({ conversations: [conversation({ capturedAt: '2026-05-13T23:14:00.000Z', messages: [{ role: 'user', content: 'Question' }, { role: 'assistant', content: 'Edited answer' }] })] }), OPTIONS));
    expect(files.get(note.path)!.content).toBe(after);
    expect([...files.keys()].filter((key) => key.includes('/_history/') && key.endsWith('/conversation.md'))).toHaveLength(1);
  });
  test('writes text + media to disk and is idempotent on re-run', async () => {
    const files = new Map<string, FakeFile>();
    const root = fakeDirectory(files);
    globalThis.fetch = (async () => new Response(new Blob(['img-bytes']))) as typeof fetch;

    const plan = {
      textFiles: [{ path: 'chatgpt/slug/conversation.md', content: '---\nid: c1\nstatus: raw\ntags: []\n---\n# hi' }],
      mediaFiles: [{ path: 'chatgpt/slug/assets/a.png', url: 'https://assets.grok.com/a.png' }],
      counts: { conversations: 1, media: 1, prompts: 0 },
      folders: ['chatgpt/slug'],
    };

    const r1 = await writePlan(root, plan);
    expect(r1).toEqual({ written: 2, failed: 0, failedMedia: [], folderMap: {} });
    expect(files.has('chatgpt/slug/conversation.md')).toBe(true);
    expect(files.has('chatgpt/slug/assets/a.png')).toBe(true);

    // Re-running overwrites in place — same file count, no duplicates.
    const before = files.size;
    const r2 = await writePlan(root, plan);
    expect(r2.written).toBe(2);
    expect(files.size).toBe(before);
  });

  test('a failed media fetch is collected, not thrown; text still written', async () => {
    const files = new Map<string, FakeFile>();
    const root = fakeDirectory(files);
    globalThis.fetch = (async () => new Response('nope', { status: 403 })) as typeof fetch;

    const plan = {
      textFiles: [{ path: 'chatgpt/slug/conversation.md', content: '---\nid: c1\nstatus: raw\ntags: []\n---\n# hi' }],
      mediaFiles: [{ path: 'chatgpt/slug/assets/a.png', url: 'https://assets.grok.com/locked.png' }],
      counts: { conversations: 1, media: 1, prompts: 0 },
      folders: ['chatgpt/slug'],
    };

    const res = await writePlan(root, plan);
    expect(res.written).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.failedMedia).toEqual([{ path: 'chatgpt/slug/assets/a.png', url: 'https://assets.grok.com/locked.png', retryable: true }]);
    // The irreplaceable conversation markdown was still written.
    expect(files.has('chatgpt/slug/conversation.md')).toBe(true);
  });
  test('rejects traversal before writing and does not fetch unapproved media', async () => {
    const files = new Map<string, FakeFile>();
    const root = fakeDirectory(files);
    const plan = buildWritePlan(detection(), OPTIONS);
    plan.textFiles.push({ path: 'chatgpt/../outside.md', content: 'unsafe' });
    await expect(writePlan(root, plan)).rejects.toThrow('Invalid capture path');
    expect(files.size).toBe(0);
    plan.textFiles.pop();
    let requests = 0;
    globalThis.fetch = (async () => { requests++; return new Response('unexpected'); }) as typeof fetch;
    plan.mediaFiles.push({ path: `${plan.folders[0]}/assets/a.png`, url: 'https://unapproved.example/a.png' });
    const result = await writePlan(root, plan);
    expect(requests).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.failedMedia[0].retryable).toBe(false);
  });
});
