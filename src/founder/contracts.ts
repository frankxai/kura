export const FOUNDER_KEY = 'kura_founder_v1';
export const POLICY = 'starlight.browser.local.v1';

export interface PageEvidence {
  url: string;
  title: string;
  description: string;
  text: string;
  selection: string;
  links: { title: string; url: string }[];
  capturedAt: string;
  sha256: string;
  tabId: number;
  documentId: string;
}
export interface Dossier {
  schema: 'starlight.company-dossier.v1';
  id: string;
  company: string;
  lens: 'founder' | 'investor';
  source: PageEvidence;
  claims: { text: string; source: string; status: 'company-stated' }[];
  unknowns: string[];
  savedAt?: string;
}
export interface Followup {
  missionId: string;
  tenantId: string;
  actorId: 'local-owner';
  policyVersion: typeof POLICY;
  allowedOrigins: string[];
  maxCostUsd: 0;
  expiresAt: string;
  dossierId: string;
  sourceSha256: string;
  sourceDocumentId: string;
  sourceTabId: number;
  sourceUrl: string;
  targetUrl: string;
  action: 'open-source';
  status: 'awaiting-approval' | 'executing' | 'opened' | 'cancelled' | 'failed' | 'uncertain';
}
export interface Receipt {
  id: string;
  at: string;
  action: 'capture' | 'save' | 'approve' | 'open-source' | 'cancel' | 'failure';
  dossierId: string;
  sourceSha256: string;
  detail: string;
  costUsd: 0;
}
export interface FounderState {
  schema: 1;
  lens?: 'founder' | 'investor';
  current?: Dossier;
  collection: Dossier[];
  tasks: Followup[];
  receipts: Receipt[];
}

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}

export function safeSourceUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Choose an HTTPS company page.');
  url.search = ''; url.hash = '';
  return url.href;
}

export function allowedTarget(source: string, target: string): boolean {
  try {
    const url = new URL(target);
    let path = url.pathname;
    for (let i = 0; i < 3 && path.includes('%'); i++) path = decodeURIComponent(path);
    if (path.includes('%')) return false;
    return safeSourceUrl(target) === target && url.origin === new URL(source).origin &&
      !/(?:^|\/)(?:login|logout|signin|signout|auth|oauth|account|settings|admin|api|checkout|cart|delete|unsubscribe)(?:[./_\-]|$)/i.test(path);
  } catch { return false; }
}

export function compileDossier(source: PageEvidence, lens: Dossier['lens'] = 'founder'): Dossier {
  if (safeSourceUrl(source.url) !== source.url || !/^[a-f0-9]{64}$/.test(source.sha256) || !source.text.trim()) throw new Error('Capture a readable company page first.');
  const excerpts = (source.selection || source.text).split(/\n+/).map(x => x.trim()).filter(x => x.length > 24).slice(0, 5);
  return {
    schema: 'starlight.company-dossier.v1', id: crypto.randomUUID(), lens,
    company: source.title.split(/\s[|–—]\s/)[0].slice(0, 160) || new URL(source.url).hostname,
    source,
    claims: excerpts.map(text => ({ text: text.slice(0, 700), source: source.url, status: 'company-stated' })),
    unknowns: lens === 'investor'
      ? ['Revenue, runway and cap table need independent evidence.', 'Validate customer concentration and defensibility.', 'Check funding terms and primary filings.']
      : ['Validate the product with customer evidence.', 'Compare competitors using separately authorized sources.', 'Confirm pricing, traction and company ownership.'],
  };
}

export function planFollowup(dossier: Dossier, target: string, tenantId: string): Followup {
  if (!dossier.savedAt) throw new Error('Save this dossier before preparing a follow-up.');
  if (!dossier.source.links.some(x => x.url === target) || !allowedTarget(dossier.source.url, target)) throw new Error('Choose a captured link on this company origin.');
  return {
    missionId: crypto.randomUUID(), tenantId, actorId: 'local-owner', policyVersion: POLICY,
    allowedOrigins: [new URL(dossier.source.url).origin], maxCostUsd: 0,
    expiresAt: new Date(Date.now() + 300_000).toISOString(), dossierId: dossier.id,
    sourceSha256: dossier.source.sha256, sourceDocumentId: dossier.source.documentId,
    sourceTabId: dossier.source.tabId, sourceUrl: dossier.source.url,
    targetUrl: target, action: 'open-source', status: 'awaiting-approval',
  };
}

export function assertApproval(task: Followup, source: PageEvidence): void {
  if (task.status !== 'awaiting-approval' || Date.parse(task.expiresAt) <= Date.now()) throw new Error('This approval expired or was already used. Prepare a new follow-up.');
  if (source.sha256 !== task.sourceSha256 || source.documentId !== task.sourceDocumentId || source.tabId !== task.sourceTabId || source.url !== task.sourceUrl) throw new Error('The source tab changed. Capture it again before approving.');
  if (!allowedTarget(source.url, task.targetUrl) || !source.links.some(x => x.url === task.targetUrl) || !task.allowedOrigins.includes(new URL(task.targetUrl).origin)) throw new Error('The target is outside this approval.');
}

// Matches the existing platform memory-capture create contract. This is a
// portable draft for import; it is never posted using browser session cookies.
export function memoryCommand(dossier: Dossier) {
  return { action: 'create', operationId: dossier.id, payload: {
    project: 'Founder research', subject: dossier.company.slice(0, 300),
    originalWords: (dossier.source.selection || dossier.source.text).slice(0, 8000),
    interpretation: JSON.stringify({ claims: dossier.claims, unknowns: dossier.unknowns, status: 'unverified-company-statements' }).slice(0, 8000),
    source: { uri: dossier.source.url.slice(0, 1000), revision: dossier.source.sha256 },
  } };
}
