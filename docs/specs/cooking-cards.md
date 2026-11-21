# Travelling Inn: Crafting Cards and Tags (draft)

Nov 21, 2026 · From a conversation with Bruno. Kanzo inn#84, part of the epic inn#87 (Advanced cooking). Draft for discussion: the numbers are placeholders, to be checked against real ingredients.

**Decided:** this framework is for every craftable: food, brews (tea, coffee, later ale and cider), table snacks, pies and bread, and anything else the keeper makes. "Cooking" below stands for crafting in general; §3a says what differs by kind.

Markers: **Decided**, **Suggestion** (Claude, not decided), **Q** (open), **Later**.

## 1. Why

Dishes collect too many tags. With five ingredients a dish covers nearly every tag, and players funnel that into guests. The best ingredients carry the most tags, so piling them on always wins.

This spec makes cooking deeper without making it heavier:

- How many tags a dish can carry depends on the dish's mastery, not on how much you put in.
- Ingredients have to suit each other. Tags add up, lift each other, cancel out, or turn odd, so a silly combination fails on its own.
- Cooking cards (techniques) let you shape a dish when you want a particular result. You never need them.

## 2. Cooking, step by step

1. Choose the dish, its base and the optional ingredients (as today), and the quality of its fundamentals (§2a).
2. **Decided: the chosen ingredients become a card game board.** Fundamentals, base and optionals lie on the board as cards, and you hold your whole deck of techniques. Look to your hand for an effect, use a card, and target an ingredient card with it: "Pan over slow fire" + butter → **browned butter**. You may play up to N cards, one per ingredient at most, on any ingredient: fundamentals, the base (sear the beef before stewing) and optionals. N starts at 1–2 per dish; knacks may raise it.
3. The result panel shows the dish's tags, and which ones fizzed away and why.
4. Cook.

- **Decided:** playing no cards never makes a bad dish. Unplayed onions are still peeled and chopped; they just carry their plain tags.
- **Decided:** always free in the prototype. N is the only limit.
- **Decided:** as quick as the player makes it.
- **Q:** "Cook it like last time": one button that repeats the last ingredients and cards? How it's shown is open.

## 2a. Fundamentals have a quality

**Decided:** the keeper picks the quality of a dish's fundamentals, such as premium milk for a particular recipe. The choice must be easy to make.

Today a fundamental is chosen for you: a role takes its cheapest ingredient (the liquid is water).

**Suggestion:**
- The fundamental's card in the cooking screen has a small quality switch: plain, good, best (water, stock, rich stock; milk, farm milk, Jersey cream). One press, no extra screen.
- Better quality strengthens the dish's own tags (rich stock: savoury +1; Jersey milk: creamy +1), inside the same rules as everything else. It never adds a slot.
- The price follows on its own, since prices are worked out from ingredient worth.
- The choice is remembered per dish, so "cook it like last time" keeps it.
- **Decided:** techniques can go on fundamentals too ("Pan over slow fire" + butter → browned butter).

## 3. Cooking cards are techniques

**Decided:** cards are generic techniques. Each ingredient says which techniques it takes and what each brings out. No card needs its own code (outline rule 3): a technique is a tag operation on an ingredient.

**Decided:** techniques can be quirky and comic. Slapping a chicken is wildly weird, silly, and might add something.

**Suggestion,** a first set of about ten:

| Card | Flavour line | Typical effect |
| --- | --- | --- |
| Precise cutting (dice) | Small, even, patient | Evens out the ingredient's tags |
| Slice | Long, thin, quick | Lighter, crisper |
| Crush | The flat of the knife, and your weight | Releases aroma; can reveal a secret |
| Bruise | A gentle rub between the palms | For herbs: fragrant |
| Sweat | Low heat, a lid, time | Sweet up, sharp down |
| Char | Right in the flames | Smoky |
| Toast | A dry pan, a watchful eye | Nutty |
| Sear | Hot fat, no moving it | Savoury, a crust |
| Salt it | A pinch, early | Draws out flavour; tomatoes change |
| Slap | Firmly. With feeling. | Nobody knows. Possibly tender |

**Decided:** techniques can strengthen the quiet tags of fancy ingredients (see §5).

**Decided: the ingredient card changes when a technique has an effect.** Garlic + Crush → the card becomes **Crushed garlic**: new name, its art changes, its tags update. The change is the confirmation that the card did something.

**Suggestion:**
- The name comes from the ingredient's data, with a default ("Crushed" + "garlic") for when none is written.
- A technique the ingredient doesn't take never lands: the card won't drop there (it slides back, the ingredient shakes its head). Better than a card that lands and does nothing.
- Taking the technique card back off restores the ingredient.
- A golden tag found by the technique gets its own moment on the transformed card (§8).

### 3a. Every craftable

**Decided:** the same framework for food, brews and anything crafted.

**Suggestion:** each kind of craftable has its own technique cards, sharing the rules:

| Kind | Example techniques | Example |
| --- | --- | --- |
| Kitchen | Crush, Sweat, Sear, Toast, Slap | Crushed garlic |
| Brews (tea, coffee) | Steep long, Bruise (mint), Grind fine, Warm the pot | Long-steeped black tea |
| Brews later (ale, cider) | Dry hop, Age in oak, Mull | Mulled cider |
| Baking | Fold, Prove slowly, Blind bake | Slow-proved dough |
| Snacks | Roast, Spice, Pickle | Spiced nuts |

- Stars and hold apply to every craftable: a tea can be mastered like a stew.
- **Q:** garnishing (drinks today, a garnish board for dishes) is already a tag operation after cooking. Does a garnish become a card too, laid on the finished craftable, or stay as it is? Bruno needs to think about it: inn#86.

### 3b. Cards you can hold

**Decided:** cards need better rendering and interaction. They should feel like physical cards, with a tactile, 3D feel. Maybe you can flip them over for more information.

**Decided (Nov 21): how far the prototype goes.** The crafting board gets the full treatment (B below); every other card in the game gets the physical feel (A). WebGL 3D (thickness, wobble, real lighting, foil) is not for the prototype: the engine for the full game isn't chosen, and it wouldn't carry over.

**A. Cards that feel physical** (every card, plain CSS):
- The card tilts towards the pointer, and a sheen moves across it like light on card stock.
- Picking it up lifts it with a soft shadow; dropping it lands with a soft snap and a paper sound.
- Flip it to see the back.
- **On a controller (Decided):** the selected card leans forward, and the **right stick tilts it** accordingly.

**B. The crafting board, with choreography** (A, plus):
- Your hand of techniques fans out at the bottom and opens up as you point at it.
- A dragged card arcs; only ingredients that take it glow.
- On landing it tucks under the ingredient, which flips over to its new face (Crushed garlic).
- Tags rise as pills and either settle into the bowl or fizz away like steam.
- A golden tag shimmers, with its own sound.

**Suggestion:**
- **Front:** name, art, tags as pills. **Back (flip):** the flavour line, which techniques this ingredient takes and what you've discovered (secrets found, from the journal), and for a technique card, what it does.
- Flip with a key or button (and on a controller), or a right-click / long press.
- Builds on [ui.md](ui.md)'s cards; the flip may replace the drawer for crafting cards.

## 4. Three kinds of tags

| Kind | What it is | Where it comes from |
| --- | --- | --- |
| **Plain** | Realistic and descriptive: jalapeños are hot, sugar is sweet | Ingredients |
| **Feel** | Experiential or fantastical: comforting, jolly, wistful, tastes like a holiday | **Decided:** combinations of tags (chords, §6). Later also the keeper's mood (§10) and equipment character (#67) |
| **Golden** | A secret, found by playing | **Decided:** brought out by a technique (crushed garlic) or by another ingredient (salt on tomato) |

**Decided:** not just a dozen plain tags. **Suggestion,** families to start from (about 35):

| Family | Tags |
| --- | --- |
| Taste | sweet, sour, salty, bitter, savoury |
| Heat | spicy, warming, cooling |
| Aroma | fragrant, herby, smoky, nutty, earthy, floral, citrusy, yeasty |
| Body | hearty, light, rich, creamy, juicy |
| Texture | crisp, tender, crumbly, chewy |
| Temperature | warm, cold |
| Strength | strong, mild |
| Origin | briny, gamey, bright |
| Feel (chords) | comforting, festive, lively, wistful, jolly, homely, refreshing, indulgent, a taste of summer, and **odd** |

**Decided, Nov 21:** `fresh` is the condition tag (a dish made only from fresh stock, inn#78), not a flavour; the flavour is `bright`.

**Q:** reconcile with the tags in data/ingredients.json and Spec 2's starting set.

**Decided:** the system should know the strength of each tag ("Hearty 3, Fragrant 2"), which quantifies a dish's quality. **Decided:** it's shown without numbers if at all possible, so it doesn't turn into min-maxing. **Suggestion:** a pill's size or glow, or words on the dish card ("a hint of smoke", "deeply hearty").

## 5. Balance: every ingredient has the same budget

**Decided (elegant, keep it).** Every ingredient has about the same total tag strength, say 4.

- Sugar spends it all on one tag: sweet 4.
- A fancy ingredient with five tags spreads the same 4 thin: each tag is quiet.
- More tags means quieter tags, so piling on the "best" ingredients stops working.
- What makes a dear ingredient worth it: rarer tags, or a secret.

**Techniques move the budget, they don't add to it.** Toasting saffron gathers its quiet tags into one loud one. That's the way to make a fancy ingredient sing, and it takes knowing what to do with it.

- **Q:** may a technique add a little on top (+1, "care"), or only move points?

## 6. Interplay

**Decided:** tags have interplay, not just opposites. All of it is one small data table (outline rule 8), tuned by editing rows.

| Relation | What happens | Examples |
| --- | --- | --- |
| **Builds** | The same tag in two ingredients adds up | Beef's savoury + onion's savoury |
| **Lifts** | Each makes the other stronger (+1 each) | sweet + sour, salty + sweet, spicy + sweet, rich + sour |
| **Clashes** | Opposites subtract | hearty − light, warm − cold, strong − mild |
| **Muddles** | A wrong pair: both shrink, and **odd** is left behind | briny + sweet, bitter + creamy |
| **Chords** | A set of tags together makes a feel tag | warm + sweet + fragrant → comforting; spicy + sweet + warming → festive; sour + cold + bright → refreshing |

**Decided:** the **odd** tag. Most guests shrug at it. It ties to local tastes and oddness (#6), and some guests, the curious and the unformed, may love a strange dish. Never a punishment, just a different direction.

**Suggestion: order of working out.**

1. Add up each tag across the dish's own tags and its ingredients (builds).
2. Apply lifts.
3. Apply clashes; apply muddles (both shrink by the smaller; odd takes the smaller as its strength).
4. Form chords: a chord forms when each of its tags is at 2 or more. **Suggestion:** the chord *folds in* its parts and takes one place, at the weakest part's strength + 1. Feel tags are then worth chasing: three tags become one, freeing room.
5. Golden tags are kept first (§8).
6. Keep the strongest tags up to the dish's hold (§7). The rest fizz away, shown in the result panel. Ties go to the base ingredient, then the dish's own tags, then ingredients in the order they were added.

## 7. Hold is mastery: stars per dish

**Decided:**

- A dish's **stars** set its **hold**: how many tags it can take.
- You unlock a star with **skill points** (from levelling, #75), once you've cooked that dish enough times. Practice opens the chance, points buy it ("earn the chance, then buy it", tabled on Nov 17, finds a home here).
- You may not master every dish, and that's fine.
- **Later:** stars are more than hold. People come in just for that stew; people travel for what you make (reputation, #45).

**Suggestion:** hold 2 at no stars, +1 per star, so 5 at three stars. A beginner's dish is plain, never bad (#5).

**Q:** thresholds per star and skill-point costs.

## 8. Golden tags

**Decided, MVP:** golden tags are **always kept**. A golden tag takes a hold place first and nothing cancels it.

**Decided, the aim for later:** do something funnier than protecting it. Take the pleasant "yeah, I got the golden tag!" moment and raise it into risk, fun, silliness, levity, frustration, relief, and Delight.

**Suggestion for later: kept, but alive.** Each golden tag has a **partner** and a **nemesis** among the plain tags. Ordinary tags can't touch it, but:

- Meet its partner loudly → it **blooms** into something wonderful.
- Meet its nemesis loudly → it **turns** into something gloriously wrong. The "AAAA" moment. Comic, cheap, and someone out there loves it.

See the examples in §9.

## 9. Worked examples

Numbers are placeholders. Strengths: 1 quiet, 2 clear, 3 loud, 4+ deep.

### A stew, one star (hold 3)

The stew's own tags (its fundamentals): warm 2.

| Ingredient | Tags (budget 4) |
| --- | --- |
| Beef (base) | savoury 2, hearty 2 |
| Onion | savoury 1, sweet 1, sharp 2 |
| Roots | sweet 2, earthy 2 |
| Herbs | fragrant 3, light 1 |

**No cards.** Totals: savoury 3, sweet 3, fragrant 3, warm 2, sharp 2, earthy 2, hearty 1 (2 − light 1). Comforting can form (warm 2, sweet 3, fragrant 3) at 3. It folds in warm, sweet and fragrant.
Kept (hold 3): **comforting 3, savoury 3, sharp 2** (sharp ties with earthy; the onion was added before the roots). Earthy and hearty fizz away.

**Sweat the onion.** Onion becomes sweet 3, savoury 1: sharp is gone. Comforting now folds in sweet 5, so it's at 3 (weakest part, warm 2, + 1).
Kept: **comforting 3, savoury 3, earthy 2**. A rounder, homelier stew. One card turned a sharp stew into an earthy one.

**Also sear the beef** (with N 2). Beef becomes savoury 3, warm 1. Warm rises to 3, so comforting is now at 4.
Kept: **deeply comforting 4, savoury 4, earthy 2**. The stew people come back for.

### Peanut butter on the clam roast

Clam roast's own tags: warm 2. Clams (base): briny 3, light 1. Peanut butter: nutty 2, rich 1, sweet 1.

- Briny + sweet muddle: briny 3 → 2, sweet 1 → 0, **odd 1**.
- Rich − light clash: both 0.
- Kept (hold 2): **briny 2, warm 2** (warm beats nutty on the tie: the dish's own tags come first); nutty and odd fizz away.

The clams alone would have been briny 3. The peanut butter cost you flavour and gave nothing back. No rule against it: it just doesn't work, and the panel shows why.

### Golden tags in the MVP (always kept)

- **Crush the garlic** in a stew → golden **aromatic**. It takes a place first, so with hold 3 the stew keeps aromatic plus its two strongest tags.
- **Salt the tomato** (Salt it) → golden **sun-ripened**. Ingredients can do it too: tomato with salted anchovy might bring it out without the card.
- **Slap the chicken** → golden **tender**. Nobody knows why it works. It works.

### Golden tags later (kept, but alive)

- **Slapped chicken + lemon (sour, partner)** → *tender* blooms into **heavenly**. A Delight waiting to happen. You found it by being silly, then brave.
- **Slapped chicken + chilli (spicy, nemesis)** → *tender* turns into **indignant**: the chicken is offended, and so is everyone eating it. Most guests push it away, laughing or not. The nervous scholar who thinks poultry has been too timid for years is delighted.
- **Crushed garlic + honey (sweet, nemesis)** → *aromatic* turns into **vampire-proof**. Clears the room. The night-shift ferryman orders it twice.
- **Sun-ripened tomato + cold (partner)** → **a taste of summer**, in the middle of winter. Wistful guests may cry, in a good way.

The loop: a golden tag is a small win; risking it is a choice; the result is either a Delight or a story. Both are good outcomes in a game where nothing punishes.

## 10. Mood (later, when it arrives)

- **Suggestion:** a dish keeps one place for the cook's mood, outside hold: the keeper's trace tag (Spec 3: wistful adds comforting, buoyant adds lively).
- **Decided direction:** mood also interacts with the dish's tags. **Suggestion:** each mood lifts some tags (wistful lifts comforting and homely; buoyant lifts lively and jolly). Flustered could muddle more easily. Mood still never touches the player's hands (outline rule 1).

## 11. Data (sketch)

- **ingredients.json:** `tags` become strengths (`{ "savoury": 2, "hearty": 2 }`, adding up to the budget); `techniques` maps a card to what it does to this ingredient (`{ "sweat": { "sweet": 3, "savoury": 1 } }`, optionally `golden`); `secrets` lists golden tags brought out by another ingredient.
- **techniques.json:** id, name, flavour line, icon.
- **tags.json:** each tag's family and kind (plain, feel, golden); relations (lifts, clashes, muddles); chords; for golden tags, partner and nemesis (later).
- **dishes.json:** `stars`, star thresholds and costs; `hold` is worked out from stars. Applies to every craftable (dishes.json already holds drinks and snacks).
- **ingredients.json:** `quality` tiers for fundamentals (or separate ingredients linked by role); `prepNames` for transformed cards (`{ "crush": "Crushed garlic" }`).
- **techniques.json:** a `kind` per technique (kitchen, brew, baking, snack).
- **Save:** stars per dish; the journal's record of discovered secrets.

## 12. Open

- "Cook it like last time": how it works and shows.
- How often you get to cook the special way, beyond the prototype: a limit, a Taproom card, a second button.
- Where cooking cards come from: learned like recipes, found, taught by regulars, cookbooks.
- May a technique add strength, or only move it?
- The full plain tag list and every ingredient's budget.
- Star thresholds and skill-point costs; hold at no stars.
- Whether chords fold their parts in (suggested) or sit beside them.
- Fundamental quality: a switch on the card (suggested), or quality tiers as separate ingredients.
- Garnishing dishes in this world: its own task (inn#86).
- Is the whole technique deck always in hand, or only the techniques you've learned (where cards come from, above)?
- How a guest's score reads strength (Spec 2 scores love +2, like +1 per matching tag; does a loud tag count more?).
