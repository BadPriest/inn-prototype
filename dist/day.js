// The clock and the day cycle: open, last call, turn in, next morning. Days never end.
import { TUNING } from "./data.js";
import { emptyStats } from "./game.js";
import { callLastOrders, clearPatrons, scheduleRegulars, unlockRegulars } from "./patrons.js";
import { ageFood, finishAllJobs } from "./crafting.js";
const SAVE_KEY = "travelling-inn-proto-v2";
export function simDelta(g, realDt) {
    if (g.paused || g.modal)
        return 0;
    let s = (realDt / TUNING.realSecondsPerGameMinute) * g.speed;
    const quiet = !g.open || g.patrons.length === 0;
    if (quiet)
        s *= TUNING.quietClockBoost;
    return s;
}
export function updateClock(g, simDt, onTurnIn) {
    g.minute += simDt;
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
        g.say("Last call. No new orders tonight.");
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
    g.day++;
    g.minute = 0;
    g.turnInPrompted = false;
    g.stats = emptyStats(g.day);
    ageFood(g);
    const b = g.world.bedSide;
    g.keeper.pos = { x: b.x + 0.5, y: b.y + 0.5 };
    g.keeper.path = [];
    g.keeper.pendingInteract = null;
    beginDay(g);
    g.bus.emit({ type: "DayStarted", day: g.day });
    save(g);
}
/** Morning bookkeeping: new regulars join, everyone's usual time is set. */
export function beginDay(g) {
    const joined = unlockRegulars(g);
    scheduleRegulars(g);
    g.say(`Day ${g.day}. You wake at 6.${g.day === 1 ? " The inn is closed; open the front door when you're ready." : ""}`);
    if (joined.length && g.day > 1)
        g.say(`New in town: ${joined.join(", ")}. They may drop by.`);
}
export function save(g) {
    try {
        const regulars = [...g.regulars.values()].map(({ arriveAt, visitedToday, ...rest }) => { void arriveAt; void visitedToday; return rest; });
        localStorage.setItem(SAVE_KEY, JSON.stringify({ day: g.day, history: g.history, regulars, visitorNotes: g.visitorNotes,
            menu: [...g.menu], menuChosen: g.menuChosen, upgrades: [...g.upgrades], totalServed: g.totalServed, showObjectives: g.showObjectives }));
    }
    catch { /* storage unavailable: carry on */ }
}
export function load(g) {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw)
            return;
        const s = JSON.parse(raw);
        if (s.menu)
            g.menu = new Set(s.menu);
        g.menuChosen = !!s.menuChosen;
        g.upgrades = new Set(s.upgrades ?? []);
        g.totalServed = s.totalServed ?? 0;
        g.showObjectives = s.showObjectives ?? true;
        g.day = s.day ?? 1;
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
