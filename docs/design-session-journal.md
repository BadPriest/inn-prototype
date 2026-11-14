# Travelling Inn: Design Session Journal

Nov 14, 2026 · Voice session with Claude. Decisions and notes for the lofi prototype, to hand to Claude Code.

## Session overview

Weather was the way in: an outside input, simpler than mood, that shows what mood needs to be. Bruno reasons from guest behaviour; Claude translates it into data and systems. Markers: **Decided**, **Suggestion** (Claude, not decided), **Q** (open), **Parked**, **Later**.

### Design inventory

The areas Bruno is thinking about:

1. Core gameplay and philosophy
2. Mood, guests and relationships
3. Weather, seasons and atmosphere
4. Service, food and production
5. Supply, inventory and economy
6. Cards, gestures and unexpected events
7. The world and life of the inn
8. Art, audio and technical direction

### Principle: believable and fun

The world should be believable as well as fun. Anything too jarring shows the cracks in the simulation and breaks suspension of disbelief.

### Next session

Snow, and how patron schedules work in detail.

## Time and calendar

### The inn is open all day (Decided)

The player can open as early as 7 AM and stay open all day, serving breakfast and so on. **Bug to fix:** code and guest lines assume evening; guests answer the keeper's "Morning!" with "Evening."

### One shared time of day (Decided)

A single time-of-day value (morning, midday, afternoon, evening, night) that greetings, chatter, cravings, patron flow and weather all read. Nothing hard-codes "evening" again.

### A Stardew-style year (Decided)

Four calendar seasons of 28 days to start, so 112 days a year, with dates like "Spring 12" and real weekdays kept for weekly traditions. Bruno dislikes games that rush their seasons, so lengths live in data and can be tuned.

### The starting location reshapes the year (Decided)

The player picks a location at the start of a save (dockside, town centre, mountainside, crossroads). It redistributes days between calendar seasons without changing the 112-day total: a mountainside inn gets a longer, snowier winter. Suggestion: each location's data sets calendar season lengths and weather likelihoods.

### Naming: season vs calendar season (Decided)

"Season" keeps its Spec 3 meaning, a guest's or the keeper's long-term emotional state. Spring, summer, autumn and winter are always "calendar seasons".

## Calendar seasons

### Each calendar season has its own weathers (Decided)

The foundation: every calendar season lists which weathers can happen and how likely each is, snow only in winter, say. Weather transitions draw from that list.

### Seasonal tastes (Decided)

What people want shifts through the year. Suggestion: a context bonus on some tags, with cravings weighted toward them (hearty and warm in winter, light and cold in summer), as a layer between long-term tastes and tonight's craving.

### Who comes, and when (Decided)

Calendar seasons change patron schedules, for regulars and archetypes alike, and the passing traffic. Suggestion: one more modifier on the flow formula, plus per-season entries in each regular's schedule (the ferryman scarce when the river freezes).

### Suppliers and supplies (Later)

Which suppliers come round, and what they can bring, change through the year. Waits for the supply systems, since ingredients are endless in slice 1.

## Weather

### Weather is a set of states, not noise (Decided)

States with allowed transitions and a minimum time in each, so no flip-flopping (sunny, stormy, sunny again). Change mostly drifts through the day, but can jump abruptly: a sudden downpour, a storm breaking. Each change fires an event that sound, flow and lingering respond to.

### Rain has intensity (Decided)

Light rain, rain, storm. Suggestion: one continuous value with named bands; how soaked guests get, the shelter pull, the sound mix and lingering all scale with it. A storm may thin passing traffic, since fewer people are out.

### Weather carries tags (Decided)

Wet, cold, stormy: chatter picks matching lines ("Coming down in buckets out there"), never sunshine talk in a downpour. Guests can have tastes for weather too, like the one who secretly loves a good storm.

### Forecasts come from the morning newspaper (Decided)

It arrives each morning, is read at the desk beside the bill of fare, and carries the forecast and town news, such as market days, which already feed flow. Suggestion: forecasts are sometimes wrong. The radio is parked until electricity is a real system.

## Rain and the guests

### Soaked on arrival (Decided)

A guest from the rain reads at a glance: their circle shivers, takes a tint, and drips, making more of the existing spills. Weather stamps a state on arrival that fades as they dry.

### Wet guests seek warmth (Decided)

They want a seat by the fire and hot food and drink. Being soaked raises the warmth need, pulls seat choice toward a lit fire, and tilts orders and cravings toward *warm*. The fire dries guests within a radius.

### Rain brings passers-by in, and keeps them (Decided)

Flow is passing traffic (from location and time of day) times a shelter factor from the weather: a town-centre inn gets a rush, a quiet crossroads barely notices. Rain stretches stays until it stops.

### When rain stops, many leave, by choice (Decided)

Each guest weighs their reason for visiting (shelter, food, drink, company) against unmet needs: shelter-seekers go, diners stay. Groups decide as one party and rarely split. Suggestion: show the reason ("That's our chance, then") so leaving reads as a choice, not dice.

### Roof leaks (Decided)

A storm can make the roof leak: unfixed early in the game, or something breaks later. Suggestion: the leak drips into a spot that needs a bucket or cleaning.

## Needs: groundwork for mood

### Unmet needs are measured, not faked (Decided)

Where weather meets mood (fire out, no seat by the fire), there are no stand-in outcomes. Needs are tracked as real values, shown in the debug view, and every unmet stretch is logged with its length. The logs tell us what mood must react to.

### Hunger and thirst are separate (Decided)

Spec 3 lumps them together, but some people come to drink and others to eat. The prototype has no needs yet, only weighted order rolls; warmth could be the first.

### Patrons arrive with their own levels (Decided)

A dockworker parched, a traveller starving. Each archetype and regular sets a centre and spread per need, and weather shifts them on arrival. Orders grow from needs, not dice.

### Full means no more orders, softly (Decided)

Past a satiety threshold, a patron stops ordering that kind of thing, even after a Delight nearby. The edge is soft: a grace interval lets a full patron have one more drink now and then.

## Patrons and schedules

### More named regulars: 8 to 12 (Decided)

Six regulars coming on odd days are rarely seen, so you stop caring about them. Raise the count for the next pass; the exact number is open. Suggestion: frequency matters as much as count, so keep a small core who come most days.

### Cost of a bigger cast

Mostly writing, little code: each regular is data plus 20 to 40 lines, and more schemas to tune. Risk: 12 regulars could crowd a small tavern; acceptable while the small tavern is a future goal.

### Long term, almost everyone is named (Direction)

Only the odd random visitor. Suggestion: generate persistent named patrons (name, race, tastes, schedule) from data, and hand-write only those with a story.

### Schedules follow the calendar (Decided)

Weekdays, dates and calendar seasons, replacing slice 1's "regulars can come every day". Suggestion: the ferryman every market day, a scholar never on Sundays.

### Races have tastes (Decided)

Each fantasy race gives a baseline tag pool that individuals draw from and can depart from, much like regional local tastes.

## Craft and the inn's reputation

### Mastery through repetition (Direction)

Making a dish again and again builds mastery: early results are a bit uncertain, later ones reliably better. Suggestion: mastery only ever grows, and a beginner's dish is plain, never bad.

### Skill per category, stars per signature variant (Decided)

Skill grows per dish category (stews, say), so practice helps every variant. Stars, up to three, go to a variant made often, like a signature mushroom stew. Each star is a milestone: not fantastically hard, but it takes intent and effort.

### Stars measure craft; local taste shifts on its own (Decided, for now)

Stars come from practice and getting the dish right, not from locals loving it. The inn can still shift local taste, as an acquired taste: repeated exposure lowers a dish's oddness, helped by those who already enjoy it.

### Keeper skills add ingredient slots (Decided)

Levelling up or buying a skill lets a 2-slot stew take 3, tying the spec's planned slot upgrades to the keeper's progression.

## The inn: size, rooms and equipment

### Start small (Decided)

Few actions at first, so the player never feels lost; the inn grows as their skill grows. No room building for now. Suggestion: rooms exist but start closed, like renting the other rooms of the house in Software Inc.

### Small or medium tavern at the start (Decided)

The player picks one, so the prototype is tested both ways. Small: about two six-seat tables, the counter, ale and cider kegs, one stove, and no oven, so no pies at first.

### Rework the stove and oven (Decided)

Support upgrades and configurations: a wood-fired stove with an embedded oven (one piece of furniture, two crafting stations), two stews at once, an extra hob for frying. This answers spec §7: a station can craft more than one thing, through upgrades.

### Coats in the coat hall (Parked)

Guests would hang their own coats; wet ones drip and dry. Not sold yet: with fantasy races, coats may be costly in pixel art. A cheap option is coats only on the hooks, by size class, tinted per guest.

## Atmosphere: sound, light and setting

### Weather soundscape (Decided)

A muffled indoor loop always plays; an outdoor loop with street noise swells in when the door opens and fades as it closes. Windows add a sill-rain layer, louder as the keeper walks near.

### Calendar season soundscape (Decided)

Suggestion: a base layer per calendar season (spring birdsong, summer insects, autumn wind and leaves, winter hush), varied by time of day, with the weather layers on top.

### Darker days, intentional lighting (Decided)

Rainy days are darker, so lamps go on earlier. Lighting should be intentional, artistic and atmospheric.

### Electricity is new, and storms cut it (Setting)

Electricity is just catching on, a key part of the setting. Suggestion: an outage kills electric light, and the fire, candles and the keeper's candleholder carry the room.

### Gramophone for music (Decided)

Music comes from a gramophone. Suggestion: wound by hand, it plays on through a power cut.

## Open and parked

What is still undecided, or deliberately set aside.

| Topic | Status | Note |
| --- | --- | --- |
| Snow, and schedule details | Next session | Snow waited on calendar seasons, now in place |
| Smallest starting set of equipment | Q | What lets a player get to grips with the game |
| Exact number of named regulars | Q | Between 8 and 12 |
| Crafting stations and equipment | Later | Its own session, including how stations are powered |
| Radio | Parked | Returns once electricity is a real system |
| Coats in the coat hall | Parked | Sprite cost with fantasy races |
| Suppliers and supplies by calendar season | Later | Waits for the supply systems |
| Day length through the year | Later | Ties in with darker evenings and lighting |
| Festivals and traditions | Later | Real weekdays are kept for them |
