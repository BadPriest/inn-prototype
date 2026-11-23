import { EQUIPMENT_DATA } from "./gamedata.gen.js";
import type { Game } from "./game.js";
import { EQUIPMENT, innOf, pieceById } from "./data.js";
import { levelsAt } from "./seasoning.js";
import { roll, seasonLevel, traitById, usedOnlyTraits } from "./seasoning.js";
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
  const health = Math.round(mostHealth(type) * between(U.health));
  const tastes = traits.filter((id) => traitById(id)?.tag).length;
  const worth = between(U.price) * (1 + U.perLevel * (seasonLevel(made) - 1) + U.perTaste * tastes) * (1 - U.healthWeight * (1 - health / mostHealth(type)));
  return {
    id: `used-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type,
    price: Math.max(1, Math.round((pieceById(type)?.price ?? 0) * Math.min(U.mostPrice, worth))),
    state: { made, traits, batches: true, health, paid: 0 },
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

/** A piece just placed: if a used one of its kind was waiting, this is it, with its wear. `which`: that waiting one by
 * its place in the list, or "new" for one with no wear; by default the first used one of its kind. */
export function claimUsed(g: Game, uid: string, type: string, which?: number | "new"): void {
  if (which === "new") return;
  const i = which ?? g.usedWaiting.findIndex((x) => x.type === type);
  if (i < 0 || g.usedWaiting[i]?.type !== type) return;
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

/** A new game: the inn's used pieces come worn in to level 2, with one trait, and part worn down. */
export function wearInStartingPieces(g: Game): void {
  for (const type of innOf(g.inn).startUsed ?? []) {
    const p = g.layout.find((x) => x.type === type);
    if (!p) continue;
    const [two, three] = levelsAt();
    const t = roll(2, [], true, type);
    g.seasoning[p.uid] = { made: two + Math.floor(Math.random() * (three - two)), traits: t ? [t.id] : [], batches: true, health: Math.round(mostHealth(type) * between(U.health)) };
  }
}

/** One piece of gear on the shelf: a used one (its place in usedWaiting) or a new one. */
export interface ShelfItem { key: string; type: string; worn?: number }

/** Gear on the shelf, each piece on its own: the used ones with their wear, then the new ones. */
export function gearShelf(g: Game): ShelfItem[] {
  const out: ShelfItem[] = [];
  for (const type of [...new Set(g.toPlace)]) {
    if (pieceById(type)?.type !== "gear") continue;
    const n = g.toPlace.filter((x) => x === type).length;
    const worn = g.usedWaiting.map((w, i) => (w.type === type ? i : -1)).filter((i) => i >= 0).slice(0, n);
    for (const i of worn) out.push({ key: `worn:${i}`, type, worn: i });
    for (let k = worn.length; k < n; k++) out.push({ key: `new:${type}:${k}`, type });
  }
  return out;
}
