# Solmar City — an open-world crime game

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-blue)](https://make.fun/competitions/gta6-01)
[![Solmar City](https://img.shields.io/badge/Solmar_City-open--world-green)](https://make.fun/competitions/gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Built for the [make.fun gta6-01 bounty](https://make.fun/competitions/gta6-01) — "Make GTA 6".
A fan-made original 2D top-down open-world crime game. No Rockstar assets, no GTA VI
content: the city, the story, the music and the art are all original.

You are Mara Voss, new in Solmar City. Steal cars, outrun the police, run jobs for
cash, and climb from street hustler to ruler of the city.

## How to play

Open `game/index.html` in a browser, or run `node serve.ts` and visit
http://localhost:8080. No build step, no network needed.

- **WASD / arrows** — walk (hold Shift to run), drive, sail
- **Mouse** — aim, hold left click to shoot
- **E** — steal a car, board a boat, grab a crate, crack the bank vault
- **Space** — punch on foot, handbrake while driving (tyre smoke + slide)
- **Q** — cycle the in-game radio (5 stations)
- **M** — mute, **P / Esc** — pause (progress auto-saves)
- **Enter** — New Game from the title screen

## What's in the game

- **12 story missions, $34,600 in rewards** (plus the $50 you start with, so
  $34,650 in the bank when the story ends) — Hot Wheels ($200), Harbor Run
  ($400), Heat Wave ($600), Turf War ($800), The Solmar Score ($3,500), Harbor
  Lights ($900), On Air ($1,200), The Grand Finale ($5,000), Night Shift at the
  Docks ($1,500), King of Solmar ($7,500), Midnight Run ($3,000), and the finale
  The Solmar Crown ($10,000). Finish M12 and the story is complete.
- **5 radio stations** (Q to cycle, synth audio made with WebAudio): SOLMAR FM
  sunny pop, HARBOR 98 late-night swing, NEON NIGHTS synthwave, PALM DRIVE sunset
  chillwave, MIDNIGHT DRIVE night cruise. The current station shows in the HUD.
- **6 drivable boats** in the harbor: three moored runabouts, a red speedboat,
  a white yacht, and a yellow jetski (the fastest). E boards, E steps ashore.
  Boat speed shows in knots on the HUD.
- **Taxi fares** — while driving, a waving passenger appears; pick them up and
  deliver them in time for $80–$150.
- **12 hidden Solmar Coins** — walk or drive over one for +$25 each. HUD counter.
- **Deeper police AI** — roadblocks of parked cruisers at 3+ wanted stars, and a
  police helicopter with a spotlight circling you at 4–5 stars. Wanted stars
  decay only after you stay clean for a while.
- **A living city** — 16 traffic cars (sedan, van, taxi, truck, sport), 34
  pedestrians, pickups (cash, health, ammo), gang enemies, a minimap, and a
  save system (Continue from the title screen).

## Screenshots

Four staged shots (`game/src/shots.json`): title screen, city driving, a 4-star
police chase with roadblocks and helicopter, and the harbor scene — Mara in a
boat with the radio on.

## Structure

- `game/index.html` + `game/src/*.js` — the game, one ES module per job
  (missions, world, render, combat, traffic, police, boats, radio, sidejobs…)
- `serve.ts` — serves `game/` on http://localhost:8080
- `main.ts` — hand-in entry point (copies the game + screenshots, builds the dossier)
- `screenshots/` — the four staged shots

## License

MIT. Original work, made for the make.fun bounty.
