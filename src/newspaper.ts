// The morning paper: a forecast and town news, read at the desk.
//
// The forecast is made by quietly running the day's weather ahead once and describing it. The real
// day rolls its own, so the forecast is a likely future, and sometimes wrong. Town news comes from
// NEWS in data.ts: market day, the calendar season, last night's weather, and a little gossip.

import { pick } from "./core.js";
import { NEWS, TUNING, timeOfDayAt, type TimeOfDay } from "./data.js";
import type { Game } from "./game.js";
import { foresee } from "./weather.js";

export interface Paper { day: number; forecast: string; news: string[]; read: boolean }

const PARTS: { id: TimeOfDay; name: string }[] = [
  { id: "morning", name: "in the morning" }, { id: "midday", name: "around midday" }, { id: "afternoon", name: "in the afternoon" },
  { id: "evening", name: "in the evening" }, { id: "night", name: "overnight" },
];

/** "Rain in the afternoon and evening, heavy at times." from a run of the day's weather. */
function describe(g: Game): string {
  const parts = new Map<TimeOfDay, { n: number; rain: number; storm: number; clear: number; grey: number }>();
  foresee(g, TUNING.dayLengthMinutes, (minute, w) => {
    const tod = timeOfDayAt(Math.floor((TUNING.dayStartHour * 60 + minute) / 60) % 24);
    const p = parts.get(tod) ?? { n: 0, rain: 0, storm: 0, clear: 0, grey: 0 };
    p.n++;
    if (w.sky === "rain") p.rain++;
    if (w.band === "storm") p.storm++;
    if (w.sky === "clear") p.clear++;
    if (w.sky === "overcast") p.grey++;
    parts.set(tod, p);
  });
  const wet = PARTS.filter((p) => { const x = parts.get(p.id); return x && x.rain / x.n > 0.35; });
  const stormy = PARTS.filter((p) => { const x = parts.get(p.id); return x && x.storm / x.n > 0.2; });
  const list = (ps: typeof PARTS) => ps.length === 1 ? ps[0].name : `${ps.slice(0, -1).map((p) => p.name).join(", ")} and ${ps[ps.length - 1].name}`;
  if (stormy.length) return `Storms likely ${list(stormy)}, ${wet.length > 2 ? "with rain on and off most of the day" : "and rain around them"}.`;
  if (wet.length >= 4) return pick(["Rain for most of the day.", "A wet day, start to finish."]);
  if (wet.length) return `Rain ${list(wet)}${wet.length === 1 ? ", dry otherwise" : ""}.`;
  const all = [...parts.values()].reduce((a, p) => ({ n: a.n + p.n, clear: a.clear + p.clear, grey: a.grey + p.grey }), { n: 0, clear: 0, grey: 0 });
  if (all.clear / all.n > 0.5) return pick(["Fine and dry, sun for much of the day.", "Clear skies, by the look of it."]);
  if (all.grey / all.n > 0.5) return pick(["Grey and dry.", "Overcast, but the rain should hold off."]);
  return pick(["Cloud and sun by turns; dry.", "Changeable, but dry."]);
}

/** Is today market day where the inn stands? */
export function marketDay(g: Game): boolean {
  return !!g.loc.marketDay && g.date.weekday === g.loc.marketDay;
}

/** Each morning: a fresh paper. */
export function deliverPaper(g: Game, stormLastNight: boolean): void {
  const news: string[] = [];
  if (marketDay(g)) news.push(NEWS.market);
  else if (g.loc.marketDay) news.push(NEWS.marketSoon.replace("{day}", g.loc.marketDay));
  if (stormLastNight) news.push(pick(NEWS.afterStorm));
  news.push(pick(NEWS.seasons[g.date.season]));
  const gossip = [...NEWS.gossip].sort(() => Math.random() - 0.5);
  news.push(...gossip.slice(0, 2));
  g.paper = { day: g.day, forecast: describe(g), news, read: false };
}
