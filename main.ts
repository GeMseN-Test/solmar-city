// main.ts — the hand-in for the make.fun gta6-01 bounty.
//
// The site judges an entry from its dossier, so this file's whole job
// is to build one: copy the playable game (game/) and its screenshots
// (screenshots/) into the output directory, then write dossier.json
// there with the kit's own buildDossier.
//
// Run it with Node from the repository root:
//
//   node main.ts
//
// The output goes to $OUTPUT_DIR when that is set, otherwise /output.
// The dossier's text budget (160 KiB) comes from the competition's
// gate: the outline of the source has to fit inside it.
//
// The game itself is 21 modules under game/src: the world, city and
// renderer, combat, police (cruisers + foot cops) and the roadblock /
// helicopter unit, traffic and pedestrians, boats, the four-station
// radio, the audio engine, coins and taxi fares, saving, and three
// mission packs — five story missions, three more, and the two new
// v2-retry missions (M9 Night Shift at the Docks, M10 King of Solmar).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the folder this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.OUTPUT_DIR || '/output';
const TEXT_MAX_BYTES = 163840;

mkdirSync(outputDir, { recursive: true });

// The playable game and its screenshots, exactly as they are in the repo.
for (const folder of ['game', 'screenshots']) {
  const source = join(repoRoot, folder);
  if (existsSync(source)) {
    cpSync(source, join(outputDir, folder), { recursive: true });
  }
}

// The dossier: the kit reads the game tree and the screenshots and
// writes the outline the judge reads.
const dossier = buildDossier(repoRoot, { text_max_bytes: TEXT_MAX_BYTES });
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`Solmar City handed in to ${outputDir}`);
