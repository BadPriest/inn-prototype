// Card screens for what's already made: the snack bowl on a table, and the pie safe.
// Same template as cooking (docs/specs/ui.md): what's there now pinned on top, then cards to pick.
import { SNACKS } from "../data.js";
import { returnSlice, storePie, takeSlice } from "../crafting.js";
import { trayItems, trayRoomFor } from "../serving.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
import { resultPanel } from "./cook.js";
// ---------------------------------------------------------------------------
// Snacks: a complimentary bowl on a table. Pick a card to set it out, top it up, or swap it.
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
    const setOut = (i) => {
        const sn = SNACKS[i];
        const topUp = bowl?.snack === sn.id;
        g.bowls.set(key, { snack: sn.id, left: 1 });
        g.say(topUp ? `You top up the ${sn.name.toLowerCase()}.` : `You set out a bowl of ${sn.name.toLowerCase()}.`);
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        closeAll();
    };
    const cards = SNACKS.map((sn, i) => {
        const here = bowl?.snack === sn.id;
        return {
            pick: String(i), icon: sn.icon, name: sn.name, tags: sn.tags, on: here, focus: i === st.focus,
            status: here ? (bowl.left < 0.15 ? "empty: top it up" : `on the ${where} now`) : sn.thirsty >= 0.25 ? "makes them thirsty" : "easy on the throat",
            tone: here && bowl.left < 0.15 ? "warn" : here ? "good" : undefined,
            detail: sn.blurb,
            does: here ? "Top it up" : bowl ? `Swap the ${current?.name.toLowerCase()} for this` : "Set out a bowl",
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
            html: `<div class="sec-h"><h4>Snacks</h4><small>${bowl ? "top up or swap" : "choose one"}</small></div>${grid(cards)}`,
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
    if (!g.pieSafe.length && !carried.length) {
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
    const room = trayRoomFor(g, "food");
    const full = g.pieSafe.length >= g.pieSafeCapacity;
    // One list for the keyboard: whole pies to put away, then pies in the safe, then slices you could put back.
    const picks = [...wholes.map((w) => `store:${w.id}`), ...g.pieSafe.map((p) => `take:${p.id}`), ...slices.map((s) => `back:${s.id}`)];
    st.focus = Math.min(st.focus, Math.max(0, picks.length - 1));
    const refresh = () => {
        if (!g.pieSafe.length && !trayItems(g).some((i) => i.recipeId === "pie")) {
            closeAll();
            return;
        }
        replaceMenu(pieSpec(g, st));
    };
    const use = (v) => {
        const [what, id] = v.split(":");
        const it = trayItems(g).find((i) => i.id === Number(id));
        if (what === "take")
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
    const pies = g.pieSafe.map((p, i0) => {
        const old = g.day - p.bakedDay >= 1;
        return {
            pick: `take:${p.id}`, icon: "🥧", name: p.item.name.replace(/^Day-old (\w)/, (_m, c) => c.toUpperCase()),
            tags: p.item.tags, off: !room, focus: wholes.length + i0 === st.focus,
            fact: pips(p.left, p.total), status: `${p.left} of ${p.total} left${old ? " · day-old" : ""}`, tone: old ? "warn" : undefined,
            detail: old ? "Baked yesterday: it goes to the hens tomorrow." : "Baked today.",
            does: room ? "Cut a slice onto your tray" : "No room on your trays",
        };
    });
    const back = slices.map((s, i) => ({
        pick: `back:${s.id}`, icon: "🍰", name: s.name, focus: wholes.length + g.pieSafe.length + i === st.focus,
        status: s.ticketName ? `was for ${s.ticketName}` : "on your tray", tags: s.tags,
        does: "Put it back in the pie",
    }));
    const html = `
    ${store.length ? `<div class="sec-h"><h4>From the oven</h4><small>${full ? "the safe is full" : "put it away"}</small></div>${grid(store)}` : ""}
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
