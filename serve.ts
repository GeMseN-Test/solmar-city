// serve.ts — serve the game/ folder on http://localhost:8080.
// Run with: node serve.ts
//   /            -> game/index.html (text/html; charset=utf-8)
//   *.js         -> text/javascript; charset=utf-8
//   everything else inside game/ -> guessed by extension
//   anything outside game/ or missing -> 404
// Responses carry `cache-control: no-store` so the browser always
// fetches the fresh build. No request logging.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));
const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function contentType(filePath) {
  return MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target = resolve(join(ROOT, normalize(rel)));
    // Refuse anything that escapes the game/ folder.
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      res.writeHead(404, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 not found');
      return;
    }
    const data = await readFile(target);
    res.writeHead(200, {
      'content-type': contentType(target),
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 not found');
  }
});

server.listen(PORT, () => {
  console.log(`game/ is on http://localhost:${PORT}`);
});

export default server;
