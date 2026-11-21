# Changelog

What changed in each build of the Travelling Inn prototype, newest first. The build number shows in-game (bottom of the map) and comes from `BUILD_NUMBER`.

From build 92 on, every build that changes the game gets an entry here, with the date it was built and whether it's deployed to the playtest site. Builds 21–91 were written up afterwards from the git history, so they're grouped where one change spanned several builds.

---

## Build 118 · Nov 21, 2026 · not deployed

### Changed
- **The stack of stages is real cards.** The older stages of an ingredient sit as cards behind the top one, each peeking out above it, slightly turned, with its band's colour showing (amber on the turn, rust stale). Turning the top card over leaves them where they are.
- **Recipe cards say it all on their face**: the picture, the name, then "~14 min · tended · 7 servings" over a rule; what always goes in as icons; the base choices as icons; "+ up to 2 extras"; on the menu or not (and who's waiting); the dish's flavour line; its tags at the foot. "Choose its ingredients" is gone. The back holds how it's made and what's in the pantry.
- **The desk speaks plainly.** Every desk card has its name (in title case), what you need to know now, a line on what it is in everyday words, and at the foot what picking it does ("Choose dishes and drinks →"). Bill of Fare says it's your menu and how many dishes are on it; House Prices shows the level and what it means (ale 4d a pint); Buy Supplies counts open orders not yet sent; Deliveries counts deliveries incoming, crates waiting and standing orders; Skills shows your level, points to spend and how close the next point is; the Journal counts new notes. Ten cards in two rows of five, no scrolling.
- **A flip tab instead of key hints**: the card picked up has a small ↻ tab just off its corner showing the key (F, or R3 on a controller) and "flip"; click it, right-click or press the key to turn the card over. The hint line no longer mentions it.
- **Cards lie flat until you tilt them**: no tilt by default; the sheen sits in the middle until the pointer or the right stick moves it.

### Fixed
- **A card's back is centred**: the name and the text panel sit in the middle of the card, not off to one side.
- **A turned card turns back** to its face when you move away from it.
- **Down on the D-pad always reaches the buttons under the cards** (Cook, Send it…), even while they can't be pressed yet. On the cook screen, Cook stays greyed until you choose a base, and down used to stop at the last row of ingredients.

## Build 117 · Nov 21, 2026 · deployed

### Added
- **Cards like playing cards.** Every card (the desk, cooking, supplies, the shop, the recipe book…) is printed card stock: a cream face in a thin printed frame, the icon in a dark art window, the name over a rule. Pointed at, a card lifts and tilts towards the pointer with a sheen moving across it; the one chosen with the keys or D-pad lifts and leans forward with a gold edge. A chosen card gets a red wax-seal ✓. The card picked up (grown under the cursor) shows its front and what picking it does, and **turns over** (F, right-click, or R3 on a controller) to its back, a latticed card back with the rest to read. On a controller the right stick tilts the card in hand.
- **Standing orders.** On a supplier's slip, "📌 Send it as a standing order" sends it and keeps it: each morning it's placed again for the supplier's next delivery day among its days, paid as it's placed (out-of-season lines are left off; if the purse can't cover it, that day's isn't sent and the log says so). A supplier can have several (milk every morning, an extra on Fridays). Their **📌 Standing orders** page shows one card each; pick one to change it on the same goods cards as the slip (−/+ change the standing order, not the slip), choose its days (📅, a tick for each of the supplier's delivery days), pause it (⏸: kept, nothing placed until you resume) or cancel it ("Cancel standing order"). What's already sent still comes. 📌 marks standing orders on the supplier's tab (⏸ when all are paused), the slips they place, the desk ("📌 Your standing order from Hollin's Farm"), the calendar and Deliveries.
- **Deliveries at the desk.** The desk's Supplies card is now **Buy Supplies**, and a new **Deliveries** card lists what's on its way, crates waiting at the kitchen door, and the last 60 deliveries (came with the carter, standing, fetched yourself, cancelled), each with what was in it and what it cost.
- **Cancel an order.** On Deliveries, an order on its way can be cancelled, for all your money back, until the supplier's order-by hour the evening before it comes (you're asked first). Its lines go back on the slip to change and send again; one placed by a standing order is skipped, and the standing order carries on.
- **Pie and bread on display can be ordered.** A guest can order pie if it's on the bill of fare or there are slices in the pie safe, and bread the same with the bread case, yours or the baker's.
- **A bowl that turns a taste says so on the table**: a small "sweet → bright" label under the bowl while there's some left, so you can tell without Innsight.
- **Xbox controllers.** An Xbox pad (or any controller that isn't a PlayStation one) works like the DualSense, and every prompt, button and the keys screen (H) name its buttons: A, B, X, Y, LB/RB, LT/RT, Menu, View. View opens the keys screen; so does Create on a DualSense.
- **Shelf life.** The pantry keeps each delivery as its own batch, and batches age from the morning after they arrive, by their ingredient's profile in `data/spoilage.json`: fish turns stale in a day and spoils in two, milk sours then curdles, meat and greens last a few days, butter and bacon a week, dry goods keep. Cooking takes the fresh first, and older batches only once the fresh runs out (and only at stages the dish allows: stale fish won't fry; bread pudding takes yesterday's bread first). A dish made with something stale is day-old (cheaper, and guests notice); sour milk makes it sour. Spoiled batches can't be used and stay on the shelves until you **clear out the spoiled** at the pantry, which now shows how each ingredient is keeping; pick an ingredient there to throw out what's past fresh. Waking says what's turned; ingredient cards say when the oldest is past fresh.
- **The baker's goods.** Pell the Baker sells a baker's pie (5d, six slices) and a batch of baker's bread (3d, eight slices). Carried in, they go into the pie safe or bread case and serve anyone who orders pie or bread, with one tag (homely): pleasant for most, a Delight for almost nobody. No recipe or oven needed; pie goes on the bill marked "the baker's". A slice sells for about a penny (what it cost x 1.4, `price.readyMade`).
- **Upkeep you can see.** Firewood (from the farm, 20 logs a cartload): the hearth burns 1.2 logs an hour while lit (more in winter or rain), each wood stove 0.6 while cooking; without wood the fire goes out and wood stoves stop, and the hearth shows the logs left. Lamp oil (0.15 pints an hour while the lamps are lit; without it they stay dark). Sundries (a little per guest; without them, tips halve). A licence of 140d every Monday. The end of the day shows what upkeep cost. **A red card under the objective** warns when one runs low (under about a day's worth), with what's left in hours of fire, hours of light or guests, and whether more is in a crate or coming with the carter; once one runs out it says "Out of lamp oil" and what that costs you, and glows. A new keeper starts with 140 logs, 8 pints of oil and 4 boxes of sundries (three or four days' worth); older saves get the same on loading. Rates in `economy.json` `upkeep`; placeholders.
- **Table snacks do things** while the bowl isn't empty and its tags suit the guest: roast chestnuts and apple rings make them wait longer; crostini and pickled eggs whet the appetite; salty bowls make them thirsty; bread and butter puts them at ease. Ale and cider loosen tongues too. **Pickled onions** (sweet tastes bright) and the **cheese board** (bitter tastes rich) change how a dish is judged; when that happens, a pill over the guest's head, above their reaction and under what they say, shows the old tag and turns over to the new one, glowing gold, then floats off; speech moves out of its way. Each snack's card says what it does.

- **First light**: a cue as the keeper wakes each morning, in a quiet room that fades back in after it. **Level up** has its own cue. **A pan sizzles** while anything made at a griddle cooks, as loud as the stew. First light is mixed softer than the service cues, a little above The Last Candle; the level-up cue matches the Delight chord.

- **No lamp oil means a dark inn.** When it gets gloomy inside and there's no oil, the room stays dark: passers-by come in at 0.4× the usual rate (the inn looks shut from the road) and guests wait 0.75× as long (`economy.json` `upkeep.lampOil` `darkFlow`, `darkPatience`; placeholders). The log says so as it happens.
- **Choose which batch goes in.** On the cook screen, each ingredient card has a coloured strip along its top saying which stage of it goes in: green FRESH, amber for past fresh but harmless (ON THE TURN, SOUR), rust for what costs the dish (STALE: day-old, −1 taste, sells for less). With more than one stage in the pantry, the other stages stack under the card (their colours show at its edge, also while it's grown under the cursor) with a count (2/3); Tab, R1 or the ⇄ on the strip brings the next to the top, and the top one goes in first. The dish panel shows what that does (fresh lit, or day-old). The card's drawer lists every stage in the pantry. Dishes that want old stock (bread pudding) start on the oldest. What "always goes in" still takes fresh first.
- **Fresh is a tag.** A dish made only from fresh stock carries **fresh**; anything on the turn takes it away, and it goes overnight. Some scholars like it, as some farmhands already could (`extraLikes`), and regulars can come to like it (it's in the taste pool).
- **Deliveries on the desk and the calendar.** The desk's Supplies card says "📦 A crate at the kitchen door" while one waits, or "🛻 Expected tomorrow" with whose order it is ("Your order from Hollin's Farm"). The calendar marks delivery days with 📦 (hover for who). A sent slip shows on its supplier's page as a signed slip with the day in big type and what's on it.

### Changed
- **Each supplier has pages**: 📝 Slip (the slip and their goods), 📌 Standing order and 🛻 On its way (n), the last two only when there is one, switched with L2/R2 or PageUp/PageDown, or clicked. The slip page no longer carries the standing order and the signed slips as banners above the goods.
- **Supply cards say less, more clearly**: the price and pack on one line, then "Pantry: 20 (fresh), 6 (on the turn), 3 (stale)", each stage in its colour (green, amber, rust, as on the cook screen). With more than one stage in the pantry, the card has the same stack under it. A counter across the foot, − 2 +, replaces the ✓ and "2 on the slip". The row of "− a sack of root veg" buttons under the slip is gone: take things off with the card's −, or △ / Delete. Opened up, a card says only what the thing is, in a line with a wink ("A whole bird, plucked and ready. Light, homely, and only slightly offended."): every ingredient has a `description` in ingredients.json. Under it, which of the recipes you know use it ("Goes into stew, porridge, tea and coffee."), or "None of the recipes you know use it." Salad greens are bright, not fresh: "fresh" is now only the condition tag.
- **The baker's prices.** A baker's pie costs 18d (six slices, about 4d each to a guest) and a batch of baker's bread 8d (eight slices, about 1.5d each); they were 5d and 3d.
- **The tag-flip pill is parchment, not gold**, since a flip isn't good or bad, just different: the bowl's icon and the old taste ease in, the old taste is struck through, and the new one follows an arrow in plum.
- **Out-of-season goods can't be ordered.** Apples, berries, walnuts, chestnuts, tomatoes, mushrooms, herbs and greens come and go with the calendar season (`seasons` in ingredients.json). Out of season, their cards are greyed at the end of the slip ("Only in summer", "Only in autumn and winter · back in autumn"). Copying last slip keeps them on, crossed out with "only in summer", and sending leaves them off. What's already in the pantry stays.
- **Turning in and waking are quiet**: background music and the room's ambience fade out fast for The Last Candle and for first light.
- **Deliveries pile up at the kitchen door**, one crate a morning, until you carry them in (one press takes the lot). Each crate's goods are dated the day it came, so a crate left waiting ages like anything else. The checklist says "Put away the delivery"; the desk says when one's due tomorrow.
- **A new keeper starts with 32 fish and 32 pints of milk** (was 84 and 80), so less rots on day 4.

### Fixed
- **The tutorial never picks itself up after a reload.** A save with the tutorial still going asks, after Continue, "Carry on with the tutorial?"; only Yes brings it back, and No drops it for good. Picked up, a step that needs the first guest (greet to eat) starts again from opening the inn, since that guest isn't in the save; before, it could resume on a step it could never finish.
- **✕ / Space on a card screen never presses a button you can't see selected**: it presses one only once the focus is down on the buttons.
- **The D-pad reaches every button on card screens.** Down from the last row of cards goes to the buttons under them (Fetch it yourself, the standing order, Tear it up, Copy last slip…); left and right move between them, ✕ presses one, up goes back to the cards. Before, a controller could only press the main button and the back button.
- **□ (X on Xbox) and Enter press the screen's main button** (Send it, Cook…) on card screens, instead of picking the card again. With no main button, they still pick the card.
- **The slip on Supplies** lists what's on it in tidy columns, with the total by the supplier's name; it had lost its styling and ran off the side.
- **Moving around a screen with the D-pad or arrows goes where you look.** Up and down go to the nearest card above or below, across sections and uneven rows. On Supplies, the two lists (for your bill, everything else) used to throw the cursor to the wrong card.
- **The calendar can be browsed.** The D-pad or arrows move a day at a time (up and down a week), and a line under it says what's on that day: the weather it had, market day, an order coming. Clicking a day does the same.
- **△ takes one off in menus** (a pack off the slip), as Delete does; the hint line in menus names the controller's buttons when one is in use.

## Build 116 · Nov 19, 2026 · deployed

### Added
- **A garnish board in the kitchen** for dishes (herbs, pepper, chives): in the small tavern's kitchen corner, and next to the prep table in the big one. The bar's garnish spot is now for drinks only; the wrong one tells you where to go.

### Changed
- **A finished objective's ✓ slides out from behind the card's right edge**, clear of the text, instead of stamping over it.

## Build 115 · Nov 19, 2026 · deployed

### Added
- **Guests bob as they walk**, like the keeper: in time with their footsteps, leaning a little the way they're going (in top-down, a slight swell mid-stride).

## Build 114 · Nov 19, 2026 · deployed

### Added
- **Levels.** Guests earn the keeper experience by how they took it: delighted 3, pleased 2, simply served 1. The first level takes 20, each after 14 more (about 5 levels in a 150-guest session). Each level is a point to spend in Skills. Placeholder curve, in `data/skills.json`.
- **Levelling up is celebrated.** A golden wave rises from the keeper's feet, then a gold "Level Up!" ribbon with the new level. The arrow points at the desk ("✦ New skills available") and the Skills card glows until you open it.
- **Knacks in Skills**, bought tier by tier on one card: **Quick hands** (wiping takes 0.8×, 0.65×, 0.5× as long) and **Charm** (every tip +1d, +2d, +3d).
- **A Dutch oven** (120d, Cooking): sits on a stove's back spot and bakes bread, pies and roasts at 0.6× speed. A roast on the small tavern's stove, early on.
- **Manage stove**: a tab on every stove menu (Tab or L1/R1) for its back spots. Take a kettle, coffee pot or Dutch oven off to the shelf, set a spare on, or swap one for another. Instant. A busy one waits; one with something left in it asks first. With every part busy, Space at the stove opens it.
- **Supplies come in a crate.** The carter leaves delivered supplies in a 📦 crate by the pantry; the arrow says "📦 Unpack supplies". Space (✕) next to it puts it all in the pantry. Fetching it yourself still goes straight in.
- **The arrow points at new things**: the desk for new furniture ("🛠 Place new equipment"), the stove for new gear ("🔧 Set out the Dutch oven"), each with an objective.
- **The tutorial ends** with a congratulations once the last step's done.
- **The wardrobe**: choose the keeper's coat and what's under it (the head), ten colours each. A new keeper wears slate blue over linen.
- **The keeper has two eyes** that blink, and **walking bobs** in time with the footsteps, leaning a little forward.
- **Progress bars say what's happening**: Cleaning…, Pouring…, Winding…, and Cooking…, Baking…, Boiling…, Brewing… or Preparing… at a station (on a multi-part stove, the part you're aiming at).
- **The garnish screen shows each drink's order plaque** and who it's for, and marks the garnish they asked for.
- Debug: **Level up** gives enough experience for the next level.

### Changed
- **A new keeper knows porridge, tea, coffee, stew, and bread and butter** (which needs a prep table); soup is learnt for 1 point.
- **Skills has tabs** (Drinks, Breakfast, Meals, Snacks, Knacks), and each recipe says where it's made and what your kitchen lacks for it.
- **Extras grey out** once a recipe's limit is reached, also when only one is allowed (take one out to pick another).
- **The trays beside the keeper only show with something on them.**
- **Controller glyphs** in menu buttons are drawn shapes, centred, beside the label; Resume is just "Resume".
- **The pause screen** says Toggle objectives, "keybind: H" and "Start Over?" (all your progress will be erased). Arrows and the controller move through it.

### Fixed
- **A wipe under way finishes** even if a guest at that table starts waiting to order.
- **Zooming with the right stick (and pinch) works** from 100%; it used to snap back.
- **Order plaque numbers are centred**, over guests and on tickets.

## Build 113 · Nov 19, 2026 · deployed

### Added
- **A tutorial, if you want it.** A new game asks "Play the tutorial?". Yes gives a guided first day in nine steps: the desk, the bill of fare, a pot of stew, opening up, a first guest (a patient traveller who comes for your stew), serving them, and buying a coffee pot. One step at a time shows on a card under the status card; a gold arrow and a soft ring point at where to go, and a gold ring lights the card or button to press in menus. Each step pays 10–30d (1 crown 40 in all), so the coffee pot never touches your starting purse. Wording and rewards are in `data/walkthrough.json`.
- **Objectives on screen.** Without the tutorial, the same card shows the next thing on today's checklist. A finished objective is stamped, shines gold and fades; its reward flies into the purse.
- **Money coming in shows by the purse** ("+5d"); payments close together add up.
- **A recipe book and Skills.** A new keeper knows porridge, soup, stew, tea and coffee (ale, cider and bought snacks need no recipe). Every 8 guests served earn a point; spend points on new recipes in **Skills** at the desk (1 point for simple dishes, 2 for bigger ones, 3 for the roast). Dishes you don't know say "learn it in Skills" on the bill of fare and don't show at the stove. Tuning in `data/skills.json`. Older saves know every recipe.
- **The pantry runs out, and Supplies at the desk.** Cooking, pouring, steeping, garnishes and bought snacks use stock. A Supplies card has a slip per supplier: pencil packs on, take them off with −, then send it for the carter (a few pence a morning) or fetch it yourself while the inn's shut. Goods your bill of fare uses come first, lowest stock first, saying which dish each is for and turning amber when low. A new keeper starts with about four busy days' worth of everything.
- **Start over** in the pause screen (Game tab), behind a confirm, so a controller can reset the save.
- **More dishes and kitchen pieces**: soup, fish cakes, and fish as a base for stew and pie; kettles and coffee pots sit on a stove's back; a tea urn kept from the kettle; a bread and pastry case; pots, pans and knives with better tiers; trays with 4, 6 or 8 slots. Table snacks include crostini, roast chestnuts, bread and butter and a cheese board, and garnishes suit their drink or dish.
- Debug: **Fill pantry** tops the pantry up to the starting stock.

### Changed
- **The isometric view is the default.** Top-down is still a press of V away.
- **Dish cards list what they take**: what always goes in, the base choices and the extras, with how much of each is in the pantry (amber when short).
- **Tab picks one part of a stove** (a hob, the kettle, the coffee pot), and Space works on just that part. **Hold F** (□ on a controller) to hurry what's cooking there; Space still hurries too.
- **Controller in menus**: □ presses the confirm button and ○ the negative one (Not now, Keep playing), each marked with its glyph while the controller's in use.
- **The small tavern starts with a used two-hob stove**, so porridge and stew can cook at once.
- **Prices are worked out from what goes in** (ingredients, the cook's time, a margin), so dishes cost what their choices cost.
- **Until you set the bill of fare**, waking says it's on its default (ale and cider), and so does the objective card.

## Build 112 · Nov 19, 2026 · deployed with build 113

### Changed
- **Everything on the bill costs 7% more.** Guests pay the exact amount, fractions of a penny and all, so it adds up over a day even on a 4d pint; the bill shows prices to the nearest penny (a roast now reads 10d, a fry-up 9d). One knob (`PRICE_MARKUP` in money.ts) for tuning.

## Build 111 · Nov 19, 2026 · deployed

### Changed
- **The rest of the kitchen's screens match the cooking ones.**
  - A station's choices ("What now?", "Put back which?", "Empty which?") are small cards with an icon and one line each, not a plain list.
  - **Snack bowls** show the bowl that's out at the top, with how much is left; each snack says whether it makes guests thirsty, and grows to say what it is and whether picking it tops up or swaps the bowl.
  - **The pie safe** is in headed sections (from the oven, in the safe, on your tray), with slices shown as dots and day-old pies marked.
  - Offering something unasked, the scrap bin, the kitchen hatch and setting a tray down lost their paragraphs and say what picking does ("Give it to Ana", "Throw it away"). The bin's button is now "Throw it all away".

## Build 110 · Nov 19, 2026 · deployed

### Changed
- **Cards grow when you point at them.** The card under the cursor, controller or mouse grows in place (a quick animation) and its description and what picking it does fade in inside it. This replaces the small panel that used to pop up beside it.
- **Desk cards are down to a name and one line**: the state ("Not set", "Fair", "Unread", "Autumn 1") or, with nothing to report, what's inside ("Information about patrons you served."). The rest shows when a card grows. The newspaper card is now "Today's Newspaper".

## Build 109 · Nov 19, 2026 · deployed

### Changed
- **Cooking screens all work the same way.** Choosing what to make at a stove, oven or prep table is now a row of cards: how long each takes (and whether you must stay with it), how many guests are waiting for it, whether it's on the board, and its tags. Point at one for what a batch makes and its description. Dishes guests are waiting for come first.
- **Building a dish shows the result first.** A panel at the top shows the dish as it will come out, with the tags your ingredients add lit up; below it, the ingredients in one row (point at one to see what it adds); then one button, **Cook**, **Bake** or **Boil**, that says what's still missing or who it's for. The recipe's description sits quietly under the title.
- **Steeping tea and garnishing a drink** use the same panel and cards: the cup or drink as it will be, who it's for, and what each leaf or garnish adds.

## Build 108 · Nov 19, 2026 · deployed

### Added
- **Cards say more when you point at them.** With the cursor, controller or mouse on a card, it lifts and a panel beside it says what it is and what picking it does. At rest a card keeps to the essentials: name, one fact (a price, a count), its state, and tags for food.
- **House prices has its own screen**: Cheap, Fair and Dear side by side, each with the price of a pint, how much it changes everything, and what it does to the number of guests. It used to step round silently on each press.

### Changed
- **The desk is tidier**: two balanced rows (bill of fare, prices, newspaper, calendar; then equipment, arranging, journal), every card the same height, each saying what's inside and how things stand ("Not set", "Fair · ale 4d a pint", "3 pieces"). The paragraph at the top is gone.
- **Equipment**: "Supplies" is now **Upgrades** (wider trays, seasoned oak). The tabs stay in place while you scroll; cards show the price and one line of status; what you own has a "You have 1" band. The long instructions are down to one line.
- **Bill of fare** is shorter: the mode switch, meal tabs, the band of the day and the meal's hours stay pinned at the top; the dishes sit in two even rows of seven, each with its price, where it's made and its tags. Dishes you can't make say what they need.
- Newspaper sections have a heading with a note: "Weather · forecasts may be wrong".

## Build 107 · Nov 18, 2026 · deployed

### Added
- **Background music.** After 90 seconds with no music, a background track fades in softly (over 6 s) and fades away over its last 8 s (clean, not through the horn, heard the same in every room), then quiet again before the next one, never the same track twice running. Winding the gramophone fades it out. It's on the Music volume. Six tracks: *Dawn in the Vale*, *A Day of Gentle Rain*, *A Rather Busy Morning*, *Beyond the Green Hills*, *The Long Road Ahead*, *Where the River Bends*.
- **The Last Candle**, a short jingle, plays as the keeper turns in and the screen fades to the day's summary. Any background track playing makes way for it.
- **The desk and the menus have sounds.** Opening the desk: you sit down, then shuffle the papers. The journal opens and its pages turn; tabs turn a page too (bill of fare, Equipment). The newspaper rustles open and folds up; the calendar flips; the bill of fare is picked up off the desk. House prices and buying or selling equipment clink coins. Arranging the kitchen taps the table as you start and as each piece goes down, and finishing plays the piano. Confirming in the in-world menus ticks a box with a pen (the bill of fare, cooking, snack bowls, the pie safe, garnishing, the bin, the hatch, setting a tray down, an unasked gift). Pausing opens a wooden latch, then everything goes quiet.

### Changed
- **The gramophone picks up where it stopped.** If the spring gives out mid-record, winding it again carries on from that point in the record, coming back up to speed over a moment (no needle drop: the needle never left). If the spring was spent as a record ended, winding it again plays the next record, not the same one over.
- The piano confirm now plays only for choices outside the world (where to start, which inn) and for finishing arranging the kitchen; putting up the bill of fare ticks a box, buying clinks coins.
- Behind the scenes: sound files are sorted into folders by what plays them (cues, menus, weather, ambience, fire, cooking, foley, gramophone, bgm, jingles). The unused finger snap is parked.

## Build 106 · Nov 18, 2026 · deployed

### Changed
- Tip sounds: the **Delight coins** if anything that visit delighted the guest; otherwise by size, **the coin purse** for 3d or more and the **small tip** sound below that.

## Build 105 · Nov 18, 2026 · deployed

No change: meant to bring back the Delight coins for tips, but the edit didn't make it in. Done in 106.

## Build 104 · Nov 18, 2026 · deployed

### Changed
- The tip, paid on the way out, plays the **coin purse** sound (not the Delight one). Orders keep their coin sounds by size; the coin purse is no longer one of them.
- **Walking out** on an order, a guest still leaves **half** the tip they'd built up: they may have been well served all evening.

## Build 103 · Nov 18, 2026 · deployed

### Changed
- **Tips are paid when a guest leaves**, all at once, not with each serve. Everything they meant to tip over the visit builds up, so a good visit ends on one bigger moment (and the tip sound, or the Delight one if any serve delighted them). Walking out on an order, they keep it. At closing time everyone still in settles up.
- Orders are still paid for at the table, when they're served.

## Build 102 · Nov 18, 2026 · deployed

### Changed
- **Equipment and goods cost coin.** Each card in the shop shows its price in coins, and greys out with how much you're short when you can't afford it. Prices (placeholders, tuned to the pacing targets): tea kettle 5s, coffee pot 8s, ale or cider barrel 6s, copper kettle 15s, pie safe 1 crown, prep table 1 cr 5s, tea urn 2 cr, wood stove 3 cr, two-hob stove 6 cr, range stove 12 cr, bread oven 15 cr; wider trays 1 cr, seasoned oak 5s.
- **Buying asks how:** order it and **the carter brings it tomorrow morning**, or **fetch it yourself now**, which takes about an hour and a half and only while the inn is shut and empty.
- What the carter brings **waits to be placed**: the desk's Arrange the kitchen card says how many, the morning checklist has a line for it, and arranging starts with the first one in hand ("Place what the carter brought", A or △, for the next). Esc sets it aside for later.
- **Delete sells** the piece in hand back for half its price (it used to just go to the shed). The end-of-day screen shows what was spent and sold back.
- What you start with is yours already, as before. No secondhand pieces yet: they come with the tinker.
- Debug: "Carter now" delivers today's orders straight away.

## Build 101 · Nov 18, 2026 · deployed

### Added
- **Coin.** A purse in crowns, shillings and pence (10d = 1s, 10s = 1 crown), shown on the status card. Money is drawn as small turned coins in their metal (gold crown, silver shilling, copper penny), each with its count: on the status card, the bill of fare, the desk, the end-of-day screen and the pops over guests. A new keeper starts with 2 crowns; older saves get the same.
- **Guests pay** for what they ordered, always, however it went. **Tips follow the reaction:** a Delight tips about half the price again, Pleased a penny or so, anything else nothing. The coins rise beside the guest.
- **Unasked serves are on the house:** no charge, but a Delight or Pleased still tips.
- **Prices** come from the dish and what's in it: ale 4d, tea and coffee 3d, a serving of stew 6d, fried fish 7d, a fry-up 8d, a roast 9d (placeholders). Dearer ingredients (beef, bacon, cheese, lamb…) add a penny or two; a garnish adds a penny. They never inflate. The bill of fare shows each price.
- **House prices** on the desk: Cheap (a quarter off; a few more come in), Fair, or Dear (about a third more; a few fewer come in). Pick the card to switch.
- **Coin sounds** when a guest pays, a moment after their reaction. A Delight that tips has its own sound, and so does a tip. Otherwise it goes by the biggest coin: a few pennies, a handful from the purse, silver, crowns. A table paying at once clinks one after another.
- The end-of-day screen opens with takings, tips and what's in the purse.
- Debug: +1 / −1 crown.

## Build 100 · Nov 18, 2026 · deployed

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
