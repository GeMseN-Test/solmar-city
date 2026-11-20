# Solmar City — open-world crime game: 12 missions, 5 radio stations, 6 boats, SCPD, Grand Prix countdown

![Solmar City](https://make.fun/badge/gta6-01.svg)
![Solmar City](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city.svg)
![Solmar City rank](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/rank.svg)
![Solmar City reward](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/reward.svg)

Built for the **Make GTA 6** bounty: https://make.fun/bounty/gta6-01

Solmar City is a top-down open-world crime game in the browser. You are a
small-time hustler in a fictional coastal city. Steal cars, outrun the
**SCPD** (Solmar City Police Department), rob the bank vault, sail the
harbor, and work your way through **12 story missions worth $33,600** —
from "Hot Wheels" to the final job, "The Solmar Crown". While you play, the
**Grand Prix countdown** ticks down in the corner of the screen.

## What is in the game

- **12 story missions ($34,650 total)** — car theft, crate runs, turf wars,
  vault heists, boat trips to Gull Island, and a finale at the bank.
- **5 in-game radio stations** — SOLMAR FM, HARBOR 98, NEON NIGHTS,
  PALM DRIVE, MIDNIGHT DRIVE. Press **Q** to change station; all music is
  synthesized live with WebAudio, no audio files.
- **6 drivable boats** — three moored boats, a red speedboat, a white
  yacht, and a yellow jetski (the fastest). Press **E** near a boat to
  board it, **E** again to step ashore on the beach.
- **SCPD police that escalate** — wanted stars from 1 to 5, roadblocks at
  3+ stars, and a police helicopter with a spotlight at 4–5 stars.
- **Grand Prix countdown** — a live HH:MM:SS timer in the HUD counting
  down to the next Grand Prix, then wrapping to the next one.
- **Side jobs** — taxi fares while driving ($80–$150 a ride) and
  **12 hidden Solmar Coins** worth $25 each, tracked in the HUD.
- **Driving feel** — handbrake with **Space** while driving (hard stop +
  slide), five car models (sedan, van, taxi, truck, sport), traffic,
  pedestrians, pickups, and a live minimap.
- **Save / continue** — progress autosaves to the browser; continue from
  the title screen.

## Missions

| # | Mission | Payout |
|---|---------|-------:|
| M1 | Hot Wheels | $200 |
| M2 | Harbor Run | $400 |
| M3 | Heat Wave | $600 |
| M4 | Turf War | $800 |
| M5 | The Solmar Score | $2,500 |
| M6 | Harbor Lights | $900 |
| M7 | On Air | $1,200 |
| M8 | The Grand Finale | $5,000 |
| M9 | Night Shift at the Docks | $1,500 |
| M10 | King of Solmar | $7,500 |
| M11 | Midnight Run | $3,000 |
| M12 | The Solmar Crown | $10,000 |
| | **Total** | **$33,600** |

## Controls

| Key | Action |
|-----|--------|
| WASD / arrows | Move / drive |
| Mouse | Aim, click to shoot |
| Shift | Run |
| E | Interact — steal car, board boat, grab vault, grab crate |
| Space | Punch (on foot) / handbrake (while driving) |
| Q | Change radio station |
| M | Mute |
| P / Esc | Pause |
| Enter | Confirm / start |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game is pure HTML + JavaScript
modules, no build step, no dependencies.

## Screenshots

Four staged shots (`shots.json`): title screen, driving downtown, a
4-star SCPD chase with the helicopter, and M6 "Harbor Lights" in a boat
on the harbor with the radio on.

## License

SPDX-License-Identifier: MIT
