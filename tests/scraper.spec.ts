import { test, expect } from '@playwright/test';
import { PlatformScraper } from '../src/core/scraper';
import type { DetectionResult, Conversation, MediaItem, PromptItem, Platform } from '../src/core/types';

class MockScraper extends PlatformScraper {
  readonly platform: Platform = 'chatgpt';
  readonly hostPatterns = ['mock.com'];

  async detect(): Promise<DetectionResult> {
    return {} as DetectionResult;
  }
  async extractConversations(): Promise<Conversation[]> {
    return [];
  }
  async extractMedia(): Promise<MediaItem[]> {
    return [];
  }
  async extractPrompts(): Promise<PromptItem[]> {
    return [];
  }

  // Expose protected methods for testing
  public testGenerateId() {
    return this.generateId();
  }
  public testSanitizeFilename(name: string) {
    return this.sanitizeFilename(name);
  }
  public testExtractText(element: any) {
    return this.extractText(element);
  }
}

test.describe('PlatformScraper base class utilities', () => {
  let scraper: MockScraper;

  test.beforeEach(() => {
    scraper = new MockScraper();
  });

  test('matches checks hostPatterns against URL', () => {
    expect(scraper.matches('https://mock.com/page')).toBe(true);
    expect(scraper.matches('https://other.com/page')).toBe(false);
  });

  test('progress state management', () => {
    expect(scraper.getProgress()).toEqual({
      total: 0,
      completed: 0,
      failed: 0,
      status: 'idle',
    });

    // resetProgress works
    scraper.resetProgress();
    expect(scraper.getProgress()).toEqual({
      total: 0,
      completed: 0,
      failed: 0,
      status: 'idle',
    });
  });

  test('generateId returns unique string prefixed with platform', () => {
    const id1 = scraper.testGenerateId();
    const id2 = scraper.testGenerateId();
    expect(id1).toMatch(/^chatgpt-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  test('sanitizeFilename strips invalid chars', () => {
    expect(scraper.testSanitizeFilename('a/b<c>d:e"f\\g|h?i*j\x00k')).toBe('abcdefghijk');
    expect(scraper.testSanitizeFilename('hello  world')).toBe('hello_world'); // Replaces space with underscore? Yes \s+ to _
  });

  test('extractText extracts and trims content', () => {
    // Mock the DOM element since playwright tests run in node context by default unless page object is used
    const mockElement = { textContent: '  Hello World  ' };
    expect(scraper.testExtractText(mockElement)).toBe('Hello World');

    // Handles missing textContent gracefully
    expect(scraper.testExtractText({})).toBe('');
  });
});
