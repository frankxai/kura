// ============================================================
// Arcanea Vault — Gemini Content Script
// Captures conversations and generated images from Gemini
//
// Hardening notes (2026-07): Gemini's Angular-based DOM churns class
// names frequently; custom element tags (<user-query>, <model-response>)
// are more stable. Every extractor below runs a tiered cascade — the
// original selectors first, then documented 2026 alternatives cross
// -checked against multiple actively-maintained third-party Gemini
// exporters (gemini-chat-exporter, "Gemini to Markdown" and "Gemini Chat
// Exporter" userscripts), then a generic heuristic as a last resort.
// Every tier is additive: nothing below removes or narrows an existing
// selector, it only adds a fallback for when the tier above finds
// nothing.
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

  /**
   * Memoized per page-load so `extractMedia()` can link generated images
   * back to the conversation captured by `extractConversations()` via
   * `MediaItem.metadata.conversationId` (see background.ts
   * `inferParentSlug`). Stable across repeat VAULT_* calls in the same
   * session; still degrades fine if only `extractMedia()` is ever called
   * (message handler path) — background.ts falls back to "first
   * conversation on the page" when no id matches.
   */
  private capturedConversationId: string | null = null;

  private conversationId(): string {
    if (!this.capturedConversationId) {
      this.capturedConversationId = this.generateId();
    }
    return this.capturedConversationId;
  }

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
        totalImages: media.filter((m) => m.type === 'image').length,
        totalVideos: 0,
        totalPrompts: prompts.length,
      },
    };
  }

  async extractConversations(): Promise<Conversation[]> {
    const messages = await this.extractMessages();

    // Canvas documents and Deep Research reports both render in the same
    // side "immersive artifact" panel (Google's own Deep Research help
    // doc: exporting a report happens from the Canvas panel via "Share &
    // export"). Fold it into the conversation as a trailing section so it
    // survives in conversation.md rather than being silently dropped.
    const canvasContent = this.extractCanvasOrDeepResearch();
    if (canvasContent) {
      messages.push({ role: 'assistant', content: canvasContent });
    }

    if (messages.length === 0) return [];

    const titleEl = document.querySelector('title');
    let title = titleEl?.textContent?.replace(' - Google Gemini', '').trim() || '';

    // 2026 fallback: dedicated title element used by gemini-chat-exporter
    // and the "Gemini Chat Exporter" userscript when the <title> tag is
    // empty or hasn't updated yet (Angular SPA title lag).
    if (!title) {
      const titleNode = document.querySelector('[data-test-id="conversation-title"]');
      title = titleNode ? this.extractText(titleNode) : '';
    }
    if (!title) title = 'Gemini Conversation';

    return [{
      id: this.conversationId(),
      platform: 'gemini',
      title,
      url: window.location.href,
      messages,
      capturedAt: new Date().toISOString(),
    }];
  }

  private async extractMessages(): Promise<Message[]> {
    const messages: Message[] = [];

    // ---- Tier 1: existing selectors, unchanged ----
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

    if (messages.length > 0) return messages;

    // ---- Tier 2: 2026 documented alternative ----
    // Cross-checked against gemini-chat-exporter (GitHub) and two
    // actively-maintained Greasy Fork userscripts (updated 2026-07 and
    // 2026-03): each turn lives in a `.conversation-container`, holding
    // exactly one <user-query> and one <model-response> custom element.
    // This survives class-name churn that breaks tier 1's `[class*=...]`
    // matches, and preserves user/assistant document order per turn.
    const containers = document.querySelectorAll(
      '.conversation-container, main .conversation-container'
    );

    for (const container of containers) {
      const userEl = container.querySelector(
        'user-query div.query-text, user-query-content, user-query [class*="query-text"], user-query'
      );
      if (userEl) {
        const text = this.extractCleanText(userEl);
        if (text) messages.push({ role: 'user', content: text });
      }

      const modelEl = container.querySelector('model-response');
      if (modelEl) {
        const markdownEl = modelEl.querySelector(
          'message-content.model-response-text div.markdown.markdown-main-panel, ' +
          '.response-content .markdown, .model-response-text, [class*="markdown-main-panel"]'
        ) || modelEl;
        const text = this.extractCleanText(markdownEl);
        if (text) messages.push({ role: 'assistant', content: text });
      }
    }

    if (messages.length > 0) return messages;

    // ---- Tier 3: generic heuristic, last resort ----
    // Assumes strict user/assistant alternation starting with the user
    // turn, mirroring the Claude scraper's own fallback tier. Only
    // reached if both the current and documented-2026 selector sets find
    // nothing, i.e. a DOM shape we haven't seen yet.
    const genericBlocks = document.querySelectorAll(
      '[class*="prose"], [class*="message-content"], [class*="contents"], article, [role="article"]'
    );

    let isUserTurn = true;
    for (const block of genericBlocks) {
      const text = this.extractCleanText(block);
      if (text) {
        messages.push({ role: isUserTurn ? 'user' : 'assistant', content: text });
        isUserTurn = !isUserTurn;
      }
    }

    return messages;
  }

  /**
   * Canvas / Deep Research capture. Both surfaces render inside Gemini's
   * "immersive artifact" side panel — selector confirmed via the "Gemini
   * to Markdown" userscript (targets `.immersive-artifact-container` /
   * `.immersive-artifact-content` / `h2.title-text`). Unverified against
   * a live Gemini session (no browser access during this pass) — treat
   * as best-effort; degrades to null (no-op) if the panel isn't present
   * or is empty, never throws.
   */
  private extractCanvasOrDeepResearch(): string | null {
    const panel = document.querySelector(
      '.immersive-artifact-container, [class*="immersive-artifact-container"], ' +
      '[class*="immersive-panel"], immersive-panel'
    );
    if (!panel) return null;

    const titleEl = panel.querySelector('h2.title-text, [class*="title-text"], h1, h2');
    const title = titleEl ? this.extractText(titleEl) : 'Canvas';

    const bodyEl = panel.querySelector(
      '.immersive-artifact-content, [class*="immersive-artifact-content"], [class*="canvas-content"]'
    ) || panel;
    const text = this.extractCleanText(bodyEl);
    if (!text) return null;

    return `## Canvas: ${title}\n\n${text}`;
  }

  async extractMedia(): Promise<MediaItem[]> {
    const media: MediaItem[] = [];
    const seenUrls = new Set<string>();

    // ---- Tier 1: existing selectors, unchanged ----
    // Gemini-generated images
    const images = document.querySelectorAll(
      'model-response img[src*="googleusercontent"], [class*="generated-image"] img'
    );

    for (const img of images) {
      const src = (img as HTMLImageElement).src;
      if (!src || src.startsWith('data:') || src.includes('avatar')) continue;
      if (seenUrls.has(src)) continue;
      seenUrls.add(src);

      media.push({
        id: this.generateId(),
        platform: 'gemini',
        type: 'image',
        url: src,
        prompt: this.findNearbyPrompt(img),
        filename: this.sanitizeFilename(`gemini_image_${Date.now()}.png`),
        capturedAt: new Date().toISOString(),
        metadata: { conversationId: this.conversationId() },
      });
    }

    // ---- Tier 2: 2026 documented alternative ----
    // Nano Banana / Nano Banana Pro generations also surface inside the
    // Canvas immersive panel, and Gemini serves generated images from
    // multiple googleusercontent subdomains/paths (e.g. the
    // `image_generation_content` path reported in Gemini's own user
    // forum) — the tier-1 `model-response` ancestor scope can miss these
    // if the panel isn't nested under `<model-response>`.
    const canvasImages = document.querySelectorAll(
      '.immersive-artifact-container img[src*="googleusercontent"], ' +
      '[class*="immersive-artifact"] img[src*="googleusercontent"], ' +
      'img[src*="googleusercontent"][src*="image_generation"]'
    );

    for (const img of canvasImages) {
      const el = img as HTMLImageElement;
      const src = el.src;
      if (!src || src.startsWith('data:') || src.includes('avatar') || seenUrls.has(src)) continue;
      // Skip obvious icon-sized chrome (control glyphs, avatars) when we
      // have real dimensions to check — never filters when unknown (0).
      if (el.naturalWidth > 0 && el.naturalWidth <= 32) continue;

      seenUrls.add(src);
      media.push({
        id: this.generateId(),
        platform: 'gemini',
        type: 'image',
        url: src,
        prompt: this.findNearbyPrompt(img),
        filename: this.sanitizeFilename(`gemini_image_${Date.now()}.png`),
        capturedAt: new Date().toISOString(),
        metadata: { conversationId: this.conversationId() },
      });
    }

    return media;
  }

  /**
   * Best-effort: recover the prompt that produced a generated image by
   * walking up to its enclosing turn and reading the paired
   * `<user-query>` text. Returns '' (never throws) when nothing is
   * found — matches the pre-hardening contract where `prompt` was
   * always ''.
   */
  private findNearbyPrompt(img: Element): string {
    const container = img.closest('.conversation-container');
    if (container) {
      const userEl = container.querySelector(
        'user-query div.query-text, user-query-content, user-query'
      );
      if (userEl) {
        const text = this.extractCleanText(userEl);
        if (text) return text;
      }
    }

    // Fallback: the previous sibling turn in document order.
    const turn = img.closest('model-response, [class*="model-response"]');
    const prevUser = turn?.previousElementSibling;
    if (
      prevUser &&
      (prevUser.tagName.toLowerCase() === 'user-query' || prevUser.classList.toString().includes('query'))
    ) {
      const text = this.extractCleanText(prevUser);
      if (text) return text;
    }

    return '';
  }

  async extractPrompts(): Promise<PromptItem[]> {
    const prompts: PromptItem[] = [];
    const seen = new Set<string>();

    // ---- Tier 1: existing selectors, unchanged ----
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

    if (prompts.length > 0) return prompts;

    // ---- Tier 2: 2026 documented alternative ----
    // Falls straight to the custom element (and its documented inner
    // wrapper) when the class-based hooks above don't match — class-name
    // churn is Gemini's most common breakage mode, the tag names are not.
    const altQueries = document.querySelectorAll(
      'user-query div.query-text, user-query-content, user-query'
    );

    for (const el of altQueries) {
      const text = this.extractCleanText(el);
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

  /**
   * Extract text while stripping known Gemini UI noise (rating/copy
   * buttons, screen-reader-only labels, source chips) so captured
   * markdown doesn't carry stray icon-label text. Operates on a clone —
   * never mutates the live page DOM (capture-only, per repo policy).
   */
  private extractCleanText(el: Element): string {
    const clone = el.cloneNode(true) as Element;
    const noise = clone.querySelectorAll(
      '.screen-reader-only, [class*="screen-reader-only"], button, [role="button"], ' +
      '[class*="generated-image-controls"], [class*="export-sheets-button-container"], ' +
      'processing-state, sources-list, user-notice, action-card'
    );
    noise.forEach((n) => n.remove());
    return this.extractText(clone);
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
