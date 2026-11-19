// The pantry: what the inn has of each ingredient, in its units, as batches by the day they came in.
// Cooking, pouring, steeping, garnishing and setting out snack bowls use it up, fresh first;
// supplies fill it. Free things (water) never run out.
//
// Shelf life (inn#63): a batch ages from the morning after it arrives, through its ingredient's
// spoilage profile (data/spoilage.json): fresh, then on the turn, stale, spoiled. Older batches are
// used only once the fresh runs out, and a dish made with them takes that stage's tags (day-old, sour…). Spoiled batches can't be used, and
// stay on the shelves until they're cleared.

import { INGREDIENTS, TUNING, URN_CAPACITY, dishData, type Recipe } from "./data.js";
import type { Game } from "./game.js";
import { ECONOMY_DATA, INGREDIENTS_DATA, SPOILAGE_DATA } from "./gamedata.gen.js";
import type { StageEffect } from "./gamedata.js";

/** Some of an ingredient. `stages`: the only stages a dish takes it at (stale fish won't fry); any, if not given. */
export interface Use { id: string; units: number; stages?: string[] }
/** A batch on the shelves: how much, and the day it came in. */
export interface Lot { units: number; day: number }

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

// ---------------------------------------------------------------------------
// Ageing

export interface Stage { id: string; index: number; last: boolean; effect: StageEffect; nextAt?: number }

const NO_EFFECT: StageEffect = { addTags: [], removeTags: [], priceFactor: 1, tastePenalty: 0 };

/** Its stages in order (by the age, in days, each starts at). */
function stagesOf(id: string): { id: string; at: number; effect: StageEffect }[] {
  const ing = INGREDIENTS_DATA.ingredients.find((x) => x.id === id);
  const profile = SPOILAGE_DATA.profiles[ing?.spoilage ?? "keeps"] ?? SPOILAGE_DATA.profiles.keeps;
  return Object.entries(profile.stages).sort((a, b) => a[1] - b[1]).map(([sid, at]) => ({
    id: sid, at,
    effect: { ...NO_EFFECT, ...SPOILAGE_DATA.stageEffects[sid], ...profile.stageEffects?.[sid], ...ing?.spoilageOverrides?.[sid] } as StageEffect,
  }));
}

/** Days old: nothing ages on the day it arrives; from the next morning, by the clock. */
export const ageOf = (g: Game, lot: Lot): number => Math.max(0, g.day + g.minute / TUNING.dayLengthMinutes - (lot.day + 1));

export function stageOf(g: Game, id: string, lot: Lot): Stage {
  const stages = stagesOf(id);
  const age = ageOf(g, lot);
  let i = 0;
  while (i + 1 < stages.length && age >= stages[i + 1].at) i++;
  return { id: stages[i].id, index: i, last: i === stages.length - 1, effect: stages[i].effect, nextAt: stages[i + 1] ? stages[i + 1].at - age : undefined };
}

const usable = (g: Game, id: string, lot: Lot) => !stageOf(g, id, lot).effect.unservable;

/** A stage's name for people: "fresh", "on the turn", "stale", "spoiled", "sour"… */
export function stageName(stageId: string): string {
  return ({ fresh: "fresh", onTheTurn: "on the turn", stale: "stale", spoiled: "spoiled", sour: "sour", curdled: "curdled", flat: "flat" } as Record<string, string>)[stageId] ?? stageId;
}

// ---------------------------------------------------------------------------
// What's there

export const lotsOf = (g: Game, id: string): Lot[] => g.lots[id] ?? [];

/** Usable stock: everything but spoiled batches. */
/** Can a batch be used: not spoiled, and at a stage the dish takes (when it says). */
function allowed(g: Game, id: string, lot: Lot, stages?: string[]): boolean {
  const s = stageOf(g, id, lot);
  return !s.effect.unservable && (!stages || stages.includes(s.id));
}

/** Usable stock: everything but spoiled batches, and (with `stages`) only batches at those stages. */
export function have(g: Game, id: string, stages?: string[]): number {
  if (isFree(id)) return Infinity;
  return lotsOf(g, id).reduce((n, l) => n + (allowed(g, id, l, stages) ? l.units : 0), 0);
}

/** Everything on the shelves, by how it's keeping: fresh, past fresh (still usable), spoiled. */
export function condition(g: Game, id: string): { fresh: number; turning: number; spoiled: number; turningStage?: string; nextTurn?: number } {
  const out = { fresh: 0, turning: 0, spoiled: 0 } as { fresh: number; turning: number; spoiled: number; turningStage?: string; nextTurn?: number };
  for (const l of lotsOf(g, id)) {
    const s = stageOf(g, id, l);
    if (s.effect.unservable) out.spoiled += l.units;
    else if (s.index === 0) { out.fresh += l.units; if (s.nextAt !== undefined) out.nextTurn = Math.min(out.nextTurn ?? Infinity, s.nextAt); }
    else { out.turning += l.units; out.turningStage ??= s.id; }
  }
  return out;
}

export function addStock(g: Game, id: string, units: number, day = g.day): void {
  if (units <= 0 || isFree(id)) return;
  const lots = (g.lots[id] ??= []);
  const same = lots.find((l) => l.day === day);
  if (same) same.units += units;
  else { lots.push({ units, day }); lots.sort((a, b) => a.day - b.day); }
}

/** What one go of a recipe takes from the pantry, with these choices. A role takes whichever ingredient with it there's enough of, cheapest first. */
export function usesOf(g: Game, r: Recipe, chosen: string[]): Use[] {
  const times = r.storedIn === "urn" ? URN_CAPACITY : 1;
  const uses: Use[] = [];
  // The stages each ingredient is taken at, from the dish's data (bread pudding wants yesterday's bread).
  const dish = dishData(r.id)?.ingredients;
  r.fundamental.forEach((u, i) => {
    const stages = dish?.fundamental[i]?.stages;
    const candidates = u.role ? INGREDIENTS.filter((x) => x.roles.includes(u.role!)).sort((a, b) => a.worth - b.worth).map((x) => x.id) : [u.id];
    const id = candidates.find((c) => have(g, c, stages) >= u.units * times) ?? u.id;
    uses.push({ id, units: u.units * times, stages });
  });
  for (const id of chosen) {
    const units = [...r.base.options, ...r.optional.options].find((o) => o.id === id)?.units ?? 1;
    const stages = [...(dish?.base.options ?? []), ...(dish?.optional.options ?? [])].find((o) => o.id === id)?.stages;
    uses.push({ id, units: units * times, stages });
  }
  if (r.boughtAs) uses.push({ id: r.boughtAs, units: 1 });
  return uses;
}

/** What's missing for these uses, if anything. */
export function shortOf(g: Game, uses: Use[]): Use[] {
  const need = new Map<string, Use>();
  for (const u of uses) {
    const k = `${u.id}|${u.stages?.join(",") ?? ""}`;
    const n = need.get(k);
    need.set(k, { id: u.id, units: (n?.units ?? 0) + u.units, stages: u.stages });
  }
  return [...need.values()].filter((u) => have(g, u.id, u.stages) < u.units).map((u) => ({ id: u.id, units: u.units - have(g, u.id, u.stages), stages: u.stages }));
}

/** What a dish made from what was taken carries: the tags of anything past fresh. */
export interface Taken { addTags: string[]; removeTags: string[]; past: { id: string; stage: string }[] }

/**
 * Take these from the pantry, all or nothing; null (and nothing taken) if anything is short. Fresh
 * first, the oldest of the fresh first, and older batches only when the fresh runs out; a dish that
 * wants it past fresh (bread pudding) takes the oldest first.
 */
export function takeStockFrom(g: Game, uses: Use[]): Taken | null {
  if (shortOf(g, uses).length) return null;
  const taken: Taken = { addTags: [], removeTags: [], past: [] };
  for (const u of uses) {
    if (isFree(u.id)) continue;
    let left = u.units;
    const wantsOld = !!u.stages && !u.stages.includes("fresh");
    const order = lotsOf(g, u.id).filter((l) => allowed(g, u.id, l, u.stages))
      .sort((a, b) => (wantsOld ? 0 : stageOf(g, u.id, a).index - stageOf(g, u.id, b).index) || a.day - b.day);
    for (const l of order) {
      if (left <= 1e-9) break;
      const s = stageOf(g, u.id, l);
      const n = Math.min(left, l.units);
      l.units -= n;
      left -= n;
      if (s.index > 0) {
        taken.addTags.push(...s.effect.addTags);
        taken.removeTags.push(...s.effect.removeTags);
        if (!taken.past.some((p) => p.id === u.id)) taken.past.push({ id: u.id, stage: s.id });
      }
    }
    g.lots[u.id] = lotsOf(g, u.id).filter((l) => l.units > 1e-9);
  }
  taken.addTags = [...new Set(taken.addTags.filter((t) => t !== "fresh"))];
  taken.removeTags = [...new Set(taken.removeTags)];
  return taken;
}

export const takeStock = (g: Game, uses: Use[]): boolean => takeStockFrom(g, uses) !== null;

/** Put what was taken onto a dish: its tags, and what's past fresh in its name's notes. */
export function applyTaken(tags: string[], taken: Taken | null | undefined): string[] {
  if (!taken || (!taken.addTags.length && !taken.removeTags.length)) return tags;
  return [...new Set([...tags.filter((t) => !taken.removeTags.includes(t)), ...taken.addTags])];
}

/** Throw out everything of one ingredient that's past fresh (on the turn, stale or spoiled). How much went. */
export function throwOutPastFresh(g: Game, id: string): number {
  let n = 0;
  g.lots[id] = lotsOf(g, id).filter((l) => { if (stageOf(g, id, l).index === 0) return true; n += l.units; return false; });
  return n;
}

/** Clear out every spoiled batch. What went, by ingredient. */
export function clearSpoiled(g: Game): Use[] {
  const gone: Use[] = [];
  for (const id of Object.keys(g.lots)) {
    let n = 0;
    g.lots[id] = lotsOf(g, id).filter((l) => { if (usable(g, id, l)) return true; n += l.units; return false; });
    if (n > 0) gone.push({ id, units: n });
  }
  return gone;
}

/** Everything that's spoiled now, by ingredient. */
export function spoiledNow(g: Game): Use[] {
  return Object.keys(g.lots).map((id) => ({ id, units: condition(g, id).spoiled })).filter((u) => u.units > 0);
}

/** Past fresh is all that's left (no fresh batch): its stage. Null while there's fresh. */
export function nextPastFresh(g: Game, id: string): string | null {
  let best: Stage | null = null;
  for (const l of lotsOf(g, id)) {
    const s = stageOf(g, id, l);
    if (s.effect.unservable || l.units <= 1e-9) continue;
    if (!best || s.index < best.index) best = s;
  }
  return best && best.index > 0 ? best.id : null;
}

/** Waking: what's turned or spoiled on the shelves, in a line (or nothing, if it's all fresh). */
export function pantryNews(g: Game): string | null {
  const byStage = new Map<string, string[]>();
  const spoiled: string[] = [];
  for (const id of Object.keys(g.lots)) {
    const c = condition(g, id);
    const name = nameOf(id).toLowerCase();
    if (c.spoiled > 0) spoiled.push(name);
    if (c.turning > 0) { const st = stageName(c.turningStage ?? "onTheTurn"); byStage.set(st, [...(byStage.get(st) ?? []), name]); }
  }
  if (!byStage.size && !spoiled.length) return null;
  const list = (xs: string[]) => (xs.length > 4 ? `${xs.slice(0, 4).join(", ")} and ${xs.length - 4} more` : xs.join(", "));
  const turned = [...byStage].map(([st, xs]) => `${st}: ${list(xs)}`).join("; ");
  return `🧺 In the pantry${turned ? `, ${turned}. Use it first.` : "."}${spoiled.length ? ` Spoiled: ${list(spoiled)}. Clear it out at the pantry.` : ""}`;
}

/** "2 lb of beef and 1 jug of milk". */
export function describeUses(uses: Use[]): string {
  return uses.map((u) => `${amount(u.id, u.units)} of ${nameOf(u.id).toLowerCase()}`).join(" and ");
}

/** A new keeper's pantry, as amounts. */
export const startingPantry = (): Record<string, number> => ({ ...ECONOMY_DATA.startingPantry });

/** A new keeper's pantry, as batches that came in today. */
export function startingLots(day: number): Record<string, Lot[]> {
  return Object.fromEntries(Object.entries(startingPantry()).map(([id, units]) => [id, [{ units, day }]]));
}
