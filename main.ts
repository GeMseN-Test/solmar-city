// main.ts — dossier builder for the Solmar City make.fun entry.
// Run: node main.ts
// Copies game/ + screenshots/ to $OUTPUT_DIR (or /output when unset)
// and writes dossier.json from vendor/makefun-game.ts.
// Tally: 25 files — 23 game files (22 src modules incl. missions4,
// 5th radio station, 6th boat + index.html) + serve.ts + main.ts.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const outDir: string = process.env.OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });

const gameDir = path.join(repoRoot, 'game');
cpSync(gameDir, path.join(outDir, 'game'), { recursive: true });

const shotsDir = path.join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, path.join(outDir, 'screenshots'), { recursive: true });
}

const dossier = await buildDossier(repoRoot, { text_max_bytes: 163840 });
const bytes = typeof dossier === 'string' ? Buffer.from(dossier, 'utf8') : dossier;
writeFileSync(path.join(outDir, 'dossier.json'), bytes);

console.log('dossier written to ' + path.join(outDir, 'dossier.json'));
