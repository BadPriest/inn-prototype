# Travelling Inn prototype: where we are

Updated Nov 19, 2026 · build 110 (deployed) · https://inn-prototype.vercel.app

History by build: [../CHANGELOG.md](../CHANGELOG.md). What the prototype is and how to play: [../README.md](../README.md).

Tasks live on the Kanzo board, project **inn** (`inn#N` below), with what was done in each task's comments. Design decisions come from [design-session-journal.md](design-session-journal.md), [design-session-journal_game-start_nov-15.md](design-session-journal_game-start_nov-15.md) and [design-session-journal_economy_nov-17.md](design-session-journal_economy_nov-17.md).

## Done

- **Time and calendar**: one time of day for everything (#1); four calendar seasons, weekdays, years, "Spring is here." (#2); the starting location reshapes the year: town centre, dockside, mountainside, crossroads, hill country, picked on cards (#13).
- **Needs**: hunger, thirst, warmth, measured and logged (#3); orders grow from them, with a soft "full" (#15).
- **Weather**: states and rain intensity (#14); guests talk about it, weather tastes (#20); its sounds: rain, wind, thunder, the street (#26); soaked guests seek the fire (#21); rain brings people in and keeps them (#22); when it stops, guests decide whether to go (#23).
- **Screen**: the status card over the map (#29); pop-ups stay as they were (#31).
- **Playtest fixes**: steady location picker, pies wait on the oven, debug over pause, crowd volume (#32).
- **Decided**: 10 named regulars, not meant to be learned quickly; a small share also turn up at random (#12).

## In review (built and deployed; Bruno marks them done)

- #27 lighting (darker rainy days, lamps, the keeper's candle)
- #25 morning newspaper (forecast, market days, town news)
- #17 seasonal tastes
- #30 calendar (K, the desk, or click the status card)
- #33 counter: snack bowls for the stools, clearer bowls, kettle and coffee pot behind the bar
- #9 gramophone: horn and turntable tone; winding has a progress bar; the spring runs ~4 min (short for testing) and sags the record when it gives out (per [specs/sound.md](specs/sound.md))
- sound settings: Cues and Atmosphere volume, Music on/off (pause screen)
- #34 tea: boil the kettle for 2–4 cups; guests ask for a leaf or bean by name

## Built and deployed (Nov 19, builds 107–110)

- Builds 108–110: UI pass 1 (rules in [specs/ui.md](specs/ui.md)): cards with a drawer when pointed at; desk tidied to two balanced rows; House prices its own screen; Equipment with an Upgrades tab and "You have n"; bill of fare with a pinned header, 7 + 7 dishes; newspaper headings; crafting screens on one template (recipe cards, a result panel on top, ingredient cards, one button), steeping and garnishing too; cards grow in place when pointed at; desk cards down to name + one line

- Build 107: gramophone carries on where it stopped when wound again; background music after 90 s without music (six tracks); sounds for the desk and in-world menus (sitting down, papers, pen ticks, page turns, coins, the pause latch); The Last Candle jingle when turning in

## Built and deployed (Nov 18, builds 100–103)

- Builds 103–104: tips build up over a visit and are paid when the guest leaves (half on a walkout), with sounds by size (small tip, coin purse) and the Delight coins after a Delight

- #59 equipment costs coin: prices on the shop's cards; order (the carter brings it next morning) or fetch it yourself while shut; delivered pieces wait to be placed; sell back for half

- #58 coin: a purse in d/s/crowns; guests pay for orders, tips by reaction, unasked on the house; prices on the bill of fare; House prices (Cheap/Fair/Dear) at the desk; takings on the end-of-day screen

- The small tavern is the first and default choice of inn ("easiest start"); the big one is "harder"

## Built and deployed (Nov 16–17, builds 95–99)

- Build 99: servings go back into any pot of the same dish and ingredients with room; the desk reminder stays until "Put it up"

- Build 98 (Nov 16 playtest notes): one button puts things down (R/Q, D-pad ↓): back where a dish came from, or a tray on a counter; tended dishes go straight onto the tray; "range stove"; the desk glows with an arrow until the bill of fare is set, says "Manage your business" and warns while it isn't; bill of fare cards say where each dish is made; small tavern chair fixed

- #7 a small tavern as an optional start (pick it after the location); the bill of fare greys out what the kitchen can't make

- Two levels of tabs in menus: L1/R1 (Tab) the outer one, L2/R2 (PageUp/PageDown) the inner one. Bill of fare: all-day bill or meal times on L1/R1, which meal on L2/R2

## Built and deployed (Nov 16, builds 93–94)

- Controller support (PS5 or similar, in Chrome and Edge): playing, menus and arranging the kitchen with a cursor; prompts show the controller's buttons. In menus ✕ picks and □ confirms; D-pad ↓ puts back, hold ↓ empties a pot

## Built and deployed (Nov 16, build 92)

- Keys and controls screen (H, or Pause → Game); the side panel keeps a one-line hint, so the log has more room
- On a busy night the orders list scrolls in its own box (the tickets show every order), so trays and the log stay in view

## Built and deployed (Nov 16, builds 88–91)

- Equipment shop: tabs (Cooking, Drinks, Storage, Supplies), what you own first with a gold border and a count, fuel shown on each card (🪵 wood for stoves and ovens)
- Ale and cider barrels: buyable and movable like the rest (the two at the bar are now barrels too)
- Stations: Space always serves, picks up or cooks; when two things are ready (the range's hob and oven) you choose which. R puts back a dish picked up by mistake (only into the pot it came from, or its hob if that is empty now), X empties a pot to free the hob (touch: ↩️ and 🗑️ on the toolbar)

- Buy while arranging the kitchen: a Buy button (B) in the arrange banner opens the equipment without leaving; after placing something you bought, "+ Another" (A) hands you one more

## Built and deployed (Nov 15, build 87)

- #52 isometric view (the end goal; top-down stays the default for now): V or Pause → Display switches; blocks drawn in code, people as pawns, low walls except at the back. Zoom in both views (wheel, pinch, [ ]); turn the isometric camera (, and .). The wheel no longer picks between things in reach: Tab does
- #51 the keeper walks round guests; tables are easier to tap on tablets (deployed in 86)

## Built and deployed (Nov 15, build 85)

- #37 readable chatter: dark plates with tails, one voice per table, bubbles nudge apart; lines last as long as they take to read
- #42 bill of fare: all-day bill (default) or meal times, a tab per meal plus between meals (drinks only)
- #50 kitchen equipment: buy it at the desk (free for now), arrange it any time (the clock stops); two-hob stove, stove with an oven, copper kettle, urn; the pan is gone
- #48 breakfast (scrambled eggs, toast, fried breakfast, porridge) and roasts in the oven
- #49 pause screen tabs with volume and UI size sliders; sound fades in as the keeper wakes
- #43 guests show by role until they tell you their name; regulars by how open they are (Hedda takes a long while)
- #38 order tickets: upright cards along the top, the number plaque on the bottom border; the same ringed plaque over the guest, both counting down together to a walkout (the plaque replaced the order bubble)

## Next: the economy (from the Nov 17 session)

In build order. Each waits on the one it builds on.

1. ~~#58 coin~~ (built, build 101)
2. ~~#59 equipment costs coin~~ (built, build 102; secondhand moved to #66) · #60 upkeep you can see (licence, fuel, light, sundries, wear)
3. #61 supplies: stock that runs out, suppliers, the order slip on the desk
4. #62 deliveries: the carter, crates by the kitchen door (feeds #41, day two) · #63 shelf life · #64 ready-made goods
5. Any time: #65 hearth cooking (bake kettle) · #66 the tinker and breakdowns
6. Later: #67 equipment character and cookware · #68 the catalogue · #69 ideas not yet tasks

## Waiting on Bruno

### Design sessions (an agenda)

**#46 Economy and suppliers**: held Nov 17 ([journal](design-session-journal_economy_nov-17.md)), filed as #58–#69 (see "Next" above). Open from it:
- How progression is gated ("earn the chance, then buy it" isn't agreed; alternatives to come).
- Leftovers and reuse (its own session); room feel and reputation (its own spec); how Perks are structured.
- When exactly the tinker first visits; drink brands per category; fuel, light and sundries costs by weather and season.
- Still open from Nov 15: how many starter bundles and what's in them; which column of the equipment table the small start takes; bought or inherited.

**From the Nov 15 game start session** (#36 done in the journal; open questions left)
- #7 small start: built (builds 97, 100), in review. #11 starter set still open (kettle or coffee pot). #39 bill of fare marks: greyed with what's missing since build 97; filters not done.
- #40 day one prologue: card tutorial at turn-in or on waking, or after a long stretch of plain service?
- #44 permits and the inspector; #45 reputation and crowds.
- #47 holds the smaller seeds (keeper eats, pipes, board games, skills found, bathrooms…).

**#10 Snow, and how patron schedules work** (unblocks #18 schedules, then #28 more regulars)
- Snow: which calendar seasons and locations? Does it pile up and melt, or is it just weather?
- What snow does to guests: cold, soaked when it melts, fewer passers-by, snowed in overnight?
- How it looks and sounds inside (the windows, the door).
- Schedules: does a regular keep fixed days ("the ferryman every market day"), habits with exceptions, or both?
- Calendar season absences ("the ferryman scarce when the river freezes").
- How the keeper learns a regular's days, and how the calendar (#30) shows that.
- Already decided (#12): 10 named regulars, learned slowly; a small share also turn up at random. Still open: how often each one comes (a core most days?).

**#35 Songs have tags** (new idea)
- Which tags a record carries (mood, tempo, origin, a song from home?).
- How guests react: tap a foot, hum, ask for it again, complain, stay longer, leave sooner?
- Is music taste personal, by race (#4), or both? Do regulars have favourites they ask for?
- Does it change how long guests stay or what they order, or is it only for flavour?

**#4 Races have tastes**
- Which fantasy races are in the prototype?
- Each race's baseline tag pool; how far individuals depart from it.
- Which races are common in which location.
- How a guest's race shows on screen before there's art.

**#5 Mastery** (unblocks #16 skill slots; take after #36, which sets its direction: flavour comes from mastery, not from piling on ingredients)
- The dish categories.
- What practice changes: "early results a bit uncertain, later reliably better". Uncertain how?
- What earns a star, and what a star does (reputation, prices, guests who come for it?).
- Where you see skill and stars.

**#6 Acquired taste**
- "Oddness" isn't a value yet: what makes a dish odd to locals?
- What counts as exposure, and how those who already enjoy it help.
- Does it fade if the inn stops serving it?

**#8 Stove and oven rework**
- Which configurations: stove with an embedded oven, two stews at once, an extra hob for frying?
- How upgrades are bought or earned.
- Is the fuel (wood, coal, later electric) a system?

### Sounds

- **#19** a base loop per calendar season (spring birdsong, summer insects, autumn wind and leaves, winter hush), maybe varied by time of day
- optional: an outdoor storm loop (a storm through the open door uses the medium rain, louder)

## Parked

- **#24** roof leaks: no bucket yet
- fog: not for now
- storms cutting the power: needs electricity as a system first
- radio, coats in the coat hall, suppliers by calendar season, day length through the year, festivals: journal "Later"

## Picking up in a new session

- **Building** (Claude Code, in this repo): "read docs/status.md and the Kanzo board". Everything else is in the code, the git log and the task comments.
- **Designing** (the claude.ai Travelling Inn project): paste the agenda above for the topic, decide, and bring the result back as a journal like `design-session-journal.md` in `docs/`. Claude Code turns decisions into tasks from there.
