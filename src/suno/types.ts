// ============================================================
// Kura — Suno Harvester types (schema kura-suno/1)
// ============================================================

export const SUNO_SCHEMA = 'kura-suno/1';

/** One row in suno/catalog.jsonl. */
export interface SunoTrack {
  schema: typeof SUNO_SCHEMA;
  id: string;
  title: string;
  createdAt: string;
  plays: number;
  likes: number;
  comments: number;
  pinned: boolean;
  public: boolean;
  model: string | null;
  styleTags: string | null;
  duration: number | null;
  lyrics: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  sunoUrl: string;
  indexedAt: string;
}

/** suno/flags.json — the file-based interchange with agents. */
export interface SunoFlags {
  version: 1;
  flags: Record<string, { audio: boolean; video: boolean; note?: string }>;
}

/** suno/downloads.json — ledger of completed downloads. */
export type DownloadLedger = Record<
  string,
  { audio: string | null; video: string | null; cover: string | null; at: string }
>;

export interface HarvestProgress {
  phase: 'idle' | 'indexing' | 'downloading' | 'done' | 'cancelled' | 'error';
  total: number;
  completed: number;
  failed: number;
  currentTitle?: string;
  message?: string;
}
