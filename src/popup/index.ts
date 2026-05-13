// ============================================================
// Arcanea Kura — Popup Controller
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

// -- Bridge reachability ------------------------------------------------------
//
// The "Send to Arcanea (opt-in)" button is only useful if the bridge endpoint
// is alive. Ping it on popup boot and cache the result for 10 minutes so we
// don't pay the round trip every time the popup opens. If unreachable, hide
// the button outright — users never click into an error.

const BRIDGE_HEALTH_URL = 'https://arcanea.ai/api/kura/health';
const BRIDGE_TTL_MS = 10 * 60 * 1000;

async function ensureBridgeStatus(): Promise<boolean> {
  try {
    const cached = await chrome.storage.local.get(['kura_bridge_ok', 'kura_bridge_at']);
    const at = Number(cached.kura_bridge_at ?? 0);
    if (Date.now() - at < BRIDGE_TTL_MS && typeof cached.kura_bridge_ok === 'boolean') {
      return cached.kura_bridge_ok;
    }
    const controller = new AbortController();
    const tm = setTimeout(() => controller.abort(), 2_000);
    const res = await fetch(BRIDGE_HEALTH_URL, { signal: controller.signal });
    clearTimeout(tm);
    const ok = res.ok;
    await chrome.storage.local.set({
      kura_bridge_ok: ok,
      kura_bridge_at: Date.now(),
    });
    return ok;
  } catch {
    await chrome.storage.local.set({
      kura_bridge_ok: false,
      kura_bridge_at: Date.now(),
    });
    return false;
  }
}

async function applyBridgeUI(): Promise<void> {
  const ok = await ensureBridgeStatus();
  if (!ok) {
    $sendArcanea.classList.add('hidden');
  }
}

// -- Boot --

async function init(): Promise<void> {
  void applyBridgeUI(); // fire-and-forget, won't block detection

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    showUnsupported();
    return;
  }

  const result = await sendMessage({ type: 'KURA_DETECT_TAB' });

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

  const result = await sendMessage({ type: 'KURA_DETECT_TAB' });

  $scanBtn.removeAttribute('disabled');

  if (result?.error) {
    showError(result.error as string);
    return;
  }

  if (result?.platform) {
    lastDetection = result;
    await sendMessage({ type: 'KURA_SAVE', detection: result });
    showDetection(result);
  }
});

$quickExportBtn.addEventListener('click', async () => {
  $quickExportBtn.setAttribute('disabled', 'true');
  $status.textContent = 'Capturing to vault…';
  $status.className = 'subtitle status-scanning';

  const format = $formatSelect.value as ExportFormat;

  const result = await sendMessage({
    type: 'KURA_CAPTURE',
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
  $status.textContent = `Saved ${captured?.conversations || 0} · ${captured?.media || 0} media · ${captured?.prompts || 0} prompts → ArcaneaKura/`;
  $status.className = 'subtitle status-success';
});

$exportConvos.addEventListener('click', async () => {
  if (!lastDetection) return;

  const format = $formatSelect.value as ExportFormat;
  await sendMessage({ type: 'KURA_SAVE', detection: lastDetection });

  for (const conv of lastDetection.conversations) {
    await sendMessage({
      type: 'KURA_EXPORT_ONE',
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

  $status.textContent = `Exported ${lastDetection.conversations.length} conversation(s)`;
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

  await sendMessage({ type: 'KURA_SAVE', detection: lastDetection });

  const format = $formatSelect.value as ExportFormat;
  await sendMessage({
    type: 'KURA_EXPORT_PROMPTS',
    platform: lastDetection.platform,
    format,
  });

  $status.textContent = `Exported ${lastDetection.prompts.length} prompt(s)`;
  $status.className = 'subtitle status-success';
});

$sendArcanea.addEventListener('click', async () => {
  if (!lastDetection) {
    const result = await sendMessage({ type: 'KURA_DETECT_TAB' });
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
    type: 'KURA_SEND_TO_ARCANEA',
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
