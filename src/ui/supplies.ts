// The Supplies screen at the desk: a tab per supplier, their goods as cards (pick one, or its +, to pencil a
// pack onto the slip; its −, - or Delete takes one off), the slip and the supplier's terms pinned on top.

import type { Game, StandingOrder } from "../game.js";
import type { SupplierData } from "../gamedata.js";
import { INGREDIENTS, RECIPES, garnishesFor } from "../data.js";
import { knows } from "../skills.js";
import { fmtMoney, moneyHtml } from "../money.js";
import { amount, have, stageName, stagesInPantry, startingPantry } from "../stock.js";
import {
  canFetchFrom, deliveryDaysText, fetchSlip, linesOf, nextDeliveryDay, packContents, packPrice, sendSlip, slipEmpty, slipOf, slipTotal,
  suppliersHere, whenText, inSeason, backIn, seasonsText, sendStanding, stopStanding, pauseStanding, standingWhen, supplierDays, dayName, toggleStandingDay,
} from "../supplies.js";
import { roadsNote } from "../roads.js";
import { back, closeAll, openMenu, replaceMenu, type CardScreen, type MenuSpec } from "./menu.js";
import { grid, stageTone, type CardSpec, heading } from "./cards.js";

let tab = 0; // the screen opens on the supplier you left it at
type Page = "slip" | "standing" | "coming";
let page: Page = "slip"; // the supplier's sub-tab
let editing: number | null = null; // the standing order being changed on the goods cards, if any

/** Below this share of the starting pantry, an ingredient the bill uses is running low. */
const LOW_SHARE = 0.25;

/** Each ingredient the dishes on the bill of fare use, with those dishes' names. */
function usedByBill(g: Game): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of RECIPES.filter((x) => g.billAllDay().has(x.id))) {
    const ids = new Set([...r.fundamental.map((u) => u.id), ...r.base.options.map((o) => o.id), ...r.optional.options.map((o) => o.id), ...(r.boughtAs ? [r.boughtAs] : [])]);
    for (const id of ids) out.set(id, [...(out.get(id) ?? []), r.name.toLowerCase()]);
  }
  return out;
}

/** The recipes an ingredient can go into: as itself, through a role it fills (cooking fat), as a garnish, or bought ready. */
function recipesUsing(id: string) {
  const ing = INGREDIENTS.find((x) => x.id === id);
  return RECIPES.filter((r) => !r.internal && (
    r.fundamental.some((u) => u.id === id || (!!u.role && !!ing?.roles.includes(u.role)))
    || r.base.options.some((o) => o.id === id) || r.optional.options.some((o) => o.id === id)
    || r.boughtAs === id || garnishesFor(r.id).some((x) => x.id === id)));
}

/** Where an ingredient goes, for its card: the recipes you know that use it. */
function goesInto(g: Game, id: string): string {
  const all = recipesUsing(id);
  if (!all.length) return "";
  const known = all.filter((r) => knows(g, r.id)).map((r) => r.name.toLowerCase());
  if (!known.length) return `<div class="goes">None of the recipes you know use it.</div>`;
  return `<div class="goes">Goes into ${known.length > 1 ? `${known.slice(0, -1).join(", ")} and ${known[known.length - 1]}` : known[0]}.</div>`;
}

/** A standing order's days: a tick for each of the supplier's delivery days it comes. */
function openDays(g: Game, s: SupplierData, o: StandingOrder, done: () => void): void {
  const spec = (index = 0): MenuSpec => ({
    title: "📅 Which days?",
    subtitle: `Standing order with ${s.name}: ${standingWhen(o)}`,
    focus: index,
    onLeave: done,
    items: [
      ...supplierDays(s).map((d, i) => ({ label: `${o.days.includes(d) ? "☑" : "☐"} ${dayName(d)}`, action: () => { toggleStandingDay(o, d); g.bus.emit({ type: "MenuSound", sound: "tick" }); replaceMenu(spec(i)); } })),
      { label: "Done", button: "primary" as const, action: () => back() },
    ],
  });
  openMenu(spec());
}

export function openSupplies(g: Game): void {
  const st = { focus: 0 };
  const build = (): CardScreen => {
    const all = suppliersHere(g);
    tab = Math.min(tab, all.length - 1);
    const s = all[tab];
    const uses = usedByBill(g);
    const start = startingPantry();
    const left = (id: string) => have(g, id) / Math.max(1, start[id] ?? 1);
    const low = (id: string) => left(id) < LOW_SHARE;
    const lines = [...linesOf(s)].sort((a, b) => Number(uses.has(b.item)) - Number(uses.has(a.item)) || Number(inSeason(g, b.item)) - Number(inSeason(g, a.item)) || (uses.has(a.item) ? left(a.item) - left(b.item) : 0));
    const forBill = lines.filter((l) => uses.has(l.item)).length;
    const slip = slipOf(g, s);
    const mine = g.standing.filter((o) => o.supplierId === s.id);
    const ed = mine.find((o) => o.id === editing);
    if (!ed) editing = null;
    /** Editing a standing order: two cards for the order itself (its days, stopping it) come before the goods. */
    const off = ed ? 2 : 0;
    /** What the goods cards change: the slip, or the standing order being edited. */
    const target = ed ? ed.slip : slip;
    const ing = (id: string) => INGREDIENTS.find((x) => x.id === id)!;
    const refresh = () => replaceMenu(build());
    const change = (i: number, by: number) => {
      const l = lines[i];
      if (!l || (by > 0 && !inSeason(g, l.item))) return;
      target[l.item] = Math.max(0, (target[l.item] ?? 0) + by);
      st.focus = i + off;
      g.bus.emit({ type: "MenuSound", sound: by > 0 ? "penClick" : "tick" });
      refresh();
    };

    /** What's in the pantry, stage by stage: "Pantry: 71 lb (fresh), 6 lb (on the turn)". */
    const pantryLine = (id: string) => {
      const st = stagesInPantry(g, id);
      return `Pantry: ${st.length ? st.map((x) => `<span class="st-${stageTone(x.index, x.effect)}">${+x.units.toFixed(1)} (${stageName(x.stage)})</span>`).join(", ") : "none"}`;
    };
    const cards: CardSpec[] = lines.map((l, i) => {
      const x = ing(l.item);
      const on = target[l.item] ?? 0;
      const fact = `${moneyHtml(packPrice(s, l))} <span class="unit">${l.pack.name}</span>`;
      const count = { n: on, minus: `minus:${i}`, plus: String(i) };
      if (!inSeason(g, l.item)) return {
        pick: String(i), icon: x.icon, name: x.name, focus: i + off === st.focus, off: true, fact,
        status: `Only in ${seasonsText(l.item)}${seasonsText(l.item) === backIn(g, l.item) ? "" : ` · back in ${backIn(g, l.item)}`}`, tone: "muted",
        count: on ? { ...count, plusOff: true } : undefined,
        detail: `${x.description}${on ? " What's on the slip won't be sent." : ""}${goesInto(g, l.item)}`,
      };
      return {
        pick: String(i), icon: x.icon, name: x.name, focus: i + off === st.focus, on: on > 0, fact,
        status: pantryLine(l.item),
        under: stagesInPantry(g, l.item).slice(1).map((x) => stageTone(x.index, x.effect)),
        tone: have(g, l.item) <= 0 || (uses.has(l.item) && low(l.item)) ? "warn" : undefined,
        count,
        detail: `${x.description}${goesInto(g, l.item)}`,
        does: ed ? (on ? "Add one more to the standing order" : "Add one to the standing order") : on ? "Add one more" : "Pencil one onto the slip",
      };
    });

    const live = Object.fromEntries(Object.entries(slip).filter(([id]) => inSeason(g, id)));
    const total = slipTotal(s, live);
    const day = nextDeliveryDay(g, s);
    const coming = g.deliveries.filter((d) => d.supplierId === s.id);
    const onSlip = lines.filter((l) => slip[l.item]);
    const standing = mine.length > 0;
    const terms = [
      deliveryDaysText(s) + (s.orderBy !== undefined ? `, order by ${s.orderBy}:00` : ""),
      s.distanceInMinutes !== undefined ? `fetch it yourself: ${s.distanceInMinutes} min there and back, open ${s.openHours?.[0]}:00–${s.openHours?.[1]}:00` : "",
    ].filter(Boolean).join(" · ");
    // Sub-tabs for this supplier (PageUp/PageDown, L2/R2): the slip and their goods; the standing order; what's on its way.
    const pages = (["slip", standing ? "standing" : "", coming.length ? "coming" : ""].filter(Boolean)) as Page[];
    if (!pages.includes(page)) page = "slip";
    const pageName: Record<Page, string> = { slip: "📝 Slip", standing: `📌 Standing orders (${mine.length})`, coming: `🛻 On its way (${coming.length})` };
    const lineList = (sl: Record<string, number>) => `<div class="slip-lines">${lines.filter((l) => sl[l.item]).map((l) => `<span class="slip-line${inSeason(g, l.item) ? "" : " gone"}"><b>${sl[l.item]}</b> × ${l.pack.name} of ${ing(l.item).name.toLowerCase()}${inSeason(g, l.item) ? "" : ` <em>only in ${seasonsText(l.item)}</em>`}</span>`).join("")}</div>`;

    const editBox = (o: StandingOrder) => `<div class="dish result standing-edit${slipEmpty(o.slip) ? " empty" : ""}">
        <span class="ic">${o.paused ? "⏸" : "📌"}</span>
        <div class="dish-body">
          <div class="nm">Standing order with ${s.name}, ${standingWhen(o)}${o.paused ? " <small>(paused)</small>" : ""}<span class="slip-total">${moneyHtml(slipTotal(s, o.slip))} each time</span></div>
          ${slipEmpty(o.slip) ? `<div class="slip-lines"><span class="slip-empty">Nothing on it: nothing is placed until you add something.</span></div>` : lineList(o.slip)}
          <div class="meta">Changes count from the next one placed · paid as it's placed · the goods below change this order, not your slip</div>
        </div>
      </div>`;
    const slipBox = `<div class="dish result ${onSlip.length ? "" : "empty"}">
        <span class="ic">📝</span>
        <div class="dish-body">
          <div class="nm">Slip for ${s.name}${s.people[0] ? ` <small>(${s.people[0]})</small>` : ""}${onSlip.length ? `<span class="slip-total">${moneyHtml(total)}</span>` : ""}</div>
          <div class="slip-lines">${onSlip.length ? onSlip.map((l) => inSeason(g, l.item)
            ? `<span class="slip-line"><b>${slip[l.item]}</b> × ${l.pack.name} of ${ing(l.item).name.toLowerCase()}</span>`
            : `<span class="slip-line gone"><s><b>${slip[l.item]}</b> × ${l.pack.name} of ${ing(l.item).name.toLowerCase()}</s> <em>only in ${seasonsText(l.item)}</em></span>`).join("") : `<span class="slip-empty">Nothing pencilled in yet: pick their goods below.</span>`}</div>
          <div class="meta">${terms}</div>
          ${s.deliveryDays ? `<div class="meta roads">🛻 ${roadsNote(g)}</div>` : ""}
        </div>
      </div>`;
    const summary = ed ? editBox(ed) : page === "slip" ? slipBox : "";

    const goods = (forBill ? `${heading(`For your bill of fare`, `what's on it uses these · lowest first`)}${grid(cards.slice(0, forBill))}` : "")
      + (cards.length > forBill ? `${heading(`${forBill ? "Everything else" : "Their goods"}`, `${forBill ? "nothing on your bill uses these" : "nothing on your bill comes from here"}`)}${grid(cards.slice(forBill))}` : "");
    const standingCards: CardSpec[] = mine.map((o, i) => ({
      pick: `so:${i}`, icon: o.paused ? "⏸" : "📌", name: standingWhen(o)[0].toUpperCase() + standingWhen(o).slice(1), focus: i === st.focus,
      fact: `${moneyHtml(slipTotal(s, o.slip))} each time`,
      status: o.paused ? "Paused: nothing placed" : slipEmpty(o.slip) ? "Nothing on it" : `${Object.values(o.slip).filter((n) => n > 0).length} goods`,
      tone: o.paused ? "muted" : "good",
      detail: lines.filter((l) => o.slip[l.item]).map((l) => `${o.slip[l.item]} × ${l.pack.name} of ${ing(l.item).name.toLowerCase()}`).join("<br>") || "Nothing on it.",
      does: "Change it: its goods, its days, pause or cancel it",
    }));
    const editStanding = (i: number) => { const o = mine[i]; if (!o) return; editing = o.id; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); };
    const standingPage = `${heading(`Standing orders`, `each placed again for its days, paid as it's placed`)}${grid(standingCards)}`;
    const comingPage = coming.map((d) => `<div class="signed"><div class="sg-kicker">${d.standing ? "📌 Placed by your standing order · paid" : "🛻 Signed and sent · paid"}</div><div class="sg-when">${d.day === g.day + 1 ? "Tomorrow" : g.dateOfDay(d.day).weekday}</div><div class="meta">morning, with the carter · ${moneyHtml(slipTotal(s, d.slip))}</div>${lineList(d.slip)}</div>`).join("")
      + `<p class="muted">To cancel one, go to the desk: 🛻 Deliveries.</p>`;

    // Editing a standing order: its days and stopping it, as cards before the goods.
    const edCards: CardSpec[] = ed ? [
      { pick: "ed:days", icon: "📅", name: "Delivery days", focus: st.focus === 0, fact: standingWhen(ed),
        status: "which of their delivery days it comes", detail: `${s.name} deliver ${deliveryDaysText(s).toLowerCase()}. A standing order can come on all of those days or only some.`, does: "Choose the days" },
      { pick: "ed:stop", icon: "✖", name: "Stop it", focus: st.focus === 1, fact: "cancel this standing order",
        status: "what's already sent still comes", tone: "warn", does: "Stop the standing order" },
    ] : [];
    const stop = () => { if (!ed) return; stopStanding(g, ed); editing = null; page = mine.length > 1 ? "standing" : "slip"; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "paperClose" }); refresh(); };
    /** Send the slip: by the carter, fetched yourself, or as a standing order. */
    const sendHow = () => {
      const fetchable = s.distanceInMinutes !== undefined;
      const how: MenuSpec = {
        title: `Send the order to ${s.name}`,
        subtitle: `${fmtMoney(total)} · how should it come?`,
        items: [
          { label: "🛻 Delivery", sub: day !== undefined ? `the carter brings it ${whenText(g, day)}, by 8 if the roads are clear · a few pence a morning` : "they don't deliver",
            disabled: day === undefined, action: () => { back(); if (sendSlip(g, s)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); refresh(); } } },
          ...(fetchable ? [{ label: "🚶 Fetch it yourself", sub: canFetchFrom(g, s) ? `you're out ${s.distanceInMinutes} min; no carter's fee` : "only while the inn is shut and empty, and they're open",
            disabled: !canFetchFrom(g, s), action: () => { back(); if (fetchSlip(g, s)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); closeAll(); } } }] : []),
          { label: "📌 Standing order", sub: day !== undefined ? "the carter brings the same again every delivery, paid each time" : "they don't deliver",
            disabled: day === undefined, action: () => { back(); if (sendStanding(g, s)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); refresh(); } } },
          { label: "Not now", button: "secondary", cancel: true, action: () => back() },
        ],
      };
      openMenu(how);
    };
    const onPage = ed ? "edit" : page;
    const navCards = ed ? edCards.length + cards.length : page === "slip" ? cards.length : page === "standing" ? standingCards.length : 0;
    const useCard = (i: number) => {
      if (ed && i < off) { if (i === 0) openDays(g, s, ed, refresh); else stop(); return; }
      if (onPage === "standing") { editStanding(i); return; }
      change(i - off, 1);
    };
    const hasLast = !slipEmpty(g.lastSlips[s.id]);
    return {
      title: "🧺 Buy Supplies",
      subtitle: ed ? `${moneyHtml(g.purse)} in the purse · change the standing order: its goods, its days` : `${moneyHtml(g.purse)} in the purse · pencil packs onto the slip, then send the order`,
      holdsClock: true,
      tabs: ed ? undefined : {
        list: all.map((x) => ({ id: x.id, label: `${x.icon} ${x.name}${g.standing.some((o) => o.supplierId === x.id) ? (g.standing.some((o) => o.supplierId === x.id && !o.paused) ? " 📌" : " ⏸") : ""}${slipEmpty(g.slips[x.id]) ? "" : " ✎"}` })),
        current: s.id,
        pick: (id) => { tab = Math.max(0, all.findIndex((x) => x.id === id)); page = "slip"; editing = null; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); },
      },
      modes: !ed && pages.length > 1 ? { list: pages.map((p) => ({ id: p, label: pageName[p] })), current: page, pick: (id) => { page = id as Page; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); } } : undefined,
      summary,
      cards: ed ? `${heading(`This standing order`, `its days, or stop it`)}${grid(edCards)}${goods}` : page === "slip" ? goods : page === "standing" ? standingPage : comingPage,
      onPick: (v) => {
        if (v === "ed:days" && ed) { openDays(g, s, ed, refresh); return; }
        if (v === "ed:stop") { stop(); return; }
        if (v.startsWith("so:")) { editStanding(Number(v.slice(3))); return; }
        if (v.startsWith("minus:")) { change(Number(v.slice(6)), -1); return; }
        change(Number(v), 1);
      },
      keys: onPage === "slip" || ed ? "Delete takes one off" : undefined,
      onKey: (e) => {
        if ((e.key === "-" || e.key === "Delete") && (ed || page === "slip") && st.focus >= off) { change(st.focus - off, -1); return true; }
        return false;
      },
      nav: { count: () => navCards, focus: () => st.focus, setFocus: (i) => { st.focus = i; refresh(); }, use: useCard },
      confirm: ed
        ? { label: "✓ Done", sub: "back to the standing orders", run: () => { editing = null; page = "standing"; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); } }
        : page === "slip" ? { label: "Send order…", sub: onSlip.length ? `${fmtMoney(total)} · delivery, fetch it, or a standing order` : "pencil something onto the slip first", disabled: slipEmpty(live) || g.purse < total, run: sendHow } : undefined,
      alt: ed
        ? (ed.paused
          ? { label: "▶ Resume", sub: "placed again from tomorrow morning", run: () => { pauseStanding(g, ed, false); g.bus.emit({ type: "MenuSound", sound: "penClick" }); refresh(); } }
          : { label: "⏸ Pause", sub: "kept as it is, nothing placed until you resume", run: () => { pauseStanding(g, ed, true); g.bus.emit({ type: "MenuSound", sound: "tick" }); refresh(); } })
        : page !== "slip" ? undefined
        : onSlip.length ? { label: "Clear the slip", run: () => { g.slips[s.id] = {}; g.bus.emit({ type: "MenuSound", sound: "paperClose" }); refresh(); } }
        : hasLast ? { label: "Copy last order slip", sub: "the same again", run: () => { g.slips[s.id] = { ...g.lastSlips[s.id] }; g.bus.emit({ type: "MenuSound", sound: "penClick" }); refresh(); } }
        : undefined,
    };
  };
  openMenu(build());
}
