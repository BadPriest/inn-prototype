# UI rules

How menus and card screens are built, so every screen reads and handles the same. Decided with Bruno, Nov 19, 2026, after his notes on the desk, bill of fare and shop: too wordy, flavour drowning what matters, unbalanced layouts, inconsistent screens.

Code: `src/ui/menu.ts` (the frame), `src/ui/cards.ts` (cards), styles in `index.html`.

## Two shapes of menu, and nothing else

Decided Nov 22, 2026: every screen is built from one of these, so nothing has to be hunted for screen by screen.

- **Card screens** (`CardScreen`, opened with `openMenu`): every screen of cards. In order, top to bottom:
  - `title`;
  - `subtitle` (required): what the screen is for, and what to do here;
  - `tabs` (L1/R1, Tab) and `modes`, the tabs inside them (L2/R2, PageUp/PageDown);
  - `summary`: a panel that stays put (the dish as it will come out, the slip, your level);
  - `cards`: built with `heading()` and `grid()`;
  - at most **three buttons**: `confirm` (□, Enter), `alt` (△, 1) and `cancel` (○, Backspace). Cancel is Back or Close when it's left out; `cancel: false` means the screen has no way out but confirm.

  `nav` gives the D-pad and arrows the cards: they move over the cards only, by where each card sits in the grid. There is no list of items, so a fourth button can't be written. Anything else a screen offers is a card on it (a standing order's days, stopping it).
- **Lists and dialogs** (`MenuSpec`): rows or buttons to move through, for the pause menu's lists, settings and yes-or-no questions (`askChoice`).

## Text: three kinds, never mixed

| Kind | What it is | Where it goes |
| --- | --- | --- |
| **Fact** | What something is, costs or does | The card face; a section heading |
| **Instruction** | What pressing something does | The button's label and sub-line, the grown card's last line, the hint bar. Never a paragraph |
| **Flavour** | Colour, voice | One italic quiet line: the menu's `flavour`, or the grown card. Never inside a fact |

- No explanation paragraphs. What they taught moves to the subtitle, the card or the button.
- A screen's **subtitle** says, in one line, what the screen is for ("One level for everything on the bill of fare").
- A section heading carries a small line on what to do there: `heading("Weather", "forecasts may be wrong")`.

## Cards: two sizes

- **At rest:** icon, name, one key `fact` (a price, a count), one `status` line (coloured by `tone`: good, warn, muted), and `tags` where they matter (food always shows its tags).
- **With the cursor on it** (keys, controller, mouse): the card itself grows in place, animated (a copy over the menu, so it's never cut off, kept on screen), and `detail`, `flavour` and `does` fade in inside it. `does` is what picking it does, in a few words ("Put it on the board", "You need 1s more"). No separate tooltip or drawer.
- **Desk-style cards** (screens that open other screens): at rest, just the name and one line: the state ("Not set", "Fair", "Unread", "Spring 1") or, when there's no state, what's inside ("Information about patrons you served."). Nothing more until it grows.
- **A few big choices** (House prices' three levels): `grid(..., { open: true })` shows the extra text on the face; those cards don't grow.
- **What you have:** `have: n` puts a quiet green band across the foot, "You have n". Not gold: gold belongs to the main button.
- **Not available:** `off`, dimmed, with the reason as its status ("needs an oven") and the way to fix it in `does`.

## Layout

- `grid(cards, { cols, size })`: one card shape, 1 : 1.55, at a fixed width (`m` 118 px for things, `l` 142 px for choices; `s` 96 px only for the wardrobe's swatches), rows centred so a short last row sits balanced. Content is cut to fit the card, never the card to the content: long text goes on the back (`detail`, `flavour`), and what still doesn't fit fades at the bottom. Pick `cols` so rows come out even.
- The confirm button's label says what it does and its sub-line the consequence ("Put it up · 6 on the board").
- Arrow keys stop at the edges up and down; they wrap left and right.

## Sounds

In-world menus confirm with the pen tick; out-of-world choices with the piano (see `specs/sound.md`, Menu sounds).

## Done so far

Desk, House prices (its own screen now), Equipment (Upgrades tab: trays and seasoned oak), Bill of fare, Newspaper headings.

Crafting, on one template (`src/ui/cook.ts`): choosing what to make is recipe cards (time, how many waiting, on the board or not, tags; grown, it says what one go makes and carries the blurb); building the dish pins a **result panel** on top (`resultPanel()`: the dish as it will come out, the tags the choices add lit), then the ingredient cards (grown, each says what it adds), then one main button whose sub-line says what's missing or who it's for (Cook, Bake or Boil). Steeping tea and garnishing a drink use the same panel and cards.

The rest of the kitchen side: the station's choices ("What now?", "Put back which?", "Empty which?") are small cards with an icon and one status line; snack bowls pin the bowl that's there (with its level) as the result panel; the pie safe has headed sections (from the oven, in the safe, on your tray) with slices as pips; offering something unasked, the bin, the hatch and setting a tray down lost their paragraphs (subtitle and flavour instead) and say what picking does.

## To do

Calendar, journal, pause, the start screens (location and inn pickers, welcome), the end-of-day summary, keys and controls.
