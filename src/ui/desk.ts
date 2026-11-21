// The desk in your room: the bill of fare, equipment to buy and arrange, and the way to the journal. Card screens (cards.ts).

import { READY_MADE, servedReadyMade } from "../readymade.js";
import { CARRIED, EQUIP_GROUPS, EQUIPMENT, FUELS, MEALS, RECIPES, TUNING, bestInLine, pieceById, type EquipGroup, type MealId } from "../data.js";
import type { Game } from "../game.js";
import { back, closeAll, confirmed, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { startArranging } from "./arrange.js";
import { grid, gridKeys, type CardSpec } from "./cards.js";
import { openNewspaper } from "./newspaper.js";
import { openCalendar } from "./calendar.js";
import { openSupplies } from "./supplies.js";
import { openDeliveries } from "./deliveries.js";
import { whenText } from "../supplies.js";
import { SUPPLIERS_DATA } from "../gamedata.gen.js";
import { ingredientsHtml } from "./cook.js";
import { knows, levelOf, levelProgress, pointsLeft } from "../skills.js";
import { openSkills } from "./skills.js";
import { needs, whereFull, whereShort } from "./where.js";
import { canFetch, fetchThing, FETCH_MINUTES, hasOrBetter, onOrderCount, orderThing, priceOfThing, SELL_BACK_SHARE_WORDS, toPlaceCount } from "../shop.js";
import { fmtMoney, moneyHtml, priceLevel, priceOfRecipe, readyMadePrice, PRICE_LEVELS } from "../money.js";

export function openDeskScreen(g: Game, openJournal: () => void): void {
  const st = { focus: 0 };
  g.bus.emit({ type: "MenuSound", sound: "desk" }); // you sit down at the desk
  const build = (): MenuSpec => {
    const now = g.mealNow();
    const known = g.regulars ? [...g.regulars.values()].filter((r) => r.visits > 0).length : 0;
    // Each card: its name; what you need to know now (bold, then a second line); what it is, in plain
    // words; and at the foot, what picking it does.
    const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
    const onMenu = g.mealMode ? g.billNow().size : g.menu.size;
    const meal = g.mealMode ? (now ? MEALS.find((m) => m.id === now.id)!.name.toLowerCase() : "between meals") : "";
    const level = priceLevel(g);
    const openSlips = Object.values(g.slips).filter((sl) => Object.values(sl).some((k) => k > 0)).length;
    const standing = g.standing.filter((o) => !o.paused).length, pausedSo = g.standing.length - standing;
    const progress = levelProgress(g);
    const cards: CardSpec[] = [
      { pick: "fare", icon: "📜", name: "Bill of Fare", warn: !g.menuChosen,
        fact: !g.menuChosen ? "Not set yet" : `${n(onMenu, "dish and drink", "dishes and drinks")} on the menu`,
        status: !g.menuChosen ? "Guests can only order ale and cider" : g.mealMode ? `Meal times · ${meal} now` : "All day",
        tone: !g.menuChosen ? "warn" : undefined,
        body: `<div class="desc">Your menu: guests only order what's on it.</div>`,
        cta: "Choose dishes and drinks" },
      { pick: "prices", icon: "🪙", name: "House Prices",
        fact: `Set to: ${level.name}`,
        status: `${level.blurb[0].toUpperCase()}${level.blurb.slice(1)} · ale ${fmtMoney(priceOfRecipe(g, "ale"))} a pint`,
        body: `<div class="desc">Cheaper brings a few more guests; dearer, fewer.</div>`,
        cta: "Choose a price level" },
      { pick: "paper", icon: "📰", name: "Today's Newspaper",
        fact: !g.paper ? "None yet" : g.paper.read ? "Read" : "Unread",
        tone: g.paper && !g.paper.read ? "good" : undefined,
        body: `<div class="desc">Tomorrow's weather and the news around town: market days, who's about.</div>`,
        cta: "Read the paper" },
      { pick: "calendar", icon: "📅", name: "Calendar",
        fact: `${g.date.weekday}, ${g.date.seasonName} ${g.date.dayOfSeason}`,
        status: g.loc.marketDay ? `Market day: ${g.loc.marketDay}s` : undefined,
        body: `<div class="desc">The season at a glance: past weather, market days, deliveries.</div>`,
        cta: "Look ahead" },
      { pick: "supplies", icon: "🧺", name: "Buy Supplies",
        fact: openSlips ? `${n(openSlips, "open order")}` : "No open orders",
        status: openSlips ? "Pencilled in, not sent yet" : undefined,
        tone: openSlips ? "warn" : undefined,
        body: `<div class="desc">Order ingredients and fuel from the town's suppliers. The carter brings them in the morning.</div>`,
        cta: "Buy goods" },
      { pick: "deliveries", icon: "🛻", name: "Deliveries", warn: g.crates.length > 0,
        fact: g.crates.length ? `📦 ${n(g.crates.length, "crate")} at the kitchen door` : g.deliveries.length ? `${n(g.deliveries.length, "delivery", "deliveries")} incoming` : "Nothing incoming",
        status: [g.crates.length && g.deliveries.length ? `${n(g.deliveries.length, "delivery", "deliveries")} incoming` : g.deliveries.length ? `Next: ${whenText(g, Math.min(...g.deliveries.map((d) => d.day))).replace(" morning", "")}` : "",
          g.standing.length ? `📌 ${n(standing, "standing order")}${pausedSo ? ` (${pausedSo} paused)` : ""}` : ""].filter(Boolean).join(" · ") || undefined,
        tone: g.crates.length ? "warn" : g.deliveries.length ? "good" : undefined,
        body: `<div class="desc">What's coming, what's waiting to be carried in, and what came. Cancel an order until the evening before.</div>`,
        cta: "Check deliveries" },
      { pick: "shop", icon: "🛒", name: "Equipment",
        fact: g.onOrder.length ? `${n(g.onOrder.length, "piece")} on order` : `${moneyHtml(g.purse)} in the purse`,
        tone: g.onOrder.length ? "good" : undefined,
        body: `<div class="desc">Stoves, kettles, a pie safe and more, for a kitchen that can make more.</div>`,
        cta: "Browse equipment" },
      { pick: "arrange", icon: "🛠", name: "Arrange the Kitchen", warn: g.toPlace.length > 0,
        fact: g.toPlace.length ? `📦 ${n(g.toPlace.length, "piece")} to place` : "Everything in place",
        tone: g.toPlace.length ? "warn" : undefined,
        body: `<div class="desc">Move your equipment, place what came, or sell a piece back for ${SELL_BACK_SHARE_WORDS} its price. The clock stops.</div>`,
        cta: "Arrange the kitchen" },
      { pick: "skills", icon: "📚", name: "Skills", warn: pointsLeft(g) > 0,
        fact: pointsLeft(g) ? `✦ ${n(pointsLeft(g), "point")} to spend` : `Level ${levelOf(g)} · ${n(g.known.size, "recipe")} known`,
        status: `Next point: ${Math.floor((progress.have / Math.max(1, progress.need)) * 100)}% there`,
        tone: pointsLeft(g) ? "good" : undefined,
        body: `<div class="desc">Serving guests earns points. Spend them on new recipes and knacks.</div>`,
        cta: pointsLeft(g) ? "Spend your points" : "Open the recipe book" },
      { pick: "journal", icon: "📖", name: "Journal",
        fact: g.journalUnread ? `${n(g.journalUnread, "new note")}` : known ? `${n(known, "regular")} met` : "No notes yet",
        tone: g.journalUnread ? "good" : undefined,
        body: `<div class="desc">What your guests said and liked. Regulars reward getting to know them.</div>`,
        cta: "Read the journal" },
    ].map((c, i) => ({ ...c, focus: i === st.focus })) as CardSpec[];
    const go = (v: string) => {
      if (v === "fare") openBillOfFare(g);
      else if (v === "prices") { g.bus.emit({ type: "MenuSound", sound: "penClick" }); openHousePrices(g, () => replaceMenu(build())); }
      else if (v === "paper") openNewspaper(g);
      else if (v === "calendar") openCalendar(g);
      else if (v === "shop") { g.bus.emit({ type: "MenuSound", sound: "penClick" }); openShop(g); }
      else if (v === "supplies") { g.bus.emit({ type: "MenuSound", sound: "penClick" }); openSupplies(g); }
      else if (v === "deliveries") { g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); openDeliveries(g); }
      else if (v === "arrange") { closeAll(); startArranging(g); }
      else if (v === "skills") { g.bus.emit({ type: "MenuSound", sound: "penClick" }); openSkills(g, () => replaceMenu(build())); }
      else openJournal();
    };
    return {
      title: "🕯️ Desk",
      holdsClock: true,
      subtitle: "Run the inn from here: the menu, prices, supplies, the kitchen and the news",
      view: {
        html: (!g.menuChosen ? `<p class="desk-warn">⚠️ <b>Your menu isn't set.</b> Until you choose it in the Bill of Fare, guests can only order ale and cider.</p>` : "")
          + grid(cards, { cols: 5, size: "l" }),
        onPick: go,
        onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => go(cards[i].pick)),
      },
      items: [],
    };
  };
  openMenu(build());
}

/** House prices: one house-wide level, Cheap, Fair or Dear. Three cards, side by side. */
function openHousePrices(g: Game, changed: () => void): void {
  const st = { focus: Math.max(0, PRICE_LEVELS.findIndex((l) => l.id === g.priceLevel)) };
  const ale = (factor: number) => fmtMoney(Math.max(1, Math.round(priceOfRecipe(g, "ale") / priceLevel(g).factor * factor)));
  const FLOW = { cheap: "A few more guests come in", fair: "The usual number of guests", dear: "Fewer guests come in" } as const;
  const build = (): MenuSpec => {
    const cards: CardSpec[] = PRICE_LEVELS.map((l, i) => ({
      pick: l.id, icon: l.id === "cheap" ? "🪙" : l.id === "fair" ? "⚖️" : "💰", name: l.name,
      fact: `ale ${ale(l.factor)} a pint`,
      status: l.factor === 1 ? "what things are worth" : l.factor < 1 ? `${Math.round((1 - l.factor) * 100)}% off everything` : `${Math.round((l.factor - 1) * 100)}% on everything`,
      detail: FLOW[l.id as keyof typeof FLOW] + ".",
      does: g.priceLevel === l.id ? "The price now" : `Set prices to ${l.name.toLowerCase()}`,
      on: g.priceLevel === l.id, focus: i === st.focus,
    }));
    const pick = (id: string) => {
      if (g.priceLevel !== id) {
        g.priceLevel = id as typeof g.priceLevel;
        g.bus.emit({ type: "MenuSound", sound: "prices" });
        g.say(`House prices: ${priceLevel(g).name.toLowerCase()}. A pint of ale is ${fmtMoney(priceOfRecipe(g, "ale"))}.`);
      }
      back();
      changed();
    };
    return {
      title: "🪙 House prices",
      holdsClock: true,
      subtitle: "One level for everything on the bill of fare",
      view: {
        html: grid(cards, { cols: 3, size: "l", open: true }),
        onPick: pick,
        onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => pick(cards[i].pick)),
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
/** Whose order comes next: "Your order from Hollin's Farm". */
function expected(g: Game): string {
  const day = Math.min(...g.deliveries.map((d) => d.day));
  const next = g.deliveries.filter((d) => d.day === day);
  const from = [...new Set(next.map((d) => SUPPLIERS_DATA.suppliers.find((s) => s.id === d.supplierId)?.name ?? d.supplierId))];
  return `${next.every((d) => d.standing) ? "📌 Your standing order" : "Your order"} from ${from.join(" and ")}`;
}

const MENU = RECIPES.filter((r) => !r.internal && !r.tableSnack);
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
  g.bus.emit({ type: "MenuSound", sound: "billOfFare" }); // picked up off the desk
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
      if (!set.has(r.id) && !knows(g, r.id) && !servedReadyMade(g, r.id)) { g.say(`You don't know how to make ${r.name.toLowerCase()} yet: learn it in Skills, at the desk.`); return; }
      if (!set.has(r.id) && !g.canMake(r.id)) { g.say(`You can't make ${r.name.toLowerCase()} here: ${needs(r)}.`); return; }
      if (set.has(r.id)) set.delete(r.id); else set.add(r.id); // menuChosen waits for "Put it up"
      g.bus.emit({ type: "Paper", what: "menu" });
      st.focus = i;
      redraw();
    };
    const setTab = (t: Tab) => { if (t !== st.tab) g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); st.tab = t; st.focus = 0; redraw(); };
    const setMode = (meals: boolean) => {
      if (g.mealMode === meals) return;
      g.mealMode = meals;
      if (meals) { seedMeals(g); st.tab = g.mealNow()?.id ?? "breakfast"; }
      g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
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
      g.bus.emit({ type: "MenuSound", sound: "tick" }); // ticked off and put up
      if (!g.mealMode) g.say(`The bill of fare is up: ${MENU.filter((r) => g.menu.has(r.id)).map((r) => r.icon).join(" ") || "nothing yet"}.`);
      else {
        const now = g.mealNow();
        const name = now ? MEALS.find((m) => m.id === now.id)!.name.toLowerCase() : "between meals";
        g.say(`The bills of fare are up, one for each meal. Now (${name}): ${MENU.filter((r) => g.billNow().has(r.id)).map((r) => r.icon).join(" ") || "nothing"}.`);
      }
      back();
    };
    const cards: CardSpec[] = list.map((r, i) => {
      const bought = servedReadyMade(g, r.id);
      const can = g.canMake(r.id), on = set.has(r.id), known = knows(g, r.id) || bought;
      const unit = r.storedIn === "piesafe" ? "a slice" : r.servings ? "a serving" : r.station === "tap" ? "a pint" : "";
      const how = r.storedIn === "piesafe" ? "Baked whole, sold by the slice." : r.servings ? `Made by the pot: about ${r.servings[0]} servings, ~${r.minutes[0]} min.` : r.station === "tap" ? "Poured from the barrel." : `Made to order, ~${r.minutes[0]} min.`;
      return {
        pick: String(i), icon: r.icon, name: r.name,
        fact: can && bought && !knows(g, r.id) ? `${moneyHtml(Math.round(readyMadePrice(g, Object.keys(READY_MADE).find((k) => READY_MADE[k].dish === r.id)!)))}${unit ? ` <span class="unit">${unit}</span>` : ""}` : can ? `${r.base.options.length > 1 || r.optional.pick[1] > 0 ? "from " : ""}${moneyHtml(priceOfRecipe(g, r.id))}${unit ? ` <span class="unit">${unit}</span>` : ""}` : "",
        status: !known ? "📚 learn it in Skills" : bought && !knows(g, r.id) ? "🧺 the baker's" : can ? whereShort(r) : needs(r), tone: can ? undefined : "warn",
        tags: r.baseTags, on, off: !can, focus: i === st.focus,
        detail: `${how} ${whereFull(r)}.${ingredientsHtml(g, r)}`,
        does: !known ? "Learn the recipe in Skills, at the desk" : !can ? "Buy what it needs in Equipment" : on ? "Take it off the board" : "Put it on the board",
      };
    });

    const modes = `<div class="bf-modes">
      <button class="${g.mealMode ? "" : "on"}" data-pick="mode:all">All day</button>
      <button class="${g.mealMode ? "on" : ""}" data-pick="mode:meals">Meal times</button>
    </div>`;
    let head = "";
    if (g.mealMode) {
      const live = g.mealNow()?.id ?? "between";
      const tabs = `<div class="bf-tabs">${TABS.map((t) => {
        const m = g.meals.find((x) => x.id === t);
        const def = MEALS.find((x) => x.id === t);
        const label = def && m ? `${def.icon} ${def.name}<small>${hourLabel(m.from)}–${hourLabel(m.to)}</small>` : `🍺 Between<small>drinks only</small>`;
        return `<button class="${st.tab === t ? "on" : ""}${live === t ? " live" : ""}" data-pick="tab:${t}">${label}</button>`;
      }).join("")}</div>`;
      const m = meal();
      const times = m
        ? `<div class="bf-times">Served <button data-pick="from:-1">−</button><b>${hourLabel(m.from)}</b><button data-pick="from:1">+</button>
           to <button data-pick="to:-1">−</button><b>${hourLabel(m.to)}</b><button data-pick="to:1">+</button></div>`
        : `<div class="bf-times muted">Drinks and the snacks on the tables only. Guests who stay can order when a meal starts.</div>`;
      head = `${tabs}${dayStrip(g, st.tab)}${times}`;
    }
    return {
      title: "📜 Bill of fare",
      holdsClock: true,
      subtitle: g.mealMode ? "A bill for each meal. Guests order only what's on it." : "Guests order only what's on the board, all day.",
      view: {
        pinned: `${modes}${head}`,
        html: grid(cards, { cols: 7, size: "s" }),
        onPick: (v) => {
          const [k, arg] = v.split(":");
          if (k === "mode") setMode(arg === "meals");
          else if (k === "tab") setTab(arg as Tab);
          else if (k === "from" || k === "to") nudge(k, Number(arg));
          else toggle(Number(v));
        },
        onKey: (e) => {
          if (e.key === "Enter") { putUp(); return true; }
          // Two levels of tabs. Outer, Tab (L1/R1): all-day bill or meal times. Inner, PageUp/PageDown
          // (L2/R2): which meal. Every bill keeps what's on it when you switch.
          if (e.key === "Tab") { e.preventDefault(); setMode(!g.mealMode); return true; }
          if ((e.key === "PageDown" || e.key === "PageUp") && g.mealMode) {
            e.preventDefault();
            const i = TABS.indexOf(st.tab);
            setTab(TABS[(i + (e.key === "PageUp" ? -1 : 1) + TABS.length) % TABS.length]);
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
// Equipment: buy a piece and place it. Utensils and trays are kept, not placed: one of each, and a better one replaces a worse.

let shopTab: EquipGroup = "cooking"; // the shop opens where you left it

export function openShop(g: Game): void {
  const st = { focus: 0 };
  const all = [
    ...EQUIPMENT.map((e) => ({ id: e.id, icon: e.icon, name: e.name, blurb: e.blurb, goods: false, group: e.group, fuel: e.fuel })),
    ...CARRIED.map((x) => ({ id: x.id, icon: x.icon, name: x.name, blurb: x.text?.shopCard ?? "", goods: true, group: x.shopTab as EquipGroup, fuel: undefined })),
  ];
  const isBest = (id: string) => { const p = pieceById(id); return !!p?.line && bestInLine(g.upgrades, p.line)?.id === id; };
  const ownedOf = (it: (typeof all)[0]) => (it.goods ? (hasOrBetter(g, it.id) ? 1 : 0) : g.layout.filter((p) => p.type === it.id).length + toPlaceCount(g, it.id));
  const build = (): MenuSpec => {
    // What you have comes first, so you can see your kitchen at a glance.
    const items = all.filter((it) => it.group === shopTab).sort((a, b) => Number(ownedOf(b) > 0) - Number(ownedOf(a) > 0));
    const buy = (i: number) => {
      const it = items[i];
      if (!it) return;
      st.focus = i;
      if (it.goods && (hasOrBetter(g, it.id) || onOrderCount(g, it.id))) return;
      const price = priceOfThing(it.id);
      if (g.purse < price) { g.say(`The ${it.name.toLowerCase()} costs ${fmtMoney(price)}; you have ${fmtMoney(g.purse)}.`); return; }
      // Ordered: the carter brings it tomorrow. Or fetch it yourself now, if there's nobody to look after.
      const away = `${Math.floor(FETCH_MINUTES / 60)}${FETCH_MINUTES % 60 ? "½" : ""} hours`;
      openMenu({
        title: `${it.icon} ${it.name}`,
        subtitle: `${fmtMoney(price)} · you have ${fmtMoney(g.purse)}`,
        holdsClock: true,
        items: [
          { label: "🛻 Order it", sub: "the carter brings it tomorrow morning",
            action: () => { if (orderThing(g, it.id)) { g.bus.emit({ type: "MenuSound", sound: "coins" }); back(); replaceMenu(build()); } } },
          { label: "🚶 Fetch it yourself, now", sub: canFetch(g) ? `you're out about ${away}${it.goods ? "" : "; place it when you're back"}` : "not while the inn is open or anyone's inside",
            disabled: !canFetch(g),
            action: () => {
              if (!fetchThing(g, it.id)) return;
              g.bus.emit({ type: "MenuSound", sound: "coins" });
              if (it.goods) { back(); replaceMenu(build()); return; }
              closeAll();
              startArranging(g, it.id); // straight to placing it
            } },
          { label: "Not now", button: "secondary", cancel: true, action: () => back() },
        ],
      });
    };
    const switchTab = (by: number) => {
      const i = EQUIP_GROUPS.findIndex((t) => t.id === shopTab);
      shopTab = EQUIP_GROUPS[(i + by + EQUIP_GROUPS.length) % EQUIP_GROUPS.length].id;
      g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
      st.focus = 0;
      replaceMenu(build());
    };
    const cards: CardSpec[] = items.map((it, i) => {
      const owned = ownedOf(it);
      const fuel = it.fuel ? FUELS[it.fuel] : null;
      const price = priceOfThing(it.id);
      const coming = onOrderCount(g, it.id);
      const short = price - g.purse;
      const done = it.goods && (owned > 0 || coming > 0); // an upgrade is bought once
      const status = done ? (owned ? (isBest(it.id) ? "Yours" : "You have better") : "🛻 coming tomorrow")
        : coming ? `🛻 ${coming} coming tomorrow` : short > 0 ? `short ${moneyHtml(short)}` : owned ? "buy another" : "";
      return {
        pick: String(i), icon: it.icon, name: it.name, focus: i === st.focus,
        fact: done ? "" : moneyHtml(price),
        status, tone: done || coming ? "good" : short > 0 ? "warn" : undefined,
        have: it.goods ? 0 : owned, on: done, off: !done && short > 0,
        tags: fuel ? [`${fuel.icon} ${fuel.name}`] : undefined,
        detail: it.blurb,
        does: done ? (owned ? (isBest(it.id) ? "You have this" : "You have a better one") : "It's on the carter's cart") : short > 0 ? `You need ${fmtMoney(short)} more` : owned ? "Buy another: order it or fetch it" : "Buy it: order it or fetch it",
      };
    });
    const tabs = `<div class="bf-tabs">${EQUIP_GROUPS.map((t) => {
      const n = all.filter((it) => it.group === t.id).reduce((a, it) => a + (it.goods ? 0 : ownedOf(it)), 0);
      return `<button class="${shopTab === t.id ? "on" : ""}" data-pick="tab:${t.id}">${t.icon} ${t.name}${n ? ` <small>${n}</small>` : ""}</button>`;
    }).join("")}</div>`;
    return {
      title: "🛒 Equipment",
      subtitle: `${moneyHtml(g.purse)} in the purse · the carter brings orders next morning`,
      holdsClock: true,
      view: {
        pinned: tabs,
        html: grid(cards),
        onPick: (v) => {
          if (v.startsWith("tab:")) { if (v.slice(4) !== shopTab) g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); shopTab = v.slice(4) as typeof shopTab; st.focus = 0; replaceMenu(build()); return; }
          buy(Number(v));
        },
        onKey: (e) => {
          if (e.key === "Tab") { e.preventDefault(); switchTab(e.shiftKey ? -1 : 1); return true; }
          return gridKeys(() => items.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, buy)(e);
        },
      },
      items: [],
    };
  };
  openMenu(build());
}
