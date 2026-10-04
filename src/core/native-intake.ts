/** Local receipt transport. No transcripts, URLs, credentials or root paths cross it. */
export const NATIVE_HOST = 'ai.frankx.kura_intake';
export const INTAKE_KEY = 'kura_native_intake_v1';
export interface CaptureRef { path: string; sha256: string }
export interface IntakeState {
  enabled: boolean;
  pending: CaptureRef[];
  status: 'off' | 'ready' | 'processing' | 'retry' | 'queue-full';
  vault?: string;
  processed: number;
  missed?: number;
}
export interface IntakeStorage {
  read(): Promise<IntakeState | undefined>;
  write(state: IntakeState): Promise<void>;
  quarantine?(state: unknown): Promise<void>;
}
export type NativeTransport = (request: Record<string, unknown>) => Promise<Record<string, unknown>>;

export function validCaptureRef(value: unknown): value is CaptureRef {
  const ref = value as CaptureRef | undefined;
  return !!ref && typeof ref.path === 'string' && typeof ref.sha256 === 'string'
    && /^(chatgpt|claude|gemini|grok|deepseek|perplexity)\/\d{4}-\d{2}-\d{2}_[a-z0-9-]{1,180}\/conversation\.md$/.test(ref.path)
    && /^[a-f0-9]{64}$/.test(ref.sha256);
}

const empty = (): IntakeState => ({ enabled: false, pending: [], status: 'off', processed: 0 });
export class NativeIntake {
  private serial: Promise<unknown> = Promise.resolve();
  private busy = false;
  private storage: IntakeStorage;
  private transport: NativeTransport;
  constructor(storage: IntakeStorage, transport: NativeTransport) {
    this.storage = storage;
    this.transport = transport;
  }

  private locked<T>(action: () => Promise<T>): Promise<T> {
    const result = this.serial.then(action);
    this.serial = result.catch(() => {});
    return result;
  }

  private async state(): Promise<IntakeState> {
    const value = await this.storage.read();
    if (!value) return empty();
    if (typeof value.enabled !== 'boolean' || !Array.isArray(value.pending)
      || value.pending.length > 256 || value.pending.some((ref) => !validCaptureRef(ref))
      || !Number.isSafeInteger(value.processed) || value.processed < 0
      || !['off', 'ready', 'processing', 'retry', 'queue-full'].includes(value.status)
      || value.vault !== undefined && (typeof value.vault !== 'string' || value.vault.length > 255)
      || value.missed !== undefined && (!Number.isSafeInteger(value.missed) || value.missed < 0)) {
      throw new Error('Intake queue needs recovery; saved captures are preserved.');
    }
    return value.status === 'processing' && !this.busy ? { ...value, status: 'retry' } : value;
  }

  public snapshot(): Promise<IntakeState> { return this.locked(() => this.state()); }

  public async enable(): Promise<IntakeState> {
    const reply = await this.transport({ v: 1, id: crypto.randomUUID(), op: 'hello' });
    if (reply.ok !== true || reply.mode !== 'agent' || reply.paidApiCalls !== 0
      || typeof reply.vault !== 'string' || reply.vault.length > 255) {
      throw new Error('Local intake host is unavailable. Follow setup, then retry.');
    }
    return this.locked(async () => {
      const state = await this.state();
      const next = { ...state, enabled: true, vault: reply.vault as string, status: 'ready' as const };
      await this.storage.write(next);
      return next;
    });
  }

  public disable(): Promise<IntakeState> {
    return this.locked(async () => {
      let previous: IntakeState;
      try { previous = await this.state(); }
      catch { await this.storage.quarantine?.(await this.storage.read()); previous = empty(); }
      const state = { ...previous, enabled: false, status: 'off' as const };
      await this.storage.write(state);
      return state;
    });
  }

  public reset(): Promise<IntakeState> {
    return this.locked(async () => {
      await this.storage.quarantine?.(await this.storage.read());
      const state = empty();
      await this.storage.write(state);
      return state;
    });
  }

  public noteMissed(count: number): Promise<void> {
    return this.locked(async () => {
      const state = await this.state();
      if (state.enabled && count > 0) await this.storage.write({ ...state,
        missed: (state.missed ?? 0) + count, status: 'retry' });
    });
  }

  public enqueue(refs: CaptureRef[]): Promise<number> {
    return this.locked(async () => {
      const state = await this.state();
      if (!state.enabled) return 0;
      const pending = [...state.pending];
      let missed = 0;
      let queued = 0;
      for (const ref of refs) {
        if (!validCaptureRef(ref)) { missed++; continue; }
        const index = pending.findIndex((item) => item.path === ref.path);
        if (index < 0 && pending.length >= 256) { missed++; continue; }
        if (index < 0) pending.push(ref); else pending[index] = ref;
        queued++;
      }
      await this.storage.write({ ...state, pending, missed: (state.missed ?? 0) + missed,
        status: missed ? 'queue-full' : state.status });
      return queued;
    });
  }

  public async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const attempted = new Set<string>();
    const rejected = new Set<string>();
    const key = (ref: CaptureRef) => `${ref.path}:${ref.sha256}`;
    try {
      // Bounded interactive work; another capture or Retry intake resumes a larger queue.
      for (let count = 0; count < 3; count++) {
        const state = await this.snapshot();
        if (!state.enabled || !state.pending.length) return;
        const ref = state.pending.find((item) => !attempted.has(key(item)));
        if (!ref) return;
        attempted.add(key(ref));
        await this.locked(async () => this.storage.write({ ...await this.state(), status: 'processing' }));
        let reply: Record<string, unknown>;
        try {
          reply = await this.transport({ v: 1, id: crypto.randomUUID(), op: 'process', ...ref });
        } catch {
          reply = { ok: false };
        }
        const accepted = reply.ok === true && reply.receipt === ref.sha256 && reply.paidApiCalls === 0
          && (reply.processed === 0 || reply.processed === 1)
          && typeof reply.unchanged === 'boolean' && reply.unchanged === (reply.processed === 0);
        const captureRejected = reply.ok === false
          && (reply.code === 'capture_rejected' || reply.code === 'capture_changed');
        if (!accepted) rejected.add(key(ref));
        const newer = await this.locked(async () => {
          const current = await this.state();
          const changed = current.pending.some((item) => item.path === ref.path && item.sha256 !== ref.sha256);
          let pending = current.pending;
          if (accepted || captureRejected) {
            pending = current.pending.filter((item) => key(item) !== key(ref));
            // Keep a rejected capture recoverable without blocking healthy work.
            if (captureRejected && current.pending.some((item) => key(item) === key(ref))) pending.push(ref);
          }
          const failedRemain = pending.some((item) => rejected.has(key(item)));
          await this.storage.write({ ...current, pending,
            processed: current.processed + (accepted ? Number(reply.processed) : 0),
            status: current.enabled ? failedRemain || !accepted && !changed ? 'retry' : 'ready' : 'off' });
          return changed;
        });
        if (!accepted && !newer && !captureRejected) return;
      }
    } finally { this.busy = false; }
  }
}

/** One short-lived port per request; disconnect on reply, error or timeout. */
export async function requestNative(request: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!(await chrome.permissions.contains({ permissions: ['nativeMessaging'] }))) {
    throw new Error('Connect second brain in Kura to grant local intake permission.');
  }
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connectNative(NATIVE_HOST);
    let settled = false;
    const finish = (reply?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      port.disconnect();
      if (reply?.v === 1 && reply.id === request.id) resolve(reply);
      else reject(new Error('Local intake did not acknowledge the request. Retry after checking setup.'));
    };
    const timer = setTimeout(() => finish(), 120_000);
    port.onMessage.addListener((reply) => finish(reply));
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; finish(); });
    try { port.postMessage(request); } catch { finish(); }
  });
}
