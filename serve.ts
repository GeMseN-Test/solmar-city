// Solmar City — tiny static server for local play (Node, stdlib only).
//
//   node serve.ts            serves game/ on http://localhost:8080
//   node serve.ts --port N   serves game/ on http://localhost:N
//
// It answers only files inside game/: the index, the game modules,
// and anything else the page needs. Anything outside that folder,
// or any path that is not a file, gets a 404. Responses are never
// cached. This is a dev convenience for playing locally, not a
// server for the internet — it binds to localhost only and logs
// nothing per request.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const argv = process.argv.slice(2);
const flagAt = argv.indexOf('--port');
const wanted = flagAt === -1 ? NaN : Number(argv[flagAt + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const raw = req.url || '/';
  let path;
  try {
    path = decodeURIComponent(new URL(raw, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('bad request');
    return;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(gameDir, normalize(path)));
  if (file !== gameDir && !file.startsWith(gameDir + sep)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let bytes;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    bytes = info.size;
  } catch {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': bytes,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`game/ is on http://localhost:${port}`);
});
