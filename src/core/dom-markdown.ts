// ============================================================
// Kura — DOM to Markdown
// Serializes one rendered message to Markdown, so code fences,
// links, lists, tables and math survive capture. `textContent`
// flattened all of them into one run of text.
//
// The function is self-contained on purpose: it references
// nothing outside its own body, so tests can run it inside a real
// page with `page.$eval(selector, elementToMarkdown)`.
// ============================================================

/**
 * Render `root` as Markdown.
 *
 * - Text the page shows with preserved line breaks (a typed prompt, for
 *   example) is copied verbatim: it is already source text.
 * - Other text is whitespace-collapsed and escaped only where a literal
 *   character would otherwise change structure or emphasis.
 * - Page chrome (buttons, icons, media players) and anything matching
 *   `skipSelector` is left out. Elements the page hides are left out too.
 *
 * Known limits: emphasis that ends in punctuation directly before a letter
 * (`**a:**b`) does not close in CommonMark; a literal `[[x]]` stays a wikilink
 * in Obsidian; text whose line breaks are preserved inside an otherwise
 * collapsed paragraph is not kept verbatim.
 */
export function elementToMarkdown(root: Element, skipSelector?: string): string {
  const SKIPPED = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'BUTTON', 'SELECT', 'TEXTAREA',
    'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG', 'PICTURE', 'SVG',
  ]);
  const BLOCKS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DETAILS', 'DL', 'DT',
    'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
    'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'UL',
  ]);
  const INLINES = new Set([
    'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DEL', 'DFN', 'EM', 'I', 'INPUT',
    'KBD', 'LABEL', 'MARK', 'MATH', 'Q', 'S', 'SAMP', 'SMALL', 'STRIKE', 'STRONG', 'SUB',
    'SUP', 'TIME', 'U', 'VAR', 'WBR',
  ]);

  const ROLE_LINES = new Set(
    ['You', 'System', 'ChatGPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Perplexity'].map((role) => `## ${role}`),
  );

  const tag = (el: Element) => el.nodeName.toUpperCase();
  const style = (el: Element) => (typeof window === 'undefined' ? null : window.getComputedStyle(el));
  const hasClass = (el: Element, name: string) => el.classList?.contains(name) ?? false;

  const omitted = (el: Element): boolean => {
    if (SKIPPED.has(tag(el))) return true;
    if (tag(el) === 'INPUT' && el.getAttribute('type') !== 'checkbox') return true;
    if (skipSelector && el.matches(skipSelector)) return true;
    return style(el)?.display === 'none';
  };

  /** A `code` element laid out as its own multi-line block, with no `pre` around it. */
  const isCodeBlock = (el: Element): boolean => {
    if (tag(el) !== 'CODE' || !(el.textContent ?? '').includes('\n')) return false;
    const css = style(el);
    return !!css && (!css.display.startsWith('inline') || /^(pre|break-spaces|preserve)/.test(css.whiteSpace));
  };

  const isBlock = (el: Element): boolean => {
    const name = tag(el);
    if (hasClass(el, 'katex-display')) return true;
    if (hasClass(el, 'katex') || name === 'MATH') return false;
    if (BLOCKS.has(name) || isCodeBlock(el)) return true;
    if (!INLINES.has(name)) {
      // `div`, `span`, custom elements and unknown tags: trust how the page lays them out.
      const css = style(el);
      const display = css?.display || (name === 'DIV' ? 'block' : 'inline');
      // Positioned and floated elements compute to `block` without breaking the line they sit in.
      const outOfFlow = !!css && (css.position === 'absolute' || css.position === 'fixed' || css.float !== 'none');
      if (!outOfFlow && display !== 'contents' && !display.startsWith('inline')) return true;
    }
    // An inline wrapper around block content is a container, not a phrase.
    return Array.from(el.children).some((child) => !omitted(child) && isBlock(child));
  };

  const keepsLineBreaks = (el: Element, inherited: boolean): boolean => {
    const value = style(el)?.whiteSpace;
    if (!value) return inherited;
    return /^(pre|pre-wrap|pre-line|break-spaces|preserve)\b/.test(value);
  };

  const escapeInline = (text: string): string =>
    text
      .replace(/\\/g, '\\\\')
      .replace(/[*`$]/g, '\\$&')
      .replace(/~~/g, '\\~~')
      .replace(/(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g, '\\_')
      .replace(/<(?=[A-Za-z/!?])/g, '\\<')
      .replace(/&(?=#?\w+;)/g, '\\&');

  /**
   * Stop a literal line from being read as a heading, quote, list item, rule,
   * fence opener, setext underline or link definition.
   */
  const escapeLineStart = (line: string): string =>
    line
      .replace(/^(\s*)(#{1,6})(?=\s|$)/, '$1\\$2')
      .replace(/^(\s*)>/, '$1\\>')
      .replace(/^(\s*)([-+])(?=\s|$)/, '$1\\$2')
      .replace(/^(\s*)(\d+)([.)])(?=\s|$)/, '$1$2\\$3')
      .replace(/^(\s*)(=+|-{2,})(\s*)$/, '$1\\$2$3')
      .replace(/^(\s*)(~{3,})/, '$1\\$2')
      .replace(/^(\s*)\[(?=[^\]]+\]:)/, '$1\\[');

  const fence = (code: string, language: string): string => {
    const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
    const marks = '`'.repeat(Math.max(3, longest + 1));
    return `${marks}${language}\n${code}\n${marks}`;
  };

  const tex = (el: Element): string | null => {
    const source = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    return source || null;
  };

  /** Text of a code block without the copy button or language label around it. */
  const rawText = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? '';
    if (node.nodeType !== 1 || omitted(node as Element)) return '';
    if (tag(node as Element) === 'BR') return '\n';
    return Array.from(node.childNodes, rawText).join('');
  };

  /** Fence `el`, a `pre` or a block-level `code`. */
  const codeBlock = (el: Element): string => {
    // One `code` child is the code; several (one per line, say) are all of it.
    const codes = el.querySelectorAll('code');
    const source = codes.length === 1 ? codes[0] : el;
    const hint = [codes[0], el]
      .map((item) => item?.getAttribute('data-language')
        ?? (item?.getAttribute('class') ?? '').match(/(?:^|\s)lang(?:uage)?-([^\s]+)/)?.[1])
      .find(Boolean) ?? '';
    const language = /^[A-Za-z0-9+#._-]{1,32}$/.test(hint) ? hint : '';
    return fence(rawText(source).replace(/\r\n/g, '\n').replace(/\n$/, ''), language);
  };

  const wrap = (mark: string, inner: string): string => {
    const core = inner.trim();
    if (!core) return inner;
    const lead = inner.slice(0, inner.length - inner.trimStart().length);
    const tail = inner.slice(inner.trimEnd().length);
    return `${lead}${mark}${core}${mark}${tail}`;
  };

  const link = (el: Element, pre: boolean): string => {
    const text = inlineChildren(el, pre);
    const label = text.trim().replace(/\n+/g, ' ').replace(/[[\]]/g, '\\$&');
    const href = (el as HTMLAnchorElement).href || '';
    if (!label || !/^(https?:|mailto:)/i.test(href)) return text;
    const target = href.replace(/[\s()<>]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
    return `[${label}](${target})`;
  };

  function inline(node: Node, pre: boolean): string {
    if (node.nodeType === 3) {
      const text = node.textContent ?? '';
      return pre ? text.replace(/\r\n/g, '\n') : escapeInline(text.replace(/[ \t\n\r\f]+/g, ' '));
    }
    if (node.nodeType !== 1) return '';
    const el = node as Element;
    if (omitted(el)) return '';
    const kept = keepsLineBreaks(el, pre);
    switch (tag(el)) {
      case 'BR': return '\n';
      case 'WBR': return '';
      case 'INPUT': return (el as HTMLInputElement).checked ? '[x] ' : '[ ] ';
      case 'CODE': {
        const code = (el.textContent ?? '').replace(/\n/g, ' ');
        if (!code.trim()) return code;
        const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
        const marks = '`'.repeat(longest + 1);
        const pad = code.startsWith('`') || code.endsWith('`') ? ' ' : '';
        return `${marks}${pad}${code}${pad}${marks}`;
      }
      case 'STRONG': case 'B': return wrap('**', inlineChildren(el, kept));
      case 'EM': case 'I': return wrap('*', inlineChildren(el, kept));
      case 'DEL': case 'S': case 'STRIKE': return wrap('~~', inlineChildren(el, kept));
      case 'A': return link(el, kept);
      default: {
        if (hasClass(el, 'katex')) {
          const source = tex(el);
          if (source) return `$${source}$`;
        }
        return inlineChildren(el, kept);
      }
    }
  }

  function inlineChildren(el: Element, pre: boolean): string {
    return Array.from(el.childNodes, (child) => inline(child, pre)).join('');
  }

  const paragraph = (text: string, pre: boolean): string => {
    if (pre) return text.replace(/^\n+|\s+$/g, '');
    return text
      .split('\n')
      .map((line) => escapeLineStart(line.replace(/ {2,}/g, ' ').trim()))
      .join('\n')
      .trim();
  };

  const indent = (text: string, width: number): string =>
    text.split('\n').map((line, index) => (index === 0 || !line ? line : ' '.repeat(width) + line)).join('\n');

  /** `pre` is always the element's own resolved white-space, not its parent's. */
  const list = (el: Element, pre: boolean): string => {
    const ordered = tag(el) === 'OL';
    let number = Number(el.getAttribute('start')) || 1;
    const items: string[] = [];
    for (const child of Array.from(el.children)) {
      if (tag(child) !== 'LI' || omitted(child)) continue;
      const marker = ordered ? `${number++}. ` : '- ';
      const parts = blocks(child, keepsLineBreaks(child, pre));
      // A nested list sits tight under its item; other blocks get a blank line.
      const body = parts.reduce((text, part, index) =>
        index === 0 ? part : `${text}${/^(?:- |\d+\. )/.test(part) ? '\n' : '\n\n'}${part}`, '');
      items.push(marker + indent(body, marker.length));
    }
    return items.join('\n');
  };

  const table = (el: Element, pre: boolean): string => {
    const rows = Array.from(el.querySelectorAll('tr')).filter((row) => row.closest('table') === el && !omitted(row));
    const cells = rows.map((row) =>
      Array.from(row.children)
        .filter((cell) => ['TH', 'TD'].includes(tag(cell)) && !omitted(cell))
        .map((cell) => blocks(cell, keepsLineBreaks(cell, pre)).join(' ').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()));
    const width = Math.max(0, ...cells.map((row) => row.length));
    if (!width) return '';
    const line = (row: string[]) => `| ${Array.from({ length: width }, (_, index) => row[index] ?? '').join(' | ')} |`;
    return [line(cells[0]), line(Array(width).fill('---')), ...cells.slice(1).map(line)].join('\n');
  };

  function block(el: Element, inherited: boolean): string[] {
    const name = tag(el);
    const pre = keepsLineBreaks(el, inherited);
    if (hasClass(el, 'katex-display')) {
      const source = tex(el);
      if (source) return [`$$\n${source}\n$$`];
    }
    if (/^H[1-6]$/.test(name)) {
      const text = inlineChildren(el, false).replace(/\s*\n\s*/g, ' ').trim();
      if (!text) return [];
      const marks = '#'.repeat(Number(name[1]));
      // `## You` is how conversation.md opens a message. The closed form renders
      // the same heading and cannot be read as a role line.
      return [ROLE_LINES.has(`${marks} ${text}`) ? `${marks} ${text} ${marks}` : `${marks} ${text}`];
    }
    if (isCodeBlock(el)) return [codeBlock(el)];
    switch (name) {
      case 'PRE': return [codeBlock(el)];
      case 'HR': return ['***'];
      case 'UL': case 'OL': return [list(el, pre)].filter(Boolean);
      case 'TABLE': return [table(el, pre)].filter(Boolean);
      case 'BLOCKQUOTE':
        return [blocks(el, pre).join('\n\n').split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n')].filter(Boolean);
      default: return blocks(el, pre);
    }
  }

  function blocks(el: Element, pre: boolean): string[] {
    const out: string[] = [];
    let run = '';
    const flush = () => {
      const text = paragraph(run, pre);
      if (text) out.push(text);
      run = '';
    };
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1 && !omitted(child as Element) && isBlock(child as Element)) {
        flush();
        out.push(...block(child as Element, pre));
      } else {
        run += inline(child, pre);
      }
    }
    flush();
    return out;
  }

  // A message is empty exactly when it was empty before, so message counts,
  // which recapture compares, do not shift under existing saved threads.
  const flatText = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? '';
    if (node.nodeType !== 1 || (node as Element).matches(skipSelector as string)) return '';
    return Array.from(node.childNodes, flatText).join('');
  };
  const flat = (skipSelector ? Array.from(root.childNodes, flatText).join('') : root.textContent ?? '').trim();
  if (!flat) return '';
  return block(root, false).join('\n\n').trim() || flat;
}
