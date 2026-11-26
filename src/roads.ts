// The carter and the roads (inn#111): he comes by 8 in the morning, unless snow or a location's bad
// roads (climate carterLate) hold him up, for a few hours or till the next morning. The paper says so.
// Tuning: ROADS.

import { chance, organic, pick } from "./core.js";
import { ROADS, TUNING } from "./data.js";
import type { Game } from "./game.js";
import { carterArrives } from "./shop.js";
import { deliveriesArrive } from "./supplies.js";

/** Bad roads today: shut till tomorrow, or only slow; whether it's snow that did it. */
export interface Roads { shut: boolean; snow: boolean }
/** The carter on his way today: the game minute he comes, and how many of the pieces on order he brings (those ordered before he set out). */
export interface CarterRound { at: number; pieces: number }

/** Chance the roads are bad this morning: snow falling or just fallen, and the location's own roads. */
export function badRoadsChance(g: Game): number {
  const w = g.weather;
  const snow = w.band && w.snow ? ROADS.snow[w.band] ?? 0 : w.afterSnow > 0 ? ROADS.afterSnow : 0;
  const roads = g.loc.climate[g.date.season].carterLate ?? 0;
  return 1 - (1 - snow) * (1 - roads);
}

/** Morning, before the paper comes: are the roads bad, and if so, shut till tomorrow or only slow? */
export function roadsThisMorning(g: Game): void {
  g.roads = null;
  if (!chance(badRoadsChance(g))) return;
  const w = g.weather;
  const snow = !!(w.band && w.snow) || w.afterSnow > 0;
  const blizzard = w.snow && w.band === "storm";
  g.roads = { shut: chance(blizzard ? ROADS.tomorrow.blizzard : ROADS.tomorrow.otherwise), snow };
}

/** Morning: if anything's due, set when the carter comes (by 8, or later on bad roads), or put it off till tomorrow. */
export function carterSetsOut(g: Game): void {
  g.carter = null;
  const due = g.deliveries.filter((d) => d.day <= g.day);
  if (!g.onOrder.length && !due.length) return;
  const r = g.roads;
  if (r?.shut) {
    for (const d of due) d.day = g.day + 1;
    g.say(pick(ROADS.said.tomorrow));
    return;
  }
  const byEight = (ROADS.onTimeBy - TUNING.dayStartHour) * 60;
  let at = Math.min(byEight, Math.max(ROADS.earliest, organic(ROADS.onTime)));
  if (r) {
    at = Math.min((ROADS.latestHour - TUNING.dayStartHour) * 60, byEight + Math.max(60, organic(ROADS.hoursLate) * 60));
    g.say(pick(ROADS.said.late));
  }
  g.carter = { at: Math.round(at), pieces: g.onOrder.length };
}

/** Every frame the clock runs: the carter turns up. */
export function updateCarter(g: Game): void {
  const c = g.carter;
  if (!c || g.minute < c.at) return;
  g.carter = null;
  carterArrives(g, c.pieces);
  deliveriesArrive(g);
}

/** The paper's line about the roads, if they're bad. */
export function roadsNews(g: Game): string | undefined {
  const r = g.roads;
  if (!r) return undefined;
  return pick(r.shut && r.snow ? ROADS.paper.tomorrow : r.snow ? ROADS.paper.snow : ROADS.paper.roads);
}

/** For the slip: when the carter comes, and that the roads can hold him up (the pass, where there is one). */
export function roadsNote(g: Game): string {
  const pass = Object.values(g.loc.climate).some((c) => (c.carterLate ?? 0) > 0);
  return pass ? ROADS.slipNote.pass : ROADS.slipNote.plain;
}
