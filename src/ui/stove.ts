// Manage stove: what stands on a stove's back spots (kettles, coffee pots, a Dutch oven), and the spares
// waiting to go on. Swapping is instant. A tab on the stove's menus.

import { EQUIPMENT, lowerName } from "../data.js";
import type { Game } from "../game.js";
import type { Furniture } from "../world.js";
import { emptyPot } from "../crafting.js";
import { askChoice, back, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { grid, gridKeys, type CardSpec } from "./cards.js";

const newUid = () => `eq-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const gearOf = (id: string) => EQUIPMENT.find((e) => e.id === id && e.gear);

/** A stove with back spots for gear. */
export const hasBackSpots = (f: Furniture): boolean => (f.equip?.hotSlots ?? 0) > 0;

/** The tab bar for a stove's menus: whatever its own tabs are, then Manage stove. */
export function stoveTabs(tabs: { id: string; name: string }[], on: string): string {
  return `<div class="bf-tabs">${[...tabs, { id: "manage", name: "🔧 Manage stove" }].map((t) => `<button class="${on === t.id ? "on" : ""}" data-pick="tab:${t.id}">${t.name}</button>`).join("")}</div>`;
}

/** Spare gear on the shelf: bought or taken off, not on a stove. */
const spares = (g: Game): string[] => [...new Set(g.toPlace.filter((id) => gearOf(id)))];

/**
 * The Manage stove view. `tabs`: the tab bar to show; `leave(tab)`: go to another of the stove's tabs
 * (Tab and Shift+Tab step through `order`).
 */
export function manageStoveSpec(g: Game, stoveId: string, tabs: string, order: string[], leave: (tab: string) => void, st = { focus: 0, holding: undefined as string | undefined }): MenuSpec {
  const f = g.world.furniture.find((x) => x.id === stoveId)!;
  const placed = g.layout.find((p) => p.uid === stoveId)!;
  const spots = f.equip?.hotSlots ?? 0;
  const on = g.layout.filter((p) => p.on === stoveId);
  const spare = spares(g);
  const redraw = () => replaceMenu(manageStoveSpec(g, stoveId, tabs, order, leave, st));
  const rebuild = () => { g.rebuildWorld(); redraw(); };

  /** What's keeping a spot busy, if anything. */
  const busy = (uid: string): string | null => {
    if (g.jobs.has(uid)) return "busy: wait till it's done";
    if (g.shelves.get(uid)?.length) return "something's ready on it: pick it up first";
    return null;
  };
  const takeOff = (uid: string, then: () => void) => {
    const q = on.find((p) => p.uid === uid)!;
    const why = busy(uid);
    const name = lowerName(gearOf(q.type)?.name ?? "it");
    if (why) { g.say(`The ${name} is ${why}.`); return; }
    const remove = () => { g.layout = g.layout.filter((p) => p !== q); g.toPlace.push(q.type); then(); };
    const pot = g.pots.get(uid);
    if (!pot) { remove(); return; }
    askChoice({
      title: `Pour away the ${pot.item.name.toLowerCase()}?`,
      body: `<p>The ${name} still has ${pot.left} left in it. Taking it off pours that away.</p>`,
      confirm: "Pour it away", cancel: "Keep it on", danger: true,
      onConfirm: () => { emptyPot(g, uid); back(); remove(); },
      onCancel: () => back(),
    });
  };
  const putOn = (type: string) => {
    g.layout.push({ uid: newUid(), type, x: placed.x, y: placed.y, on: stoveId });
    g.toPlace.splice(g.toPlace.indexOf(type), 1);
    const n = g.newGear.indexOf(type);
    if (n >= 0) g.newGear.splice(n, 1);
    g.say(`You set the ${lowerName(gearOf(type)!.name)} on the ${f.name.toLowerCase()}.`);
  };

  const spotCards: CardSpec[] = Array.from({ length: spots }, (_, i) => {
    const q = on[i];
    const gear = q && gearOf(q.type);
    const why = q ? busy(q.uid) : null;
    const pot = q ? g.pots.get(q.uid) : undefined;
    return {
      pick: `spot:${i}`, icon: gear?.icon ?? "⬚", name: gear?.name ?? "Empty spot",
      fact: `Spot ${i + 1}`,
      status: st.holding ? (q ? `swap for the ${lowerName(gearOf(st.holding)!.name)}` : `put the ${lowerName(gearOf(st.holding)!.name)} here`) : !q ? "free" : why ? why : pot ? `${pot.left} left in it` : "take it off",
      tone: st.holding ? "good" : why ? "warn" : q ? undefined : "muted",
      does: st.holding ? (q ? "Swap them" : "Set it here") : q ? "Take it off, onto the shelf" : "Pick something from the shelf to set here",
    };
  });
  const spareCards: CardSpec[] = spare.map((id) => {
    const gear = gearOf(id)!;
    const n = g.toPlace.filter((x) => x === id).length;
    return {
      pick: `spare:${id}`, icon: gear.icon, name: gear.name, on: st.holding === id,
      fact: n > 1 ? `${n} on the shelf` : "on the shelf",
      status: st.holding === id ? "now pick a spot" : on.length < spots ? "set it on" : "swap it in",
      tone: "good",
      does: on.length < spots ? "Set it on the stove" : "Choose which to swap it for",
    };
  });
  const cards = [...spotCards, ...spareCards];
  st.focus = Math.min(st.focus, Math.max(0, cards.length - 1));
  cards.forEach((c, i) => { c.focus = i === st.focus; });

  const pick = (v: string) => {
    st.focus = Math.max(0, cards.findIndex((c) => c.pick === v));
    if (v.startsWith("spare:")) {
      const id = v.slice(6);
      if (on.length < spots) { putOn(id); st.holding = undefined; g.bus.emit({ type: "MenuSound", sound: "tick" }); rebuild(); return; }
      st.holding = st.holding === id ? undefined : id;
      st.focus = 0;
      redraw();
      return;
    }
    const q = on[Number(v.slice(5))];
    if (st.holding) {
      const id = st.holding;
      if (!q) { putOn(id); st.holding = undefined; g.bus.emit({ type: "MenuSound", sound: "tick" }); rebuild(); return; }
      takeOff(q.uid, () => { putOn(id); st.holding = undefined; g.bus.emit({ type: "MenuSound", sound: "tick" }); rebuild(); });
      return;
    }
    if (q) takeOff(q.uid, () => { g.say(`You take the ${lowerName(gearOf(q.type)!.name)} off and set it on the shelf.`); g.bus.emit({ type: "MenuSound", sound: "tick" }); rebuild(); });
  };
  const keys = gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; redraw(); }, (i) => pick(cards[i].pick));
  const hint = st.holding ? `Where should the ${lowerName(gearOf(st.holding)!.name)} go? Pick a spot on the stove.`
    : spareCards.length ? "Pick something on the stove to take it off, or something on the shelf to set it on."
    : "Pick something on the stove to take it off. Nothing spare on the shelf: kettles, coffee pots and a Dutch oven are bought at the desk.";
  return {
    title: f.name,
    holdsClock: true,
    subtitle: `${spots} spot${spots === 1 ? "" : "s"} at the back for a kettle, a coffee pot or a Dutch oven`,
    view: {
      pinned: tabs,
      html: `<div class="sec-h"><h4>On the stove, and on the shelf</h4><small>${hint}</small></div>${grid(cards)}`,
      onPick: (v) => { if (v.startsWith("tab:")) { if (v !== "tab:manage") leave(v.slice(4)); return; } pick(v); },
      onKey: (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const i = order.indexOf("manage");
          leave(order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length]);
          return true;
        }
        if ((e.key === "Escape" || e.key === "Backspace") && st.holding) { st.holding = undefined; redraw(); return true; }
        return keys(e);
      },
    },
    items: [],
  };
}

/** Open the stove straight on its Manage stove tab (from where there's no other menu to tab from). */
export function openManageStove(g: Game, stoveId: string): void {
  openMenu(manageStoveSpec(g, stoveId, stoveTabs([], "manage"), ["manage"], () => {}));
}
