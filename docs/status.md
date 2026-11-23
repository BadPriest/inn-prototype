# Travelling Inn prototype: where we are

Updated Nov 23, 2026 · build 122 (deployed) · https://inn-prototype.vercel.app

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

## Built, not deployed (Nov 23, build 123)

- #81 wear: a share of takings and tips per messy guest (0.4%, up to 10%), listed as mishaps in the tally; Keen eye knack
- #65 hearth cooking: hooks over the fire (1/2/3 by tier), hanging pot, cooks while lit; stoves in three tiers (1+1, 2+2, 2+2+oven); shop sorted into six categories by line and tier
- #66 (1 of 3) equipment wears in: levels at 100/250/500/900/1,500 servings, a trait each (speed, servings; tastes rare, from level 4, hardware-only tags by piece kind; guests sometimes love them); Manage tab on everything that cooks

## Built and deployed (Nov 23, build 122)

- Build 122: Skills recipe cards show name, cost, where, what it is, tags and what it earns; backs list basic ingredients only; knacks as a stack with the next level on top; flipped cards no longer show a duplicate underneath

## Built and deployed (Nov 22, builds 119–121)

- Build 121: card screens on one component (title, subtitle, tabs, summary, cards, at most confirm / alternative / cancel); supplies: Send order… (delivery, fetch, standing), copy last / clear; standing order Done + Pause/Resume, days and stop as cards; cook button names the guest; D-pad down fixed at large UI sizes

- Build 120: #90 Innsight (L2 / Alt; R2 debug layer); #92 per-visitor tastes, Delights 46% → 12% in an autopilot week; end-of-day tally as three placards; controller card screens (D-pad on the cards, □ ○ △ L3 touchpad Create for the buttons), Fetch it yourself back as a button; one card shape, two sizes, long text on the back; firelit dish cards; Skills cards show the points; morning guide desk → crates → stove; stronger highlights; crates in a kitchen corner; Today list toggle only hides the log list; new welcome screen

- Build 119: Dear lets in 70% of guests (was 90%); the autopilot keeper (`tools/sim/run.mjs`) runs a week of the real game and reports money, guests by hour and the delight rate. First week, town, Fair: about 38s net a day (targets 4–9s), 45 guests, keeper busy a third of the time, mornings nearly empty, 2–4 groups an hour turned away at 6–9 pm, Delights 46% picking at random and 56% repeating what worked.

## Built and deployed (Nov 21, builds 117–118)

- Build 118: the stack of stages as real cards; recipe cards with everything on the face; a flip tab; cards lie flat until tilted; desk cards rewritten in plain words with the facts that matter; D-pad down always reaches the buttons

- Build 117: #63 shelf life (batches by delivery day, stages from data/spoilage.json, clear the spoiled); #62 crates pile at the kitchen door and keep their date; #64 the baker's pies and bread; #60 upkeep (firewood, lamp oil, sundries, weekly licence; wear still to design); #74 table snack effects with the tag-flip badge; #80 the badge above heads; #77 a red low/out card for upkeep goods; #83 the new sounds set against the mix; no lamp oil makes a dark inn (fewer come, none stay long); out-of-season goods off the slip (a copied slip crosses them out); deliveries on the desk, the calendar and a signed slip; #78 steps 1–2: pick the stage on the cook screen (labelled strip, stacked deck, Tab shuffles) and a fresh tag on all-fresh dishes; standing orders (📌); #79 pie and bread on display can be ordered, baker's prices 18d / 8d; #80 the flip pill in parchment and a label under flip bowls; supply cards reworked (counter, pantry by stage); □/Enter press the main button; calendar and supplies navigation on the controller; Xbox controllers; cards like playing cards (#91: card stock, tilt and sheen, lift, a back to turn over to); the test pantry removed (#89)

## Built and deployed (Nov 19, builds 107–116)

- Builds 115–116: guests bob as they walk, like the keeper; a garnish board in the kitchen for dishes (the bar's spot for drinks); the objective ✓ slides out beside the card

- Build 114: #75 levels (experience by reaction, rising curve) with a level-up wave and banner, Skills tabs and knacks (Quick hands, Charm), new starting recipes; Dutch oven + Manage stove tab; #62 supply crates to unpack; arrows for new gear and equipment; tutorial ending; wardrobe (coat and under); keeper eyes, blink and walking bob; progress-bar labels; garnish plaques; fixes (wiping, stick zoom, extras greying)

- Builds 112–113: #71 game data in files (prices worked out from ingredients, +7% markup), isometric default, #61 supplies and a 4-day starting pantry, #75 tutorial with rewards and on-screen objectives, recipe book + Skills, dish cards list ingredients, Tab picks a stove part + F hurries, Start over, □/○ in menus, two-hob small tavern

- Builds 108–111: UI pass 1 (rules in [specs/ui.md](specs/ui.md)): cards with a drawer when pointed at; desk tidied to two balanced rows; House prices its own screen; Equipment with an Upgrades tab and "You have n"; bill of fare with a pinned header, 7 + 7 dishes; newspaper headings; crafting screens on one template (recipe cards, a result panel on top, ingredient cards, one button), steeping and garnishing too; cards grow in place when pointed at; desk cards down to name + one line; station choices, snack bowls, pie safe, bin, hatch, unasked offer, tray set-down on the same template

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

- #52 isometric view (the end goal, and the default view since build 113; top-down stays for a while): V or Pause → Display switches; blocks drawn in code, people as pawns, low walls except at the back. Zoom in both views (wheel, pinch, [ ]); turn the isometric camera (, and .). The wheel no longer picks between things in reach: Tab does
- #51 the keeper walks round guests; tables are easier to tap on tablets (deployed in 86)

## Built and deployed (Nov 15, build 85)

- #37 readable chatter: dark plates with tails, one voice per table, bubbles nudge apart; lines last as long as they take to read
- #42 bill of fare: all-day bill (default) or meal times, a tab per meal plus between meals (drinks only)
- #50 kitchen equipment: buy it at the desk (free for now), arrange it any time (the clock stops); two-hob stove, stove with an oven, copper kettle, urn; the pan is gone
- #48 breakfast (scrambled eggs, toast, fried breakfast, porridge) and roasts in the oven
- #49 pause screen tabs with volume and UI size sliders; sound fades in as the keeper wakes
- #43 guests show by role until they tell you their name; regulars by how open they are (Hedda takes a long while)
- #38 order tickets: upright cards along the top, the number plaque on the bottom border; the same ringed plaque over the guest, both counting down together to a walkout (the plaque replaced the order bubble)

## Next: the epics for a true vertical day (Bruno, Nov 23)

Get in what the big epics are missing, then polish and iron out.

- **Finish the economy (ready to build):** #81 wear as a line in the end-of-day tally; #66 the tinker, used hardware, equipment that earns tags, breakdowns and repair; #65 hearth cooking and the hardware shop in tiers
- **Epics:** #100 finalise seasonal weather · #101 mood · #102 taproom card game · #103 taproom activities · #104 placing furniture · #56 staff · #44 expansion · #105 events · #45 reputation and its effects
- **Later:** #87 advanced cooking (takes time); guests are good enough for now; day bookends (#40, #41) are for the future
- **Design session this week:** graded Delights (#92)

## Next: the economy (from the Nov 17 session)

In build order. Each waits on the one it builds on.

0. **#71 game data in files** (in progress): costs, prices, dishes, equipment, suppliers and locations in [data/](../data/), checked by every build ([spec](specs/game-data.md)). The game reads economy, locations, equipment (kettles on the stove, the urn kept from the kettle, the bread case, utensils, trays with slots), dishes with worked-out prices, table snacks and garnishes from it. New dishes: soup, fish cakes, fish stew and fish pie. Deployed in build 113.

1. ~~#58 coin~~ (built, build 101)
2. ~~#59 equipment costs coin~~ (built, build 102; secondhand moved to #66) · ~~#60 upkeep~~ (built; wear still to design)
3. ~~#61 supplies~~ (built, build 113): the pantry runs out; a Supplies card at the desk with a slip per supplier, sent for the carter or fetched yourself
4. ~~#62 deliveries~~ (crates pile at the kitchen door; the carter in the world still waits on sounds) · ~~#63 shelf life~~ · ~~#64 ready-made goods~~ · ~~#74 snack effects~~
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
