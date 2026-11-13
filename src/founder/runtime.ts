import { FOUNDER_KEY, assertApproval, compileDossier, digest, planFollowup, safeSourceUrl } from './contracts';
import type { Dossier, FounderState, PageEvidence, Receipt } from './contracts';
import { compileResearch } from './research';

// Bundled read capability. No model-generated JavaScript, form values, browser
// cookies, localStorage, iframes, or page-authored instructions are executed.
export function readPage(operation?: { target?: string; expected?: string; invitedUrl?: string }) {
  if (operation?.invitedUrl && location.href !== operation.invitedUrl) throw new Error('The invited tab navigated. Authorize it again.');
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  const root = document.querySelector('main, article, [role="main"]') || document.body;
  const excluded = 'form,nav,footer,header,script,style,noscript,textarea,input,[contenteditable],[hidden],[aria-hidden="true"]';
  const permitted = (el: Element | null) => el && !el.closest(excluded) && (el as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const textParts: string[] = [], selectedParts: string[] = [];
  const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : undefined;
  const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
  let node = walker.nextNode(), visited = 0, length = 0;
  while (node && visited++ < 10000 && length < 20000) {
    if (permitted(node.parentElement)) {
      const text = clean(node.textContent || '');
      if (text) { textParts.push(text); length += text.length + 1; }
      if (range?.intersectsNode(node)) {
        const value = node.textContent || '';
        selectedParts.push(value.slice(range.startContainer === node ? range.startOffset : 0, range.endContainer === node ? range.endOffset : value.length));
      }
    }
    node = walker.nextNode();
  }
  const url = new URL(location.href); url.search = ''; url.hash = '';
  const links = [...root.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(a => permitted(a) && !a.querySelector(excluded)).slice(0, 100).map(a => ({ title: clean(a.innerText).slice(0, 120), url: a.href })).filter(a => {
    try { const target = new URL(a.url); return a.title && target.protocol === 'https:' && !target.username && !target.password && !target.port && !target.search && !target.hash && target.origin === url.origin; } catch { return false; }
  }).filter((x, i, a) => a.findIndex(y => y.url === x.url) === i).slice(0, 16);
  const snapshot = { url: url.href, title: document.title.slice(0, 300),
    description: (document.querySelector('meta[name="description"]') as { content?: string } | null)?.content?.slice(0, 1000) || '',
    text: textParts.join('\n').slice(0, 20000), selection: selectedParts.join(' ').slice(0, 8000), links };
  if (operation?.target) {
    if (JSON.stringify(snapshot) !== operation.expected) throw new Error('The source changed before navigation. Capture it again.');
    const target = new URL(operation.target);
    if (target.protocol !== 'https:' || target.origin !== url.origin || target.username || target.password || target.search || target.hash || !links.some(x => x.url === operation.target)) throw new Error('Navigation target is outside the reviewed snapshot.');
    location.assign(operation.target);
  }
  return { snapshot, observedUrl: location.href };
}

export async function captureTab(tabId: number, invitedUrl?: string): Promise<PageEvidence> {
  const before = await chrome.tabs.get(tabId);
  if (invitedUrl && before.url !== invitedUrl) throw new Error('The invited tab navigated. Authorize it again.');
  const url = safeSourceUrl(before.url || '');
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: readPage, args: [{ invitedUrl: invitedUrl || before.url }] });
  const raw = result?.result;
  const after = await chrome.tabs.get(tabId);
  if (!raw || before.url !== after.url || raw.observedUrl !== before.url || raw.snapshot.url !== url || !result.documentId) throw new Error('The page changed during capture. Try again.');
  const [check] = await chrome.scripting.executeScript({ target: { tabId }, func: () => location.href });
  if (check.documentId !== result.documentId || check.result !== before.url) throw new Error('The document changed during capture. Try again.');
  const evidence = raw.snapshot;
  return { ...evidence, sha256: await digest(JSON.stringify(evidence)), capturedAt: new Date().toISOString(), tabId, documentId: result.documentId };
}

export function installFounderRuntime(storageReady: Promise<void>) {
  let queue = Promise.resolve<unknown>(undefined);
  const blank = (): FounderState => ({ schema: 1, collection: [], tasks: [], receipts: [] });
  async function load(): Promise<FounderState> {
    await storageReady;
    const state: FounderState = (await chrome.storage.local.get(FOUNDER_KEY))[FOUNDER_KEY] || blank();
    // An interrupted consequential operation must be reconciled, never replayed.
    for (const task of state.tasks) if (task.status === 'executing') task.status = 'uncertain';
    return state;
  }
  const save = async (state: FounderState) => { await chrome.storage.local.set({ [FOUNDER_KEY]: state }); };
  function receipt(state: FounderState, action: Receipt['action'], dossier: Dossier, detail: string) {
    state.receipts = [...state.receipts, { id: crypto.randomUUID(), at: new Date().toISOString(), action, dossierId: dossier.id, sourceSha256: dossier.source.sha256, detail, costUsd: 0 as const }].slice(-100);
  }
  async function captureInvited(tabId: number, invitedUrl: string) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url !== invitedUrl) throw new Error('The invited tab navigated. Authorize it again.');
    const state = await load();
    state.current = compileDossier(await captureTab(tabId, invitedUrl), state.lens || 'founder');
    receipt(state, 'capture', state.current, 'Read one authorized tab locally. Company statements need verification.');
    await save(state);
    return state;
  }
  async function handle(message: { type: string; id?: string; target?: string; lens?: Dossier['lens']; tabId?: number; url?: string; ids?: string[]; objective?: string }) {
    if (message.type === 'KURA_FOUNDER_CAPTURE') {
      if (!Number.isSafeInteger(message.tabId) || typeof message.url !== 'string') throw new Error('Authorize one company tab first.');
      return captureInvited(message.tabId!, message.url);
    }
    const state = await load();
    if (message.type === 'KURA_FOUNDER_GET') return state;
    if (message.type === 'KURA_FOUNDER_LENS') { state.lens = message.lens === 'investor' ? 'investor' : 'founder'; await save(state); return state; }
    if (message.type === 'KURA_FOUNDER_CLEAR') { await chrome.storage.local.remove(FOUNDER_KEY); return blank(); }
    if (message.type === 'KURA_FOUNDER_RESTORE') {
      state.current = state.collection.find(x => x.id === message.id);
      await save(state); return state;
    }
    if (message.type === 'KURA_FOUNDER_RESEARCH') {
      if (!Array.isArray(message.ids) || message.ids.length < 2 || message.ids.length > 6 || new Set(message.ids).size !== message.ids.length) throw new Error('Choose two to six distinct saved dossiers.');
      const selected = message.ids.map(id => state.collection.find(x => x.id === id));
      if (selected.some(x => !x)) throw new Error('One selected dossier is no longer in the local collection. Refresh your selection.');
      state.current = await compileResearch(selected as Dossier[], message.objective || '', state.lens || 'founder');
      receipt(state, 'compile', state.current, `Compiled ${state.current.sources!.length} explicitly selected local snapshots. No tab read, model call or remote transfer.`);
      await save(state); return state;
    }
    const dossier = state.current;
    if (!dossier) throw new Error('Capture a company page first.');
    if (message.type === 'KURA_FOUNDER_SAVE') {
      dossier.savedAt ||= new Date().toISOString();
      state.collection = [dossier, ...state.collection.filter(x => x.id !== dossier.id)].slice(0, 20);
      receipt(state, 'save', dossier, 'Saved to the local research collection. Cloud sync is off.');
    } else if (message.type === 'KURA_FOUNDER_PLAN') {
      const task = planFollowup(dossier, message.target || '', `local:${chrome.runtime.id}`);
      state.tasks = [task, ...state.tasks].slice(0, 50);
    } else if (message.type === 'KURA_FOUNDER_CANCEL') {
      const task = state.tasks.find(x => x.missionId === message.id && x.dossierId === dossier.id);
      if (!task || task.status !== 'awaiting-approval') throw new Error('This task is no longer awaiting approval.');
      task.status = 'cancelled'; receipt(state, 'cancel', dossier, 'Follow-up cancelled. No browser action.');
    } else if (message.type === 'KURA_FOUNDER_APPROVE') {
      const task = state.tasks.find(x => x.missionId === message.id && x.dossierId === dossier.id);
      if (!task) throw new Error('Task no longer exists.');
      assertApproval(task, await captureTab(task.sourceTabId));
      task.status = 'executing';
      receipt(state, 'approve', dossier, `Approved one navigation to ${task.targetUrl}. Maximum cost $0.`);
      await save(state);
      try {
        const source = dossier.source;
        const expected = JSON.stringify({ url: source.url, title: source.title, description: source.description, text: source.text, selection: source.selection, links: source.links });
        await chrome.scripting.executeScript({ target: { tabId: task.sourceTabId, documentIds: [task.sourceDocumentId] }, func: readPage, args: [{ target: task.targetUrl, expected }] });
        // Bounded readback. A redirect, timeout or disconnect is uncertain,
        // never a reason to repeat a possibly completed action automatically.
        const started = Date.now();
        let tab = await chrome.tabs.get(task.sourceTabId);
        while (tab.status !== 'complete' && Date.now() - started < 8000) {
          await new Promise(resolve => setTimeout(resolve, 100));
          tab = await chrome.tabs.get(task.sourceTabId);
        }
        task.status = tab.status === 'complete' && tab.url === task.targetUrl ? 'opened' : 'uncertain';
        receipt(state, 'open-source', dossier, task.status === 'opened' ? `Opened ${task.targetUrl}. Use the capture shortcut to research this page.` : 'Navigation outcome uncertain. Inspect the source tab; do not auto-retry.');
      } catch {
        task.status = 'uncertain'; receipt(state, 'failure', dossier, 'Navigation could not be confirmed. Inspect the source tab before retrying.');
      }
    } else throw new Error('Unsupported Founder operation.');
    await save(state); return state;
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (typeof message?.type !== 'string' || !message.type.startsWith('KURA_FOUNDER_')) return;
    const paths = ['founder.html', 'popup.html'].map(path => chrome.runtime.getURL(path));
    if (sender.id !== chrome.runtime.id || !paths.includes(sender.url || '')) { respond({ error: 'Use the trusted Starlight panel.' }); return; }
    if (message.type === 'KURA_FOUNDER_CAPTURE' && sender.url !== chrome.runtime.getURL('popup.html')) { respond({ error: 'Use the capture shortcut or Kura popup to authorize a tab.' }); return; }
    queue = queue.catch(() => {}).then(() => handle(message));
    void queue.then(state => respond({ state }), error => respond({ error: error instanceof Error ? error.message : 'Operation failed.' }));
    return true;
  });
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'starlight-research' || !tab?.id) return;
    // Start panel opening in the direct command gesture before asynchronous work.
    const reportPanelError = () => { void chrome.action.setBadgeText({ text: '!', tabId: tab.id }); };
    void chrome.sidePanel.setOptions({ tabId: tab.id, path: 'founder.html', enabled: true }).catch(reportPanelError);
    void chrome.sidePanel.open({ tabId: tab.id }).catch(reportPanelError);
    queue = queue.catch(() => {}).then(async () => {
      try { await captureInvited(tab.id!, tab.url || ''); }
      catch (error) { await chrome.action.setTitle({ tabId: tab.id, title: error instanceof Error ? error.message : 'Capture failed' }); }
    });
  });
}
