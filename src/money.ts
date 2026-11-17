// Coin (Nov 17 economy session). Three coins, ten of each to the next: 10d = 1s, 10s = 1 crown.
// Guests always pay for what they ordered; tips follow the reaction; unasked serves are on the house.
// Prices come from the dish and what went in it, never inflate, and move only with the house knob.
//
// Kept apart from reputation and knowledge: coin is spent, the other two never are.

import type { Outcome } from "./core.js";
import type { Game, Item, Patron } from "./game.js";

/** All money is counted in pennies. */
export const PENCE_PER_SHILLING = 10;
export const PENCE_PER_CROWN = 100;
/** What a new keeper starts with: about two crowns (a week's restock and one small buy). */
export const STARTING_PURSE = 2 * PENCE_PER_CROWN;

/** 247 → "2 cr 4s 7d". Zero parts are left out; nothing at all is "0d". */
export function fmtMoney(pence: number): string {
  const neg = pence < 0;
  let d = Math.abs(Math.round(pence));
  const cr = Math.floor(d / PENCE_PER_CROWN); d -= cr * PENCE_PER_CROWN;
  const s = Math.floor(d / PENCE_PER_SHILLING); d -= s * PENCE_PER_SHILLING;
  const parts = [cr ? `${cr} cr` : "", s ? `${s}s` : "", d || (!cr && !s) ? `${d}d` : ""].filter(Boolean);
  return `${neg ? "−" : ""}${parts.join(" ")}`;
}

/** The three coins, as drawn: a small turned coin in its metal, then the count. */
export type CoinId = "cr" | "s" | "d";
export const COINS: Record<CoinId, { name: string; face: string; rim: string; edge: string }> = {
  cr: { name: "crown", face: "#f6d24a", rim: "#b8860b", edge: "#8a6208" },
  s: { name: "shilling", face: "#e3e8ec", rim: "#9aa4ad", edge: "#6d767e" },
  d: { name: "penny", face: "#d98a4e", rim: "#9a5527", edge: "#6e3a17" },
};

/** 193 → [1 crown, 9 shillings, 3 pence]. Zero coins are left out; nothing at all is 0 pence. */
export function coinParts(pence: number): { coin: CoinId; n: number }[] {
  let d = Math.abs(Math.round(pence));
  const cr = Math.floor(d / PENCE_PER_CROWN); d -= cr * PENCE_PER_CROWN;
  const s = Math.floor(d / PENCE_PER_SHILLING); d -= s * PENCE_PER_SHILLING;
  const parts: { coin: CoinId; n: number }[] = [];
  if (cr) parts.push({ coin: "cr", n: cr });
  if (s) parts.push({ coin: "s", n: s });
  if (d || !parts.length) parts.push({ coin: "d", n: d });
  return parts;
}

/** Money for the screen (HTML): each coin drawn, then its count. The words are kept for screen readers and hover. */
export function moneyHtml(pence: number): string {
  const coins = coinParts(pence).map((p) => `<span class="cn"><i class="coin ${p.coin}"></i>${p.n}</span>`).join("");
  return `<span class="money" title="${fmtMoney(pence)}" aria-label="${fmtMoney(pence)}">${pence < 0 ? "−" : ""}${coins}</span>`;
}

// ---------------------------------------------------------------------------
// Prices. Placeholders from the session's baseline (ale 4d, tea 3d, stew 6d), to be tuned in play.

/** What a dish sells for at Fair, in pennies: the dish and its prep. */
const DISH_PRICE: Record<string, number> = {
  ale: 4, cider: 4, tea: 3, coffee: 3,
  stew: 6, porridge: 3, fish: 7, pie: 6, salad: 5, scrambled: 5, toast: 3, fryup: 8, bread: 2, roast: 9,
};
/** Dearer things that go in it add to the price. Everything else is in the dish's price already. */
const INGREDIENT_EXTRA: Record<string, number> = { beef: 1, sausage: 1, meat: 1, bacon: 1, cheese: 1, herring: 1, pork: 1, lamb: 2, fowl: 1 };
/** A garnish on a drink: a penny. */
const GARNISH_EXTRA = 1;

export type PriceLevel = "cheap" | "fair" | "dear";
export const PRICE_LEVELS: { id: PriceLevel; name: string; factor: number; flow: number; blurb: string }[] = [
  { id: "cheap", name: "Cheap", factor: 0.75, flow: 1.1, blurb: "a quarter off everything; a few more come in" },
  { id: "fair", name: "Fair", factor: 1, flow: 1, blurb: "what things are worth" },
  { id: "dear", name: "Dear", factor: 1.3, flow: 0.9, blurb: "a bit more on everything; a few fewer come in" },
];
export const priceLevel = (g: Game) => PRICE_LEVELS.find((l) => l.id === g.priceLevel) ?? PRICE_LEVELS[1];

/** What a dish on the bill sells for now (no ingredients chosen: the plain dish). */
export function priceOfRecipe(g: Game, recipeId: string, options: string[] = [], garnished = false): number {
  const base = (DISH_PRICE[recipeId] ?? 4) + options.reduce((a, o) => a + (INGREDIENT_EXTRA[o] ?? 0), 0) + (garnished ? GARNISH_EXTRA : 0);
  return Math.max(1, Math.round(base * priceLevel(g).factor));
}

export function priceOf(g: Game, item: Item): number {
  return priceOfRecipe(g, item.recipeId, item.options ?? [], !!item.garnish);
}

/** A tip, by how it went: a Delight tips well, Pleased a little, anything else nothing. Modest either way. */
export function tipFor(outcome: Outcome, price: number): number {
  if (outcome === "DELIGHT") return Math.max(2, Math.round(price * 0.5));
  if (outcome === "PLEASED") return Math.max(1, Math.round(price * 0.15));
  return 0;
}

/** Coin changes hands: into the purse, onto the day's tally, and a little "+6d" over the guest. */
export function takeCoin(g: Game, p: Patron, paid: number, tip: number, delight = false): void {
  if (paid <= 0 && tip <= 0) return;
  g.purse += paid + tip;
  g.stats.taken = (g.stats.taken ?? 0) + paid;
  g.stats.tips = (g.stats.tips ?? 0) + tip;
  g.coinPops.push({ x: p.pos.x, y: p.pos.y, paid, tip, at: performance.now() });
  g.bus.emit({ type: "CoinPaid", patronId: p.id, paid, tip, delight });
}

/** Spend from the purse (equipment, upkeep, supplies: later tasks). False if there isn't enough. */
export function spend(g: Game, pence: number): boolean {
  if (g.purse < pence) return false;
  g.purse -= pence;
  g.stats.spent = (g.stats.spent ?? 0) + pence;
  return true;
}
