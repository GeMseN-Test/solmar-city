// Solmar City — make.fun hand-in entrypoint (node main.ts).
// Copies game/ + screenshots/ into the output dir ($OUTPUT_DIR, or
// /output when unset) and writes dossier.json from the game dossier
// builder. The game itself is 20 modules under game/src/ plus this
// entrypoint; vendor/makefun-game.ts is untouched.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = process.env.OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('wrote ' + join(outDir, 'dossier.json') + ' (' + dossier.length + ' bytes)');
