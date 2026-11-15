// The desk in your room: the bill of fare, equipment to buy and arrange, and the way to the journal. Card screens (cards.ts).

import { EQUIPMENT, GOODS, MEALS, RECIPES, TUNING, type MealId } from "../data.js";
import type { Game } from "../game.js";
import { back, closeAll, confirmed, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { startArranging } from "./arrange.js";
import { grid, gridKeys, type CardSpec } from "./cards.js";
import { openNewspaper } from "./newspaper.js";
import { openCalendar } from "./calendar.js";

export function openDeskScreen(g: Game, openJournal: () => void): void {
  const st = { focus: 0 };
  const build = (): MenuSpec => {
    const cards: CardSpec[] = [
      { pick: "fare", icon: "📜", name: "Bill of fare", note: g.mealMode ? `meal times<br>${g.mealNow() ? `${MEALS.find((m) => m.id === g.mealNow()!.id)!.name} now` : "between meals now"}` : `what's on the menu<br>${g.menu.size} on today` },
      { pick: "calendar", icon: "📅", name: "Calendar", note: `${g.date.seasonName} ${g.date.dayOfSeason}<br>the season ahead` },
      { pick: "paper", icon: "📰", name: "Newspaper", note: g.paper?.read ? "read" : "today's, unread", on: !!g.paper && !g.paper.read },
      { pick: "shop", icon: "🛒", name: "Equipment", note: "stoves, ovens, kettles<br>to buy" },
      { pick: "arrange", icon: "🛠", name: "Arrange the kitchen", note: "move your stoves,<br>kettles and pots" },
      { pick: "journal", icon: "📖", name: "Journal", note: g.journalUnread ? `${g.journalUnread} new` : "the people you've met", on: g.journalUnread > 0 },
    ].map((c, i) => ({ ...c, focus: i === st.focus }));
    const go = (v: string) => {
      if (v === "fare") openBillOfFare(g);
      else if (v === "paper") openNewspaper(g);
      else if (v === "calendar") openCalendar(g);
      else if (v === "shop") openShop(g);
      else if (v === "arrange") { closeAll(); startArranging(g); }
      else openJournal();
    };
    return {
      title: "🕯️ Desk",
      holdsClock: true,
      subtitle: "In your room",
      view: {
        html: grid(cards),
        onPick: go,
        onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => go(cards[i].pick)),
      },
      items: [],
    };
  };
  openMenu(build());
}

// ---------------------------------------------------------------------------
// The bill of fare: cards to put on the board or take off it.
// Two modes: one all-day bill (the default), or meal times, where each meal has its own bill (a tab
// each) and between meals there are only drinks. Bills carry over from day to day.

/** What can go on the bill of fare (not the kettle's hot water). */
const MENU = RECIPES.filter((r) => !r.internal);
const DRINKS = MENU.filter((r) => r.kind === "drink");

type Tab = MealId | "between";
const TABS: Tab[] = [...MEALS.map((m) => m.id), "between"];
const DAY_FROM = TUNING.dayStartHour, DAY_TO = TUNING.dayStartHour + TUNING.dayLengthMinutes / 60;

const hourLabel = (h: number) => `${h % 24}:00`;

/** First time into meal times: every meal starts as a copy of the all-day bill; between meals, its drinks. */
function seedMeals(g: Game): void {
  if (g.meals.some((m) => m.menu.size) || g.betweenMenu.size) return;
  for (const m of g.meals) m.menu = new Set(g.menu);
  g.betweenMenu = new Set([...g.menu].filter((id) => DRINKS.some((r) => r.id === id)));
}

function dayStrip(g: Game, tab: Tab): string {
  const span = DAY_TO - DAY_FROM;
  const pct = (h: number) => ((h - DAY_FROM) / span) * 100;
  const segs = g.meals.map((m) => {
    const def = MEALS.find((x) => x.id === m.id)!;
    return `<div class="bf-seg ${tab === m.id ? "on" : ""}" data-pick="tab:${m.id}" style="left:${pct(m.from)}%;width:${pct(m.to) - pct(m.from)}%" title="${def.name} ${hourLabel(m.from)}–${hourLabel(m.to)}">${def.icon}</div>`;
  }).join("");
  const ticks = [6, 9, 12, 15, 18, 21, 24].map((h) => `<span class="bf-tick" style="left:${pct(h)}%">${hourLabel(h)}</span>`).join("");
  const now = Math.min(DAY_TO, g.clockHour);
  return `<div class="bf-strip">${segs}<div class="bf-now" style="left:${pct(now)}%" title="Now"></div>${ticks}</div>`;
}

export function openBillOfFare(g: Game): void {
  const st: { focus: number; tab: Tab } = { focus: 0, tab: g.mealNow()?.id ?? "breakfast" };
  const meal = () => g.meals.find((m) => m.id === st.tab);
  const bill = (): Set<string> => !g.mealMode ? g.menu : meal()?.menu ?? g.betweenMenu;
  const choices = () => g.mealMode && st.tab === "between" ? DRINKS : MENU;
  const build = (): MenuSpec => {
    const list = choices();
    const set = bill();
    const redraw = () => replaceMenu(build());
    const toggle = (i: number) => {
      const r = list[i];
      if (!r) return;
      if (set.has(r.id)) set.delete(r.id); else set.add(r.id);
      g.menuChosen = true;
      g.bus.emit({ type: "Paper", what: "menu" });
      st.focus = i;
      redraw();
    };
    const setTab = (t: Tab) => { st.tab = t; st.focus = 0; redraw(); };
    const setMode = (meals: boolean) => {
      if (g.mealMode === meals) return;
      g.mealMode = meals;
      if (meals) { seedMeals(g); st.tab = g.mealNow()?.id ?? "breakfast"; }
      g.bus.emit({ type: "Paper", what: "menu" });
      st.focus = 0;
      redraw();
    };
    /** Move a meal's start or end by an hour, keeping meals apart and at least an hour long. */
    const nudge = (edge: "from" | "to", by: number) => {
      const m = meal();
      if (!m) return;
      const i = g.meals.indexOf(m);
      const lo = i > 0 ? g.meals[i - 1].to : DAY_FROM;
      const hi = i < g.meals.length - 1 ? g.meals[i + 1].from : DAY_TO;
      if (edge === "from") m.from = Math.max(lo, Math.min(m.to - 1, m.from + by));
      else m.to = Math.min(hi, Math.max(m.from + 1, m.to + by));
      g.bus.emit({ type: "Paper", what: "menu" });
      redraw();
    };
    const putUp = () => {
      g.menuChosen = true;
      confirmed(); // the piano, not the paper tick: putting it up is the decision
      if (!g.mealMode) g.say(`The bill of fare is up: ${MENU.filter((r) => g.menu.has(r.id)).map((r) => r.icon).join(" ") || "nothing yet"}.`);
      else {
        const now = g.mealNow();
        const name = now ? MEALS.find((m) => m.id === now.id)!.name.toLowerCase() : "between meals";
        g.say(`The bills of fare are up, one for each meal. Now (${name}): ${MENU.filter((r) => g.billNow().has(r.id)).map((r) => r.icon).join(" ") || "nothing"}.`);
      }
      back();
    };
    const cards: CardSpec[] = list.map((r, i) => ({
      pick: String(i),
      icon: r.icon,
      name: r.name,
      note: `${set.has(r.id) ? "on the board · " : ""}${r.storedIn === "piesafe" ? "whole pies, sliced" : r.servings ? "by the pot" : r.station === "tap" ? "on tap" : `about ${r.minutes[0]} min`}`,
      tags: r.baseTags,
      on: set.has(r.id),
      focus: i === st.focus,
    }));

    const modes = `<div class="bf-modes">
      <button class="${g.mealMode ? "" : "on"}" data-pick="mode:all">All-day bill</button>
      <button class="${g.mealMode ? "on" : ""}" data-pick="mode:meals">Meal times</button>
    </div>`;
    let head: string;
    if (!g.mealMode) {
      head = `<p class="explain"><b>Pick what goes up on the board.</b> Guests only order what's on it, and they'll still order it after it runs out. Put up what you're ready to make; leave off what you'd rather not.</p>`;
    } else {
      const live = g.mealNow()?.id ?? "between";
      const tabs = `<div class="bf-tabs">${TABS.map((t) => {
        const m = g.meals.find((x) => x.id === t);
        const def = MEALS.find((x) => x.id === t);
        const label = def && m ? `${def.icon} ${def.name}<small>${hourLabel(m.from)}–${hourLabel(m.to)}</small>` : `🍺 Between meals<small>drinks only</small>`;
        return `<button class="${st.tab === t ? "on" : ""}${live === t ? " live" : ""}" data-pick="tab:${t}">${label}</button>`;
      }).join("")}</div>`;
      const m = meal();
      const times = m
        ? `<div class="bf-times">Served from <button data-pick="from:-1">−</button><b>${hourLabel(m.from)}</b><button data-pick="from:1">+</button>
           to <button data-pick="to:-1">−</button><b>${hourLabel(m.to)}</b><button data-pick="to:1">+</button></div>`
        : `<p class="explain">Between meals there's no food on the board: guests can have a drink (and the snacks on the tables). Someone who stays until a meal starts can order from it.</p>`;
      head = `${tabs}${dayStrip(g, st.tab)}${times}`;
    }
    return {
      title: "📜 Bill of fare",
      holdsClock: true,
      subtitle: g.mealMode ? "A bill for each meal; it carries over day to day." : "What's on the menu today?",
      view: {
        html: `${modes}${head}${grid(cards)}`,
        onPick: (v) => {
          const [k, arg] = v.split(":");
          if (k === "mode") setMode(arg === "meals");
          else if (k === "tab") setTab(arg as Tab);
          else if (k === "from" || k === "to") nudge(k, Number(arg));
          else toggle(Number(v));
        },
        onKey: (e) => {
          if (e.key === "Enter") { putUp(); return true; }
          if (e.key === "Tab" && g.mealMode) {
            e.preventDefault();
            const i = TABS.indexOf(st.tab);
            setTab(TABS[(i + (e.shiftKey ? -1 : 1) + TABS.length) % TABS.length]);
            return true;
          }
          return gridKeys(() => list.length, () => st.focus, (i) => { st.focus = i; redraw(); }, toggle)(e);
        },
      },
      items: [{ label: "Put it up", sub: `${set.size} on ${g.mealMode ? "this bill" : "the board"}`, button: "primary", action: putUp }],
    };
  };
  openMenu(build());
}

// ---------------------------------------------------------------------------
// Equipment: buy a piece and place it (money is no object, for now). Goods like wider trays just arrive.

export function openShop(g: Game): void {
  const st = { focus: 0 };
  const items = [
    ...EQUIPMENT.map((e) => ({ id: e.id, icon: e.icon, name: e.name, blurb: e.blurb, goods: false })),
    ...GOODS.map((x) => ({ id: x.id, icon: x.icon, name: x.name, blurb: x.blurb, goods: true })),
  ];
  const build = (): MenuSpec => {
    const buy = (i: number) => {
      const it = items[i];
      if (!it) return;
      if (it.goods) {
        if (g.upgrades.has(it.id)) return;
        g.upgrades.add(it.id);
        confirmed();
        g.say(`${it.icon} ${it.name}: delivered.`);
        st.focus = i;
        replaceMenu(build());
        return;
      }
      closeAll();
      startArranging(g, it.id); // straight to placing it
    };
    const cards: CardSpec[] = items.map((it, i) => {
      const owned = it.goods ? (g.upgrades.has(it.id) ? 1 : 0) : g.layout.filter((p) => p.type === it.id).length;
      return {
        pick: String(i), icon: it.icon, name: it.name, focus: i === st.focus, on: it.goods && owned > 0,
        note: `${it.goods ? (owned ? "yours" : "buy") : owned ? `you have ${owned} · buy another` : "buy and place"}<br><span class="muted">${it.blurb}</span>`,
      };
    });
    return {
      title: "🛒 Equipment",
      subtitle: "Money's no object, for now",
      holdsClock: true,
      view: {
        html: `<p class="explain"><b>Pick something to buy.</b> Stoves, ovens and kettles go straight to the kitchen for you to place; you can move them any time (desk → Arrange the kitchen).</p>${grid(cards)}`,
        onPick: (v) => buy(Number(v)),
        onKey: gridKeys(() => items.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, buy),
      },
      items: [],
    };
  };
  openMenu(build());
}
