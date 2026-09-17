// ============================================================
// Starlight Cortex — Dispatcher & Injector Unit Tests
// Validates multi-model routing, platform URL mapping,
// and safe DOM prompt injection.
// ============================================================

import { test, expect } from '@playwright/test';
import { PLATFORM_NEW_CHAT_URLS } from '../src/core/dispatcher';
import {
  PLATFORM_SELECTORS,
  findInputElement,
  findSubmitButton,
  injectPrompt,
} from '../src/core/injector';
import type { Platform } from '../src/core/types';

test.describe('Starlight Multi-Model Dispatcher', () => {
  test('PLATFORM_NEW_CHAT_URLS covers all primary platforms', () => {
    const platforms: Platform[] = ['chatgpt', 'claude', 'grok', 'gemini', 'deepseek', 'perplexity'];
    for (const p of platforms) {
      expect(PLATFORM_NEW_CHAT_URLS[p]).toBeDefined();
      expect(PLATFORM_NEW_CHAT_URLS[p]).toMatch(/^https:\/\//);
    }
    expect(PLATFORM_NEW_CHAT_URLS.claude).toBe('https://claude.ai/new');
    expect(PLATFORM_NEW_CHAT_URLS.chatgpt).toBe('https://chatgpt.com/');
    expect(PLATFORM_NEW_CHAT_URLS.grok).toBe('https://grok.com/');
    expect(PLATFORM_NEW_CHAT_URLS.gemini).toBe('https://gemini.google.com/app');
  });

  test('PLATFORM_SELECTORS defines input and submit selectors for all platforms', () => {
    const platforms: Platform[] = ['chatgpt', 'claude', 'grok', 'gemini', 'deepseek', 'perplexity'];
    for (const p of platforms) {
      const selectors = PLATFORM_SELECTORS[p];
      expect(selectors).toBeDefined();
      expect(selectors.input.length).toBeGreaterThan(0);
      expect(selectors.submit.length).toBeGreaterThan(0);
    }
  });
});
