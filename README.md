# Travelling Inn: lofi prototype

You keep a small inn. Each day you wake at six, get the place ready, open the door, and look after whoever comes in: cook, pour, carry, serve, and slowly get to know people. This is a browser prototype for finding out whether that loop is fun. It uses basic shapes, plain menus and emoji, and the art comes later.

Playtest build: https://inn-prototype.vercel.app (password-protected). What changed in each build: [CHANGELOG.md](CHANGELOG.md). Where things stand right now: [docs/status.md](docs/status.md).

## Why it's built this way

- **It's about people, not speed.** Nothing burns, nothing is ruined, and nobody shouts at you. Guests do run out of patience eventually, but the pressure is gentle. The skill is in noticing what people like.
- **Tastes are hidden and learned by watching.** Everyone has likes and dislikes you can't see. You learn them from how a dish lands: delight, pleased, fulfilled, unfinished, complaints. Your journal records what happened, never the answer. Guests come in four kinds, by how readable they are: open, reserved, unformed and veiled.
- **The world drives what people want.** The time of day, the calendar season, the weather, and each guest's hunger, thirst and warmth decide what they order. Rain brings passers-by in and soaks them, and wet guests head for the fire.
- **Believable as well as fun.** Anything that breaks the illusion of a living inn gets fixed, like guests saying "Evening" at breakfast.
- **A prototype, not the game.** The finished game won't run in a browser. This one does so playtesters can open it anywhere. The final view is isometric, and it's the default here. Top-down stays for a while (press **V** to switch).

Design decisions live in [docs/design-session-journal.md](docs/design-session-journal.md) and [docs/design-session-journal_game-start_nov-15.md](docs/design-session-journal_game-start_nov-15.md); the sound design is in [docs/specs/sound.md](docs/specs/sound.md).

## How to play

1. **Morning.** You wake in your room at 6:00. The newspaper on the desk has the forecast and the town's news. At the **desk** ("manage your business") you set the **bill of fare** (what's on the menu today), buy equipment, and arrange the kitchen. Until you've put up a bill of fare once, the desk glows and an arrow points to it.
2. **Open up.** Light the fire, set out snacks if you like, and open the **front door**. The "Today" checklist on the side shows where to start.
3. **Take orders.** Guests sit at tables, on the benches, or at the counter, and order from your bill of fare. Each order becomes a **ticket** along the top of the screen. A matching numbered plaque floats over the guest. Its ring fills as their patience runs down.
4. **Cook and pour.** Cook at the stoves, ovens and prep table, and choose ingredients as you go. Pour ale and cider at the barrels. Make coffee by the pot and tea by the kettle (or the urn). Some dishes are single servings made for one guest; stew, porridge, roasts and bread come by the pot or batch; pies go to the pie safe and are sliced to order. Finished dishes wait where they were made until you pick them up.
5. **Carry and serve.** You have two trays, one in each hand. Walk to the guest and serve. Garnish drinks at the counter (lemon, honey, spice, mint). You can also offer someone something they didn't ask for, which is a gamble on their taste.
6. **Watch how it lands.** Each guest's reaction tells you a little about their tastes. Regulars come back over the days and reward getting to know them. Guests show by their role ("Miller's widow") until they trust you with their name.
7. **Keep the place nice.** Wipe tables, mop spills, keep the fire going and the lamps lit. Wind the gramophone for music.
8. **Close and sleep.** Close the door when you're done, see out the last guests, and turn in. The next day starts with a new paper.

Controls are listed in-game: press **H** (or the touchpad on a controller). A PS5 controller works in Chrome and Edge: left stick walks, ✕ uses, D-pad ↓ puts down (a dish back where it came from, or a tray; hold: empty a pot); in menus ✕ picks, □ confirms, ○ goes back. The keyboard and mouse basics:

| | |
| --- | --- |
| Click or tap the floor | walk (double-click runs) |
| Click a thing or person | go and use it |
| WASD / arrows, Shift | walk, run |
| Space | use what's in reach: serve, pick up, pour, cook (hold to hurry cooking or clean) |
| Tab | pick between things in reach |
| R (or Q) | put down: a dish back where you picked it up, or a tray on the nearest counter or table |
| X | empty a pot, urn or kettle |
| E · C | garnish · offer something unasked |
| Wheel or [ ] · V · , . | zoom · top-down view · turn the camera |
| J · K · O · P · H | journal · calendar · objectives · pause and settings · all the keys |

## What's in

**Your day.** One time of day drives everything. The game has four calendar seasons of 28 days, weekdays and years. At the start you pick where the inn stands (town centre, dockside, mountainside, crossroads or hill country), which reshapes the year, the weather and who passes by. Then you pick your inn: a small tavern (two tables, a short bar, one hob, one barrel; the easiest start, and the one picked unless you choose otherwise) or the big tavern (six tables, a long bar, an oven; busy enough to need staff). A morning newspaper brings the forecast, market days and town news, and there's a calendar screen. The clock stops whenever you're at the desk or in a menu.

**Guests.** There are four kinds of passers-by (dockworkers, scholars, travellers, farmhands) and six named regulars with their own schedules and roles (ten are planned). Guests have hunger, thirst and warmth, and orders grow from those needs. Their tastes are hidden, follow one of four schemas, and shift with the calendar season. They chat, talk about the weather, and react to what you serve. They wait with growing impatience and leave if left too long. Soaked guests seek the fire. When the rain stops, each guest decides whether to stay. You learn their names over time, and a journal keeps notes on regulars and visitors.

**Food and drink.**
- Breakfast: scrambled eggs, toast, a fried breakfast, porridge.
- Mains: stew, fried fish, salad, pie, roast, bread.
- Drinks: ale and cider on tap, coffee by the pot, tea by the cup or the urn, with garnishes.
- Snacks in bowls on the tables and the counter: peanuts, olives, pickled eggs, crostini, bread and butter, cheese, pretzels, chestnuts, pickled onions, apple rings.
- The bill of fare can be one all-day bill, or a bill per meal time. Each dish says where it's made (a pot on a hob, a pan, an oven, the kettle…). Dishes your kitchen can't make are greyed out, with what they need.

**Coin.**
- A purse in crowns, shillings and pence (10d = 1s, 10s = 1 crown), on the status card. You start with 2 crowns.
- Guests always pay for what they ordered, when it's served. Tips follow how it went (a Delight tips well, Pleased a little) and build up over the visit; they're paid all at once when the guest leaves (half, if they walk out on an order). Unasked serves are on the house, though a Delight still tips.
- Prices come from the dish and its ingredients and never inflate. One house-wide knob at the desk: Cheap, Fair or Dear, which also nudges how many come in.
- Equipment and goods cost coin. Upkeep and supplies are next.

**The kitchen.**
- Equipment to buy at the desk, for coin: order it and the carter brings it the next morning, or fetch it yourself while the inn's shut (you're out about an hour and a half). Delivered pieces wait to be placed; anything sells back for half. On offer: wood stoves with one or two hobs, a range stove (hob and oven), a bread oven that bakes two at once, a prep table, kettles, a copper kettle, an urn, coffee pots, ale and cider barrels, pie safes, wider trays, seasoned firewood.
- Arrange the kitchen any time. The clock stops, and what's cooking moves with the piece.
- Hobs take a pot or a pan. Tended dishes (fish, eggs, toast, a fry-up) need you at the stove, and go straight onto your tray when they're done if there's room. Put back what you picked up by mistake: a serving into any pot of the same dish made the same way, if it has room; a dish onto the shelf it came from. Empty a pot you don't need.

**The inn.** Light changes with the hour, the calendar season and the weather. The keeper lights the lamps when it gets gloomy and carries a candle at night. The other parts of the inn:
- a fire to light and keep going
- a gramophone with records and a spring that runs down (wound again, it carries on where it stopped)
- background music when the gramophone has been quiet a while
- crumbs and spills to clean
- a counter flap behind the bar
- a coat hall

**Sound.** Every action and event has a cue. Rain, wind, thunder, the street, the fire, the kettle and the stew all have their own sounds. The crowd's murmur follows the headcount, records play on the gramophone, and background music fills long silences. Volume sliders cover effects, music and background, and the sound fades in as the keeper wakes.

**Screen and settings.**
- Isometric view (top-down with V), with zoom and a turnable camera.
- Order tickets, readable speech plates, and a side panel with orders, trays and a log.
- A UI size slider, touch controls with a toolbar, controller support (PS5 or similar), and a keys screen (H).
- A debug view (`) for spawning guests and skipping time.

## Run it

**Easiest: double-click `standalone.html`.** Everything is packed into that one file. No install, no server. Good for sending to playtesters. It isn't kept in git (it's ~50 MB with the music): make it with `npm run build`, or download it from the playtest site at `/standalone.html`.

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
| `npm run deploy` | Builds, then deploys to Vercel production. Pushing to `main` deploys too. The site is password-protected via `middleware.js`; the password is the `SITE_PASSWORD` env var on Vercel. Add `-- --no-bump` to keep the build number |

The built `dist/` folder is committed, so a fresh clone runs with `npm start` without building; `standalone.html` isn't (Vercel builds its own on each deploy). Rebuild after changing anything in `src/`.

## Where things are

| Path | What |
| --- | --- |
| `src/data.ts` | **All authored content and tuning**: the map, tags, ingredients, recipes, snacks, garnishes, equipment, archetypes, regulars, locations, weather, light, sound choices, pacing. Edit this to tune. |
| `src/core.ts` | Organic randomness (centre + spread) and the event bus |
| `src/world.ts` | Tiles, furniture, equipment placement, seats, pathfinding (8-direction A* with smoothing, routing round guests) |
| `src/game.ts` | Shared state and types |
| `src/tastes.ts` | Scoring and the taste schemas (open, reserved, unformed, veiled) |
| `src/patrons.ts` | Arrivals, regulars, ordering, chatter, names, waiting, mess, leaving |
| `src/needs.ts` | Hunger, thirst and warmth |
| `src/weather.ts` | Weather states, rain and its effect on guests |
| `src/calendar.ts` | Dates, calendar seasons, weekdays |
| `src/newspaper.ts` | The morning paper |
| `src/crafting.ts` | Stations and their slots, cooking, pots, shelves, putting back, emptying |
| `src/serving.ts` | Trays, pickup, pouring, garnishing, delivery |
| `src/objectives.ts` | The "Today" checklist |
| `src/door.ts` | The front door |
| `src/day.ts` | Clock, meal times, open and close, turning in, saving |
| `src/interact.ts` | What Space (and R, X) do on each thing; crafting and journal menus |
| `src/sound.ts`, `src/sound/` | What plays when; the engine (loudness, placement, walls), loops, footsteps, crowd, fire, weather, gramophone, background music |
| `src/ui/render.ts` | The top-down view |
| `src/ui/render-iso.ts` | The isometric view (blocks sorted by depth, clicks that allow for height) |
| `src/ui/proj.ts` | Tiles to screen and back for both views, camera turning |
| `src/ui/` (others) | Light, tickets, side panel, menus and card screens (desk, bill of fare, shop, cooking, larder, trays), arranging the kitchen, calendar, newspaper, location picker |
| `src/gamepad.ts` | The controller: read each frame and turned into the same keys and clicks as the keyboard and mouse |
| `src/main.ts` | Input, settings, the pause and keys screens, the welcome screen and the main loop |
| `tools/` | The build (`build.mjs`), the standalone packer (`standalone.mjs`), the deploy (`deploy.mjs`) |
| `assets/sounds/` | Sound files, packed into `standalone.html` by the build |

Systems talk through the event bus in `core.ts` rather than calling each other directly where possible.

## Saving

Progress (day count, regulars, journal, daily history, bill of fare, kitchen layout) is kept in the browser's localStorage under `travelling-inn-proto-v3`. Settings (volumes, UI size, view, zoom) are kept separately. The debug view has a reset button.
