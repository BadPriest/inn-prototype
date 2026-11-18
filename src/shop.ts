// Buying equipment and goods (inn#59). Everything costs coin. What you order comes with the carter the next
// morning; or you fetch it yourself straight away, at the cost of your time (the inn has to be shut and
// empty: nobody minds the room while you're out). A delivered piece waits to be placed (Arrange the
// kitchen). What you no longer want sells back for half its price.
//
// No secondhand pieces yet: those come with the tinker (inn#66). The carter is a message for now; his
// cart and the crates by the kitchen door come with inn#62.

import { EQUIPMENT, GOODS, TUNING } from "./data.js";
import type { Game } from "./game.js";
import { spend } from "./money.js";

/** What each piece and each good costs new, in pennies. Placeholders, tuned to the session's pacing targets. */
export const SHOP_PRICE: Record<string, number> = {
  kettle: 50, coffee: 80, copperkettle: 150, alekeg: 60, ciderkeg: 60,
  piesafe: 100, prep: 150, urn: 200,
  stove1: 300, stove2: 600, range: 1200, oven: 1500,
  trays: 100, firewood: 50,
};
export const priceOfThing = (id: string): number => SHOP_PRICE[id] ?? 100;
/** Selling back: half what it costs new. */
export const sellBackPrice = (id: string): number => Math.floor(priceOfThing(id) / 2);
/** Fetching it yourself: how long you're out (game minutes). */
export const FETCH_MINUTES = 90;

const nameOf = (id: string) => (EQUIPMENT.find((e) => e.id === id) ?? GOODS.find((x) => x.id === id))?.name ?? id;
const isGoods = (id: string) => GOODS.some((x) => x.id === id);

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
  if (isGoods(id)) g.upgrades.add(id);
  else g.toPlace.push(id);
}

/** Morning: the carter brings yesterday's orders. Goods are put away; pieces wait to be placed. */
export function carterArrives(g: Game): void {
  if (!g.onOrder.length) return;
  const came = [...g.onOrder];
  g.onOrder = [];
  for (const id of came) receive(g, id);
  const list = came.map((id) => nameOf(id).toLowerCase()).join(", ");
  const place = came.some((id) => !isGoods(id)) ? " Place it from the desk: Arrange the kitchen." : "";
  g.say(`🛻 The carter's been: ${list}.${place}`);
}

/** Sell a piece back for half its price. */
export function sellBack(g: Game, id: string): number {
  const back = sellBackPrice(id);
  g.purse += back;
  g.stats.sold = (g.stats.sold ?? 0) + back;
  return back;
}
