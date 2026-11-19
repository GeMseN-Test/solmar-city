# Solmar City — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Made for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — "Make GTA 6".
Solmar City is an original 2D top-down open-world crime game. No Rockstar
assets, no build step, no network: just open it and play. You are Mara Voss,
fresh out of trouble and back in Solmar — steal cars, sail boats, run jobs
for Ray, dodge the cops, and take the crown.

## Play it

```sh
node serve.ts
# game/ is on http://localhost:8080
```

Open http://localhost:8080, press Enter or click **New Game**. Your progress
auto-saves in the browser (Continue on the title screen picks it back up).

## What is in the game

- **12 story missions, $34,600 in payouts** — from Hot Wheels ($200) to The
  Solmar Crown ($10,000). Steal cars, run crates, fight gang turf wars, hit
  the bank vault, sail to Gull Island. Finish M12 and the story is complete.
- **Open city** — 62 buildings, 3 parks, 8 named landmarks (Ray's Garage,
  Mara's Safehouse, Grand Solmar Bank, Vipers' Turf, Solmar Docks, Marina,
  Solmar Radio tower, Gull Island), traffic, and pedestrians who panic.
- **Steal any car (E)** — sedans, vans, taxis, trucks, sports cars. Handbrake
  with Space: hard stop, tyre smoke, a little slide.
- **Drivable boats (E)** — 6 boats moored in the harbor, from a slow yacht
  to a yellow jetski (the fastest thing on the water). Sail out to Gull Island.
- **In-game radio (Q)** — 5 WebAudio synth stations: SOLMAR FM (sunny pop),
  HARBOR 98 (late-night swing), NEON NIGHTS (synthwave), PALM DRIVE (sunset
  chillwave), MIDNIGHT DRIVE (night cruise). The HUD shows what is playing.
- **Wanted system** — 1–5 stars for stealing, shooting, and running people
  over. Police cruisers chase and ram, foot cops try to bust you, roadblocks
  go up at 3+ stars, and a police helicopter with a spotlight circles you at
  4–5 stars. Lay low and the heat fades.
- **Combat** — mouse to aim and shoot, Space to punch on foot. Gang members
  chase, hold, and shoot back.
- **Side jobs, always on** — taxi fares while driving (pick up, deliver in
  45s, $80–$150) and 12 hidden Solmar Coins worth $25 each (HUD counter).
- **Pickups** — cash ($60), health (+40), ammo (+36) scattered on the streets.
- **HUD + minimap** — cash, health, ammo, wanted stars, radio station, coins,
  objective with live distance and an on-screen arrow, speed, and a minimap.
- **WASTED / BUSTED** — you wake up back at Mara's Safehouse.

## Controls

| Keys | What it does |
| --- | --- |
| WASD / Arrows | Move on foot, drive, sail |
| Mouse | Aim, click to shoot |
| Space | Punch on foot / handbrake while driving |
| E | Steal car, board boat, grab crates & the vault, get out |
| Shift | Run |
| Q | Cycle radio station |
| M | Mute |
| P / Esc | Pause |
| Enter | Confirm / next mission |

## Missions

| # | Mission | Payout |
| --- | --- | --- |
| M1 | Hot Wheels | $200 |
| M2 | Harbor Run | $400 |
| M3 | Heat Wave | $600 |
| M4 | Turf War | $800 |
| M5 | The Solmar Score | $3,500 |
| M6 | Harbor Lights | $900 |
| M7 | On Air | $1,200 |
| M8 | The Grand Finale | $5,000 |
| M9 | Night Shift at the Docks | $1,500 |
| M10 | King of Solmar | $7,500 |
| M11 | Midnight Run | $3,000 |
| M12 | The Solmar Crown | $10,000 |

## Screenshots

Four staged shots live in `screenshots/` (start, city drive, police chase,
harbor). Any shot can be re-rendered in the browser with `?shot=<name>&seed=1`
— for example `?shot=harbor&seed=1` puts Mara in a boat off Gull Island with
HARBOR 98 on the HUD.

## Tech

- Plain ES modules under `game/src/`, one job per file — no framework, no
  bundler. Canvas 2D rendering, WebAudio synth for music and sound effects.
- `main.ts` is the make.fun hand-in: it copies `game/` + `screenshots/` to
  the output directory and writes `dossier.json`.
- `serve.ts` serves `game/` locally for development.

## License

MIT — see `LICENSE`.
