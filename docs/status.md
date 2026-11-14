# Travelling Inn prototype: where we are

Updated Nov 15, 2026 · build 73 · https://inn-prototype.vercel.app

Tasks live on the Kanzo board, project **inn** (`inn#N` below), with what was done in each task's comments. Design decisions come from [design-session-journal.md](design-session-journal.md).

## Done

- **Time and calendar**: one time of day for everything (#1); four calendar seasons, weekdays, years, "Spring is here." (#2); the starting location reshapes the year: town centre, dockside, mountainside, crossroads, hill country, picked on cards (#13).
- **Needs**: hunger, thirst, warmth, measured and logged (#3); orders grow from them, with a soft "full" (#15).
- **Weather**: states and rain intensity (#14); guests talk about it, weather tastes (#20); its sounds: rain, wind, thunder, the street (#26); soaked guests seek the fire (#21); rain brings people in and keeps them (#22); when it stops, guests decide whether to go (#23).
- **Screen**: the status card over the map (#29); pop-ups stay as they were (#31).
- **Playtest fixes**: steady location picker, pies wait on the oven, debug over pause, crowd volume (#32).

## In review (built and deployed; Bruno marks them done)

- #27 lighting (darker rainy days, lamps, the keeper's candle)
- #25 morning newspaper (forecast, market days, town news)
- #17 seasonal tastes
- #30 calendar (K, the desk, or click the status card)
- #33 counter: snack bowls for the stools, clearer bowls, kettle and coffee pot behind the bar
- #9 gramophone: horn and turntable tone; winding has a progress bar; the spring runs ~4 min (short for testing) and sags the record when it gives out (per [specs/sound.md](specs/sound.md))
- sound settings: Cues and Atmosphere volume, Music on/off (pause screen)
- #34 tea: boil the kettle for 2–4 cups; guests ask for a leaf or bean by name

## Waiting on Bruno

### Design sessions (an agenda)

**#10 Snow, and how patron schedules work** (unblocks #18 schedules, then #28 more regulars)
- Snow: which calendar seasons and locations? Does it pile up and melt, or is it just weather?
- What snow does to guests: cold, soaked when it melts, fewer passers-by, snowed in overnight?
- How it looks and sounds inside (the windows, the door).
- Schedules: does a regular keep fixed days ("the ferryman every market day"), habits with exceptions, or both?
- Calendar season absences ("the ferryman scarce when the river freezes").
- How the keeper learns a regular's days, and how the calendar (#30) shows that.

**#4 Races have tastes**
- Which fantasy races are in the prototype?
- Each race's baseline tag pool; how far individuals depart from it.
- Which races are common in which location.
- How a guest's race shows on screen before there's art.

**#5 Mastery** (unblocks #16 skill slots)
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

### Decisions

- **#11** the smallest starting set of equipment (unblocks #7 small or medium tavern)
- **#12** how many named regulars, 8 to 12

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
