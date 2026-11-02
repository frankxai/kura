import type { Conversation } from '@/core/types';
import { BRANDS, RECIPES, compileTask, taskMarkdown, type BrandId, type SourceScope, type TaskPacket } from '@/studio/task';

export function initStudio(): { onShow: () => Promise<void> } {
  const brand = document.getElementById('studio-brand') as HTMLSelectElement;
  const recipe = document.getElementById('studio-recipe') as HTMLSelectElement;
  const source = document.getElementById('studio-source') as HTMLSelectElement;
  const scope = document.getElementById('studio-scope') as HTMLSelectElement;
  const objective = document.getElementById('studio-objective') as HTMLTextAreaElement;
  const form = document.getElementById('studio-form') as HTMLElement;
  const prepare = document.getElementById('studio-prepare') as HTMLButtonElement;
  const status = document.getElementById('studio-status')!;
  const preview = document.getElementById('studio-preview') as HTMLTextAreaElement;
  const result = document.getElementById('studio-result')!;
  const home = document.getElementById('studio-home') as HTMLAnchorElement;
  const job = document.getElementById('studio-job')!;
  let captures: Conversation[] = [];
  let packet: TaskPacket | undefined;
  let revision = 0;
  let loadRequest = 0;

  function invalidate(): void {
    revision++;
    packet = undefined;
    preview.value = '';
    result.hidden = true;
    status.textContent = 'Prepare a brief to review exactly what it includes.';
  }

  function updateBrand(): void {
    const selected = brand.value as BrandId;
    recipe.replaceChildren();
    for (const r of RECIPES.filter((r) => r.brand === selected)) recipe.add(new window.Option(r.name, r.id));
    job.textContent = BRANDS[selected].job;
    home.href = BRANDS[selected].home;
    home.textContent = `Open ${BRANDS[selected].name}`;
    invalidate();
  }

  for (const [id, b] of Object.entries(BRANDS)) brand.add(new window.Option(b.name, id));
  brand.addEventListener('change', updateBrand);
  for (const element of [recipe, source, scope, objective]) element.addEventListener('input', invalidate);
  updateBrand();

  async function loadCaptures(): Promise<void> {
    const request = ++loadRequest;
    invalidate();
    captures = [];
    source.replaceChildren(new window.Option('Loading local captures…', ''));
    prepare.disabled = true;
    source.disabled = true;
    status.textContent = 'Loading local captures…';
    try {
      const response: unknown = await chrome.runtime.sendMessage({ type: 'KURA_LIST_CONVERSATIONS' });
      if (request !== loadRequest) return;
      if (!Array.isArray(response)) throw new Error('The local library is unavailable. Reload Kura and retry.');
      invalidate();
      captures = response.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages));
      captures.sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
      source.replaceChildren(new window.Option(captures.length ? 'Choose a capture' : 'No captures yet', ''));
      captures.forEach((c, i) => source.add(new window.Option(`${String(c.platform)} · ${String(c.title || 'Untitled')}`, String(i))));
      source.disabled = !captures.length;
      prepare.disabled = !captures.length;
      status.textContent = captures.length ? 'Choose one capture. Preparing stays on this device.' : 'Capture an AI conversation first, then refresh this list.';
    } catch (error) {
      if (request !== loadRequest) return;
      captures = [];
      source.replaceChildren(new window.Option('Library unavailable', ''));
      status.textContent = error instanceof Error ? error.message : 'Could not load local captures. Retry refresh.';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    invalidate();
    const currentRevision = revision;
    prepare.disabled = true;
    status.textContent = 'Preparing your brief…';
    try {
      if (source.value === '') throw new Error('Choose a capture first.');
      const next = await compileTask({ brand: brand.value as BrandId, recipeId: recipe.value, objective: objective.value, conversation: captures[Number(source.value)], scope: scope.value as SourceScope });
      if (currentRevision !== revision) return;
      packet = next;
      preview.value = taskMarkdown(next);
      result.hidden = false;
      status.textContent = `Prepared locally · ${next.source.messages.length} of ${next.source.totalMessages} messages · no AI request sent.`;
    } catch (error) {
      if (currentRevision === revision) status.textContent = error instanceof Error ? error.message : 'Could not prepare the brief.';
    } finally {
      prepare.disabled = !captures.length;
    }
  });

  document.getElementById('studio-refresh')!.addEventListener('click', () => void loadCaptures());
  document.getElementById('studio-copy')!.addEventListener('click', async () => {
    if (!packet) return;
    try {
      await navigator.clipboard.writeText(taskMarkdown(packet));
      status.textContent = 'Copied. Paste into the AI app you choose; this has not sent a prompt.';
    } catch {
      preview.focus();
      preview.select();
      status.textContent = 'Clipboard unavailable. The brief is selected for manual copy.';
    }
  });

  async function download(format: 'json' | 'md'): Promise<void> {
    if (!packet) return;
    const data = format === 'json' ? JSON.stringify(packet, null, 2) : taskMarkdown(packet);
    const url = URL.createObjectURL(new Blob([data], { type: format === 'json' ? 'application/json' : 'text/markdown' }));
    try {
      await chrome.downloads.download({ url, filename: `Kura/briefs/${packet.pack.brand}-${packet.pack.recipeId}-${packet.packetSha256.slice(0, 12)}.${format}`, saveAs: true });
      status.textContent = 'Save dialog opened. Confirm the destination in Chrome.';
    } catch {
      status.textContent = 'Could not open the save dialog. Copy the brief or retry export.';
    } finally {
      // Download creation consumes the Blob URL; this does not claim disk completion.
      URL.revokeObjectURL(url);
    }
  }
  document.getElementById('studio-json')!.addEventListener('click', () => void download('json'));
  document.getElementById('studio-markdown')!.addEventListener('click', () => void download('md'));
  return { onShow: loadCaptures };
}
