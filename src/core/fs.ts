// ============================================================
// Kura — File System Access layer
// Persists a user-picked directory handle and writes files
// straight to disk — no Downloads-folder shuffle.
// Extension-page contexts only (popup / side panel); MV3
// service workers cannot show pickers.
// ============================================================

// The File System Access picker + permission methods are WICG and not yet in
// TypeScript's lib.dom. Declare the minimal surface we use.
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
}

const DB_NAME = 'kura-fs';
const STORE = 'handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Show the directory picker and persist the handle under `key`.
 * Must be called from a user gesture in an extension page.
 */
export async function pickDirectory(key: string): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ id: key, mode: 'readwrite' });
  await idbSet(key, handle);
  return handle;
}

/**
 * Load a previously picked handle. Returns null when none is stored or
 * permission is not currently granted. Pass `requestIfNeeded` from a user
 * gesture to re-prompt for permission on a stored handle.
 */
export async function loadDirectory(
  key: string,
  requestIfNeeded = false,
): Promise<FileSystemDirectoryHandle | null> {
  const handle = await idbGet<FileSystemDirectoryHandle>(key);
  if (!handle) return null;

  let state = await handle.queryPermission({ mode: 'readwrite' });
  if (state === 'prompt' && requestIfNeeded) {
    state = await handle.requestPermission({ mode: 'readwrite' });
  }
  return state === 'granted' ? handle : null;
}

/** Whether a handle exists in storage at all (regardless of permission). */
export async function hasStoredDirectory(key: string): Promise<boolean> {
  return (await idbGet<FileSystemDirectoryHandle>(key)) !== undefined;
}

/** Resolve (and create) a nested directory path below `root`. */
export async function getDir(
  root: FileSystemDirectoryHandle,
  path: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of path) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  return dir;
}

/** Write text or binary content to `path` below `root`, creating directories. */
export async function writeFile(
  root: FileSystemDirectoryHandle,
  path: string[],
  content: string | Blob,
): Promise<void> {
  const filename = path[path.length - 1];
  const dir = await getDir(root, path.slice(0, -1));
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** Read a JSON file below `root`; returns `fallback` when missing/invalid. */
export async function readJson<T>(
  root: FileSystemDirectoryHandle,
  path: string[],
  fallback: T,
): Promise<T> {
  try {
    const filename = path[path.length - 1];
    const dir = await getDir(root, path.slice(0, -1));
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text()) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(
  root: FileSystemDirectoryHandle,
  path: string[],
  value: unknown,
): Promise<void> {
  await writeFile(root, path, JSON.stringify(value, null, 2) + '\n');
}
