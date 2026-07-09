// ============================================================
// Kura — Shared vault connection (side panel)
// One picked folder is the whole local vault: conversation capture
// writes under <platform>/ (via the offscreen writer) and the Suno
// harvester writes under suno/. This module owns the connect UI and
// broadcasts the live handle to every tab that needs it.
// ============================================================

import { hasStoredDirectory, loadDirectory, pickDirectory } from '@/core/fs';
import { VAULT_DIR_KEY } from '@/core/vault-keys';

type Listener = (root: FileSystemDirectoryHandle | null) => void;

let root: FileSystemDirectoryHandle | null = null;
const listeners = new Set<Listener>();

/** Current live vault handle, or null when nothing is connected. */
export function getVaultRoot(): FileSystemDirectoryHandle | null {
  return root;
}

/** Subscribe to vault connection changes. Fires immediately with the current state. */
export function onVaultChange(fn: Listener): void {
  listeners.add(fn);
  fn(root);
}

function emit(): void {
  for (const fn of listeners) fn(root);
}

export function initVault(): void {
  const $status = document.getElementById('vault-status')!;
  const $connect = document.getElementById('vault-connect') as HTMLButtonElement;
  const $hint = document.getElementById('vault-hint')!;

  function paint(): void {
    if (root) {
      $status.textContent = `${root.name}/`;
      $status.classList.add('is-connected');
      $status.classList.remove('is-error');
      $connect.textContent = 'Change';
      $hint.classList.add('hidden');
    } else {
      $status.classList.remove('is-connected');
      $connect.textContent = 'Connect vault';
      $hint.classList.remove('hidden');
    }
  }

  async function connect(): Promise<void> {
    try {
      // Re-grant on the stored handle if we have one; otherwise pick fresh.
      const restored = await loadDirectory(VAULT_DIR_KEY, true);
      root = restored ?? (await pickDirectory(VAULT_DIR_KEY));
      paint();
      emit();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      $status.textContent = `error: ${String(err)}`;
      $status.classList.add('is-error');
      $status.classList.remove('is-connected');
    }
  }

  $connect.addEventListener('click', connect);
  paint();

  // Quietly restore a still-granted handle so the vault is live on open
  // without a click. A lapsed grant leaves the Connect button for the user.
  void (async () => {
    if (await hasStoredDirectory(VAULT_DIR_KEY)) {
      $connect.textContent = 'Reconnect vault';
      const restored = await loadDirectory(VAULT_DIR_KEY, false);
      if (restored) {
        root = restored;
        paint();
        emit();
      }
    }
  })();
}
