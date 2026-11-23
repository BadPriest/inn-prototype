// The desk in your room: the bill of fare, equipment to buy and arrange, and the way to the journal. Card screens (cards.ts).
import { buyUsed, restockTinker } from "../used.js";
import { seasonLevel, traitById } from "../seasoning.js";
import { mostHealth } from "../breakdowns.js";
import { EQUIPMENT_DATA } from "../gamedata.gen.js";
import { READY_MADE, servedReadyMade } from "../readymade.js";
import { CARRIED, EQUIP_GROUPS, EQUIPMENT, FUELS, MEALS, RECIPES, TUNING, bestInLine, pieceById } from "../data.js";
import { back, closeAll, openMenu, replaceMenu } from "./menu.js";
import { startArranging } from "./arrange.js";
import { grid } from "./cards.js";
import { openNewspaper } from "./newspaper.js";
import { openCalendar } from "./calendar.js";
import { openSupplies } from "./supplies.js";
import { openDeliveries } from "./deliveries.js";
import { whenText } from "../supplies.js";
import { SUPPLIERS_DATA } from "../gamedata.gen.js";
import { ingredientsHtml } from "./cook.js";
import { knows, levelOf, levelProgress, pointsLeft } from "../skills.js";
import { openSkills, ROMAN } from "./skills.js";
import { needs, whereFull, whereShort } from "./where.js";
import { canFetch, fetchThing, FETCH_MINUTES, hasOrBetter, hearthPiece, onOrderCount, orderThing, priceOfThing, SELL_BACK_SHARE_WORDS, toPlaceCount } from "../shop.js";
import { fmtMoney, moneyHtml, priceLevel, priceOfRecipe, readyMadePrice, PRICE_LEVELS } from "../money.js";
export function openDeskScreen(g, openJournal) {
    const st = { focus: 0 };
    g.bus.emit({ type: "MenuSound", sound: "desk" }); // you sit down at the desk
    const build = () => {
        const now = g.mealNow();
        const known = g.regulars ? [...g.regulars.values()].filter((r) => r.visits > 0).length : 0;
        // Each card: its name; what you need to know now (bold, then a second line); what it is, in plain
        // words; and at the foot, what picking it does.
        const n = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
        const onMenu = g.mealMode ? g.billNow().size : g.menu.size;
        const meal = g.mealMode ? (now ? MEALS.find((m) => m.id === now.id).name.toLowerCase() : "between meals") : "";
        const level = priceLevel(g);
        const openSlips = Object.values(g.slips).filter((sl) => Object.values(sl).some((k) => k > 0)).length;
        const standing = g.standing.filter((o) => !o.paused).length, pausedSo = g.standing.length - standing;
        const progress = levelProgress(g);
        const cards = [
            { pick: "fare", icon: "📜", name: "Bill of Fare", warn: !g.menuChosen,
                fact: !g.menuChosen ? "Not set yet" : `${n(onMenu, "dish and drink", "dishes and drinks")} on the menu`,
                status: !g.menuChosen ? "Only ale and cider for now" : g.mealMode ? `Meal times · ${meal} now` : "All day",
                tone: !g.menuChosen ? "warn" : undefined,
                body: `<div class="desc">Your menu: guests only order what's on it.</div>`, detail: `Your menu: guests only order what's on it.`,
                cta: "Set the menu" },
            { pick: "prices", icon: "🪙", name: "House Prices",
                fact: `Set to: ${level.name}`,
                status: `Ale ${fmtMoney(priceOfRecipe(g, "ale"))} a pint`,
                body: `<div class="desc">Cheaper brings a few more guests; dearer, fewer.</div>`, detail: `Cheaper brings a few more guests; dearer, fewer.`,
                cta: "Set prices" },
            { pick: "paper", icon: "📰", name: "Today's Newspaper",
                fact: !g.paper ? "None yet" : g.paper.read ? "Read" : "Unread",
                tone: g.paper && !g.paper.read ? "good" : undefined,
                body: `<div class="desc">Tomorrow's weather and the town's news.</div>`, detail: `Tomorrow's weather and the news around town: market days, who's about.`,
                cta: "Read the paper" },
            { pick: "calendar", icon: "📅", name: "Calendar",
                fact: `${g.date.weekday}, ${g.date.seasonName} ${g.date.dayOfSeason}`,
                status: g.loc.marketDay ? `Market day: ${g.loc.marketDay}s` : undefined,
                body: `<div class="desc">The season at a glance.</div>`, detail: `The season at a glance: past weather, market days, deliveries.`,
                cta: "Look ahead" },
            { pick: "supplies", icon: "🧺", name: "Buy Supplies",
                fact: openSlips ? `${n(openSlips, "open order")}` : "No open orders",
                status: openSlips ? "Pencilled in, not sent yet" : undefined,
                tone: openSlips ? "warn" : undefined,
                body: `<div class="desc">Order food and fuel from town.</div>`, detail: `Order ingredients and fuel from the town's suppliers. The carter brings them in the morning.`,
                cta: "Buy goods" },
            { pick: "deliveries", icon: "🛻", name: "Deliveries", warn: g.crates.length > 0,
                fact: g.crates.length ? `📦 ${n(g.crates.length, "crate")} at the kitchen door` : g.deliveries.length ? `${n(g.deliveries.length, "delivery", "deliveries")} incoming` : "Nothing incoming",
                status: [g.crates.length && g.deliveries.length ? `${n(g.deliveries.length, "delivery", "deliveries")} incoming` : g.deliveries.length ? `Next: ${whenText(g, Math.min(...g.deliveries.map((d) => d.day))).replace(" morning", "")}` : "",
                    g.standing.length ? `📌 ${n(standing, "standing order")}${pausedSo ? ` (${pausedSo} paused)` : ""}` : ""].filter(Boolean).join(" · ") || undefined,
                tone: g.crates.length ? "warn" : g.deliveries.length ? "good" : undefined,
                body: `<div class="desc">What's coming, and what came.</div>`, detail: `What's coming, what's waiting to be carried in, and what came. Cancel an order until the evening before.`,
                cta: "Check them" },
            { pick: "shop", icon: "🛒", name: "Equipment",
                fact: g.onOrder.length ? `${n(g.onOrder.length, "piece")} on order` : `${moneyHtml(g.purse)} in the purse`,
                tone: g.onOrder.length ? "good" : undefined,
                body: `<div class="desc">Stoves, kettles and more.</div>`, detail: `Stoves, kettles, a pie safe and more, for a kitchen that can make more.`,
                cta: "Browse" },
            { pick: "arrange", icon: "🛠", name: "Arrange the Kitchen", warn: g.toPlace.length > 0,
                fact: g.toPlace.length ? `📦 ${n(g.toPlace.length, "piece")} to place` : "Everything in place",
                tone: g.toPlace.length ? "warn" : undefined,
                body: `<div class="desc">Move, place or sell back.</div>`, detail: `Move your equipment, place what came, or sell a piece back for ${SELL_BACK_SHARE_WORDS} its price. The clock stops.`,
                cta: "Arrange" },
            { pick: "skills", icon: "📚", name: "Skills", warn: pointsLeft(g) > 0,
                fact: pointsLeft(g) ? `✦ ${n(pointsLeft(g), "point")} to spend` : `Level ${levelOf(g)} · ${n(g.known.size, "recipe")}`,
                status: `Next point: ${Math.floor((progress.have / Math.max(1, progress.need)) * 100)}% there`,
                tone: pointsLeft(g) ? "good" : undefined,
                body: `<div class="desc">Points for recipes and knacks.</div>`, detail: `Serving guests earns points. Spend them on new recipes and knacks.`,
                cta: pointsLeft(g) ? "Spend points" : "Recipe book" },
            { pick: "journal", icon: "📖", name: "Journal",
                fact: g.journalUnread ? `${n(g.journalUnread, "new note")}` : known ? `${n(known, "regular")} met` : "No notes yet",
                tone: g.journalUnread ? "good" : undefined,
                body: `<div class="desc">What your guests said and liked.</div>`, detail: `What your guests said and liked. Regulars reward getting to know them.`,
                cta: "Read the journal" },
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
            else if (v === "deliveries") {
                g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
                openDeliveries(g);
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
            subtitle: "Run the inn from here: the menu, prices, supplies, the kitchen and the news · pick a card",
            cards: (!g.menuChosen ? `<p class="desk-warn">⚠️ <b>Your menu isn't set.</b> Until you choose it in the Bill of Fare, guests can only order ale and cider.</p>` : "")
                + grid(cards, { cols: 5, size: "l" }),
            onPick: go,
            nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: (i) => go(cards[i].pick) },
        };
    };
    openMenu(build());
}
/** House prices: one house-wide level, Cheap, Fair or Dear. Three cards, side by side. */
function openHousePrices(g, changed) {
    const st = { focus: Math.max(0, PRICE_LEVELS.findIndex((l) => l.id === g.priceLevel)) };
    const ale = (factor) => fmtMoney(Math.max(1, Math.round(priceOfRecipe(g, "ale") / priceLevel(g).factor * factor)));
    const FLOW = { cheap: "A few more guests come in", fair: "The usual number of guests", dear: "Fewer guests come in" };
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
            subtitle: "One level for everything on the bill of fare · pick one",
            cards: grid(cards, { cols: 3, size: "l", open: true }),
            onPick: pick,
            nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: (i) => pick(cards[i].pick) },
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
function expected(g) {
    const day = Math.min(...g.deliveries.map((d) => d.day));
    const next = g.deliveries.filter((d) => d.day === day);
    const from = [...new Set(next.map((d) => SUPPLIERS_DATA.suppliers.find((s) => s.id === d.supplierId)?.name ?? d.supplierId))];
    return `${next.every((d) => d.standing) ? "📌 Your standing order" : "Your order"} from ${from.join(" and ")}`;
}
const MENU = RECIPES.filter((r) => !r.internal && !r.tableSnack);
const DRINKS = MENU.filter((r) => r.kind === "drink");
const TABS = [...MEALS.map((m) => m.id), "between"];
const DAY_FROM = TUNING.dayStartHour, DAY_TO = TUNING.dayStartHour + TUNING.dayLengthMinutes / 60;
const hourLabel = (h) => `${h % 24}:00`;
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
        return `<div class="bf-seg ${tab === m.id ? "on" : ""}" data-pick="mode:${m.id}" style="left:${pct(m.from)}%;width:${pct(m.to) - pct(m.from)}%" title="${def.name} ${hourLabel(m.from)}–${hourLabel(m.to)}">${def.icon}</div>`;
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
            if (!set.has(r.id) && !knows(g, r.id) && !servedReadyMade(g, r.id)) {
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
            const bought = servedReadyMade(g, r.id);
            const can = g.canMake(r.id), on = set.has(r.id), known = knows(g, r.id) || bought;
            const unit = r.storedIn === "piesafe" ? "a slice" : r.servings ? "a serving" : r.station === "tap" ? "a pint" : "";
            const how = r.storedIn === "piesafe" ? "Baked whole, sold by the slice." : r.servings ? `Made by the pot: about ${r.servings[0]} servings, ~${r.minutes[0]} min.` : r.station === "tap" ? "Poured from the barrel." : `Made to order, ~${r.minutes[0]} min.`;
            return {
                pick: String(i), icon: r.icon, name: r.name,
                fact: can && bought && !knows(g, r.id) ? `${moneyHtml(Math.round(readyMadePrice(g, Object.keys(READY_MADE).find((k) => READY_MADE[k].dish === r.id))))}${unit ? ` <span class="unit">${unit}</span>` : ""}` : can ? `${r.base.options.length > 1 || r.optional.pick[1] > 0 ? "from " : ""}${moneyHtml(priceOfRecipe(g, r.id))}${unit ? ` <span class="unit">${unit}</span>` : ""}` : "",
                status: !known ? "📚 learn it in Skills" : bought && !knows(g, r.id) ? "🧺 the baker's" : can ? whereShort(r) : needs(r), tone: can ? undefined : "warn",
                tags: r.baseTags, on, off: !can, focus: i === st.focus,
                detail: `${how} ${whereFull(r)}.${ingredientsHtml(g, r)}`,
                does: !known ? "Learn the recipe in Skills, at the desk" : !can ? "Buy what it needs in Equipment" : on ? "Take it off the board" : "Put it on the board",
            };
        });
        let head = "";
        if (g.mealMode) {
            const m = meal();
            const times = m
                ? `<div class="bf-times">Served <button data-pick="from:-1">−</button><b>${hourLabel(m.from)}</b><button data-pick="from:1">+</button>
           to <button data-pick="to:-1">−</button><b>${hourLabel(m.to)}</b><button data-pick="to:1">+</button></div>`
                : `<div class="bf-times muted">Drinks and the snacks on the tables only. Guests who stay can order when a meal starts.</div>`;
            head = `${dayStrip(g, st.tab)}${times}`;
        }
        const live = g.mealNow()?.id ?? "between";
        return {
            title: "📜 Bill of fare",
            holdsClock: true,
            subtitle: `${g.mealMode ? "A bill for each meal. Guests order only what's on it." : "Guests order only what's on the board, all day."} Pick dishes, then put it up`,
            // Two levels of tabs: all-day bill or meal times (Tab, L1/R1), then which meal (PageUp/PageDown, L2/R2).
            // Every bill keeps what's on it when you switch.
            tabs: { list: [{ id: "all", label: "All day" }, { id: "meals", label: "Meal times" }], current: g.mealMode ? "meals" : "all", pick: (id) => setMode(id === "meals") },
            modes: g.mealMode ? {
                list: TABS.map((t) => {
                    const m = g.meals.find((x) => x.id === t);
                    const def = MEALS.find((x) => x.id === t);
                    const now = live === t ? " · now" : "";
                    return { id: t, label: def && m ? `${def.icon} ${def.name}<small>${hourLabel(m.from)}–${hourLabel(m.to)}${now}</small>` : `🍺 Between<small>drinks only${now}</small>` };
                }),
                current: st.tab, pick: (id) => setTab(id),
            } : undefined,
            summary: head || undefined,
            cards: grid(cards, { cols: 6 }),
            onPick: (v) => {
                const [k, arg] = v.split(":");
                if (k === "from" || k === "to")
                    nudge(k, Number(arg));
                else
                    toggle(Number(v));
            },
            nav: { count: () => list.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; redraw(); }, use: toggle },
            confirm: { label: "Put it up", sub: `${set.size} on ${g.mealMode ? "this bill" : "the board"}`, run: putUp },
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// Equipment: buy a piece and place it. Utensils and trays are kept, not placed: one of each, and a better one replaces a worse.
let shopTab = "stoves"; // the shop opens where you left it
export function openShop(g) {
    const st = { focus: 0 };
    restockTinker(g);
    const all = [
        ...EQUIPMENT.map((e) => ({ id: e.id, icon: e.icon, name: e.name, blurb: e.blurb, goods: !!e.hearth, group: e.group, fuel: e.fuel, line: e.line, tier: e.tier })),
        ...CARRIED.map((x) => ({ id: x.id, icon: x.icon, name: x.name, blurb: x.text?.shopCard ?? "", goods: true, group: x.shopTab, fuel: undefined, line: x.line, tier: x.tier })),
    ];
    const isBest = (id) => { const p = pieceById(id); return !!p?.line && (p.hearth ? hearthPiece(g)?.type === id : bestInLine(g.upgrades, p.line)?.id === id); };
    const ownedOf = (it) => (it.goods ? (hasOrBetter(g, it.id) ? 1 : 0) : g.layout.filter((p) => p.type === it.id).length + toPlaceCount(g, it.id));
    const tabs = () => ({
        list: [...EQUIP_GROUPS.map((t) => {
                const n = all.filter((it) => it.group === t.id).reduce((a, it) => a + (it.goods ? 0 : ownedOf(it)), 0);
                return { id: t.id, label: `${t.icon} ${t.name}${n ? ` <small>${n}</small>` : ""}` };
            }), { id: "used", label: `🛠️ Tinker's cart${g.tinkerStock.length ? ` <small>${g.tinkerStock.length}</small>` : ""}` }],
        current: shopTab,
        pick: (id) => { g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); shopTab = id; st.focus = 0; replaceMenu(build()); },
    });
    const cart = () => {
        const stock = g.tinkerStock;
        const buyUsedAt = (i) => {
            const it = stock[i];
            if (!it)
                return;
            st.focus = i;
            const p = pieceById(it.type);
            if (g.purse < it.price) {
                g.say(`The tinker wants ${fmtMoney(it.price)} for it; you have ${fmtMoney(g.purse)}.`);
                return;
            }
            openMenu({
                title: `${p.icon} Used ${p.name.toLowerCase()}`,
                subtitle: `${fmtMoney(it.price)} · new, ${fmtMoney(p.price)} · you have ${fmtMoney(g.purse)}`,
                holdsClock: true,
                items: [
                    { label: "🛠️ Buy it off the cart", sub: "he leaves it with you now; place it from the desk", action: () => { if (buyUsed(g, it.id)) {
                            g.bus.emit({ type: "MenuSound", sound: "coins" });
                            back();
                            st.focus = 0;
                            replaceMenu(build());
                        } } },
                    { label: "Not now", button: "secondary", cancel: true, action: () => back() },
                ],
            });
        };
        const cards = stock.map((it, i) => {
            const p = pieceById(it.type);
            const traits = it.state.traits.map(traitById).filter((t) => !!t);
            const short = it.price - g.purse;
            return {
                pick: String(i), icon: p.icon, name: `Used ${p.name.toLowerCase()}`, focus: i === st.focus,
                fact: moneyHtml(it.price),
                status: short > 0 ? `short ${moneyHtml(short)}` : `level ${seasonLevel(it.state.made)} · health ${it.state.health} of ${mostHealth(it.type)}`,
                tone: short > 0 ? "warn" : undefined, off: short > 0,
                body: traits.length ? traits.map((t) => `<div class="desc"><b>${t.name}</b>: ${t.text}</div>`).join("") : `<div class="desc">Nothing it's picked up yet.</div>`,
                detail: `${p.text?.shopCard ?? ""} Made ${it.state.made} servings before it came to the cart. New, it's ${fmtMoney(p.price)}. Worn things break down more often.`,
                does: short > 0 ? `You need ${fmtMoney(short)} more` : "Buy it off the cart",
            };
        });
        return {
            title: "🛒 Equipment",
            subtitle: `${moneyHtml(g.purse)} in the purse · used pieces, cheaper and already worn in · a new lot every ${EQUIPMENT_DATA.used.weekday}`,
            holdsClock: true,
            tabs: tabs(),
            cards: cards.length ? grid(cards) : `<p class="empty">The cart's empty until ${EQUIPMENT_DATA.used.weekday}.</p>`,
            onPick: (v) => buyUsedAt(Number(v)),
            nav: { count: () => stock.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: buyUsedAt },
        };
    };
    const build = () => {
        if (shopTab === "used")
            return cart();
        // In lines, each from its first tier up.
        const items = all.filter((it) => it.group === shopTab).sort((a, b) => (a.line ?? a.id).localeCompare(b.line ?? b.id) || (a.tier ?? 0) - (b.tier ?? 0));
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
                tags: [...(it.tier && all.some((x) => x.line === it.line && x.id !== it.id) ? [`tier ${ROMAN[it.tier]}`] : []), ...(fuel ? [`${fuel.icon} ${fuel.name}`] : [])],
                detail: it.blurb,
                does: done ? (owned ? (isBest(it.id) ? "You have this" : "You have a better one") : "It's on the carter's cart") : short > 0 ? `You need ${fmtMoney(short)} more` : owned ? "Buy another: order it or fetch it" : "Buy it: order it or fetch it",
            };
        });
        return {
            title: "🛒 Equipment",
            subtitle: `${moneyHtml(g.purse)} in the purse · pick something to buy · the carter brings orders next morning`,
            holdsClock: true,
            tabs: tabs(),
            cards: grid(cards),
            onPick: (v) => buy(Number(v)),
            nav: { count: () => items.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: buy },
        };
    };
    openMenu(build());
}
