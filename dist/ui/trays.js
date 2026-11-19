// Card screens for what's on your trays: garnishing a drink, offering something unasked, the scrap bin,
// the kitchen hatch, and choosing which tray to set down. Same look and handling as cooking (cards.ts).
import { garnishesFor } from "../data.js";
import { applyGarnish, garnishableDrinks, iconFor, pickupFromHatch, removeFromTray, serveUnasked, setTrayDown, takeFromHatch, trayItems, } from "../serving.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
import { resultPanel } from "./cook.js";
/** A dish or drink as a card. */
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
export function openGarnishScreen(g) {
    if (!garnishableDrinks(g).length) {
        g.say("Nothing on your trays takes a garnish.");
        return;
    }
    openMenu(garnishSpec(g, { drink: 0, garnish: -1, focus: 0 }));
}
function garnishSpec(g, st) {
    const drinks = garnishableDrinks(g);
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
        else
            st.garnish = st.garnish === Number(n) ? -1 : Number(n);
        st.focus = Math.max(0, picks.indexOf(v));
        refresh();
    };
    const gar = suits[st.garnish];
    const after = gar ? [...new Set([...drink.tags, ...gar.tags])] : drink.tags;
    const go = () => {
        if (!gar)
            return;
        applyGarnish(g, drink, gar.id);
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        closeAll();
    };
    const drinkCards = drinks.map((d, i) => itemCard(d, `d:${i}`, picks[st.focus] === `d:${i}`, { on: i === st.drink }));
    const garnishCards = suits.map((x, i) => {
        const adds = x.tags.filter((t) => !drink.tags.includes(t));
        return {
            pick: `g:${i}`, icon: x.icon, name: x.name, tags: x.tags, on: i === st.garnish, focus: picks[st.focus] === `g:${i}`,
            detail: adds.length ? `Adds ${adds.join(" and ")} to the ${drink.name.toLowerCase()}.` : `Nothing new for the ${drink.name.toLowerCase()}.`,
            does: i === st.garnish ? "Take it off" : "Use this garnish",
        };
    });
    const html = `
    ${showDrinks ? `<div class="sec-h"><h4>On your trays</h4><small>which one</small></div>${grid(drinkCards)}` : ""}
    <div class="sec-h"><h4>Garnish</h4><small>choose one</small></div>
    ${grid(garnishCards)}`;
    return {
        title: "🍋 Garnish",
        subtitle: "At the counter · a little something on top",
        flavour: "It changes how a dish or a drink lands, for better or worse.",
        view: {
            pinned: resultPanel({
                icon: iconFor(drink.recipeId, gar?.id), name: gar ? `${drink.name} with ${gar.name.toLowerCase()}` : drink.name,
                tags: after, lit: after.filter((t) => !drink.tags.includes(t)), meta: gar ? "Garnished, ready to serve" : "Pick a garnish to see what it becomes",
                forWho: drink.ticketName ? `For <b>${drink.ticketName}</b>` : undefined, empty: !gar,
            }),
            html,
            onPick: use,
            onKey: (e) => {
                if (e.key === "Enter") {
                    go();
                    return true;
                }
                return gridKeys(() => picks.length, () => st.focus, (i) => { st.focus = i; refresh(); }, (i) => use(picks[i]))(e);
            },
        },
        items: [{ label: "Garnish it", sub: gar ? `with ${gar.name.toLowerCase()}` : "choose a garnish", button: "primary", disabled: !gar, action: go }],
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
            view: {
                html: `<div class="sec-h"><h4>On your trays</h4><small>choose one to give</small></div>
          ${grid(items.map((it, i) => itemCard(it, String(i), i === st.focus, { does: `Give it to ${p.name}` })))}`,
                onPick: (v) => give(Number(v)),
                onKey: gridKeys(() => items.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, give),
            },
            items: [],
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
            subtitle: "Throw away something on your trays",
            flavour: "Nothing's wasted here: what goes in the bin goes to the hens.",
            view: {
                html: `<div class="sec-h"><h4>On your trays</h4><small>choose what to throw away</small></div>${grid(items.map((it, i) => itemCard(it, String(i), i === st.focus, { does: "Throw it away" })))}`,
                onPick: (v) => toss(Number(v)),
                onKey: gridKeys(() => items.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, toss),
            },
            items: [{
                    label: "Throw it all away", sub: `everything on your trays · ${items.length} item${items.length === 1 ? "" : "s"}`, button: "secondary",
                    action: () => { for (const it of trayItems(g))
                        removeFromTray(g, it); g.say("You scrape your trays clean."); g.bus.emit({ type: "MenuSound", sound: "tick" }); closeAll(); },
                }],
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
            subtitle: "Dishes ready to take out",
            view: {
                html: `<div class="sec-h"><h4>Ready</h4><small>choose one to take</small></div>${grid(g.hatch.map((it, i) => itemCard(it, String(i), i === st.focus, { does: "Put it on your tray" })))}`,
                onPick: (v) => take(Number(v)),
                onKey: gridKeys(() => g.hatch.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, take),
            },
            items: [{ label: "Take everything that fits", sub: "oldest first", button: "primary", action: () => { pickupFromHatch(g); g.bus.emit({ type: "MenuSound", sound: "tick" }); closeAll(); } }],
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
            view: {
                html: grid(cards, { cols: 2 }),
                onPick: (v) => put(Number(v)),
                onKey: gridKeys(() => 2, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, put),
            },
            items: [],
        };
    };
    openMenu(build());
}
