import { INTAKE_KEY } from '@/core/native-intake';
import type { IntakeState } from '@/core/native-intake';

export function initNativeIntake(): void {
  const status = document.getElementById('intake-status')!;
  const connect = document.getElementById('intake-connect') as HTMLButtonElement;
  const retry = document.getElementById('intake-retry') as HTMLButtonElement;
  let enabled = false;

  function paint(state: IntakeState & { error?: string }): void {
    if (state.error) { status.textContent = state.error; return; }
    enabled = state.enabled;
    connect.textContent = enabled ? 'Pause intake' : 'Connect second brain';
    retry.hidden = !enabled || !state.pending?.length;
    const queued = state.pending?.length ?? 0;
    status.textContent = !enabled ? 'Local intake is off'
      : state.status === 'retry' ? `Capture saved; ${queued} awaiting intake. Check setup and retry.`
      : state.status === 'queue-full' ? 'Intake queue is full. Retry intake before adding more.'
      : state.status === 'processing' ? `Processing ${queued} saved capture${queued === 1 ? '' : 's'}`
      : `${state.vault ?? 'Second brain'} · ${queued} queued · ${state.processed} processed`;
  }
  async function refresh(): Promise<void> {
    try { paint(await chrome.runtime.sendMessage({ type: 'KURA_INTAKE_STATUS' })); }
    catch { status.textContent = 'Open Kura again to reconnect local intake.'; }
  }
  connect.addEventListener('click', async () => {
    connect.disabled = true;
    try {
      if (!enabled) {
        // Request from the explicit click, before any other asynchronous work.
        const granted = await chrome.permissions.request({ permissions: ['nativeMessaging'] });
        if (!granted) { status.textContent = 'Local intake permission was not granted. Captures remain saved.'; return; }
      }
      paint(await chrome.runtime.sendMessage({ type: enabled ? 'KURA_INTAKE_DISABLE' : 'KURA_INTAKE_ENABLE' }));
    } catch { status.textContent = 'Install the local intake host, then connect again. Captures remain saved.'; }
    finally { connect.disabled = false; }
  });
  retry.addEventListener('click', async () => {
    retry.disabled = true;
    try { await chrome.runtime.sendMessage({ type: 'KURA_INTAKE_RETRY' }); await refresh(); }
    catch { status.textContent = 'Intake is unavailable. Captures remain saved; check setup and retry.'; }
    finally { retry.disabled = false; }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[INTAKE_KEY]?.newValue) paint(changes[INTAKE_KEY].newValue);
  });
  void refresh();
}
