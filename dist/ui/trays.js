// Card screens for what's on your trays: garnishing a drink, offering something unasked, the scrap bin,
// the kitchen hatch, and choosing which tray to set down. Same look and handling as cooking (cards.ts).
import { have } from "../stock.js";
import { garnishById, garnishesFor } from "../data.js";
import { applyGarnish, garnishableDrinks, iconFor, pickupFromHatch, removeFromTray, serveUnasked, setTrayDown, takeFromHatch, trayItems, } from "../serving.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { grid, heading } from "./cards.js";
import { resultPanel } from "./cook.js";
/** A dish or drink as a card. */
/** The open order each dish or drink would go to: the guest it was made for, else the oldest order for it not already taken. */
function ordersFor(g, items) {
    const out = new Map();
    const taken = new Set();
    const open = (it) => g.orders.filter((o) => o.open && o.recipeId === it.recipeId && !taken.has(o.id)).sort((a, b) => a.placedAt - b.placedAt);
    for (const pass of [true, false])
        for (const it of items) {
            if (out.has(it))
                continue;
            const o = pass ? open(it).find((x) => x.patronId === it.ticket) : open(it)[0];
            if (o) {
                out.set(it, o);
                taken.add(o.id);
            }
        }
    return out;
}
const plaque = (no) => `<span class="plaque-sm"><span>${no}</span></span>`;
function itemCard(it, pick, focus, extra = {}) {
    return {
        pick,
        icon: iconFor(it.recipeId, it.garnish) || "🍽",
        name: it.name,
        tags: it.tags,
        status: it.ticketName ? `for ${it.ticketName}` : undefined,
        tone: "good",
        focus,
        ...extra,
    };
}
// ---------------------------------------------------------------------------
// Garnish: choose the drink (if there's more than one), choose the garnish, see what it becomes.
export function openGarnishScreen(g, kind) {
    if (!garnishableDrinks(g, kind).length) {
        const other = garnishableDrinks(g, kind === "food" ? "drink" : "food").length;
        g.say(other ? (kind === "food" ? "Drinks are garnished at the bar." : "Dishes are garnished in the kitchen, at the garnish board.") : `Nothing on your trays takes a garnish${kind === "food" ? " here: dishes only" : " here: drinks only"}.`);
        return;
    }
    openMenu(garnishSpec(g, { drink: 0, garnish: -1, focus: 0, kind }));
}
function garnishSpec(g, st) {
    const drinks = garnishableDrinks(g, st.kind);
    st.drink = Math.min(st.drink, drinks.length - 1);
    const drink = drinks[st.drink];
    const refresh = () => replaceMenu(garnishSpec(g, st));
    // One list for the keyboard: the drinks (when there's a choice), then the garnishes.
    const showDrinks = drinks.length > 1;
    const suits = garnishesFor(drink.recipeId);
    if (st.garnish >= suits.length)
        st.garnish = -1;
    const picks = [...(showDrinks ? drinks.map((_, i) => `d:${i}`) : []), ...suits.map((_, i) => `g:${i}`)];
    const use = (v) => {
        const [k, n] = v.split(":");
        if (k === "d")
            st.drink = Number(n);
        else if (have(g, suits[Number(n)]?.id ?? "") >= 1)
            st.garnish = st.garnish === Number(n) ? -1 : Number(n);
        st.focus = Math.max(0, picks.indexOf(v));
        refresh();
    };
    const gar = suits[st.garnish];
    const after = gar ? [...new Set([...drink.tags, ...gar.tags])] : drink.tags;
    const go = () => {
        if (!gar)
            return;
        if (order) {
            drink.ticket = order.patronId;
            drink.ticketName = g.patron(order.patronId)?.name;
        }
        applyGarnish(g, drink, gar.id);
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        closeAll();
    };
    const orders = ordersFor(g, drinks);
    const order = orders.get(drink);
    const asked = order?.wantGarnish;
    const drinkCards = drinks.map((d, i) => {
        const o = orders.get(d);
        const who = o ? g.patron(o.patronId)?.name : undefined;
        return itemCard(d, `d:${i}`, picks[st.focus] === `d:${i}`, {
            on: i === st.drink,
            fact: o ? `${plaque(o.no)}${who ?? ""}` : undefined,
            status: o?.wantGarnish ? `asked for ${garnishById(o.wantGarnish)?.name.toLowerCase() ?? "a garnish"}` : d.ticketName && !o ? `for ${d.ticketName}` : undefined,
        });
    });
    const garnishCards = suits.map((x, i) => {
        const adds = x.tags.filter((t) => !drink.tags.includes(t));
        const left = have(g, x.id);
        return {
            pick: `g:${i}`, icon: x.icon, name: x.name, tags: x.tags, on: i === st.garnish, off: left < 1, focus: picks[st.focus] === `g:${i}`,
            status: x.id === asked ? `asked for · ${left} in the pantry` : left < 1 ? "none in the pantry" : `${left} in the pantry`, tone: x.id === asked ? "good" : left < 1 ? "muted" : undefined,
            detail: adds.length ? `Adds ${adds.join(" and ")} to the ${drink.name.toLowerCase()}.` : `Nothing new for the ${drink.name.toLowerCase()}.`,
            does: i === st.garnish ? "Take it off" : "Use this garnish",
        };
    });
    const html = `
    ${showDrinks ? `${heading(`On your trays`, `which one`)}${grid(drinkCards)}` : ""}
    ${heading(`Garnish`, `choose one`)}
    ${grid(garnishCards)}`;
    return {
        title: "🍋 Garnish",
        subtitle: st.kind === "food" ? "At the garnish board · a little something on top" : "At the counter · a little something on top",
        flavour: "It changes how a dish or a drink lands, for better or worse.",
        summary: resultPanel({
            icon: iconFor(drink.recipeId, gar?.id), name: gar ? `${drink.name} with ${gar.name.toLowerCase()}` : drink.name,
            tags: after, lit: after.filter((t) => !drink.tags.includes(t)), meta: gar ? "Garnished, ready to serve" : "Pick a garnish to see what it becomes",
            forWho: order ? `${plaque(order.no)}For <b>${g.patron(order.patronId)?.name ?? "a guest"}</b>${asked ? `, who asked for ${garnishById(asked)?.name.toLowerCase() ?? "a garnish"}` : ""}` : drink.ticketName ? `For <b>${drink.ticketName}</b>` : undefined, empty: !gar,
        }),
        cards: html,
        onPick: use,
        nav: { count: () => picks.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; refresh(); }, use: (i) => use(picks[i]) },
        confirm: { label: "Garnish it", sub: gar ? `with ${gar.name.toLowerCase()}` : "choose a garnish", disabled: !gar, run: go },
    };
}
// ---------------------------------------------------------------------------
// Offer something unasked (the 🃏 card): pick what to give.
export function openOfferScreen(g, p) {
    const st = { focus: 0 };
    const build = () => {
        const items = trayItems(g).filter((i) => !i.whole); // a whole pie goes to the pie safe, not to a guest
        const give = (i) => { const it = items[i]; if (!it)
            return; closeAll(); g.bus.emit({ type: "MenuSound", sound: "tick" }); serveUnasked(g, p, it); };
        return {
            title: `🃏 Something for ${p.name}?`,
            subtitle: "A gift, on the house: it doesn't count as their order",
            flavour: "It might be exactly what they needed.",
            cards: `${heading(`On your trays`, `choose one to give`)}
          ${grid(items.map((it, i) => itemCard(it, String(i), i === st.focus, { does: `Give it to ${p.name}` })))}`,
            onPick: (v) => give(Number(v)),
            nav: { count: () => items.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: give },
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// The scrap bin: throw away something on your trays.
export function openBinScreen(g) {
    if (!trayItems(g).length) {
        g.say("Nothing on your trays to throw away.");
        return;
    }
    const st = { focus: 0 };
    const build = () => {
        const items = trayItems(g);
        st.focus = Math.min(st.focus, Math.max(0, items.length - 1));
        const toss = (i) => {
            const it = items[i];
            if (!it)
                return;
            removeFromTray(g, it);
            g.bus.emit({ type: "MenuSound", sound: "tick" });
            g.say(`${it.name} goes in the bin.`);
            if (trayItems(g).length)
                replaceMenu(build());
            else
                closeAll();
        };
        return {
            title: "🗑️ Scrap bin",
            subtitle: "Throw away something on your trays · pick it",
            flavour: "Nothing's wasted here: what goes in the bin goes to the hens.",
            cards: `${heading(`On your trays`, `choose what to throw away`)}${grid(items.map((it, i) => itemCard(it, String(i), i === st.focus, { does: "Throw it away" })))}`,
            onPick: (v) => toss(Number(v)),
            nav: { count: () => items.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: toss },
            alt: {
                label: "Throw it all away", sub: `everything on your trays · ${items.length} item${items.length === 1 ? "" : "s"}`,
                run: () => { for (const it of trayItems(g))
                    removeFromTray(g, it); g.say("You scrape your trays clean."); g.bus.emit({ type: "MenuSound", sound: "tick" }); closeAll(); },
            },
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// The kitchen hatch (for a hired cook, later): pick what to take.
export function openHatchScreen(g) {
    if (!g.hatch.length) {
        g.say("The hatch is empty.");
        return;
    }
    const st = { focus: 0 };
    const build = () => {
        st.focus = Math.min(st.focus, Math.max(0, g.hatch.length - 1));
        const take = (i) => {
            const it = g.hatch[i];
            if (!it)
                return;
            takeFromHatch(g, it);
            g.bus.emit({ type: "MenuSound", sound: "tick" });
            if (g.hatch.length)
                replaceMenu(build());
            else
                closeAll();
        };
        return {
            title: "🪟 Kitchen hatch",
            subtitle: "Dishes ready to take out · pick one, or take everything that fits",
            cards: `${heading(`Ready`, `choose one to take`)}${grid(g.hatch.map((it, i) => itemCard(it, String(i), i === st.focus, { does: "Put it on your tray" })))}`,
            onPick: (v) => take(Number(v)),
            nav: { count: () => g.hatch.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: take },
            confirm: { label: "Take everything that fits", sub: "oldest first", run: () => { pickupFromHatch(g); g.bus.emit({ type: "MenuSound", sound: "tick" }); closeAll(); } },
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// Set a tray down: which one?
export function openSetDownScreen(g) {
    const st = { focus: 0 };
    const build = () => {
        const put = (i) => { closeAll(); g.bus.emit({ type: "MenuSound", sound: "tick" }); setTrayDown(g, i); };
        const cards = g.keeper.trays.map((t, i) => ({
            pick: String(i),
            icon: t.items.map((x) => iconFor(x.recipeId, x.garnish) || "🍽").join(""),
            name: i === 0 ? "Left tray" : "Right tray",
            status: t.items.map((x) => x.name).join(", "),
            focus: i === st.focus,
            detail: "Sets it on the counter or the nearest free table. At a table where people are waiting, you can serve them all from it.",
            does: "Set this tray down",
        }));
        return {
            title: "Set down which tray?",
            subtitle: "On the counter or a nearby table, to free your hands",
            cards: grid(cards, { cols: 2 }),
            onPick: (v) => put(Number(v)),
            nav: { count: () => 2, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: put },
        };
    };
    openMenu(build());
}
