// Upkeep (inn#60): the cost of keeping the inn open, each something you can see (economy.json upkeep).
// Firewood burns in the hearth and the wood stoves, lamp oil in the lamps, sundries go with each
// guest served; all three are pantry goods, ordered like any other. The licence is paid weekly.

import { ECONOMY_DATA } from "./gamedata.gen.js";
import { INGREDIENTS } from "./data.js";
import type { Game } from "./game.js";
import { have, takeStockFrom } from "./stock.js";

const U = ECONOMY_DATA.upkeep;
const worth = (id: string) => INGREDIENTS.find((x) => x.id === id)?.worth ?? 0;

/** Use some up, if there's enough; it counts towards today's upkeep. */
function use(g: Game, id: string, units: number): boolean {
  if (units <= 0) return true;
  if (have(g, id) < units) return false;
  takeStockFrom(g, [{ id, units }]);
  g.stats.upkeep = (g.stats.upkeep ?? 0) + worth(id) * units;
  return true;
}

/** Wood stoves with something cooking on them now. */
function stovesBurning(g: Game): number {
  return g.world.furniture.filter((f) => f.equip?.fuel === "wood" && (f.slots ?? []).some((sl) => { const j = g.jobs.get(sl.id); return j && !j.done; })).length;
}

/** Out of something: said once, until there's some again. */
const saidOut = new Set<string>();
function out(g: Game, id: string, line: string): void {
  if (saidOut.has(id)) return;
  saidOut.add(id);
  g.say(line);
}

/** Every frame the clock runs: burn wood and oil. `simMinutes`: game minutes passed. */
export function updateUpkeep(g: Game, simMinutes: number): void {
  const h = simMinutes / 60;
  const wood = U.firewood.item;
  if (g.fireLit) {
    if (!use(g, wood, U.firewood.fireLogsPerHour * h)) {
      g.fireLit = false;
      out(g, "fire", "🪵 The fire's burned down: there's no firewood left. Order some at the desk (Supplies).");
    }
  }
  const stoves = stovesBurning(g);
  g.noFirewood = stoves > 0 && !use(g, wood, U.firewood.stoveLogsPerHour * stoves * h);
  if (g.noFirewood) out(g, "stove", "🪵 No firewood for the stove: the cooking's stopped. Order some at the desk (Supplies).");
  if (g.lampsLit && !use(g, U.lampOil.item, U.lampOil.pintsPerHour * h)) {
    g.lampsLit = false;
    out(g, "oil", "🛢️ The lamps sputter out: no lamp oil left. Order some at the desk (Supplies).");
  }
  if (have(g, wood) > 0) { saidOut.delete("fire"); saidOut.delete("stove"); }
  if (have(g, U.lampOil.item) > 0) saidOut.delete("oil");
}

/** Can the lamps be lit? */
export const hasLampOil = (g: Game): boolean => have(g, U.lampOil.item) >= U.lampOil.pintsPerHour / 4;
/** Can the fire be lit? */
export const hasFirewood = (g: Game): boolean => have(g, U.firewood.item) >= 1;

/** A guest served: sundries go with it. False if there were none (tips suffer). */
export function useSundries(g: Game): boolean {
  if (use(g, U.sundries.item, U.sundries.perGuest)) { saidOut.delete("sundries"); return true; }
  out(g, "sundries", "🧻 No napkins, no soap: you're out of sundries, and guests notice. Order a box at the desk (Supplies).");
  return false;
}

/** What a tip comes to with no sundries in the house. */
export const tipWithoutSundries = (tip: number): number => Math.floor(tip * U.sundries.tipShareWithout);

/** Morning: the licence, on its weekday (not on the very first day). */
export function payLicence(g: Game): void {
  if (g.day <= 1 || g.date.weekday !== U.licence.weekday) return;
  const p = U.licence.pence;
  g.purse -= p;
  g.stats.spent = (g.stats.spent ?? 0) + p;
  g.stats.upkeep = (g.stats.upkeep ?? 0) + p;
  g.say(`🧾 The licence for the week is due: ${p}d paid.`);
}

export interface UpkeepWarning { item: string; name: string; out: boolean; left: string; coming?: string }

/** Upkeep goods running low (under about a day's worth) or out: how long what's left lasts, and what's on its way. */
export function upkeepWarnings(g: Game, comingOf: (item: string) => string | undefined): UpkeepWarning[] {
  const about = (n: number, one: string, many: string) => (n < 1 ? `less than ${one}` : `about ${Math.round(n)} ${Math.round(n) === 1 ? one.replace(/^an? /, "") : many}`);
  const goods = [
    { item: U.firewood.item, name: "🪵 Firewood", lowBelow: 15, left: (n: number) => about(n / U.firewood.fireLogsPerHour, "an hour of fire", "hours of fire"), out: "the fire won't light; wood stoves won't cook", empty: !hasFirewood(g) },
    { item: U.lampOil.item, name: "🛢️ Lamp oil", lowBelow: 1.5, left: (n: number) => about(n / U.lampOil.pintsPerHour, "an hour of light", "hours of light"), out: "the lamps won't light: fewer come in, none stay long", empty: !hasLampOil(g) },
    { item: U.sundries.item, name: "🧻 Sundries", lowBelow: 0.5, left: (n: number) => about(n / U.sundries.perGuest, "a guest", "guests"), out: "guests notice: tips are halved", empty: have(g, U.sundries.item) < U.sundries.perGuest },
  ];
  return goods.flatMap((x) => {
    const n = have(g, x.item);
    if (!x.empty && n >= x.lowBelow) return [];
    return [{ item: x.item, name: x.name, out: x.empty, left: x.empty ? x.out : x.left(n), coming: comingOf(x.item) }];
  });
}
