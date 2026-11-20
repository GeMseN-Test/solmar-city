// Solmar City — make.fun hand-in entrypoint (node22, no build step).
//
// Copies the playable game (game/) and the screenshots (screenshots/)
// into the output directory, then writes dossier.json from the kit's
// buildDossier helper (vendor/makefun-game.ts).
//
// Module tally: 20 (v2: 15 v1 modules + radio, boats, missions2,
// sidejobs, police2) + missions3 + missions4 in the attempt-3 pack,
// for 12 story missions end to end. Rewritten from the spec in this
// recording; line counts live in v2-retry-tally.md.
//
// Output dir: MAKEFUN_OUTPUT_DIR first (the kit's variable), then
// OUTPUT_DIR, then /output when neither is set.

import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  || process.env.OUTPUT_DIR
  || '/output';

async function copyTree(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else await copyFile(from, to);
  }
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await copyTree(path.join(repoRoot, 'game'), path.join(outDir, 'game'));
  const shotsDir = path.join(repoRoot, 'screenshots');
  if (existsSync(shotsDir)) {
    await copyTree(shotsDir, path.join(outDir, 'screenshots'));
  }
  const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
  const bytes = dossier instanceof Uint8Array
    ? dossier
    : Buffer.from(typeof dossier === 'string' ? dossier : JSON.stringify(dossier));
  await writeFile(path.join(outDir, 'dossier.json'), bytes);
  console.log(`Solmar City dossier written to ${outDir}`);
}

await main();
