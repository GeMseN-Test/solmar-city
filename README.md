# Solmar City

[![Solmar City](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game for the [make.fun GTA6 Game bounty](https://make.fun/bounty/gta6-01) — a 2D top-down city where you steal cars, outrun the cops, sail the harbor, and fight your way to the top of Solmar. No Rockstar assets, no build step, no network: just open `game/index.html` through the included server and play.

You are **Mara Voss**, fresh out of the shadows and ready to take the city. Steal anything with wheels, grab the bank vault, dodge roadblocks and the police heli, and finish all **12 story missions** to wear the Solmar Crown.

## How to play

```sh
node serve.ts
# game is on http://localhost:8080
```

- **WASD / arrows** — walk, or drive when in a car
- **E** — steal a car, board a boat, grab a crate, grab the vault, get out
- **Mouse** — aim, **click** to shoot
- **Space** — punch on foot, **handbrake** while driving (hard stop + tyre smoke + slide)
- **Q** — cycle the radio (5 stations)
- **Shift** — run
- **P / Esc** — pause (progress saves) • **M** — mute

Progress saves automatically after every mission and on pause. **Continue** on the title screen picks up where you left off.

## What's in the city

- **12 story missions, $34,600 in payouts** — from M1 Hot Wheels ($200) to M12 The Solmar Crown ($10,000). The story ends when the crown is yours.
- **Drive anything** — steal sedans, taxis, vans, trucks and sportscars off the street. Handbrake turns included.
- **Sail the harbor** — 6 boats moored in the sea: 3 classic boats, a red speedboat, a white yacht, and a yellow jetski (the fastest thing on the water). E boards, E steps ashore.
- **5 radio stations** — SOLMAR FM (sunny pop), HARBOR 98 (late-night swing), NEON NIGHTS (synthwave), PALM DRIVE (sunset chillwave), MIDNIGHT DRIVE (night cruise). All synthesized live with WebAudio, Q cycles them.
- **Wanted system** — 1 to 5 stars. Steal, shoot, or run someone over and the heat rises; lay low and it cools off. At 3+ stars the cops set up **roadblocks**; at 4–5 stars the **police helicopter** circles overhead with a spotlight. Get caught on foot and you're BUSTED; lose all health and you're WASTED — either way you wake up at Mara's Safehouse.
- **Taxi fares** — while driving, a waving passenger appears at the roadside. Pick them up and deliver them in 45 seconds for $80–$150.
- **Solmar Coins** — 12 hidden gold coins around the streets, $25 each. HUD counts them.
- **Traffic + pedestrians** — 16 cars and 34 pedestrians living their lives (and panicking when you drive on the sidewalk).
- **Pickups** — cash ($60), health (+40) and ammo (+36) scattered on the streets.
- **Live minimap** — you, the mission target, landmarks and every cop, at a glance.

## Missions

| # | Mission | Payout |
|---|---------|-------:|
| M1 | Hot Wheels — steal a car, bring it to Ray's Garage | $200 |
| M2 | Harbor Run — grab 3 crates at the Docks, drop them at the Marina | $400 |
| M3 | Heat Wave — hit 2 wanted stars, then lose the cops | $600 |
| M4 | Turf War — put down 4 Vipers on their turf | $800 |
| M5 | The Solmar Score — rob the Grand Solmar Bank, escape | $3,500 |
| M6 | Harbor Lights — boat across to Gull Island | $900 |
| M7 | On Air — clear 3 Static Boys off Solmar Radio | $1,200 |
| M8 | The Grand Finale — vault, 6 guards, escape | $5,000 |
| M9 | Night Shift at the Docks — 4 Harbor Rats, then sail | $1,500 |
| M10 | King of Solmar — 6 Vipers, the vault, escape | $7,500 |
| M11 | Midnight Run — Rats, Marina, boat, island | $3,000 |
| M12 | The Solmar Crown — vault, 6 guards, escape, drive home | $10,000 |

Starting cash is $50, so a full story run ends at **$34,650**.

## Screenshots

Four live scenes, staged through `?shot=` (see `game/src/shots.json`):

1. **start** — title screen
2. **city** — downtown drive on M2
3. **chase** — 4-star police chase with roadblocks + heli on M8
4. **harbor** — night boat run on M6 with NEON NIGHTS on the HUD

## Tech

- Pure ES modules, zero dependencies, zero build step. `node serve.ts` serves `game/` on port 8080.
- One module per job under `game/src/`: world, city, render, missions (×4 files), combat, traffic, police, police2, sidejobs, radio, boats, audio, save, input, shots, random, util, config.
- `main.ts` is the make.fun entrypoint — it copies `game/` + `screenshots/` to the output dir and builds the dossier.

## Credits

Built by an AI agent for the make.fun GTA6 Game bounty. Solmar City is an original game — no GTA assets, no Rockstar code.

---

Referral: `5c2wyg2x` — play Solmar City via the bounty link above.
