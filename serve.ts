// Solmar City — dev server. `node serve.ts` serves the game folder
// on http://localhost:8080 so the game can be played and screenshotted
// from a browser. No build step, no request logging.
//
//   /            -> game/index.html (text/html; charset=utf-8)
//   *.js         -> text/javascript; charset=utf-8
//   anything else under game/ -> its own type, same no-store header
//   outside game/, or missing -> 404, no body beyond a short line.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(root, 'game');
const port = Number(process.env.PORT || 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(gameDir, rel));
    // Never serve anything outside game/.
    if (!file.startsWith(gameDir + path.sep)) {
      res.writeHead(404, { 'cache-control': 'no-store' });
      res.end('not found');
      return;
    }
    const body = await readFile(file);
    const type = TYPES[path.extname(file).toLowerCase()]
      || 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(404, { 'cache-control': 'no-store' });
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`game/ is on http://localhost:${port}`);
});
