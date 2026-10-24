import { test, expect } from '@playwright/test';
import { detectPlatform, getPlatformInfo, ALL_PLATFORMS } from '../src/core/detector';
import type { Platform } from '../src/core/types';

test.describe('detector', () => {
  test('detectPlatform identifies platforms correctly', () => {
    expect(detectPlatform('https://chatgpt.com/c/123')).toMatchObject({ platform: 'chatgpt' });
    expect(detectPlatform('https://chat.openai.com/')).toMatchObject({ platform: 'chatgpt' });
    expect(detectPlatform('https://grok.com/123')).toMatchObject({ platform: 'grok' });
    expect(detectPlatform('https://claude.ai/chat/123')).toMatchObject({ platform: 'claude' });
    expect(detectPlatform('https://gemini.google.com/app')).toMatchObject({ platform: 'gemini' });
    expect(detectPlatform('https://aistudio.google.com/app/prompts')).toMatchObject({ platform: 'gemini' });
    expect(detectPlatform('https://chat.deepseek.com/')).toMatchObject({ platform: 'deepseek' });
    expect(detectPlatform('https://www.perplexity.ai/')).toMatchObject({ platform: 'perplexity' });
  });

  test('detectPlatform returns null for unknown URLs', () => {
    expect(detectPlatform('https://google.com')).toBeNull();
    expect(detectPlatform('https://github.com/frankxai/kura')).toBeNull();
    expect(detectPlatform('')).toBeNull();
  });

  test('getPlatformInfo returns correct information', () => {
    expect(getPlatformInfo('chatgpt')).toMatchObject({ name: 'ChatGPT', icon: '◐' });
    expect(getPlatformInfo('grok')).toMatchObject({ name: 'Grok', icon: '𝕏' });
  });

  test('getPlatformInfo returns undefined for invalid platform', () => {
    expect(getPlatformInfo('unknown' as unknown as Platform)).toBeUndefined();
  });

  test('ALL_PLATFORMS is an array of platforms', () => {
    expect(Array.isArray(ALL_PLATFORMS)).toBe(true);
    expect(ALL_PLATFORMS.length).toBeGreaterThan(0);
    expect(ALL_PLATFORMS.some((p) => p.platform === 'chatgpt')).toBe(true);
  });
});
