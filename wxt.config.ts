import { defineConfig } from 'wxt';

// https://wxt.dev/api/reference/wxt/interfaces/InlineConfig.html
export default defineConfig({
  // WXT's built-in `@` alias always resolves to `srcDir`, so srcDir is set
  // to `src` to keep every existing `@/core/...` import working unchanged.
  srcDir: 'src',
  outDir: 'dist',
  outDirTemplate: '',
  manifest: {
    name: 'Kura — Export your most precious writing from ChatGPT, Claude, Grok, Gemini',
    short_name: 'Kura',
    version: '0.3.0',
    description:
      'Export conversations, prompts and AI-generated media from ChatGPT, Claude, Grok, Gemini, DeepSeek and Perplexity into a local Obsidian-compatible vault. Local-first. No cloud. No tracking.',
    icons: {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_icon: {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
      },
    },
    commands: {
      'kura-capture': {
        suggested_key: {
          default: 'Alt+Shift+K',
        },
        description: 'Export the current AI conversation to Kura',
      },
    },
    permissions: ['activeTab', 'downloads', 'storage', 'scripting', 'sidePanel', 'offscreen'],
    host_permissions: [
      'https://grok.com/*',
      'https://assets.grok.com/*',
      'https://imagine-public.x.ai/*',
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://aistudio.google.com/*',
      'https://chat.deepseek.com/*',
      'https://www.perplexity.ai/*',
      'https://suno.com/*',
      'https://studio-api.prod.suno.com/*',
      'https://cdn1.suno.ai/*',
      'https://cdn2.suno.ai/*',
      'https://arcanea.ai/*',
    ],
  },
  hooks: {
    // WXT derives `action.default_title` from popup.html's <title> tag.
    // The original manifest never set default_title — drop it to keep
    // manifest output byte-for-byte equivalent to the pre-migration build.
    'build:manifestGenerated': (_wxt, manifest) => {
      if (manifest.action) delete (manifest.action as Record<string, unknown>).default_title;
    },
  },
});
