// The Deliveries screen at the desk: what's on its way (cancel it until the supplier's order-by hour the
// evening before), crates waiting at the kitchen door, and the deliveries that came, newest first.

import type { Game } from "../game.js";
import { INGREDIENTS } from "../data.js";
import { moneyHtml } from "../money.js";
import { SUPPLIERS_DATA } from "../gamedata.gen.js";
import { canCancel, cancelDelivery, linesOf, slipTotal } from "../supplies.js";
import { askChoice, back, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { grid, gridKeys, type CardSpec } from "./cards.js";

const supplier = (id: string) => SUPPLIERS_DATA.suppliers.find((s) => s.id === id);

/** What's on a slip, a line each: "2 × a dozen of egg". */
function slipLines(supplierId: string, slip: Record<string, number>): string {
  const s = supplier(supplierId);
  return Object.entries(slip).filter(([, n]) => n > 0).map(([id, n]) => {
    const pack = s ? linesOf(s).find((l) => l.item === id)?.pack.name : undefined;
    const name = INGREDIENTS.find((x) => x.id === id)?.name.toLowerCase() ?? id;
    return `${n} × ${pack ? `${pack} of ` : ""}${name}`;
  }).join("<br>");
}

const HOW: Record<Game["deliveryLog"][number]["how"], { icon: string; word: string }> = {
  sent: { icon: "🛻", word: "Came with the carter" },
  standing: { icon: "📌", word: "Standing order, came with the carter" },
  fetched: { icon: "🚶", word: "Fetched yourself" },
  cancelled: { icon: "✕", word: "Cancelled, money back" },
};

export function openDeliveries(g: Game): void {
  const st = { focus: 0 };
  const dayName = (day: number) => (day === g.day ? "Today" : day === g.day + 1 ? "Tomorrow" : day === g.day - 1 ? "Yesterday" : `${g.dateOfDay(day).weekday} ${g.dateOfDay(day).dayOfSeason}`);
  const build = (): MenuSpec => {
    const coming = [...g.deliveries].sort((a, b) => a.day - b.day);
    const past = [...g.deliveryLog].reverse();
    let i = 0;
    const comingCards: CardSpec[] = coming.map((d) => {
      const s = supplier(d.supplierId);
      const can = canCancel(g, d);
      return {
        pick: `c:${i}`, icon: d.standing ? "📌" : "🛻", name: s?.name ?? d.supplierId, focus: i++ === st.focus,
        fact: `${dayName(d.day)} · ${s ? moneyHtml(slipTotal(s, d.slip)) : ""}`,
        status: can ? `Paid · can cancel until ${s?.orderBy ?? 24}:00 the evening before` : "Paid · the carter has it",
        tone: "good",
        detail: `${d.standing ? "Placed by your standing order. " : ""}${slipLines(d.supplierId, d.slip)}`,
        does: can ? "Cancel it, money back" : "Too late to cancel",
      };
    });
    const crateCards: CardSpec[] = g.crates.map((c) => ({
      pick: `k:${i}`, icon: "📦", name: "At the kitchen door", focus: i++ === st.focus,
      fact: dayName(c.day), status: "Carry it in to the pantry", tone: "warn",
      detail: c.got.join("<br>"),
    }));
    const pastCards: CardSpec[] = past.map((e) => ({
      pick: `p:${i}`, icon: HOW[e.how].icon, name: supplier(e.supplierId)?.name ?? e.supplierId, focus: i++ === st.focus,
      fact: `${dayName(e.day)} · ${moneyHtml(e.total)}`,
      status: HOW[e.how].word, tone: e.how === "cancelled" ? "muted" : undefined,
      detail: slipLines(e.supplierId, e.slip),
    }));
    const all = [...comingCards, ...crateCards, ...pastCards];
    const section = (title: string, note: string, cards: CardSpec[]) => (cards.length ? `<div class="sec-h"><h4>${title}</h4><small>${note}</small></div>${grid(cards)}` : "");
    const pick = (n: number) => {
      const d = coming[n];
      if (!d || n >= comingCards.length || !canCancel(g, d)) return;
      const s = supplier(d.supplierId);
      st.focus = n;
      askChoice({
        title: "Cancel this order?",
        body: `${s?.name ?? d.supplierId}, ${dayName(d.day).toLowerCase()}: ${s ? moneyHtml(slipTotal(s, d.slip)) : ""} back in the purse.${d.standing ? " Your standing order carries on after it." : " Its lines go back on the slip."}`,
        confirm: "Cancel order", cancel: "Keep it", danger: true,
        onConfirm: () => { back(); if (cancelDelivery(g, d)) g.bus.emit({ type: "MenuSound", sound: "paperClose" }); st.focus = 0; replaceMenu(build()); },
        onCancel: () => back(),
      });
    };
    return {
      title: "🛻 Deliveries",
      subtitle: `${moneyHtml(g.purse)} in the purse · what's on its way, and what came`,
      holdsClock: true,
      view: {
        html: all.length
          ? section("On its way", "paid when sent", comingCards) + section("At the kitchen door", "waiting to be carried in", crateCards) + section("Past deliveries", "newest first", pastCards)
          : `<p class="muted">Nothing on its way, and nothing delivered yet. Order at the desk: 🧺 Buy Supplies.</p>`,
        onPick: (v) => pick(Number(v.slice(2))),
        onKey: gridKeys(() => all.length, () => st.focus, (n) => { st.focus = n; replaceMenu(build()); }, pick),
      },
      items: [],
    };
  };
  openMenu(build());
}
