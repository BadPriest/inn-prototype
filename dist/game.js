// The shared game state. Systems read and change it; the UI only reads it.
import { EventBus } from "./core.js";
import { World } from "./world.js";
import { TUNING } from "./data.js";
export function emptyStats(day) {
    return {
        day, arrivals: 0, served: 0, leftEarly: 0, leftUnserved: 0, crafted: 0, garnished: 0, cleaned: 0,
        outcomes: { DELIGHT: 0, PLEASED: 0, FULFILLED: 0, UNFINISHED: 0, COMPLAINS: 0 },
        moments: [],
    };
}
export function emptyTastes() {
    return { food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] } };
}
export class Game {
    bus = new EventBus();
    world = new World();
    day = 1;
    minute = 0; // minutes since the day started (6 AM)
    speedIndex = 1;
    paused = false;
    modal = false; // a modal dialog is open (sim stops)
    open = false;
    lastCall = false;
    fireLit = false;
    flowMultiplier = 1;
    nextArrivalAt = 0;
    keeper;
    patrons = [];
    orders = [];
    hatch = [];
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
    get speed() {
        return TUNING.speeds[this.speedIndex];
    }
    /** Clock hour 0-23 for the current minute. */
    get hour() {
        return Math.floor((TUNING.dayStartHour * 60 + this.minute) / 60) % 24;
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
    regularDef(id) {
        return REGULAR_LOOKUP.get(id ?? "");
    }
}
import { REGULARS, DEFAULT_MENU, TUNING as T2 } from "./data.js";
const REGULAR_LOOKUP = new Map(REGULARS.map((r) => [r.id, r]));
