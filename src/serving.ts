// Trays, pickup, pouring, garnishing and delivery.

import { GARNISHES, RECIPES, TUNING } from "./data.js";
import { makeItem, serveFromPot } from "./crafting.js";
import type { Game, Item, Patron, SetDownTray } from "./game.js";
import { dist } from "./world.js";
import { organic, uid } from "./core.js";
import { afterServe, describeReaction, judge } from "./tastes.js";
import { inspireOthers } from "./patrons.js";

export function trayItems(g: Game): Item[] {
  return [...g.keeper.trays[0].items, ...g.keeper.trays[1].items];
}

/** The icon for a dish or drink, plus its garnish if it has one. */
export function iconFor(recipeId: string, garnish?: string): string {
  const r = RECIPES.find((x) => x.id === recipeId)?.icon ?? (recipeId === "bowl" ? "🥣" : "");
  const gi = garnish ? GARNISHES.find((x) => x.id === garnish)?.icon ?? "" : "";
  return r + gi;
}

export function itemLabel(i: Item): string {
  const base = `${iconFor(i.recipeId, i.garnish)} ${i.name}`;
  return i.ticketName ? `${base} → ${i.ticketName}` : base;
}

/** Put an item on a tray: one with the same kind and room, else an empty one. */
export function addToTray(g: Game, item: Item): boolean {
  const cap = g.trayCap(item.kind);
  const trays = g.keeper.trays;
  const same = trays.find((t) => t.kind === item.kind && t.items.length < cap);
  const target = same ?? trays.find((t) => t.kind === null);
  if (!target) return false;
  target.kind = item.kind;
  target.items.push(item);
  return true;
}

export function removeFromTray(g: Game, item: Item): void {
  g.accountedFor.add(item.id);
  for (const t of [...g.keeper.trays, ...g.setDown.map((s) => s.tray)]) {
    const i = t.items.indexOf(item);
    if (i >= 0) {
      t.items.splice(i, 1);
      if (t.items.length === 0) t.kind = null;
    }
  }
  g.setDown = g.setDown.filter((s) => s.tray.items.length > 0);
}

/** Items on trays set down on this table. */
function itemsSetDownOn(g: Game, tableKey: string): Item[] {
  const f = g.world.furniture.find((ff) => ff.kind === "table" && `${ff.tiles[0].x},${ff.tiles[0].y}` === tableKey);
  if (!f) return [];
  return g.setDown.filter((s) => f.tiles.some((t) => t.x === s.x && t.y === s.y)).flatMap((s) => s.tray.items);
}

export function pickupFromHatch(g: Game): void {
  if (!g.hatch.length) { g.say("The hatch is empty."); return; }
  const taken: Item[] = [];
  // Oldest first. Anything that doesn't fit stays where it is.
  for (const item of [...g.hatch]) {
    if (addToTray(g, item)) {
      taken.push(item);
      g.hatch.splice(g.hatch.indexOf(item), 1);
      g.bus.emit({ type: "ItemPickedUp", itemId: item.id });
    }
  }
  if (taken.length) g.say(`Picked up ${taken.map(itemLabel).join(", ")}.`);
  else g.say("No room on your trays.");
}

/** Take one chosen item from the hatch. */
export function takeFromHatch(g: Game, item: Item): void {
  if (!addToTray(g, item)) { g.say("No room on your trays for that."); return; }
  g.hatch.splice(g.hatch.indexOf(item), 1);
  g.bus.emit({ type: "ItemPickedUp", itemId: item.id });
  g.say(`Picked up ${itemLabel(item)}.`);
}

/** Surface tiles a tray can go on: counter and tables. */
export function surfaceNear(g: Game): { x: number; y: number } | null {
  const k = g.keeper.pos;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = Math.floor(k.y) - 2; y <= Math.floor(k.y) + 2; y++) {
    for (let x = Math.floor(k.x) - 2; x <= Math.floor(k.x) + 2; x++) {
      const t = g.world.tile(x, y);
      if (!t || (t.def.kind !== "counter" && t.def.kind !== "table")) continue;
      if (g.setDown.some((s) => s.x === x && s.y === y)) continue;
      const d = Math.hypot(x + 0.5 - k.x, y + 0.5 - k.y);
      const dot = ((x + 0.5 - k.x) * g.keeper.facing.x + (y + 0.5 - k.y) * g.keeper.facing.y) / (d || 1);
      const score = d - dot * 0.5;
      if (d <= 1.45 && (!best || score < best.d)) best = { x, y, d: score };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

export function setTrayDown(g: Game, index: 0 | 1): void {
  const tray = g.keeper.trays[index];
  if (!tray.items.length) { g.say("That tray is empty."); return; }
  const spot = surfaceNear(g);
  if (!spot) { g.say("Nowhere to set it down here. Try the counter or a table."); return; }
  g.setDown.push({ id: uid(), x: spot.x, y: spot.y, tray: { kind: tray.kind, items: [...tray.items] } });
  tray.items = [];
  tray.kind = null;
  g.say("You set the tray down.");
}

export function pickUpTray(g: Game, s: SetDownTray): void {
  const free = g.keeper.trays.find((t) => t.kind === null);
  if (!free) { g.say("Both hands are full."); return; }
  free.kind = s.tray.kind;
  free.items = s.tray.items;
  g.setDown = g.setDown.filter((x) => x.id !== s.id);
  g.say("You pick the tray back up.");
}

/** Is there room on the trays for one more of this kind? */
export function trayRoomFor(g: Game, kind: Item["kind"]): boolean {
  const cap = g.trayCap(kind);
  return g.keeper.trays.some((t) => (t.kind === kind && t.items.length < cap) || t.kind === null);
}

// Pouring takes a moment (TUNING.pourSeconds at a tap, TUNING.urnPourSeconds from the urn). The drink lands on a tray when it's done;
// walking away stops it. `from` is "tap:<recipe>" or the id of a station holding a drink pot (the urn).
export function startPour(g: Game, from: string, recipeId?: string): void {
  if (g.pouring) { g.say("Still pouring…"); return; }
  if (!trayRoomFor(g, "drink")) { g.say("No room for a drink on your trays."); return; }
  const tap = from.startsWith("tap:");
  g.pouring = { id: uid(), from, recipeId, at: { ...g.keeper.pos }, progress: 0, total: organic(tap ? TUNING.pourSeconds : TUNING.urnPourSeconds) };
  g.bus.emit({ type: "PourStarted", id: g.pouring.id, from: tap ? "tap" : "urn" });
}

/** Stop pouring (right-click). The drink isn't made. */
export function cancelPour(g: Game): void {
  const p = g.pouring;
  if (!p) return;
  g.pouring = null;
  g.bus.emit({ type: "PourEnded", id: p.id, done: false });
  g.say("You stop pouring.");
}

/** Called every frame the game isn't paused, with real seconds. */
export function updatePour(g: Game, realDt: number): void {
  const p = g.pouring;
  if (!p) return;
  if (dist(p.at, g.keeper.pos) > 0.3) {
    g.pouring = null;
    g.bus.emit({ type: "PourEnded", id: p.id, done: false });
    g.say("You stop pouring.");
    return;
  }
  p.progress += realDt;
  if (p.progress < p.total) return;
  g.pouring = null;
  if (p.from.startsWith("tap:")) pour(g, p.recipeId!);
  else serveFromPot(g, p.from);
  g.bus.emit({ type: "PourEnded", id: p.id, done: true });
}

export function pour(g: Game, recipeId: string): void {
  const r = RECIPES.find((x) => x.id === recipeId)!;
  const item = makeItem(r, []);
  if (addToTray(g, item)) g.say(`Poured ${r.name.toLowerCase()}.`);
  else g.say("No room for a drink on your trays.");
}

export function garnishableDrinks(g: Game): Item[] {
  return trayItems(g).filter((i) => i.kind === "drink" && !i.garnish);
}

export function applyGarnish(g: Game, item: Item, garnishId: string): void {
  const gar = GARNISHES.find((x) => x.id === garnishId)!;
  item.garnish = gar.id;
  item.tags = [...new Set([...item.tags, ...gar.tags])];
  item.name = `${item.name} with ${gar.name.toLowerCase()}`;
  g.stats.garnished++;
  g.bus.emit({ type: "ItemGarnished", itemId: item.id });
  g.say(`${item.name}.`);
}

/** The unasked-serve card: give a patron something they didn't order. Never fulfils an order. */
export function serveUnasked(g: Game, p: Patron, item: Item): void {
  removeFromTray(g, item);
  const v = judge(g, p, item, null);
  p.marker = { text: v.outcome, until: g.minute + TUNING.outcomeShowMinutes };
  if (v.line) p.line = { text: v.line, until: g.minute + 6 };
  else if (v.outcome === "DELIGHT") p.line = { text: "For me? Oh!", until: g.minute + 6 };
  g.stats.served++;
  g.totalServed++;
  p.consuming = { icon: iconFor(item.recipeId, item.garnish) || "🥣", kind: item.kind, from: g.minute };
  g.stats.outcomes[v.outcome] = (g.stats.outcomes[v.outcome] ?? 0) + 1;
  g.bus.emit({ type: "ServeOutcome", patronId: p.id, outcome: v.outcome, score: v.score });
  g.journal(p, `Offered, unasked: ${item.name} [${item.tags.join(", ")}]: ${describeReaction(p, v)}.${v.line ? ` “${v.line}”` : ""}`);
  for (const m of afterServe(g, p, item, v)) {
    g.journal(p, m, "moment");
    g.stats.moments.push(m);
    g.say(`✦ ${m}`);
  }
  // If they had nothing in front of them, they now do.
  if (p.state === "seated") { p.state = "consuming"; const [c] = p.consumeTime; p.consumeUntil = g.minute + c; }
  g.say(`🃏 ${p.name}: ${item.name}, unasked → ${v.outcome}${v.line ? ` “${v.line}”` : ""}`);
  if (v.outcome === "DELIGHT") inspireOthers(g, p, item);
}

/** Serve whatever on the trays matches this patron's open order. Items made for them come first. */
export function deliverTo(g: Game, p: Patron, quiet = false, extra: Item[] = []): boolean {
  const order = g.order(p.orderId);
  if (!order || !order.open) {
    if (!quiet) g.say(`${p.name} isn't waiting on anything.`);
    return false;
  }
  const matches = [...trayItems(g), ...extra].filter((i) => i.recipeId === order.recipeId);
  const item =
    matches.find((i) => i.ticket === p.id) ??
    matches.find((i) => !i.ticket) ??
    matches.find((i) => !g.patron(i.ticket)?.orderId || !g.order(g.patron(i.ticket)!.orderId)?.open) ??
    matches[0];
  if (!item) {
    if (!quiet) g.say(`Nothing on your trays for ${p.name} (wants ${order.label}).`);
    return false;
  }
  removeFromTray(g, item);
  order.open = false;
  g.bus.emit({ type: "OrderFulfilled", orderId: order.id });
  const v = judge(g, p, item, order);
  p.state = "consuming";
  const [c, s] = p.consumeTime;
  const base = c + (Math.random() - 0.5) * s;
  p.consumeUntil = g.minute + (v.outcome === "UNFINISHED" || v.outcome === "COMPLAINS" ? base * 0.4 : base);
  p.marker = { text: v.outcome, until: g.minute + TUNING.outcomeShowMinutes };
  if (v.line) p.line = { text: v.line, until: g.minute + 6 };
  g.stats.served++;
  g.totalServed++;
  p.consuming = { icon: iconFor(item.recipeId, item.garnish) || "🥣", kind: item.kind, from: g.minute };
  g.stats.outcomes[v.outcome] = (g.stats.outcomes[v.outcome] ?? 0) + 1;
  g.bus.emit({ type: "ServeOutcome", patronId: p.id, outcome: v.outcome, score: v.score });

  // The journal records what happened, never the answer.
  g.journal(p, `${item.name} [${item.tags.join(", ")}]: ${describeReaction(p, v)}.${v.line ? ` “${v.line}”` : ""}`);
  const moments = afterServe(g, p, item, v);
  for (const m of moments) {
    g.journal(p, m, "moment");
    g.stats.moments.push(m);
    g.say(`✦ ${m}`);
  }
  g.say(`${p.name}: ${item.name} → ${v.outcome}${v.line ? ` “${v.line}”` : ""}`);
  if (v.outcome === "DELIGHT") inspireOthers(g, p, item);
  return true;
}

/** Everyone sitting at this table: unload whatever matches their orders (dishes made for them first). */
export function serveTable(g: Game, tableKey: string): void {
  const table = g.world.tables.find((t) => t.key === tableKey);
  if (!table) return;
  const seated = table.chairs.map((c) => g.patron(c.occupant)).filter((p): p is Patron => !!p && p.state === "waiting");
  if (!seated.length) { g.say("Nobody at this table is waiting on anything."); return; }
  // People with a dish made for them by name go first, so their dish isn't given to a tablemate.
  seated.sort((a, b) => Number(trayItems(g).some((i) => i.ticket === b.id)) - Number(trayItems(g).some((i) => i.ticket === a.id)));
  let served = 0;
  const missing: string[] = [];
  for (const p of seated) {
    // A tray set down on the table counts too.
    if (deliverTo(g, p, true, itemsSetDownOn(g, tableKey))) served++;
    else { const o = g.order(p.orderId); if (o?.open) missing.push(`${p.name} (${o.label})`); }
  }
  if (!served) g.say(`Nothing on your trays for this table. Waiting: ${missing.join(", ")}.`);
  else if (missing.length) g.say(`Still waiting here: ${missing.join(", ")}.`);
}

/** Serving someone at a table serves their whole table; at the counter, just them. */
export function servePatron(g: Game, p: Patron): void {
  const seat = g.world.seats.find((s) => s.id === p.seatId);
  if (seat?.table) serveTable(g, `${seat.table.x},${seat.table.y}`);
  else deliverTo(g, p);
}
