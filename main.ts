// Solmar City — make.fun dossier entrypoint.
//
// Run with node: `node main.ts`
// Copies game/ + screenshots/ into the output dir ($OUTPUT_DIR, or
// /output when unset) and writes dossier.json there, built by the
// kit's buildDossier helper from vendor/makefun-game.ts.
//
// Game tally (attempt 3): 22 modules under game/src — random, util,
// config, city, save, audio, radio (5 stations), boats (6 boats),
// combat, traffic, police, police2, sidejobs, missions, missions2,
// missions3, missions4, world, render, shots, input, main — plus
// index.html, shots.json, serve.ts, this file and README.md.
// Builder A authored 16 of those files in this recording; Builder B
// owns the rest. Smoke gate for this entrypoint: dossier.json builds
// and the copied game/ + screenshots/ land in the output dir.
// Dossier JSON: { cover: 0, images: [4 base64 JPEGs],
//   schema: 'makefun/dossier/v1', text: <markdown outline> }.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.');
const outputDir = process.env.OUTPUT_DIR || '/output';

function copyIfPresent(srcDir: string, destDir: string): void {
  if (!existsSync(srcDir)) return;
  cpSync(srcDir, destDir, { recursive: true });
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });
  copyIfPresent(path.join(repoRoot, 'game'), path.join(outputDir, 'game'));
  copyIfPresent(path.join(repoRoot, 'screenshots'), path.join(outputDir, 'screenshots'));

  const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
  const bytes = typeof dossier === 'string' ? dossier : Buffer.from(dossier);
  writeFileSync(path.join(outputDir, 'dossier.json'), bytes);
  console.log('dossier written to ' + path.join(outputDir, 'dossier.json'));
}

main();
