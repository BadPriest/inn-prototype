# UI rules

How menus and card screens are built, so every screen reads and handles the same. Decided with Bruno, Nov 19, 2026, after his notes on the desk, bill of fare and shop: too wordy, flavour drowning what matters, unbalanced layouts, inconsistent screens.

Code: `src/ui/menu.ts` (the frame), `src/ui/cards.ts` (cards), styles in `index.html`.

## Text: three kinds, never mixed

| Kind | What it is | Where it goes |
| --- | --- | --- |
| **Fact** | What something is, costs or does | The card face; a section heading |
| **Instruction** | What pressing something does | The button's label and sub-line, the card drawer's last line, the hint bar. Never a paragraph |
| **Flavour** | Colour, voice | One italic quiet line: the menu's `flavour`, or the card drawer. Never inside a fact |

- No explanation paragraphs. What they taught moves to the subtitle, the card or the button.
- A screen's **subtitle** says, in one line, what the screen is for ("One level for everything on the bill of fare").
- A section heading can carry a small subtitle: `<div class="sec-h"><h4>Weather</h4><small>forecasts may be wrong</small></div>`.

## Cards: two sizes

- **At rest:** icon, name, one key `fact` (a price, a count), one `status` line (coloured by `tone`: good, warn, muted), and `tags` where they matter (food always shows its tags).
- **With the cursor on it** (keys, controller, mouse): it lifts, and a drawer floats under it (over it if there's no room) with `detail`, `flavour` and `does`. `does` is what picking it does, in a few words ("Put it on the board", "You need 1s more").
- **A few big choices** (House prices' three levels): `grid(..., { open: true })` shows the drawer's text on the face.
- **What you have:** `have: n` puts a quiet green band across the foot, "You have n". Not gold: gold belongs to the main button.
- **Not available:** `off`, dimmed, with the reason as its status ("needs an oven") and the way to fix it in `does`.

## Layout

- `grid(cards, { cols, size })`: fixed card width (`s` 96, `m` 118, `l` 150 px), rows centred so a short last row sits balanced, every card as tall as the tallest. Pick `cols` so rows come out even (7 desk cards → 4 + 3; 14 dishes → 7 + 7).
- **Pinned:** tabs, mode switches and bands go in the view's `pinned`, which stays put while the cards scroll.
- One main action, bottom right, its label saying what it does and its sub-line the consequence ("Put it up · 6 on the board").
- Arrow keys stop at the edges up and down; they wrap left and right.

## Sounds

In-world menus confirm with the pen tick; out-of-world choices with the piano (see `specs/sound.md`, Menu sounds).

## Done so far

Desk, House prices (its own screen now), Equipment (Upgrades tab: trays and seasoned oak), Bill of fare, Newspaper headings.

## To do

Crafting screens on one template (station, a result panel with the dish's tags, servings and time, ingredient cards, a main button saying what happens); calendar, journal, snack bowls, pie safe, bin, hatch, unasked offer, setting a tray down, pause, the start screens.
