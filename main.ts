// main.ts — make.fun hand-in entrypoint (run with node).
// Copies game/ + screenshots/ to the output dir and writes dossier.json
// from buildDossier(repoRoot, { text_max_bytes: 163840 }).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || process.env.OUTPUT_DIR || '/output';

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(from, to);
    }
  }
}

async function main() {
  await fs.promises.mkdir(outputDir, { recursive: true });
  const gameSrc = path.join(repoRoot, 'game');
  const shotsSrc = path.join(repoRoot, 'screenshots');
  await copyDir(gameSrc, path.join(outputDir, 'game'));
  try {
    await fs.promises.access(shotsSrc);
    await copyDir(shotsSrc, path.join(outputDir, 'screenshots'));
  } catch (e) {
    // screenshots/ is optional before the first capture run.
  }
  const dossier = await buildDossier(repoRoot, { text_max_bytes: 163840 });
  const out = path.join(outputDir, 'dossier.json');
  if (typeof dossier === 'string') {
    await fs.promises.writeFile(out, dossier, 'utf8');
  } else if (dossier instanceof Uint8Array) {
    await fs.promises.writeFile(out, Buffer.from(dossier));
  } else {
    await fs.promises.writeFile(out, JSON.stringify(dossier), 'utf8');
  }
  console.log('dossier written to ' + out);
  console.log('game + screenshots copied to ' + outputDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
