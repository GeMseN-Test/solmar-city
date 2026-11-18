# Solmar City

An original 2D top-down open-world crime game — no Rockstar assets, no
build step, no network. You are Mara Voss, back in Solmar: steal cars,
dodge the cops, run the harbor, and take the crown.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD / arrows** — move / drive · **Shift** — run
- **Click** — shoot · **Space** — punch on foot, handbrake in a car
- **E** — steal a car, board a boat, grab crates, grab the vault
- **Q** — cycle the radio · **M** — mute · **P / Esc** — pause
- **Enter** — New Game / confirm

Progress autosaves to localStorage; Continue picks up where you left off.

## The city

A 2880×2160 island city with a road grid, 62 buildings, 3 parks, a beach
and a harbor sea. Traffic (sedans, vans, taxis, trucks, sports cars) and
34 pedestrians live on the streets. Wanted stars (0–5) bring cop cruisers
and foot cops; at 3+ stars the police set **roadblocks** across the road
ahead of you, and at 4–5 stars a **police helicopter** circles overhead
with a spotlight. Get WASTED or BUSTED and you wake up at the safehouse.

## Story — 12 missions

1. **Hot Wheels** ($250) — steal a car, bring it to Ray's Garage
2. **Harbor Run** ($400) — grab 3 crates at the docks, run them to the marina
3. **Heat Wave** ($600) — hit the bank vault, lose the heat, get home
4. **Turf War** ($800) — clear 4 Vipers off Mara's turf
5. **The Solmar Score** ($2,500) — vault, guards, vanish
6. **Harbor Lights** ($900) — boat out to Gull Island and back
7. **On Air** ($1,200) — clear 3 Static Boys off the radio tower
8. **The Grand Finale** ($5,000) — bank, vault, 6 guards, escape
9. **Night Shift at the Docks** ($1,500) — 4 Harbor Rats, then the island
10. **King of Solmar** ($7,500) — turf, bank, escape
11. **Midnight Run** ($3,000) — docks, 4 Harbor Rats, marina, boat, island
12. **The Solmar Crown** ($10,000) — bank, vault, 6 guards, escape to the
    safehouse, reach the garage. Finish it and the story is complete.

## Side jobs

- **Taxi fares** — while driving, a waving passenger appears; pick them
  up and deliver them within 45 seconds for $80–$150 by distance.
- **Solmar Coins** — 12 hidden gold coins on the streets, +$25 each.
- **Pickups** — cash ($60), health (+40), ammo (+36) scattered around town.

## Radio — 5 stations (Q to cycle)

| Station | Style |
|---|---|
| SOLMAR FM | sunny pop, 112 BPM |
| HARBOR 98 | late-night swing, 96 BPM |
| NEON NIGHTS | synthwave, 122 BPM |
| PALM DRIVE | sunset chillwave, 100 BPM |
| MIDNIGHT DRIVE | night cruise, 90 BPM, minor key |

All music is synthesized live with WebAudio — no audio files.

## Boats — 6 in the harbor

White runabout, orange skiff and blue cruiser at the marina; a red
speedboat (~1.45× top speed) off the docks; a slow white yacht (~0.85×);
and a yellow **jetski** (~1.6×, the fastest thing on the water). Press E
near a boat to board, E again to step ashore on the beach.

## Structure

```
game/
  index.html            page + canvas
  src/
    main.js             frame loop, screens, input wiring
    world.js            step() — the whole simulation
    city.js             roads, buildings, parks, landmarks
    render.js           all canvas drawing + HUD + minimap
    missions.js         M1–M5 + the mission engine
    missions2.js        M6–M8
    missions3.js        M9–M10
    missions4.js        M11–M12
    combat.js           gun, fists, gang AI
    police.js           wanted stars, cruisers, foot cops
    police2.js          roadblocks + police helicopter
    traffic.js          traffic cars + pedestrians
    boats.js            boats + sailing physics
    radio.js            5 synthesized stations
    audio.js            WebAudio sound effects + menu music
    sidejobs.js         taxi fares + Solmar Coins
    input.js            keyboard + mouse
    save.js             localStorage save / load
    config.js           every tuning number
    random.js           seeded RNG
    util.js             math + formatting helpers
    shots.js            staged screenshot scenes
serve.ts                dev server (localhost:8080)
main.ts                 make.fun hand-in entrypoint
shots.json              the 4 screenshot definitions
screenshots/            1-start, 2-city, 3-chase, 4-harbor
```

## License

MIT.
