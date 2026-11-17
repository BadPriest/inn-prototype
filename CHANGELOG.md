# Changelog

What changed in each build of the Travelling Inn prototype, newest first. The build number shows in-game (bottom of the map) and comes from `BUILD_NUMBER`.

From build 92 on, every build that changes the game gets an entry here, with the date it was built and whether it's deployed to the playtest site. Builds 21–91 were written up afterwards from the git history, so they're grouped where one change spanned several builds.

---

## Build 101 · Nov 18, 2026 · not deployed

### Added
- **Coin.** A purse in crowns, shillings and pence (10d = 1s, 10s = 1 crown), shown on the status card. Money is drawn as small turned coins in their metal (gold crown, silver shilling, copper penny), each with its count: on the status card, the bill of fare, the desk, the end-of-day screen and the pops over guests. A new keeper starts with 2 crowns; older saves get the same.
- **Guests pay** for what they ordered, always, however it went. **Tips follow the reaction:** a Delight tips about half the price again, Pleased a penny or so, anything else nothing. The coins rise beside the guest.
- **Unasked serves are on the house:** no charge, but a Delight or Pleased still tips.
- **Prices** come from the dish and what's in it: ale 4d, tea and coffee 3d, a serving of stew 6d, fried fish 7d, a fry-up 8d, a roast 9d (placeholders). Dearer ingredients (beef, bacon, cheese, lamb…) add a penny or two; a garnish adds a penny. They never inflate. The bill of fare shows each price.
- **House prices** on the desk: Cheap (a quarter off; a few more come in), Fair, or Dear (about a third more; a few fewer come in). Pick the card to switch.
- **Coin sounds** when a guest pays, a moment after their reaction. A Delight that tips has its own sound, and so does a tip. Otherwise it goes by the biggest coin: a few pennies, a handful from the purse, silver, crowns. A table paying at once clinks one after another.
- The end-of-day screen opens with takings, tips and what's in the purse.
- Debug: +1 / −1 crown.

## Build 100 · Nov 18, 2026 · not deployed

### Changed
- **The small tavern is the first choice** when a new game asks which inn is yours, and it's picked unless you choose otherwise. It's tagged "easiest start"; the big tavern is tagged "harder". Saves from before there was a choice stay in the big tavern.

## Build 99 · Nov 17, 2026 · deployed

### Changed
- **A serving goes back into any pot of the same dish**, made with the same ingredients, if that pot has room (fewer servings than it started with). Before, only the pot it came out of would take it. If its own pot is gone and the hob is free, it still starts a pot there. A pot that won't take it says why: it's full, or it was made with other ingredients.
- The desk's arrow and the "set the bill of fare" reminders stay until you press **Put it up**, even with the same bill. Picking dishes and closing the screen no longer counts.

## Build 98 · Nov 16, 2026 · deployed

### Added
- **The desk teaches itself.** Until you've set the bill of fare once, the desk glows and an arrow points to it ("Set the bill of fare"), in both views.
- The desk screen says what it's for ("Manage your business"). While the bill of fare isn't set, a warning sits over the cards and the Bill of fare card pulses.
- **Where each dish is made**, on the bill of fare cards: a pot on a hob, a pan on a hob, in an oven, the kettle, the coffee pot, the prep table, a barrel. Hover for the equipment that can make it.

### Changed
- **One button puts things down**: R (or Q), D-pad ↓ on a controller, 🫳 on touch. At the station a dish came from, it goes back there; anywhere else, a tray goes down on the nearest counter or table. △ is free while playing; the touch bar's ↩️ is gone.
- **Tended dishes come to you.** Fish, eggs, toast and a fry-up need you at the stove; when they're done they go straight onto your tray if there's room, and wait on the shelf if not.
- The "range" is called the **range stove**.

### Fixed
- Small tavern: a chair at the right-hand table stood off the table's corner.

## Build 97 · Nov 16, 2026 · deployed

### Added
- **A small tavern**, as an optional start. After picking where the inn stands, a new game asks which inn is yours: the big tavern (as before) or a small one. The small one has:
  - two four-seat tables and three stools at a short bar
  - a small fire and the gramophone
  - a one-hob stove, a kettle, one barrel of ale and the pantry
  - no oven and no prep table
  - a spare room let to a tenant
  
  Everything else can be bought at the desk and placed.

### Changed
- The bill of fare greys out dishes your kitchen can't make and says why ("needs an oven", "needs a barrel of cider"). Guests never order them, even if they're on a bill, so selling the oven can't strand an order.

## Build 96 · Nov 16, 2026 · deployed

### Changed
- **Two levels of tabs.** L1/R1 (Tab on the keyboard) switch the outer level; L2/R2 (PageUp/PageDown) switch the tabs inside it. On the bill of fare: L1/R1 switch between the all-day bill and meal times, L2/R2 between breakfast, lunch, dinner and between meals. This replaces build 95's single row. The pause screen and the equipment shop have one level, on L1/R1.

## Build 95 · Nov 16, 2026 · deployed

### Changed
- Bill of fare: **Tab** (L1/R1 on a controller) walks one row: All-day bill → Breakfast → Lunch → Dinner → Between meals → back. Stepping onto a meal switches to meal times; back onto the all-day bill switches back, and every bill keeps what's on it. Before, Tab did nothing on the all-day bill, and a controller couldn't change the mode at all.

## Build 94 · Nov 16, 2026 · deployed

### Changed
- Controller: **□ confirms** a screen (Cook, Put up…) without going to its button; **✕ picks** (an ingredient, a card, a list item), like Space.
- Controller: **D-pad ↓** puts a dish back, and **holding ↓** empties a pot. △ only sets a tray down.
- Controller: ○ no longer stops the keeper (letting go of the stick does that). ○ and □ are free while playing; ○ still goes back in menus.

## Build 93 · Nov 16, 2026 · deployed

### Added
- **Controller support** (PS5 DualSense, or any controller Chrome and Edge map to the standard layout).
  - **Playing:** left stick walks (all the way over, or R2, runs) · ✕ uses, like Space (hold to hurry or clean; garnishes at the counter) · ○ stops · L1/R1 pick between things in reach · △ sets a tray down, held △ empties a pot · D-pad ←/→ choose a card, ↑ plays it, ↓ puts a dish back · right stick zooms (↑↓) and turns the isometric camera (←→) · R3 switches the view · Options pauses · the touchpad opens the keys screen.
  - **Menus:** D-pad or left stick to move, ✕ confirms, ○ goes back or closes, L1/R1 switch tabs.
  - **Arranging the kitchen:** the left stick drives a cursor · ✕ picks up and places · ○ puts back or finishes · □ buys · △ another · L2 gets rid of the piece in hand.
- When a controller is in use, the prompts and the arrange banner show its buttons (✕, ○, △…) instead of keys.
- The keys screen (H) has a controller section.

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
