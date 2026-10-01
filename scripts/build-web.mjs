// Package the same tested gallery as a static, local-data web companion.
// Never include the extension background/content scripts or any user archive.
import { readFile, writeFile, mkdir, readdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const output = path.join(root, 'web-dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
let html = await readFile(path.join(dist, 'images.html'), 'utf8');
html = html.replace('aria-label="Kura conversation library"', 'aria-label="Kura image library"')
  .replace('href="sidepanel.html" class="brand"', 'href="/" class="brand"')
  .replace('<a href="sidepanel.html">Conversations <span>↗</span></a>', '<a href="https://github.com/frankxai/kura#install-manual--developer-mode" target="_blank" rel="noopener noreferrer">Get extension <span>↗</span></a>')
  .replace('href="images.html"', 'href="/"')
  .replace('Local archive · Desktop Chrome &amp; Edge', 'Production pilot · Desktop Chrome &amp; Edge');
if (html.includes('sidepanel.html') || html.includes('href="images.html"')) throw new Error('Extension-only navigation leaked into web build');
await writeFile(path.join(output, 'index.html'), html);

// Copy only the dependency graph referenced by this HTML and its JS/CSS modules.
const pending = [...html.matchAll(/(?:src|href)="\/(chunks|assets)\/([^"?#]+)"/g)].map(m => `${m[1]}/${m[2]}`);
const copied = new Set();
while (pending.length) {
  const relative = pending.pop();
  if (copied.has(relative)) continue;
  if (!/^(chunks|assets)\/[A-Za-z0-9_.-]+\.(js|css)$/.test(relative)) throw new Error(`Unexpected web dependency: ${relative}`);
  const source = await readFile(path.join(dist, relative), 'utf8');
  if (/chrome\.runtime|chrome\.tabs|browser\.runtime/.test(source)) throw new Error(`Extension API in web dependency: ${relative}`);
  await mkdir(path.dirname(path.join(output, relative)), { recursive: true });
  await copyFile(path.join(dist, relative), path.join(output, relative));
  copied.add(relative);
  for (const match of source.matchAll(/(?:from|import)\s*"\.\/([^"?#]+\.js)"/g)) pending.push(`chunks/${match[1]}`);
}
await writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await writeFile(path.join(output, 'release.json'), JSON.stringify({ product: 'Kura', channel: 'production-pilot', importLimit: 10, storage: 'user-selected-local-folder', cloudSync: false, accountCrawler: false }) + '\n');
console.log(`Web companion packaged: ${copied.size} shared assets; ${(await readdir(output)).join(', ')}`);
