// Solmar City v2 — entrypoint (make.fun gta6-01).
//
// Hands the game in: copies game/ and screenshots/ from beside
// this file into the output directory, then writes
// dossier.json there with the vendored make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output.
// The game itself is 20 modules under game/src/ plus the page;
// the tally lives in v2-attempt3-tally.md at the project root.
// This file only talks to vendor/makefun-game.ts — no other
// imports — so the hand-in works with the stdlib alone.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
} else {
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
}

// buildDossier reads the copied game/ + screenshots/ out of the
// output directory and returns the dossier as canonical JSON
// bytes (a Uint8Array). Write those bytes straight to disk:
// JSON.stringify on a Uint8Array would explode it into a
// {"0": 123, "1": 34, ...} object and corrupt the file.
const dossierBytes = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);

console.log(`Solmar City handed in to ${outDir} (dossier.json ${dossierBytes.length} bytes)`);
