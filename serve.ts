// serve.ts — tiny static server for local playtesting.
// Run: node serve.ts  (serves game/ on http://localhost:8080)
// `/` serves index.html; anything outside game/ (or missing) is a 404.
// No request logging: the console stays clean for playtest output.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = resolve(join(ROOT, normalize(pathname)));
    // Anything outside game/ is a 404 — no directory escape.
    if (!file.startsWith(ROOT + sep) && file !== ROOT) {
      res.writeHead(404, { 'cache-control': 'no-store' });
      res.end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'cache-control': 'no-store' });
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log('game/ is on http://localhost:' + PORT);
});
