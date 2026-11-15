// The shared game state. Systems read and change it; the UI only reads it.
import { EventBus } from "./core.js";
import { World } from "./world.js";
import { dateOf, randomStartSeason } from "./calendar.js";
import { newWeather } from "./weather.js";
import { TIME_WORDS, TUNING, timeOfDayAt } from "./data.js";
export function emptyStats(day) {
    return {
        day, arrivals: 0, served: 0, leftEarly: 0, leftUnserved: 0, crafted: 0, garnished: 0, cleaned: 0,
        outcomes: { DELIGHT: 0, PLEASED: 0, FULFILLED: 0, UNFINISHED: 0, COMPLAINS: 0 },
        moments: [], unmet: [], weather: { rainMinutes: 0, storm: false, sky: {} },
    };
}
export function emptyTastes() {
    return { food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] } };
}
export class Game {
    bus = new EventBus();
    world = new World();
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
    lampsLit = false;
    /** The gramophone: playing or not, which record, and how many records the spring has left. */
    gramophone = { on: false, record: 0, spring: 0 }; // spring: seconds of music left in it
    /** The keeper winding the gramophone (real seconds; walking away stops it). */
    winding = null;
    /** This morning's paper (newspaper.ts). */
    paper; // the keeper lights the lamps when it gets gloomy (ui/light.ts)
    flowMultiplier = 1;
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
    setDown = [];
    groups = [];
    reservations = new Map(); // table key -> group id waiting for it
    bowls = new Map(); // table key -> snack bowl (left: 0..1)
    menu = new Set(DEFAULT_MENU); // recipe ids on today's bill of fare
    menuChosen = false; // the keeper has set the bill of fare at least once
    upgrades = new Set();
    totalServed = 0; // across all days
    showObjectives = true;
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
            trays: [{ kind: null, items: [] }, { kind: null, items: [] }],
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
    say(text) {
        this.bus.emit({ type: "Log", text });
    }
    /**
     * A guest says something over their head. One voice per table at a time: if someone at the same
     * table is still talking, the line waits its turn (flushed by `flushLines`). Stale lines are dropped.
     */
    /** `toKeeper`: a reply to the keeper (a dish, a reminder) goes to the front of the queue. */
    speak(p, text, minutes = 6, toKeeper = false) {
        const entry = { text, minutes, queuedAt: this.minute };
        if (toKeeper)
            (p.lineQueue ??= []).unshift(entry);
        else
            (p.lineQueue ??= []).push(entry);
        this.flushLines();
    }
    /** Who shares a voice with this guest: their table, or just themselves at the counter or on the bench. */
    voiceOf(p) {
        const seat = this.world.seats.find((s) => s.id === p.seatId);
        return seat?.table ? `t${seat.table.x},${seat.table.y}` : `p${p.id}`;
    }
    /** Let the next waiting line through wherever its table has gone quiet. */
    flushLines() {
        const talking = new Set();
        for (const q of this.patrons)
            if (q.line && this.minute < q.line.until)
                talking.add(this.voiceOf(q));
        for (const q of this.patrons) {
            const queue = q.lineQueue;
            if (!queue?.length)
                continue;
            while (queue.length && this.minute - queue[0].queuedAt > TUNING.lineStaleMinutes)
                queue.shift();
            if (!queue.length || q.state === "leaving")
                continue;
            const voice = this.voiceOf(q);
            if (talking.has(voice))
                continue;
            const next = queue.shift();
            q.line = { text: next.text, until: this.minute + next.minutes };
            talking.add(voice);
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
    /** Tray capacity, with upgrades. */
    trayCap(kind) {
        return T2.trayCapacity[kind] + (this.upgrades.has("trays") ? 1 : 0);
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
import { REGULARS, DEFAULT_MENU, LOCATIONS, TUNING as T2 } from "./data.js";
const LOCATION_LOOKUP = new Map(LOCATIONS.map((l) => [l.id, l]));
const REGULAR_LOOKUP = new Map(REGULARS.map((r) => [r.id, r]));
