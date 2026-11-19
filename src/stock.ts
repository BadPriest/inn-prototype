// The pantry: what the inn has of each ingredient, in its units. Cooking, pouring, steeping, garnishing
// and setting out snack bowls use it up; supplies (the desk) fill it. Free things (water) never run out.

import { INGREDIENTS, URN_CAPACITY, type Recipe } from "./data.js";
import type { Game } from "./game.js";
import { ECONOMY_DATA } from "./gamedata.gen.js";

export interface Use { id: string; units: number }

const ingredient = (id: string) => INGREDIENTS.find((x) => x.id === id);
export const isFree = (id: string) => (ingredient(id)?.worth ?? 0) === 0;
export const unitsOf = (id: string) => ingredient(id)?.unit ?? "unit";
export const nameOf = (id: string) => ingredient(id)?.name ?? id;
const IRREGULAR: Record<string, string> = { loaf: "loaves", pinch: "pinches", bunch: "bunches", lb: "lb", handful: "handfuls", bowlful: "bowlfuls" };
/** "1 loaf", "6 loaves", "2.5 lb". */
export function amount(id: string, n: number): string {
  const unit = unitsOf(id);
  const shown = +n.toFixed(1);
  return `${shown} ${shown === 1 ? unit : IRREGULAR[unit] ?? `${unit}s`}`;
}

export function have(g: Game, id: string): number {
  return isFree(id) ? Infinity : g.stock[id] ?? 0;
}

export function addStock(g: Game, id: string, units: number): void {
  g.stock[id] = (g.stock[id] ?? 0) + units;
}

/** What one go of a recipe takes from the pantry, with these choices. A role takes whichever ingredient with it there's enough of, cheapest first. */
export function usesOf(g: Game, r: Recipe, chosen: string[]): Use[] {
  const times = r.storedIn === "urn" ? URN_CAPACITY : 1;
  const uses: Use[] = [];
  for (const u of r.fundamental) {
    const candidates = u.role ? INGREDIENTS.filter((x) => x.roles.includes(u.role!)).sort((a, b) => a.worth - b.worth).map((x) => x.id) : [u.id];
    const id = candidates.find((c) => have(g, c) >= u.units * times) ?? u.id;
    uses.push({ id, units: u.units * times });
  }
  for (const id of chosen) {
    const units = [...r.base.options, ...r.optional.options].find((o) => o.id === id)?.units ?? 1;
    uses.push({ id, units: units * times });
  }
  if (r.boughtAs) uses.push({ id: r.boughtAs, units: 1 });
  return uses;
}

/** What's missing for these uses, if anything. */
export function shortOf(g: Game, uses: Use[]): Use[] {
  const need = new Map<string, number>();
  for (const u of uses) need.set(u.id, (need.get(u.id) ?? 0) + u.units);
  return [...need].filter(([id, n]) => have(g, id) < n).map(([id, n]) => ({ id, units: n - have(g, id) }));
}

/** Take these from the pantry, all or nothing. False (and nothing taken) if anything is short. */
export function takeStock(g: Game, uses: Use[]): boolean {
  if (shortOf(g, uses).length) return false;
  for (const u of uses) if (!isFree(u.id)) g.stock[u.id] = (g.stock[u.id] ?? 0) - u.units;
  return true;
}

/** "2 lb of beef and 1 jug of milk". */
export function describeUses(uses: Use[]): string {
  return uses.map((u) => `${amount(u.id, u.units)} of ${nameOf(u.id).toLowerCase()}`).join(" and ");
}

/** A new keeper's pantry. */
export const startingPantry = (): Record<string, number> => ({ ...ECONOMY_DATA.startingPantry });
