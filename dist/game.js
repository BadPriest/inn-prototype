// The shared game state. Systems read and change it; the UI only reads it.
import { servedReadyMade } from "./readymade.js";
import { EventBus } from "./core.js";
import { STARTING_PURSE } from "./money.js";
import { startingLots } from "./stock.js";
import { World, defaultLayout } from "./world.js";
import { dateOf, randomStartSeason } from "./calendar.js";
import { newWeather } from "./weather.js";
import { SKILLS_DATA } from "./gamedata.gen.js";
import { TIME_WORDS, TUNING, timeOfDayAt, MEALS, RECIPES, innOf } from "./data.js";
export function emptyStats(day) {
    return {
        day, arrivals: 0, orders: 0, served: 0, taken: 0, tips: 0, spent: 0, leftEarly: 0, leftUnserved: 0, crafted: 0, garnished: 0, cleaned: 0,
        outcomes: { DELIGHT: 0, PLEASED: 0, FULFILLED: 0, UNFINISHED: 0, COMPLAINS: 0 },
        moments: [], unmet: [], weather: { rainMinutes: 0, storm: false, sky: {} },
    };
}
export function emptyTastes() {
    return { food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] } };
}
export class Game {
    bus = new EventBus();
    /** Which inn: its map. Picked when a save starts (saves from before there was a choice are the big tavern). */
    inn = "medium";
    /** Where the kitchen equipment stands (bought, placed and moved by the keeper). Saved. */
    layout = defaultLayout(this.inn);
    world = new World(this.layout, this.inn);
    /** Arranging the kitchen: the clock stops; `holding` is a piece being moved or just bought. */
    arranging = null;
    day = 1; // days played, from 1. The date is worked out from this: see `date`.
    calendarStart = randomStartSeason(); // index of the calendar season this save began in
    /** Where the inn stands; unset until the player picks, on a new save (town centre meanwhile). */
    location;
    weather = newWeather(dateOf(1, this.calendarStart).season);
    minute = 0; // minutes since the day started (6 AM)
    speedIndex = 1;
    paused = false;
    modal = false; // a modal dialog is open (sim stops)
    open = false;
    lastCall = false;
    fireLit = false;
    noFirewood = false; // a wood stove wants wood and there's none: its cooking stops
    noSundries = false; // the last guest served had no napkins: tips suffer
    lampsLit = false;
    dark = false; // gloomy inside and no oil for the lamps
    /** The gramophone: playing or not, which record, and how many records the spring has left. */
    // spring: seconds of music left in it. resumeAt: where in the record it stopped when the spring gave out
    // mid-record (seconds), so winding it again picks up there; null: start the record from the top.
    gramophone = { on: false, record: 0, spring: 0, resumeAt: null };
    /** The keeper winding the gramophone (real seconds; walking away stops it). */
    winding = null;
    /** This morning's paper (newspaper.ts). */
    paper; // the keeper lights the lamps when it gets gloomy (ui/light.ts)
    flowMultiplier = 1;
    /** Coin, in pennies (money.ts). */
    purse = STARTING_PURSE;
    /** The house-wide price knob: Cheap, Fair or Dear. */
    priceLevel = "fair";
    /** "+6d" rising over a guest who's just paid (drawn, then dropped after a moment). */
    coinPops = [];
    /** Bought, coming with the carter tomorrow morning (equipment and goods ids). */
    onOrder = [];
    roads = null; // bad roads today: the carter late, or not coming till tomorrow
    carter = null; // the carter on his way today
    /** The pantry: units of each ingredient. */
    lots = startingLots(1); // the pantry, as batches by the day they came in
    /** Pencilled slips on the desk, one per supplier (item id -> packs); the last one sent to each; what's coming. */
    slips = {};
    lastSlips = {};
    deliveries = []; // standing: placed by a standing order (standingId: which)
    standing = []; // standing orders: each placed again for its delivery days
    standingSkips = []; // "standingId@day": a standing order's delivery that was cancelled, so it isn't placed again
    deliveryLog = []; // past deliveries, newest last: what came (or was fetched, or cancelled), when, and what it cost
    /** Delivered pieces waiting to be placed in the kitchen (equipment ids). */
    toPlace = [];
    nextArrivalAt = 0;
    keeper;
    patrons = [];
    orders = [];
    hatch = []; // for a hired cook later; the keeper's own cooking waits on the station shelf
    shelves = new Map(); // station id -> finished dishes waiting to be picked up
    jobs = new Map(); // furniture id -> job
    pots = new Map(); // furniture id -> communal pot
    pieSafe = [];
    dirt = new Map(); // table key "x,y" -> dirt units
    spills = [];
    footprints = []; // from the front door, fading (tracks.ts)
    crates = [];
    /** Tag flips showing over guests' heads: the old tag turning over to the new (performance.now() start). */
    tagFlips = [];
    coat = "slate"; // the keeper's coat, chosen at the wardrobe
    under = "linen"; // what shows under it: the head
    /** Each piece that cooks, by layout uid: servings made on it, and the traits it has picked up. */
    seasoning = {};
    /** The tinker's cart this week: used pieces for sale, each with its wear and price. */
    tinkerStock = [];
    /** The day the cart last had a fresh lot. */
    tinkerStockedDay;
    /** Pieces with wear on them, bought used or taken off a stove, waiting to be placed: they take this wear when they are. */
    usedWaiting = [];
    /** The tinker, called to mend a piece: due at this game day and minute. */
    tinkerCalls = [];
    /** The keeper looking a piece over or mending it (real seconds; walking away stops it). */
    mending = null;
    newGear = []; // kettles, coffee pots, Dutch ovens the carter brought, not yet set on a stove
    setDown = [];
    groups = [];
    reservations = new Map(); // table key -> group id waiting for it
    bowls = new Map(); // table key -> snack bowl (left: 0..1)
    menu = new Set(DEFAULT_MENU); // recipe ids on today's bill of fare
    menuChosen = false; // the keeper has set the bill of fare at least once
    /** Meal times mode: each meal has its own bill; between meals, only the drinks on `betweenMenu`. */
    mealMode = false;
    meals = MEALS.map((m) => ({ id: m.id, from: m.from, to: m.to, menu: new Set() }));
    betweenMenu = new Set();
    /** The meal that was on last time we looked (for "Lunch is on" in the log). */
    mealOn;
    upgrades = new Set();
    totalServed = 0; // across all days
    showObjectives = true;
    known = new Set(SKILLS_DATA.startKnown); // the recipe book
    pointsSpent = 0; // skill points spent on recipes and knacks
    xp = 0; // experience from guests served, across all days
    knacks = {}; // tiers bought
    newSkills = false; // levelled up and Skills not opened since
    hurrying = false; // F held: hurry what's cooking at the target
    walkthrough;
    cleaning = null;
    /** A drink being poured (at a tap, or a cup from the urn). Walking away stops it. */
    pouring = null;
    regulars = new Map();
    visitorNotes = [];
    stats = emptyStats(1);
    history = [];
    log = [];
    holdingSpace = false;
    keeperLine;
    frontDoor = { open: false, quick: false, openedAt: 0, clearSince: null };
    journalUnread = 0;
    journalToast; // real-time ms
    /** Item ids that left the trays through a known path this frame (the watchdog checks the rest). */
    accountedFor = new Set();
    turnInPrompted = false;
    /** "Spring is here." on the first morning of a new calendar season, until the day starts. */
    seasonNews;
    constructor() {
        const b = this.world.bedSide;
        this.keeper = {
            pos: { x: b.x + 0.5, y: b.y + 0.5 },
            facing: { x: 0, y: 1 },
            trays: [{ items: [] }, { items: [] }],
            path: [],
            running: false,
            pendingInteract: null,
        };
        this.bus.on((e) => {
            if (e.type === "Log")
                this.log.push({ at: this.minute, text: e.text });
            if (this.log.length > 60)
                this.log.shift();
        });
    }
    /** Clock hour right now, with the fraction: 13.5 is half past one; past midnight goes on to 24, 25… */
    get clockHour() {
        return TUNING.dayStartHour + this.minute / 60;
    }
    /** The meal being served right now, in meal times mode. */
    mealNow() {
        if (!this.mealMode)
            return null;
        const h = this.clockHour;
        return this.meals.find((m) => h >= m.from && h < m.to) ?? null;
    }
    /** The bill of fare that applies right now: the all-day bill, this meal's, or between meals (drinks). */
    /** What guests can order right now: the bill that's up, less anything this kitchen can't make. */
    billNow() {
        const bill = !this.mealMode ? this.menu : this.mealNow()?.menu ?? this.betweenMenu;
        return new Set([...bill].filter((r) => this.canMake(r)));
    }
    /** Everything that's on any bill today (for what to prepare). */
    billAllDay() {
        const all = !this.mealMode ? this.menu : new Set([...this.meals.flatMap((m) => [...m.menu]), ...this.betweenMenu]);
        return new Set([...all].filter((r) => this.canMake(r)));
    }
    get pieSafeCapacity() {
        return PIE_SAFE_CAPACITY * this.layout.filter((p) => p.type === "pieSafe").length;
    }
    /** The equipment moved: build the inn again around it. Seats keep who's sitting in them. */
    rebuildWorld() {
        const sitting = new Map(this.world.seats.map((s) => [s.id, s.occupant]));
        this.world = new World(this.layout, this.inn);
        for (const s of this.world.seats)
            s.occupant = sitting.get(s.id) ?? null;
        this.keeper.pendingInteract = null;
    }
    /** Move into another inn (a new save picks one): its map, its equipment where the map puts it, the keeper by the bed. */
    setInn(id) {
        this.inn = id;
        this.layout = defaultLayout(id);
        this.world = new World(this.layout, id);
        const b = this.world.bedSide;
        this.keeper.pos = { x: b.x + 0.5, y: b.y + 0.5 };
        this.keeper.path = [];
        this.keeper.pendingInteract = null;
        for (const r of [...this.menu])
            if (!this.canMake(r))
                this.menu.delete(r); // nothing on the bill you can't make here
    }
    get innDef() {
        return innOf(this.inn);
    }
    /** Whether this kitchen can make a dish at all: a barrel that pours it, or somewhere to cook it. */
    canMake(recipeId) {
        const r = RECIPES.find((x) => x.id === recipeId);
        if (!r)
            return false;
        if (servedReadyMade(this, r.id))
            return true;
        if (!r.internal && r.station !== "tap" && !this.known.has(r.id))
            return false;
        if (r.station === "tap")
            return this.world.furniture.some((f) => f.tap === r.id);
        return this.world.furniture.some((f) => (f.slots ?? []).some((sl) => sl.kinds.includes(r.station)));
    }
    say(text) {
        this.bus.emit({ type: "Log", text });
    }
    /**
     * A guest says something over their head. One voice per table at a time: if someone at the same
     * table is still talking, the line waits its turn (flushed by `flushLines`). Stale lines are dropped.
     */
    /** `toKeeper`: a reply to the keeper (a dish, a reminder) goes to the front of the queue. `weight` > 1 lingers longer. */
    speak(p, text, weight = 1, toKeeper = false) {
        const entry = { text, minutes: weight, queuedAt: this.minute };
        if (toKeeper)
            (p.lineQueue ??= []).unshift(entry);
        else
            (p.lineQueue ??= []).push(entry);
        this.flushLines();
    }
    /**
     * How long a line stays up, in game minutes, from how long it takes to read in real seconds at the
     * current speed. `min` is the shortest it may be cut to when someone else at the table wants to talk.
     */
    readTime(text, weight = 1) {
        const T = TUNING.speech;
        const secs = Math.max(T.minSeconds, Math.min(T.maxSeconds, T.baseSeconds + text.length * T.perChar)) * weight;
        const perSec = this.speed / TUNING.realSecondsPerGameMinute; // game minutes per real second
        return { full: secs * perSec, min: secs * T.cutShare * perSec };
    }
    /** Who shares a voice with this guest: their table, or just themselves at the counter or on the bench. */
    voiceOf(p) {
        const seat = this.world.seats.find((s) => s.id === p.seatId);
        return seat?.table ? `t${seat.table.x},${seat.table.y}` : `p${p.id}`;
    }
    /** Let the next waiting line through wherever its table has gone quiet (or has had long enough). */
    flushLines() {
        const waiting = new Set();
        for (const q of this.patrons) {
            const queue = q.lineQueue;
            if (!queue?.length)
                continue;
            while (queue.length && this.minute - queue[0].queuedAt > TUNING.lineStaleMinutes)
                queue.shift();
            if (queue.length && q.state !== "leaving")
                waiting.add(this.voiceOf(q));
        }
        if (!waiting.size)
            return;
        // A voice is busy while its line is up; with someone waiting, only until its minimum read.
        const busy = new Set();
        for (const q of this.patrons) {
            if (!q.line || this.minute >= q.line.until)
                continue;
            const v = this.voiceOf(q);
            if (this.minute < (waiting.has(v) ? q.line.minUntil ?? q.line.until : q.line.until))
                busy.add(v);
        }
        for (const q of this.patrons) {
            const queue = q.lineQueue;
            if (!queue?.length || q.state === "leaving")
                continue;
            const voice = this.voiceOf(q);
            if (busy.has(voice))
                continue;
            // Whoever was still talking at this table stops: one voice at a time.
            for (const o of this.patrons)
                if (o.line && this.voiceOf(o) === voice)
                    o.line.until = Math.min(o.line.until, this.minute);
            const next = queue.shift();
            const t = this.readTime(next.text, next.minutes);
            q.line = { text: next.text, until: this.minute + t.full, minUntil: this.minute + t.min };
            busy.add(voice);
        }
    }
    get speed() {
        return TUNING.speeds[this.speedIndex];
    }
    /** Clock hour 0-23 for the current minute. */
    get hour() {
        return Math.floor((TUNING.dayStartHour * 60 + this.minute) / 60) % 24;
    }
    /** Today's date: "Spring 12, year 1", a Tuesday. */
    get date() {
        return dateOf(this.day, this.calendarStart, this.loc.days);
    }
    /** Where the inn stands: how long its calendar seasons run, its weather, who passes by. */
    get loc() {
        return LOCATION_LOOKUP.get(this.location ?? "town");
    }
    /** The date of any day of play (journal entries and past days keep their day number). */
    dateOfDay(day) {
        return dateOf(day, this.calendarStart, this.loc.days);
    }
    /** Morning, midday, afternoon, evening or night: the one value everything reads. */
    get timeOfDay() {
        return timeOfDayAt(this.hour);
    }
    /** Fill {time} and {now} in a line from the time of day ("Evening", "tonight"). */
    words(text) {
        const w = TIME_WORDS[this.timeOfDay];
        return text.replaceAll("{time}", w.time).replaceAll("{now}", w.now);
    }
    /** Pick a line that fits the time of day, with its words filled in. */
    pickLine(lines) {
        const now = this.timeOfDay;
        const fits = lines.filter((l) => typeof l === "string" || l.when.includes(now));
        const l = fits[Math.floor(Math.random() * fits.length)] ?? "";
        return this.words(typeof l === "string" ? l : l.text);
    }
    clockText(minute = this.minute) {
        const total = TUNING.dayStartHour * 60 + minute;
        const h = Math.floor(total / 60) % 24;
        const m = Math.floor(total % 60);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    patron(id) {
        return this.patrons.find((p) => p.id === id);
    }
    order(id) {
        return this.orders.find((o) => o.id === id);
    }
    regular(id) {
        return id ? this.regulars.get(id) : undefined;
    }
    journal(p, text, kind = "serve") {
        const e = { day: this.day, time: this.clockText(), text, kind };
        // Anything beyond a routine serve is worth a heads-up.
        if (kind !== "serve") {
            this.journalUnread++;
            this.journalToast = { text: `📖 ${p.name}: ${text}`, until: performance.now() + 4000 };
            this.bus.emit({ type: "Paper", what: "journal" });
        }
        const r = this.regular(p.regularId);
        if (r) {
            r.journal.push(e);
            if (r.journal.length > 300)
                r.journal.splice(0, r.journal.length - 300);
        }
        else {
            this.visitorNotes.push({ ...e, text: `${p.name}: ${text}` });
            if (this.visitorNotes.length > 40)
                this.visitorNotes.shift();
        }
    }
    /** Slots on each tray: the best tray the keeper has. */
    get traySlots() {
        return bestInLine(this.upgrades, "tray")?.traySlots ?? 4;
    }
    /** The snack bowl a seat can reach: its table's, or for a stool, the nearest snack spot on the counter. */
    bowlKeyFor(seat) {
        if (!seat)
            return undefined;
        if (seat.table)
            return `${seat.table.x},${seat.table.y}`;
        if (seat.kind !== "stool")
            return undefined;
        const spot = this.world.furniture
            .filter((f) => f.kind === "snacks")
            .map((f) => ({ f, d: Math.hypot(f.tiles[0].x - seat.tile.x, f.tiles[0].y - seat.tile.y) }))
            .filter((x) => x.d <= 2.3)
            .sort((a, b) => a.d - b.d)[0];
        return spot ? `${spot.f.tiles[0].x},${spot.f.tiles[0].y}` : undefined;
    }
    regularDef(id) {
        return REGULAR_LOOKUP.get(id ?? "");
    }
}
import { REGULARS, DEFAULT_MENU, LOCATIONS, PIE_SAFE_CAPACITY, bestInLine } from "./data.js";
const LOCATION_LOOKUP = new Map(LOCATIONS.map((l) => [l.id, l]));
const REGULAR_LOOKUP = new Map(REGULARS.map((r) => [r.id, r]));
