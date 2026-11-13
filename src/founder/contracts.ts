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
  schema: 'starlight.company-dossier.v1' | 'starlight.research-dossier.v2';
  id: string;
  company: string;
  lens: 'founder' | 'investor';
  source: PageEvidence;
  sources?: PageEvidence[];
  objective?: string;
  dossierSha256?: string;
  claims: { text: string; source: string; sourceSha256?: string; status: 'company-stated' | 'source-stated' }[];
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
  action: 'capture' | 'save' | 'compile' | 'approve' | 'open-source' | 'cancel' | 'failure';
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
      !/(?:^|\/)(?:login|logout|signin|signout|auth|oauth|account|settings|admin|api|checkout|cart|delete|unsubscribe)(?:[./_-]|$)/i.test(path);
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
type MemoryCreate = { action: string; operationId: string; payload: { project: string; subject: string; originalWords: string; interpretation: string; source: { uri: string; revision: string } } };
function boundMemoryCommand(command: MemoryCreate): MemoryCreate {
  const metadata = JSON.parse(command.payload.interpretation);
  while (JSON.stringify(metadata).length > 8000 && metadata.claims?.length) { metadata.claims.pop(); metadata.omittedClaims = (metadata.omittedClaims || 0) + 1; }
  if (JSON.stringify(metadata).length > 8000) throw new Error('The memory draft exceeds its supported field size.');
  command.payload.interpretation = JSON.stringify(metadata);
  while (new TextEncoder().encode(JSON.stringify(command)).byteLength > 32768) {
    if (command.payload.originalWords.length) {
      const characters = Array.from(command.payload.originalWords);
      command.payload.originalWords = characters.slice(0, Math.floor(characters.length * 0.75)).join('');
      metadata.originalWordsTruncated = true;
    } else if (metadata.claims?.length) {
      metadata.claims.pop(); metadata.omittedClaims = (metadata.omittedClaims || 0) + 1;
    } else throw new Error('The memory draft exceeds the supported wire size. Export the full research packet instead.');
    command.payload.interpretation = JSON.stringify(metadata);
  }
  return command;
}
export function memoryCommand(dossier: Dossier) {
  if (dossier.schema === 'starlight.research-dossier.v2') {
    const sources = dossier.sources || [dossier.source];
    const original = sources.map((source, i) => `[S${i + 1}] ${source.title}\n${source.selection || source.text}`).join('\n\n');
    const metadata = {
      status: 'unverified-source-statements', objective: dossier.objective,
      sources: sources.map((source, i) => ({ ref: `S${i + 1}`, uri: source.url.slice(0, 512), uriTruncated: source.url.length > 512, sha256: source.sha256 })),
      claims: dossier.claims.map(claim => ({ ...claim, text: claim.text.slice(0, 300), source: claim.source.slice(0, 512) })),
      unknowns: dossier.unknowns, omittedClaims: 0, originalWordsTruncated: original.length > 8000,
    };
    while (JSON.stringify(metadata).length > 8000 && metadata.claims.length) { metadata.claims.pop(); metadata.omittedClaims++; }
    if (JSON.stringify(metadata).length > 8000) throw new Error('The memory draft exceeds its supported size. Export the full research packet instead.');
    return boundMemoryCommand({ action: 'create', operationId: dossier.id, payload: {
      project: 'Founder research', subject: dossier.company.slice(0, 300),
      originalWords: original.slice(0, 8000),
      interpretation: JSON.stringify(metadata),
      source: { uri: dossier.source.url.length <= 1000 ? dossier.source.url : '', revision: dossier.dossierSha256 || dossier.source.sha256 },
    } });
  }
  return boundMemoryCommand({ action: 'create', operationId: dossier.id, payload: {
    project: 'Founder research', subject: dossier.company.slice(0, 300),
    originalWords: (dossier.source.selection || dossier.source.text).slice(0, 8000),
    interpretation: JSON.stringify({ claims: dossier.claims, unknowns: dossier.unknowns, status: 'unverified-company-statements', originalWordsTruncated: (dossier.source.selection || dossier.source.text).length > 8000 }),
    source: { uri: dossier.source.url.length <= 1000 ? dossier.source.url : '', revision: dossier.source.sha256 },
  } });
}
