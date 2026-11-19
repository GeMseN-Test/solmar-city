// Solmar City hand-in entrypoint. Run with node (no build step):
//   node main.ts
// Copies game/ + screenshots/ into the output dir ($MAKEFUN_OUTPUT_DIR,
// or /output when unset) and writes dossier.json from
// vendor/makefun-game.ts buildDossier().
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? process.env.OUTPUT_DIR ?? '/output';

async function main() {
  await mkdir(outputDir, { recursive: true });
  await cp(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
  // Screenshots are optional on a fresh checkout: copy when present.
  try {
    await cp(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
  } catch (e) {
    console.log('no screenshots/ to copy, continuing');
  }
  const dossier = await buildDossier(repoRoot, { text_max_bytes: 163840 });
  await writeFile(join(outputDir, 'dossier.json'), dossier);
  console.log('copied game/ to ' + join(outputDir, 'game'));
  console.log('wrote ' + join(outputDir, 'dossier.json'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
