// main.ts — package Solmar City for make.fun.
// Run with: node main.ts
// Copies game/ + screenshots/ into the output dir ($OUTPUT_DIR, or
// /output when unset) and writes dossier.json there, built from
// vendor/makefun-game.ts buildDossier(repoRoot, { text_max_bytes }).
//
// Modules in this build (20): random, util, config, city, save, audio,
// combat, radio, boats, traffic, police, police2, sidejobs, missions,
// missions2, missions3, missions4, world, render, shots, input, main,
// plus the index page, serve.ts and this packager.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = process.env.OUTPUT_DIR || '/output';

function copyIfPresent(src, dest) {
  if (!existsSync(src)) return false;
  cpSync(src, dest, { recursive: true });
  return true;
}

mkdirSync(outDir, { recursive: true });
copyIfPresent(join(repoRoot, 'game'), join(outDir, 'game'));
copyIfPresent(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
// Ship the README + LICENSE alongside the game so the entry is
// self-describing even when the dossier is read on its own.
copyIfPresent(join(repoRoot, 'README.md'), join(outDir, 'README.md'));
copyIfPresent(join(repoRoot, 'LICENSE'), join(outDir, 'LICENSE'));

const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
const bytes = typeof dossier === 'string' ? dossier : Buffer.from(dossier);
writeFileSync(join(outDir, 'dossier.json'), bytes);
console.log(`wrote ${join(outDir, 'dossier.json')} (${bytes.length} bytes)`);
