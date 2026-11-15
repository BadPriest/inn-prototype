// The calendar: this calendar season at a glance. Today, the days gone by with the weather they had,
// market days, and when the next calendar season begins. Regulars' habits join it once schedules exist.

import { CALENDAR, WEATHER } from "../data.js";
import type { DayStats, Game } from "../game.js";
import { compactDate } from "../calendar.js";
import { back, openMenu } from "./menu.js";

/** What the weather was on a day gone by, as one icon. */
function dayWeather(s: DayStats | undefined): string {
  const w = s?.weather;
  if (!w) return "";
  if (w.storm) return WEATHER.bands[2].icon;
  if (w.rainMinutes > 120) return WEATHER.bands[1].icon;
  if (w.rainMinutes > 0) return WEATHER.bands[0].icon;
  const sky = Object.entries(w.sky).sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof WEATHER.skies | undefined;
  return sky ? WEATHER.skies[sky].icon : "";
}

export function openCalendar(g: Game): void {
  const today = g.date;
  const seasonIndex = CALENDAR.seasons.findIndex((s) => s.id === today.season);
  const length = g.loc.days[seasonIndex];
  const first = g.day - (today.dayOfSeason - 1); // day of play on the season's first day (may be before the save began)
  const pad = (today.offset - (today.dayOfSeason - 1)) % 7; // the season's first weekday (offset 0 is a Monday)
  const byDay = new Map(g.history.map((s) => [s.day, s]));
  const cells: string[] = [];
  for (let i = 0; i < pad; i++) cells.push(`<div class="cd blank"></div>`);
  for (let n = 1; n <= length; n++) {
    const day = first + n - 1;
    const weekday = CALENDAR.weekdays[(pad + n - 1) % 7];
    const market = g.loc.marketDay === weekday;
    const cls = day === g.day ? "today" : day < g.day ? "past" : "";
    const icon = day < g.day && day >= 1 ? dayWeather(byDay.get(day)) : day === g.day ? "★" : "";
    cells.push(`<div class="cd ${cls}" title="${weekday}${market ? " · market day" : ""}"><b>${n}</b><span class="ci">${icon}${market ? "🧺" : ""}</span></div>`);
  }
  const next = CALENDAR.seasons[(seasonIndex + 1) % CALENDAR.seasons.length];
  const left = length - today.dayOfSeason + 1;
  const head = CALENDAR.weekdays.map((w) => `<div class="cw">${w.slice(0, 3)}</div>`).join("");
  openMenu({
    title: `📅 ${today.seasonName}, year ${today.year}`,
    holdsClock: true,
    subtitle: `Today is ${today.weekday}, ${compactDate(today, today.year)} of ${length}`,
    body: `<div class="cal">${head}${cells.join("")}</div>
      <p class="muted">${next.name} begins in ${left} day${left === 1 ? "" : "s"}.${g.loc.marketDay ? ` 🧺 Market day: ${g.loc.marketDay}s.` : ""} Past days show the weather they had.</p>`,
    items: [{ label: "Close", button: "secondary", action: () => back() }],
  });
}
