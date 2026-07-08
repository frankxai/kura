// ============================================================
// Arcanea Vault — DeepSeek Content Script
// Captures conversations from chat.deepseek.com
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

class DeepSeekScraper extends PlatformScraper {
  readonly platform: Platform = 'deepseek';
  readonly hostPatterns = ['chat.deepseek.com'];

  async detect(): Promise<DetectionResult> {
    this.updateProgress({ status: 'scanning' });

    const conversations = await this.extractConversations();
    const prompts = await this.extractPrompts();

    this.updateProgress({ status: 'complete' });

    return {
      platform: 'deepseek',
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
    const title = titleEl?.textContent?.replace(' - DeepSeek', '').trim() || 'DeepSeek Conversation';

    return [{
      id: this.generateId(),
      platform: 'deepseek',
      title,
      url: window.location.href,
      messages,
      capturedAt: new Date().toISOString(),
    }];
  }

  private async extractMessages(): Promise<Message[]> {
    const messages: Message[] = [];

    const turns = document.querySelectorAll(
      '[class*="message-"], [class*="chat-message"], [data-role]'
    );

    for (const turn of turns) {
      const role = turn.getAttribute('data-role');
      const isUser = role === 'user' ||
        turn.classList.toString().includes('user');

      const contentEl = turn.querySelector(
        '.markdown-body, [class*="markdown"], [class*="content"]'
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
    return [];
  }

  async extractPrompts(): Promise<PromptItem[]> {
    const prompts: PromptItem[] = [];
    const seen = new Set<string>();

    const userMessages = document.querySelectorAll(
      '[data-role="user"] [class*="content"], [class*="user-message"]'
    );

    for (const el of userMessages) {
      const text = this.extractText(el);
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        prompts.push({
          id: this.generateId(),
          platform: 'deepseek',
          text,
          capturedAt: new Date().toISOString(),
        });
      }
    }

    return prompts;
  }
}

export default defineContentScript({
  matches: ['https://chat.deepseek.com/*'],
  runAt: 'document_idle',
  main() {
    const scraper = new DeepSeekScraper();

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

    chrome.runtime.sendMessage({ type: 'VAULT_CONTENT_READY', platform: 'deepseek' });
  },
});
