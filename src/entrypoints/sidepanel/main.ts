import type { ChatPage, ChatResult } from '@/core/chat-library';
import { initSuno } from './suno';
import { initVault } from './vault';
import { initCockpit } from './cockpit';
import { initNativeIntake } from './native-intake';

const list = document.getElementById('lib-list')!;
const stats = document.getElementById('lib-stats')!;
const empty = document.getElementById('lib-empty')!;
const search = document.getElementById('lib-search') as HTMLInputElement;
const platform = document.getElementById('lib-filter') as HTMLSelectElement;
const scope = document.getElementById('lib-scope') as HTMLSelectElement;
const date = document.getElementById('lib-date') as HTMLSelectElement;
const status = document.getElementById('lib-status')!;
const more = document.getElementById('lib-more') as HTMLButtonElement;
const refresh = document.getElementById('lib-refresh') as HTMLButtonElement;
const title = document.getElementById('panel-title')!;
const names = ['library', 'cockpit', 'suno'] as const;
type Panel = typeof names[number];
const tabs = names.map(name => document.getElementById(`tab-${name}`) as HTMLButtonElement);
let active: Panel = 'library';
let generation = 0;
let nextOffset: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

initVault();
initNativeIntake();
const cockpit = initCockpit();
const suno = initSuno(text => { if (active === 'suno') stats.textContent = text; });

function switchTab(name: Panel): void {
  active = name;
  for (const [index, tab] of tabs.entries()) {
    const selected = names[index] === name;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(`view-${names[index]}`)!.classList.toggle('hidden', !selected);
  }
  title.textContent = name === 'library' ? 'Your chats' : name === 'cockpit' ? 'Starlight Cockpit' : 'Suno Harvester';
  if (name === 'library') void lookup();
  if (name === 'cockpit') { stats.textContent = 'Send to the AI tabs you choose'; cockpit.onShow(); }
  if (name === 'suno') suno.onShow();
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => switchTab(names[index]));
  tab.addEventListener('keydown', event => {
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? names.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % names.length
      : event.key === 'ArrowLeft' ? (index + names.length - 1) % names.length : -1;
    if (target < 0) return;
    event.preventDefault();
    switchTab(names[target]);
    tabs[target].focus();
  });
}

function text(tag: string, className: string, value: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}
function render(items: ChatResult[], append: boolean): void {
  if (!append) list.replaceChildren();
  for (const item of items) {
    const row = document.createElement('li');
    row.className = 'lib-item chat-row';
    const body = text('div', 'lib-item-body', '');
    body.append(text('div', 'lib-item-title', item.title));
    const captured = item.capturedAt ? new Date(item.capturedAt).toLocaleDateString() : '';
    body.append(text('div', 'lib-item-meta', [item.platform,
      item.openCount ? `Open${item.openCount > 1 ? ` in ${item.openCount} tabs` : ''}` : '',
      item.saved ? `Saved${captured ? ` · ${captured}` : ''}` : 'Title only'].filter(Boolean).join(' · ')));
    if (item.snippet) body.append(text('p', 'chat-excerpt', item.snippet));
    if (item.tags.length) body.append(text('p', 'chat-tags', item.tags.join(' · ')));
    const resume = text('button', 'btn btn-ghost chat-resume', item.openCount ? 'Resume' : 'Open source') as HTMLButtonElement;
    resume.type = 'button';
    resume.setAttribute('aria-label', `${item.openCount ? 'Resume' : 'Open source for'} ${item.title}`);
    resume.addEventListener('click', async () => {
      resume.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'STARLIGHT_RESUME_CHAT',
          url: item.url, tabId: item.tabId, tabUrl: item.tabUrl });
        status.textContent = result?.ok ? 'Chat opened. Your draft stays in its original tab.'
          : 'This tab changed or closed. Refresh the list and try again.';
      } catch { status.textContent = 'Could not open this chat. Refresh the list and try again.'; }
      finally { resume.disabled = false; }
    });
    row.append(body, resume);
    list.append(row);
  }
}

async function lookup(append = false): Promise<void> {
  const current = ++generation;
  more.disabled = true;
  list.setAttribute('aria-busy', 'true');
  status.textContent = 'Searching local captures and open AI tabs…';
  const since = date.value ? new Date(Date.now() - Number(date.value) * 86400000).toISOString().slice(0, 10) : undefined;
  try {
    const result: ChatPage & { error?: string } = await chrome.runtime.sendMessage({ type: 'STARLIGHT_LIBRARY_SEARCH',
      query: { query: search.value, platform: platform.value, scope: scope.value, since, offset: append ? nextOffset ?? 0 : 0 } });
    if (current !== generation) return;
    if (!Array.isArray(result?.items)) throw new Error('Lookup unavailable');
    render(result.items, append);
    nextOffset = result.nextOffset;
    more.hidden = nextOffset === null;
    empty.classList.toggle('hidden', result.total !== 0);
    if (!result.total) {
      empty.querySelector('.empty-title')!.textContent = 'No matching chats';
      empty.querySelector('.empty-desc')!.textContent = 'Try fewer words or clear a filter. This view includes Kura captures and open AI tabs; your second-brain archive is not connected to this search yet.';
    }
    const shown = list.childElementCount;
    status.textContent = `${shown} of ${result.total} matching chats. Open tabs are searched by title; saved chats include their text and tags.`;
    if (active === 'library') stats.textContent = `${result.total} chat${result.total === 1 ? '' : 's'} found locally`;
  } catch {
    if (current !== generation) return;
    status.textContent = 'Search is unavailable. Refresh to retry; your saved captures are unchanged.';
    more.hidden = true;
  } finally {
    if (current === generation) { more.disabled = false; list.setAttribute('aria-busy', 'false'); }
  }
}
function schedule(): void {
  generation++;
  more.disabled = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void lookup(); }, 120);
}
search.addEventListener('input', schedule);
for (const filter of [platform, scope, date]) filter.addEventListener('change', schedule);
refresh.addEventListener('click', () => { if (timer) clearTimeout(timer); void lookup(); });
more.addEventListener('click', () => { void lookup(true); });
chrome.tabs.onCreated.addListener(schedule);
chrome.tabs.onRemoved.addListener(schedule);
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.title) schedule(); });
switchTab('library');
