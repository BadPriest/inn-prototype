// What happens when the keeper interacts with something. Menus live here.

import { organic } from "./core.js";
import { GARNISHES, GRAMOPHONE, INGREDIENTS, RECIPES, REGULARS, SNACKS, TUNING, UPGRADES, type Recipe } from "./data.js";
import type { Game, Patron, SetDownTray, Spill } from "./game.js";
import { dist, type Furniture, type Slot } from "./world.js";
import { canPutBack, collectShelf, emptyPot, putBack, recipesFor, returnSlice, startJob, makeItem, serveFromPot, takeSlice, ticketFor } from "./crafting.js";
import { tableKey } from "./patrons.js";
import { applyGarnish, removeFromTray, servePatron, serveTable, garnishableDrinks, iconFor, itemLabel, serveUnasked, trayItems, pickupFromHatch, pickUpTray, startPour, setTrayDown, takeFromHatch } from "./serving.js";
import { endDay, startNextDay, toggleInn } from "./day.js";
import { compactDate, longDate } from "./calendar.js";
import { gramophoneChanged, gramophoneWound, recordsReady, springLeft } from "./sound/gramophone.js";
import { openSteepScreen } from "./ui/cook.js";
import { closeAll, openMenu, replaceMenu, back } from "./ui/menu.js";
import { openCookScreen } from "./ui/cook.js";
import { openPieSafeScreen, openSnackScreen } from "./ui/larder.js";
import { openBinScreen, openGarnishScreen, openHatchScreen, openOfferScreen, openSetDownScreen } from "./ui/trays.js";
import { openBillOfFare as openBillOfFareScreen, openDeskScreen } from "./ui/desk.js";

export type Target =
  | { type: "furniture"; f: Furniture }
  | { type: "patron"; p: Patron }
  | { type: "spill"; s: Spill }
  | { type: "tray"; t: SetDownTray };

export function targetId(t: Target | null): string | null {
  if (!t) return null;
  if (t.type === "furniture") return t.f.id;
  if (t.type === "spill") return `spill:${t.s.id}`;
  if (t.type === "tray") return `tray:${t.t.id}`;
  return `patron:${t.p.id}`;
}

export function targetName(t: Target): string {
  return t.type === "furniture" ? t.f.name : t.type === "spill" ? "Spill" : t.type === "tray" ? "Tray" : t.p.name;
}

/** How many people at this table are waiting on an order. */
export function waitingAt(g: Game, key: string): number {
  const t = g.world.tables.find((x) => x.key === key);
  return t ? t.chairs.filter((c) => g.patron(c.occupant)?.state === "waiting").length : 0;
}

export function tableDirt(g: Game, f: Furniture): number {
  return g.dirt.get(tableKey(f.tiles[0])) ?? 0;
}

/** Is this something that holding Space would clean? */
export function cleanable(g: Game, t: Target | null): boolean {
  if (!t) return false;
  if (t.type === "spill") return true;
  return t.type === "furniture" && t.f.kind === "table" && tableDirt(g, t.f) > 0.3 && !waitingAt(g, `${t.f.tiles[0].x},${t.f.tiles[0].y}`);
}

/** Called every frame while Space is held on something cleanable. Real seconds. */
export function cleanStep(g: Game, t: Target, realDt: number): void {
  const id = targetId(t)!;
  if (!g.cleaning || g.cleaning.targetId !== id) g.cleaning = { targetId: id, progress: 0, total: Math.max(0.8, organic(TUNING.cleanSeconds)) };
  g.cleaning.progress += realDt;
  if (g.cleaning.progress >= g.cleaning.total) {
    if (t.type === "spill") g.spills = g.spills.filter((s) => s.id !== t.s.id);
    else if (t.type === "furniture") g.dirt.set(tableKey(t.f.tiles[0]), 0);
    g.stats.cleaned++;
    g.say(t.type === "spill" ? "Mopped up." : "Table wiped clean.");
    g.cleaning = null;
  }
}

const FURNITURE_RANGE = 1.45;
const PATRON_RANGE = 2.3; // reaches across the counter

/** Everything in reach, best first (nearest, preferring what the keeper faces). */
export function findTargets(g: Game): Target[] {
  const k = g.keeper;
  const found: { t: Target; s: number }[] = [];
  const consider = (t: Target, pos: { x: number; y: number }, range: number) => {
    const d = dist(k.pos, pos);
    if (d > range) return;
    const dx = pos.x - k.pos.x, dy = pos.y - k.pos.y;
    const facing = d > 0.01 ? (dx * k.facing.x + dy * k.facing.y) / d : 1;
    found.push({ t, s: d - facing * 0.6 });
  };
  for (const f of g.world.furniture) {
    // Distance to the nearest tile of the piece, not its centre.
    let near = f.tiles[0];
    let nd = Infinity;
    for (const t of f.tiles) {
      const d = dist(k.pos, { x: t.x + 0.5, y: t.y + 0.5 });
      if (d < nd) { nd = d; near = t; }
    }
    consider({ type: "furniture", f }, { x: near.x + 0.5, y: near.y + 0.5 }, FURNITURE_RANGE);
  }
  for (const p of g.patrons) {
    if (p.state === "entering" || p.state === "leaving") continue;
    consider({ type: "patron", p }, p.pos, PATRON_RANGE);
  }
  for (const s of g.spills) consider({ type: "spill", s }, { x: s.x + 0.5, y: s.y + 0.5 }, 1.1);
  // Set-down trays win over the table or counter they sit on.
  for (const t of g.setDown) consider({ type: "tray", t }, { x: t.x + 0.45, y: t.y + 0.45 }, 1.5);
  found.sort((a, b) => a.s - b.s);
  // Uninteresting furniture (walls of the room, as it were) doesn't crowd the choice.
  const quiet = new Set(["wardrobe", "coats", "pantry"]);
  return found.map((x) => x.t).filter((t, i) => i === 0 || !(t.type === "furniture" && quiet.has(t.f.kind)));
}

/** The thing the keeper would interact with right now. */
export function findTarget(g: Game): Target | null {
  return findTargets(g)[0] ?? null;
}

export function promptFor(g: Game, t: Target | null): string {
  if (!t) return "";
  if (t.type === "tray") {
    const table = g.world.tableAt(t.t.x, t.t.y);
    const n = table ? waitingAt(g, table.key) : 0;
    if (n) return `Space: serve the table from this tray (${n} waiting)`;
    return `Space: pick up the tray (${t.t.tray.items.map((i) => i.name).join(", ")})`;
  }
  if (t.type === "spill") return g.cleaning ? `Mopping… ${Math.floor((g.cleaning.progress / g.cleaning.total) * 100)}%` : "Hold Space or the mouse: mop up the spill";
  if (t.type === "patron") {
    const o = g.order(t.p.orderId);
    const seat = g.world.seats.find((x) => x.id === t.p.seatId);
    const n = seat?.table ? waitingAt(g, `${seat.table.x},${seat.table.y}`) : 0;
    if (n > 1) return `Space: serve the table (${n} waiting) · C: offer something unasked`;
    return o?.open ? `Space: serve ${t.p.name} (${o.label}) · C: offer something unasked` : `${t.p.name} · C: offer something unasked`;
  }
  const f = t.f;
  switch (f.kind) {
    case "table": {
      const tk = `${f.tiles[0].x},${f.tiles[0].y}`;
      const n = waitingAt(g, tk);
      const bowl = g.bowls.get(tk);
      const tap = n && trayItems(g).length ? `Space: serve the table (${n} waiting)`
        : bowl ? (bowl.left < 0.15 ? "Space: refill or clear the snack bowl" : "Space: swap or clear the snack bowl") : "Space: set out snacks";
      if (g.cleaning) return `Wiping… ${Math.floor((g.cleaning.progress / g.cleaning.total) * 100)}%`;
      if (cleanable(g, t)) return `${tap} · hold to wipe${tableDirt(g, f) >= TUNING.tableDirtyAt ? " (it's dirty)" : ""}`;
      return n && !trayItems(g).length ? `${n} waiting here · ${tap}` : tap;
    }
    case "station": {
      const slots = f.slots ?? [];
      const plan = stationPlan(g, f);
      const status = slots.length === 1 ? "" : slots.map((sl) => `${sl.name}: ${slotStatus(g, sl)}`).join(" · ") + " · ";
      const side = sideHint(g, f);
      const more = side ? ` · ${side}` : "";
      if (plan.direct && slots.length === 1) return slotPrompt(g, slots[0]) + more;
      if (plan.direct) return `${status}Space: ${plan.direct.label.toLowerCase()}${more}`;
      if (plan.choices.length) return `${status}Space: choose (${plan.choices.map((c) => c.short).filter((x, i, a) => a.indexOf(x) === i).join(", ")})${more}`;
      return (slots.length === 1 ? slotPrompt(g, slots[0]) : `${status}still cooking`) + more;
    }
    case "gramophone":
      if (!recordsReady()) return "The gramophone (no records yet)";
      if (g.winding) return `Winding… ${Math.round((g.winding.progress / g.winding.total) * 100)}%`;
      return g.gramophone.on ? `Space: change the record (spring ${springLeft(g)})` : "Space: wind it up and play a record";
    case "snacks": {
      const bowl = g.bowls.get(`${f.tiles[0].x},${f.tiles[0].y}`);
      return bowl ? (bowl.left < 0.15 ? "Space: refill the counter bowl" : "Space: swap or clear the counter bowl") : "Space: set out snacks on the counter";
    }
    case "bin": return trayItems(g).length ? "Space: throw something away" : "Scrap bin";
    case "piesafe": return trayItems(g).some((i) => i.whole) ? "Space: put the pie away"
      : g.pieSafe.length ? `Space: take a slice (${g.pieSafe.map((p) => p.left).reduce((a, b) => a + b, 0)} slices)` : "The pie safe is empty";
    case "hatch": return g.hatch.length ? `Space: choose from the hatch (${g.hatch.length})` : "The hatch is empty";
    case "tap": if (g.pouring) return `Pouring… ${Math.round((g.pouring.progress / g.pouring.total) * 100)}%`;
      return `Space: pour ${RECIPES.find((r) => r.id === f.tap)?.name.toLowerCase()}`;
    case "garnish": return "Space or E: garnish a drink";
    case "frontdoor": return g.open ? (g.lastCall ? "Space: bolt the door" : "Space: call last orders") : "Space: open the inn";
    case "fireplace": return g.fireLit ? "Space: put out the fire" : "Space: light the fire";
    case "bed": return "Space: turn in";
    case "desk": return g.paper && !g.paper.read ? "Space: the desk (today's paper is here)" : "Space: bill of fare, paper, equipment, journal";
    default: return `Space: ${f.name.toLowerCase()}`;
  }
}

export function interact(g: Game, t: Target | null): void {
  if (!t) return;
  if (t.type === "spill") return; // cleaning is a hold, handled each frame
  if (t.type === "tray") {
    // A tray on a table where people are waiting: serve them from it. Otherwise pick it up.
    const table = g.world.tableAt(t.t.x, t.t.y);
    if (table && waitingAt(g, table.key)) { serveTable(g, table.key); return; }
    pickUpTray(g, t.t);
    return;
  }
  if (t.type === "patron") { servePatron(g, t.p); return; }
  const f = t.f;
  switch (f.kind) {
    case "table": {
      // A tap serves (if you're carrying something and they're waiting) or sees to the snacks.
      // Holding cleans: that's handled each frame, and never reaches here.
      const key = `${f.tiles[0].x},${f.tiles[0].y}`;
      if (waitingAt(g, key) && trayItems(g).length) { serveTable(g, key); return; }
      openSnackMenu(g, key);
      return;
    }
    case "station": useStation(g, f); return;
    case "gramophone": {
      const gr = g.gramophone;
      if (!recordsReady()) { g.say("No records to play yet."); return; }
      if (g.winding) return; // already winding
      if (!gr.on) { gr.on = true; gr.spring = GRAMOPHONE.springSeconds; gramophoneWound(g); g.say("You wind the gramophone. Stay with it while the crank turns."); }
      else if (springLeft(g) === "winding down") g.say("It's winding down; give it a moment, then wind it again.");
      else { gr.record = (gr.record + 1) % GRAMOPHONE.records.length; gramophoneChanged(); g.say("You change the record."); }
      return;
    }
    case "snacks": openSnackMenu(g, `${f.tiles[0].x},${f.tiles[0].y}`); return;
    case "hatch": openHatchMenu(g); return;
    case "piesafe": openPieSafe(g); return;
    case "bin": openBin(g); return;
    case "tap": startPour(g, `tap:${f.tap}`, f.tap); return;
    case "garnish": openGarnishMenu(g); return;
    case "frontdoor": toggleInn(g); return;
    case "fireplace":
      g.fireLit = !g.fireLit;
      g.say(g.fireLit ? "The fire catches and crackles." : "You bank the fire.");
      return;
    case "bed": askTurnIn(g); return;
    case "desk": openDesk(g); return;
    case "wardrobe": g.say("Your good coat, your other coat."); return;
    case "pantry": g.say("Shelves of everything you need. It never runs out (for now)."); return;
    case "coats": g.say("Pegs, waiting for coats."); return;
  }
}

// ---------------------------------------------------------------------------
// Hatch: choose what to take

export function openHatchMenu(g: Game): void {
  openHatchScreen(g);
}

// ---------------------------------------------------------------------------
// Snack bowls: set out from the table itself. Always optional.

function openSnackMenu(g: Game, key: string): void {
  openSnackScreen(g, key);
}

/** The scrap bin: throw away anything on your trays. */
function openBin(g: Game): void {
  openBinScreen(g);
}

// ---------------------------------------------------------------------------
// The desk: bill of fare, upgrades, journal

export function openDesk(g: Game): void {
  openDeskScreen(g, () => openJournal(g));
}

export function openBillOfFare(g: Game): void {
  openBillOfFareScreen(g);
}

export function openPieSafe(g: Game): void {
  openPieSafeScreen(g);
}

/** The unasked-serve card (C). In this build it's always in hand and never spent. */
export function offerUnasked(g: Game, t: Target | null): void {
  if (t?.type !== "patron") { g.say("🃏 Stand next to someone to offer them something unasked."); return; }
  const p = t.p;
  if (p.state === "entering" || p.state === "leaving") return;
  const items = trayItems(g);
  if (!items.length) { g.say("🃏 You've nothing on your trays to offer."); return; }
  openOfferScreen(g, p);
}

/** Q: set a tray down on the counter or a table. */
export function askSetDown(g: Game): void {
  const [a, b] = g.keeper.trays;
  if (!a.items.length && !b.items.length) { g.say("Your trays are empty."); return; }
  if (!a.items.length) { setTrayDown(g, 1); return; }
  if (!b.items.length) { setTrayDown(g, 0); return; }
  openSetDownScreen(g);
}

// ---------------------------------------------------------------------------
// Crafting menus

function openCraftMenu(g: Game, slot: Slot): void {
  const recipes = recipesFor(g, slot);
  openMenu({
    title: (slot.f.slots?.length ?? 1) > 1 ? `${slot.f.name}: ${slot.name.toLowerCase()}` : slot.f.name,
    subtitle: "What will you make?",
    items: recipes.map((r) => ({
      label: `${r.icon} ${r.name}`,
      sub: `${r.servings ? `about ${r.servings[0]} servings · ` : ""}${r.baseTags.join(", ")} · ~${r.minutes[0]} min${r.tended ? " · tended" : ""}`,
      action: () => openCookScreen(g, slot, r),
    })),
  });
}

/** What a place to cook is doing, in a few words. */
function slotStatus(g: Game, sl: Slot): string {
  const pot = g.pots.get(sl.id);
  if (pot) return `${pot.item.name.toLowerCase()} (${pot.left} left)`;
  const job = g.jobs.get(sl.id);
  const shelf = g.shelves.get(sl.id) ?? [];
  if (job) return `${RECIPES.find((x) => x.id === job.recipeId)?.name.toLowerCase()} ${Math.floor((job.progress / job.total) * 100)}%`;
  if (shelf.length) return `${shelf.length} ready`;
  return "free";
}

/** The prompt for one place to cook (a station with a single slot reads just as it always did). */
function slotPrompt(g: Game, sl: Slot): string {
  const pot = g.pots.get(sl.id);
  if (pot && g.pouring && g.pouring.from === sl.id) return `Pouring… ${Math.round((g.pouring.progress / g.pouring.total) * 100)}%`;
  if (pot?.item.recipeId === "water") return `Space: steep a cup of tea (hot water for ${pot.left} more)`;
  if (pot) return `Space: ${pot.item.kind === "drink" ? "pour a cup of" : "take a serving of"} ${pot.item.name.toLowerCase()} (${pot.left} left)`;
  const shelf = g.shelves.get(sl.id) ?? [];
  const ready = shelf.length ? `Space: pick up ${shelf.map((i) => i.ticketName ? `${i.name} for ${i.ticketName}` : i.name).join(", ")}` : "";
  const job = g.jobs.get(sl.id);
  if (job) {
    const r = RECIPES.find((x) => x.id === job.recipeId)!;
    const cooking = job.done ? `${r.name} done, waiting for room on the shelf` : `${r.name} ${Math.floor((job.progress / job.total) * 100)}% · hold Space to hurry`;
    return ready ? `${ready} · ${cooking}` : cooking;
  }
  return ready || `Space: cook at the ${sl.f.name.toLowerCase()}`;
}

/** One thing you could do at a station. `main`: what Space does (serve, pick up, cook); the rest have their own keys (R puts back, X empties). */
interface StationAct { label: string; sub: string; short: string; main: boolean; run: () => void }

const dishList = (items: { name: string; ticketName?: string }[]) => items.map((i) => (i.ticketName ? `${i.name} for ${i.ticketName}` : i.name)).join(", ");

/** Everything you could do at one place to cook. */
function slotActs(g: Game, sl: Slot, many: boolean): StationAct[] {
  const where = many ? `${sl.name} · ` : "";
  const acts: StationAct[] = [];
  const pot = g.pots.get(sl.id);
  const shelf = g.shelves.get(sl.id) ?? [];
  const job = g.jobs.get(sl.id);
  // Picked up from here by mistake: put it back (one of each dish).
  const back = trayItems(g).filter((i) => canPutBack(g, sl.id, i));
  for (const it of back.filter((x, i) => back.findIndex((y) => y.name === x.name) === i)) {
    acts.push({ label: `↩️ Put back the ${it.name.toLowerCase()}`, sub: `${where}it goes back ${it.fromPot ? (g.pots.get(sl.id) ? "in the pot" : "on the hob, as a pot of one") : "where it was"}`, short: "put back", main: false,
      run: () => { if (putBack(g, sl.id, it)) g.say(`You put the ${it.name.toLowerCase()} back.`); else g.say("There's no room for it there now."); } });
  }
  if (shelf.length) acts.push({ label: `Pick up ${dishList(shelf)}`, sub: `${where}ready`, short: "pick up", main: true, run: () => collectShelf(g, sl.id) });
  if (pot) {
    const name = pot.item.name.toLowerCase();
    if (pot.item.recipeId === "water") acts.push({ label: "🍵 Steep a cup of tea", sub: `${where}hot water for ${pot.left} more`, short: "steep", main: true, run: () => openSteepScreen(g, sl) });
    else acts.push({
      label: `${iconFor(pot.item.recipeId) || "🍲"} ${pot.item.kind === "drink" ? "Pour a cup of" : "Take a serving of"} ${name}`, sub: `${where}${pot.left} left`,
      short: pot.item.kind === "drink" ? "pour" : "take a serving", main: true,
      run: () => (pot.item.kind === "drink" ? startPour(g, sl.id) : serveFromPot(g, sl.id)),
    });
    acts.push({ label: `🗑️ Empty the ${pot.item.recipeId === "water" ? "kettle" : sl.kinds.includes("kettle") ? "urn" : "pot"}`, sub: `${where}${pot.left} ${pot.item.recipeId === "water" ? "cups of hot water" : `servings of ${name}`} · frees it to cook`, short: "empty it", main: false,
      run: () => emptyPot(g, sl.id) });
  }
  if (!pot && !job && !shelf.length) acts.push({ label: `Cook something`, sub: `${where}free`, short: "cook", main: true, run: () => openCraftMenu(g, sl) });
  return acts;
}

/**
 * What pressing Space at a station does: the one thing you'd come for (serve, pick up, cook), done
 * straight away, or a choice when there's more than one (two dishes ready on the range, a hob free and
 * the oven done). Putting a dish back (R) and emptying a pot (X) never come up here.
 */
function stationPlan(g: Game, f: Furniture): { direct?: StationAct; choices: StationAct[] } {
  const slots = f.slots ?? [];
  const acts = slots.flatMap((sl) => slotActs(g, sl, slots.length > 1)).filter((a) => a.main);
  if (acts.length === 1) return { direct: acts[0], choices: acts };
  // More than one dish ready: one choice picks up the lot.
  const pickups = slots.filter((sl) => g.shelves.get(sl.id)?.length);
  if (pickups.length > 1) {
    acts.unshift({ label: "Pick up everything that's ready", sub: dishList(pickups.flatMap((sl) => g.shelves.get(sl.id)!)), short: "pick up", main: true,
      run: () => { for (const sl of pickups) if (!collectShelf(g, sl.id)) break; } });
  }
  return { choices: acts.sort((a, b) => Number(b.main) - Number(a.main)) };
}

/** R and X at a station: put a dish back, or empty a pot. One choice does it; several, you pick. */
function sideActs(g: Game, f: Furniture, short: "put back" | "empty it"): StationAct[] {
  const slots = f.slots ?? [];
  return slots.flatMap((sl) => slotActs(g, sl, slots.length > 1)).filter((a) => a.short === short);
}

function runSide(g: Game, f: Furniture, short: "put back" | "empty it", title: string): void {
  const acts = sideActs(g, f, short);
  if (acts.length === 1) { acts[0].run(); return; }
  openMenu({ title: f.name, subtitle: title, items: acts.map((a) => ({ label: a.label, sub: a.sub, action: () => { closeAll(); a.run(); } })) });
}

/**
 * R (or Q): put something down. At the station a dish came from, it goes back there (into its pot, onto
 * its shelf); anywhere else, a tray goes down on the nearest free spot.
 */
export function putDownHere(g: Game, t: Target | null): void {
  const f = t?.type === "furniture" && t.f.kind === "station" ? t.f : null;
  if (f && sideActs(g, f, "put back").length) { runSide(g, f, "put back", "Put back which?"); return; }
  // At a pot of the same dish that won't take it: say why rather than setting a tray down.
  const pots = f ? (f.slots ?? []).map((sl) => g.pots.get(sl.id)).filter((p) => !!p) : [];
  const near = trayItems(g).find((i) => i.fromPot && pots.some((p) => p.item.recipeId === i.recipeId));
  if (near) {
    const pot = pots.find((p) => p.item.recipeId === near.recipeId)!;
    g.say(pot.left >= pot.total ? `That pot of ${pot.item.name.toLowerCase()} is full.` : `This pot of ${RECIPES.find((r) => r.id === pot.item.recipeId)?.name.toLowerCase() ?? "it"} was made with other ingredients: they don't mix.`);
    return;
  }
  askSetDown(g);
}

/** X: empty a pot, urn or kettle so it's free to cook again. */
export function emptyHere(g: Game, t: Target | null): void {
  const f = t?.type === "furniture" && t.f.kind === "station" ? t.f : null;
  if (!f || !sideActs(g, f, "empty it").length) { g.say("Stand at a pot, urn or kettle to empty it."); return; }
  runSide(g, f, "empty it", "Empty which?");
}

/** What R and X would do here, for the prompt. */
function sideHint(g: Game, f: Furniture): string {
  const back = sideActs(g, f, "put back"), empty = sideActs(g, f, "empty it");
  return [back.length ? "R: put back" : "", empty.length ? "X: empty" : ""].filter(Boolean).join(" · ");
}

function useStation(g: Game, f: Furniture): void {
  const plan = stationPlan(g, f);
  if (plan.direct) { plan.direct.run(); return; }
  if (!plan.choices.length) {
    const job = (f.slots ?? []).map((sl) => g.jobs.get(sl.id)).find(Boolean);
    g.say(job?.done ? "It's done, waiting for room on the shelf." : "Still cooking. Hold Space here to hurry it a little.");
    return;
  }
  openMenu({
    title: f.name,
    subtitle: "What now?",
    items: plan.choices.map((a) => ({ label: a.label, sub: a.sub, action: () => { closeAll(); a.run(); } })),
  });
}

// ---------------------------------------------------------------------------
// Journal: what happened, never the answer.

export function openJournal(g: Game): void {
  g.journalUnread = 0;
  const known = REGULARS.filter((d) => (g.regulars.get(d.id)?.visits ?? 0) > 0);
  openMenu({
    title: "Journal",
    holdsClock: true,
    body: known.length ? undefined : "Nobody you know yet. Regulars will turn up over the days.",
    items: [
      ...known.map((d) => {
        const st = g.regulars.get(d.id)!;
        return { label: st.nameKnown || !d.role ? d.name : d.role, sub: `${st.visits} visit${st.visits === 1 ? "" : "s"}`, action: () => journalPage(g, d.id) };
      }),
      { label: "Passing visitors", sub: `${g.visitorNotes.length} notes`, action: () => visitorPage(g) },
    ],
  });
}

function journalPage(g: Game, id: string): void {
  const d = REGULARS.find((x) => x.id === id)!;
  const st = g.regulars.get(id)!;
  const entries = st.journal.slice(-40).reverse();
  openMenu({
    title: st.nameKnown || !d.role ? d.name : `${d.role} (name not known yet)`,
    body: `<div class="journal"><i>${d.blurb}</i>${entries.map((e) => `<div class="je ${e.kind ?? ""}"><span class="t">${compactDate(g.dateOfDay(e.day), g.date.year)} ${e.time}</span> ${e.text}</div>`).join("") || `<div class="muted">No notes yet. Serve them something.</div>`}</div>`,
    items: [{ label: "Back", action: () => back() }],
  });
}

function visitorPage(g: Game): void {
  const entries = g.visitorNotes.slice(-30).reverse();
  openMenu({
    title: "Passing visitors",
    body: `<div class="journal">${entries.map((e) => `<div class="je ${e.kind ?? ""}"><span class="t">${compactDate(g.dateOfDay(e.day), g.date.year)} ${e.time}</span> ${e.text}</div>`).join("") || "Nothing yet."}</div>`,
    items: [{ label: "Back", action: () => back() }],
  });
}

// ---------------------------------------------------------------------------
// Garnish menus (drinks only)

export function openGarnishMenu(g: Game): void {
  openGarnishScreen(g);
}

// ---------------------------------------------------------------------------
// Turning in

export function askTurnIn(g: Game): void {
  openMenu({
    title: "Turn in?",
    subtitle: "The day ends when you sleep",
    modal: true,
    items: [
      { label: "Not yet", button: "secondary", action: () => closeAll() },
      { label: "Turn in", button: "primary", action: () => { closeAll(); goToSleep(g); } },
    ],
  });
}

export function forcedTurnIn(g: Game): void {
  openMenu({
    title: "“I should turn in…”",
    subtitle: "It's 2 in the morning",
    modal: true,
    items: [{ label: "Off to bed", button: "primary", action: () => { closeAll(); goToSleep(g); } }],
  });
}

function goToSleep(g: Game): void {
  const fade = document.getElementById("fade")!;
  g.modal = true;
  fade.classList.add("on");
  setTimeout(() => {
    const s = endDay(g);
    const o = s.outcomes;
    const row = (k: string, v: number | string) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    openMenu({
      title: `End of ${compactDate(g.dateOfDay(s.day), g.date.year)}`,
      modal: true,
      body: `<table class="summary">
        ${row("Patrons", s.arrivals)}
        ${row("Orders taken", s.orders ?? 0)}
        ${row("Served", s.served)}
        ${row("Delight", o.DELIGHT)}
        ${row("Pleased", o.PLEASED)}
        ${row("Fulfilled", o.FULFILLED)}
        ${row("Unfinished", o.UNFINISHED)}
        ${row("Complaints", o.COMPLAINS)}
        ${row("Left early", s.leftEarly)}
        ${row("Left without being served", s.leftUnserved)}
        ${row("Crafted / garnished", `${s.crafted} / ${s.garnished}`)}
        ${row("Cleaned up", s.cleaned)}
      </table>${s.moments.length ? `<div class="moments">${s.moments.map((m) => `<div>✦ ${m}</div>`).join("")}</div>` : ""}`,
      items: [{
        button: "primary",
        label: `Wake up: ${compactDate(g.dateOfDay(s.day + 1), g.date.year)}`,
        action: () => {
          closeAll();
          startNextDay(g);
          fade.classList.remove("on");
          if (g.seasonNews) {
            openMenu({
              title: g.seasonNews,
              modal: true,
              body: `<p>${longDate(g.date)}.</p>`,
              items: [{ label: "Get up", button: "primary", action: () => closeAll() }],
            });
          }
        },
      }],
    });
  }, 900);
}
