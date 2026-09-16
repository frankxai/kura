import { loadDirectory, pickDirectory } from '@/core/fs';
import { discoverExport, PROVIDERS, type ExportEntry } from '@/images/adapters';
import { directoryDisk, folderEntries, createPreview } from '@/images/disk';
import { estimateBytes, importPilot, loadGallery, loadLatestImport, sha256, totals } from '@/images/importer';
import { MAX_BATCH_BYTES, PILOT_LIMIT, type Checkpoint, type Discovery, type ImageDisk, type Provider, type Receipt } from '@/images/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const dialog = $<HTMLDialogElement>('import-dialog');
const details = $<HTMLDialogElement>('detail-dialog');
const run = $<HTMLButtonElement>('run-import');
let root: FileSystemDirectoryHandle | null = null;
let disk: ImageDisk | null = null;
let discovery: Discovery | null = null;
let provider: Provider = 'midjourney';
let selected = new Set<string>();
let library: Receipt[] = [];
let busy = false;
let scanning = false;
let controller: AbortController | null = null;
let latestJob: Checkpoint | null = null;
let page = 0, selectionPage = 0, renderVersion = 0;
let galleryUrls: string[] = [], selectionUrls: string[] = [];
let detailUrl: string | null = null;
const PAGE_SIZE = 24;
const SELECTION_PAGE_SIZE = 12;
const bytes = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1024 / 1024).toFixed(1)} MiB`;
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
const revoke = (urls: string[]) => urls.forEach(url => URL.revokeObjectURL(url));
function status(text: string) { $('import-status').textContent = text; }
function notice(text: string) { $('notice').textContent = text; }

function updateProvider() {
  $('provider-help').textContent = PROVIDERS[provider].help;
  $<HTMLAnchorElement>('provider-docs').href = PROVIDERS[provider].docs;
}
function selectedImages() { return discovery?.images.filter(i => selected.has(i.path)) ?? []; }
function updateAdmission() {
  const images = selectedImages();
  const estimate = estimateBytes(images);
  $('estimate').textContent = images.length
    ? `${images.length} selected · ${bytes(images.reduce((n, i) => n + i.file.size, 0))} of source images · allow ${bytes(estimate)} on ${root?.name ?? 'your destination drive'}.`
    : 'Select up to 10 images. Exact source sizes will appear here.';
  run.disabled = busy || scanning || !disk || !images.length || images.length > PILOT_LIMIT || estimate > MAX_BATCH_BYTES || !$<HTMLInputElement>('admission').checked;
  run.textContent = busy ? 'Importing…' : latestJob?.status === 'paused' ? 'Resume selected images' : 'Import selected images';
}
async function connect() {
  try {
    root = await pickDirectory('kura_vault');
    disk = directoryDisk(root);
    $('connect').textContent = `${root.name} · Connected`;
    $('destination').textContent = `${root.name} · Change folder`;
    $<HTMLInputElement>('admission').checked = false;
    await refreshLibrary();
    updateAdmission();
  } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) { status(errorText(e)); notice(errorText(e)); } }
}
async function refreshLibrary() {
  if (!disk) return;
  const loaded = await loadGallery(disk);
  library = loaded.images;
  notice(loaded.errors.length ? `${loaded.errors.length} receipt(s) could not be read. Files are untouched. ${loaded.errors.join('; ')}` : `Connected to ${root?.name}. ${library.length} saved images. Originals stay on this drive; your library is not synced to the cloud.`);
  const previous = await loadLatestImport(disk);
  if (previous && !busy && (previous.status !== 'finished' || totals(previous).failed > 0)) {
    showProgress(previous);
    notice(`Your last ${PROVIDERS[previous.provider].name} import has ${totals(previous).pending} pending and ${totals(previous).failed} failed files. Open Import images and reselect the same export to resume. Saved originals are verified and skipped.`);
  }
  await renderGallery();
}
function filteredLibrary() {
  const query = $<HTMLInputElement>('search').value.trim().toLowerCase();
  const filter = $<HTMLSelectElement>('provider-filter').value;
  const since = $<HTMLInputElement>('date-filter').value;
  return library.filter(r => (!filter || r.provider === filter)
    && (!query || `${r.prompt ?? ''} ${r.sourcePath}`.toLowerCase().includes(query))
    && (!since || r.importedAt.slice(0, 10) >= since));
}
async function renderGallery() {
  const version = ++renderVersion;
  revoke(galleryUrls); galleryUrls = [];
  const items = filteredLibrary();
  page = Math.max(0, Math.min(page, Math.ceil(items.length / PAGE_SIZE) - 1));
  $('count').textContent = `${items.length} image${items.length === 1 ? '' : 's'}`;
  $('gallery').replaceChildren();
  $('empty').hidden = items.length > 0;
  if (!items.length && library.length) {
    $('empty').querySelector('h2')!.textContent = 'No images match these filters.';
    $('empty').querySelector('p')!.textContent = 'Try another prompt, provider, or import date.';
  } else if (!library.length) {
    $('empty').querySelector('h2')!.textContent = 'A home for your imagination.';
    $('empty').querySelector('p')!.textContent = 'Start with a few images from each provider. We’ll check every original before adding it to your library.';
  }
  $('previous').hidden = page === 0;
  $('next').hidden = (page + 1) * PAGE_SIZE >= items.length;
  $('page-label').textContent = items.length > PAGE_SIZE ? `Page ${page + 1} of ${Math.ceil(items.length / PAGE_SIZE)}` : '';
  for (const receipt of items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
    const card = document.createElement('button'); card.className = 'image-card';
    const img = document.createElement('img'); img.alt = receipt.prompt ?? receipt.sourcePath; img.loading = 'lazy';
    const body = document.createElement('div'); body.className = 'card-body';
    const label = document.createElement('span'); label.className = 'card-provider'; label.textContent = PROVIDERS[receipt.provider].name;
    const title = document.createElement('p'); title.className = 'card-title'; title.textContent = receipt.prompt || receipt.sourcePath.split('/').at(-1)!;
    const meta = document.createElement('span'); meta.className = 'card-meta'; meta.textContent = `${receipt.width} × ${receipt.height} · ${bytes(receipt.bytes)} · Saved ${date(receipt.importedAt)}`;
    body.append(label, title, meta); card.append(img, body); card.addEventListener('click', () => void showDetails(receipt));
    $('gallery').append(card);
    try {
      const thumbnail = await disk!.read(receipt.thumbnailPath);
      if (version !== renderVersion) return;
      if (thumbnail) { const url = URL.createObjectURL(thumbnail); galleryUrls.push(url); img.src = url; }
      else img.alt = 'Preview unavailable — open details to check the original';
    } catch { img.alt = 'Preview unavailable — reconnect your folder'; }
  }
}
async function showDetails(receipt: Receipt) {
  if (detailUrl) URL.revokeObjectURL(detailUrl);
  detailUrl = null;
  $<HTMLImageElement>('detail-image').removeAttribute('src');
  $<HTMLImageElement>('detail-image').alt = receipt.prompt ?? receipt.sourcePath;
  $('detail-prompt').textContent = receipt.prompt ?? 'Prompt not included in the export.';
  $('detail-metadata').replaceChildren();
  const fields: [string, unknown][] = [
    ['Provider', PROVIDERS[receipt.provider].name], ['Origin', 'Imported from your local export'],
    ['Source file', receipt.sourcePath], ['Generated', receipt.createdAt ?? 'Unknown'], ['Imported', receipt.importedAt],
    ['Source / job ID', receipt.sourceId ?? 'Unknown'], ['Model', receipt.model ?? 'Unknown'], ['Seed', receipt.seed ?? 'Unknown'],
    ['Settings', receipt.settings ? JSON.stringify(receipt.settings) : 'Unknown'],
    ['Resolution', `${receipt.width} × ${receipt.height}`], ['Original', receipt.originalPath],
    ['SHA-256', receipt.sha256], ['Source URL', receipt.sourceUrl ?? 'Unknown'], ['Original URL', receipt.originalUrl ?? 'Unknown'],
  ];
  for (const [key, value] of fields) {
    const dt = document.createElement('dt'); dt.textContent = key;
    const dd = document.createElement('dd'); dd.textContent = String(value);
    $('detail-metadata').append(dt, dd);
  }
  $('detail-status').textContent = receipt.warnings.join(' · ');
  details.showModal();
  try {
    const thumbnail = await disk!.read(receipt.thumbnailPath);
    if (thumbnail && details.open) { detailUrl = URL.createObjectURL(thumbnail); $<HTMLImageElement>('detail-image').src = detailUrl; }
  } catch { $('detail-status').textContent = 'Preview unavailable. Reconnect your folder to check the original.'; }
  $<HTMLButtonElement>('open-original').onclick = async () => {
    const button = $<HTMLButtonElement>('open-original'); button.disabled = true;
    try {
      const file = await disk!.read(receipt.originalPath);
      if (!file || await sha256(file) !== receipt.sha256) throw new Error('Original is missing or changed. Restore the archived file before opening.');
      const url = URL.createObjectURL(file.slice(0, file.size, receipt.format === 'jpg' ? 'image/jpeg' : `image/${receipt.format}`));
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      $('detail-status').textContent = 'Original verified against its saved SHA-256 checksum.';
    } catch (e) { $('detail-status').textContent = errorText(e); }
    finally { button.disabled = false; }
  };
}
function showImport() { if (!dialog.open) dialog.showModal(); }
function clearSource() {
  discovery = null; selected.clear(); latestJob = null; selectionPage = 0;
  revoke(selectionUrls); selectionUrls = [];
  $('selection').replaceChildren(); $('discovery-errors').replaceChildren();
  $('scan-summary').textContent = 'Choose files to see what will be imported. Nothing is copied yet.';
  $('progress-section').hidden = true;
  updateAdmission();
}
async function scan(entries: AsyncIterable<ExportEntry>) {
  clearSource(); scanning = true; controller = new AbortController(); setBusyControls();
  try {
    status('Reading image headers…');
    discovery = await discoverExport(provider, entries, n => status(`Checked ${n} export files…`), controller.signal);
    selected = new Set(discovery.images.slice(0, PILOT_LIMIT).map(i => i.path));
    $('scan-summary').textContent = `${discovery.images.length} images found · ${discovery.ignored} other files · ${discovery.failures.length} unreadable. ${discovery.complete ? 'Selected folder fully scanned.' : 'Scan stopped at its limit; choose a smaller folder.'} Provider library total: unknown.`;
    for (const failure of discovery.failures) { const p = document.createElement('p'); p.textContent = `${failure.path}: ${failure.error}`; $('discovery-errors').append(p); }
    await renderSelection();
    status(discovery.images.length ? 'Preview ready. Choose a destination and check available space.' : 'No supported images found. Extract the download and select its image folder.');
  } catch (e) { status(errorText(e)); }
  finally { scanning = false; setBusyControls(); updateAdmission(); }
}
async function renderSelection() {
  revoke(selectionUrls); selectionUrls = []; $('selection').replaceChildren();
  const images = discovery?.images ?? [];
  $('select-previous').hidden = selectionPage === 0;
  $('select-next').hidden = (selectionPage + 1) * SELECTION_PAGE_SIZE >= images.length;
  $('selection-page').textContent = images.length > SELECTION_PAGE_SIZE ? `Page ${selectionPage + 1} of ${Math.ceil(images.length / SELECTION_PAGE_SIZE)}` : '';
  for (const image of images.slice(selectionPage * SELECTION_PAGE_SIZE, (selectionPage + 1) * SELECTION_PAGE_SIZE)) {
    const label = document.createElement('label');
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(image.path); check.setAttribute('aria-label', `Select ${image.path}`);
    check.onchange = () => {
      if (check.checked && selected.size >= PILOT_LIMIT) { check.checked = false; status('Keep the pilot to 10 images. Deselect one to choose another.'); return; }
      if (check.checked) selected.add(image.path); else selected.delete(image.path);
      updateAdmission();
    };
    const img = document.createElement('img'); img.alt = image.metadata.prompt ?? image.path; img.loading = 'lazy';
    const url = URL.createObjectURL(image.file); selectionUrls.push(url); img.src = url;
    const name = document.createElement('span'); name.textContent = image.path; name.title = image.path;
    label.append(check, img, name); $('selection').append(label);
  }
  updateAdmission();
}
function setBusyControls() {
  $<HTMLFieldSetElement>('source-controls').disabled = busy || scanning;
  for (const id of ['connect','destination','select-next','select-previous']) $<HTMLButtonElement>(id).disabled = busy || scanning;
  for (const input of $('selection').querySelectorAll('input')) input.disabled = busy || scanning;
  $('pause').hidden = !busy;
}
function showProgress(job: Checkpoint) {
  latestJob = job;
  const count = totals(job);
  $('progress-section').hidden = false;
  $('progress-title').textContent = job.status === 'paused' ? 'Paused — progress saved' : job.status === 'finished' ? count.failed ? 'Finished with files to review' : 'Import checked and saved' : 'Preserving your originals…';
  $<HTMLProgressElement>('progress').max = job.selected;
  $<HTMLProgressElement>('progress').value = count.imported + count.skipped + count.failed;
  $('progress-counts').textContent = `${count.imported} imported · ${count.skipped} already saved · ${count.failed} failed · ${count.pending} pending. ${job.selected} selected from ${job.discovered} discovered.`;
  $('failures').replaceChildren();
  for (const item of job.items.filter(i => i.state === 'failed')) {
    const li = document.createElement('li'); li.textContent = `${item.path}: ${item.error}`; $('failures').append(li);
  }
}
run.addEventListener('click', async () => {
  if (run.disabled || !disk || !discovery) return;
  busy = true; controller = new AbortController(); setBusyControls(); updateAdmission();
  try {
    // Serialize across gallery tabs sharing this extension origin.
    await navigator.locks.request('kura-image-import', { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('An image import is already running in another Kura tab.');
      await importPilot({ disk: disk!, discovery: discovery!, images: selectedImages(), preview: createPreview, signal: controller!.signal, onProgress: showProgress });
    });
    status(latestJob?.status === 'paused' ? 'Paused. Resume here, or reselect the same export after reopening Kura.' : 'Saved. Repeating this selection verifies and skips existing originals. Failed files can be retried with the same selection.');
    await refreshLibrary();
  } catch (e) { status(errorText(e)); }
  finally { busy = false; setBusyControls(); updateAdmission(); }
});
$('pause').onclick = () => { controller?.abort(); status('Pausing after the current file is safely recorded…'); };
$('choose-source').onclick = async () => {
  try {
    const source = await window.showDirectoryPicker({ id: 'kura-image-source', mode: 'read' });
    await scan(folderEntries(source));
  } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) status(errorText(e)); }
};
$<HTMLInputElement>('choose-files').onchange = async event => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  async function* entries() { for (const file of files) yield { path: file.webkitRelativePath || file.name, file }; }
  if (files.length) await scan(entries());
  input.value = '';
};
for (const input of document.querySelectorAll<HTMLInputElement>('input[name=provider]')) input.onchange = () => { provider = input.value as Provider; clearSource(); updateProvider(); };
for (const id of ['open-import', 'empty-import']) $(id).onclick = showImport;
for (const id of ['connect', 'destination']) $(id).onclick = () => void connect();
$('close-import').onclick = () => dialog.close();
$('close-detail').onclick = () => details.close();
$('admission').onchange = updateAdmission;
for (const id of ['search','provider-filter','date-filter']) $(id).addEventListener('input', () => { page = 0; void renderGallery(); });
$('previous').onclick = () => { page--; void renderGallery(); };
$('next').onclick = () => { page++; void renderGallery(); };
$('select-previous').onclick = () => { selectionPage--; void renderSelection(); };
$('select-next').onclick = () => { selectionPage++; void renderSelection(); };
window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
updateProvider();
void (async () => {
  try {
    root = await loadDirectory('kura_vault');
    if (root) { disk = directoryDisk(root); $('connect').textContent = `${root.name} · Connected`; $('destination').textContent = `${root.name} · Change folder`; await refreshLibrary(); }
  } catch (e) { notice(`Reconnect your Kura folder. ${errorText(e)}`); }
  if (!window.showDirectoryPicker) { notice('Import requires desktop Chrome or Edge with folder access. Mobile and cloud viewing are not available yet.'); run.disabled = true; }
})();
