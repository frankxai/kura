import { test, expect } from '@playwright/test';
import { fetchCatalog } from '../src/suno/api';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const realFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test.describe('fetchCatalog parsing and normalizing', () => {
  test('correctly parses and normalizes Suno tracks from fixture data', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'suno-profile.json');
    const fixtureData = await fs.readFile(fixturePath, 'utf-8');
    const json = JSON.parse(fixtureData);

    globalThis.fetch = (async (reqInfo: RequestInfo | URL) => {
      const urlStr = String(reqInfo);
      const page = Number(new URL(urlStr).searchParams.get('page'));
      if (page === 0) {
        return Response.json(json);
      }
      return Response.json({ num_total_clips: json.num_total_clips, clips: [] });
    }) as typeof fetch;

    const tracks = await fetchCatalog('test-handle', () => {});

    expect(tracks).toHaveLength(3);

    const full = tracks.find((t) => t.id === 'clip-full')!;
    expect(full.title).toBe('Full Song');
    expect(full.createdAt).toBe('2024-05-10T15:30:00.000Z');
    expect(full.plays).toBe(100);
    expect(full.likes).toBe(10);
    expect(full.comments).toBe(5);
    expect(full.pinned).toBe(true);
    expect(full.public).toBe(true);
    expect(full.model).toBe('chirp-v3-5');
    expect(full.styleTags).toBe('pop, rock');
    expect(full.duration).toBe(120.5);
    expect(full.lyrics).toBe('Write a song about testing');
    expect(full.audioUrl).toBe('https://cdn1.suno.ai/clip-full.mp3');
    expect(full.videoUrl).toBe('https://cdn1.suno.ai/clip-full.mp4');
    expect(full.imageUrl).toBe('https://cdn1.suno.ai/image_large.jpeg');
    expect(full.sunoUrl).toBe('https://suno.com/song/clip-full');
    expect(full.indexedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    const minimal = tracks.find((t) => t.id === 'clip-minimal')!;
    expect(minimal.title).toBe('Untitled');
    expect(minimal.createdAt).toBe('');
    expect(minimal.plays).toBe(0);
    expect(minimal.likes).toBe(0);
    expect(minimal.comments).toBe(0);
    expect(minimal.pinned).toBe(false);
    expect(minimal.public).toBe(false);
    expect(minimal.model).toBeNull();
    expect(minimal.styleTags).toBeNull();
    expect(minimal.duration).toBeNull();
    expect(minimal.lyrics).toBeNull();
    expect(minimal.audioUrl).toBeNull();
    expect(minimal.videoUrl).toBeNull();
    expect(minimal.imageUrl).toBeNull();

    const fallbacks = tracks.find((t) => t.id === 'clip-fallbacks')!;
    expect(fallbacks.title).toBe('Untitled');
    expect(fallbacks.model).toBe('v3.0');
    expect(fallbacks.imageUrl).toBe('https://cdn1.suno.ai/fallback.jpeg');
  });
});
