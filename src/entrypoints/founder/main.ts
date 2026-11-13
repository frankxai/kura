import type { FounderState } from '@/founder/contracts';
import { allowedTarget, memoryCommand } from '@/founder/contracts';
import { compileResearchPacket, dossierSources, RESEARCH_RECIPES, researchMarkdown } from '@/founder/research';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let state: FounderState = { schema: 1, collection: [], tasks: [], receipts: [] };
let busy = false;
let approvalId: string | undefined;
const selectedDossiers = new Set<string>();

function updateBoard() {
  $('board-count').textContent = `${selectedDossiers.size} selected`;
  $<HTMLButtonElement>('compile-research').disabled = busy || selectedDossiers.size < 2 || selectedDossiers.size > 6 || !$<HTMLTextAreaElement>('board-objective').value.trim();
  $<HTMLTextAreaElement>('board-objective').disabled = busy;
  document.querySelectorAll<HTMLInputElement>('.collection-pick input').forEach(input => { input.disabled = busy; });
}

async function request(type: string, params: Record<string, unknown> = {}) {
  if (busy) return false;
  busy = true;
  updateBoard();
  document.body.setAttribute('aria-busy', 'true');
  try {
    const result = await chrome.runtime.sendMessage({ type: `KURA_FOUNDER_${type}`, ...params });
    if (result?.error) throw new Error(result.error);
    if (!result?.state) throw new Error('Starlight did not return a state. Reopen the panel.');
    state = result.state;
    $('status').textContent = '';
    render();
    return true;
  } catch (error) { $('status').textContent = error instanceof Error ? error.message : 'Operation failed. Your saved research is intact.'; return false; }
  finally { busy = false; document.body.removeAttribute('aria-busy'); updateBoard(); }
}

function show(view: string) {
  for (const id of ['evidence', 'comparison', 'questions', 'timeline']) $(id).hidden = id !== view;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
}
function render() {
  $<HTMLSelectElement>('lens').value = state.lens || 'founder';
  const dossier = state.current;
  (document.querySelector('.intro') as HTMLElement).hidden = !!dossier;
  $('empty').hidden = !!dossier;
  $('research').hidden = !dossier;
  $('collection-count').textContent = String(state.collection.length);
  for (const id of selectedDossiers) if (!state.collection.some(item => item.id === id)) selectedDossiers.delete(id);
  $('collection-list').replaceChildren(...state.collection.map(item => {
    const row = document.createElement('div'); row.className = 'collection-row';
    const label = document.createElement('label'); label.className = 'collection-pick';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selectedDossiers.has(item.id); input.setAttribute('aria-label', `Select ${item.company}`);
    input.addEventListener('change', () => { if (input.checked) selectedDossiers.add(item.id); else selectedDossiers.delete(item.id); updateBoard(); });
    label.append(input);
    const button = document.createElement('button');
    button.className = 'collection-item'; button.textContent = `${item.company} ↗`;
    button.addEventListener('click', () => { void request('RESTORE', { id: item.id }); }); row.append(label, button); return row;
  }));
  updateBoard();
  if (!dossier) return;
  const sources = dossierSources(dossier);
  $('compare-tab').hidden = sources.length < 2;
  if (sources.length < 2 && !$('comparison').hidden) show('evidence');
  $('dossier-kind').textContent = sources.length > 1 ? `01 / Research dossier · ${sources.length} snapshots` : '01 / Company dossier';
  $('company-name').textContent = dossier.company;
  $('company-description').textContent = sources.length > 1 ? `${sources.length} explicitly selected snapshots. Local evidence compilation; synthesis and verification remain open.` : dossier.source.description;
  const source = $<HTMLAnchorElement>('company-source'); source.href = dossier.source.url; source.textContent = new URL(dossier.source.url).hostname;
  $('saved-badge').textContent = dossier.savedAt ? 'Saved locally' : 'Unsaved';
  $<HTMLButtonElement>('save').disabled = !!dossier.savedAt;
  $('save').textContent = dossier.savedAt ? 'Saved to collection' : 'Save dossier';
  $('claims').replaceChildren(...dossier.claims.map((claim, i) => {
    const sourceNumber = Math.max(0, sources.findIndex(source => claim.sourceSha256 ? source.sha256 === claim.sourceSha256 : source.url === claim.source)) + 1;
    const article = document.createElement('article'); article.className = 'claim';
    const label = document.createElement('p'); label.className = 'eyebrow'; label.textContent = `EXCERPT ${String(i + 1).padStart(2, '0')} / ${claim.status.toUpperCase()}`;
    const text = document.createElement('p'); text.textContent = claim.text;
    const citation = document.createElement('a'); citation.href = claim.source; citation.target = '_blank'; citation.rel = 'noopener noreferrer'; citation.textContent = `[${sourceNumber}]`; citation.setAttribute('aria-label', `Source for excerpt ${i + 1}`);
    article.append(label, text, citation); return article;
  }));
  $('source-meta').textContent = dossier.dossierSha256 ? `Research dossier SHA-256 ${dossier.dossierSha256}` : `${dossier.source.capturedAt}\nSHA-256 ${dossier.source.sha256}`;
  $('source-text').textContent = sources.map((source, i) => `[S${i + 1}] ${source.url}\nCaptured ${source.capturedAt}\nSnapshot SHA-256 ${source.sha256}\n\n${source.selection || source.text}`).join('\n\n');
  $('comparison-body').replaceChildren(...sources.map((source, i) => {
    const row = document.createElement('tr');
    const ref = document.createElement('th'); ref.scope = 'row'; ref.textContent = `S${i + 1}`;
    const origin = document.createElement('td'); const link = document.createElement('a'); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = source.title;
    const date = document.createElement('p'); date.className = 'mono'; date.textContent = `${new URL(source.url).hostname}\n${source.capturedAt}`; origin.append(link, date);
    const evidence = document.createElement('td'); evidence.textContent = (source.selection || source.text).slice(0, 700);
    row.append(ref, origin, evidence); return row;
  }));
  $('unknowns').replaceChildren(...dossier.unknowns.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('receipts').replaceChildren(...state.receipts.filter(x => x.dossierId === dossier.id).slice().reverse().map(receipt => {
    const li = document.createElement('li'); const label = document.createElement('strong'); label.textContent = `${receipt.action} · ${new Date(receipt.at).toLocaleTimeString()}`;
    const detail = document.createElement('p'); detail.textContent = receipt.detail; li.append(label, detail); return li;
  }));
  const targets = dossier.source.links.filter(x => allowedTarget(dossier.source.url, x.url));
  $('target').replaceChildren(...targets.map(link => { const option = document.createElement('option'); option.value = link.url; option.textContent = link.title; return option; }));
  $<HTMLButtonElement>('plan').disabled = !dossier.savedAt || !targets.length;
  const task = state.tasks.find(x => x.dossierId === dossier.id);
  $('task-status').textContent = task ? `${task.status} · ${task.targetUrl}` : !dossier.savedAt ? 'Save the dossier to enable a follow-up.' : targets.length ? 'No action runs until you approve it.' : 'No eligible company links captured.';
}

$('save').addEventListener('click', () => { void request('SAVE'); });
async function exportResearch(format: 'json' | 'md' | 'copy') {
  if (!state.current || busy) return;
  const dossier = structuredClone(state.current);
  const recipeId = $<HTMLSelectElement>('research-recipe').value;
  try {
    const packet = await compileResearchPacket(dossier, recipeId);
    if (busy || state.current?.id !== dossier.id || $<HTMLSelectElement>('research-recipe').value !== recipeId) throw new Error('The source or task changed. Review the current dossier and export again.');
    if (format === 'copy') { await navigator.clipboard.writeText(researchMarkdown(packet)); $('status').textContent = 'Brief copied. Paste it into your chosen agent when you decide.'; return; }
    const content = format === 'json' ? JSON.stringify({ dossier, memoryCommand: memoryCommand(dossier), researchTask: packet }, null, 2) : researchMarkdown(packet);
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' }));
    try { await chrome.downloads.download({ url, filename: `Kura/research/${dossier.id}.${format}`, saveAs: true }); }
    finally { URL.revokeObjectURL(url); }
    $('status').textContent = 'Save dialog opened. Confirm the destination in Chrome.';
  } catch (error) { $('status').textContent = error instanceof Error ? error.message : 'Export failed. Your local dossier is intact.'; }
}
$('export').addEventListener('click', () => { void exportResearch('json'); });
$('export-markdown').addEventListener('click', () => { void exportResearch('md'); });
$('copy-research').addEventListener('click', () => { void exportResearch('copy'); });
$('research-recipe').replaceChildren(...RESEARCH_RECIPES.map(recipe => { const option = document.createElement('option'); option.value = recipe.id; option.textContent = recipe.name; return option; }));
$('board-objective').addEventListener('input', updateBoard);
$('compile-research').addEventListener('click', async () => {
  if (await request('RESEARCH', { ids: [...selectedDossiers], objective: $<HTMLTextAreaElement>('board-objective').value })) show('comparison');
});
$('clear').addEventListener('click', () => { void request('CLEAR'); });
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => show(button.dataset.view!)));
$('plan').addEventListener('click', async () => {
  if (!await request('PLAN', { target: $<HTMLSelectElement>('target').value })) return;
  const task = state.tasks.find(x => x.dossierId === state.current?.id && x.status === 'awaiting-approval');
  if (!task) return;
  approvalId = task.missionId;
  $('approval-url').textContent = task.targetUrl;
  $('approval-expiry').textContent = new Date(task.expiresAt).toLocaleTimeString();
  $<HTMLDialogElement>('approval').showModal();
});
$('approve').addEventListener('click', async () => {
  $<HTMLDialogElement>('approval').close();
  $('status').textContent = 'Rechecking source and opening the approved link…';
  await request('APPROVE', { id: approvalId });
});
async function cancel() { $<HTMLDialogElement>('approval').close(); if (approvalId) await request('CANCEL', { id: approvalId }); approvalId = undefined; }
$('cancel').addEventListener('click', () => { void cancel(); });
$('approval').addEventListener('cancel', event => { event.preventDefault(); void cancel(); });
$('commands').addEventListener('click', () => $<HTMLDialogElement>('palette').showModal());
$('close-palette').addEventListener('click', () => $<HTMLDialogElement>('palette').close());
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); $<HTMLDialogElement>('palette').showModal(); }
});
document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => button.addEventListener('click', () => {
  $<HTMLDialogElement>('palette').close();
  if (button.dataset.command === 'collection') document.querySelector('.collection')?.scrollIntoView();
  else show(button.dataset.command!);
}));
$('lens').addEventListener('change', async () => {
  if (await request('LENS', { lens: $<HTMLSelectElement>('lens').value })) $('status').textContent = 'This lens applies to your next capture. Saved dossiers retain their original research questions.';
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.kura_founder_v1 && !busy) { state = changes.kura_founder_v1.newValue || { schema: 1, collection: [], tasks: [], receipts: [] }; render(); }
});
void request('GET');
