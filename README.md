# Palmera Bay: Street Heat

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Absaa00/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Absaa00/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). Everything in
it — the city of Palmera Bay, Marco Reyes, Madame Sol, the cars, the story,
the art and the music — is original. No Rockstar Games content.

## How to play

Open `game/index.html` in desktop Chrome. No build step, no network, no
libraries — pure HTML5 Canvas + vanilla JavaScript + procedural WebAudio.

You are **Marco Reyes**, back in Palmera Bay and in debt to **Madame Sol**.
Run her five jobs, pay the debt, and own the city.

## Controls

| Input | Action |
| --- | --- |
| WASD | Walk / drive (W gas, S brake/reverse, A/D steer) |
| Shift | Run on foot |
| E | Enter, exit, or steal a car |
| F | Punch |
| Mouse click | Shoot pistol (aim with the mouse) |
| R | Reload |
| M | Mute / unmute |
| Esc / P | Pause (save, restart mission, quit to menu) |

## Features

- **A living city**: a road grid of procedural buildings, a beach and
  boardwalk to the east, a harbor with docks and containers to the south,
  and a park with a pond at its heart.
- **On foot and by car**: walk, run, drive sedans, taxis, sports cars and
  trucks — or steal one. Steal in front of the police and your wanted level
  climbs.
- **Traffic & pedestrians**: AI cars follow the roads, pedestrians stroll
  the sidewalks and flee when scared.
- **Wanted 0–5 stars**: police cruisers chase and ram you, foot cops hunt
  you down. Lay low to cool off, or pay $150 at the green Spray Shop to
  clear your stars.
- **Missions & story**: five chained jobs — a delivery, three drops, losing
  a 3-star heat, wrecking rival Rico Vane's car, and the Big Score bank job —
  with objective markers, a banner, and minimap guidance.
- **Combat**: punch, pistol with ammo and reload, armed goons and bank
  guards who shoot back.
- **HUD + minimap**: health, armor, money, wanted stars, clock, speed,
  ammo, and a live minimap (mission gold, police red/blue, spray shop
  green).
- **Start screen, pause, game over, win screen, and saves** (localStorage
  autosave after every mission + manual save from pause).
- **Procedural sound**: engine hum, police siren, gunshots, pickups and a
  looping bassline — all synthesized with WebAudio, no audio files.
- **Polish**: skid particles, muzzle flashes, car explosions, screen shake
  and a damage flash.

## Structure

```
game/
  index.html        page shell (loads src/main.js, nothing else)
  src/
    main.js         game loop, state machine, save/load, player actions
    world.js        procedural city: roads, buildings, beach, harbor, park
    entities.js     cars, traffic AI, police AI, pedestrians, bullets, particles
    missions.js     the five-mission story chain
    audio.js        procedural WebAudio: engine, siren, shots, music loop
    render.js       canvas drawing: city, HUD, minimap, menus
    input.js        keyboard + mouse
```

## Entry program

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` with
the kit's `buildDossier`. Run it locally with:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/gta6-out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
