// Buying equipment and goods (inn#59). Everything costs coin. What you order comes with the carter the next
// morning; or you fetch it yourself straight away, at the cost of your time (the inn has to be shut and
// empty: nobody minds the room while you're out). A delivered piece waits to be placed (Arrange the
// kitchen). What you no longer want sells back for half its price.
//
// No secondhand pieces yet: those come with the tinker (inn#66). The carter is a message for now; his
// cart and the crates in the kitchen come with inn#62.

import { CARRIED, TUNING, bestInLine, pieceById } from "./data.js";
import type { Game } from "./game.js";
import { spend } from "./money.js";
import { ECONOMY_DATA } from "./gamedata.gen.js";

export const priceOfThing = (id: string): number => pieceById(id)?.price ?? 100;
export const sellBackPrice = (id: string): number => Math.floor(priceOfThing(id) * ECONOMY_DATA.sellBackShare);
export const FETCH_MINUTES = ECONOMY_DATA.fetchMinutes;
export const SELL_BACK_SHARE_WORDS = ECONOMY_DATA.sellBackShare === 0.5 ? "half" : `${Math.round(ECONOMY_DATA.sellBackShare * 100)}% of`;

const nameOf = (id: string) => pieceById(id)?.name ?? id;
/** Utensils and trays: owned and used, never placed. */
export const isCarried = (id: string) => CARRIED.some((x) => x.id === id);
/** The hearth the inn has now. */
export const hearthPiece = (g: Game) => g.layout.find((p) => pieceById(p.type)?.hearth);
/** Bought once, never placed by hand: utensils, trays, and the hearth. */
export const isUpgrade = (id: string) => isCarried(id) || !!pieceById(id)?.hearth;
/** A utensil, tray or hearth the keeper has, or has something better in its line. */
export function hasOrBetter(g: Game, id: string): boolean {
  const p = pieceById(id);
  if (!p?.line) return false;
  if (p.hearth) return (pieceById(hearthPiece(g)?.type ?? "")?.tier ?? 1) >= (p.tier ?? 1);
  return (bestInLine(g.upgrades, p.line)?.tier ?? 0) >= (p.tier ?? 1);
}

/** You can only go out when there's nobody to look after. */
export function canFetch(g: Game): boolean {
  return !g.open && g.patrons.length === 0;
}

/** How many of this are coming with the carter, or have come and wait to be placed. */
export const onOrderCount = (g: Game, id: string) => g.onOrder.filter((x) => x === id).length;
export const toPlaceCount = (g: Game, id: string) => g.toPlace.filter((x) => x === id).length;

/** Order it: paid now, the carter brings it tomorrow morning. False if the purse is short. */
export function orderThing(g: Game, id: string): boolean {
  if (!spend(g, priceOfThing(id))) return false;
  g.onOrder.push(id);
  g.say(`Ordered: ${nameOf(id).toLowerCase()}. The carter brings it tomorrow morning.`);
  return true;
}

/** Fetch it yourself: paid now, and you're out for a while; it's here when you get back. */
export function fetchThing(g: Game, id: string): boolean {
  if (!canFetch(g)) return false;
  if (!spend(g, priceOfThing(id))) return false;
  g.minute = Math.min(g.minute + FETCH_MINUTES, TUNING.dayLengthMinutes - 1); // never past the end of the day
  receive(g, id);
  g.say(`You walk into town and fetch the ${nameOf(id).toLowerCase()} yourself. It's ${g.clockText()} when you get back.`);
  return true;
}

function receive(g: Game, id: string): void {
  const hearth = pieceById(id)?.hearth ? hearthPiece(g) : undefined;
  if (hearth) { hearth.type = id; g.rebuildWorld(); }
  else if (isCarried(id)) g.upgrades.add(id);
  else g.toPlace.push(id);
}

/** Morning: the carter brings yesterday's orders. Goods are put away; pieces wait to be placed. */
export function carterArrives(g: Game): void {
  if (!g.onOrder.length) return;
  const came = [...g.onOrder];
  g.onOrder = [];
  for (const id of came) receive(g, id);
  const list = came.map((id) => nameOf(id).toLowerCase()).join(", ");
  const gear = came.filter((id) => pieceById(id)?.type === "gear");
  g.newGear.push(...gear);
  const place = came.some((id) => !isUpgrade(id) && !gear.includes(id)) ? " Place it from the desk: Arrange the kitchen." : gear.length ? " Set it on a stove from the stove's Manage stove tab." : "";
  g.say(`🛻 The carter's been: ${list}.${place}`);
}

export function sellBack(g: Game, id: string): number {
  const back = sellBackPrice(id);
  g.purse += back;
  g.stats.sold = (g.stats.sold ?? 0) + back;
  return back;
}
