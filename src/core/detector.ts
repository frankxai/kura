// ============================================================
// Kura — Platform Detector
// Auto-detects which AI platform the user is on.
// ============================================================

import type { Platform } from './types';

interface PlatformMatch {
  platform: Platform;
  patterns: string[];
  name: string;
  icon: string;
}

const PLATFORMS: PlatformMatch[] = [
  {
    platform: 'grok',
    patterns: ['grok.com'],
    name: 'Grok',
    icon: '𝕏',
  },
  {
    platform: 'chatgpt',
    patterns: ['chatgpt.com', 'chat.openai.com'],
    name: 'ChatGPT',
    icon: '◐',
  },
  {
    platform: 'claude',
    patterns: ['claude.ai'],
    name: 'Claude',
    icon: '◈',
  },
  {
    platform: 'gemini',
    patterns: ['gemini.google.com', 'aistudio.google.com'],
    name: 'Gemini',
    icon: '✦',
  },
  {
    platform: 'deepseek',
    patterns: ['chat.deepseek.com'],
    name: 'DeepSeek',
    icon: '◇',
  },
  {
    platform: 'perplexity',
    patterns: ['perplexity.ai'],
    name: 'Perplexity',
    icon: '⊕',
  },
];

/** Detect platform from a URL */
export function detectPlatform(url: string): PlatformMatch | null {
  for (const p of PLATFORMS) {
    if (p.patterns.some((pattern) => url.includes(pattern))) {
      return p;
    }
  }
  return null;
}

/** Get platform display info */
export function getPlatformInfo(platform: Platform): PlatformMatch | undefined {
  return PLATFORMS.find((p) => p.platform === platform);
}

/** All supported platforms */
export const ALL_PLATFORMS = PLATFORMS;
