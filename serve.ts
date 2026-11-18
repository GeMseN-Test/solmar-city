// Tiny static server for local play: node serve.ts -> http://localhost:8080
// Serves only files under game/; anything else (or a missing file) is a 404.
// No request logging, no build step, no network.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), 'game');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function notFound(res) {
  res.writeHead(404);
  res.end('not found');
}

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    if (path === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, game: 'solmar-city' }));
      return;
    }
    const rel = path === '/' ? 'index.html' : path.replace(/^\//, '');
    const file = resolve(GAME_DIR, rel);
    if (!file.startsWith(GAME_DIR)) {
      notFound(res);
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    notFound(res);
  }
});

server.listen(PORT, () => {
  console.log(`game/ is on http://localhost:${PORT}`);
});
