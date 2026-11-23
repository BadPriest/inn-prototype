// Manage: a stove, oven or the hearth, its back spots or hooks, and the gear on the shelf waiting to go on.
// Every piece shows its wear: new or used, its level, its health, what it has picked up. A tab on the
// station's menus.

import { claimUsed, gearShelf, shelveWear, type ShelfItem } from "../used.js";
import { EQUIPMENT, lowerName } from "../data.js";
import type { Game } from "../game.js";
import type { Furniture } from "../world.js";
import { emptyPot } from "../crafting.js";
import { askChoice, back, closeAll, openMenu, replaceMenu, type CardScreen, type MenuSpec, type TabSet } from "./menu.js";
import { grid, type CardSpec, heading } from "./cards.js";
import { seasonLevel, toNextLevel, traitById } from "../seasoning.js";
import { callTinker, canLookOver, healthOf, isBrokenPiece, mostHealth, startMending, tinkerComing, tinkerFee } from "../breakdowns.js";
import { knack } from "../skills.js";
import { moneyHtml } from "../money.js";
import { EQUIPMENT_DATA } from "../gamedata.gen.js";

const newUid = () => `eq-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const gearOf = (id: string) => EQUIPMENT.find((e) => e.id === id && e.gear);

/** A stove with back spots for gear. */
export const hasBackSpots = (f: Furniture): boolean => (f.equip?.hotSlots ?? 0) > 0;
/** Anything that cooks has a Manage tab: how it's wearing in, and its back spots or hooks if it has them. */
export const hasManage = (f: Furniture): boolean => (f.kind === "station" || f.kind === "fireplace") && !!f.equip;

export type StoveTab = { id: string; name: string };
/** The tabs on a stove's screens: whatever its own tabs are, then Manage. */
export function stoveTabs(own: StoveTab[], current: string, pick: (id: string) => void): TabSet {
  return { list: [...own, { id: "manage", name: "🔧 Manage" }].map((t) => ({ id: t.id, label: t.name })), current, pick };
}

type Wear = { made: number; traits: string[]; health?: number; broken?: boolean };

/** A piece's wear, in words: new or used, level, health, and what it has picked up. */
export function wearWords(type: string, w: Wear | undefined): { line: string; age: string; health: string; traits: string; short: string } {
  const made = w?.made ?? 0;
  const most = mostHealth(type);
  const health = Math.round(w?.health ?? most);
  const level = seasonLevel(made);
  const traits = (w?.traits ?? []).map(traitById).filter((t) => !!t);
  const age = made ? `used · level ${level}` : "new";
  return {
    line: `${age} · health ${health} of ${most}${w?.broken ? " · broken" : ""}`,
    age: made ? `Used, level ${level}` : "New",
    health: w?.broken ? "broken" : `health ${health} of ${most}`,
    traits: traits.length ? traits.map((t) => `<div class="desc"><b>${t!.name}</b>: ${t!.text}</div>`).join("") : `<div class="desc">${made ? "Nothing picked up yet." : "Fresh from the shop: it picks something up at each level."}</div>`,
    short: [age, `health ${health}`, ...traits.map((t) => t!.name.toLowerCase())].join(" · "),
  };
}

/** The Manage screen. `own`: the station's other tabs; `leave(tab)`: go to one of them. */
export function manageStoveSpec(g: Game, stoveId: string, own: StoveTab[], leave: (tab: string) => void, st = { focus: 0, holding: undefined as ShelfItem | undefined }): CardScreen {
  const f = g.world.furniture.find((x) => x.id === stoveId)!;
  const placed = g.layout.find((p) => p.uid === stoveId)!;
  const spots = f.equip?.hotSlots ?? 0;
  const on = g.layout.filter((p) => p.on === stoveId);
  const hearth = !!f.equip?.hearth;
  const shelf = gearShelf(g).filter((s) => hearth || !gearOf(s.type)?.hearthOnly);
  const spotWord = hearth ? "hook" : "spot";
  const Spot = hearth ? "Hook" : "Spot";
  const redraw = () => replaceMenu(manageStoveSpec(g, stoveId, own, leave, st));
  const rebuild = () => { g.rebuildWorld(); redraw(); };
  const tick = () => g.bus.emit({ type: "MenuSound", sound: "tick" });
  const H = EQUIPMENT_DATA.health;

  /** What's keeping a spot busy, if anything. */
  const busy = (uid: string): string | null => {
    if (g.jobs.has(uid)) return "cooking: wait till it's done";
    if (g.shelves.get(uid)?.length) return "something's ready on it: pick it up first";
    return null;
  };
  const takeOff = (uid: string, then: () => void) => {
    const q = on.find((p) => p.uid === uid)!;
    const why = busy(uid);
    const name = lowerName(gearOf(q.type)?.name ?? "it");
    if (why) { g.say(`The ${name} is ${why}.`); return; }
    const remove = () => { g.layout = g.layout.filter((p) => p !== q); g.toPlace.push(q.type); shelveWear(g, q.uid, q.type); then(); };
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
  const putOn = (item: ShelfItem) => {
    const uid = newUid();
    g.layout.push({ uid, type: item.type, x: placed.x, y: placed.y, on: stoveId });
    claimUsed(g, uid, item.type, item.worn ?? "new");
    g.toPlace.splice(g.toPlace.indexOf(item.type), 1);
    const n = g.newGear.indexOf(item.type);
    if (n >= 0) g.newGear.splice(n, 1);
    g.say(`You ${hearth ? "hang" : "set"} the ${lowerName(gearOf(item.type)!.name)} ${hearth ? "over the fire" : `on the ${f.name.toLowerCase()}`}.`);
  };

  /** Look it over, or get it mended; for gear, also take it off. */
  const pieceMenu = (uid: string, type: string, name: string, icon: string, gear: boolean) => {
    const handy = knack(g, "handy", 0);
    const broken = isBrokenPiece(g, uid), coming = tinkerComing(g, uid);
    const off: MenuSpec["items"] = gear ? [{ label: `⬆️ Take it off, onto the shelf`, sub: busy(uid) ?? "it keeps its wear",
      disabled: !!busy(uid), action: () => { back(); takeOff(uid, () => { g.say(`You take the ${lowerName(name)} off and set it on the shelf.`); tick(); rebuild(); }); } }] : [];
    openMenu({
      title: `${icon} ${name}`,
      subtitle: wearWords(type, g.seasoning[uid]).line,
      holdsClock: true,
      items: [
        ...off,
        ...(broken ? [
          { label: "🔧 Send for the tinker", sub: coming ? "he's on his way" : `${moneyHtml(tinkerFee(type))} · he comes in about ${Math.round(H.tinker.minutes / 60)} hours and mends it good as new`,
            disabled: !!coming, action: () => { if (callTinker(g, uid, type, name)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); back(); redraw(); } } },
          { label: "🛠️ Mend it yourself", sub: handy ? `about ${H.mendSeconds} seconds at it · mended to ${Math.round(handy * 100)}% of its health` : "needs the Handy knack (Skills, at the desk)",
            disabled: !handy, action: () => { closeAll(); startMending(g, uid, name, "mend"); } },
        ] : [
          { label: "👀 Look it over", sub: canLookOver(g, uid) ? `about ${H.lookOver.seconds} seconds at it · ${H.lookOver.restores} health back · once a day` : "already looked over today",
            disabled: !canLookOver(g, uid), action: () => { closeAll(); startMending(g, uid, name, "look"); } },
        ]),
        { label: "Not now", button: "secondary", cancel: true, action: () => back() },
      ],
    });
  };

  // The station itself, if it cooks on its own (a hearth only cooks through its hooks).
  const own_ = (f.equip?.slots.length ?? 0) > 0;
  const mine = g.seasoning[f.id];
  const next = toNextLevel(mine?.made ?? 0);
  const selfCard: CardSpec[] = own_ ? [{
    pick: "self", icon: f.equip!.icon, name: f.name,
    fact: wearWords(f.equip!.id, mine).line,
    status: isBrokenPiece(g, f.id) ? (tinkerComing(g, f.id) ? "broken · the tinker's coming" : "broken: nothing cooks on it") : next ? `${next.left} more servings to level ${seasonLevel(mine?.made ?? 0) + 1}` : "fully worn in",
    tone: isBrokenPiece(g, f.id) ? "warn" : undefined,
    body: wearWords(f.equip!.id, mine).traits,
    detail: `${mine?.made ?? 0} servings made on it. ${next ? `Level ${seasonLevel(mine?.made ?? 0) + 1} at ${next.at}.` : "It's reached its last level."}`,
    does: isBrokenPiece(g, f.id) ? "Mend it, or send for the tinker" : "Look it over",
  }] : [];

  const holdName = st.holding ? lowerName(gearOf(st.holding.type)!.name) : "";
  const spotCards: CardSpec[] = Array.from({ length: spots }, (_, i) => {
    const q = on[i];
    if (!q) return {
      pick: `spot:${i}`, icon: "⬚", name: `Empty ${spotWord}`, fact: `${Spot} ${i + 1}`,
      status: st.holding ? `put the ${holdName} here` : "free",
      tone: st.holding ? "good" : "muted",
      body: `<div class="desc">${shelf.length ? "Pick something on the shelf below to put here." : "Nothing on the shelf to put here."}</div>`,
      does: st.holding ? `Put the ${holdName} here` : shelf.length ? "Pick from the shelf below" : "Buy gear at the desk",
    };
    const gear = gearOf(q.type)!;
    const w = wearWords(q.type, g.seasoning[q.uid]);
    const why = busy(q.uid);
    const pot = g.pots.get(q.uid);
    return {
      pick: `spot:${i}`, icon: gear.icon, name: gear.name, fact: `${Spot} ${i + 1} · ${w.age}`,
      status: st.holding ? `swap for the ${holdName}` : why ?? (pot ? `${pot.left} left in it` : w.health),
      tone: st.holding ? "good" : why || isBrokenPiece(g, q.uid) ? "warn" : undefined,
      body: w.traits,
      does: st.holding ? `Swap it for the ${holdName}` : "Take it off, look it over",
    };
  });
  const shelfCards: CardSpec[] = shelf.map((s) => {
    const gear = gearOf(s.type)!;
    const w = wearWords(s.type, s.worn !== undefined ? g.usedWaiting[s.worn]?.state : undefined);
    const held = st.holding?.key === s.key;
    return {
      pick: `shelf:${s.key}`, icon: gear.icon, name: gear.name, on: held, fact: w.age,
      status: held ? `now pick a ${spotWord}` : w.health,
      tone: "good",
      body: w.traits,
      does: on.length < spots ? (hearth ? "Hang it over the fire" : "Put it on the stove") : `Pick which to swap it for`,
    };
  });
  const cards = [...selfCard, ...spotCards, ...shelfCards];
  st.focus = Math.min(st.focus, Math.max(0, cards.length - 1));
  cards.forEach((c, i) => { c.focus = i === st.focus; });

  const pick = (v: string) => {
    st.focus = Math.max(0, cards.findIndex((c) => c.pick === v));
    if (v === "self") { pieceMenu(f.id, f.equip!.id, f.name, f.equip!.icon, false); return; }
    if (v.startsWith("shelf:")) {
      const item = shelf.find((s) => s.key === v.slice(6));
      if (!item) return;
      if (on.length < spots) { putOn(item); st.holding = undefined; tick(); rebuild(); return; }
      st.holding = st.holding?.key === item.key ? undefined : item;
      st.focus = selfCard.length;
      redraw();
      return;
    }
    const q = on[Number(v.slice(5))];
    if (st.holding) {
      const item = st.holding;
      if (!q) { putOn(item); st.holding = undefined; tick(); rebuild(); return; }
      takeOff(q.uid, () => { putOn(item); st.holding = undefined; tick(); rebuild(); });
      return;
    }
    if (q) pieceMenu(q.uid, q.type, gearOf(q.type)!.name, gearOf(q.type)!.icon, true);
  };

  const where = hearth ? "over the fire" : "at the back of the stove";
  const shelfHint = st.holding ? `Now pick a ${spotWord} above for the ${holdName}.`
    : shelf.length ? (on.length < spots ? `Pick one to put it on.` : `Every ${spotWord} is taken: pick one, then the ${spotWord} to swap it for.`)
    : `Empty. Kettles, coffee pots, Dutch ovens${hearth ? " and hanging pots" : ""} are bought at the desk; what you take off waits here.`;
  const html = [
    selfCard.length ? `${heading(hearth ? "The fireplace" : "The stove itself", "how it's wearing in · pick it to look it over")}${grid(selfCard)}` : "",
    spots ? `${heading(hearth ? `Hooks over the fire (${on.length} of ${spots} used)` : `Small spots ${where} (${on.length} of ${spots} used)`, hearth ? "they cook while the fire's lit" : "for a kettle, a coffee pot or a Dutch oven")}${grid(spotCards)}` : "",
    spots ? `${heading(`On the shelf (${shelf.length})`, shelfHint)}${shelfCards.length ? grid(shelfCards) : ""}` : "",
  ].join("");
  return {
    title: f.name,
    holdsClock: true,
    subtitle: !spots ? "How it's wearing in: the more you make on it, the more it picks up"
      : st.holding ? `Where should the ${holdName} go? Pick a ${spotWord}.`
      : `What's ${where}, and what's on the shelf to go there · pick anything to see to it`,
    tabs: own.length ? stoveTabs(own, "manage", (id) => { if (id !== "manage") leave(id); }) : undefined,
    cards: html,
    nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; redraw(); }, use: (i) => pick(cards[i].pick) },
    onPick: pick,
    cancel: st.holding ? { label: "Put it back", run: () => { st.holding = undefined; redraw(); } } : undefined,
  };
}

/** Open the station straight on its Manage tab (from where there's no other menu to tab from). */
export function openManageStove(g: Game, stoveId: string): void {
  openMenu(manageStoveSpec(g, stoveId, [], () => {}));
}
