// Solmar City — a make.fun gta6-01 entry, packaged by this file.
//
// The game itself is plain static files: game/index.html plus its ES modules
// under game/src/. No build step, no libraries, no network requests — a
// desktop browser loads it offline. This script is only the hand-in: it
// copies game/ and screenshots/ next to /output (or MAKEFUN_OUTPUT_DIR when
// set, for local runs) and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library.
//
// Play the game locally with:
//   node serve.ts   (then open http://localhost:8080)
// Package it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The folder this file lives in — the game and the screenshots sit beside it.
const here = fileURLToPath(new URL('.', import.meta.url));
// The grader's container mounts /output; anywhere else, MAKEFUN_OUTPUT_DIR wins.
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps (reference/gate.json): text_max_bytes is the only one
// that shapes the dossier's bytes; the rest refuse an entry the scorer
// would refuse — more than 4 screenshots, or one over 256 KiB; more than
// 993 files or 48 MiB under game/; or a game path over 1000 bytes. (The
// dossier also counts beside /output's own 1000-entry cap, with its
// screenshots/ and dossier.json.)
// Solmar City's own tally, for the record: 15 source modules, 1 page, 4 shots.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
