// serve.ts — a tiny static file server for playing Solmar City locally.
//
//   node serve.ts
//   # then open http://localhost:8080
//
// It serves only the game/ directory: the page, its modules, and
// nothing else. Anything outside game/ (screenshots, the hand-in, the
// rest of the repo) answers 404, and so does any path that tries to
// climb out of the root with .. segments. No build step, no network
// requests from the game itself — this server just hands the browser
// the files.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const ROOT = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));

const MIME_TYPES: Record<string, string> = {
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
  '.txt': 'text/plain; charset=utf-8',
};

// Map a request path to a file inside ROOT, or null when the path is
// not a servable file (missing, a directory without an index, or an
// escape attempt).
function resolveFile(requestPath: string): string | null {
  const clean = decodeURIComponent(requestPath.split('?')[0]);
  const joined = resolve(join(ROOT, normalize('/' + (clean === '/' ? 'index.html' : clean))));
  if (joined !== ROOT && !joined.startsWith(ROOT + sep)) return null;
  let info;
  try {
    info = statSync(joined);
  } catch {
    return null;
  }
  if (info.isDirectory()) {
    const index = join(joined, 'index.html');
    try {
      if (statSync(index).isFile()) return index;
    } catch {
      return null;
    }
    return null;
  }
  return info.isFile() ? joined : null;
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(404);
    res.end();
    return;
  }
  const type = MIME_TYPES[extname(file)] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'content-length': statSync(file).size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`game/ is on http://localhost:${PORT}`);
});
