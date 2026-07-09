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
    expect(plan.counts).toEqual({ conversations: 1, media: 0, prompts: 0 });
    expect(plan.folders).toEqual(['chatgpt/2026-05-13_naming-the-extension']);
  });

  test('routes media into its parent conversation folder with a prompt sidecar', () => {
    const media: MediaItem = {
      id: 'm1',
      platform: 'chatgpt',
      type: 'image',
      url: 'https://cdn.example/img.png',
      hdUrl: 'https://cdn.example/img-hd.png',
      prompt: 'a teal storehouse',
      filename: 'dalle.png',
      capturedAt: '2026-05-13T22:15:00.000Z',
    };
    const plan = buildWritePlan(detection({ media: [media] }), OPTIONS);
    expect(plan.mediaFiles).toEqual([
      { path: 'chatgpt/2026-05-13_naming-the-extension/assets/dalle.png', url: 'https://cdn.example/img-hd.png' },
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
      url: 'https://cdn.example/x.jpg',
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
  test('writes text + media to disk and is idempotent on re-run', async () => {
    const files = new Map<string, FakeFile>();
    const root = fakeDirectory(files);
    globalThis.fetch = (async () => new Response(new Blob(['img-bytes']))) as typeof fetch;

    const plan = {
      textFiles: [{ path: 'chatgpt/slug/conversation.md', content: '# hi' }],
      mediaFiles: [{ path: 'chatgpt/slug/assets/a.png', url: 'https://cdn/a.png' }],
      counts: { conversations: 1, media: 1, prompts: 0 },
      folders: ['chatgpt/slug'],
    };

    const r1 = await writePlan(root, plan);
    expect(r1).toEqual({ written: 2, failed: 0, failedMedia: [] });
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
      textFiles: [{ path: 'chatgpt/slug/conversation.md', content: '# hi' }],
      mediaFiles: [{ path: 'chatgpt/slug/assets/a.png', url: 'https://locked-cdn/a.png' }],
      counts: { conversations: 1, media: 1, prompts: 0 },
      folders: ['chatgpt/slug'],
    };

    const res = await writePlan(root, plan);
    expect(res.written).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.failedMedia).toEqual([{ path: 'chatgpt/slug/assets/a.png', url: 'https://locked-cdn/a.png' }]);
    // The irreplaceable conversation markdown was still written.
    expect(files.has('chatgpt/slug/conversation.md')).toBe(true);
  });
});
