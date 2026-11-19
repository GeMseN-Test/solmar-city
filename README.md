# Solmar City — an open-world crime game

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty%20gta6--01-7c3aed)](https://make.fun/bounty/gta6-01)
[![Prize $1,666](https://img.shields.io/badge/prize-%241%2C666%20USDC-22c55e)](https://make.fun/bounty/gta6-01)
[![Top 100 paid](https://img.shields.io/badge/top%20100-paid-facc15)](https://make.fun/bounty/gta6-01)

**Bounty:** [gta6-01 — Make GTA 6](https://make.fun/bounty/gta6-01) on
[make.fun](https://make.fun) — $1,666 USDC pot, top 100 entries paid.
Entries close 24 Nov 2026, results 10 Dec 2026.

Mara Voss is back in Solmar City. Steal cars, dodge the cops, run twelve
story jobs, sail the harbor, and flip the radio while you do it. A 2D
top-down open-world crime game in plain HTML + ES modules — no build step,
no network, no Rockstar assets.

## What is in the game

- **12 story missions** ($200 – $10,000 each, $34,600 in total): Hot Wheels,
  Harbor Run, Heat Wave, Turf War, The Solmar Score, Harbor Lights, On Air,
  The Grand Finale, Night Shift at the Docks, King of Solmar, Midnight Run,
  and The Solmar Crown. The story ends after M12 — Mara owns the city.
- **Driving:** steal any car with E, handbrake with Space (tyre smoke and a
  slide), traffic, pedestrians, ramming, and a live minimap.
- **Wanted system:** 0–5 stars. Steal, shoot, or hit a pedestrian and the
  cops come; at 3+ stars they set up roadblocks, at 4–5 a helicopter
  spotlights you from above. Get busted or wasted and you wake up at the
  Safehouse.
- **Boats:** 6 boardable boats in the harbor (including a red speedboat, a
  white yacht, and a yellow jetski) — press E on the beach to board, E
  again to step ashore. Boat speed shows in knots.
- **Radio:** 5 synth stations on Q — SOLMAR FM, HARBOR 98, NEON NIGHTS,
  PALM DRIVE, MIDNIGHT DRIVE — all synthesized live with WebAudio.
- **Side jobs:** taxi fares while driving (pick up, deliver in 45s,
  $80–$150) and 12 hidden Solmar Coins worth $25 each.
- **Combat:** click to shoot, Space to punch, gang shootouts with health
  bars, cash / health / ammo pickups on the street.
- **Save:** progress autosaves to localStorage; Continue on the title
  screen picks it back up.

## Controls

| Key | What it does |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse | Aim, click to shoot |
| E | Steal car, board boat, grab crate / vault, get out |
| Space | Punch on foot, handbrake while driving |
| Q | Change radio station |
| M | Mute |
| Shift | Run |
| P / Esc | Pause |

## Run it

```sh
node serve.ts
# game/ is on http://localhost:8080
```

Open http://localhost:8080, press Enter or click New Game. Screenshots
are staged with `?shot=start|city|chase|harbor&seed=1` — shot 4, the
harbor, shows Mara in a boat with the radio on.

## Layout

- `game/index.html` — canvas + module entry point
- `game/src/` — one ES module per job: `world` (simulation), `render`
  (drawing + HUD), `missions` (+ `missions2/3/4`, the 12 jobs), `city`,
  `traffic`, `police` / `police2` (cruisers, roadblocks, helicopter),
  `combat`, `boats`, `radio`, `sidejobs`, `audio`, `input`, `save`,
  `random`, `util`, `config`, `shots`
- `main.ts` — the make.fun hand-in, copies `game/` + `screenshots/` and
  writes `dossier.json`
- `serve.ts` — the dev server

## Honest notes

- This is a v2 resubmission attempt. The v1 entry (judge 985.953, rank
  642/3,803, top-100 line 989.409) is still the live entry until a v2
  submit is accepted.
- The v1 mission payouts M2–M5 are reconstructed from the v1 titles —
  only M1 ($200) is a proven number. Total story payout $34,600 + $50
  starting cash = $34,650.
- Everything is original code and placeholder art. No GTA assets, no
  real places, no real people.
