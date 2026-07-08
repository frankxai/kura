// ============================================================
// Arcanea Vault — Perplexity Content Script
// Captures threads, sources, and answers from perplexity.ai
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

class PerplexityScraper extends PlatformScraper {
  readonly platform: Platform = 'perplexity';
  readonly hostPatterns = ['perplexity.ai'];

  async detect(): Promise<DetectionResult> {
    this.updateProgress({ status: 'scanning' });

    const conversations = await this.extractConversations();
    const prompts = await this.extractPrompts();

    this.updateProgress({ status: 'complete' });

    return {
      platform: 'perplexity',
      pageType: 'conversation',
      conversations,
      media: [],
      prompts,
      stats: {
        totalConversations: conversations.length,
        totalImages: 0,
        totalVideos: 0,
        totalPrompts: prompts.length,
      },
    };
  }

  async extractConversations(): Promise<Conversation[]> {
    const messages = await this.extractMessages();
    if (messages.length === 0) return [];

    const titleEl = document.querySelector('title');
    const title = titleEl?.textContent?.replace(' - Perplexity', '').trim() || 'Perplexity Thread';

    return [{
      id: this.generateId(),
      platform: 'perplexity',
      title,
      url: window.location.href,
      messages,
      capturedAt: new Date().toISOString(),
    }];
  }

  private async extractMessages(): Promise<Message[]> {
    const messages: Message[] = [];

    // Perplexity thread structure
    const turns = document.querySelectorAll(
      '[class*="ThreadMessage"], [class*="query"], [class*="answer"]'
    );

    for (const turn of turns) {
      const isQuery = turn.classList.toString().includes('query') ||
        turn.classList.toString().includes('Query');

      const contentEl = turn.querySelector(
        '.prose, [class*="markdown"], [class*="answer-text"], [class*="query-text"]'
      ) || turn;

      const content = this.extractText(contentEl);
      if (content) {
        messages.push({
          role: isQuery ? 'user' : 'assistant',
          content,
        });
      }
    }

    return messages;
  }

  async extractMedia(): Promise<MediaItem[]> {
    return [];
  }

  async extractPrompts(): Promise<PromptItem[]> {
    const prompts: PromptItem[] = [];
    const seen = new Set<string>();

    const queries = document.querySelectorAll(
      '[class*="query-text"], [class*="Query"] [class*="content"]'
    );

    for (const el of queries) {
      const text = this.extractText(el);
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        prompts.push({
          id: this.generateId(),
          platform: 'perplexity',
          text,
          capturedAt: new Date().toISOString(),
        });
      }
    }

    return prompts;
  }
}

export default defineContentScript({
  matches: ['https://www.perplexity.ai/*'],
  runAt: 'document_idle',
  main() {
    const scraper = new PerplexityScraper();

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

    chrome.runtime.sendMessage({ type: 'VAULT_CONTENT_READY', platform: 'perplexity' });
  },
});
