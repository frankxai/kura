import { MAX_FILE_BYTES, type Discovery, type ImageFormat, type Metadata, type Provider } from './types';

export const PROVIDERS = {
  midjourney: {
    name: 'Midjourney',
    url: 'https://www.midjourney.com/',
    help: 'On your Organize page, select a few of your own images and choose Download. Extract the download, then choose that folder here.',
    docs: 'https://docs.midjourney.com/hc/en-us/articles/33329462451469-Organizing-Your-Creations',
  },
  grok: {
    name: 'Grok',
    url: 'https://grok.com/',
    help: 'Download a few of your own images, or request your data under Settings → Data Controls. Extract the export and choose its image folder here. Extensionless image files are supported.',
    docs: 'https://x.ai/legal/faq',
  },
} as const;

export function imageFormat(bytes: Uint8Array): ImageFormat | null {
  const starts = (...prefix: number[]) => prefix.every((b, i) => bytes[i] === b);
  const text = (a: number, b: number) => new TextDecoder().decode(bytes.slice(a, b));
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'png';
  if (starts(255, 216, 255)) return 'jpg';
  if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return 'gif';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
  if (text(4, 8) === 'ftyp' && ['avif', 'avis'].includes(text(8, 12))) return 'avif';
  return null;
}

export const emptyMetadata = (): Metadata => ({
  prompt: null, createdAt: null, sourceId: null, sourceUrl: null,
  originalUrl: null, model: null, seed: null, settings: null,
});

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? value : null; }
  catch { return null; }
}

/** Only explicit sidecar fields are accepted. Filenames/mtime never become prompts or generation dates. */
export function parseMetadata(raw: unknown): Metadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Metadata must be an object');
  const m = raw as Record<string, unknown>;
  const text = (key: string) => typeof m[key] === 'string' ? m[key] as string : null;
  const created = text('createdAt');
  return {
    prompt: text('prompt'), createdAt: created && !Number.isNaN(Date.parse(created)) ? created : null,
    sourceId: text('sourceId'), sourceUrl: httpsUrl(m.sourceUrl), originalUrl: httpsUrl(m.originalUrl),
    model: text('model'), seed: typeof m.seed === 'string' || typeof m.seed === 'number' ? m.seed : null,
    settings: m.settings && typeof m.settings === 'object' && !Array.isArray(m.settings) ? m.settings as Record<string, unknown> : null,
  };
}

export interface ExportEntry { path: string; file: File }

/** Incremental enumeration; bounded at 2,000 files during the pilot, with an explicit incomplete flag. */
export async function discoverExport(
  provider: Provider, entries: AsyncIterable<ExportEntry>,
  onProgress: (count: number) => void = () => {}, signal?: AbortSignal,
): Promise<Discovery> {
  const result: Discovery = { provider, images: [], examined: 0, ignored: 0, failures: [], complete: true, scope: 'selected-export-folder', providerTotal: null };
  const sidecars = new Map<string, File>();
  for await (const entry of entries) {
    if (signal?.aborted || result.examined >= 2000) { result.complete = false; break; }
    result.examined++;
    if (result.examined % 25 === 0) onProgress(result.examined);
    try {
      const { file, path } = entry;
      if (/\.json$/i.test(path)) { sidecars.set(path, file); result.ignored++; continue; }
      const format = imageFormat(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
      if (!format) {
        if (/\.(png|jpe?g|webp|gif|avif)$/i.test(path)) throw new Error('File does not contain a supported image');
        result.ignored++; continue;
      }
      if (file.size > MAX_FILE_BYTES) throw new Error('Image exceeds the 32 MiB pilot limit');
      result.images.push({ path, file, format, metadata: emptyMetadata(), metadataFile: null, warnings: [] });
    } catch (e) { result.failures.push({ path: entry.path, error: e instanceof Error ? e.message : String(e) }); }
  }
  for (const image of result.images) {
    // Documented Kura companion format, not an assumed vendor JSON schema.
    const sidecar = sidecars.get(`${image.path}.json`);
    if (sidecar) {
      if (sidecar.size > 1024 * 1024) { image.warnings.push('Metadata sidecar exceeds 1 MiB; left in source folder'); continue; }
      image.metadataFile = sidecar;
      try { image.metadata = parseMetadata(JSON.parse(await sidecar.text())); }
      catch { image.warnings.push('Metadata sidecar could not be interpreted; raw copy preserved'); }
    }
  }
  result.images.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}
