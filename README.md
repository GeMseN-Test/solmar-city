# Solmar City — 12 Missions, SCPD Heat & the Grand Prix Countdown

![Solmar City](https://make.fun/badge/gta6-01.svg)
![Solmar City](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city.svg)
![Rank](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/rank.svg)
![Reward](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/reward.svg)

An open-world crime game set in the fictional city of Solmar. Steal cars,
dodge the SCPD, run 12 story missions, sail the harbor, and beat the clock
to the Solmar Grand Prix.

Bounty: [Make GTA 6 — gta6-01](https://make.fun/bounty/gta6-01)

## How to play

```sh
node serve.ts
# open http://localhost:8080
```

Move with WASD, aim with the mouse, click to shoot. Press Enter or click
**New Game** to play. Progress saves automatically in your browser.

| Key | Action |
| --- | --- |
| WASD | Walk / drive / sail |
| Mouse | Aim, click to shoot |
| E | Enter a car or a boat, interact |
| Q | Cycle the radio station |
| Space | Punch on foot, handbrake while driving |
| Shift | Run |
| M | Mute |
| P / Esc | Pause |

## Features

- **12 story missions** — from the first car theft to "The Solmar Crown"
  ($10,000 finale). Missions pay $900–$10,000 and end with the story
  complete.
- **SCPD heat** — the Solmar City Police Department chases you on a 1–5
  star wanted scale. At 3+ stars cruisers set up **roadblocks** across
  the road ahead; at 4–5 stars a **police helicopter** hovers over you
  with a spotlight. Get busted after 1.6 seconds of close contact.
- **Grand Prix countdown** — a live `SOLMAR GRAND PRIX — STARTS IN
  HH:MM:SS` clock sits in the top-right HUD all game long.
- **5 radio stations** (Q to cycle) — SOLMAR FM sunny pop (112 BPM),
  HARBOR 98 late-night swing (96 BPM), NEON NIGHTS synthwave (122 BPM),
  PALM DRIVE sunset chillwave (100 BPM), MIDNIGHT DRIVE night cruise
  (90 BPM). All synthesized live with WebAudio: bass + lead + hats on an
  8th-note grid.
- **6 boats** — three moored runabouts at the Marina, a red speedboat
  (1.45x), a white yacht (0.85x), and a yellow jetski (1.6x, the
  fastest). Press E to board, E again to step ashore. Boats have wide
  turns, wake particles, and their own speed readout in the HUD.
- **Taxi fares** — while driving, a waving passenger appears; pick them
  up within 60px and deliver them within 45 seconds for $80–$150.
- **12 Solmar Coins** — hidden gold coins on seeded street points, +$25
  each. The HUD counts them: `Coins n/12`.
- **Traffic** — 16 cars (sedan, van, taxi, truck, sport) and 34
  pedestrians on a road grid, with panicking peds and ram damage.
- **Combat** — pistol (34 damage, 520 range, 48 starting ammo), punches
  (26 damage), gang enemies that chase, hold, and shoot back.
- **Handbrake** — hold Space while driving for hard decel, tyre smoke,
  and a slight slide.
- **Save / continue** — your money, missions, kills, and play time are
  saved in the browser and restored on your next visit.

## Screenshots

1. **Downtown action** — full HUD: money, active mission, coins, radio
   station, Grand Prix countdown, and SCPD wanted stars.
2. **SCPD chase** — three-star chase with roadblocks ahead.
3. **Neon night** — Midnight Drive on the radio at Solmar Radio tower.
4. **Harbor** — M6 Harbor Lights aboard the Scarlet Speedboat, radio on.

## Tech

Pure JavaScript + Canvas 2D, no build step, no dependencies. The world
is 2880×2160 with a sea strip at the south edge, a 360px road grid, 62
buildings, 3 parks, and 8 named landmarks. Run the kit check and the
headless playthrough with `node main.ts`.

## License

SPDX-License-Identifier: MIT
