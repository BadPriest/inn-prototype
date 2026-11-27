// Building work at the desk (inn#117): the upgrades to the inn itself, in order, each booked with the builders.

import { BUILDING_WORK, insulationName, nextWork, orderWork } from "../building.js";
import type { Game } from "../game.js";
import { fmtMoney, moneyHtml } from "../money.js";
import { back, openMenu, replaceMenu, type CardScreen } from "./menu.js";
import { grid, type CardSpec } from "./cards.js";

export function openBuildingWork(g: Game): void {
  const st = { focus: Math.max(0, BUILDING_WORK.findIndex((u) => u.id === nextWork(g)?.id)) };
  const build = (): CardScreen => {
    const next = nextWork(g);
    const cards: CardSpec[] = BUILDING_WORK.map((u, i) => {
      const done = g.buildingDone.includes(u.id);
      const booked = g.works?.id === u.id;
      const isNext = next?.id === u.id && !g.works;
      const short = u.price - g.purse;
      return {
        pick: u.id, icon: u.icon, name: u.name, focus: i === st.focus,
        fact: done ? "" : moneyHtml(u.price),
        status: done ? "Done" : booked ? (g.day >= g.works!.from ? "The builders are in" : "🔨 Booked for tomorrow") : !isNext ? "After the work before it" : short > 0 ? `short ${moneyHtml(short)}` : "",
        tone: done || booked ? "good" : isNext && short > 0 ? "warn" : undefined,
        body: `<div class="desc">🌡 ${insulationName(u.insulation)}</div><div class="desc">${u.daysClosed ? `🔒 shut ${u.daysClosed === 1 ? "a day" : `${u.daysClosed} days`}` : "Done overnight"}</div>`,
        detail: `${u.text} The building becomes ${insulationName(u.insulation)}.`,
        does: done ? "Done" : booked ? "Booked with the builders" : !isNext ? "Do the work before it first" : short > 0 ? `You need ${fmtMoney(short)} more` : "Book the builders",
        on: done, off: !isNext || short > 0,
      };
    });
    const book = (i: number) => {
      const u = BUILDING_WORK[i];
      if (!u) return;
      st.focus = i;
      if (g.buildingDone.includes(u.id) || g.works) return;
      if (next?.id !== u.id) { g.say(`First: ${next?.name.toLowerCase()}.`); return; }
      if (g.purse < u.price) { g.say(`The ${u.name.toLowerCase()} costs ${fmtMoney(u.price)}; you have ${fmtMoney(g.purse)}.`); return; }
      openMenu({
        title: `${u.icon} ${u.name}`,
        subtitle: `${fmtMoney(u.price)} · you have ${fmtMoney(g.purse)}`,
        holdsClock: true,
        items: [
          { label: "🔨 Book the builders", sub: u.daysClosed ? `they come tomorrow; the inn stays shut ${u.daysClosed === 1 ? "that day" : `${u.daysClosed} days`}` : "done overnight; the inn opens as usual",
            action: () => { if (orderWork(g, u.id)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); back(); replaceMenu(build()); } } },
          { label: "Not now", button: "secondary", cancel: true, action: () => back() },
        ],
      });
    };
    return {
      title: "🔨 Building Work",
      subtitle: `The building is ${insulationName(g.insulation)} · work on the inn itself, one job after another · pick one to book the builders`,
      summary: `<div class="desc">${moneyHtml(g.purse)} in the purse. A snugger building keeps the warmth of the fire and the heaters in, and the summer heat out. Open the windows to air the room.</div>`,
      holdsClock: true,
      cards: grid(cards),
      onPick: (v) => book(BUILDING_WORK.findIndex((u) => u.id === v)),
      nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: book },
    };
  };
  openMenu(build());
}
