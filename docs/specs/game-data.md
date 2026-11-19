# Game data in files (inn#71)

Nov 19, 2026. The game doesn't read these files yet; it switches over one area at a time. The files are in [data/](../../data/).

## Goal

Costs, prices, spoilage and as much of the economy as possible are kept in JSON files that can be edited without touching code. Each edit takes a rebuild and a reload. Ids must never change once saves depend on them.

## Editing the files

- Edit the files in `data/` in VS Code. Each one points to its schema in `data/schemas/`, so hovering a field shows what it holds, field names autocomplete, and mistakes are underlined as you type.
- The files hold data only. What each field means is in the schemas; plans, reasons and status go in this spec, the Kanzo ticket or a journal.
- `node tools/gamedata.mjs` (also run by every build) checks each file against its schema and the files against each other: unknown ingredients, suppliers or equipment, duplicate ids, ids that aren't camelCase, impossible picks, seasons that don't add up to 112 days. It refuses to build until they're fixed, then writes `src/gamedata.gen.ts` for the game.
- After an edit, rebuild and reload.

## Files

| File | Holds | Status |
| --- | --- | --- |
| [economy.json](../../data/economy.json) | price formula knobs (markup, margin, prep per minute, per serving), house levels, tips, purse, sell-back | draft |
| [spoilage.json](../../data/spoilage.json) | stage effects (fresh, on the turn, stale, spoiled) and named profiles (daily, bread, meat, cooked pot…) | draft |
| [ingredients.json](../../data/ingredients.json) | each ingredient: unit, worth, tags, roles, spoilage, seasons | draft, about 35 of them |
| [dishes.json](../../data/dishes.json) | each dish, drink and table snack | draft: 9 dishes and drinks, 10 table snacks |
| [equipment.json](../../data/equipment.json) | crafting pieces, storage, gear, utensils, trays | draft: 5 crafting, 5 storage, 4 gear, 6 utensils, 3 trays |
| [suppliers.json](../../data/suppliers.json) | who sells what in what packs, price factor, delivery days and cut-off, fetching it yourself | draft, 9 suppliers |
| [locations.json](../../data/locations.json) | starting locations: calendar, weather, traffic, visitors, and their suppliers with overrides | draft, all 5 |
| supplies.json | fuel, candles and lamp oil, sundries: things used up that aren't food | with #60 |

## Decisions (Bruno, Nov 19)

- **Three kinds of ingredient in a dish.** All three use up stock.
  - **Fundamental:** without it the dish can't be made. Either a *role* (a liquid: water, stock or cooking ale; a cooking fat) or one exact ingredient (oats for porridge).
  - **Base:** what the dish is built around: a *beef* stew.
  - **Optional:** what makes it better.
- **Spoilage stages** each add or remove tags and set a price factor and a taste penalty. Stale bread does *not* turn into bread pudding. Instead the pudding takes bread that is on the turn or stale: an ingredient can name the spoilage stages it accepts.
- **Everything spoils**, ingredients and dishes alike. Each item names a profile and can override any stage on its own line. Change one profile and everything that uses it follows.
- **Two seasons:** when a dish is *craved* (it's on the dish), and when its ingredients *can be had* (on each ingredient, so the dish's availability follows from them).
- **Price is worked out, with an optional fixed price that overrides it.** Setting prices per dish is a question for later.
  `price = (ingredient cost + prep + per serving) × (1 + margin, plus perks) × (1 + markup) × house level × staleness factor`
- **Pack size belongs to the supplier**, not the ingredient. An ingredient's *worth* is what dish prices are worked out from, so a price doesn't change with the shop you used. A supplier charges its own factor on that worth.
- **Markup is 0.07** (+7%), on top of a base margin of 1.0. It is the one knob that moves every price at once. Suppliers get the same kind of knob, plus a part that changes in play (relationship, perks).
- **The keeper has a recipe book**, saved with the game: the dish ids they know. The start (inn, location, starter bundle) gives the first book, and perks, cards, regulars and cookbooks each say which dishes they add. Dishes carry no unlock field. Until those givers exist, the book holds every dish.
- **A dish's availability comes from its ingredients' seasons.** There is no separate field for it on the dish.
- **Spoilage stages default to fresh, on the turn, stale, spoiled.** A profile can name its own stages instead (milk: fresh, sour, curdled; ale: fresh, flat, spoiled).
- **No food/drink kind.** It's replaced by two fields:
  - `traySlots`: how many tray slots one serving takes (a cup 1, a bowl 2, a platter 4). A tray holds so many slots, and better trays hold more.
    - The keeper carries two trays, one in each hand. Trays hold 4, 6 or 8 slots (plain, then two upgrades). A plain tray holds 4 ales or 2 bowls, the same as today.
    - A tray takes food and drinks together. Today's rule of one or the other per tray goes.
    - Larger trays can hold more, and may slow the keeper down when loaded (idea, not decided).
  - `pickUp`: how it's taken from the station (ladle, pour, slice, take). This sets the prompt and the pouring.
- **What a guest orders it for** comes from its largest need in `effects.needs`. Soup eases thirst a little, but nobody orders it when thirsty.
- **Anything can be served anywhere**, a soup at the counter included. The game's "stools get drinks only" rule goes when this is wired in.
- **One margin for every dish.** The flat charge is per tray slot (0.5d), so a bowl carries more than a cup.
- **Equipment comes in two types.** Crafting pieces (stoves, ovens, prep table, kettles, coffee pot) have slots, a crafting speed and fuel. Storage pieces (pie safe, barrels, urn) hold finished dishes and serve them by the dish's `pickUp`.
  - **Gear** (kettles, coffee pots) is set on a stove's "Hot drinks" slot when arranging, and shows there. Each stove and the range has 2 of those slots (the bread oven has none). Without a stove there is no tea or coffee, until electric kettles.
  - **Utensils** (pots, pans, knives) are never placed: a slot uses the best one you own. A bigger pot adds servings to every batch; a better pan or knife crafts faster.
  - **Upgrade lines:** gear, utensils and trays each name a `line` and a `tier` (the copper kettle is `kettle` tier 2, and keeps its name).
  - **`serveSeconds`** on a storage piece: how long taking one serving out takes. Barrels 3 s a pint, the urn 2 s a cup, as today; a better tap could pour faster.
  - **The bread and pastry case** keeps bread (pastries once they exist), as the pie safe keeps pies.
  - **The urn is a tea safe:** tea is brewed at the kettle and kept hot in the urn. Today the urn brews its own; that changes when this is wired in.
  - **Barrels are storage** that hold ale or cider. Ale and cider are bought in for now; brewing comes with cellars. Barrel capacity in pints comes with supplies (#61).
  - **`shape`** is written as rows, so an L is `["##", "#."]`. The code handles rectangles only until an L-shaped piece exists.
  - **Fields for later** (fuel per hour #60, health and wear #66, tags a piece adds #67) are added when each lands.
  - **Equipment ids are camelCase** (`woodStove`, `pieSafe`). The loader maps the old ids (`stove1`, `piesafe`) for existing saves.
- **Suppliers:**
  - `inventory` is what they carry. How much they have on a given day would be game state; suppliers running short is held for now (seasons already make things scarce).
  - Pack prices are worked out (worth × units × the supplier's factor × the economy-wide supplier factor), never written per line.
  - `distanceInMinutes` is the whole time away, there and back.
  - **The carter charges one fee per morning he brings orders** (3d in economy.json), however many crates. Fetching it yourself saves it.
  - The carter's own inventory (wood, coal) comes with upkeep (#60). The tinker sells secondhand at half price when he visits (#66).
  - The catalogue keeps today's "fetch it yourself" for equipment: 90 minutes away.
  - Supplier and people names are placeholders.
- **Locations list their suppliers**, and any entry can override that supplier's fields there. A supplier being "strong" somewhere means better numbers there: a lower `priceFactor`, a shorter `distanceInMinutes`, more `deliveryDays`, more in `inventory`. Example: `"dockside": { "suppliers": [ { "id": "fishmonger", "priceFactor": 0.85, "distanceInMinutes": 20 } ] }`. Locations get their own file, locations.json.
- **Table snacks are dishes** (`tableSnack: true`, `container: "table"`), set in a bowl on a table on the house. Guests don't ask for them and they don't spoil. A bowl is refilled only once it's empty.
  - **`boughtAs`** names the ingredient a dish can be bought as, ready to serve straight from stock. All ten snacks can be bought; crostini (the baker) and roast chestnuts (the general store) can also be made.
  - **Made only:** bread and butter, cheese board. **Bought only** (no `ingredients`): salted peanuts, olives, pickled eggs, pretzels, dried apple rings, pickled onions.
- **Effects** a dish or table snack can have: openness, patience, hunger, thirst, and flipping a tag (`sweet` counts as `bright`). Each can carry a `shown` line. All are in the files now; only thirst is in the game so far. A flip shows as a pill badge with the tag that flips over to the new one (inn#74).
- **Garnishes are ingredients** with the `garnish` role and a `garnishFor` list of containers: lemon wedge, mint and spice for a glass or cup, honey for a cup or bowl, pepper and herbs for a bowl or plate. A dish that takes one has an optional `garnish` field, and is offered the garnishes that fit its `container` (cup, glass, bowl, plate). The role gives the order slip a Garnishes heading. There is no garnish file.
- **Seasoned oak is dropped.**
- **No goods file.** What you own is in equipment.json: placed pieces, gear, utensils, and trays (plain 4 slots, owned from the start; wider 6; large 8). What you use up is in ingredients.json, and supplies.json once upkeep (#60) is built.
- **Ale raises the guest's openness** for the rest of the visit, so regulars open up sooner. An effect can carry a `shown` line for the dish's card; without one it stays hidden.
- **Ids** are lowerCamelCase names (`friedFish`), one per dish. A fish stew is `stew` with fish as its base, not a dish of its own.
- **Text** covers the station blurb, the journal entry, and what guests say when ordering, praising or complaining.

## What the drafts work out to

These come from [data/](../../data/) at Fair. Each dish shows its cheapest and dearest choice of ingredients.

| Dish | Cheapest | Dearest | Today |
| --- | --- | --- | --- |
| Stew | 3.5d (roots, onion, herbs) | 6.2d (beef, roots, mushroom) | 6d |
| Porridge | 3.9d | 4.1d | 3d |
| Pie | 4.5d (apple) | 6.1d (beef) | 6d |
| Fried fish | 9.6d | 10.5d | 7d |
| Bread | 2.3d | 2.5d | 2d |
| Bread pudding | 5.7d | 6.2d | new |
| Tea | 3.5d | 4.2d | 3d |
| Ale | 4.5d | 4.5d | 4d |

Working prices out means a vegetable stew sells for about half the price of a beef one. That is the honest result of the formula.

## Notes on the draft values

- With one margin, ale comes out at 4.5d. Its worth (1.6d a pint) is the number to lower if a pint should stay 4d.
- Markup is the knob for pacing. Raise it if the player progresses too slowly, lower it if too fast.
- Tended minutes cost more than untended ones because they take the keeper's attention. Untended minutes cost only fuel.
- The charge per tray slot (the bowl, the cup, carrying it out) keeps a cheap dish from being nearly free.
- Stock would come from bones and scraps, as one of the leftover routes.
- Ale is bought by the barrel. A tapped barrel follows the openedKeg profile.
- Fried fish needs a fishmonger, so only dockside starts would have it once suppliers exist.
- Bread pudding's unlock by the perk "waste-not" is a placeholder: perks don't exist yet.
- Spoilage profiles and what uses them: daily (milk, cream, fresh fish); bread; meat; greens (greens, berries, herbs); week (butter, soft cheese, opened cider); weeks (eggs, roots, apples, hard cheese); keeps (flour, oats, salt, tea, sealed kegs); openedKeg; cookedPot (stew, porridge, soup); cookedPlate (a plate left on the shelf); baked (pies, bread, cakes); brewed (a pot of tea or coffee).
- Deliveries don't start ageing until the day after they arrive (journal, Nov 17).

## Open

- **Margin and markup:** they are multiplied here, not added. Is that right?
- **Water:** free and never runs out? The draft has it at 0d.
- **Prep cost:** should hob and oven minutes count the fuel actually burned, once fuel is upkeep (#60)? That would make prep cost the same thing as fuel.
- **Relationship with a supplier:** getting to know one could bring better prices, specials, offers you wouldn't otherwise see, or recipes (a supplier as one more giver for the recipe book). The details are still to figure out; no field until then.
- **Bundles (#41):** still to decide.
