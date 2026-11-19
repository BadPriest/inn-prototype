// The desk in your room: the bill of fare, equipment to buy and arrange, and the way to the journal. Card screens (cards.ts).
import { CARRIED, EQUIP_GROUPS, EQUIPMENT, FUELS, MEALS, RECIPES, TUNING, bestInLine, pieceById } from "../data.js";
import { back, closeAll, openMenu, replaceMenu } from "./menu.js";
import { startArranging } from "./arrange.js";
import { grid, gridKeys } from "./cards.js";
import { openNewspaper } from "./newspaper.js";
import { openCalendar } from "./calendar.js";
import { openSupplies } from "./supplies.js";
import { ingredientsHtml } from "./cook.js";
import { knows, pointsLeft } from "../skills.js";
import { openSkills } from "./skills.js";
import { canFetch, fetchThing, FETCH_MINUTES, hasOrBetter, onOrderCount, orderThing, priceOfThing, SELL_BACK_SHARE_WORDS, toPlaceCount } from "../shop.js";
import { fmtMoney, moneyHtml, priceLevel, priceOfRecipe, PRICE_LEVELS } from "../money.js";
export function openDeskScreen(g, openJournal) {
    const st = { focus: 0 };
    g.bus.emit({ type: "MenuSound", sound: "desk" }); // you sit down at the desk
    const build = () => {
        const now = g.mealNow();
        const known = g.regulars ? [...g.regulars.values()].filter((r) => r.visits > 0).length : 0;
        // Two rows: today's running of the inn (bill, prices, paper, calendar), then the inn itself.
        // At rest each card is its name and one line: the state, or what's inside when it has no state.
        // Pointed at, it grows and says more (cards.ts).
        const cards = [
            { pick: "fare", icon: "📜", name: "Bill of fare", warn: !g.menuChosen,
                fact: !g.menuChosen ? "Not set" : `${g.mealMode ? g.billNow().size : g.menu.size} on the board`,
                tone: !g.menuChosen ? "warn" : undefined,
                detail: `What guests can order to consume. They only order what's on it.${!g.menuChosen ? " Until you set it, they use a default menu." : g.mealMode ? ` Meal times: ${now ? `${MEALS.find((m) => m.id === now.id).name.toLowerCase()} now` : "between meals now"}.` : ""}`,
                does: "Choose dishes and drinks" },
            { pick: "prices", icon: "🪙", name: "House prices",
                fact: priceLevel(g).name,
                detail: `Set the prices for your inn. Lower prices bring a few more guests, while being more expensive invites less. Ale is ${fmtMoney(priceOfRecipe(g, "ale"))} a pint.`,
                does: "Choose a price level" },
            { pick: "paper", icon: "📰", name: "Today's Newspaper",
                fact: g.paper ? (g.paper.read ? "Read" : "Unread") : "None yet",
                tone: g.paper && !g.paper.read ? "good" : undefined,
                detail: "The weather forecast and the news around town.",
                does: "Read today's paper" },
            { pick: "calendar", icon: "📅", name: "Calendar",
                fact: `${g.date.seasonName} ${g.date.dayOfSeason}`,
                detail: `${g.date.weekday}. This season's days: the weather so far, market days, and when the next season begins.`,
                does: "See the season" },
            { pick: "supplies", icon: "🧺", name: "Supplies",
                fact: g.deliveries.length ? `🛻 ${g.deliveries.length} coming` : Object.values(g.slips).some((x) => Object.values(x).some(Boolean)) ? "A slip pencilled" : undefined,
                status: g.deliveries.length ? undefined : "Order what the pantry needs.",
                tone: g.deliveries.length ? "good" : undefined,
                detail: "A slip for each supplier: pencil in what you need, then send it for the carter to bring, or fetch it yourself while the inn's shut.",
                does: "Open the slips" },
            { pick: "shop", icon: "🛒", name: "Equipment",
                fact: g.onOrder.length ? `${g.onOrder.length} on order` : undefined,
                status: g.onOrder.length ? undefined : "Kitchen equipment and upgrades to buy.",
                tone: g.onOrder.length ? "good" : undefined,
                detail: `Order for the carter, who comes next morning, or fetch it yourself while the inn's shut. In the purse: ${moneyHtml(g.purse)}.`,
                does: "Open the shop" },
            { pick: "arrange", icon: "🛠", name: "Arrange the kitchen", warn: g.toPlace.length > 0,
                fact: g.toPlace.length ? `📦 ${g.toPlace.length} to place` : undefined,
                status: g.toPlace.length ? undefined : "Move, place and sell back equipment.",
                tone: g.toPlace.length ? "warn" : undefined,
                detail: `Place what's been delivered, move what you have, or sell a piece back for ${SELL_BACK_SHARE_WORDS} its price. The clock stops while you do.`,
                does: "Leave the desk and start arranging" },
            { pick: "skills", icon: "📚", name: "Skills", warn: pointsLeft(g) > 0,
                fact: pointsLeft(g) ? `${pointsLeft(g)} point${pointsLeft(g) === 1 ? "" : "s"} to spend` : `${g.known.size} recipes known`,
                tone: pointsLeft(g) ? "good" : undefined,
                detail: "Recipes you know and recipes to learn. Every guest you serve teaches you something: enough of them earn a point to spend on a new recipe.",
                does: "Open the recipe book" },
            { pick: "journal", icon: "📖", name: "Journal",
                fact: g.journalUnread ? `${g.journalUnread} new` : undefined,
                status: g.journalUnread ? undefined : "Information about patrons you served.",
                tone: g.journalUnread ? "good" : undefined,
                detail: `Notes on the regulars and passing visitors you've served: what they said, what they liked.${known ? ` ${known} known so far.` : ""}`,
                does: "Read the journal" },
        ].map((c, i) => ({ ...c, focus: i === st.focus }));
        const go = (v) => {
            if (v === "fare")
                openBillOfFare(g);
            else if (v === "prices") {
                g.bus.emit({ type: "MenuSound", sound: "penClick" });
                openHousePrices(g, () => replaceMenu(build()));
            }
            else if (v === "paper")
                openNewspaper(g);
            else if (v === "calendar")
                openCalendar(g);
            else if (v === "shop") {
                g.bus.emit({ type: "MenuSound", sound: "penClick" });
                openShop(g);
            }
            else if (v === "supplies") {
                g.bus.emit({ type: "MenuSound", sound: "penClick" });
                openSupplies(g);
            }
            else if (v === "arrange") {
                closeAll();
                startArranging(g);
            }
            else if (v === "skills") {
                g.bus.emit({ type: "MenuSound", sound: "penClick" });
                openSkills(g, () => replaceMenu(build()));
            }
            else
                openJournal();
        };
        return {
            title: "🕯️ Desk",
            holdsClock: true,
            subtitle: "Run the inn: what's served, what it costs, the kitchen, the news",
            view: {
                html: (!g.menuChosen ? `<p class="desk-warn">⚠️ <b>The bill of fare isn't set.</b> Guests are ordering from a default one.</p>` : "")
                    + grid(cards, { cols: 4 }),
                onPick: go,
                onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => go(cards[i].pick)),
            },
            items: [],
        };
    };
    openMenu(build());
}
/** House prices: one house-wide level, Cheap, Fair or Dear. Three cards, side by side. */
function openHousePrices(g, changed) {
    const st = { focus: Math.max(0, PRICE_LEVELS.findIndex((l) => l.id === g.priceLevel)) };
    const ale = (factor) => fmtMoney(Math.max(1, Math.round(priceOfRecipe(g, "ale") / priceLevel(g).factor * factor)));
    const FLOW = { cheap: "A few more guests come in", fair: "The usual number of guests", dear: "A few fewer guests come in" };
    const build = () => {
        const cards = PRICE_LEVELS.map((l, i) => ({
            pick: l.id, icon: l.id === "cheap" ? "🪙" : l.id === "fair" ? "⚖️" : "💰", name: l.name,
            fact: `ale ${ale(l.factor)} a pint`,
            status: l.factor === 1 ? "what things are worth" : l.factor < 1 ? `${Math.round((1 - l.factor) * 100)}% off everything` : `${Math.round((l.factor - 1) * 100)}% on everything`,
            detail: FLOW[l.id] + ".",
            does: g.priceLevel === l.id ? "The price now" : `Set prices to ${l.name.toLowerCase()}`,
            on: g.priceLevel === l.id, focus: i === st.focus,
        }));
        const pick = (id) => {
            if (g.priceLevel !== id) {
                g.priceLevel = id;
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
const MENU = RECIPES.filter((r) => !r.internal && !r.tableSnack);
const DRINKS = MENU.filter((r) => r.kind === "drink");
const TABS = [...MEALS.map((m) => m.id), "between"];
const DAY_FROM = TUNING.dayStartHour, DAY_TO = TUNING.dayStartHour + TUNING.dayLengthMinutes / 60;
const hourLabel = (h) => `${h % 24}:00`;
/** What a dish needs that this kitchen hasn't got (buy it at the desk). */
const NEEDS = { stove: "needs a hob", griddle: "needs a hob", oven: "needs an oven", kettle: "needs a kettle", coffee: "needs a coffee pot", prep: "needs a prep table" };
/** Where a dish is made, in a few words, and in full (which pieces of equipment) for the hover. */
const WHERE = { stove: "🔥 a pot on a hob", griddle: "🍳 a pan on a hob", oven: "🍞 in an oven", kettle: "🫖 the kettle", coffee: "☕ the coffee pot", prep: "🔪 the prep table" };
const whereShort = (r) => (r.station === "tap" ? `🍺 the ${r.name.toLowerCase()} barrel` : WHERE[r.station] ?? "");
const whereFull = (r) => {
    const on = EQUIPMENT.filter((e) => (r.station === "tap" ? e.tap === r.id : e.slots.some((sl) => sl.kinds.includes(r.station)))).map((e) => e.name.toLowerCase());
    return on.length ? `Made at: ${on.join(", ")}` : "";
};
const needs = (r) => (r.station === "tap" ? `needs a barrel of ${r.name.toLowerCase()}` : NEEDS[r.station] ?? "needs equipment");
/** First time into meal times: every meal starts as a copy of the all-day bill; between meals, its drinks. */
function seedMeals(g) {
    if (g.meals.some((m) => m.menu.size) || g.betweenMenu.size)
        return;
    for (const m of g.meals)
        m.menu = new Set(g.menu);
    g.betweenMenu = new Set([...g.menu].filter((id) => DRINKS.some((r) => r.id === id)));
}
function dayStrip(g, tab) {
    const span = DAY_TO - DAY_FROM;
    const pct = (h) => ((h - DAY_FROM) / span) * 100;
    const segs = g.meals.map((m) => {
        const def = MEALS.find((x) => x.id === m.id);
        return `<div class="bf-seg ${tab === m.id ? "on" : ""}" data-pick="tab:${m.id}" style="left:${pct(m.from)}%;width:${pct(m.to) - pct(m.from)}%" title="${def.name} ${hourLabel(m.from)}–${hourLabel(m.to)}">${def.icon}</div>`;
    }).join("");
    const ticks = [6, 9, 12, 15, 18, 21, 24].map((h) => `<span class="bf-tick" style="left:${pct(h)}%">${hourLabel(h)}</span>`).join("");
    const now = Math.min(DAY_TO, g.clockHour);
    return `<div class="bf-strip">${segs}<div class="bf-now" style="left:${pct(now)}%" title="Now"></div>${ticks}</div>`;
}
export function openBillOfFare(g) {
    g.bus.emit({ type: "MenuSound", sound: "billOfFare" }); // picked up off the desk
    const st = { focus: 0, tab: g.mealNow()?.id ?? "breakfast" };
    const meal = () => g.meals.find((m) => m.id === st.tab);
    const bill = () => !g.mealMode ? g.menu : meal()?.menu ?? g.betweenMenu;
    const choices = () => g.mealMode && st.tab === "between" ? DRINKS : MENU;
    const build = () => {
        const list = choices();
        const set = bill();
        const redraw = () => replaceMenu(build());
        const toggle = (i) => {
            const r = list[i];
            if (!r)
                return;
            if (!set.has(r.id) && !knows(g, r.id)) {
                g.say(`You don't know how to make ${r.name.toLowerCase()} yet: learn it in Skills, at the desk.`);
                return;
            }
            if (!set.has(r.id) && !g.canMake(r.id)) {
                g.say(`You can't make ${r.name.toLowerCase()} here: ${needs(r)}.`);
                return;
            }
            if (set.has(r.id))
                set.delete(r.id);
            else
                set.add(r.id); // menuChosen waits for "Put it up"
            g.bus.emit({ type: "Paper", what: "menu" });
            st.focus = i;
            redraw();
        };
        const setTab = (t) => { if (t !== st.tab)
            g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); st.tab = t; st.focus = 0; redraw(); };
        const setMode = (meals) => {
            if (g.mealMode === meals)
                return;
            g.mealMode = meals;
            if (meals) {
                seedMeals(g);
                st.tab = g.mealNow()?.id ?? "breakfast";
            }
            g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
            st.focus = 0;
            redraw();
        };
        /** Move a meal's start or end by an hour, keeping meals apart and at least an hour long. */
        const nudge = (edge, by) => {
            const m = meal();
            if (!m)
                return;
            const i = g.meals.indexOf(m);
            const lo = i > 0 ? g.meals[i - 1].to : DAY_FROM;
            const hi = i < g.meals.length - 1 ? g.meals[i + 1].from : DAY_TO;
            if (edge === "from")
                m.from = Math.max(lo, Math.min(m.to - 1, m.from + by));
            else
                m.to = Math.min(hi, Math.max(m.from + 1, m.to + by));
            g.bus.emit({ type: "Paper", what: "menu" });
            redraw();
        };
        const putUp = () => {
            g.menuChosen = true;
            g.bus.emit({ type: "MenuSound", sound: "tick" }); // ticked off and put up
            if (!g.mealMode)
                g.say(`The bill of fare is up: ${MENU.filter((r) => g.menu.has(r.id)).map((r) => r.icon).join(" ") || "nothing yet"}.`);
            else {
                const now = g.mealNow();
                const name = now ? MEALS.find((m) => m.id === now.id).name.toLowerCase() : "between meals";
                g.say(`The bills of fare are up, one for each meal. Now (${name}): ${MENU.filter((r) => g.billNow().has(r.id)).map((r) => r.icon).join(" ") || "nothing"}.`);
            }
            back();
        };
        const cards = list.map((r, i) => {
            const can = g.canMake(r.id), on = set.has(r.id), known = knows(g, r.id);
            const unit = r.storedIn === "piesafe" ? "a slice" : r.servings ? "a serving" : r.station === "tap" ? "a pint" : "";
            const how = r.storedIn === "piesafe" ? "Baked whole, sold by the slice." : r.servings ? `Made by the pot: about ${r.servings[0]} servings, ~${r.minutes[0]} min.` : r.station === "tap" ? "Poured from the barrel." : `Made to order, ~${r.minutes[0]} min.`;
            return {
                pick: String(i), icon: r.icon, name: r.name,
                fact: can ? `${r.base.options.length > 1 || r.optional.pick[1] > 0 ? "from " : ""}${moneyHtml(priceOfRecipe(g, r.id))}${unit ? ` <span class="unit">${unit}</span>` : ""}` : "",
                status: !known ? "📚 learn it in Skills" : can ? whereShort(r) : needs(r), tone: can ? undefined : "warn",
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
                    if (k === "mode")
                        setMode(arg === "meals");
                    else if (k === "tab")
                        setTab(arg);
                    else if (k === "from" || k === "to")
                        nudge(k, Number(arg));
                    else
                        toggle(Number(v));
                },
                onKey: (e) => {
                    if (e.key === "Enter") {
                        putUp();
                        return true;
                    }
                    // Two levels of tabs. Outer, Tab (L1/R1): all-day bill or meal times. Inner, PageUp/PageDown
                    // (L2/R2): which meal. Every bill keeps what's on it when you switch.
                    if (e.key === "Tab") {
                        e.preventDefault();
                        setMode(!g.mealMode);
                        return true;
                    }
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
let shopTab = "cooking"; // the shop opens where you left it
export function openShop(g) {
    const st = { focus: 0 };
    const all = [
        ...EQUIPMENT.map((e) => ({ id: e.id, icon: e.icon, name: e.name, blurb: e.blurb, goods: false, group: e.group, fuel: e.fuel })),
        ...CARRIED.map((x) => ({ id: x.id, icon: x.icon, name: x.name, blurb: x.text?.shopCard ?? "", goods: true, group: x.shopTab, fuel: undefined })),
    ];
    const isBest = (id) => { const p = pieceById(id); return !!p?.line && bestInLine(g.upgrades, p.line)?.id === id; };
    const ownedOf = (it) => (it.goods ? (hasOrBetter(g, it.id) ? 1 : 0) : g.layout.filter((p) => p.type === it.id).length + toPlaceCount(g, it.id));
    const build = () => {
        // What you have comes first, so you can see your kitchen at a glance.
        const items = all.filter((it) => it.group === shopTab).sort((a, b) => Number(ownedOf(b) > 0) - Number(ownedOf(a) > 0));
        const buy = (i) => {
            const it = items[i];
            if (!it)
                return;
            st.focus = i;
            if (it.goods && (hasOrBetter(g, it.id) || onOrderCount(g, it.id)))
                return;
            const price = priceOfThing(it.id);
            if (g.purse < price) {
                g.say(`The ${it.name.toLowerCase()} costs ${fmtMoney(price)}; you have ${fmtMoney(g.purse)}.`);
                return;
            }
            // Ordered: the carter brings it tomorrow. Or fetch it yourself now, if there's nobody to look after.
            const away = `${Math.floor(FETCH_MINUTES / 60)}${FETCH_MINUTES % 60 ? "½" : ""} hours`;
            openMenu({
                title: `${it.icon} ${it.name}`,
                subtitle: `${fmtMoney(price)} · you have ${fmtMoney(g.purse)}`,
                holdsClock: true,
                items: [
                    { label: "🛻 Order it", sub: "the carter brings it tomorrow morning",
                        action: () => { if (orderThing(g, it.id)) {
                            g.bus.emit({ type: "MenuSound", sound: "coins" });
                            back();
                            replaceMenu(build());
                        } } },
                    { label: "🚶 Fetch it yourself, now", sub: canFetch(g) ? `you're out about ${away}${it.goods ? "" : "; place it when you're back"}` : "not while the inn is open or anyone's inside",
                        disabled: !canFetch(g),
                        action: () => {
                            if (!fetchThing(g, it.id))
                                return;
                            g.bus.emit({ type: "MenuSound", sound: "coins" });
                            if (it.goods) {
                                back();
                                replaceMenu(build());
                                return;
                            }
                            closeAll();
                            startArranging(g, it.id); // straight to placing it
                        } },
                    { label: "Not now", button: "secondary", cancel: true, action: () => back() },
                ],
            });
        };
        const switchTab = (by) => {
            const i = EQUIP_GROUPS.findIndex((t) => t.id === shopTab);
            shopTab = EQUIP_GROUPS[(i + by + EQUIP_GROUPS.length) % EQUIP_GROUPS.length].id;
            g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
            st.focus = 0;
            replaceMenu(build());
        };
        const cards = items.map((it, i) => {
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
                    if (v.startsWith("tab:")) {
                        if (v.slice(4) !== shopTab)
                            g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
                        shopTab = v.slice(4);
                        st.focus = 0;
                        replaceMenu(build());
                        return;
                    }
                    buy(Number(v));
                },
                onKey: (e) => {
                    if (e.key === "Tab") {
                        e.preventDefault();
                        switchTab(e.shiftKey ? -1 : 1);
                        return true;
                    }
                    return gridKeys(() => items.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, buy)(e);
                },
            },
            items: [],
        };
    };
    openMenu(build());
}
