// Card screens for what's already made: the snack bowl on a table, and the pie safe.
// Same look and handling as cooking (see cards.ts).
import { SNACKS } from "../data.js";
import { returnSlice, takeSlice } from "../crafting.js";
import { trayItems, trayRoomFor } from "../serving.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { card, gridKeys } from "./cards.js";
// ---------------------------------------------------------------------------
// Snacks: a complimentary bowl on a table. Pick a card to set it out, top it up, or swap it.
export function openSnackScreen(g, key) {
    const bowl = g.bowls.get(key);
    const st = { focus: Math.max(0, SNACKS.findIndex((x) => x.id === bowl?.snack)) };
    openMenu(snackSpec(g, key, st));
}
function snackSpec(g, key, st) {
    const bowl = g.bowls.get(key);
    const current = SNACKS.find((x) => x.id === bowl?.snack);
    const refresh = () => replaceMenu(snackSpec(g, key, st));
    const setOut = (i) => {
        const sn = SNACKS[i];
        const topUp = bowl?.snack === sn.id;
        g.bowls.set(key, { snack: sn.id, left: 1 });
        g.say(topUp ? `You top up the ${sn.name.toLowerCase()}.` : `You set out a bowl of ${sn.name.toLowerCase()}.`);
        closeAll();
    };
    const cards = SNACKS.map((sn, i) => ({
        pick: String(i),
        icon: sn.icon,
        name: sn.name,
        tags: sn.tags,
        note: bowl?.snack === sn.id ? (bowl.left < 0.15 ? "on the table · top it up" : "on the table now") : sn.thirsty >= 0.25 ? "makes them thirsty" : "easy on the throat",
        on: bowl?.snack === sn.id,
        focus: i === st.focus,
    }));
    const focused = SNACKS[st.focus];
    const left = bowl ? (bowl.left < 0.15 ? "empty" : `about ${Math.round(bowl.left * 100)}% left`) : "";
    const html = `
    <p class="blurb">A bowl on the table, free to whoever sits there. Salty ones make people thirsty, and thirsty people order drinks.</p>
    ${bowl && current ? `<div class="dish slim"><span class="ic">${current.icon}</span><div>
        <div class="nm">${current.name} on the table</div>
        <div class="meter"><span style="width:${Math.round(bowl.left * 100)}%"></span></div>
        <div class="meta">${left}</div></div></div>` : ""}
    <div class="need">${bowl ? "Pick one to top up or swap:" : "Pick one to set out:"}</div>
    <div class="cards">${cards.map(card).join("")}</div>
    ${focused?.blurb ? `<p class="aside">${focused.icon} ${focused.blurb}</p>` : ""}`;
    return {
        title: "🥜 Snacks for the table",
        subtitle: "On the house",
        view: {
            html,
            onPick: (v) => setOut(Number(v)),
            onKey: gridKeys(() => SNACKS.length, () => st.focus, (i) => { st.focus = i; refresh(); }, setOut),
        },
        items: bowl
            ? [{ label: "Clear the bowl away", button: "secondary", action: () => { g.bowls.delete(key); g.say("You clear the snack bowl away."); closeAll(); } }]
            : [],
    };
}
// ---------------------------------------------------------------------------
// The pie safe: whole pies, a slice at a time. Slices on your tray can go back.
export function openPieSafeScreen(g) {
    const slices = trayItems(g).filter((i) => i.recipeId === "pie");
    if (!g.pieSafe.length && !slices.length) {
        g.say("The pie safe is empty. Bake one in the oven.");
        return;
    }
    openMenu(pieSpec(g, { focus: 0 }));
}
function pips(left, total) {
    return `<span class="pips">${"●".repeat(left)}${"○".repeat(Math.max(0, total - left))}</span>`;
}
function pieSpec(g, st) {
    const slices = trayItems(g).filter((i) => i.recipeId === "pie");
    const room = trayRoomFor(g, "food");
    // One list for the keyboard: whole pies first, then slices you could put back.
    const picks = [...g.pieSafe.map((p) => `take:${p.id}`), ...slices.map((s) => `back:${s.id}`)];
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
        if (what === "take")
            takeSlice(g, Number(id));
        else {
            const it = trayItems(g).find((i) => i.id === Number(id));
            if (it)
                returnSlice(g, it);
        }
        refresh();
    };
    const pies = g.pieSafe.map((p, i) => {
        const old = g.day - p.bakedDay >= 1;
        return {
            pick: `take:${p.id}`,
            icon: "🥧",
            name: p.item.name.replace(/^Day-old (\w)/, (_m, c) => c.toUpperCase()),
            note: `${pips(p.left, p.total)}<br>${p.left} of ${p.total} slices${old ? " · day-old" : ""}`,
            tags: p.item.tags,
            off: !room,
            focus: i === st.focus,
        };
    });
    const back = slices.map((s, i) => ({
        pick: `back:${s.id}`,
        icon: "↩️",
        name: s.name,
        note: s.ticketName ? `was for ${s.ticketName}` : "put it back",
        focus: g.pieSafe.length + i === st.focus,
    }));
    const html = `
    <p class="blurb">Pies keep here for the day they're baked. Tomorrow they're day-old; the day after, they go to the hens.</p>
    ${pies.length ? `<div class="need">${room ? "Pick a pie to cut a slice:" : "No room on your trays for a slice."}</div><div class="cards">${pies.map(card).join("")}</div>`
        : `<div class="need">No whole pies. Bake one in the oven.</div>`}
    ${back.length ? `<div class="need" style="margin-top:12px">On your tray (pick to put back):</div><div class="cards">${back.map(card).join("")}</div>` : ""}`;
    return {
        title: "🥧 Pie safe",
        subtitle: "Baked fresh, sliced to order",
        view: {
            html,
            onPick: use,
            onKey: gridKeys(() => picks.length, () => st.focus, (i) => { st.focus = i; refresh(); }, (i) => use(picks[i])),
        },
        items: [],
    };
}
