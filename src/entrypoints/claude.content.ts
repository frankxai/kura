// ============================================================
// Arcanea Vault — Claude Content Script
// Captures conversations and artifacts from claude.ai
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
  Attachment,
} from '@/core/types';

class ClaudeScraper extends PlatformScraper {
  readonly platform: Platform = 'claude';
  readonly hostPatterns = ['claude.ai'];

  async detect(): Promise<DetectionResult> {
    this.updateProgress({ status: 'scanning' });

    const conversations = await this.extractConversations();
    const prompts = await this.extractPrompts();

    this.updateProgress({ status: 'complete' });

    return {
      platform: 'claude',
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

    const urlMatch = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
    const convId = urlMatch?.[1] || this.generateId();

    const titleEl = document.querySelector('title');
    const title = titleEl?.textContent?.replace(' - Claude', '').trim() || 'Claude Conversation';

    return [{
      id: `claude-${convId}`,
      platform: 'claude',
      title,
      url: window.location.href,
      messages,
      capturedAt: new Date().toISOString(),
    }];
  }

  private async extractMessages(): Promise<Message[]> {
    const messages: Message[] = [];

    // Claude message containers
    const turns = document.querySelectorAll(
      '[class*="font-claude-message"], [class*="human-turn"], [class*="assistant-turn"], [data-is-streaming]'
    );

    if (turns.length === 0) {
      // Fallback: look for alternating message pattern
      const allBlocks = document.querySelectorAll(
        '[class*="prose"], [class*="message-content"], [class*="contents"]'
      );

      let isUser = true;
      for (const block of allBlocks) {
        const content = this.extractText(block);
        if (content) {
          // Detect artifacts
          const attachments = this.extractArtifacts(block);

          messages.push({
            role: isUser ? 'user' : 'assistant',
            content,
            attachments: attachments.length > 0 ? attachments : undefined,
          });
          isUser = !isUser;
        }
      }
      return messages;
    }

    for (const turn of turns) {
      const isHuman = turn.classList.toString().includes('human') ||
        turn.querySelector('[class*="human"]') !== null;

      const contentEl = turn.querySelector(
        '[class*="prose"], [class*="markdown"], [class*="message"]'
      );

      if (contentEl) {
        const attachments = this.extractArtifacts(turn);

        messages.push({
          role: isHuman ? 'user' : 'assistant',
          content: this.extractText(contentEl),
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      }
    }

    return messages;
  }

  /** Extract Claude artifacts (code, documents, etc.) */
  private extractArtifacts(container: Element): Attachment[] {
    const artifacts: Attachment[] = [];

    // Code blocks
    const codeBlocks = container.querySelectorAll('pre code, [class*="artifact"] pre');
    for (const code of codeBlocks) {
      artifacts.push({
        type: 'code',
        url: this.extractText(code),
        filename: `artifact_${Date.now()}.txt`,
      });
    }

    return artifacts;
  }

  async extractMedia(): Promise<MediaItem[]> {
    // Claude doesn't generate images (yet)
    return [];
  }

  async extractPrompts(): Promise<PromptItem[]> {
    const prompts: PromptItem[] = [];
    const seen = new Set<string>();

    const userMessages = document.querySelectorAll(
      '[class*="human-turn"] [class*="prose"], [class*="human"] [class*="contents"]'
    );

    for (const el of userMessages) {
      const text = this.extractText(el);
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        prompts.push({
          id: this.generateId(),
          platform: 'claude',
          text,
          capturedAt: new Date().toISOString(),
        });
      }
    }

    return prompts;
  }
}

export default defineContentScript({
  matches: ['https://claude.ai/*'],
  runAt: 'document_idle',
  main() {
    const scraper = new ClaudeScraper();

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

    chrome.runtime.sendMessage({ type: 'VAULT_CONTENT_READY', platform: 'claude' });
  },
});
