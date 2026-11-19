# Solmar City — an open-world crime game

[![make.fun](https://img.shields.io/badge/make.fun-GTA%20VI%20bounty-ff5a4e)](https://make.fun)
[![missions](https://img.shields.io/badge/story%20missions-12-gold)](https://github.com/GeMseN-Test/solmar-city)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Steal cars, dodge the cops, run the harbor, and take the crown of
Solmar — a top-down open-world crime game built for the
[make.fun GTA VI bounty](https://make.fun).

Play it: `node serve.ts`, then open http://localhost:8080.

## How to play

| Key | What it does |
| --- | --- |
| WASD / arrows | Walk (hold Shift to run) |
| Mouse | Aim — click to shoot |
| E | Interact: steal a car, board a boat, grab a crate, hit the vault |
| Space | Punch on foot — **hold Space to handbrake while driving** |
| Q | Cycle the radio station |
| M | Mute |
| P / Esc | Pause |
| Enter | Confirm / start the next mission |

New Game starts mission M1. Finishing a mission pays out and starts
the next one. Your progress autosaves — Continue picks up where you
left off. Get wasted or busted and you wake up at Mara's Safehouse.

## Story — 12 missions

1. **Hot Wheels** ($200) — steal a car, bring it to Ray's Garage.
2. **Harbor Run** ($400) — grab 3 crates at the docks, deliver to the marina.
3. **Heat Wave** ($600) — stir up 2 stars of heat, then lose the cops.
4. **Turf War** ($800) — defeat 4 Vipers, escape to the safehouse.
5. **The Solmar Score** ($1,500) — hit the bank vault, vanish.
6. **Harbor Lights** ($900) — board a boat, cross to Gull Island, reach the marina.
7. **On Air** ($1,200) — clear 3 Static Boys off the Solmar Radio tower.
8. **The Grand Finale** ($5,000) — vault, 6 guards, escape.
9. **Night Shift at the Docks** ($1,500) — defeat 4 Harbor Rats, sail the island route.
10. **King of Solmar** ($7,500) — 6 Vipers, the vault, escape.
11. **Midnight Run** ($3,000) — clear the docks, sail out under the moon.
12. **The Solmar Crown** ($10,000) — vault, 6 guards, escape, park at Ray's. Finish this and the story is complete.

## What's in the world

- **5 radio stations** (Q to cycle, all synthesized live with WebAudio): SOLMAR FM sunny pop, HARBOR 98 late-night swing, NEON NIGHTS synthwave, PALM DRIVE sunset chillwave, MIDNIGHT DRIVE night cruise. The current station shows in the HUD.
- **6 boats** moored in the harbor: three workboats at the marina, a red speedboat, a white yacht, and a yellow jetski (the fastest). Press E on the docks to board, E again to step ashore. Boats turn wide, make wakes, and stay in the sea.
- **Taxi fares** — while driving, a waving passenger appears at the roadside. Drive within range to pick them up, deliver within 45 seconds, earn $80–$150 by distance.
- **12 Solmar Coins** hidden on the streets — walk or drive over one for +$25 each. The HUD counts them.
- **Deeper police** — at 3+ stars, roadblocks of parked cruisers cut across the road ahead of you. At 4–5 stars a police helicopter hovers above you with a spotlight. Wanted stars decay after 12 seconds clear.
- **Handbrake** — hold Space while driving for a hard stop, tyre smoke, and a little slide.
- **A living city** — 16 traffic cars (sedans, vans, trucks, sports cars, taxis), 34 pedestrians, 62 buildings, parks, cash/health/ammo pickups, and a live minimap with your position, boats, and the mission marker.
- **Gull Island** in the harbor, the Solmar Radio tower, the Grand Solmar Bank, Ray's Garage, Mara's Safehouse, the Vipers' Turf, the Docks, and the Marina — every mission destination is marked on the map.

## Screenshots

The kit captures 4 shots (`shots.json`): title, city drive, police
chase, and the harbor — mission M6 in a boat with the radio on.

## Tech

Plain JavaScript modules, no dependencies, no build step. `node
serve.ts` serves `game/` on port 8080. `main.ts` copies the game +
screenshots into the submission dossier.
