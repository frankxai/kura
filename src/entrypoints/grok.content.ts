// ============================================================
// Arcanea Vault — Grok Content Script
// Captures conversations, Imagine images/videos, and prompts
// from grok.com
// ============================================================

import { defineContentScript } from 'wxt/utils/define-content-script';
import { PlatformScraper } from '@/core/scraper';
import type {
  Platform,
  DetectionResult,
  Conversation,
  MediaItem,
  PromptItem,
  Message,
} from '@/core/types';

class GrokScraper extends PlatformScraper {
  readonly platform: Platform = 'grok';
  readonly hostPatterns = ['grok.com'];

  async detect(): Promise<DetectionResult> {
    this.updateProgress({ status: 'scanning' });

    const isImagine = window.location.pathname.startsWith('/imagine');
    const isConversation = window.location.pathname.startsWith('/c/') ||
      window.location.pathname === '/';

    const [conversations, media, prompts] = await Promise.all([
      isConversation ? this.extractConversations() : Promise.resolve([]),
      isImagine ? this.extractMedia() : Promise.resolve([]),
      this.extractPrompts(),
    ]);

    this.updateProgress({ status: 'complete' });

    return {
      platform: 'grok',
      pageType: isImagine ? 'imagine' : isConversation ? 'conversation' : 'unknown',
      conversations,
      media,
      prompts,
      stats: {
        totalConversations: conversations.length,
        totalImages: media.filter((m) => m.type === 'image').length,
        totalVideos: media.filter((m) => m.type === 'video').length,
        totalPrompts: prompts.length,
      },
    };
  }

  async extractConversations(): Promise<Conversation[]> {
    const messages = await this.extractMessages();
    if (messages.length === 0) return [];

    // Extract conversation ID from URL
    const urlMatch = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
    const convId = urlMatch?.[1] || this.generateId();

    // Try to get title from page
    const titleEl = document.querySelector('title');
    const title = titleEl?.textContent?.replace(' - Grok', '').trim() || 'Grok Conversation';

    return [{
      id: `grok-${convId}`,
      platform: 'grok',
      title,
      url: window.location.href,
      messages,
      capturedAt: new Date().toISOString(),
    }];
  }

  private async extractMessages(): Promise<Message[]> {
    const messages: Message[] = [];

    // Grok conversation containers
    const responseContainers = document.querySelectorAll(
      '[class*="response-turn"], [class*="message-row"], [data-testid*="message"]'
    );

    if (responseContainers.length === 0) {
      // Fallback: try generic chat structure
      const allMessages = document.querySelectorAll(
        '.response-content-markdown, [class*="markdown"]'
      );

      for (const el of allMessages) {
        messages.push({
          role: 'assistant',
          content: this.extractText(el),
        });
      }
      return messages;
    }

    for (const container of responseContainers) {
      const isUser = container.classList.toString().includes('user') ||
        container.querySelector('[class*="user"]') !== null;

      const contentEl = container.querySelector(
        '.response-content-markdown, [class*="markdown"], [class*="content"]'
      );

      if (contentEl) {
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: this.extractText(contentEl),
        });
      }
    }

    return messages;
  }

  async extractMedia(): Promise<MediaItem[]> {
    const media: MediaItem[] = [];

    // Auto-scroll to load all content
    await this.scrollToLoadAll(undefined, 500);

    // Find all image containers
    const imageViewers = document.querySelectorAll(
      '[data-testid="image-viewer"] img, [class*="imagine"] img, .grid img'
    );

    for (const img of imageViewers) {
      const src = (img as HTMLImageElement).src;
      if (!src || src.startsWith('data:')) continue;

      // Try to get HD URL by replacing preview path
      const hdUrl = src
        .replace('/preview/', '/full/')
        .replace('_preview', '_full')
        .replace(/w=\d+/, 'w=2048');

      // Find the nearest prompt text
      const promptEl = img.closest('[class*="card"], [class*="item"]')
        ?.querySelector('[class*="prompt"], [class*="text"], p');
      const prompt = promptEl ? this.extractText(promptEl) : '';

      // Extract post ID from URL or data attributes
      const postId = this.extractPostId(img as HTMLElement);

      media.push({
        id: postId || this.generateId(),
        platform: 'grok',
        type: 'image',
        url: src,
        hdUrl: hdUrl !== src ? hdUrl : undefined,
        prompt,
        filename: this.sanitizeFilename(`grok_${prompt.slice(0, 50) || 'image'}_${Date.now()}.jpg`),
        capturedAt: new Date().toISOString(),
      });
    }

    // Find all video elements
    const videos = document.querySelectorAll(
      'video source, video[src], [data-testid*="video"] video'
    );

    for (const vid of videos) {
      const src = (vid as HTMLVideoElement).src ||
        (vid as HTMLSourceElement).src ||
        vid.getAttribute('src') || '';
      if (!src) continue;

      const promptEl = vid.closest('[class*="card"], [class*="item"]')
        ?.querySelector('[class*="prompt"], [class*="text"], p');
      const prompt = promptEl ? this.extractText(promptEl) : '';

      const postId = this.extractPostId(vid as HTMLElement);

      media.push({
        id: postId || this.generateId(),
        platform: 'grok',
        type: 'video',
        url: src,
        prompt,
        filename: this.sanitizeFilename(`grok_${prompt.slice(0, 50) || 'video'}_${Date.now()}.mp4`),
        capturedAt: new Date().toISOString(),
      });
    }

    this.updateProgress({ total: media.length });
    return media;
  }

  async extractPrompts(): Promise<PromptItem[]> {
    const prompts: PromptItem[] = [];

    // From Imagine page
    const promptElements = document.querySelectorAll(
      '.response-content-markdown, [class*="prompt-text"], [class*="user-message"]'
    );

    const seen = new Set<string>();

    for (const el of promptElements) {
      const text = this.extractText(el);
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        prompts.push({
          id: this.generateId(),
          platform: 'grok',
          text,
          capturedAt: new Date().toISOString(),
        });
      }
    }

    return prompts;
  }

  /** Try to extract a Grok post ID from element or ancestor attributes */
  private extractPostId(el: HTMLElement): string | null {
    // Walk up the DOM looking for data attributes or href with IDs
    let current: HTMLElement | null = el;
    while (current) {
      // Check data attributes
      for (const attr of current.attributes) {
        if (attr.name.startsWith('data-') && /[a-f0-9-]{20,}/.test(attr.value)) {
          return `grok-${attr.value}`;
        }
      }

      // Check href
      const href = current.getAttribute('href');
      if (href) {
        const match = href.match(/\/imagine\/([a-f0-9-]+)/);
        if (match) return `grok-${match[1]}`;
      }

      current = current.parentElement;
    }
    return null;
  }
}

export default defineContentScript({
  matches: ['https://grok.com/*'],
  runAt: 'document_idle',
  main() {
    const scraper = new GrokScraper();

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'VAULT_DETECT') {
        scraper.detect().then(sendResponse);
        return true; // async response
      }

      if (message.type === 'VAULT_EXTRACT_CONVERSATIONS') {
        scraper.extractConversations().then(sendResponse);
        return true;
      }

      if (message.type === 'VAULT_EXTRACT_MEDIA') {
        scraper.extractMedia().then(sendResponse);
        return true;
      }

      if (message.type === 'VAULT_EXTRACT_PROMPTS') {
        scraper.extractPrompts().then(sendResponse);
        return true;
      }
    });

    // Notify background that content script is ready
    chrome.runtime.sendMessage({ type: 'VAULT_CONTENT_READY', platform: 'grok' });
  },
});
