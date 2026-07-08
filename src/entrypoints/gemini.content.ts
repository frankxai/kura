// ============================================================
// Arcanea Vault — Gemini Content Script
// Captures conversations and generated images from Gemini
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

class GeminiScraper extends PlatformScraper {
  readonly platform: Platform = 'gemini';
  readonly hostPatterns = ['gemini.google.com', 'aistudio.google.com'];

  async detect(): Promise<DetectionResult> {
    this.updateProgress({ status: 'scanning' });

    const conversations = await this.extractConversations();
    const media = await this.extractMedia();
    const prompts = await this.extractPrompts();

    this.updateProgress({ status: 'complete' });

    return {
      platform: 'gemini',
      pageType: 'conversation',
      conversations,
      media,
      prompts,
      stats: {
        totalConversations: conversations.length,
        totalImages: media.length,
        totalVideos: 0,
        totalPrompts: prompts.length,
      },
    };
  }

  async extractConversations(): Promise<Conversation[]> {
    const messages = await this.extractMessages();
    if (messages.length === 0) return [];

    const titleEl = document.querySelector('title');
    const title = titleEl?.textContent?.replace(' - Google Gemini', '').trim() || 'Gemini Conversation';

    return [{
      id: this.generateId(),
      platform: 'gemini',
      title,
      url: window.location.href,
      messages,
      capturedAt: new Date().toISOString(),
    }];
  }

  private async extractMessages(): Promise<Message[]> {
    const messages: Message[] = [];

    // Gemini uses model-response and user-query containers
    const turns = document.querySelectorAll(
      'model-response, user-query, [class*="query-content"], [class*="model-response"]'
    );

    for (const turn of turns) {
      const tagName = turn.tagName.toLowerCase();
      const isUser = tagName === 'user-query' ||
        turn.classList.toString().includes('query');

      const contentEl = turn.querySelector(
        '.markdown, [class*="markdown"], [class*="response-content"], [class*="query-text"]'
      ) || turn;

      const content = this.extractText(contentEl);
      if (content) {
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content,
        });
      }
    }

    return messages;
  }

  async extractMedia(): Promise<MediaItem[]> {
    const media: MediaItem[] = [];

    // Gemini-generated images
    const images = document.querySelectorAll(
      'model-response img[src*="googleusercontent"], [class*="generated-image"] img'
    );

    for (const img of images) {
      const src = (img as HTMLImageElement).src;
      if (!src || src.startsWith('data:') || src.includes('avatar')) continue;

      media.push({
        id: this.generateId(),
        platform: 'gemini',
        type: 'image',
        url: src,
        prompt: '',
        filename: this.sanitizeFilename(`gemini_image_${Date.now()}.png`),
        capturedAt: new Date().toISOString(),
      });
    }

    return media;
  }

  async extractPrompts(): Promise<PromptItem[]> {
    const prompts: PromptItem[] = [];
    const seen = new Set<string>();

    const userQueries = document.querySelectorAll(
      'user-query [class*="query-text"], [class*="query-content"]'
    );

    for (const el of userQueries) {
      const text = this.extractText(el);
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        prompts.push({
          id: this.generateId(),
          platform: 'gemini',
          text,
          capturedAt: new Date().toISOString(),
        });
      }
    }

    return prompts;
  }
}

export default defineContentScript({
  matches: ['https://gemini.google.com/*', 'https://aistudio.google.com/*'],
  runAt: 'document_idle',
  main() {
    const scraper = new GeminiScraper();

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'VAULT_DETECT') {
        scraper.detect().then(sendResponse);
        return true;
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

    chrome.runtime.sendMessage({ type: 'VAULT_CONTENT_READY', platform: 'gemini' });
  },
});
