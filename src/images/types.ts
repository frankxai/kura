export type Provider = 'midjourney' | 'grok';
export type ImageFormat = 'png' | 'jpg' | 'webp' | 'gif' | 'avif';
export interface Metadata {
  prompt: string | null;
  createdAt: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  originalUrl: string | null;
  model: string | null;
  seed: string | number | null;
  settings: Record<string, unknown> | null;
}
export interface SourceImage {
  path: string;
  file: File;
  format: ImageFormat;
  metadata: Metadata;
  metadataFile: File | null;
  warnings: string[];
}
export interface Discovery {
  provider: Provider;
  images: SourceImage[];
  examined: number;
  ignored: number;
  failures: { path: string; error: string }[];
  complete: boolean;
  scope: 'selected-export-folder';
  providerTotal: null;
}
export interface Receipt extends Metadata {
  schemaVersion: 1;
  kind: 'imported-image';
  provider: Provider;
  sha256: string;
  bytes: number;
  format: ImageFormat;
  originalPath: string;
  thumbnailPath: string;
  sourcePath: string;
  sourceFileModifiedAt: string;
  metadataPath: string | null;
  importedAt: string;
  width: number;
  height: number;
  warnings: string[];
}
export interface ImportItem {
  path: string;
  state: 'pending' | 'imported' | 'skipped' | 'failed';
  receiptPath?: string;
  error?: string;
}
export interface Checkpoint {
  schemaVersion: 1;
  id: string;
  provider: Provider;
  scope: 'selected-export-folder';
  providerTotal: null;
  discovered: number;
  discoveryComplete: boolean;
  selected: number;
  estimatedBytes: number;
  status: 'running' | 'paused' | 'finished';
  updatedAt: string;
  items: ImportItem[];
}
/** All paths are relative to the user-selected vault. No network transport. */
export interface ImageDisk {
  read(path: string): Promise<Blob | null>;
  write(path: string, data: Blob | string): Promise<void>;
  list(path: string): Promise<string[]>;
}
export interface Preview {
  thumbnail: Blob;
  width: number;
  height: number;
}
export const IMAGE_ROOT = '_image-library/v1';
export const PILOT_LIMIT = 10;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_BATCH_BYTES = 200 * 1024 * 1024;
