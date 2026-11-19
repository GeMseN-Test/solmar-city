// serve.ts — tiny static server for the game folder.
// Run: node serve.ts  ->  game/ is on http://localhost:8080
// Serves only files under game/; anything else (or missing) is a 404.
// No request logging.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const gameDir: string = path.join(repoRoot, 'game');
const PORT: number = 8080;

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
};

function send404(res: http.ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('404 not found');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const resolved = path.normalize(path.join(gameDir, pathname));
    if (!resolved.startsWith(gameDir) || !existsSync(resolved)) {
      send404(res);
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const body = await readFile(resolved);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  } catch (err) {
    send404(res);
  }
});

server.listen(PORT, () => {
  console.log('game/ is on http://localhost:8080');
});
