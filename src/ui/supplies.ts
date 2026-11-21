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
import { back, closeAll, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { grid, gridKeys, stageTone, type CardSpec } from "./cards.js";

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
  const build = (): MenuSpec => {
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
    /** What the goods cards change: the slip, or the standing order being edited. */
    const target = ed ? ed.slip : slip;
    const ing = (id: string) => INGREDIENTS.find((x) => x.id === id)!;
    const refresh = () => replaceMenu(build());
    const change = (i: number, by: number) => {
      const l = lines[i];
      if (!l || (by > 0 && !inSeason(g, l.item))) return;
      target[l.item] = Math.max(0, (target[l.item] ?? 0) + by);
      st.focus = i;
      g.bus.emit({ type: "MenuSound", sound: by > 0 ? "penClick" : "tick" });
      refresh();
    };
    const switchTab = (by: number) => { tab = (tab + by + all.length) % all.length; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); };

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
        pick: String(i), icon: x.icon, name: x.name, focus: i === st.focus, off: true, fact,
        status: `Only in ${seasonsText(l.item)}${seasonsText(l.item) === backIn(g, l.item) ? "" : ` · back in ${backIn(g, l.item)}`}`, tone: "muted",
        count: on ? { ...count, plusOff: true } : undefined,
        detail: `${x.description}${on ? " What's on the slip won't be sent." : ""}${goesInto(g, l.item)}`,
      };
      return {
        pick: String(i), icon: x.icon, name: x.name, focus: i === st.focus, on: on > 0, fact,
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
    const switchPage = (by: number) => { page = pages[(pages.indexOf(page) + by + pages.length) % pages.length]; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); };
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
        </div>
      </div>`;
    const pinned = `<div class="bf-tabs">${all.map((x, i) => `<button class="${i === tab ? "on" : ""}" data-pick="tab:${i}">${x.icon} ${x.name}${g.standing.some((o) => o.supplierId === x.id) ? (g.standing.some((o) => o.supplierId === x.id && !o.paused) ? " 📌" : " ⏸") : ""}${slipEmpty(g.slips[x.id]) ? "" : " ✎"}</button>`).join("")}</div>
      ${ed ? "" : pages.length > 1 ? `<div class="bf-modes">${pages.map((p) => `<button class="${p === page ? "on" : ""}" data-pick="page:${p}">${pageName[p]}</button>`).join("")}</div>` : ""}
      ${ed ? editBox(ed) : page === "slip" ? slipBox : ""}`;

    const goods = (forBill ? `<div class="sec-h"><h4>For your bill of fare</h4><small>what's on it uses these · lowest first</small></div>${grid(cards.slice(0, forBill))}` : "")
      + (cards.length > forBill ? `<div class="sec-h"><h4>${forBill ? "Everything else" : "Their goods"}</h4><small>${forBill ? "nothing on your bill uses these" : "nothing on your bill comes from here"}</small></div>${grid(cards.slice(forBill))}` : "");
    const standingCards: CardSpec[] = mine.map((o, i) => ({
      pick: `so:${i}`, icon: o.paused ? "⏸" : "📌", name: standingWhen(o)[0].toUpperCase() + standingWhen(o).slice(1), focus: i === st.focus,
      fact: `${moneyHtml(slipTotal(s, o.slip))} each time`,
      status: o.paused ? "Paused: nothing placed" : slipEmpty(o.slip) ? "Nothing on it" : `${Object.values(o.slip).filter((n) => n > 0).length} goods`,
      tone: o.paused ? "muted" : "good",
      detail: lines.filter((l) => o.slip[l.item]).map((l) => `${o.slip[l.item]} × ${l.pack.name} of ${ing(l.item).name.toLowerCase()}`).join("<br>") || "Nothing on it.",
      does: "Change it: its goods, its days, pause or cancel it",
    }));
    const editStanding = (i: number) => { const o = mine[i]; if (!o) return; editing = o.id; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); };
    const standingPage = `<div class="sec-h"><h4>Standing orders</h4><small>each placed again for its days, paid as it's placed</small></div>${grid(standingCards)}`;
    const comingPage = coming.map((d) => `<div class="signed"><div class="sg-kicker">${d.standing ? "📌 Placed by your standing order · paid" : "🛻 Signed and sent · paid"}</div><div class="sg-when">${d.day === g.day + 1 ? "Tomorrow" : g.dateOfDay(d.day).weekday}</div><div class="meta">morning, with the carter · ${moneyHtml(slipTotal(s, d.slip))}</div>${lineList(d.slip)}</div>`).join("")
      + `<p class="muted">To cancel one, go to the desk: 🛻 Deliveries.</p>`;

    const items: MenuSpec["items"] = [];
    if (ed) {
      items.push({ label: "✓ Done", sub: "back to the standing orders", button: "primary", action: () => { editing = null; page = "standing"; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); } });
      items.push({ label: `📅 Days: ${standingWhen(ed)}`, sub: "which of their delivery days it comes", button: "secondary", action: () => openDays(g, s, ed, refresh) });
      items.push(ed.paused
        ? { label: "▶ Resume it", sub: "placed again from tomorrow morning", button: "secondary", action: () => { pauseStanding(g, ed, false); g.bus.emit({ type: "MenuSound", sound: "penClick" }); refresh(); } }
        : { label: "⏸ Pause it", sub: "kept as it is, nothing placed until you resume", button: "secondary", action: () => { pauseStanding(g, ed, true); g.bus.emit({ type: "MenuSound", sound: "tick" }); refresh(); } });
      items.push({ label: "Cancel standing order", sub: "what's already sent still comes", button: "secondary", action: () => { stopStanding(g, ed); editing = null; page = mine.length > 1 ? "standing" : "slip"; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "paperClose" }); refresh(); } });
    } else if (page === "slip") {
      if (onSlip.length) {
        items.push({ label: day !== undefined ? `🛻 Send it: ${fmtMoney(total)}` : "They don't deliver", sub: day !== undefined ? `comes ${whenText(g, day)} · the carter charges a few pence a morning` : "fetch it yourself",
          button: "primary", disabled: day === undefined || slipEmpty(live) || g.purse < total, action: () => { if (sendSlip(g, s)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); refresh(); } } });
        if (s.distanceInMinutes !== undefined) items.push({ label: `🚶 Fetch it yourself: ${fmtMoney(total)}`, sub: canFetchFrom(g, s) ? `you're out ${s.distanceInMinutes} min; no carter's fee` : "only while the inn is shut and empty, and they're open",
          disabled: !canFetchFrom(g, s) || slipEmpty(live) || g.purse < total, action: () => { if (fetchSlip(g, s)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); closeAll(); } } });
        if (day !== undefined) items.push({ label: "📌 Send it as a standing order", sub: `placed again for every delivery, paid each time`,
          button: "secondary", disabled: slipEmpty(live) || g.purse < total, action: () => { if (sendStanding(g, s)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); refresh(); } } });
        items.push({ label: "Tear it up", button: "secondary", action: () => { g.slips[s.id] = {}; g.bus.emit({ type: "MenuSound", sound: "paperClose" }); refresh(); } });
      } else if (!slipEmpty(g.lastSlips[s.id])) {
        items.push({ label: "Copy last slip", sub: "the same again", action: () => { g.slips[s.id] = { ...g.lastSlips[s.id] }; refresh(); } });
      }
    }

    return {
      title: "🧺 Buy Supplies",
      subtitle: `${moneyHtml(g.purse)} in the purse · pencil packs onto a slip, then send it or fetch it`,
      holdsClock: true,
      view: {
        pinned,
        html: ed || page === "slip" ? goods : page === "standing" ? standingPage : comingPage,
        onPick: (v) => {
          if (v.startsWith("so:")) { editStanding(Number(v.slice(3))); return; }
          if (v.startsWith("page:")) { const p = v.slice(5) as Page; if (p !== page) { page = p; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); } return; }
          if (v.startsWith("minus:")) { change(Number(v.slice(6)), -1); return; }
          if (v.startsWith("tab:")) { const i = Number(v.slice(4)); if (i !== tab) { tab = i; page = "slip"; editing = null; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); } return; }
          change(Number(v), 1);
        },
        keys: ed ? "Delete takes one off" : `${page === "slip" ? "Delete takes one off · " : ""}Tab another supplier${pages.length > 1 ? " · PgUp/PgDn its pages" : ""}`,
        onKey: (e) => {
          if (e.key === "Tab") { e.preventDefault(); if (!ed) { page = "slip"; switchTab(e.shiftKey ? -1 : 1); } return true; }
          if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); if (!ed && pages.length > 1) switchPage(e.key === "PageUp" ? -1 : 1); return true; }
          if (!ed && page === "standing") return gridKeys(() => standingCards.length, () => st.focus, (i) => { st.focus = i; refresh(); }, editStanding)(e);
          if (!ed && page !== "slip") return false;
          if (e.key === "-" || e.key === "Delete") { change(st.focus, -1); return true; }
          return gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; refresh(); }, (i) => change(i, 1))(e);
        },
      },
      items,
    };
  };
  openMenu(build());
}
