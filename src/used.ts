import { EQUIPMENT_DATA } from "./gamedata.gen.js";
import type { Game } from "./game.js";
import { EQUIPMENT, pieceById } from "./data.js";
import { roll, seasonLevel, usedOnlyTraits } from "./seasoning.js";
import { mostHealth } from "./breakdowns.js";
import { spend, fmtMoney } from "./money.js";

const U = EQUIPMENT_DATA.used;
const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

/** Pieces the tinker might have: anything that cooks, but never a hearth. */
const sellable = () => EQUIPMENT.filter((e) => !e.hearth && (e.slots.length > 0 || e.gear) && !e.kind);

function usedPiece(type: string): Game["tinkerStock"][0] {
  const made = Math.round(between(U.made));
  const traits: string[] = [];
  for (let level = 2; level <= seasonLevel(made); level++) {
    const t = roll(level, traits, true, type);
    if (t) traits.push(t.id);
  }
  const odd = usedOnlyTraits();
  if (odd.length && Math.random() < U.oddChance) traits.push(odd[Math.floor(Math.random() * odd.length)].id);
  return {
    id: `used-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type,
    price: Math.max(1, Math.round((pieceById(type)?.price ?? 0) * between(U.price))),
    state: { made, traits, batches: true, health: Math.round(mostHealth(type) * between(U.health)), paid: 0 },
  };
}

/** A fresh lot on the cart: on its weekday, or when there's never been one. */
export function restockTinker(g: Game): void {
  if (g.tinkerStockedDay !== undefined && (g.date.weekday !== U.weekday || g.tinkerStockedDay === g.day)) return;
  g.tinkerStockedDay = g.day;
  const pool = sellable();
  g.tinkerStock = Array.from({ length: U.stock }, () => usedPiece(pool[Math.floor(Math.random() * pool.length)].id));
}

/** Buy a used piece off the cart: it's yours now, waiting to be placed. */
export function buyUsed(g: Game, id: string): boolean {
  const it = g.tinkerStock.find((x) => x.id === id);
  if (!it) return false;
  if (!spend(g, it.price)) { g.say(`The tinker wants ${fmtMoney(it.price)} for it; you have ${fmtMoney(g.purse)}.`); return false; }
  g.tinkerStock = g.tinkerStock.filter((x) => x !== it);
  g.usedWaiting.push({ type: it.type, state: { ...it.state, paid: it.price } });
  g.toPlace.push(it.type);
  if (pieceById(it.type)?.type === "gear") g.newGear.push(it.type);
  g.say(`You buy the used ${pieceById(it.type)?.name.toLowerCase()} off the tinker's cart for ${fmtMoney(it.price)}. Place it from the desk (Arrange the kitchen)${pieceById(it.type)?.type === "gear" ? ", or set it out from a stove's Manage tab" : ""}.`);
  return true;
}

/** A piece just placed: if a used one of its kind was waiting, this is it, with its wear. */
export function claimUsed(g: Game, uid: string, type: string): void {
  const i = g.usedWaiting.findIndex((x) => x.type === type);
  if (i < 0) return;
  g.seasoning[uid] = { ...g.usedWaiting[i].state, traits: [...g.usedWaiting[i].state.traits] };
  g.usedWaiting.splice(i, 1);
}

/** A piece taken off, onto the shelf: its wear waits with it, for wherever it goes next. */
export function shelveWear(g: Game, uid: string, type: string): void {
  const s = g.seasoning[uid];
  if (!s) return;
  g.usedWaiting.push({ type, state: { made: s.made, traits: [...s.traits], batches: s.batches, health: s.health ?? mostHealth(type), paid: s.paid ?? 0, broken: s.broken } });
  delete g.seasoning[uid];
}

/** Sold before it was ever placed: what it was bought for, if it came off the cart. */
export function unplacedPaid(g: Game, type: string): number | undefined {
  const i = g.usedWaiting.findIndex((x) => x.type === type);
  if (i < 0) return undefined;
  const paid = g.usedWaiting[i].state.paid;
  g.usedWaiting.splice(i, 1);
  return paid || undefined;
}
