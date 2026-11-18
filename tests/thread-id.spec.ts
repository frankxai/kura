import { test, expect } from '@playwright/test';
import { threadIdFromUrl } from '../src/core/thread-id';

test.describe('threadIdFromUrl', () => {
  test('reads the provider thread from each supported URL shape', () => {
    expect(threadIdFromUrl('gemini', 'https://gemini.google.com/app/0a1b2c3d4e5f')).toBe('0a1b2c3d4e5f');
    expect(threadIdFromUrl('gemini', 'https://gemini.google.com/u/1/app/0a1b2c3d4e5f?hl=en#x')).toBe('0a1b2c3d4e5f');
    expect(threadIdFromUrl('perplexity', 'https://www.perplexity.ai/search/naming-a-vault-AbC_123.x')).toBe('naming-a-vault-AbC_123.x');
    expect(threadIdFromUrl('deepseek', 'https://chat.deepseek.com/a/chat/s/1f0e9d8c-7b6a/')).toBe('1f0e9d8c-7b6a');
  });

  test('is the same for a reload and differs between threads', () => {
    const first = threadIdFromUrl('gemini', 'https://gemini.google.com/app/aaaa1111');
    expect(threadIdFromUrl('gemini', 'https://gemini.google.com/app/aaaa1111')).toBe(first);
    expect(threadIdFromUrl('gemini', 'https://gemini.google.com/app/bbbb2222')).not.toBe(first);
  });

  test('returns null when the URL names no thread', () => {
    expect(threadIdFromUrl('gemini', 'https://gemini.google.com/app')).toBeNull();
    expect(threadIdFromUrl('gemini', 'https://gemini.google.com/gem/abc/def')).toBeNull();
    expect(threadIdFromUrl('perplexity', 'https://www.perplexity.ai/library')).toBeNull();
    expect(threadIdFromUrl('deepseek', 'https://chat.deepseek.com/')).toBeNull();
    // A search that has not been given its own thread yet.
    expect(threadIdFromUrl('perplexity', 'https://www.perplexity.ai/search/new?q=vault')).toBeNull();
  });

  test('refuses other hosts, plain http, escaped IDs and malformed input', () => {
    expect(threadIdFromUrl('gemini', 'https://aistudio.google.com/app/apikey')).toBeNull();
    expect(threadIdFromUrl('gemini', 'https://gemini.google.com.evil.example/app/aaaa1111')).toBeNull();
    expect(threadIdFromUrl('perplexity', 'http://www.perplexity.ai/search/abc')).toBeNull();
    expect(threadIdFromUrl('perplexity', 'https://www.perplexity.ai/search/a%2Fb')).toBeNull();
    expect(threadIdFromUrl('deepseek', 'https://chat.deepseek.com/a/chat/s/' + 'x'.repeat(201))).toBeNull();
    expect(threadIdFromUrl('deepseek', 'not a url')).toBeNull();
  });

  test('leaves platforms that already derive their own ID alone', () => {
    expect(threadIdFromUrl('chatgpt', 'https://chatgpt.com/c/abc-123')).toBeNull();
    expect(threadIdFromUrl('claude', 'https://claude.ai/chat/abc-123')).toBeNull();
    expect(threadIdFromUrl('grok', 'https://grok.com/c/abc123')).toBeNull();
  });
});
