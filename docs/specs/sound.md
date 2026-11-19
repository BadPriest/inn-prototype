# Travelling Inn prototype: Sound

Nov 15, 2026 · build 73 · Describes what's built and draws the line for what comes next.

Markers: **Decided**, **Suggestion** (Claude, not decided), **Q** (open), **Later**.

## Why sound is in a lofi prototype

The prototype tests whether the loop is fun. Sound earns its place in two ways:

1. **Cues: the game telling you something.** An order came in, how a serve landed, a guest gave up. These carry information the circles can't, so they belong in slice 1 without question.
2. **Atmosphere: the inn as a place.** Fire, crowd, rain, music. These answer one of the slice's questions directly: *does it stay cozy?* (prototype spec §15, question 3). The vision says sound, light and small gestures carry the mood, so a cozy test without them is only half a test.

Everything else waits for the real game.

## The rule for what goes in

**Decided:** a sound is in scope if it **reacts to state the game already has** (the fire being lit, the headcount, the weather, the door, which room the keeper is in). It waits if it needs **new authored content** per guest, per event or per line.

Reacting costs a small listener and a row in `SOUNDS`. Authoring grows with the cast and the script, and that belongs to later specs (Spec 5 for voices, Spec 3 for mood-driven music).

A second check: **would a playtester notice it on a top-down map of circles?** If not, it waits for the isometric game.

## How it's built (Decided, in place)

- **One listener.** `src/sound.ts` listens to game events and calls `soundscape()` every frame. Systems never call sound directly.
- **Data, not code.** Which files, how loud, how much pitch variation: `SOUNDS` in `src/data.ts`. Behaviour tuning: `SOUND_TUNING`, `FIRE`, `CROWD`, `DOOR_TUNING`, `GRAMOPHONE`, `GRAMOPHONE_TONE`.
- **The engine** (`src/sound/engine.ts`) loads files, evens out their loudness, slices footstep files into single steps, and places sounds: distance, pan, and muffling through walls (next room at 0.35, two rooms away silent).
- **Organic repetition.** Every sound varies a little in pitch and volume. Loops start at a random point, so two pots never play in step.
- **Pause silences everything** (the audio context is suspended). **M** mutes.
- **Files by what plays them (Decided, Nov 18).** `assets/sounds/` has a folder per source: `cues/`, `menus/`, `weather/`, `ambience/` (crowd, street), `fire/`, `cooking/`, `foley/` (door, bell, pouring, footsteps), `gramophone/` (records and its own noises), `bgm/`, `jingles/` (short pieces for a moment, like turning in); `questionable/` is parked. Original songs are in `music/` (not committed, not packed).
- **Three volume groups (Decided, in place).** Every sound is a cue (the game telling you something), atmosphere, or music (`SoundDef.bus`). The pause screen sets **Cues** and **Atmosphere** volume (off to 100%) and switches **Music** off, kept in the browser. Cues: the bell, order taps, paper, confirm, serve outcomes, delight, and the synthesised placeholders. Music: the records and every gramophone sound. Everything else is atmosphere.
- **Files stay clean.** Effects such as the gramophone's tone are applied live, so a file can be swapped or reused without re-exporting.
- **Synthesised placeholders** cover cues that don't have a file yet (a guest leaving early, a resolution moment). They're marked as placeholders in `sound.ts`.

## What's in (build 69)

| Layer | What it does | Where |
| --- | --- | --- |
| Door and bell | Opens and closes with whoever is in the doorway; the bell rings as it swings. Quicker for one person | `sound.ts`, `DOOR_TUNING` |
| Orders | Two or three taps, heard anywhere, panned toward who ordered | `sound.ts` |
| Serve outcomes | Delight, positive, neutral, negative chords. A whole table plays one after another, like chords being played | `sound.ts`, `OUTCOME_SOUND` |
| Coins (build 101) | A guest paying us, a moment after their reaction: an order by its biggest coin (a few pennies, a handful, silver, crowns); the tip, paid on the way out, is the Delight coins if anything that visit delighted them, else the coin purse for 3d or more and the small tip sound below that. A table pays one clink after another | `sound.ts` `coinSound`, `assets/sounds/cues` |
| Paper and confirm | Checklist ticks, journal notes; a piano note on confirming a decision | `sound.ts` |
| Pouring | Taps and the tea urn; stops when the pour stops | `sound.ts` |
| Cooking | Kettle while brewing; stew cooking, then simmering while the pot has servings | `sound/loops.ts` |
| Footsteps | One step per stride for the keeper and guests, at most 3 guest steps at once | `sound/footsteps.ts` |
| Crowd | Taproom murmur in four levels by headcount (1, 6, 15, 27), crossfading once the count holds | `sound/crowd.ts`, `CROWD` |
| Fire | Catches small, roars, settles; dies to embers when put out | `sound/fire.ts`, `FIRE` |
| Weather | Rain indoors, through the open door, and at the windows, mixed by intensity; wind; thunder; street noise | `sound/weather.ts` |
| Gramophone | Records through a horn and turntable effect; the spring runs a few minutes and sags the record when it gives out; wound again, it carries on where it stopped | `sound/gramophone.ts` (#9, in review) |
| Menu sounds | The desk, its papers and books, ticks and page turns in the in-world menus, the pause latch (see Menu sounds) | `sound.ts` `menuSound` |
| Turning in | *The Last Candle*, a short jingle as the keeper goes to bed | `sound.ts` (`TurnedIn`) |
| Background music | A clean track after 90 s without music; the gramophone fades it out | `sound/bgm.ts` |

## The gramophone

### As built

- **Music comes from the gramophone (Decided, design journal).** It stands in the taproom and is heard from there, muffled through walls like anything else.
- **Wound by hand (Decided).** The keeper winds it, staying by it while the crank turns (a progress bar shows it; walking away leaves it unwound). The spring then runs `GRAMOPHONE.springSeconds` of music (240, about two records: short for testing, so the run-down comes round; the real game would run longer), counted only while music plays and the game isn't paused. Winding is a small chore with a reward, and optional. **Suggestion (journal):** because it's wound, it plays on through a power cut, once outages exist.
- **The sequence:** the crank turns, the needle drops, the record plays with surface crackle underneath. At the end of a record: the run-out groove, then the next. Changing the record lifts the needle and drops it on the next. The record's title shows as a line (♪ *Go, Little Boat*). The prompt tells how the spring is doing (freshly wound, running a while yet, nearly spent, winding down).
- **Running down (Decided).** If the spring gives out mid-record, the record sags over its last seconds (`GRAMOPHONE.sag`: speed to 0.45 and level to 0.35, so the pitch drags down) with the winding-down sound layered over it, as you'd hear the mechanism labour. If it's spent as a record ends, the run-out plays, then the winding-down sound. Either way it then goes **silent** until wound again: no run-out hiss, nothing that nags.
- **Wound again (Decided, Nov 18).** After giving out mid-record, the record carries on from where it stopped, coming up from the sag's speed to full over `GRAMOPHONE.resume.spinUpSeconds` (0.8), with no needle drop. After being spent at a record's end, the next record plays.
- **Five records**, the in-house songs. The originals are in `assets/sounds/music/in-game-tracks/`; the copies the game plays are in `assets/sounds/gramophone/`.

### The tone (in place)

Applied live to each record, set in `GRAMOPHONE_TONE`:

| Stage | Setting | What it does |
| --- | --- | --- |
| High-pass | 320 Hz | Removes the bass the horn can't make |
| Low-pass | 3400 Hz | Dulls the top |
| Horn resonance | +6 dB at 1400 Hz | The nasal, boxy middle |
| Drive | 2.4 | Soft distortion on the louder parts |
| Wow | 0.55 Hz, 0.6% | The slow wander of the turntable |
| Flutter | 6.5 Hz, 0.18% | A faster shimmer |
| Make-up gain | 1.6 | Brings the band-limited sound back to level |

Crackle is a separate looped file, so it doesn't pass through the effect and can be mixed on its own.

### Background music (Decided, Nov 18)

When there's been no music for `BGM.quietSeconds` (90, real seconds, not counting pause), a background track plays: clean (no horn), heard the same everywhere, on the music bus, fading in over 6 s and fading away over its last 8 s (`BGM.fadeInMs`, `endFadeMs`). When it ends the quiet is counted again before the next, never the same track twice running. Winding the gramophone fades it out over 4 s. Tracks: `BGM.tracks` and their `SOUNDS` entries (`bgmDawn` → `assets/sounds/bgm/dawn-in-the-vale.opus`: files named for the song, like the records; originals in `assets/sounds/music/bgm/`). Six so far, 2–3 min each: *Dawn in the Vale*, *A Day of Gentle Rain*, *A Rather Busy Morning*, *Beyond the Green Hills*, *The Long Road Ahead*, *Where the River Bends*. Code: `sound/bgm.ts`.

## Menu sounds (Decided, Nov 19)

The desk and the in-world menus sound like paper, pens and wood. The pause screen's latch is the one sound outside the world. All are cues (the Sound effects slider), files in `assets/sounds/menus/`, `SOUNDS` keys `menu*`, played on `MenuSound` events (`sound.ts` `menuSound`).

| File | Key | Plays when |
| --- | --- | --- |
| `sfx-sitting-down` | `menuSit` | Opening the Desk: you sit down… |
| `sfx-paper-shuffling` | `menuShuffle` | …then shuffle its papers, `SOUND_TUNING.deskShuffleAfterMs` (1.1 s) later, as the chair settles |
| `sfx-wooden-latch-open` | `menuPause` | Opening the pause screen. Atmosphere and music drop at once; the latch plays out, then all sound stops |
| `sfx-journal-opening` | `menuJournal` | Opening the Journal |
| `sfx-page-turn-1`, `-2` | `menuPageTurn` | A journal page (a regular's, or passing visitors) opening and closing; switching tabs on the bill of fare (all-day or meal times, and which meal) and in the Equipment shop |
| `sfx-newspaper-opening` | `menuPaperOpen` | Opening the Newspaper, in full |
| `sfx-newspaper-closing` | `menuPaperClose` | Folding it up or closing the menus; cuts the opening short if you're quick |
| `sfx-calendar-flipbook` | `menuCalendar` | Opening the Calendar, however it's opened (desk, K, the status card) |
| `sfx-pickup-paper` | `menuBillOfFare` | Opening the Bill of fare |
| `sfx-house-prices` | `menuPrices` | Changing House prices (Cheap, Fair, Dear) |
| `sfx-coins-clinking` | `menuCoins` | Buying equipment (order it or fetch it), and selling a piece back while arranging |
| `sfx-pen-clicking` | `menuPenClick` | Picking a desk card that has no sound of its own (today: Equipment) |
| `sfx-wooden-table-tap` | `menuTableTap` | Starting to arrange the kitchen, and setting each piece down |
| `sfx-pen-checkbox-1`, `-2` | `menuTick` | Confirming in an in-world menu: putting up the bill of fare, cooking or boiling, a station's choices (put back, empty), setting out a snack bowl, the pie safe, garnishing, an unasked gift, the bin, the hatch, setting a tray down |

**Rule (Decided, Nov 19):** the pen tick confirms in-world actions (paper, signing, the keeper's own doing); the piano (`confirm`) confirms what isn't in the world. Today the piano plays for where to start and which inn, and for **finishing arranging the kitchen**, a build mode. It used to play on every piece set down.

Not covered: the pause screen's own tabs. Sound stops while paused, so a page turn there wouldn't be heard. Steeping tea has no tick, as the pour already sounds. `sfx-coins-clinking` and `sfx-house-prices` came in with each other's names and were swapped.

### Turning in (Decided, Nov 19)

*The Last Candle* (9.6 s, `turnIn`, `assets/sounds/jingles/`) plays as the keeper goes to bed and the screen fades, into the day's summary. Music bus, heard everywhere. A background track playing then fades out over 1.5 s (`BGM.hushMs`) and the quiet is counted afresh. The gramophone isn't touched: if it's playing, the jingle plays over it. Code: the `TurnedIn` event in `sound.ts`.

### Next for the gramophone

- **Q:** How long the spring runs in the real game, once testing no longer needs the run-down to come round quickly.
- **Later:** records carry tags so guests react to the music (#35; Spec 7's foot-tap expression); requests from regulars; buying records.

## Next, in scope

| Item | Why it fits the rule | Task |
| --- | --- | --- |
| A base loop per calendar season (spring birdsong, summer insects, autumn wind and leaves, winter hush), maybe by time of day | Reacts to the calendar, which exists | #19 |
| Outdoor storm loop through the open door | Reacts to weather; today a storm uses the medium rain, louder | optional |

## Not now

| Idea | Why it waits |
| --- | --- |
| Music that follows the game (tempo with how busy it is, chords with mood) | Mood isn't in the prototype; nothing to drive it |
| Guest voices, murmurs or barks per guest | Authored content; belongs to Spec 5 |
| Footsteps that change with the floor surface | Can't be noticed on circles; isometric game |
| Full 3D positioning (beyond distance, pan and walls) | Same |
| A tune heard in full during the quiet moment (Spec 7) | The quiet moment isn't in the prototype yet |
| Radio | Parked until electricity is a system |
| Sounds for cards (selected, played, spent) | Cards aren't in the prototype |

## Watch for in playtests

- **The music doing the work.** If notes praise the atmosphere but not the loop, test a session with music off.
- **Cue fatigue.** Order taps and outcome chords repeat all day. Do they still feel good after an hour, or do players mute?
- **Muddy mix on busy rainy days.** Crowd, rain, fire, cooking and music all at once. Can you still hear an order come in?
- **The gramophone as a chore.** Does anyone feel they *have* to keep it wound?

## Q

- **Decided:** the crowd murmur keeps reaching the kitchen through the wall, as now; it doesn't annoy (Bruno, though business has been slow: revisit if busy days get muddy).
