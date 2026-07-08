// ============================================================
// Arcanea Vault — ChatGPT Content Script
// Captures conversations and DALL-E images from chatgpt.com
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

class ChatGPTScraper extends PlatformScraper {
  readonly platform: Platform = 'chatgpt';
  readonly hostPatterns = ['chatgpt.com', 'chat.openai.com'];

  async detect(): Promise<DetectionResult> {
    this.updateProgress({ status: 'scanning' });

    const conversations = await this.extractConversations();
    const media = await this.extractMedia();
    const prompts = await this.extractPrompts();

    this.updateProgress({ status: 'complete' });

    return {
      platform: 'chatgpt',
      pageType: 'conversation',
      conversations,
      media,
      prompts,
      stats: {
        totalConversations: conversations.length,
        totalImages: media.filter((m) => m.type === 'image').length,
        totalVideos: 0,
        totalPrompts: prompts.length,
      },
    };
  }

  async extractConversations(): Promise<Conversation[]> {
    const messages = await this.extractMessages();
    if (messages.length === 0) return [];

    const urlMatch = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
    const convId = urlMatch?.[1] || this.generateId();

    const titleEl = document.querySelector('title');
    const title = titleEl?.textContent?.replace(' | ChatGPT', '').trim() || 'ChatGPT Conversation';

    return [{
      id: `chatgpt-${convId}`,
      platform: 'chatgpt',
      title,
      url: window.location.href,
      messages,
      capturedAt: new Date().toISOString(),
    }];
  }

  private async extractMessages(): Promise<Message[]> {
    const messages: Message[] = [];

    // ChatGPT message containers
    const turns = document.querySelectorAll(
      '[data-message-author-role], [class*="agent-turn"], [class*="user-turn"]'
    );

    for (const turn of turns) {
      const role = turn.getAttribute('data-message-author-role');
      const isUser = role === 'user' ||
        turn.classList.toString().includes('user');

      const contentEl = turn.querySelector(
        '.markdown, [class*="markdown"], [class*="message-content"]'
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

    // DALL-E generated images
    const images = document.querySelectorAll(
      'img[src*="oaidalleapi"], img[src*="dall-e"], [data-testid*="image"] img'
    );

    for (const img of images) {
      const src = (img as HTMLImageElement).src;
      if (!src || src.startsWith('data:')) continue;

      const altText = (img as HTMLImageElement).alt || '';

      media.push({
        id: this.generateId(),
        platform: 'chatgpt',
        type: 'image',
        url: src,
        prompt: altText,
        filename: this.sanitizeFilename(`chatgpt_${altText.slice(0, 50) || 'image'}_${Date.now()}.png`),
        capturedAt: new Date().toISOString(),
      });
    }

    return media;
  }

  async extractPrompts(): Promise<PromptItem[]> {
    const prompts: PromptItem[] = [];
    const seen = new Set<string>();

    const userMessages = document.querySelectorAll(
      '[data-message-author-role="user"] .markdown, [class*="user-turn"] [class*="content"]'
    );

    for (const el of userMessages) {
      const text = this.extractText(el);
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        prompts.push({
          id: this.generateId(),
          platform: 'chatgpt',
          text,
          capturedAt: new Date().toISOString(),
        });
      }
    }

    return prompts;
  }
}

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  runAt: 'document_idle',
  main() {
    const scraper = new ChatGPTScraper();

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

    chrome.runtime.sendMessage({ type: 'VAULT_CONTENT_READY', platform: 'chatgpt' });
  },
});
