// World tags (inn#109): facts about the world, which every system that can sensibly react to them reads
// in its own way. Four kinds: now (the weather, the calendar season), happenings (market day, today's
// paper), history (what happened here before the keeper came), and renown (the inn's reputation, its
// own system, inn#45, still to come).

import { pick } from "./core.js";
import { CHATTER, HOT_FIRE, SEASONAL_TASTES, WEATHER_TASTES } from "./data.js";
import type { Game, Patron } from "./game.js";
import { overheated } from "./needs.js";
import { marketDay } from "./newspaper.js";
import { weatherTags } from "./weather.js";

export type WorldKind = "now" | "happening" | "history";
/** `topic` says which system made it; `line` is what a guest might say about it, where there's one. */
export interface WorldTag { kind: WorldKind; topic: "weather" | "season" | "market" | "paper" | "history"; id: string; line?: string }

export function worldTags(g: Game): WorldTag[] {
  const tags: WorldTag[] = weatherTags(g).map((id) => ({ kind: "now", topic: "weather", id }));
  tags.push({ kind: "now", topic: "season", id: g.date.season });
  if (marketDay(g)) tags.push({ kind: "happening", topic: "market", id: "market-day" });
  if (g.paper?.day === g.day) g.paper.news.forEach((news, i) => tags.push({ kind: "happening", topic: "paper", id: `paper-${i}`, line: news }));
  g.loc.history.forEach((h, i) => {
    const ago = agoText(h.yearsAgo + (g.date.year - 1));
    const text = pick(h.lines).replace("{ago}", ago).replace("{Ago}", ago[0].toUpperCase() + ago.slice(1));
    tags.push({ kind: "history", topic: "history", id: `history-${i}`, line: text });
  });
  return tags;
}

/** The dish tags the world leans towards right now: what's in season, and what the weather makes people want. */
export function favouredTags(g: Game): string[] {
  const out = new Set(SEASONAL_TASTES.inSeason[g.date.season]);
  for (const t of worldTags(g)) if (t.topic === "weather") for (const dish of WEATHER_TASTES[t.id] ?? []) out.add(dish);
  return [...out];
}

const NUMBERS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** "last year", "three years back", "forty years back". */
function agoText(years: number): string {
  const y = Math.round(years);
  if (y < 1) return "this year";
  if (y === 1) return "last year";
  if (y <= 12) return `${NUMBERS[y]} years back`;
  if (y % 10 === 0 && y <= 100) return `${["", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "a hundred"][y / 10]} years back`;
  return `${y} years back`;
}

/**
 * Something a guest says about the world: the heat by a lit fire on a hot day comes first, then now and
 * then market day, today's paper, or the old days (regulars more often than strangers).
 */
export function worldLine(g: Game, p: Patron): string | null {
  if (overheated(g, p) >= HOT_FIRE.grumbleFrom && Math.random() < 0.5) return g.pickLine(CHATTER.heat);
  if (Math.random() >= CHATTER.worldChance) return null;
  const tags = worldTags(g);
  const history = tags.filter((t) => t.kind === "history");
  const oldDays = Math.min(1, CHATTER.historyChance * (p.regularId ? 2 : 1));
  if (history.length && Math.random() < oldDays) return pick(history).line ?? null;
  const happening = tags.filter((t) => t.kind === "happening");
  if (!happening.length) return null;
  const t = pick(happening);
  if (t.topic === "market") return g.pickLine(CHATTER.world.market);
  if (t.topic === "paper" && t.line) return pick(CHATTER.world.paper).replace("{news}", t.line);
  return null;
}

let wasTooHot = false;
/** Every frame: the keeper is told when a lit fire meets a hot day (lit on one, or the day turning hot). */
export function updateWorld(g: Game): void {
  const tooHot = g.fireLit && weatherTags(g).includes("hot");
  if (tooHot && !wasTooHot) g.say("🔥 It's hot out, and the fire's lit: anyone sitting near it will be roasting. They won't stay long.");
  wasTooHot = tooHot;
}
