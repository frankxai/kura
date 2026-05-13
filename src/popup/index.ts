// ============================================================
// Arcanea Threads — Popup Controller
// ============================================================

import type { DetectionResult, ExportFormat } from '@/core/types';

const $status = document.getElementById('status')!;
const $platform = document.getElementById('platform-name')!;
const $platformIcon = document.getElementById('platform-icon')!;
const $scanBtn = document.getElementById('btn-scan')!;
const $quickExportBtn = document.getElementById('btn-quick-export')!;
const $formatSelect = document.getElementById('format-select') as HTMLSelectElement;

const $results = document.getElementById('results')!;
const $statsConvos = document.getElementById('stat-conversations')!;
const $statsImages = document.getElementById('stat-images')!;
const $statsVideos = document.getElementById('stat-videos')!;
const $statsPrompts = document.getElementById('stat-prompts')!;

const $exportConvos = document.getElementById('btn-export-conversations')!;
const $downloadMedia = document.getElementById('btn-download-media')!;
const $exportPrompts = document.getElementById('btn-export-prompts')!;
const $sendArcanea = document.getElementById('btn-send-prompt-books')!;

const $error = document.getElementById('error')!;
const $unsupported = document.getElementById('unsupported')!;

let lastDetection: DetectionResult | null = null;

const PLATFORM_LABELS: Record<string, string> = {
  grok: 'Grok',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
};

const PLATFORM_ICONS: Record<string, string> = {
  grok: '\u{1D54F}', // 𝕏
  chatgpt: '◐', // ◐
  claude: '◈',  // ◈
  gemini: '✦',  // ✦
  deepseek: '◇', // ◇
  perplexity: '⊕', // ⊕
};

// -- Boot --

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    showUnsupported();
    return;
  }

  const result = await sendMessage({ type: 'THREADS_DETECT_TAB' });

  if (result?.error) {
    if (result.error === 'Not on a supported AI platform') {
      showUnsupported();
    } else {
      showError(result.error as string);
    }
    return;
  }

  if (result?.platform) {
    lastDetection = result;
    showDetection(result);
  }
}

function showDetection(detection: DetectionResult): void {
  $unsupported.classList.add('hidden');
  $error.classList.add('hidden');
  $results.classList.remove('hidden');

  $platform.textContent = PLATFORM_LABELS[detection.platform] || detection.platform;
  $platformIcon.textContent = PLATFORM_ICONS[detection.platform] || '?';
  $status.textContent = 'Ready to capture';
  $status.className = 'subtitle status-success';

  $statsConvos.textContent = String(detection.stats.totalConversations);
  $statsImages.textContent = String(detection.stats.totalImages);
  $statsVideos.textContent = String(detection.stats.totalVideos);
  $statsPrompts.textContent = String(detection.stats.totalPrompts);

  toggleBtn($exportConvos, detection.stats.totalConversations > 0);
  toggleBtn($downloadMedia, detection.stats.totalImages + detection.stats.totalVideos > 0);
  toggleBtn($exportPrompts, detection.stats.totalPrompts > 0);
}

function showUnsupported(): void {
  $unsupported.classList.remove('hidden');
  $results.classList.add('hidden');
  $error.classList.add('hidden');
  $status.textContent = 'Open an AI conversation';
  $status.className = 'subtitle status-muted';
}

function showError(message: string): void {
  $error.classList.remove('hidden');
  $error.textContent = message;
  $results.classList.add('hidden');
  $unsupported.classList.add('hidden');
}

// -- Actions --

$scanBtn.addEventListener('click', async () => {
  $scanBtn.setAttribute('disabled', 'true');
  $status.textContent = 'Scanning…';
  $status.className = 'subtitle status-scanning';

  const result = await sendMessage({ type: 'THREADS_DETECT_TAB' });

  $scanBtn.removeAttribute('disabled');

  if (result?.error) {
    showError(result.error as string);
    return;
  }

  if (result?.platform) {
    lastDetection = result;
    await sendMessage({ type: 'THREADS_SAVE', detection: result });
    showDetection(result);
  }
});

$quickExportBtn.addEventListener('click', async () => {
  $quickExportBtn.setAttribute('disabled', 'true');
  $status.textContent = 'Capturing to vault…';
  $status.className = 'subtitle status-scanning';

  const format = $formatSelect.value as ExportFormat;

  const result = await sendMessage({
    type: 'THREADS_CAPTURE',
    options: {
      format,
      includeMedia: true,
      includeTimestamps: true,
      includeMetadata: true,
      embedMedia: false,
    },
  });

  $quickExportBtn.removeAttribute('disabled');

  if (result?.error) {
    showError(result.error as string);
    return;
  }

  const captured = result?.captured as Record<string, number>;
  $status.textContent = `Captured ${captured?.conversations || 0} thread · ${captured?.media || 0} media · ${captured?.prompts || 0} prompts → ArcaneaThreads/`;
  $status.className = 'subtitle status-success';
});

$exportConvos.addEventListener('click', async () => {
  if (!lastDetection) return;

  const format = $formatSelect.value as ExportFormat;
  await sendMessage({ type: 'THREADS_SAVE', detection: lastDetection });

  for (const conv of lastDetection.conversations) {
    await sendMessage({
      type: 'THREADS_EXPORT_ONE',
      conversationId: conv.id,
      options: {
        format,
        includeMedia: true,
        includeTimestamps: true,
        includeMetadata: true,
        embedMedia: false,
      },
    });
  }

  $status.textContent = `Exported ${lastDetection.conversations.length} thread(s)`;
  $status.className = 'subtitle status-success';
});

$downloadMedia.addEventListener('click', async () => {
  if (!lastDetection) return;

  const items = lastDetection.media.map((m) => ({
    url: m.hdUrl || m.url,
    filename: m.filename,
    platform: m.platform,
  }));

  await sendMessage({
    type: 'VAULT_DOWNLOAD_MEDIA',
    items,
    platform: lastDetection.platform,
  });

  $status.textContent = `Queued ${items.length} media file(s)`;
  $status.className = 'subtitle status-scanning';
});

$exportPrompts.addEventListener('click', async () => {
  if (!lastDetection) return;

  await sendMessage({ type: 'THREADS_SAVE', detection: lastDetection });

  const format = $formatSelect.value as ExportFormat;
  await sendMessage({
    type: 'THREADS_EXPORT_PROMPTS',
    platform: lastDetection.platform,
    format,
  });

  $status.textContent = `Exported ${lastDetection.prompts.length} prompt(s)`;
  $status.className = 'subtitle status-success';
});

$sendArcanea.addEventListener('click', async () => {
  if (!lastDetection) {
    const result = await sendMessage({ type: 'THREADS_DETECT_TAB' });
    if (result?.error) {
      showError(result.error as string);
      return;
    }
    if (result?.platform) lastDetection = result;
  }
  if (!lastDetection) return;

  $sendArcanea.setAttribute('disabled', 'true');
  $status.textContent = 'Sending to Arcanea…';
  $status.className = 'subtitle status-scanning';

  const result = await sendMessage({
    type: 'THREADS_SEND_TO_ARCANEA',
    detection: lastDetection,
  });

  $sendArcanea.removeAttribute('disabled');

  if (result?.error) {
    showError(result.error as string);
    return;
  }

  $status.textContent = (result?.message as string) || 'Sent to Arcanea.';
  $status.className = 'subtitle status-success';
});

// -- Utilities --

function sendMessage(msg: Record<string, unknown>): Promise<any> {
  return chrome.runtime.sendMessage(msg);
}

function toggleBtn(el: HTMLElement, enabled: boolean): void {
  if (enabled) {
    el.removeAttribute('disabled');
    el.classList.remove('opacity-40');
  } else {
    el.setAttribute('disabled', 'true');
    el.classList.add('opacity-40');
  }
}

init();
