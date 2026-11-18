# Solmar City

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/rank.svg)
![reward](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/reward.svg)

An original open-world crime game built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) — a 2D top-down city you explore on foot and by car. Everything in it — the city, the characters, the story, the art, the sound — is original; nothing comes from Rockstar/GTA or any commercial game.

## The game

You are Mara Voss. She came home broke, and the city owes her a living. Steal cars, lose the cops, run the missions, take the city.

- **A living city**: a road grid with traffic cars, pedestrians, parks, the docks, the marina, a beach and the sea — all drawn in code, no image files.
- **Drive anything**: walk up to a car, press E, and it's yours. Traffic, police cruisers, your own ride — every car handles, skids and takes damage.
- **Wanted level**: steal, shoot or ram and the stars climb; police cruisers and foot cops hunt you down, ram you, and bust you if they get close on foot. At 3 stars the PD sets roadblocks across the road ahead; at 4–5 a police helicopter circles overhead with a spotlight. Lay low and it fades.
- **Missions and a story**: eight story missions — the first five (Hot Wheels, Harbor Run, Heat Wave, Turf War, The Solmar Score) plus a second act: Harbor Lights (take a boat to Gull Island), On Air (defend the Solmar Radio tower), and The Grand Finale (one last bank job) — plus repeatable freelance runs after the story ends, $250 to $5,000 a job.
- **Boats**: three speedboats moored in the harbor. Walk up to one on the beach, press E, and sail the sea strip — the harbor, the marina and Gull Island are all reachable by water.
- **In-game radio**: three original synth stations — SOLMAR FM (sunny pop), HARBOR 98 (late-night swing), NEON NIGHTS (synthwave). Press Q to change station; the HUD shows what is playing. All WebAudio synthesis, no audio files.
- **Side work**: taxi fares (pick up a waving passenger, deliver in time, get paid) and 12 hidden Solmar Coins scattered across the city, tracked on the HUD.
- **Driving feel**: hold Space while driving for a handbrake turn — hard stop, tyre smoke, a little slide. Sports cars, vans, trucks and taxis all look and handle differently on the road.
- **Combat**: shoot (click) and punch (Space), health and ammo pickups, gang members who chase and shoot back.
- **HUD and minimap**: cash, health, ammo, wanted stars, objective with distance and an on-screen arrow, speed, and a live minimap with the player, cops and targets.
- **Save and continue**: progress saves to localStorage — New Game / Continue from the title screen, pause with P, and a WASTED/BUSTED screen that sends you back to the Safehouse.
- **Sound and music**: all WebAudio synthesis — engine hum, sirens, gunshots, crashes, pickups and a bass groove. M mutes. No audio files.

## How to play

```
WASD move / drive  •  E enter & steal car / board boat  •  Q radio  •  Click shoot  •  Space punch / handbrake  •  P pause  •  M mute
```

Serve it locally and open it in a desktop browser:

```
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests — the whole game is `game/index.html` plus ES modules under `game/src/`.

## Files

- `game/index.html` — the page and the canvas.
- `game/src/` — one module per job: `city` (the map), `world` (the rules), `render` (the drawing), `missions` + `missions2` (the story, acts one and two), `police` + `police2` (the law, plus roadblocks and the helicopter), `traffic`, `combat`, `audio`, `radio` (the in-game stations), `boats`, `sidejobs` (taxi fares and Solmar Coins), `input`, `save`, `shots` (the posed screenshots), and small helpers (`config`, `random`, `util`).
- `screenshots/` — four posed frames taken from the game's own code (`?shot=...`): the title screen, driving through the city, a police chase, and Mara at the helm of a boat in the harbor with the radio on.
- `main.ts` — the hand-in: copies `game/` and `screenshots/` to the output and writes `dossier.json`.
- `serve.ts` — a tiny static server for local play.

Built with [make.fun](https://make.fun) for the [gta6-01 bounty](https://make.fun/bounty/gta6-01).
