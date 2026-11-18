import { test, expect, type Page } from '@playwright/test';
import { elementToMarkdown } from '../src/core/dom-markdown';

// Synthetic markup only. These tests prove the serializer in real Chromium;
// they do not certify any provider's current page structure.
const render = async (page: Page, html: string, skip?: string) => {
  await page.setContent(`<!doctype html><body><div id="m">${html}</div></body>`);
  return page.$eval('#m', elementToMarkdown, skip);
};

test.describe('elementToMarkdown', () => {
  test('keeps headings, emphasis, inline code and links', async ({ page }) => {
    const md = await render(page, `
      <h2>Plan</h2>
      <p>Use <strong>bold</strong>, <em>emphasis</em>, <del>old</del> and <code>npm test</code>.
         Read <a href="https://example.com/a(b)">the guide</a>.</p>`);
    expect(md).toBe([
      '## Plan',
      'Use **bold**, *emphasis*, ~~old~~ and `npm test`. Read [the guide](https://example.com/a%28b%29).',
    ].join('\n\n'));
  });

  test('fences code with its language and drops the copy button', async ({ page }) => {
    const md = await render(page, `
      <pre><div><span>python</span><button>Copy code</button></div><code class="language-python">def f(x):
    return x * 2
</code></pre>`);
    expect(md).toBe('```python\ndef f(x):\n    return x * 2\n```');
  });

  test('a code block without a code element still loses its chrome', async ({ page }) => {
    const md = await render(page, '<pre data-language="sh"><button>Copy</button>echo hi<br>echo bye</pre>');
    expect(md).toBe('```sh\necho hi\necho bye\n```');
  });

  test('lengthens the fence when the code contains backticks', async ({ page }) => {
    const md = await render(page, '<pre><code>```js\nx\n```</code></pre><p>Use <code>a`b</code></p>');
    expect(md).toBe('````\n```js\nx\n```\n````\n\nUse ``a`b``');
  });

  test('renders nested, ordered and task lists', async ({ page }) => {
    const md = await render(page, `
      <ol start="3">
        <li>First<ul><li>Inner <code>a</code></li><li><input type="checkbox" checked>done</li></ul></li>
        <li><p>Second</p><pre><code class="language-ts">let a = 1;</code></pre></li>
      </ol>`);
    expect(md).toBe([
      '3. First',
      '   - Inner `a`',
      '   - [x] done',
      '4. Second',
      '',
      '   ```ts',
      '   let a = 1;',
      '   ```',
    ].join('\n'));
  });

  test('renders tables and quotes', async ({ page }) => {
    const md = await render(page, `
      <table><thead><tr><th>Model</th><th>Cost</th></tr></thead>
        <tbody><tr><td>A | B</td><td>$5</td></tr></tbody></table>
      <blockquote><p>One</p><p>Two</p></blockquote><hr>`);
    expect(md).toBe([
      '| Model | Cost |\n| --- | --- |\n| A \\| B | \\$5 |',
      '> One\n>\n> Two',
      '***',
    ].join('\n\n'));
  });

  test('recovers TeX from KaTeX instead of duplicated glyph text', async ({ page }) => {
    const katex = (tex: string) =>
      `<span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow>` +
      `<annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span>` +
      `<span class="katex-html" aria-hidden="true">x</span></span>`;
    const md = await render(page, `
      <p>Energy is ${katex('E = mc^2')} here.</p>
      <span class="katex-display" style="display:block">${katex('\\int_0^1 x\\,dx')}</span>`);
    expect(md).toBe('Energy is $E = mc^2$ here.\n\n$$\n\\int_0^1 x\\,dx\n$$');
  });

  test('copies a typed prompt verbatim when the page preserves its line breaks', async ({ page }) => {
    const md = await render(page,
      '<div style="white-space:pre-wrap">Keep  this:\n# not a heading\n- my_var * 2 &lt;b&gt; $5\n\n  indented</div>');
    expect(md).toBe('Keep  this:\n# not a heading\n- my_var * 2 <b> $5\n\n  indented');
  });

  test('escapes rendered text only where it would change structure', async ({ page }) => {
    const md = await render(page, `
      <p># literal</p><p>1. literal</p><p>- literal</p><p>&gt; literal</p><p>---</p>
      <p>2 * 3, a*b*c, snake_case_name, _lead and trail_, &lt;div&gt;, costs $5, back\\slash, tick \`</p>`);
    expect(md).toBe([
      '\\# literal', '1\\. literal', '\\- literal', '\\> literal', '\\---',
      '2 \\* 3, a\\*b\\*c, snake_case_name, \\_lead and trail\\_, \\<div>, costs \\$5, back\\\\slash, tick \\`',
    ].join('\n\n'));
  });

  test('leaves out hidden elements, controls and a caller-named selector', async ({ page }) => {
    const md = await render(page, `
      <p>Answer<span style="display:none">secret</span> <button>Retry</button><svg><text>icon</text></svg>
         <span class="chip">source chip</span><img alt="alt text" src="x.png"></p>`, '.chip');
    expect(md).toBe('Answer');
  });

  test('follows page layout for custom elements', async ({ page }) => {
    const md = await render(page, `
      <style>message-part { display: block } inline-part { display: inline }</style>
      <message-part>First <inline-part>block</inline-part></message-part>
      <message-part>Second block</message-part>
      <span><p>Wrapped</p><p>paragraphs</p></span>`);
    expect(md).toBe('First block\n\nSecond block\n\nWrapped\n\nparagraphs');
  });

  test('keeps citation links and escapes brackets in their labels', async ({ page }) => {
    const md = await render(page,
      '<p>Claim <a href="https://example.com/s?q=1">[1]</a> and <a href="javascript:void(0)">menu</a>.</p>');
    expect(md).toBe('Claim [\\[1\\]](https://example.com/s?q=1) and menu.');
  });

  test('keeps every line of a code block split across several code elements', async ({ page }) => {
    const md = await render(page,
      '<pre><code class="line">line one\n</code><code class="line">line two\n</code></pre><pre><code>a<br>b</code></pre>');
    expect(md).toBe('```\nline one\nline two\n```\n\n```\na\nb\n```');
  });

  test('fences a multi-line code element that has no pre around it', async ({ page }) => {
    const md = await render(page,
      '<div><code class="language-js" style="display:block;white-space:pre">const a = 1;\nconst b = 2;</code></div><p>and <code>inline</code></p>');
    expect(md).toBe('```js\nconst a = 1;\nconst b = 2;\n```\n\nand `inline`');
  });

  test('keeps positioned and floated children inside their sentence', async ({ page }) => {
    const md = await render(page, `
      <p>See <a href="https://example.com/docs">docs<span style="position:absolute">(opens in new tab)</span></a> now.</p>
      <p>word<span style="float:right">tip</span> rest</p>`);
    expect(md).toBe('See [docs(opens in new tab)](https://example.com/docs) now.\n\nwordtip rest');
  });

  test('escapes literal lines that would open a fence, underline a heading or define a link', async ({ page }) => {
    const md = await render(page, `
      <p>~~~ info</p><p>a<br>-</p><p>b<br>==</p><p>1.</p><p>[1]: https://example.com</p>
      <p>not ~~struck~~ and &amp;lt; stays text</p>`);
    expect(md).toBe([
      '\\~~~ info', 'a\n\\-', 'b\n\\==', '1\\.', '\\[1]: https://example.com',
      'not \\~~struck\\~~ and \\&lt; stays text',
    ].join('\n\n'));
  });

  test('a heading that equals a role line is written in closed form', async ({ page }) => {
    const md = await render(page, '<h2>You</h2><h2>ChatGPT</h2><h3>You</h3><h2>Your plan</h2>');
    expect(md).toBe('## You ##\n\n## ChatGPT ##\n\n### You\n\n## Your plan');
  });

  test('tables skip hidden rows and keep the blocks of a cell apart', async ({ page }) => {
    const md = await render(page, `
      <table><tr><th>A</th><th>B</th></tr>
        <tr style="display:none"><td>hidden</td><td>row</td></tr>
        <tr><td><p>one</p><p>two</p></td><td><ul><li>x</li><li>y</li></ul></td></tr></table>`);
    expect(md).toBe('| A | B |\n| --- | --- |\n| one two | - x - y |');
  });

  test('turns line breaks into new lines', async ({ page }) => {
    expect(await render(page, '<p>one<br>two</p>')).toBe('one\ntwo');
  });

  test('is empty exactly when the flat text is empty, and never returns less than it', async ({ page }) => {
    expect(await render(page, '<p>  </p><input type="checkbox">')).toBe('');
    // Chrome-only content was a non-empty message before; it must stay one.
    expect(await render(page, '<button>Copy</button>')).toBe('Copy');
  });

  test('a caller-named selector also decides emptiness, as removing those nodes did', async ({ page }) => {
    expect(await render(page, '<span class="chip">source</span>', '.chip')).toBe('');
    expect(await render(page, '<span class="chip">source</span><button>Retry</button>', '.chip')).toBe('Retry');
  });
});
