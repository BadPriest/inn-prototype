// Building work (inn#117): work on the inn itself, bought at the desk. Each piece raises the building's insulation,
// which the room's warmth reads, and they come in order. The builders come the morning after it's paid for; some work
// keeps the inn shut for a day or more, and it's done the morning after that.

import { BUILDING_DATA } from "./gamedata.gen.js";
import type { BuildingUpgrade } from "./gamedata.js";
import type { Game } from "./game.js";
import { spend } from "./money.js";

export const BUILDING_WORK: BuildingUpgrade[] = BUILDING_DATA.upgrades;
const workById = (id: string) => BUILDING_WORK.find((u) => u.id === id);

/** The next piece of work the building can have, if any. */
export const nextWork = (g: Game): BuildingUpgrade | undefined => BUILDING_WORK.find((u) => !g.buildingDone.includes(u.id));

/** Paid now; the builders come in the morning. False if it's not the next piece, work's already booked, or the purse is short. */
export function orderWork(g: Game, id: string): boolean {
  const u = nextWork(g);
  if (g.works || !u || u.id !== id || !spend(g, u.price)) return false;
  g.works = { id, from: g.day + 1, until: g.day + 1 + u.daysClosed };
  g.say(u.daysClosed
    ? `🔨 Booked: ${u.name.toLowerCase()}. The builders come in the morning, and the inn stays shut for ${u.daysClosed === 1 ? "the day" : `${u.daysClosed} days`}.`
    : `🔨 Booked: ${u.name.toLowerCase()}. The builder works through the night; it'll be done by morning.`);
  return true;
}

/** Morning: work that's finished is done; work under way keeps the inn shut today. */
export function worksThisMorning(g: Game): void {
  const w = g.works;
  const u = w && workById(w.id);
  if (!w || !u) { g.works = null; return; }
  if (g.day >= w.until) {
    g.buildingDone.push(u.id);
    g.insulation = u.insulation;
    g.works = null;
    g.room.temp = null;
    g.say(`🔨 The builders are done: ${u.name.toLowerCase()}. The inn keeps its warmth better now.`);
  } else if (g.day >= w.from) g.say(`🔨 The builders are in today (${u.name.toLowerCase()}): the inn stays shut. They'll be done ${w.until - g.day === 1 ? "by tomorrow morning" : `in ${w.until - g.day} days`}.`);
}

/** The builders are in: the inn can't open today. */
export const shutForWork = (g: Game): boolean => !!g.works && g.day >= g.works.from && g.day < g.works.until;

/** The building's insulation in a word, for the desk. */
export function insulationName(level: number): string {
  return ["very draughty", "draughty", "fair", "snug", "very snug"][Math.max(0, Math.min(4, Math.round(level) + 2))];
}
