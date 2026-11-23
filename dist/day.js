// The clock and the day cycle: open, last call, turn in, next morning. Days never end.
import { payLicence } from "./upkeep.js";
import { chargeWear } from "./wear.js";
import { carterArrives } from "./shop.js";
import { deliveriesArrive, placeStanding, supplierDays } from "./supplies.js";
import { MEALS, TUNING, currentEquipmentId, pieceById, EQUIPMENT, currentDishId, RECIPES, DEFAULT_MENU } from "./data.js";
import { emptyStats } from "./game.js";
import { defaultLayout, setOnStove } from "./world.js";
import { callLastOrders, clearPatrons, scheduleRegulars, unlockRegulars } from "./patrons.js";
import { ageFood, finishAllJobs } from "./crafting.js";
import { closeAllStretches } from "./needs.js";
import { CALENDAR } from "./data.js";
import { longDate, seasonTurned } from "./calendar.js";
import { morningLine, passNight } from "./weather.js";
import { deliverPaper, marketDay } from "./newspaper.js";
import { SKILLS_DATA, SUPPLIERS_DATA } from "./gamedata.gen.js";
import { STEPS } from "./walkthrough.js";
import { pantryNews, startingPantry } from "./stock.js";
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
    chargeWear(g);
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
    carterArrives(g); // yesterday's orders
    deliveriesArrive(g);
    placeStanding(g);
    payLicence(g);
    const pantry = pantryNews(g);
    if (pantry)
        g.say(pantry);
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
    if (!g.menuChosen)
        g.say(`The bill of fare is on its default: guests can only order ${DEFAULT_MENU.map((id) => RECIPES.find((r) => r.id === id)?.name.toLowerCase() ?? id).join(" and ")}. Set your own at the desk.`);
}
export function save(g) {
    try {
        const regulars = [...g.regulars.values()].map(({ arriveAt, visitedToday, ...rest }) => { void arriveAt; void visitedToday; return rest; });
        // The needs log is big: keep it for the last two weeks of days only, so the save stays small.
        const history = g.history.map((d, i) => (i < g.history.length - 14 ? { ...d, unmet: undefined } : d));
        localStorage.setItem(SAVE_KEY, JSON.stringify({ day: g.day, calendarStart: g.calendarStart, location: g.location, inn: g.inn, weather: g.weather, history, regulars, visitorNotes: g.visitorNotes,
            menu: [...g.menu], menuChosen: g.menuChosen,
            layout: g.layout, mealMode: g.mealMode, meals: g.meals.map((m) => ({ id: m.id, from: m.from, to: m.to, menu: [...m.menu] })), betweenMenu: [...g.betweenMenu], upgrades: [...g.upgrades], totalServed: g.totalServed, showObjectives: g.showObjectives, walkthroughStep: g.walkthrough?.step, known: [...g.known], pointsSpent: g.pointsSpent, xp: g.xp, knacks: g.knacks, newSkills: g.newSkills, crates: g.crates, coat: g.coat, under: g.under, newGear: g.newGear,
            purse: g.purse, priceLevel: g.priceLevel, onOrder: g.onOrder, toPlace: g.toPlace, lots: g.lots, slips: g.slips, lastSlips: g.lastSlips, deliveries: g.deliveries, standing: g.standing, standingSkips: g.standingSkips, deliveryLog: g.deliveryLog }));
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
        const dishes = (ids) => new Set(ids.map(currentDishId).filter((id) => RECIPES.some((r) => r.id === id)));
        if (s.menu)
            g.menu = dishes(s.menu);
        g.menuChosen = !!s.menuChosen;
        // Saves from before there was a choice of inn are the big tavern.
        if (s.inn && s.inn !== g.inn)
            g.setInn(s.inn);
        if (Array.isArray(s.layout) && s.layout.length) {
            g.layout = s.layout.map((p) => ({ ...p, type: currentEquipmentId(p.type) }));
            // Saved when kettles and coffee pots stood on their own: they go on a stove now, or wait by the door.
            for (const q of g.layout.filter((p) => !p.on && EQUIPMENT.find((e) => e.id === p.type)?.gear)) {
                g.layout = g.layout.filter((p) => p !== q);
                if (!setOnStove(q, g.layout))
                    g.toPlace.push(q.type);
            }
            // Saved before barrels could be bought: they were part of the inn then, so they stand where they were.
            if (g.inn === "medium" && !g.layout.some((p) => p.type === "aleBarrel" || p.type === "ciderBarrel")) {
                for (const p of defaultLayout())
                    if (p.type === "aleBarrel" || p.type === "ciderBarrel")
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
                    meal.menu = dishes(m.menu);
                }
            }
        if (Array.isArray(s.betweenMenu))
            g.betweenMenu = dishes(s.betweenMenu);
        g.upgrades = new Set((s.upgrades ?? []).map(currentEquipmentId).filter((id) => pieceById(id)));
        g.totalServed = s.totalServed ?? 0;
        g.showObjectives = s.showObjectives ?? true;
        g.known = new Set([...SKILLS_DATA.startKnown, ...(Array.isArray(s.known) ? s.known.map(currentDishId) : RECIPES.map((r) => r.id))]);
        g.pointsSpent = s.pointsSpent ?? 0;
        // Saves from before experience: two for each guest served.
        g.xp = s.xp ?? g.totalServed * 2;
        g.knacks = s.knacks ?? {};
        g.newSkills = !!s.newSkills;
        g.crates = Array.isArray(s.crates) ? s.crates.map((c) => ({ ...c, day: c.day ?? g.day })) : [];
        g.coat = s.coat ?? "slate";
        g.under = s.under ?? "linen";
        g.newGear = Array.isArray(s.newGear) ? s.newGear : [];
        // A tutorial still going in the save is offered again on the welcome, never resumed on its own.
        g.walkthrough = undefined;
        savedTutorialStep = typeof s.walkthroughStep === "number" && s.walkthroughStep < STEPS.length ? s.walkthroughStep : undefined;
        // Saves from before coin start with the new keeper's purse.
        if (typeof s.purse === "number")
            g.purse = s.purse;
        if (s.priceLevel)
            g.priceLevel = s.priceLevel;
        // Saved before the pantry counted anything: it starts as a new keeper's.
        // Saves from before shelf life: what was in the pantry came in today.
        if (s.lots)
            g.lots = s.lots;
        else if (s.stock)
            g.lots = Object.fromEntries(Object.entries(s.stock).filter(([, n]) => n > 0).map(([id, units]) => [id, [{ units, day: g.day }]]));
        // Saves from before upkeep: the starting firewood, lamp oil and sundries, as if just delivered.
        for (const id of ["firewood", "lampOil", "sundries"])
            if (!(id in g.lots))
                g.lots[id] = [{ units: startingPantry()[id] ?? 0, day: g.day }];
        g.slips = s.slips ?? {};
        g.lastSlips = s.lastSlips ?? {};
        // Standing orders: a list; saves from when there was one per supplier (by supplier id) become one each, on all their days.
        const st = s.standing;
        g.standing = Array.isArray(st) ? st : Object.entries((st ?? {})).map(([supplierId, slip], i) => {
            const sup = SUPPLIERS_DATA.suppliers.find((x) => x.id === supplierId);
            return { id: -1 - i, supplierId, slip, days: sup ? supplierDays(sup) : [], paused: s.standingPaused?.includes(supplierId) || undefined };
        });
        g.standingSkips = Array.isArray(st) ? s.standingSkips ?? [] : [];
        g.deliveryLog = s.deliveryLog ?? [];
        g.deliveries = s.deliveries ?? [];
        g.onOrder = (s.onOrder ?? []).map(currentEquipmentId).filter((id) => pieceById(id));
        g.toPlace = [...g.toPlace, ...(s.toPlace ?? []).map(currentEquipmentId).filter((id) => pieceById(id))];
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
/** The tutorial's step in the save, if it was still going: offered on the welcome (main.ts). */
export let savedTutorialStep;
export function resetSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
    }
    catch { /* ignore */ }
}
