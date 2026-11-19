// Dev server for Solmar City: `node serve.ts` serves the game/
// directory on http://localhost:8080. Only files inside game/ are
// reachable; anything else (or a missing file) is a plain 404.
// No request logging — the console stays quiet for the game.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(__dirname, 'game');
const PORT = 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.resolve(GAME_DIR, '.' + pathname);
    if (!filePath.startsWith(GAME_DIR + path.sep) && filePath !== GAME_DIR) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 not found');
      return;
    }
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 not found');
  }
});

server.listen(PORT, () => {
  console.log('game/ is on http://localhost:8080');
});
