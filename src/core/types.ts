// ============================================================
// Arcanea Threads — Core Types
// Your AI work, captured into a local Obsidian-compatible vault.
// ============================================================

/** Supported AI platforms */
export type Platform =
  | 'grok'
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'perplexity';

/** Content types the vault can capture */
export type ContentType =
  | 'conversation'
  | 'image'
  | 'video'
  | 'prompt'
  | 'artifact'
  | 'code';

/** Export formats */
export type ExportFormat =
  | 'markdown'
  | 'json'
  | 'html'
  | 'pdf'
  | 'txt'
  | 'docx'
  | 'csv';

/** Subscription tier */
export type Tier = 'free' | 'pro' | 'creator';

/** A single message in a conversation */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  attachments?: Attachment[];
}

/** File attachment (image, code, document) */
export interface Attachment {
  type: ContentType;
  url: string;
  filename?: string;
  mimeType?: string;
  /** Base64 data for local storage */
  data?: string;
  /** Original prompt that generated this (for AI images) */
  prompt?: string;
  /** Resolution info */
  width?: number;
  height?: number;
}

/** A captured conversation */
export interface Conversation {
  id: string;
  platform: Platform;
  title: string;
  url: string;
  messages: Message[];
  capturedAt: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** A captured media item (image/video from Grok Imagine, DALL-E, etc.) */
export interface MediaItem {
  id: string;
  platform: Platform;
  type: 'image' | 'video';
  url: string;
  hdUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  sourceImageUrl?: string;
  filename: string;
  capturedAt: string;
  width?: number;
  height?: number;
  duration?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** A captured prompt */
export interface PromptItem {
  id: string;
  platform: Platform;
  text: string;
  conversationId?: string;
  response?: string;
  capturedAt: string;
  tags?: string[];
}

/** Detection result from a content script */
export interface DetectionResult {
  platform: Platform;
  pageType: 'conversation' | 'imagine' | 'gallery' | 'unknown';
  conversations: Conversation[];
  media: MediaItem[];
  prompts: PromptItem[];
  stats: {
    totalConversations: number;
    totalImages: number;
    totalVideos: number;
    totalPrompts: number;
  };
}

/** Download progress event */
export interface DownloadProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  status: 'idle' | 'scanning' | 'downloading' | 'complete' | 'error' | 'cancelled';
  error?: string;
}

/** Export options */
export interface ExportOptions {
  format: ExportFormat;
  includeMedia: boolean;
  includeTimestamps: boolean;
  includeMetadata: boolean;
  /** Bundle media as base64 in the export */
  embedMedia: boolean;
  /** Custom filename pattern */
  filenamePattern?: string;
}

/** Vault storage stats */
export interface VaultStats {
  totalConversations: number;
  totalMedia: number;
  totalPrompts: number;
  storageUsedBytes: number;
  platformBreakdown: Record<Platform, number>;
  lastCaptureAt?: string;
}

/** Tier limits */
export const TIER_LIMITS: Record<Tier, {
  exportsPerDay: number;
  formats: ExportFormat[];
  platforms: Platform[];
  bulkDownload: boolean;
  syncIntegrations: boolean;
}> = {
  free: {
    exportsPerDay: 10,
    formats: ['markdown', 'json'],
    platforms: ['grok', 'chatgpt', 'claude', 'gemini', 'deepseek', 'perplexity'],
    bulkDownload: false,
    syncIntegrations: false,
  },
  pro: {
    exportsPerDay: Infinity,
    formats: ['markdown', 'json', 'html', 'pdf', 'txt', 'docx', 'csv'],
    platforms: ['grok', 'chatgpt', 'claude', 'gemini', 'deepseek', 'perplexity'],
    bulkDownload: true,
    syncIntegrations: false,
  },
  creator: {
    exportsPerDay: Infinity,
    formats: ['markdown', 'json', 'html', 'pdf', 'txt', 'docx', 'csv'],
    platforms: ['grok', 'chatgpt', 'claude', 'gemini', 'deepseek', 'perplexity'],
    bulkDownload: true,
    syncIntegrations: true,
  },
};
