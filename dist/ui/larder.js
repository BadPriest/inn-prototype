// Card screens for what's already made: the snack bowl on a table, and the pie safe.
// Same template as cooking (docs/specs/ui.md): what's there now pinned on top, then cards to pick.
import { setOut } from "../readymade.js";
import { amount, clearSpoiled, condition, describeUses, have, lotsOf, spoiledNow, stageName, takeStock } from "../stock.js";
import { SNACKS, INGREDIENTS } from "../data.js";
import { returnSlice, storePie, takeSlice } from "../crafting.js";
import { trayItems, trayRoomFor } from "../serving.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
import { resultPanel } from "./cook.js";
// ---------------------------------------------------------------------------
// Snacks: a complimentary bowl on a table. Pick a card to set it out; an empty bowl can be filled again.
const EMPTY_BOWL = 0.15;
const STATION_WORDS = { prep: "prep table", griddle: "stove", stove: "stove", oven: "oven" };
/** Where a bowl of this would come from now: a batch made at a station first, else bought ready. */
function sourceOf(g, sn) {
    for (const [potId, pot] of g.pots) {
        if (pot.item.recipeId === sn.id && pot.left > 0)
            return { label: `${pot.left} bowl${pot.left === 1 ? "" : "s"} made`, pot, potId };
    }
    if (sn.boughtAs && have(g, sn.boughtAs) >= 1)
        return { label: `${Math.floor(have(g, sn.boughtAs))} in the pantry`, bought: sn.boughtAs };
    return undefined;
}
export function openSnackScreen(g, key) {
    const bowl = g.bowls.get(key);
    const st = { focus: Math.max(0, SNACKS.findIndex((x) => x.id === bowl?.snack)) };
    openMenu(snackSpec(g, key, st));
}
function snackSpec(g, key, st) {
    const bowl = g.bowls.get(key);
    const [kx, ky] = key.split(",").map(Number);
    const where = g.world.tile(kx, ky)?.def.interact === "snacks" ? "counter" : "table";
    const current = SNACKS.find((x) => x.id === bowl?.snack);
    const refresh = () => replaceMenu(snackSpec(g, key, st));
    const empty = !bowl || bowl.left < EMPTY_BOWL;
    const setOut = (i) => {
        const sn = SNACKS[i];
        if (!empty) {
            g.say(`The ${current?.name.toLowerCase()} isn't finished yet: fill the bowl once it's empty.`);
            return;
        }
        const from = sourceOf(g, sn);
        if (!from) {
            g.say(`There's no ${sn.name.toLowerCase()} ready. Make a batch first.`);
            return;
        }
        if (from.pot) {
            from.pot.left--;
            if (from.pot.left <= 0)
                g.pots.delete(from.potId);
        }
        else if (from.bought)
            takeStock(g, [{ id: from.bought, units: 1 }]);
        const again = bowl?.snack === sn.id;
        g.bowls.set(key, { snack: sn.id, left: 1 });
        g.say(again ? `You fill the bowl with ${sn.name.toLowerCase()} again.` : `You set out a bowl of ${sn.name.toLowerCase()}.`);
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        closeAll();
    };
    const cards = SNACKS.map((sn, i) => {
        const here = bowl?.snack === sn.id;
        const from = sourceOf(g, sn);
        const off = !from || !empty;
        return {
            pick: String(i), icon: sn.icon, name: sn.name, tags: sn.tags, on: here, off, focus: i === st.focus,
            status: here && !empty ? `on the ${where} now` : from ? from.label : sn.madeAt ? `make a batch at the ${STATION_WORDS[sn.madeAt]}` : "none in the pantry",
            tone: here && empty ? "warn" : here ? "good" : from ? undefined : "muted",
            detail: [sn.blurb, ...sn.effects.map((e) => e.shown).filter(Boolean).map((t) => `<div class="eff">✦ ${t}</div>`)].filter(Boolean).join(" "),
            fact: sn.effects.find((e) => e.shown)?.shown,
            does: !empty ? "The bowl isn't empty yet" : !from ? (sn.madeAt ? "None ready: make a batch first" : "None left: order more at the desk") : here ? "Fill it again" : "Set out a bowl",
        };
    });
    const pct = bowl ? Math.round(bowl.left * 100) : 0;
    const now = bowl && current
        ? resultPanel({ icon: current.icon, name: `${current.name} on the ${where}`, tags: current.tags,
            meta: `<div class="meter"><span style="width:${pct}%"></span></div>${bowl.left < 0.15 ? "Empty" : `About ${pct}% left`}` })
        : resultPanel({ icon: "🥣", name: `No bowl on the ${where}`, tags: [], meta: "Pick a snack to set one out", empty: true });
    return {
        title: where === "counter" ? "🥜 Snacks for the counter" : "🥜 Snacks for the table",
        subtitle: `On the house${where === "counter" ? ", for the stools beside it" : ""} · salty ones make guests thirsty, and thirsty guests order drinks`,
        view: {
            pinned: now,
            html: `<div class="sec-h"><h4>Snacks</h4><small>${empty ? "choose one" : "the bowl can be filled once it's empty"}</small></div>${grid(cards)}`,
            onPick: (v) => setOut(Number(v)),
            onKey: gridKeys(() => SNACKS.length, () => st.focus, (i) => { st.focus = i; refresh(); }, setOut),
        },
        items: bowl
            ? [{ label: "Clear the bowl away", button: "secondary", action: () => { g.bowls.delete(key); g.say("You clear the snack bowl away."); g.bus.emit({ type: "MenuSound", sound: "tick" }); closeAll(); } }]
            : [],
    };
}
// ---------------------------------------------------------------------------
// The pie safe: whole pies, a slice at a time. Slices on your tray can go back.
export function openPieSafeScreen(g) {
    const carried = trayItems(g).filter((i) => i.recipeId === "pie");
    if (!g.pieSafe.length && !carried.length && have(g, "bakersPie") < 1) {
        g.say("The pie safe is empty. Bake one in the oven, then bring it here.");
        return;
    }
    openMenu(pieSpec(g, { focus: 0 }));
}
function pips(left, total) {
    return `<span class="pips">${"●".repeat(left)}${"○".repeat(Math.max(0, total - left))}</span>`;
}
function pieSpec(g, st) {
    const slices = trayItems(g).filter((i) => i.recipeId === "pie" && !i.whole);
    const wholes = trayItems(g).filter((i) => i.recipeId === "pie" && i.whole);
    const room = trayRoomFor(g, "pie");
    const full = g.pieSafe.length >= g.pieSafeCapacity;
    // One list for the keyboard: whole pies to put away, then pies in the safe, then slices you could put back.
    const bought = have(g, "bakersPie");
    const picks = [...wholes.map((w) => `store:${w.id}`), ...(bought >= 1 ? ["bought:"] : []), ...g.pieSafe.map((p) => `take:${p.id}`), ...slices.map((s) => `back:${s.id}`)];
    st.focus = Math.min(st.focus, Math.max(0, picks.length - 1));
    const refresh = () => {
        if (!g.pieSafe.length && !trayItems(g).some((i) => i.recipeId === "pie") && have(g, "bakersPie") < 1) {
            closeAll();
            return;
        }
        replaceMenu(pieSpec(g, st));
    };
    const use = (v) => {
        const [what, id] = v.split(":");
        const it = trayItems(g).find((i) => i.id === Number(id));
        if (what === "bought") {
            if (!setOut(g, "bakersPie"))
                g.say(full ? "The pie safe is full." : "No baker's pie in the pantry.");
        }
        else if (what === "take")
            takeSlice(g, Number(id));
        else if (what === "store") {
            if (it)
                storePie(g, it);
        }
        else if (it)
            returnSlice(g, it);
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        refresh();
    };
    const store = wholes.map((w, i) => ({
        pick: `store:${w.id}`, icon: "🥧", name: w.name, tags: w.tags, off: full, focus: i === st.focus,
        fact: pips(w.whole ?? 0, w.whole ?? 0), status: full ? "the safe is full" : "whole, from the oven", tone: full ? "warn" : undefined,
        detail: `${w.whole ?? 0} slices once it's in the safe.`,
        does: full ? "Sell or serve a pie first" : "Put it in the safe",
    }));
    const boughtCard = bought >= 1 ? [{
            pick: "bought:", icon: "🥧", name: "Baker's pie", off: full, focus: wholes.length === st.focus,
            fact: `${Math.floor(bought)} in the pantry`, status: full ? "the safe is full" : "set one out", tone: full ? "warn" : "good",
            detail: "Bought from the baker: six slices, pleasant enough, nothing special.",
            does: full ? "Sell or serve a pie first" : "Put one in the safe",
        }] : [];
    const pies = g.pieSafe.map((p, i0) => {
        const old = g.day - p.bakedDay >= 1;
        return {
            pick: `take:${p.id}`, icon: "🥧", name: p.item.name.replace(/^Day-old (\w)/, (_m, c) => c.toUpperCase()),
            tags: p.item.tags, off: !room, focus: wholes.length + boughtCard.length + i0 === st.focus,
            fact: pips(p.left, p.total), status: `${p.left} of ${p.total} left${old ? " · day-old" : ""}`, tone: old ? "warn" : undefined,
            detail: `${p.item.readyMade ? "From the baker. " : ""}${old ? "Baked yesterday: it goes to the hens tomorrow." : "Baked today."}`,
            does: room ? "Cut a slice onto your tray" : "No room on your trays",
        };
    });
    const back = slices.map((s, i) => ({
        pick: `back:${s.id}`, icon: "🍰", name: s.name, focus: wholes.length + boughtCard.length + g.pieSafe.length + i === st.focus,
        status: s.ticketName ? `was for ${s.ticketName}` : "on your tray", tags: s.tags,
        does: "Put it back in the pie",
    }));
    const html = `
    ${store.length ? `<div class="sec-h"><h4>From the oven</h4><small>${full ? "the safe is full" : "put it away"}</small></div>${grid(store)}` : ""}
    ${boughtCard.length ? `<div class="sec-h"><h4>From the baker</h4><small>${full ? "the safe is full" : "set one out"}</small></div>${grid(boughtCard)}` : ""}
    <div class="sec-h"><h4>In the safe</h4><small>${g.pieSafe.length} of ${g.pieSafeCapacity}${pies.length ? (room ? " · cut a slice" : " · no room on your trays") : ""}</small></div>
    ${pies.length ? grid(pies) : `<p class="lead">No pies. Bake one in the oven, then bring it here.</p>`}
    ${back.length ? `<div class="sec-h"><h4>On your tray</h4><small>put a slice back</small></div>${grid(back)}` : ""}`;
    return {
        title: "🥧 Pie safe",
        subtitle: "Whole pies, sold by the slice",
        flavour: "Pies keep for the day they're baked. Tomorrow they're day-old; the day after, they go to the hens.",
        view: {
            html,
            onPick: use,
            onKey: gridKeys(() => picks.length, () => st.focus, (i) => { st.focus = i; refresh(); }, (i) => use(picks[i])),
        },
        items: [],
    };
}
// ---------------------------------------------------------------------------
// The pantry: what's in stock, and how it's keeping.
/** "in 5 hours", "tomorrow", "in 3 days": how long until it turns, roughly. */
function untilWords(days) {
    if (days < 0.3)
        return `in ${Math.max(1, Math.round(days * 20))} hour${Math.round(days * 20) === 1 ? "" : "s"}`;
    if (days < 1.3)
        return "by tomorrow";
    return `in ${Math.round(days)} days`;
}
export function openPantryScreen(g) {
    const st = { focus: 0 };
    const build = () => {
        const shelves = INGREDIENTS.filter((x) => x.worth > 0 && lotsOf(g, x.id).some((l) => l.units > 0.001))
            .map((x) => ({ x, c: condition(g, x.id) }))
            // What needs using or clearing first: spoiled, then turning, then soonest to turn.
            .sort((a, b) => Number(b.c.spoiled > 0) - Number(a.c.spoiled > 0) || Number(b.c.turning > 0) - Number(a.c.turning > 0) || (a.c.nextTurn ?? 1e9) - (b.c.nextTurn ?? 1e9));
        const spoiled = spoiledNow(g);
        const cards = shelves.map(({ x, c }, i) => {
            const parts = [
                c.fresh > 0 ? `${amount(x.id, c.fresh)} fresh` : "",
                c.turning > 0 ? `${amount(x.id, c.turning)} ${stageName(c.turningStage ?? "onTheTurn")}` : "",
                c.spoiled > 0 ? `${amount(x.id, c.spoiled)} spoiled` : "",
            ].filter(Boolean);
            const soon = c.fresh > 0 && c.nextTurn !== undefined && c.nextTurn < 2;
            return {
                pick: x.id, icon: x.icon, name: x.name, tags: x.tags, focus: i === st.focus,
                fact: amount(x.id, have(g, x.id)),
                status: c.spoiled > 0 ? `${amount(x.id, c.spoiled)} spoiled` : c.turning > 0 ? `${amount(x.id, c.turning)} ${stageName(c.turningStage ?? "onTheTurn")}` : soon ? `turns ${untilWords(c.nextTurn)}` : "",
                tone: c.spoiled > 0 ? "warn" : c.turning > 0 || soon ? "warn" : undefined,
                detail: `On the shelves: ${parts.join(", ")}.${c.fresh > 0 && c.nextTurn !== undefined && c.nextTurn < 60 ? ` The fresh turns ${untilWords(c.nextTurn)}.` : ""}${c.turning > 0 ? " Past fresh, a dish made with it shows it." : ""}${c.spoiled > 0 ? " Spoiled can't be used: clear it out." : ""}`,
            };
        });
        const clear = () => {
            const gone = clearSpoiled(g);
            if (!gone.length)
                return;
            g.bus.emit({ type: "MenuSound", sound: "tick" });
            g.say(`You clear out the spoiled: ${describeUses(gone)}.`);
            replaceMenu(build());
        };
        return {
            title: "🧺 Pantry",
            subtitle: shelves.length ? "What's on the shelves, and how it's keeping · order more at the desk (Supplies)" : "The shelves are bare · order supplies at the desk",
            view: {
                html: cards.length ? grid(cards) : `<div class="muted">Nothing left. Water from the pump is always there.</div>`,
                onPick: () => undefined,
                onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, () => undefined),
            },
            items: spoiled.length ? [{ label: "🗑️ Clear out the spoiled", sub: describeUses(spoiled), button: "primary", action: clear }] : [],
        };
    };
    openMenu(build());
}
