// ============================================================
// Kura — Suno harvester logic tests (node context, no browser)
// Locks in the two behaviors proven against the live API on
// 2026-07-08: the page-0-alias pagination walk and the
// idempotent flagged-download ledger.
// ============================================================

import { test, expect } from '@playwright/test';
import { fetchCatalog } from '../src/suno/api';
import { fetchFlagged, readLedger, setFlag } from '../src/suno/harvester';
import type { SunoTrack } from '../src/suno/types';

const realFetch = globalThis.fetch;

function clip(id: string) {
  return {
    id,
    title: `Track ${id}`,
    created_at: '2026-07-01T00:00:00.000Z',
    play_count: 1,
    upvote_count: 0,
    is_public: true,
    audio_url: `https://cdn1.suno.ai/${id}.mp3`,
    video_url: `https://cdn1.suno.ai/${id}.mp4`,
    metadata: { duration: 60 },
  };
}

/** Serve profile pages from a map of page-number → clip ids. */
function mockProfileApi(pages: Record<number, string[] | 'reject'>, total: number): void {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    const spec = pages[page] ?? [];
    if (spec === 'reject') return new Response('unprocessable', { status: 422 });
    return Response.json({ num_total_clips: total, clips: spec.map(clip) });
  }) as typeof fetch;
}

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test.describe('fetchCatalog pagination walk', () => {
  test('page 0 aliasing page 1 (live behavior) still captures everything', async () => {
    // page0 ≡ page1 — the naive stop-on-no-new-clips walk dies at 3 here.
    mockProfileApi(
      { 0: ['a', 'b', 'c'], 1: ['a', 'b', 'c'], 2: ['d', 'e', 'f'], 3: ['g'] },
      7,
    );
    const tracks = await fetchCatalog('test', () => {});
    expect(tracks.map((t) => t.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  test('true 0-indexed pages capture everything', async () => {
    mockProfileApi({ 0: ['a', 'b'], 1: ['c', 'd'], 2: ['e'] }, 5);
    const tracks = await fetchCatalog('test', () => {});
    expect(tracks).toHaveLength(5);
  });

  test('1-indexed API that rejects page 0 capture everything', async () => {
    mockProfileApi({ 0: 'reject', 1: ['a', 'b'], 2: ['c'] }, 3);
    const tracks = await fetchCatalog('test', () => {});
    expect(tracks.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
  });

  test('stops without total when two consecutive pages add nothing', async () => {
    mockProfileApi({ 0: ['a'], 1: ['a'], 2: ['a'] }, 0);
    const tracks = await fetchCatalog('test', () => {});
    expect(tracks).toHaveLength(1);
  });
});

// ---------------------------------------------------------- fake FSA

interface FakeFile {
  content: string | Blob;
}

function fakeDirectory(files = new Map<string, FakeFile>(), prefix = ''): FileSystemDirectoryHandle {
  const dirs = new Map<string, FileSystemDirectoryHandle>();
  return {
    name: prefix || 'root',
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
        async getFile() {
          return {
            async text() {
              const c = entry.content;
              return typeof c === 'string' ? c : await c.text();
            },
          };
        },
      };
    },
  } as unknown as FileSystemDirectoryHandle;
}

function track(id: string): SunoTrack {
  return {
    schema: 'kura-suno/1',
    id,
    title: `Track ${id}`,
    createdAt: '2026-07-01T00:00:00.000Z',
    plays: 0,
    likes: 0,
    comments: 0,
    pinned: false,
    public: true,
    model: null,
    styleTags: null,
    duration: 60,
    lyrics: null,
    audioUrl: `https://cdn1.suno.ai/${id}.mp3`,
    videoUrl: `https://cdn1.suno.ai/${id}.mp4`,
    imageUrl: null,
    sunoUrl: `https://suno.com/song/${id}`,
    indexedAt: '2026-07-08T00:00:00.000Z',
  };
}

test.describe('fetchFlagged ledger idempotency', () => {
  test('downloads only flagged, not-yet-fetched tracks and updates the ledger', async () => {
    const files = new Map<string, FakeFile>();
    const root = fakeDirectory(files);
    const catalog = [track('aaaa1111'), track('bbbb2222'), track('cccc3333')];

    // Flag two of three; pretend one of the flagged is already fetched.
    await setFlag(root, 'aaaa1111', { audio: true, video: true });
    await setFlag(root, 'bbbb2222', { audio: true, video: true });
    files.set('suno/downloads.json', {
      content: JSON.stringify({
        aaaa1111: { audio: 'suno/audio/x.mp3', video: null, cover: null, at: 'earlier' },
      }),
    });

    const fetched: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      fetched.push(String(url));
      return new Response(new Blob(['audio-bytes']));
    }) as typeof fetch;

    const result = await fetchFlagged(root, catalog, false, () => {});

    // Only bbbb2222 is flagged AND missing from the ledger.
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
    expect(fetched).toEqual(['https://cdn1.suno.ai/bbbb2222.mp3']);

    const ledger = await readLedger(root);
    expect(ledger['bbbb2222'].audio).toContain('suno/audio/2026-07-01_track-bbbb2222_bbbb2222.mp3');
    expect(files.has('suno/audio/2026-07-01_track-bbbb2222_bbbb2222.mp3')).toBe(true);

    // A second run finds nothing left to do.
    fetched.length = 0;
    const rerun = await fetchFlagged(root, catalog, false, () => {});
    expect(rerun.completed).toBe(0);
    expect(fetched).toEqual([]);
  });
});
