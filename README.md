# Solmar City — an open-world crime game

![Solmar City](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city.svg)
![Rank](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/rank.svg)
![Reward](https://make.fun/badge/gta6-01/GeMseN-Test/solmar-city/reward.svg)

Solmar City is a top-down open-world crime game in the browser. Steal cars, dodge the cops, run 12 story missions, sail the harbor, and take the crown of Solmar. Built for the [make.fun GTA6 bounty](https://make.fun) (`gta6-01`).

## What you do

- **12 story missions, $34,650 in payouts** — from M1 "First Wheels" ($200) to M12 "The Solmar Crown" ($10,000). Bank vaults, gang turf wars, dockside night runs, and a boat trip to Gull Island.
- **6 boats** — moored at the Marina and Docks, including a red speedboat, a white yacht, and a yellow jetski (the fastest). Press E near a boat to board, E again to step ashore.
- **5 radio stations (Q to cycle)** — SOLMAR FM sunny pop, HARBOR 98 late-night swing, NEON NIGHTS synthwave, PALM DRIVE sunset chillwave, and MIDNIGHT DRIVE night cruise. All synthesized live with WebAudio.
- **Taxi fares** — while driving, a waving passenger appears roadside. Pick them up and deliver them in 45 seconds for $80–$150.
- **12 Solmar Coins** — hidden gold coins on the streets, $25 each. HUD counts your haul.
- **Deeper police** — roadblocks at 3+ stars, a police helicopter with a spotlight at 4–5 stars. Wanted level decays: first star drops after ~12 seconds, then one every ~8 seconds.
- **Driving feel** — hold Space while driving for a handbrake slide with tyre smoke. Space on foot still punches.
- **Pickups, saves, and more** — cash, health, and ammo pickups on the streets; progress autosaves; 16 traffic cars and 34 pedestrians bring the city to life.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive (steer + throttle in a car) |
| Mouse | Aim, hold to shoot |
| Shift | Run |
| E | Interact — steal a car, board a boat, grab a crate or the vault |
| Space | Punch on foot, handbrake while driving |
| Q | Cycle radio station |
| M | Mute |
| P / Esc | Pause |
| Enter | Confirm / start |

## Run it

```bash
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies. `?shot=harbor&seed=1` stages the harbor screenshot scene (shot 4: M6 in a boat, radio on); `city`, `chase`, and `downtown` stage the other three shots.

## Screenshots

1. Downtown Solmar — M1 on foot in morning traffic.
2. Three-star police chase in a stolen car.
3. Bank district — M5, taxi fare waiting.
4. Harbor — M6 in a boat near Gull Island, radio on.

---

Made for the make.fun GTA6 bounty. Referral: `5c2wyg2x`
