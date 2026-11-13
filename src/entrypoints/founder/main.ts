import type { FounderState } from '@/founder/contracts';
import { allowedTarget } from '@/founder/contracts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let state: FounderState = { schema: 1, collection: [], tasks: [], receipts: [] };
let busy = false;
let approvalId: string | undefined;

async function request(type: string, params: Record<string, unknown> = {}) {
  if (busy) return;
  busy = true;
  document.body.setAttribute('aria-busy', 'true');
  try {
    const result = await chrome.runtime.sendMessage({ type: `KURA_FOUNDER_${type}`, ...params });
    if (result?.error) throw new Error(result.error);
    if (!result?.state) throw new Error('Starlight did not return a state. Reopen the panel.');
    state = result.state;
    $('status').textContent = '';
    render();
  } catch (error) { $('status').textContent = error instanceof Error ? error.message : 'Operation failed. Your saved research is intact.'; }
  finally { busy = false; document.body.removeAttribute('aria-busy'); }
}

function show(view: string) {
  for (const id of ['evidence', 'questions', 'timeline']) $(id).hidden = id !== view;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
}
function render() {
  $<HTMLSelectElement>('lens').value = state.lens || 'founder';
  const dossier = state.current;
  $('empty').hidden = !!dossier;
  $('research').hidden = !dossier;
  $('collection-count').textContent = String(state.collection.length);
  $('collection-list').replaceChildren(...state.collection.map(item => {
    const button = document.createElement('button');
    button.className = 'collection-item'; button.textContent = `${item.company} ↗`;
    button.addEventListener('click', () => { void request('RESTORE', { id: item.id }); }); return button;
  }));
  if (!dossier) return;
  $('company-name').textContent = dossier.company;
  $('company-description').textContent = dossier.source.description;
  const source = $<HTMLAnchorElement>('company-source'); source.href = dossier.source.url; source.textContent = new URL(dossier.source.url).hostname;
  $('saved-badge').textContent = dossier.savedAt ? 'Saved locally' : 'Unsaved';
  $<HTMLButtonElement>('save').disabled = !!dossier.savedAt;
  $('save').textContent = dossier.savedAt ? 'Saved to collection' : 'Save dossier';
  $('claims').replaceChildren(...dossier.claims.map((claim, i) => {
    const article = document.createElement('article'); article.className = 'claim';
    const label = document.createElement('p'); label.className = 'eyebrow'; label.textContent = `EXCERPT ${String(i + 1).padStart(2, '0')} / COMPANY-STATED`;
    const text = document.createElement('p'); text.textContent = claim.text;
    const citation = document.createElement('a'); citation.href = claim.source; citation.target = '_blank'; citation.rel = 'noopener noreferrer'; citation.textContent = '[1]'; citation.setAttribute('aria-label', `Source for excerpt ${i + 1}`);
    article.append(label, text, citation); return article;
  }));
  $('source-meta').textContent = `${dossier.source.capturedAt}\nSHA-256 ${dossier.source.sha256}`;
  $('source-text').textContent = dossier.source.selection || dossier.source.text;
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
$('export').addEventListener('click', () => { void request('EXPORT'); });
$('clear').addEventListener('click', () => { void request('CLEAR'); });
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => show(button.dataset.view!)));
$('plan').addEventListener('click', async () => {
  await request('PLAN', { target: $<HTMLSelectElement>('target').value });
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
  await request('LENS', { lens: $<HTMLSelectElement>('lens').value });
  $('status').textContent = 'This lens applies to your next capture. Saved dossiers retain their original research questions.';
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.kura_founder_v1 && !busy) { state = changes.kura_founder_v1.newValue || { schema: 1, collection: [], tasks: [], receipts: [] }; render(); }
});
void request('GET');
