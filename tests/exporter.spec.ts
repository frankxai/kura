import { test, expect } from '@playwright/test';
import { exportConversation, exportConversationBundle } from '../src/core/exporter';
import type { Conversation, ExportOptions } from '../src/core/types';

function createConversation(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    platform: 'chatgpt',
    title: 'Test Title',
    url: 'https://chatgpt.com/c/test-1',
    capturedAt: '2026-05-13T22:14:00.000Z',
    messages: [
      {
        role: 'user',
        content: 'Hello world',
        timestamp: '2026-05-13 22:14',
      },
      {
        role: 'assistant',
        content: 'Hi there',
        timestamp: '2026-05-13 22:15',
      },
    ],
    ...over,
  };
}

const htmlOptions: ExportOptions = {
  format: 'html',
  includeMedia: false,
  includeTimestamps: true,
  includeMetadata: true,
  embedMedia: false,
};

test.describe('exportConversation', () => {
  test('escapes hostile timestamp and title in html export', () => {
    const conv = createConversation({
      title: '<b>x</b>',
      messages: [
        {
          role: 'user',
          content: 'Hello',
          timestamp: '<img src=x onerror=alert(1)>',
        },
      ],
    });

    const result = exportConversation(conv, htmlOptions);
    expect(result.content).toContain('&lt;img');
    expect(result.content).not.toContain('<img src=x');
    expect(result.content).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

test.describe('exportConversationBundle', () => {
  test('returns conversation.md, prompts.md, and capture.json under platform/slug/', () => {
    const conv = createConversation();
    const bundle = exportConversationBundle(conv);

    const paths = bundle.files.map((f) => f.path);
    const expectedPrefix = `${conv.platform}/${bundle.slug}/`;

    expect(paths).toContain(`${expectedPrefix}conversation.md`);
    expect(paths).toContain(`${expectedPrefix}prompts.md`);
    expect(paths).toContain(`${expectedPrefix}capture.json`);
  });

  test('throws Invalid capture folder for invalid existingSlug bad/slug', () => {
    const conv = createConversation();
    expect(() => exportConversationBundle(conv, undefined, 'bad/slug')).toThrow('Invalid capture folder');
  });
});
