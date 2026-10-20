import { test, expect } from '@playwright/test';
import {
  buildSlug,
  renderFrontmatter,
  sanitizeFilename,
  assetName,
  conversationFrontmatter,
} from '../src/core/frontmatter';
import type { Conversation } from '../src/core/types';

const DATE_ISO = '2026-10-12T10:00:00Z';

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    platform: 'chatgpt',
    title: 'Test Conversation',
    url: 'https://chatgpt.com/c/test',
    capturedAt: DATE_ISO,
    messages: [],
    ...overrides,
  };
}

test.describe('buildSlug', () => {
  test('formats accents, colons, and special characters correctly', () => {
    expect(buildSlug('Café résumé', DATE_ISO)).toBe('2026-10-12_cafe-resume');
    expect(buildSlug('How to: build X', DATE_ISO)).toBe('2026-10-12_how-to-build-x');
  });

  test('falls back to untitled for punctuation-only or CJK titles', () => {
    expect(buildSlug('!!!', DATE_ISO)).toBe('2026-10-12_untitled');
    expect(buildSlug('こんにちは世界', DATE_ISO)).toBe('2026-10-12_untitled');
  });

  test('caps kebab part at 60 characters with no trailing dash', () => {
    const longTitle = 'a-'.repeat(50);
    const slug = buildSlug(longTitle, DATE_ISO);
    const kebab = slug.replace('2026-10-12_', '');
    expect(kebab.length).toBeLessThanOrEqual(60);
    expect(kebab.endsWith('-')).toBe(false);
  });
});

test.describe('renderFrontmatter', () => {
  test('quotes YAML special strings and renders values according to spec', () => {
    const rendered = renderFrontmatter({
      strYes: 'yes',
      strTilde: '~',
      strComment: 'x # y',
      capturedBy: 'kura/0.2.0',
      emptyArr: [],
      items: ['item1'],
      skipMe: undefined,
      isBool: true,
      count: 42,
    });

    expect(rendered).toContain('strYes: "yes"');
    expect(rendered).toContain('strTilde: "~"');
    expect(rendered).toContain('strComment: "x # y"');
    expect(rendered).toContain('capturedBy: kura/0.2.0');
    expect(rendered).toContain('emptyArr: []');
    expect(rendered).toContain('items:\n  - item1');
    expect(rendered).not.toContain('skipMe');
    expect(rendered).toContain('isBool: true');
    expect(rendered).toContain('count: 42');
  });
});

test.describe('sanitizeFilename', () => {
  test('strips forbidden OS characters and control characters, turns whitespace into _, caps at 100 chars', () => {
    expect(sanitizeFilename('a<b:c>d"e/f\\g|h?i*\x01 j  k')).toBe('abcdefghi_j_k');
    expect(sanitizeFilename('a'.repeat(120)).length).toBe(100);
  });
});

test.describe('assetName', () => {
  test('pads asset index and strips leading extension dot', () => {
    expect(assetName('img', 3, '.png')).toBe('img-03.png');
  });
});

test.describe('conversationFrontmatter', () => {
  test('calculates durationApprox correctly', () => {
    const convNoTime = makeConv({ messages: [{ role: 'user', content: 'hi' }] });
    expect(conversationFrontmatter(convNoTime, 'slug').durationApprox).toBeUndefined();

    const conv20s = makeConv({
      messages: [
        { role: 'user', content: 'hi', timestamp: '2026-10-12T10:00:00Z' },
        { role: 'assistant', content: 'hello', timestamp: '2026-10-12T10:00:20Z' },
      ],
    });
    expect(conversationFrontmatter(conv20s, 'slug').durationApprox).toBe('<1m');

    const conv47m = makeConv({
      messages: [
        { role: 'user', content: 'hi', timestamp: '2026-10-12T10:00:00Z' },
        { role: 'assistant', content: 'hello', timestamp: '2026-10-12T10:47:00Z' },
      ],
    });
    expect(conversationFrontmatter(conv47m, 'slug').durationApprox).toBe('47m');

    const conv1h5m = makeConv({
      messages: [
        { role: 'user', content: 'hi', timestamp: '2026-10-12T10:00:00Z' },
        { role: 'assistant', content: 'hello', timestamp: '2026-10-12T11:05:00Z' },
      ],
    });
    expect(conversationFrontmatter(conv1h5m, 'slug').durationApprox).toBe('1h5m');

    const conv2h = makeConv({
      messages: [
        { role: 'user', content: 'hi', timestamp: '2026-10-12T10:00:00Z' },
        { role: 'assistant', content: 'hello', timestamp: '2026-10-12T12:00:00Z' },
      ],
    });
    expect(conversationFrontmatter(conv2h, 'slug').durationApprox).toBe('2h');
  });

  test('flags hasMedia and hasCode based on attachment types', () => {
    const convMedia = makeConv({
      messages: [{ role: 'user', content: 'look', attachments: [{ type: 'image', url: 'https://example.com/a.png' }] }],
    });
    const fmMedia = conversationFrontmatter(convMedia, 'slug');
    expect(fmMedia.hasMedia).toBe(true);
    expect(fmMedia.hasCode).toBe(false);

    const convCode = makeConv({
      messages: [{ role: 'user', content: 'code', attachments: [{ type: 'code', url: 'https://example.com/a.ts' }] }],
    });
    const fmCode = conversationFrontmatter(convCode, 'slug');
    expect(fmCode.hasMedia).toBe(false);
    expect(fmCode.hasCode).toBe(true);
  });
});
