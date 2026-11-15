# Changelog

What changed in each build of the Travelling Inn prototype, newest first. The build number shows in-game (bottom of the map) and comes from `BUILD_NUMBER`.

From build 92 on, every build that changes the game gets an entry here, with the date it was built and whether it's deployed to the playtest site. Builds 21–91 were written up afterwards from the git history, so they're grouped where one change spanned several builds.

---

## Build 92 · Nov 16, 2026 · deployed

### Added
- **Keys and controls screen**: press **H** (or Pause → Game → Keys and controls). It lists every key, grouped: getting about, using things, serving, arranging the kitchen, looking, the day.

### Changed
- The side panel's help is down to one line (Space, R, X, H), so the "What's happening" log has more room.
- On a busy night the Orders list scrolls in its own box instead of pushing the trays and the log off the panel. The tickets along the top still show every order.

## Build 91 · Nov 16, 2026 · deployed

### Changed
- A serving goes back (R) only into the pot it came out of, or onto its hob if that's empty now. A fresh pot of the same dish won't take it.

## Build 90 · Nov 15, 2026 · deployed in 91

### Changed
- **Space always serves, picks up, pours or cooks.** It asks only when two of those are possible at once (the range's hob and oven both ready).
- **R** puts back a dish picked up by mistake; **X** empties a pot, urn or kettle. On touch screens these are ↩️ and 🗑️ on the toolbar.

## Build 89 · Nov 15, 2026 · deployed in 91

### Added
- **Equipment shop tabs**: Cooking, Drinks, Storage, Supplies (Tab switches). What you own comes first, with a gold border and a count.
- **Fuel** on equipment, shown as a tag (🪵 wood on the stoves and ovens).
- **Ale and cider barrels** to buy and place. The two taps at the bar are barrels now, movable like the rest.
- At a station with several dishes ready, choose what to pick up, or pick up everything.
- Put back a dish picked up by mistake; empty a pot to free the hob.

## Build 88 · Nov 15, 2026 · deployed in 91

### Added
- While arranging the kitchen: **Buy** (B) opens the equipment without leaving, and **+ Another** (A) hands you one more of what you just placed.

## Builds 86–87 · Nov 15, 2026 · deployed

### Added
- **Isometric view**: V or Pause → Display switches between top-down and isometric. Blocks drawn in code, back to front, so the keeper passes behind tables and the counter. Walls are low except along the back.
- **Zoom** in both views: mouse wheel, pinch, or [ and ]. Each view keeps its own zoom.
- **Turn the isometric camera** a quarter at a time with , and .

### Changed
- The keeper walks round guests instead of getting stuck on them, and finds a new way if someone steps in front.
- Tables are easier to tap on a touch screen: a tap just off the edge counts.
- The mouse wheel zooms now; Tab picks between things in reach.

## Build 85 · Nov 15, 2026 · deployed

### Added
- Nooks in the kitchen wall, so kettles and coffee pots stand side by side behind the bar.
- A counter flap at the right end of the counter: the keeper's way through.

## Build 84 · Nov 15, 2026

### Added
- **Bread**, and the bread oven bakes two at once (bread, pies, roasts, in any pair).
- **Pie safes** to buy; they share the pies between them.
- More snacks: crostini, bread & butter, a cheese board, pretzels, roast chestnuts, pickled onions, dried apple rings.
- **Seasoned oak** firewood: everything heated cooks a little faster.

## Build 83 · Nov 15, 2026

### Added
- **Equipment** to buy at the desk (money's no object for now) and **Arrange the kitchen**: move any piece at any time, and the clock stops while you do. What's cooking moves with it.
- A two-hob stove, a stove with an oven (the range), a copper kettle, a tea urn. Hobs take a pot or a pan.

### Removed
- The separate pan station: hobs do pans now.

## Builds 79–82 · Nov 15, 2026

### Changed
- Snack bowls sit in the middle of long tables.
- Pop-ups fit the screen at any UI size, and their content scrolls.
- The desk, the bill of fare, the journal and the calendar stop the clock.
- Records and the fire are quieter by default.
- Card grids are centred, with room for the focus ring.

## Build 78 · Nov 15, 2026

### Added
- **Breakfast**: scrambled eggs, toast, a fried breakfast, porridge. **Roasts** in the oven.
- A **tabbed pause screen** (Game, Sound, Display) with volume sliders for effects, music and background, and a UI size slider.
- Sound fades in at the start of the day, as the keeper wakes.

## Build 77 · Nov 15, 2026

### Added
- **Meal times** on the bill of fare: one all-day bill (the default), or a bill per meal with drinks only between meals.
- **Names learned over time**: guests show by their role until they tell you their name; how soon depends on how open they are.

### Changed
- Chatter lasts as long as it takes to read, and gets cut short when someone at the table is waiting.

## Builds 74–76 · Nov 15, 2026

### Added
- **Readable chatter**: dark plates with tails; one voice per table; bubbles nudge apart.
- **Order tickets** along the top: upright cards with the order number on a plaque at the bottom. The same ringed plaque floats over the guest, and both count down together to a walkout.

## Builds 69–73 · Nov 15, 2026

### Added
- **The counter**: stools, snack bowls for the bar, a kettle and coffee pot behind it.
- **Coffee** by the pot, poured by the cup.
- **Tea by the kettleful**: boil once, steep a cup at a time with its own leaf; guests ask for a leaf by name.
- **The gramophone**: wind it, put a record on. The spring runs down and the record sags.
- Sound settings; the status page (docs/status.md).

## Builds 62–64 · Nov 14, 2026

### Added
- **Light and dark**: daylight through the windows by hour, calendar season and weather; lamps lit when it's gloomy; candles on tables; the keeper carries a candle; thunder flashes.
- **Seasonal tastes**: what people crave shifts with the calendar season.
- **The morning newspaper**: forecast, market days, town news.
- **A calendar** screen (K, the desk, or the status card).

### Fixed
- The location picker stays steady; pies wait on the oven until there's room in the pie safe.

## Builds 52–58 · Nov 14, 2026

### Added
- A **status card** over the map: date, time, weather.
- Thunder, wind and street sounds.
- **Orders grow from needs**: hunger, thirst and warmth decide what people ask for, with a soft "full".
- **Soaked guests seek the fire.**
- **Pick where the inn stands**: town centre, dockside, mountainside, crossroads, hill country. It reshapes the year, the weather and who passes by.
- Rain brings passers-by in and keeps them; when it stops, guests decide whether to go.

## Builds 44–48 · Nov 14, 2026

### Added
- **One time of day** for everything (greetings, cravings, flow, weather).
- **Needs** measured: hunger, thirst, warmth.
- **A calendar**: four calendar seasons, weekdays, years.
- **Weather**: states with transitions, rain with intensity that you can hear, guests who talk about it.

## Builds 37–43 · Nov 12–13, 2026

### Added
- One-button mouse: click to walk, click to use, double-click to run, right-click to stop.
- Station shelves: finished dishes wait where they were made.
- **Card screens** for cooking, garnish, offering, the bin, the hatch, setting a tray down, the desk, the bill of fare and upgrades.
- The urn pours with its own length and sound.
- The fire has a sound: it catches, roars, settles and dies down.
- `npm run deploy`, `--no-bump`, and Vercel builds from source on every push.
- The game pauses when its tab goes out of sight.

### Changed
- The piano confirm plays only on real decisions (the bill of fare, upgrades).

## Builds 21–30 · Nov 12, 2026

### Added
- **The first prototype**: the keeper's day from waking to turning in; guests who order, wait, eat, react and leave; cooking at stations; communal pots and single servings; two trays; garnishes; hidden tastes in four schemas (open, reserved, unformed, veiled); regulars and a journal; mess and cleaning; the "Today" checklist; sound.
- Table serves: reactions ring out one by one, with a breath between.
