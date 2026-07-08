// ============================================================
// Kura — Suno public profile API client
// Unauthenticated, own-catalog indexing only. Field mapping
// mirrors the proven scrape-suno-profile.mjs pipeline.
// ============================================================

import { SUNO_SCHEMA, type SunoTrack } from './types';

const API = 'https://studio-api.prod.suno.com/api';
const PAGE_DELAY_MS = 200;
const MAX_PAGES = 80;

interface RawClip {
  id: string;
  title?: string;
  created_at?: string;
  play_count?: number;
  upvote_count?: number;
  comment_count?: number;
  is_pinned?: boolean;
  is_public?: boolean;
  model_name?: string;
  major_model_version?: string;
  audio_url?: string;
  video_url?: string;
  image_large_url?: string;
  image_url?: string;
  metadata?: { tags?: string; duration?: number; prompt?: string };
}

interface ProfilePage {
  num_total_clips?: number;
  clips?: RawClip[];
}

async function getJson(url: string, attempt = 1): Promise<ProfilePage> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Suno API ${res.status} after ${attempt} attempts`);
    await sleep(attempt * 1500);
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`Suno API ${res.status}: ${url}`);
  return res.json() as Promise<ProfilePage>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function trimClip(c: RawClip, indexedAt: string): SunoTrack {
  return {
    schema: SUNO_SCHEMA,
    id: c.id,
    title: c.title || 'Untitled',
    createdAt: c.created_at || '',
    plays: c.play_count ?? 0,
    likes: c.upvote_count ?? 0,
    comments: c.comment_count ?? 0,
    pinned: !!c.is_pinned,
    public: !!c.is_public,
    model: c.model_name || c.major_model_version || null,
    styleTags: c.metadata?.tags || null,
    duration: c.metadata?.duration ?? null,
    lyrics: c.metadata?.prompt || null,
    audioUrl: c.audio_url || null,
    videoUrl: c.video_url || null,
    imageUrl: c.image_large_url || c.image_url || null,
    sunoUrl: `https://suno.com/song/${c.id}`,
    indexedAt,
  };
}

function profileUrl(handle: string, page: number): string {
  return `${API}/profiles/${encodeURIComponent(handle)}?page=${page}&clips_sort_by=created_at&playlists_sort_by=upvote_count`;
}

/**
 * Walk the public profile pages and return every public clip.
 *
 * The page param's indexing convention has drifted (page=0 currently aliases
 * the first page; older clients walked 1-indexed). We start at 0, dedupe by
 * id, and only stop after TWO consecutive pages add nothing new — correct
 * under 0-indexed, 1-indexed, and alias behavior alike (verified live
 * 2026-07-08: page0 ≡ page1, 823 clips, 24/page).
 */
export async function fetchCatalog(
  handle: string,
  onProgress: (fetched: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SunoTrack[]> {
  const indexedAt = new Date().toISOString();
  const byId = new Map<string, SunoTrack>();
  let total = 0;
  let emptyStreak = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let json: Awaited<ReturnType<typeof getJson>>;
    try {
      json = await getJson(profileUrl(handle, page));
    } catch (err) {
      if (page === 0) continue; // some deployments reject page=0 — move on to 1
      throw err;
    }
    total = json.num_total_clips ?? total;
    const before = byId.size;
    for (const clip of json.clips ?? []) byId.set(clip.id, trimClip(clip, indexedAt));

    if (byId.size === before) {
      emptyStreak += 1;
      if (emptyStreak >= 2) break;
    } else {
      emptyStreak = 0;
      onProgress(byId.size, total);
    }
    if (total > 0 && byId.size >= total) break;
    await sleep(PAGE_DELAY_MS);
  }

  return Array.from(byId.values());
}
