// ============================================================
// Starlight Cortex — DOM Prompt Injector & Relay Assistant
// Safely injects prompts into modern rich-text / ProseMirror / Lexical
// contenteditable editors across ChatGPT, Claude, Grok, Gemini, etc.
// ============================================================

import type { Platform } from './types';

export interface InjectionTargetSelectors {
  input: string[];
  submit: string[];
}

export const PLATFORM_SELECTORS: Record<Platform, InjectionTargetSelectors> = {
  claude: {
    input: [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
      'fieldset textarea',
    ],
    submit: [
      'button[aria-label*="Send" i]',
      'button[data-testid="send-button"]',
      'button:has(svg path[d*="M0 0h24v24H0z"])',
      'button:has(svg.lucide-arrow-up)',
      'button:has(svg.lucide-send)',
    ],
  },
  chatgpt: {
    input: [
      '#prompt-textarea',
      'div[contenteditable="true"]#prompt-textarea',
      'div[contenteditable="true"]',
      'textarea#prompt-textarea',
    ],
    submit: [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
      'button:has(svg path[d*="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837"])',
    ],
  },
  grok: {
    input: [
      'textarea[placeholder*="Ask" i]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    submit: [
      'button[type="submit"]',
      'button[aria-label*="Send" i]',
      'button:has(svg)',
    ],
  },
  gemini: {
    input: [
      'rich-textarea .ql-editor',
      'div[contenteditable="true"]',
      'textarea[aria-label*="prompt" i]',
      'textarea',
    ],
    submit: [
      'button[aria-label*="Send" i]',
      'button.send-button',
      'button:has(mat-icon)',
    ],
  },
  deepseek: {
    input: [
      'textarea[placeholder*="DeepSeek" i]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    submit: [
      'button[type="submit"]',
      'div[role="button"]:has(svg)',
    ],
  },
  perplexity: {
    input: [
      'textarea[placeholder*="Ask" i]',
      'textarea',
      'div[contenteditable="true"]',
    ],
    submit: [
      'button[aria-label*="Submit" i]',
      'button:has(svg.lucide-arrow-right)',
    ],
  },
};

/** Locate the input element for the given platform */
export function findInputElement(platform: Platform): HTMLElement | null {
  const selectors = PLATFORM_SELECTORS[platform]?.input || ['textarea', 'div[contenteditable="true"]'];
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

/** Locate the send/submit button for the given platform */
export function findSubmitButton(platform: Platform): HTMLButtonElement | null {
  const selectors = PLATFORM_SELECTORS[platform]?.submit || ['button[type="submit"]'];
  for (const selector of selectors) {
    const el = document.querySelector<HTMLButtonElement>(selector);
    if (el && !el.disabled) return el;
  }
  return null;
}

/** Safely inject text and trigger submission */
export function injectPrompt(
  platform: Platform,
  prompt: string,
  autoSubmit = true,
): { ok: boolean; error?: string } {
  const inputEl = findInputElement(platform);
  if (!inputEl) {
    return { ok: false, error: `Could not find input box on ${platform}. Is the page ready?` };
  }

  inputEl.focus();

  if (inputEl.tagName.toLowerCase() === 'textarea') {
    const ta = inputEl as HTMLTextAreaElement;
    ta.value = prompt;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // For ProseMirror / Lexical / Quill contenteditable:
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const execSuccess = document.execCommand('insertText', false, prompt);
    if (!execSuccess) {
      inputEl.textContent = prompt;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  if (autoSubmit) {
    setTimeout(() => {
      const btn = findSubmitButton(platform);
      if (btn && !btn.disabled) {
        btn.click();
      } else {
        // Fallback to Enter keydown
        inputEl.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
          }),
        );
      }
    }, 200);
  }

  return { ok: true };
}
