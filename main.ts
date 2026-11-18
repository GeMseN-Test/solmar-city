// Solmar City — make.fun gta6-01 hand-in. 20 game modules under game/src/,
// 10 story missions, 4 radio stations, 5 boats. The hand-in copies the
// game and the screenshots, then writes dossier.json for the judges.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.OUTPUT_DIR || '/output';
mkdirSync(outputDir, { recursive: true });
for (const dir of ['game', 'screenshots']) {
  const src = join(repoRoot, dir);
  if (existsSync(src)) cpSync(src, join(outputDir, dir), { recursive: true });
}
const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`Solmar City handed in to ${outputDir}`);
