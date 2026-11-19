// main.ts — make.fun hand-in entrypoint (run with node).
// Copies game/ + screenshots/ to the output dir and writes dossier.json.
// Tally: 20 modules in the game (game/src/*.js + index.html + main.js).
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || process.env.OUTPUT_DIR || '/output';

async function main() {
  await mkdir(outputDir, { recursive: true });
  const gameSrc = path.join(repoRoot, 'game');
  const gameDst = path.join(outputDir, 'game');
  await cp(gameSrc, gameDst, { recursive: true });
  const shotsSrc = path.join(repoRoot, 'screenshots');
  if (existsSync(shotsSrc)) {
    await cp(shotsSrc, path.join(outputDir, 'screenshots'), { recursive: true });
  }
  const dossier = await buildDossier(repoRoot, { text_max_bytes: 163840 });
  // buildDossier returns canonical JSON *bytes* (a Uint8Array, not a
  // Buffer and not a string). Write the bytes as UTF-8 text: stringifying
  // a Uint8Array would produce {"0":...,"1":...} instead of the dossier.
  const bytes = typeof dossier === 'string'
    ? dossier
    : dossier instanceof Uint8Array
      ? Buffer.from(dossier).toString('utf8')
      : JSON.stringify(dossier, null, 2);
  await writeFile(path.join(outputDir, 'dossier.json'), bytes);
  console.log('dossier written to ' + path.join(outputDir, 'dossier.json'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
export { repoRoot, outputDir };
