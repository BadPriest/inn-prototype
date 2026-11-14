// The clock and the day cycle: open, last call, turn in, next morning. Days never end.

import { TUNING } from "./data.js";
import { emptyStats, type DayStats, type Game, type RegularState } from "./game.js";
import { callLastOrders, clearPatrons, scheduleRegulars, unlockRegulars } from "./patrons.js";
import { ageFood, finishAllJobs } from "./crafting.js";
import { closeAllStretches } from "./needs.js";
import { CALENDAR } from "./data.js";
import { longDate, seasonTurned } from "./calendar.js";
import { morningLine, passNight, type WeatherState } from "./weather.js";

const SAVE_KEY = "travelling-inn-proto-v3"; // v3: the calendar (older saves start fresh)

export function simDelta(g: Game, realDt: number): number {
  if (g.paused || g.modal) return 0;
  let s = (realDt / TUNING.realSecondsPerGameMinute) * g.speed;
  const quiet = !g.open || g.patrons.length === 0;
  if (quiet) s *= TUNING.quietClockBoost;
  return s;
}

export function updateClock(g: Game, simDt: number, onTurnIn: () => void): void {
  const before = g.timeOfDay;
  g.minute += simDt;
  const after = g.timeOfDay;
  if (after !== before) g.bus.emit({ type: "TimeOfDayChanged", from: before, to: after });
  if (!g.turnInPrompted && g.minute >= TUNING.dayLengthMinutes) {
    g.minute = TUNING.dayLengthMinutes;
    g.turnInPrompted = true;
    g.bus.emit({ type: "TurnInPrompted" });
    onTurnIn();
  }
}

export function toggleInn(g: Game): void {
  if (!g.open) {
    g.open = true;
    g.lastCall = false;
    g.nextArrivalAt = g.minute + 2;
    g.bus.emit({ type: "InnOpened" });
    g.say("You open the front door. The inn is open.");
  } else if (!g.lastCall) {
    g.lastCall = true;
    callLastOrders(g);
    g.bus.emit({ type: "LastCall" });
    g.say(g.words("Last call. No new orders {now}."));
  } else {
    g.open = false;
    g.lastCall = false;
    g.bus.emit({ type: "InnClosed" });
    g.say("You bolt the front door.");
  }
}

/** End the day: everyone goes home, cooking finishes, stats are kept. */
export function endDay(g: Game): DayStats {
  for (const p of g.patrons) closeAllStretches(g, p, "closing");
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

export function startNextDay(g: Game): void {
  passNight(g, 24 * 60 - TUNING.dayLengthMinutes); // turned in at 2, up at 6: the weather carried on
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
  if (seasonTurned(g.day, g.calendarStart)) {
    const s = CALENDAR.seasons.find((x) => x.id === g.date.season)!;
    g.seasonNews = s.arrives;
    g.bus.emit({ type: "CalendarSeasonChanged", season: s.id });
  }
  beginDay(g);
  g.bus.emit({ type: "DayStarted", day: g.day });
  save(g);
}

/** Morning bookkeeping: new regulars join, everyone's usual time is set. */
export function beginDay(g: Game): void {
  const joined = unlockRegulars(g);
  scheduleRegulars(g);
  if (g.seasonNews) g.say(g.seasonNews);
  g.say(`${longDate(g.date)}. You wake at 6.${g.day === 1 ? " The inn is closed; open the front door when you're ready." : ""}`);
  g.say(morningLine(g));
  if (joined.length && g.day > 1) g.say(`New in town: ${joined.join(", ")}. They may drop by.`);
}

export function save(g: Game): void {
  try {
    const regulars = [...g.regulars.values()].map(({ arriveAt, visitedToday, ...rest }) => { void arriveAt; void visitedToday; return rest; });
    // The needs log is big: keep it for the last two weeks of days only, so the save stays small.
    const history = g.history.map((d, i) => (i < g.history.length - 14 ? { ...d, unmet: undefined } : d));
    localStorage.setItem(SAVE_KEY, JSON.stringify({ day: g.day, calendarStart: g.calendarStart, weather: g.weather, history, regulars, visitorNotes: g.visitorNotes,
      menu: [...g.menu], menuChosen: g.menuChosen, upgrades: [...g.upgrades], totalServed: g.totalServed, showObjectives: g.showObjectives }));
  } catch { /* storage unavailable: carry on */ }
}

export function load(g: Game): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { save(g); return; } // a new save: keep the calendar season it starts in, even before day 1 ends
    const s = JSON.parse(raw) as { day: number; calendarStart?: number; weather?: WeatherState; history: DayStats[]; regulars?: RegularState[]; visitorNotes?: Game["visitorNotes"];
      menu?: string[]; menuChosen?: boolean; upgrades?: string[]; totalServed?: number; showObjectives?: boolean };
    if (s.menu) g.menu = new Set(s.menu);
    g.menuChosen = !!s.menuChosen;
    g.upgrades = new Set(s.upgrades ?? []);
    g.totalServed = s.totalServed ?? 0;
    g.showObjectives = s.showObjectives ?? true;
    g.day = s.day ?? 1;
    g.calendarStart = s.calendarStart ?? 0;
    if (s.weather) g.weather = s.weather;
    g.history = s.history ?? [];
    g.stats = emptyStats(g.day);
    for (const r of s.regulars ?? []) g.regulars.set(r.id, r);
    g.visitorNotes = s.visitorNotes ?? [];
  } catch { /* ignore a broken save */ }
}

export function resetSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
