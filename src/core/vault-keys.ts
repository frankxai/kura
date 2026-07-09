// ============================================================
// Kura — Shared storage keys
// One connected folder backs both conversation capture (written
// under `<platform>/`) and the Suno harvester (written under
// `suno/`), giving a single local Arcanea/intake root. Keeping the
// key here lets the side panel, offscreen writer, and Suno tab all
// agree on which handle to load.
// ============================================================

/** IndexedDB key (in the `kura-fs` store) for the vault directory handle. */
export const VAULT_DIR_KEY = 'kura_vault';
