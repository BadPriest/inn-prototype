// The clock and the day cycle: open, last call, turn in, next morning. Days never end.
import { MEALS, TUNING } from "./data.js";
import { emptyStats } from "./game.js";
import { defaultLayout } from "./world.js";
import { callLastOrders, clearPatrons, scheduleRegulars, unlockRegulars } from "./patrons.js";
import { ageFood, finishAllJobs } from "./crafting.js";
import { closeAllStretches } from "./needs.js";
import { CALENDAR } from "./data.js";
import { longDate, seasonTurned } from "./calendar.js";
import { morningLine, passNight } from "./weather.js";
import { deliverPaper, marketDay } from "./newspaper.js";
const SAVE_KEY = "travelling-inn-proto-v3"; // v3: the calendar (older saves start fresh)
export function simDelta(g, realDt) {
    if (g.paused || g.modal || g.arranging)
        return 0;
    let s = (realDt / TUNING.realSecondsPerGameMinute) * g.speed;
    const quiet = !g.open || g.patrons.length === 0;
    if (quiet)
        s *= TUNING.quietClockBoost;
    return s;
}
/** Meal times mode: say when a meal starts and ends, while the inn is open. */
function mealChanges(g) {
    const now = g.mealNow()?.id ?? null;
    if (g.mealOn === undefined) {
        g.mealOn = now;
        return;
    }
    if (now === g.mealOn)
        return;
    const was = MEALS.find((m) => m.id === g.mealOn);
    const is = MEALS.find((m) => m.id === now);
    g.mealOn = now;
    if (!g.open)
        return;
    if (is)
        g.say(`${is.icon} ${is.name} is on: the ${is.name.toLowerCase()} bill goes up.`);
    else if (was)
        g.say(`${was.name} is over. Drinks only until the next meal.`);
}
export function updateClock(g, simDt, onTurnIn) {
    const before = g.timeOfDay;
    g.minute += simDt;
    const after = g.timeOfDay;
    if (after !== before)
        g.bus.emit({ type: "TimeOfDayChanged", from: before, to: after });
    mealChanges(g);
    if (!g.turnInPrompted && g.minute >= TUNING.dayLengthMinutes) {
        g.minute = TUNING.dayLengthMinutes;
        g.turnInPrompted = true;
        g.bus.emit({ type: "TurnInPrompted" });
        onTurnIn();
    }
}
export function toggleInn(g) {
    if (!g.open) {
        g.open = true;
        g.lastCall = false;
        g.nextArrivalAt = g.minute + 2;
        g.bus.emit({ type: "InnOpened" });
        g.say("You open the front door. The inn is open.");
    }
    else if (!g.lastCall) {
        g.lastCall = true;
        callLastOrders(g);
        g.bus.emit({ type: "LastCall" });
        g.say(g.words("Last call. No new orders {now}."));
    }
    else {
        g.open = false;
        g.lastCall = false;
        g.bus.emit({ type: "InnClosed" });
        g.say("You bolt the front door.");
    }
}
/** End the day: everyone goes home, cooking finishes, stats are kept. */
export function endDay(g) {
    for (const p of g.patrons)
        closeAllStretches(g, p, "closing");
    clearPatrons(g);
    finishAllJobs(g);
    g.open = false;
    g.lastCall = false;
    const stats = g.stats;
    g.history.push(stats);
    g.bus.emit({ type: "DayEnded", day: g.day });
    save(g);
    return stats;
}
export function startNextDay(g) {
    const stormy = g.weather.band === "storm";
    passNight(g, 24 * 60 - TUNING.dayLengthMinutes); // turned in at 2, up at 6: the weather carried on
    stormLastNight = stormy || g.weather.band === "storm";
    g.day++;
    g.minute = 0;
    g.turnInPrompted = false;
    g.stats = emptyStats(g.day);
    ageFood(g);
    const b = g.world.bedSide;
    g.keeper.pos = { x: b.x + 0.5, y: b.y + 0.5 };
    g.keeper.path = [];
    g.keeper.pendingInteract = null;
    // A new calendar season: said once, on waking. Not a big moment, but not one to miss.
    g.seasonNews = undefined;
    if (seasonTurned(g.day, g.calendarStart, g.loc.days)) {
        const s = CALENDAR.seasons.find((x) => x.id === g.date.season);
        g.seasonNews = s.arrives;
        g.bus.emit({ type: "CalendarSeasonChanged", season: s.id });
    }
    beginDay(g);
    g.bus.emit({ type: "DayStarted", day: g.day });
    save(g);
}
/** Morning bookkeeping: new regulars join, everyone's usual time is set. */
let stormLastNight = false;
export function beginDay(g) {
    const joined = unlockRegulars(g);
    scheduleRegulars(g);
    deliverPaper(g, stormLastNight);
    stormLastNight = false;
    if (g.seasonNews)
        g.say(g.seasonNews);
    g.say(`${longDate(g.date)}. You wake at 6.${g.day === 1 ? " The inn is closed; open the front door when you're ready." : ""}`);
    g.say(morningLine(g));
    if (joined.length && g.day > 1)
        g.say(`New in town: ${joined.join(", ")}. They may drop by.`);
    g.say(marketDay(g) ? "The paper's come. It's market day." : "The paper's come; it's on the desk.");
}
export function save(g) {
    try {
        const regulars = [...g.regulars.values()].map(({ arriveAt, visitedToday, ...rest }) => { void arriveAt; void visitedToday; return rest; });
        // The needs log is big: keep it for the last two weeks of days only, so the save stays small.
        const history = g.history.map((d, i) => (i < g.history.length - 14 ? { ...d, unmet: undefined } : d));
        localStorage.setItem(SAVE_KEY, JSON.stringify({ day: g.day, calendarStart: g.calendarStart, location: g.location, inn: g.inn, weather: g.weather, history, regulars, visitorNotes: g.visitorNotes,
            menu: [...g.menu], menuChosen: g.menuChosen,
            layout: g.layout, mealMode: g.mealMode, meals: g.meals.map((m) => ({ id: m.id, from: m.from, to: m.to, menu: [...m.menu] })), betweenMenu: [...g.betweenMenu], upgrades: [...g.upgrades], totalServed: g.totalServed, showObjectives: g.showObjectives,
            purse: g.purse, priceLevel: g.priceLevel }));
    }
    catch { /* storage unavailable: carry on */ }
}
export function load(g) {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) {
            save(g);
            return;
        } // a new save: keep the calendar season it starts in, even before day 1 ends
        const s = JSON.parse(raw);
        if (s.menu)
            g.menu = new Set(s.menu);
        g.menuChosen = !!s.menuChosen;
        // Saves from before there was a choice of inn are the big tavern.
        if (s.inn && s.inn !== g.inn)
            g.setInn(s.inn);
        if (Array.isArray(s.layout) && s.layout.length) {
            g.layout = s.layout;
            // Saved before barrels could be bought: they were part of the inn then, so they stand where they were.
            if (g.inn === "medium" && !g.layout.some((p) => p.type === "alekeg" || p.type === "ciderkeg")) {
                for (const p of defaultLayout())
                    if (p.type === "alekeg" || p.type === "ciderkeg")
                        g.layout.push(p);
            }
            g.rebuildWorld();
        }
        g.mealMode = !!s.mealMode;
        if (Array.isArray(s.meals))
            for (const m of s.meals) {
                const meal = g.meals.find((x) => x.id === m.id);
                if (meal) {
                    meal.from = m.from;
                    meal.to = m.to;
                    meal.menu = new Set(m.menu);
                }
            }
        if (Array.isArray(s.betweenMenu))
            g.betweenMenu = new Set(s.betweenMenu);
        g.upgrades = new Set(s.upgrades ?? []);
        g.totalServed = s.totalServed ?? 0;
        g.showObjectives = s.showObjectives ?? true;
        // Saves from before coin start with the new keeper's purse.
        if (typeof s.purse === "number")
            g.purse = s.purse;
        if (s.priceLevel)
            g.priceLevel = s.priceLevel;
        g.day = s.day ?? 1;
        g.calendarStart = s.calendarStart ?? 0;
        // Saves played before locations existed stand in the town centre; a brand-new save still has to pick.
        g.location = s.location ?? ((s.day ?? 1) > 1 || (s.history?.length ?? 0) > 0 ? "town" : undefined);
        if (s.weather)
            g.weather = s.weather;
        g.history = s.history ?? [];
        g.stats = emptyStats(g.day);
        for (const r of s.regulars ?? [])
            g.regulars.set(r.id, r);
        g.visitorNotes = s.visitorNotes ?? [];
    }
    catch { /* ignore a broken save */ }
}
export function resetSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
    }
    catch { /* ignore */ }
}
