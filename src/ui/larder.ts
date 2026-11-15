// Card screens for what's already made: the snack bowl on a table, and the pie safe.
// Same look and handling as cooking (see cards.ts).

import { SNACKS, TUNING } from "../data.js";
import type { Game } from "../game.js";
import { returnSlice, storePie, takeSlice } from "../crafting.js";
import { trayItems, trayRoomFor } from "../serving.js";
import { closeAll, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { card, gridKeys, type CardSpec } from "./cards.js";

// ---------------------------------------------------------------------------
// Snacks: a complimentary bowl on a table. Pick a card to set it out, top it up, or swap it.

export function openSnackScreen(g: Game, key: string): void {
  const bowl = g.bowls.get(key);
  const st = { focus: Math.max(0, SNACKS.findIndex((x) => x.id === bowl?.snack)) };
  openMenu(snackSpec(g, key, st));
}

function snackSpec(g: Game, key: string, st: { focus: number }): MenuSpec {
  const bowl = g.bowls.get(key);
  const [kx, ky] = key.split(",").map(Number);
  const where = g.world.tile(kx, ky)?.def.interact === "snacks" ? "counter" : "table";
  const current = SNACKS.find((x) => x.id === bowl?.snack);
  const refresh = () => replaceMenu(snackSpec(g, key, st));
  const setOut = (i: number) => {
    const sn = SNACKS[i];
    const topUp = bowl?.snack === sn.id;
    g.bowls.set(key, { snack: sn.id, left: 1 });
    g.say(topUp ? `You top up the ${sn.name.toLowerCase()}.` : `You set out a bowl of ${sn.name.toLowerCase()}.`);
    closeAll();
  };
  const cards: CardSpec[] = SNACKS.map((sn, i) => ({
    pick: String(i),
    icon: sn.icon,
    name: sn.name,
    tags: sn.tags,
    note: bowl?.snack === sn.id ? (bowl.left < 0.15 ? `on the ${where} · top it up` : `on the ${where} now`) : sn.thirsty >= 0.25 ? "makes them thirsty" : "easy on the throat",
    on: bowl?.snack === sn.id,
    focus: i === st.focus,
  }));
  const focused = SNACKS[st.focus];
  const left = bowl ? (bowl.left < 0.15 ? "empty" : `about ${Math.round(bowl.left * 100)}% left`) : "";
  const html = `
    <p class="blurb">${where === "counter" ? "A bowl on the counter, free to the stools beside it." : "A bowl on the table, free to whoever sits there."} Salty ones make people thirsty, and thirsty people order drinks.</p>
    ${bowl && current ? `<div class="dish slim"><span class="ic">${current.icon}</span><div>
        <div class="nm">${current.name} on the ${where}</div>
        <div class="meter"><span style="width:${Math.round(bowl.left * 100)}%"></span></div>
        <div class="meta">${left}</div></div></div>` : ""}
    <div class="need">${bowl ? "Pick one to top up or swap:" : "Pick one to set out:"}</div>
    <div class="cards">${cards.map(card).join("")}</div>
    ${focused?.blurb ? `<p class="aside">${focused.icon} ${focused.blurb}</p>` : ""}`;
  return {
    title: where === "counter" ? "🥜 Snacks for the counter" : "🥜 Snacks for the table",
    subtitle: "On the house",
    view: {
      html,
      onPick: (v) => setOut(Number(v)),
      onKey: gridKeys(() => SNACKS.length, () => st.focus, (i) => { st.focus = i; refresh(); }, setOut),
    },
    items: bowl
      ? [{ label: "Clear the bowl away", button: "secondary" as const, action: () => { g.bowls.delete(key); g.say("You clear the snack bowl away."); closeAll(); } }]
      : [],
  };
}

// ---------------------------------------------------------------------------
// The pie safe: whole pies, a slice at a time. Slices on your tray can go back.

export function openPieSafeScreen(g: Game): void {
  const carried = trayItems(g).filter((i) => i.recipeId === "pie");
  if (!g.pieSafe.length && !carried.length) { g.say("The pie safe is empty. Bake one in the oven, then bring it here."); return; }
  openMenu(pieSpec(g, { focus: 0 }));
}

function pips(left: number, total: number): string {
  return `<span class="pips">${"●".repeat(left)}${"○".repeat(Math.max(0, total - left))}</span>`;
}

function pieSpec(g: Game, st: { focus: number }): MenuSpec {
  const slices = trayItems(g).filter((i) => i.recipeId === "pie" && !i.whole);
  const wholes = trayItems(g).filter((i) => i.recipeId === "pie" && i.whole);
  const room = trayRoomFor(g, "food");
  // One list for the keyboard: whole pies to put away, then pies in the safe, then slices you could put back.
  const picks = [...wholes.map((w) => `store:${w.id}`), ...g.pieSafe.map((p) => `take:${p.id}`), ...slices.map((s) => `back:${s.id}`)];
  st.focus = Math.min(st.focus, Math.max(0, picks.length - 1));
  const refresh = () => {
    if (!g.pieSafe.length && !trayItems(g).some((i) => i.recipeId === "pie")) { closeAll(); return; }
    replaceMenu(pieSpec(g, st));
  };
  const use = (v: string) => {
    const [what, id] = v.split(":");
    const it = trayItems(g).find((i) => i.id === Number(id));
    if (what === "take") takeSlice(g, Number(id));
    else if (what === "store") { if (it) storePie(g, it); }
    else if (it) returnSlice(g, it);
    refresh();
  };
  const store: CardSpec[] = wholes.map((w, i) => ({
    pick: `store:${w.id}`,
    icon: "🥧",
    name: w.name,
    note: `${pips(w.whole ?? 0, w.whole ?? 0)}<br>whole, from the oven: put it away`,
    tags: w.tags,
    off: g.pieSafe.length >= g.pieSafeCapacity,
    focus: i === st.focus,
  }));
  const pies: CardSpec[] = g.pieSafe.map((p, i0) => { const i = wholes.length + i0;
    const old = g.day - p.bakedDay >= 1;
    return {
      pick: `take:${p.id}`,
      icon: "🥧",
      name: p.item.name.replace(/^Day-old (\w)/, (_m, c: string) => c.toUpperCase()),
      note: `${pips(p.left, p.total)}<br>${p.left} of ${p.total} slices${old ? " · day-old" : ""}`,
      tags: p.item.tags,
      off: !room,
      focus: i === st.focus,
    };
  });
  const back: CardSpec[] = slices.map((s, i) => ({
    pick: `back:${s.id}`,
    icon: "↩️",
    name: s.name,
    note: s.ticketName ? `was for ${s.ticketName}` : "put it back",
    focus: wholes.length + g.pieSafe.length + i === st.focus,
  }));
  const html = `
    <p class="blurb">Pies keep here for the day they're baked. Tomorrow they're day-old; the day after, they go to the hens.</p>
    ${store.length ? `<div class="need">${g.pieSafe.length >= g.pieSafeCapacity ? "The pie safe is full." : "From the oven (pick to put away):"}</div><div class="cards">${store.map(card).join("")}</div>` : ""}
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
