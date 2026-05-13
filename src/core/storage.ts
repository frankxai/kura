// ============================================================
// Arcanea Threads — In-extension index (IndexedDB)
// Fast cross-conversation queries. The filesystem vault is the source of truth.
// All data stays on your device. No cloud. No tracking.
// ============================================================

import type {
  Conversation,
  MediaItem,
  PromptItem,
  Platform,
  VaultStats,
} from './types';

const DB_NAME = 'arcanea-vault';
const DB_VERSION = 1;

type StoreName = 'conversations' | 'media' | 'prompts' | 'settings';

class VaultStorage {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('platform', 'platform', { unique: false });
          convStore.createIndex('capturedAt', 'capturedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('platform', 'platform', { unique: false });
          mediaStore.createIndex('type', 'type', { unique: false });
          mediaStore.createIndex('capturedAt', 'capturedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('prompts')) {
          const promptStore = db.createObjectStore('prompts', { keyPath: 'id' });
          promptStore.createIndex('platform', 'platform', { unique: false });
          promptStore.createIndex('capturedAt', 'capturedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(
    name: StoreName,
    mode: IDBTransactionMode = 'readonly',
  ): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(name, mode).objectStore(name);
  }

  // -- Conversations --

  async saveConversation(conv: Conversation): Promise<void> {
    const store = await this.getStore('conversations', 'readwrite');
    await this.promisify(store.put(conv));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const store = await this.getStore('conversations');
    return this.promisify(store.get(id));
  }

  async listConversations(platform?: Platform): Promise<Conversation[]> {
    const store = await this.getStore('conversations');
    if (platform) {
      const index = store.index('platform');
      return this.promisify(index.getAll(platform));
    }
    return this.promisify(store.getAll());
  }

  async deleteConversation(id: string): Promise<void> {
    const store = await this.getStore('conversations', 'readwrite');
    await this.promisify(store.delete(id));
  }

  // -- Media --

  async saveMedia(item: MediaItem): Promise<void> {
    const store = await this.getStore('media', 'readwrite');
    await this.promisify(store.put(item));
  }

  async getMedia(id: string): Promise<MediaItem | undefined> {
    const store = await this.getStore('media');
    return this.promisify(store.get(id));
  }

  async listMedia(platform?: Platform): Promise<MediaItem[]> {
    const store = await this.getStore('media');
    if (platform) {
      const index = store.index('platform');
      return this.promisify(index.getAll(platform));
    }
    return this.promisify(store.getAll());
  }

  async deleteMedia(id: string): Promise<void> {
    const store = await this.getStore('media', 'readwrite');
    await this.promisify(store.delete(id));
  }

  // -- Prompts --

  async savePrompt(prompt: PromptItem): Promise<void> {
    const store = await this.getStore('prompts', 'readwrite');
    await this.promisify(store.put(prompt));
  }

  async listPrompts(platform?: Platform): Promise<PromptItem[]> {
    const store = await this.getStore('prompts');
    if (platform) {
      const index = store.index('platform');
      return this.promisify(index.getAll(platform));
    }
    return this.promisify(store.getAll());
  }

  // -- Settings --

  async getSetting<T>(key: string): Promise<T | undefined> {
    const store = await this.getStore('settings');
    const result = await this.promisify(store.get(key));
    return result?.value as T | undefined;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore('settings', 'readwrite');
    await this.promisify(store.put({ key, value }));
  }

  // -- Stats --

  async getStats(): Promise<VaultStats> {
    const [conversations, media, prompts] = await Promise.all([
      this.listConversations(),
      this.listMedia(),
      this.listPrompts(),
    ]);

    const platformBreakdown: Record<string, number> = {};
    const allItems = [
      ...conversations.map((c) => c.platform),
      ...media.map((m) => m.platform),
      ...prompts.map((p) => p.platform),
    ];

    for (const p of allItems) {
      platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;
    }

    const allDates = [
      ...conversations.map((c) => c.capturedAt),
      ...media.map((m) => m.capturedAt),
      ...prompts.map((p) => p.capturedAt),
    ].sort();

    return {
      totalConversations: conversations.length,
      totalMedia: media.length,
      totalPrompts: prompts.length,
      storageUsedBytes: 0, // IndexedDB doesn't easily report this
      platformBreakdown: platformBreakdown as Record<Platform, number>,
      lastCaptureAt: allDates[allDates.length - 1],
    };
  }

  // -- Utility --

  async clearAll(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(
      ['conversations', 'media', 'prompts'],
      'readwrite',
    );
    tx.objectStore('conversations').clear();
    tx.objectStore('media').clear();
    tx.objectStore('prompts').clear();
  }

  private promisify<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

/** Singleton vault storage instance */
export const vault = new VaultStorage();
