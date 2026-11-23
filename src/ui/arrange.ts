// Arranging the kitchen: pick up a stove, an oven, a barrel… and put it somewhere else, or place one
// the carter brought (g.toPlace). Kettles and coffee pots go on a stove's hot-drink slots, and move with it.
// Delete sells the piece in hand. The clock stops while you do. What's cooking on it moves with it (its
// slots keep their ids). A spot is allowed when it's kitchen floor, behind the bar or a nook in the
// counter wall, nothing else stands there, and the keeper can still reach everything.

import { claimUsed, shelveWear, unplacedPaid } from "../used.js";
import { EQUIPMENT, PIE_SAFE_CAPACITY, PLACEABLE_ON, TUNING } from "../data.js";
import type { Game } from "../game.js";
import type { Placed, Vec } from "../world.js";
import type { View } from "./render.js";
import { P, floorPath } from "./proj.js";
import { openShop } from "./desk.js";
import { padActive, padText } from "../gamepad.js";
import { fmtMoney, moneyHtml } from "../money.js";
import { sellBack, sellBackPrice } from "../shop.js";
import { openMenu, closeAll } from "./menu.js";

let grab: Vec = { x: 0, y: 0 }; // where on the piece it was picked up
const verdicts = new Map<string, boolean>();

const newUid = () => `eq-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const eqOf = (type: string) => EQUIPMENT.find((e) => e.id === type)!;

/** Start arranging. With something the carter brought waiting, it's in your hand to place first. */
export function startArranging(g: Game, deliveredType?: string): void {
  const type = deliveredType ?? (g.arranging?.holding ? undefined : g.toPlace[0]);
  g.arranging = type ? { holding: { uid: newUid(), type, isNew: true } } : {};
  grab = { x: 0, y: 0 };
  g.keeper.path = [];
  g.keeper.pendingInteract = null;
  verdicts.clear();
  g.bus.emit({ type: "MenuSound", sound: "tableTap" });
  bar(g);
}

export function stopArranging(g: Game): void {
  if (g.arranging?.holding?.isNew) g.say(`The ${eqOf(g.arranging.holding.type).name.toLowerCase()} waits by the door to be placed.`);
  g.arranging = null;
  document.getElementById("arrange-bar")?.remove();
  g.bus.emit({ type: "Confirmed" }); // the piano: the kitchen's arranged
}

/** Where the held piece would go, from the tile under the mouse. */
function anchor(g: Game): Vec | null {
  const a = g.arranging;
  if (!a?.hover) return null;
  return { x: a.hover.x - grab.x, y: a.hover.y - grab.y };
}

function allowed(g: Game, type: string, at: Vec, moving: string | null): boolean {
  const key = `${type}|${at.x},${at.y}|${moving}`;
  let ok = verdicts.get(key);
  if (ok === undefined) {
    ok = g.world.canPlace(type, at.x, at.y, moving, g.layout, g.keeper.pos);
    verdicts.set(key, ok);
  }
  return ok;
}

export function arrangeHover(g: Game, p: Vec): void {
  if (g.arranging) g.arranging.hover = { x: Math.floor(p.x), y: Math.floor(p.y) };
}

export function arrangeClick(g: Game, p: Vec): void {
  const a = g.arranging;
  if (!a) return;
  arrangeHover(g, p);
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  if (!a.holding) {
    const uid = g.world.tile(tx, ty)?.equip;
    const placed = g.layout.find((x) => x.uid === uid);
    if (!placed) return;
    const gear = g.layout.filter((x) => x.on === placed.uid);
    if (eqOf(placed.type).hearth) {
      if (gear.length) chooseStoveOrGear(g, placed, gear, { x: 0, y: 0 });
      else g.say("The hearth is built into the wall. Hang things over the fire from its hooks.");
      return;
    }
    if (gear.length) { chooseStoveOrGear(g, placed, gear, { x: tx - placed.x, y: ty - placed.y }); return; }
    pickUp(g, placed, { x: tx - placed.x, y: ty - placed.y });
    return;
  }
  const h = a.holding;
  if (eqOf(h.type).gear) { setGearDown(g, tx, ty); return; }
  const at = anchor(g)!;
  const placed = g.layout.find((x) => x.uid === h.uid);
  if (placed && placed.x === at.x && placed.y === at.y) { a.holding = undefined; bar(g); return; } // put back where it was
  if (!allowed(g, h.type, at, h.isNew ? null : h.uid)) { g.say("It won't go there: it needs kitchen floor, and room to get at everything."); return; }
  const name = eqOf(h.type).name.toLowerCase();
  if (h.isNew) {
    g.layout.push({ uid: h.uid, type: h.type, x: at.x, y: at.y });
    claimUsed(g, h.uid, h.type);
    const i = g.toPlace.indexOf(h.type);
    if (i >= 0) g.toPlace.splice(i, 1);
    g.say(`The ${name} is in.`);
  }
  else if (placed) { placed.x = at.x; placed.y = at.y; g.say(`You move the ${name}.`); }
  a.holding = undefined;
  grab = { x: 0, y: 0 };
  verdicts.clear();
  g.rebuildWorld();
  g.bus.emit({ type: "MenuSound", sound: "tableTap" }); // set down
  bar(g);
}

function pickUp(g: Game, placed: Placed, at: Vec): void {
  g.arranging!.holding = { uid: placed.uid, type: placed.type, isNew: false };
  grab = eqOf(placed.type).gear ? { x: 0, y: 0 } : at;
  g.bus.emit({ type: "Paper", what: "menu" });
  bar(g);
}

/** A stove with a kettle or coffee pot on it: move the stove (they go with it), or take one off. */
function chooseStoveOrGear(g: Game, stove: Placed, gear: Placed[], at: Vec): void {
  openMenu({
    title: `${eqOf(stove.type).icon} ${eqOf(stove.type).name}`,
    holdsClock: true,
    items: [
      ...(eqOf(stove.type).hearth ? [] : [{ label: `Move the ${eqOf(stove.type).name.toLowerCase()}`, sub: gear.length > 1 ? "what's on it goes with it" : `the ${eqOf(gear[0].type).name.toLowerCase()} goes with it`,
        action: () => { closeAll(); pickUp(g, stove, at); } }]),
      ...gear.map((q) => ({ label: `Take the ${eqOf(q.type).name.toLowerCase()} off`, sub: "to set it on another stove, or sell it",
        action: () => { closeAll(); pickUp(g, q, { x: 0, y: 0 }); } })),
      { label: "Not now", button: "secondary", cancel: true as const, action: () => closeAll() },
    ],
  });
}

/** Set the kettle or coffee pot in hand on the stove under the pointer. */
function setGearDown(g: Game, tx: number, ty: number): void {
  const h = g.arranging!.holding!;
  const stove = g.world.stoveWithRoom(tx, ty, h.isNew ? null : h.uid, g.layout, h.type);
  const name = eqOf(h.type).name.toLowerCase();
  if (!stove) { g.say(eqOf(h.type).hearthOnly ? `The ${name} hangs on a free hook over the fire.` : `The ${name} goes on a stove with a free spot at the back, or a hook over the fire.`); return; }
  const stoveName = eqOf(stove.type).name.toLowerCase();
  if (h.isNew) {
    g.layout.push({ uid: h.uid, type: h.type, x: stove.x, y: stove.y, on: stove.uid });
    claimUsed(g, h.uid, h.type);
    const i = g.toPlace.indexOf(h.type);
    if (i >= 0) g.toPlace.splice(i, 1);
    const n = g.newGear.indexOf(h.type);
    if (n >= 0) g.newGear.splice(n, 1);
  } else {
    const placed = g.layout.find((x) => x.uid === h.uid)!;
    Object.assign(placed, { x: stove.x, y: stove.y, on: stove.uid });
  }
  g.say(`The ${name} goes on the ${stoveName}.`);
  g.arranging!.holding = undefined;
  verdicts.clear();
  g.rebuildWorld();
  g.bus.emit({ type: "MenuSound", sound: "tableTap" });
  bar(g);
}

/** Esc or right-click: put back what you're holding; with nothing held, finish arranging. */
export function arrangeCancel(g: Game): void {
  const a = g.arranging;
  if (!a) return;
  if (a.holding) {
    if (a.holding.isNew) g.say(`The ${eqOf(a.holding.type).name.toLowerCase()} waits by the door to be placed.`);
    a.holding = undefined;
    grab = { x: 0, y: 0 };
    bar(g);
    return;
  }
  stopArranging(g);
}

/** Delete: sell the piece you're holding back for half its price, if nothing's cooking on it. */
export function arrangeRemove(g: Game): void {
  const h = g.arranging?.holding;
  if (!h) return;
  if (h.isNew) {
    // Delivered and never placed: it goes back on the carter's cart, for half.
    const i = g.toPlace.indexOf(h.type);
    if (i >= 0) g.toPlace.splice(i, 1);
    const got = sellBack(g, h.type, unplacedPaid(g, h.type));
    g.bus.emit({ type: "MenuSound", sound: "coins" });
    g.say(`You sell the ${eqOf(h.type).name.toLowerCase()} back for ${fmtMoney(got)}.`);
    g.arranging!.holding = undefined;
    bar(g);
    return;
  }
  const f = g.world.furniture.find((x) => x.id === h.uid);
  const busy = [...(f?.slots ?? []).map((sl) => sl.id), h.uid].some((id) => g.jobs.has(id) || g.pots.has(id) || g.shelves.get(id)?.length);
  if (busy) { g.say("Something's still on it. Finish with that first."); return; }
  if (h.type === "pieSafe" && g.pieSafe.length > g.pieSafeCapacity - PIE_SAFE_CAPACITY) { g.say("There are pies in it with nowhere else to go."); return; }
  // A stove's kettle and coffee pot don't go with it: they wait by the door to go on another.
  const riders = g.layout.filter((x) => x.on === h.uid);
  g.layout = g.layout.filter((x) => x.uid !== h.uid && x.on !== h.uid);
  g.toPlace.push(...riders.map((x) => x.type));
  for (const r of riders) shelveWear(g, r.uid, r.type);
  if (riders.length) g.say(`The ${riders.map((x) => eqOf(x.type).name.toLowerCase()).join(" and ")} wait${riders.length > 1 ? "" : "s"} by the door for another stove.`);
  const got = sellBack(g, h.type, g.seasoning[h.uid]?.paid);
  g.bus.emit({ type: "MenuSound", sound: "coins" });
  g.say(`You sell the ${eqOf(h.type).name.toLowerCase()} for ${fmtMoney(got)}.`);
  g.arranging!.holding = undefined;
  verdicts.clear();
  g.rebuildWorld();
  bar(g);
}

/** While arranging: open the equipment to buy something else (B), without leaving the kitchen. */
export function arrangeBuy(g: Game): void {
  if (g.arranging?.holding?.isNew) arrangeCancel(g); // swap it for something else
  openShop(g);
}

/** The next thing the carter brought (A). */
export function arrangeAnother(g: Game): void {
  if (g.toPlace.length && !g.arranging?.holding) startArranging(g, g.toPlace[0]);
}


/** The banner along the bottom: what to do now, buying more, and Done. */
function bar(g: Game): void {
  let el = document.getElementById("arrange-bar");
  if (!el) {
    el = document.createElement("div");
    el.id = "arrange-bar";
    document.getElementById("stage")?.appendChild(el);
  }
  const h = g.arranging?.holding;
  const what = h ? eqOf(h.type).name.toLowerCase() : "";
  const pad = padActive(); // a controller: name its buttons
  const k = pad ? { esc: padText("○"), del: padText("L2"), buy: padText("□"), another: padText("△"), click: padText("✕") + " on" } : { esc: "Esc", del: "Delete", buy: "B", another: "A", click: "click" };
  const waiting = g.toPlace.length;
  el.innerHTML = `<span>🛠 <b>Arranging the kitchen</b> · the clock's stopped · ${h
    ? `${k.click === "click" ? "click" : padText("✕")} where the ${what} should go · ${k.esc} ${h.isNew ? "sets it aside for now" : "puts it back"} · ${k.del} sells it for ${moneyHtml(sellBackPrice(h.type, g.seasoning[h.uid]?.paid))}`
    : `${k.click} a stove, oven, barrel or pie safe to move it; a stove's kettle comes off from there`}</span>${!h && waiting
    ? `<button class="ghost" data-act="another">📦 Place what the carter brought (${waiting}) <small>${k.another}</small></button>` : ""}<button class="ghost" data-act="buy">🛒 Buy <small>${k.buy}</small></button><button data-act="done">Done${pad ? " <small>○</small>" : ""}</button>`;
  const act: Record<string, () => void> = { done: () => stopArranging(g), buy: () => arrangeBuy(g), another: () => arrangeAnother(g) };
  el.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((b) => { b.onclick = () => act[b.dataset.act!](); });
}

/** Over the map: where things can go, the piece in hand (green where it fits, red where it doesn't). */
export function drawArrange(ctx: CanvasRenderingContext2D, g: Game, view: View): void {
  const a = g.arranging;
  if (!a) return;
  const ts = view.ts;
  const inset = 2 / ts; // two pixels, in tiles
  // Free spots for equipment: a faint wash.
  ctx.fillStyle = "rgba(160,220,140,0.08)";
  for (const row of g.world.tiles) for (const t of row) {
    if (PLACEABLE_ON.includes(t.base) && !t.equip) { floorPath(ctx, view, t.x, t.y, 1, 1, inset / 2); ctx.fill(); }
  }
  // Every piece of equipment, outlined; the one in hand dimmed where it stood.
  ctx.setLineDash([ts * 0.12, ts * 0.08]);
  ctx.lineWidth = Math.max(1, ts * 0.05);
  for (const p of g.layout) {
    const eq = eqOf(p.type);
    if (eq.gear) continue;
    const held = a.holding?.uid === p.uid;
    floorPath(ctx, view, p.x, p.y, eq.w, eq.h, inset);
    ctx.strokeStyle = held ? "rgba(255,255,255,0.35)" : "#ffd34d";
    ctx.stroke();
    if (held) { ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill(); }
  }
  ctx.setLineDash([]);
  // The piece in hand.
  const at = anchor(g);
  if (a.holding && at && eqOf(a.holding.type).gear) {
    // A kettle or coffee pot in hand: the stove under the pointer lights up if there's room on it.
    const eq = eqOf(a.holding.type);
    const stove = g.world.stoveWithRoom(at.x, at.y, a.holding.isNew ? null : a.holding.uid, g.layout, a.holding.type);
    const box = stove ? { x: stove.x, y: stove.y, w: eqOf(stove.type).w, h: eqOf(stove.type).h } : { x: at.x, y: at.y, w: 1, h: 1 };
    ctx.fillStyle = stove ? "rgba(110,190,110,0.55)" : "rgba(210,90,80,0.5)";
    ctx.strokeStyle = stove ? "#9be27a" : "#e07060";
    ctx.lineWidth = 2;
    floorPath(ctx, view, box.x, box.y, box.w, box.h, inset);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.floor(ts * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const c = P(view, box.x + box.w / 2, box.y + box.h / 2);
    ctx.fillText(`${eq.icon} ${eq.label}`, c.x, c.y);
    ctx.lineWidth = 1;
  } else if (a.holding && at) {
    const eq = eqOf(a.holding.type);
    const ok = allowed(g, eq.id, at, a.holding.isNew ? null : a.holding.uid);
    ctx.fillStyle = ok ? "rgba(110,190,110,0.55)" : "rgba(210,90,80,0.5)";
    ctx.strokeStyle = ok ? "#9be27a" : "#e07060";
    ctx.lineWidth = 2;
    floorPath(ctx, view, at.x, at.y, eq.w, eq.h, inset);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.floor(ts * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const c = P(view, at.x + eq.w / 2, at.y + eq.h / 2);
    ctx.fillText(eq.label, c.x, c.y);
    ctx.lineWidth = 1;
  }
}
