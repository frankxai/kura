// ============================================================
// Arcanea Vault — Base Scraper
// Abstract platform scraper that all content scripts extend.
// ============================================================

import type {
  Platform,
  DetectionResult,
  Conversation,
  MediaItem,
  PromptItem,
  DownloadProgress,
} from './types';

/** Base class for all platform-specific scrapers */
export abstract class PlatformScraper {
  abstract readonly platform: Platform;
  abstract readonly hostPatterns: string[];

  protected progress: DownloadProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    status: 'idle',
  };

  /** Check if this scraper handles the current URL */
  matches(url: string): boolean {
    return this.hostPatterns.some((pattern) => url.includes(pattern));
  }

  /** Detect all exportable content on the current page */
  abstract detect(): Promise<DetectionResult>;

  /** Extract conversations from the page */
  abstract extractConversations(): Promise<Conversation[]>;

  /** Extract media items (images/videos) */
  abstract extractMedia(): Promise<MediaItem[]>;

  /** Extract prompts */
  abstract extractPrompts(): Promise<PromptItem[]>;

  /** Get current download/scan progress */
  getProgress(): DownloadProgress {
    return { ...this.progress };
  }

  /** Reset progress state */
  resetProgress(): void {
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      status: 'idle',
    };
  }

  /** Update progress and notify listeners */
  protected updateProgress(update: Partial<DownloadProgress>): void {
    Object.assign(this.progress, update);
    this.emitProgress();
  }

  /** Send progress to popup/sidepanel via chrome messaging */
  protected emitProgress(): void {
    chrome.runtime.sendMessage({
      type: 'VAULT_PROGRESS',
      platform: this.platform,
      progress: this.progress,
    }).catch(() => {
      // Popup might be closed — ignore
    });
  }

  /** Utility: wait for a DOM element to appear */
  protected waitForElement(
    selector: string,
    timeout = 5000,
  ): Promise<Element | null> {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /** Utility: scroll page to load lazy content */
  protected async scrollToLoadAll(
    containerSelector?: string,
    delayMs = 300,
  ): Promise<void> {
    const container = containerSelector
      ? document.querySelector(containerSelector)
      : window;

    if (!container) return;

    let lastHeight = 0;
    let stableCount = 0;

    while (stableCount < 3) {
      const scrollTarget = container === window ? document.body : (container as HTMLElement);
      const currentHeight = scrollTarget.scrollHeight;

      if (container === window) {
        window.scrollTo(0, currentHeight);
      } else {
        (container as HTMLElement).scrollTop = currentHeight;
      }

      await this.sleep(delayMs);

      if (currentHeight === lastHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      lastHeight = currentHeight;
    }
  }

  /** Utility: generate a unique ID */
  protected generateId(): string {
    return `${this.platform}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Utility: sleep */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Utility: sanitize filename */
  protected sanitizeFilename(name: string): string {
    return name
      // eslint-disable-next-line no-control-regex -- intentional: strip OS-reserved + control chars from filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 200);
  }

  /** Utility: extract text content, stripping HTML */
  protected extractText(element: Element): string {
    return (element.textContent || '').trim();
  }
}
