import { test, expect } from '@playwright/test';
import {
  SCHEMA_VERSION, CAPTURED_BY, VAULT_ROOT, assistantLabel, buildSlug, serializeValue, quoteIfNeeded,
  renderFrontmatter, approxDuration, hasMedia, hasCode, conversationFrontmatter, promptsFrontmatter,
  platformIndexFrontmatter, mediaPromptFrontmatter, promptCollectionFrontmatter, sanitizeFilename, assetName
} from '../src/core/frontmatter';
import type { Conversation, MediaItem } from '../src/core/types';

test.describe('frontmatter utils', () => {
  test('constants and label', () => {
    expect(SCHEMA_VERSION).toBe('0.2.0'); expect(CAPTURED_BY).toBe('kura/0.2.0'); expect(VAULT_ROOT).toBe('Kura');
    expect(assistantLabel('chatgpt')).toBe('ChatGPT'); expect(assistantLabel('deepseek')).toBe('DeepSeek');
  });
  test('buildSlug', () => {
    expect(buildSlug('Café & Résumé!', '2026-10-23T12:00:00Z')).toBe('2026-10-23_cafe-resume');
  });
  test('quote and serialize', () => {
    expect(quoteIfNeeded('hello_123')).toBe('hello_123'); expect(quoteIfNeeded('true')).toBe('"true"');
    expect(serializeValue(123)).toBe('123'); expect(serializeValue(['a', 'b c'])).toBe('\n  - a\n  - "b c"');
  });
  test('renderFrontmatter', () => {
    expect(renderFrontmatter({ id: '1', title: 'A', tags: ['t1'], empty: null })).toBe('---\nid: "1"\ntitle: A\ntags:\n  - t1\nempty: \n---');
  });
  test('approxDuration', () => {
    const conv = { messages: [{ timestamp: '2026-10-23T10:00:00Z' }, { timestamp: '2026-10-23T12:15:00Z' }] } as any;
    expect(approxDuration(conv)).toBe('2h15m');
  });
  test('hasMedia and hasCode', () => {
    const conv = { messages: [{ attachments: [{ type: 'image' }] }] } as any;
    expect(hasMedia(conv)).toBe(true); expect(hasCode(conv)).toBe(false);
    conv.messages[0].attachments = [{ type: 'code' }];
    expect(hasMedia(conv)).toBe(false); expect(hasCode(conv)).toBe(true);
  });
  test('frontmatter generators', () => {
    const conv = { id: '1', platform: 'chatgpt', title: 't', url: 'u', capturedAt: 'c', messages: [] } as any;
    const cFm = conversationFrontmatter(conv, 's');
    expect(cFm.id).toBe('1'); expect(cFm.slug).toBe('s');
    const pFm = promptsFrontmatter(conv, 's', 5);
    expect(pFm.promptCount).toBe(5); expect(pFm.linksTo).toBe('[[conversation]]');
    const iFm = platformIndexFrontmatter('grok', 10, 'u');
    expect(iFm.kind).toBe('index'); expect(iFm.conversationCount).toBe(10);
    const media = { platform: 'grok', type: 'image', filename: 'f', width: 1, height: 1 } as any;
    expect(mediaPromptFrontmatter(media, 's').kind).toBe('media-prompt');
    expect(promptCollectionFrontmatter('all', 20).promptCount).toBe(20);
  });
  test('filename utils', () => {
    expect(sanitizeFilename('a/b<c>.png')).toBe('abc.png');
    expect(assetName('img', 1, 'png')).toBe('img-01.png');
  });
});
