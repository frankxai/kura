// CI-only static server with the production response headers.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../web-dist');
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(config.headers[0].headers.map(h => [h.key, h.value]));
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(filename);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(filename)] || 'text/plain';
    res.writeHead(200, { ...headers, 'Content-Type': type }); res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4174, '127.0.0.1');
