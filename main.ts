// main.ts — make.fun hand-in entrypoint (run with node).
// Copies game/ + screenshots/ into the output dir and writes
// dossier.json from the vendor dossier builder. Output dir is
// $MAKEFUN_OUTPUT_DIR, else $OUTPUT_DIR, else /output.

import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir =
  process.env.MAKEFUN_OUTPUT_DIR || process.env.OUTPUT_DIR || '/output';

async function main() {
  await mkdir(outDir, { recursive: true });
  await cp(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  await cp(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), {
    recursive: true,
  });
  const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
  await writeFile(join(outDir, 'dossier.json'), dossier);
  console.log('wrote ' + join(outDir, 'dossier.json') + ' (' + dossier.length + ' bytes)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
