# Travelling Inn: lofi prototype

A browser prototype for testing whether the inn's loop (craft, carry, serve, get to know people) is fun. Basic shapes, plain menus.

Design docs live in the claude.ai project ("Travelling Inn"): `design/prototype-lofi.md` and `design/prototype-sample-day.md`.

## Run it

**Easiest: double-click `standalone.html`.** Everything is packed into that one file. No install, no server. Good for sending to playtesters.

**From the source** (needs [Node.js](https://nodejs.org)):

```sh
npm install      # once: installs TypeScript
npm run dev      # builds, then serves at http://localhost:3000
```

Other commands:

| Command | Does |
| --- | --- |
| `npm run build` | Bumps the build number (shown in-game), compiles `src/` to `dist/`, and regenerates `standalone.html` |
| `npm run build -- --no-bump` | Same, but keeps the current build number |
| `npm start` | Serves the folder without rebuilding |
| `npm run deploy` | Builds, then deploys to Vercel production (password-protected via `middleware.js`; password is the `SITE_PASSWORD` env var on Vercel). Add `-- --no-bump` to keep the build number |
The built `dist/` folder and `standalone.html` are committed, so a fresh clone runs without building. Rebuild after changing anything in `src/`. For itch.io, upload `standalone.html` on its own (or `index.html` with `dist/`).

## Where things are

| Path | What |
| --- | --- |
| `src/data.ts` | **All authored content**: the map, tags, ingredients, recipes, garnishes, archetypes, regulars, schema settings and pacing. Edit this to tune. |
| `src/core.ts` | Organic randomness (centre + spread) and the event bus |
| `src/world.ts` | Tiles, furniture, seats, pathfinding (8-direction A* with smoothing) |
| `src/game.ts` | Shared state and types |
| `src/tastes.ts` | Scoring and the taste schemas (open, reserved, unformed, veiled) |
| `src/patrons.ts` | Arrivals, regulars, ordering, waiting, mess, leaving |
| `src/crafting.ts` | Stations, communal pots, single servings with names attached |
| `src/serving.ts` | Trays, pickup, pouring, garnishing, delivery |
| `src/objectives.ts` | The "Today" checklist, and noticing when an item gets ticked off |
| `src/door.ts` | The front door: opens when someone is in the doorway, closes once it's clear (drives the door sounds) |
| `src/day.ts` | Clock, open and close, turning in, saving |
| `src/interact.ts` | What Space does on each thing; crafting, garnish and journal menus |
| `src/sound.ts` | What plays when (listens to game events). Which file plays for what is `SOUNDS` in `src/data.ts` |
| `src/sound/` | `engine.ts` loads, evens out loudness, cuts footstep files into single steps, places sounds (distance, pan, walls); `loops.ts` kettle and stew; `footsteps.ts` a step per stride; `crowd.ts` taproom murmur by headcount; `fire.ts` the fire catching, roaring, settling and dying down |
| `assets/sounds/` | Sound files, packed into `standalone.html` by the build. `assets/sounds/questionable/` is parked: not used, not packed |
| `src/ui/` | Canvas rendering, side panel and debug view, menus. Card screens: `cards.ts` (shared pieces), `cook.ts` (cooking), `larder.ts` (snacks, pie safe), `trays.ts` (garnish, offer, bin, hatch, set down), `desk.ts` (desk, bill of fare, upgrades) |
| `src/main.ts` | Input, settings, the welcome screen and the main loop |
| `tools/build.mjs` | The build: build number, compile, standalone file |
| `tools/standalone.mjs` | Packs `index.html` and `dist/` into `standalone.html` |
| `tools/deploy.mjs` | The deploy: build, then `vercel --prod` |

Systems talk through the event bus in `core.ts` rather than calling each other directly where possible.

## Controls

Click floor: walk · click a thing or person: use it · double-click: run · right-click: stop · hold mouse or Space on a mess: clean · Tab or mouse wheel: pick between things in reach · WASD walk · Shift run · Space use · hold Space to hurry cooking · E garnish · J journal · M sound · P pause · − / = time speed · ` debug view

## Saving

Progress (day count, regulars, journal, daily history) is kept in the browser's localStorage under `travelling-inn-proto-v2`. The debug view has a reset button.
