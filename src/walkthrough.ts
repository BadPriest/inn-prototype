// The guided first day of a new game: one objective at a time, from the desk to the first guest served
// and a first buy. Each step pays its reward (data/walkthrough.json). The guide points at where to go,
// in the room and in the menus.

import { WALKTHROUGH_DATA } from "./gamedata.gen.js";
import type { WalkthroughStepId } from "./gamedata.js";
import { ARCHETYPES, EQUIPMENT, RECIPES, lowerName, pieceById, type Recipe } from "./data.js";
import type { Game, Patron } from "./game.js";
import { recipesFor, stockOf } from "./crafting.js";
import { spawnPatron } from "./patrons.js";
import type { Slot, Vec } from "./world.js";

export const STEPS = WALKTHROUGH_DATA.steps;

export interface WalkthroughState {
  step: number;
  dish?: string;
  thing?: string;
  guestId?: number;
  guestAt?: number;
  sat?: boolean;
  served?: boolean;
  thingHad?: number;
}

const PREFERRED_DISHES = ["stew", "soup", "porridge"];
const at = (id: WalkthroughStepId) => STEPS.findIndex((s) => s.id === id);

function bigDish(g: Game, id: string): boolean {
  const r = RECIPES.find((x) => x.id === id);
  return !!r && r.kind === "food" && !!r.servings && !r.internal && !r.tableSnack && !r.storedIn && g.canMake(id);
}

function dishOf(g: Game, w: WalkthroughState): Recipe | undefined {
  const id = w.dish ?? PREFERRED_DISHES.find((d) => bigDish(g, d)) ?? RECIPES.find((r) => bigDish(g, r.id))?.id;
  return RECIPES.find((r) => r.id === id);
}

function thingOf(g: Game, w: WalkthroughState) {
  if (!w.thing) {
    const owned = [...g.layout.map((p) => p.type), ...g.toPlace, ...g.onOrder];
    w.thing = owned.some((id) => pieceById(id)?.line === "coffeePot") ? "teaKettle" : "coffeePot";
  }
  return EQUIPMENT.find((e) => e.id === w.thing)!;
}

/** Where the dish is cooked: a slot already busy with it, else a free one that can make it. */
function slotFor(g: Game, recipeId: string | undefined): Slot | undefined {
  if (!recipeId) return undefined;
  const slots = g.world.furniture.flatMap((f) => f.slots ?? []).filter((s) => !s.gear && recipesFor(g, s).some((r) => r.id === recipeId));
  return slots.find((s) => g.pots.get(s.id)?.item.recipeId === recipeId || g.jobs.get(s.id)?.recipeId === recipeId)
    ?? slots.find((s) => !g.pots.has(s.id) && !g.jobs.has(s.id)) ?? slots[0];
}

const guestOf = (g: Game, w: WalkthroughState): Patron | undefined =>
  w.guestId === undefined ? undefined : g.patrons.find((p) => p.id === w.guestId && p.state !== "leaving");

export function currentStep(g: Game) {
  const w = g.walkthrough;
  return w && w.step < STEPS.length ? STEPS[w.step] : undefined;
}

/** The step's sentence, with the dish, station, guest and thing filled in. */
export function stepText(g: Game): string {
  const w = g.walkthrough, s = currentStep(g);
  if (!w || !s) return "";
  const dish = dishOf(g, w);
  const guest = guestOf(g, w);
  return s.text
    .replace(/\{dish\}/g, dish?.name.toLowerCase() ?? "a dish")
    .replace(/\{station\}/g, slotFor(g, dish?.id)?.f.name.toLowerCase() ?? "stove")
    .replace(/\{guest\}/g, guest?.archetype?.name.toLowerCase() ?? "guest")
    .replace(/\{thing\}/g, thingOf(g, w).name.toLowerCase());
}

function isDone(g: Game, w: WalkthroughState, id: WalkthroughStepId): boolean {
  const dish = dishOf(g, w)?.id;
  switch (id) {
    case "desk": return !!w.sat;
    case "bill": {
      const onBill = [...g.billAllDay()].find((r) => bigDish(g, r));
      if (g.menuChosen && onBill) { w.dish = onBill; return true; }
      return false;
    }
    case "cook": return !!dish && (stockOf(g, dish) > 0 || [...g.jobs.values()].some((j) => j.recipeId === dish));
    case "open": return g.open;
    case "greet": return !!guestOf(g, w)?.greeted;
    case "make": return w.served || g.keeper.trays.some((t) => t.items.some((i) => i.recipeId === dish));
    case "carry": return !!w.served;
    case "eat": { const p = g.patrons.find((x) => x.id === w.guestId); return !!w.served && (!p || p.state !== "consuming"); }
    case "buy": {
      const id = thingOf(g, w).id;
      return g.onOrder.includes(id) || g.toPlace.includes(id) || g.layout.filter((p) => p.type === id).length > (w.thingHad ?? 0);
    }
  }
}

/** A new keeper's first day starts the walkthrough. */
export function startWalkthrough(g: Game): void {
  g.walkthrough = { step: 0 };
}

export function initWalkthrough(g: Game): void {
  g.bus.on((e) => {
    const w = g.walkthrough;
    if (!w) return;
    if (e.type === "MenuSound" && e.sound === "desk") w.sat = true;
    if (e.type === "OrderFulfilled" && g.order(e.orderId)?.patronId === w.guestId) w.served = true;
  });
}

/** Each frame: tick off what's done (paying its reward), bring in the first guest, and hold back the rest. */
export function updateWalkthrough(g: Game): void {
  const w = g.walkthrough;
  if (!w || w.step >= STEPS.length) return;
  const s = STEPS[w.step];
  const withGuest = w.step >= at("greet") && w.step <= at("eat");
  if (g.open && w.step <= at("eat")) g.nextArrivalAt = Math.max(g.nextArrivalAt, g.minute + 5);
  if (withGuest && g.open && !g.lastCall && !guestOf(g, w)) {
    if (w.guestAt === undefined) w.guestAt = g.minute + 2;
    else if (g.minute >= w.guestAt) bringFirstGuest(g, w);
  }
  if (s.id === "buy" && w.thingHad === undefined) w.thingHad = g.layout.filter((p) => p.type === thingOf(g, w).id).length;
  if (!isDone(g, w, s.id)) return;
  g.purse += s.reward;
  g.bus.emit({ type: "Reward", pence: s.reward });
  w.step++;
  if (w.step >= STEPS.length) g.bus.emit({ type: "WalkthroughDone" });
}

/** The first guest: a traveller who's come in for the dish on the stove, and will wait for it. */
function bringFirstGuest(g: Game, w: WalkthroughState): void {
  w.guestAt = undefined;
  const seat = g.world.seats.find((x) => x.kind === "chair" && x.occupant === null);
  const a = ARCHETYPES.find((x) => x.id === "traveller") ?? ARCHETYPES[0];
  const p = seat ? spawnPatron(g, a, { seat, groupId: 0 }) : null;
  if (!p) return;
  p.wants = dishOf(g, w)?.id;
  p.patience = 600;
  p.stayUntil = g.minute + 600;
  w.guestId = p.id;
  w.served = false;
}

// ---------------------------------------------------------------------------
// The guide: what to point at

export interface WorldGuide { at: Vec; z: number; size: number; label?: string }

/** Where in the room the guide points now, if anywhere. Without the walkthrough: the desk until the bill is set, and after a level up until Skills is opened. */
export function worldGuide(g: Game): WorldGuide | null {
  const desk = g.world.furniture.find((f) => f.kind === "desk");
  const deskGuide = desk ? { at: desk.center, z: 1.2, size: Math.max(1, desk.tiles.length * 0.7) } : null;
  const w = g.walkthrough;
  const s = currentStep(g);
  if (!w || !s) {
    if (!g.menuChosen) return deskGuide;
    const crate = g.crates[0];
    if (crate) return { at: { x: crate.x + 0.5, y: crate.y + 0.5 }, z: 0.9, size: 0.8, label: "📦 Unpack supplies" };
    if (!deskGuide) return null;
    if (g.toPlace.some((id) => pieceById(id)?.type !== "gear")) return { ...deskGuide, label: "🛠 Place new equipment" };
    const gear = g.newGear.find((id) => g.toPlace.includes(id));
    const stove = gear ? g.world.furniture.find((f) => (f.equip?.hotSlots ?? 0) > 0) : undefined;
    if (gear && stove) return { at: stove.center, z: 1.1, size: Math.max(1, stove.tiles.length * 0.6), label: `🔧 Set out the ${lowerName(pieceById(gear)!.name)}` };
    return g.newSkills ? { ...deskGuide, label: "✦ New skills available" } : null;
  }
  const dish = dishOf(g, w);
  const guest = guestOf(g, w);
  const station = () => { const sl = slotFor(g, dish?.id); return sl ? { at: sl.f.center, z: 1.1, size: Math.max(1, sl.f.tiles.length * 0.6) } : null; };
  switch (s.id) {
    case "desk": case "bill": case "buy": return deskGuide;
    case "cook": case "make": return station();
    case "open": return { at: { x: g.world.frontDoor.x + 0.5, y: g.world.frontDoor.y + 0.5 }, z: 1.4, size: 1 };
    case "greet": case "carry": return guest && guest.state !== "entering" ? { at: guest.pos, z: 1.3, size: 0.8 } : null;
    case "eat": return null;
  }
}

/** What to light up in a menu: the first of these that's on screen. `has`: words the element must contain. */
export type MenuGuide = { sel: string; name?: string; has?: string[] } | Element;

export function menuGuide(g: Game, title: string, root: HTMLElement): MenuGuide[] {
  const w = g.walkthrough, s = currentStep(g);
  if (!w || !s) {
    const gear = g.newGear.find((id) => g.toPlace.includes(id));
    const stove = gear ? g.world.furniture.find((f) => (f.equip?.hotSlots ?? 0) > 0) : undefined;
    if (gear && stove && title.startsWith(stove.name)) return [{ sel: `[data-pick="spare:${gear}"]` }, { sel: '[data-pick="tab:manage"]' }];
    if (title !== "🕯️ Desk") return [];
    return [...(g.toPlace.some((id) => pieceById(id)?.type !== "gear") ? [{ sel: '[data-pick="arrange"]' }] : []), ...(g.newSkills ? [{ sel: '[data-pick="skills"]' }] : [])];
  }
  const dish = dishOf(g, w);
  const slot = slotFor(g, dish?.id);
  const primaryOff = !!root.querySelector(".menu-btn.primary[disabled]");
  switch (s.id) {
    case "bill":
      if (title === "🕯️ Desk") return [{ sel: '[data-pick="fare"]' }];
      if (title === "📜 Bill of fare" && dish) {
        const on = [...root.querySelectorAll(".icard.on .nm")].some((el) => el.textContent === dish.name);
        return on ? [{ sel: ".menu-btn.primary" }] : [{ sel: '[data-pick="mode:all"]:not(.on)' }, { sel: ".icard", name: dish.name }];
      }
      return [];
    case "cook":
      if (!dish || !slot) return [];
      if (title === `${dish.icon} ${dish.name}`) {
        if (!primaryOff) return [{ sel: ".menu-btn.primary" }];
        const base = root.querySelector(".menu-view .cards")?.querySelector(".icard:not(.off):not(.on)");
        return base ? [base] : [{ sel: ".icard:not(.off):not(.on)" }];
      }
      if (title.startsWith(slot.f.name)) return [{ sel: ".icard", name: dish.name }, { sel: '[data-pick="tab:dishes"]' }, { sel: ".icard", has: ["Cook something", slot.name] }];
      return [];
    case "make":
      if (dish && slot && title.startsWith(slot.f.name)) return [{ sel: ".icard", has: ["Take a serving", dish.name.toLowerCase()] }];
      return [];
    case "buy": {
      const thing = thingOf(g, w);
      if (title === "🕯️ Desk") return [{ sel: '[data-pick="shop"]' }];
      if (title === "🛒 Equipment") return [{ sel: ".icard", name: thing.name }, { sel: `[data-pick="tab:${thing.group}"]` }];
      if (title === `${thing.icon} ${thing.name}`) return [{ sel: ".menu-item", has: ["Order it"] }];
      return [];
    }
    default: return [];
  }
}
