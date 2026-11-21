# Solmar City — 12 Story Missions, SCPD Police & Grand Prix Countdown

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Solmar City](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). No Rockstar assets — the city, the story, and the sound are all ours. You are Mara Voss. Take Solmar City, one mission at a time.

## What is in v2

- **12 story missions** — from Hot Wheels ($200) to The Solmar Crown ($10,000). Total payout **$33,600**; starting from $50, finishing all twelve leaves you with **$33,650**.
- **SCPD police** — the Solmar City Police Department chases you with cruisers and foot cops, sets up **roadblocks at 3+ stars**, and sends a **police helicopter with a spotlight at 4–5 stars**.
- **Grand Prix countdown** — a live HH:MM:SS countdown to the big race, always on the HUD.
- **5 radio stations** — SOLMAR FM, HARBOR 98, NEON NIGHTS, PALM DRIVE, MIDNIGHT DRIVE. Press Q to tune. All synthesized live with WebAudio, no audio files.
- **6 boats** — sail the harbor, board with E, step ashore with E again. Includes a red speedboat and a yellow jetski, the fastest ride in the game.
- **Taxi fares** — pick up waving passengers while driving and deliver them for $80–$150.
- **12 Solmar Coins** — hidden gold coins around the streets, +$25 each.
- **Handbrake** — hold Space while driving for hard decel and a slide.
- **Saves** — progress autosaves; continue from the title screen.
- **Live minimap, wanted stars, health/ammo/cash HUD**, pause, WASTED/BUSTED respawn at the Safehouse.

## The 12 missions

| # | Mission | Payout |
|---|---------|-------:|
| 1 | Hot Wheels | $200 |
| 2 | Harbor Run | $400 |
| 3 | Heat Wave | $600 |
| 4 | Turf War | $800 |
| 5 | The Solmar Score | $2,500 |
| 6 | Harbor Lights | $900 |
| 7 | On Air | $1,200 |
| 8 | The Grand Finale | $5,000 |
| 9 | Night Shift at the Docks | $1,500 |
| 10 | King of Solmar | $7,500 |
| 11 | Midnight Run | $3,000 |
| 12 | The Solmar Crown | $10,000 |
| | **Total** | **$33,600** |

## Controls

- **WASD / arrows** — move (on foot) / drive (in a car)
- **Mouse** — aim, click to shoot
- **E** — interact: steal a car, board a boat, grab the vault, pick up a crate
- **Space** — punch on foot, handbrake while driving
- **Q** — cycle radio station
- **M** — mute, **P / Esc** — pause, **Enter** — confirm

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, no install.

## Tech

Pure JavaScript + HTML5 Canvas, one ES module per job under `game/src/`
(world, city, combat, police, police2, boats, radio, sidejobs, traffic,
missions, render, input, shots, save, audio, random, util, config).
Screenshots are staged from real game states via `?shot=city|chase|start|harbor`.

## License

MIT — see [LICENSE](LICENSE).
