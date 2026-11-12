// What happens when the keeper interacts with something. Menus live here.

import { organic } from "./core.js";
import { GARNISHES, INGREDIENTS, RECIPES, REGULARS, SNACKS, TUNING, UPGRADES, type Recipe } from "./data.js";
import type { Game, Patron, SetDownTray, Spill } from "./game.js";
import { dist, type Furniture } from "./world.js";
import { recipesFor, returnSlice, startJob, makeItem, serveFromPot, takeSlice, ticketFor } from "./crafting.js";
import { tableKey } from "./patrons.js";
import { applyGarnish, removeFromTray, servePatron, serveTable, garnishableDrinks, iconFor, itemLabel, serveUnasked, trayItems, pickupFromHatch, pickUpTray, startPour, setTrayDown, takeFromHatch } from "./serving.js";
import { endDay, startNextDay, toggleInn } from "./day.js";
import { closeAll, openMenu, replaceMenu, back } from "./ui/menu.js";

export type Target =
  | { type: "furniture"; f: Furniture }
  | { type: "patron"; p: Patron }
  | { type: "spill"; s: Spill }
  | { type: "tray"; t: SetDownTray };

export function targetId(t: Target | null): string | null {
  if (!t) return null;
  if (t.type === "furniture") return t.f.id;
  if (t.type === "spill") return `spill:${t.s.id}`;
  if (t.type === "tray") return `tray:${t.t.id}`;
  return `patron:${t.p.id}`;
}

export function targetName(t: Target): string {
  return t.type === "furniture" ? t.f.name : t.type === "spill" ? "Spill" : t.type === "tray" ? "Tray" : t.p.name;
}

/** How many people at this table are waiting on an order. */
export function waitingAt(g: Game, key: string): number {
  const t = g.world.tables.find((x) => x.key === key);
  return t ? t.chairs.filter((c) => g.patron(c.occupant)?.state === "waiting").length : 0;
}

export function tableDirt(g: Game, f: Furniture): number {
  return g.dirt.get(tableKey(f.tiles[0])) ?? 0;
}

/** Is this something that holding Space would clean? */
export function cleanable(g: Game, t: Target | null): boolean {
  if (!t) return false;
  if (t.type === "spill") return true;
  return t.type === "furniture" && t.f.kind === "table" && tableDirt(g, t.f) > 0.3 && !waitingAt(g, `${t.f.tiles[0].x},${t.f.tiles[0].y}`);
}

/** Called every frame while Space is held on something cleanable. Real seconds. */
export function cleanStep(g: Game, t: Target, realDt: number): void {
  const id = targetId(t)!;
  if (!g.cleaning || g.cleaning.targetId !== id) g.cleaning = { targetId: id, progress: 0, total: Math.max(0.8, organic(TUNING.cleanSeconds)) };
  g.cleaning.progress += realDt;
  if (g.cleaning.progress >= g.cleaning.total) {
    if (t.type === "spill") g.spills = g.spills.filter((s) => s.id !== t.s.id);
    else if (t.type === "furniture") g.dirt.set(tableKey(t.f.tiles[0]), 0);
    g.stats.cleaned++;
    g.say(t.type === "spill" ? "Mopped up." : "Table wiped clean.");
    g.cleaning = null;
  }
}

const FURNITURE_RANGE = 1.45;
const PATRON_RANGE = 2.3; // reaches across the counter

/** The thing the keeper would interact with right now, preferring what they face. */
export function findTarget(g: Game): Target | null {
  const k = g.keeper;
  let best: { t: Target; s: number } | null = null;
  const consider = (t: Target, pos: { x: number; y: number }, range: number) => {
    const d = dist(k.pos, pos);
    if (d > range) return;
    const dx = pos.x - k.pos.x, dy = pos.y - k.pos.y;
    const facing = d > 0.01 ? (dx * k.facing.x + dy * k.facing.y) / d : 1;
    const s = d - facing * 0.6;
    if (!best || s < best.s) best = { t, s };
  };
  for (const f of g.world.furniture) {
    // Distance to the nearest tile of the piece, not its centre.
    let near = f.tiles[0];
    let nd = Infinity;
    for (const t of f.tiles) {
      const d = dist(k.pos, { x: t.x + 0.5, y: t.y + 0.5 });
      if (d < nd) { nd = d; near = t; }
    }
    consider({ type: "furniture", f }, { x: near.x + 0.5, y: near.y + 0.5 }, FURNITURE_RANGE);
  }
  for (const p of g.patrons) {
    if (p.state === "entering" || p.state === "leaving") continue;
    consider({ type: "patron", p }, p.pos, PATRON_RANGE);
  }
  for (const s of g.spills) consider({ type: "spill", s }, { x: s.x + 0.5, y: s.y + 0.5 }, 1.1);
  // Set-down trays win over the table or counter they sit on.
  for (const t of g.setDown) consider({ type: "tray", t }, { x: t.x + 0.45, y: t.y + 0.45 }, 1.5);
  return best ? (best as { t: Target }).t : null;
}

export function promptFor(g: Game, t: Target | null): string {
  if (!t) return "";
  if (t.type === "tray") {
    const table = g.world.tableAt(t.t.x, t.t.y);
    const n = table ? waitingAt(g, table.key) : 0;
    if (n) return `Space: serve the table from this tray (${n} waiting)`;
    return `Space: pick up the tray (${t.t.tray.items.map((i) => i.name).join(", ")})`;
  }
  if (t.type === "spill") return g.cleaning ? `Mopping… ${Math.floor((g.cleaning.progress / g.cleaning.total) * 100)}%` : "Hold Space: mop up the spill";
  if (t.type === "patron") {
    const o = g.order(t.p.orderId);
    const seat = g.world.seats.find((x) => x.id === t.p.seatId);
    const n = seat?.table ? waitingAt(g, `${seat.table.x},${seat.table.y}`) : 0;
    if (n > 1) return `Space: serve the table (${n} waiting) · C: offer something unasked`;
    return o?.open ? `Space: serve ${t.p.name} (${o.label}) · C: offer something unasked` : `${t.p.name} · C: offer something unasked`;
  }
  const f = t.f;
  const job = g.jobs.get(f.id);
  const pot = g.pots.get(f.id);
  switch (f.kind) {
    case "table": {
      const tk = `${f.tiles[0].x},${f.tiles[0].y}`;
      const n = waitingAt(g, tk);
      if (n) return `Space: serve the table (${n} waiting)`;
      const bowl = g.bowls.get(tk);
      if (tableDirt(g, f) <= 0.3) return bowl ? (bowl.left < 0.15 ? "Space: refill or clear the snack bowl" : "Space: swap or clear the snack bowl") : "Space: set out snacks";
      const d = tableDirt(g, f);
      if (d <= 0.3) return "A clean table";
      if (g.cleaning) return `Wiping… ${Math.floor((g.cleaning.progress / g.cleaning.total) * 100)}%`;
      return d >= TUNING.tableDirtyAt ? "Hold Space: wipe the dirty table" : "Hold Space: wipe the table";
    }
    case "station":
      if (pot && g.pouring && g.pouring.from === f.id) return `Pouring… ${Math.round((g.pouring.progress / g.pouring.total) * 100)}%`;
      if (pot) return `Space: ${pot.item.kind === "drink" ? "pour a cup of" : "take a serving of"} ${pot.item.name.toLowerCase()} (${pot.left} left)`;
      if (job) {
        const r = RECIPES.find((x) => x.id === job.recipeId)!;
        return job.done ? `${r.name} ready, waiting for room (${r.storedIn === "piesafe" ? "pie safe" : "hatch"} full)` : `${r.name} ${Math.floor((job.progress / job.total) * 100)}% · hold Space to hurry`;
      }
      return `Space: cook at the ${f.name.toLowerCase()}`;
    case "bin": return trayItems(g).length ? "Space: throw something away" : "Scrap bin";
    case "piesafe": return g.pieSafe.length ? `Space: take a slice (${g.pieSafe.map((p) => p.left).reduce((a, b) => a + b, 0)} slices)` : "The pie safe is empty";
    case "hatch": return g.hatch.length ? `Space: choose from the hatch (${g.hatch.length})` : "The hatch is empty";
    case "tap": if (g.pouring) return `Pouring… ${Math.round((g.pouring.progress / g.pouring.total) * 100)}%`;
      return `Space: pour ${RECIPES.find((r) => r.id === f.tap)?.name.toLowerCase()}`;
    case "garnish": return "Space or E: garnish a drink";
    case "frontdoor": return g.open ? (g.lastCall ? "Space: bolt the door" : "Space: call last orders") : "Space: open the inn";
    case "fireplace": return g.fireLit ? "Space: put out the fire" : "Space: light the fire";
    case "bed": return "Space: turn in";
    case "desk": return "Space: bill of fare, upgrades, journal";
    default: return `Space: ${f.name.toLowerCase()}`;
  }
}

export function interact(g: Game, t: Target | null): void {
  if (!t) return;
  if (t.type === "spill") return; // cleaning is a hold, handled each frame
  if (t.type === "tray") {
    // A tray on a table where people are waiting: serve them from it. Otherwise pick it up.
    const table = g.world.tableAt(t.t.x, t.t.y);
    if (table && waitingAt(g, table.key)) { serveTable(g, table.key); return; }
    pickUpTray(g, t.t);
    return;
  }
  if (t.type === "patron") { servePatron(g, t.p); return; }
  const f = t.f;
  switch (f.kind) {
    case "table": {
      const key = `${f.tiles[0].x},${f.tiles[0].y}`;
      if (waitingAt(g, key)) { serveTable(g, key); return; }
      if (tableDirt(g, f) > 0.3) return; // holding Space cleans (handled each frame)
      openSnackMenu(g, key);
      return;
    }
    case "station": {
      if (g.pots.has(f.id)) {
        if (g.pots.get(f.id)!.item.kind === "drink") startPour(g, f.id); // a cup from the urn takes pouring
        else serveFromPot(g, f.id);
        return;
      }
      const job = g.jobs.get(f.id);
      if (job) { g.say(job.done ? `It's done, waiting for room in the ${RECIPES.find((x) => x.id === job.recipeId)?.storedIn === "piesafe" ? "pie safe" : "hatch"}.` : "Still cooking. Hold Space here to hurry it a little."); return; }
      openCraftMenu(g, f);
      return;
    }
    case "hatch": openHatchMenu(g); return;
    case "piesafe": openPieSafe(g); return;
    case "bin": openBin(g); return;
    case "tap": startPour(g, `tap:${f.tap}`, f.tap); return;
    case "garnish": openGarnishMenu(g); return;
    case "frontdoor": toggleInn(g); return;
    case "fireplace":
      g.fireLit = !g.fireLit;
      g.say(g.fireLit ? "The fire catches and crackles." : "You bank the fire.");
      return;
    case "bed": askTurnIn(g); return;
    case "desk": openDesk(g); return;
    case "wardrobe": g.say("Your good coat, your other coat."); return;
    case "pantry": g.say("Shelves of everything you need. It never runs out (for now)."); return;
    case "coats": g.say("Pegs, waiting for coats."); return;
  }
}

// ---------------------------------------------------------------------------
// Hatch: choose what to take

export function openHatchMenu(g: Game): void {
  if (!g.hatch.length) { g.say("The hatch is empty."); return; }
  const build = () => ({
    title: "Kitchen hatch",
    items: [
      ...g.hatch.map((it) => ({ label: itemLabel(it), sub: it.tags.join(", "), action: () => { takeFromHatch(g, it); g.hatch.length ? replaceMenu(build()) : closeAll(); } })),
      { label: "Take everything that fits", sub: "oldest first", action: () => { pickupFromHatch(g); closeAll(); } },
    ],
  });
  openMenu(build());
}

// ---------------------------------------------------------------------------
// Snack bowls: set out from the table itself. Always optional.

function openSnackMenu(g: Game, key: string): void {
  const bowl = g.bowls.get(key);
  const current = SNACKS.find((x) => x.id === bowl?.snack);
  openMenu({
    title: bowl ? "Snack bowl" : "Set out snacks",
    body: bowl ? `${current?.icon ?? ""} ${current?.name ?? "A bowl"}, ${bowl.left < 0.15 ? "empty" : `${Math.round(bowl.left * 100)}% left`}.` : "Complimentary. Salty ones make people thirsty.",
    items: [
      ...SNACKS.map((sn) => ({
        label: `${sn.icon} ${bowl ? (sn.id === bowl.snack ? "Top up the " : "Swap for ") : ""}${bowl ? sn.name.toLowerCase() : sn.name}`,
        sub: sn.tags.join(", "),
        action: () => {
          closeAll();
          g.bowls.set(key, { snack: sn.id, left: 1 });
          g.say(`You set out a bowl of ${sn.name.toLowerCase()}.`);
        },
      })),
      ...(bowl ? [{ label: "🧹 Clear the bowl away", sub: "", action: () => { closeAll(); g.bowls.delete(key); g.say("You clear the snack bowl away."); } }] : []),
    ],
  });
}

/** The scrap bin: throw away anything on your trays. */
function openBin(g: Game): void {
  const items = trayItems(g);
  if (!items.length) { g.say("Nothing on your trays to throw away."); return; }
  const build = () => {
    const now = trayItems(g);
    return {
      title: "🗑️ Scrap bin",
      body: "Throw something away. It goes to the hens.",
      items: [
        ...now.map((it) => ({ label: `${iconFor(it.recipeId, it.garnish)} ${it.name}`, sub: it.ticketName ? `was for ${it.ticketName}` : "", action: () => { removeFromTray(g, it); g.say(`${it.name} goes in the bin.`); trayItems(g).length ? replaceMenu(build()) : closeAll(); } })),
        { label: "Everything on your trays", sub: `${now.length} item${now.length === 1 ? "" : "s"}`, action: () => { for (const it of trayItems(g)) removeFromTray(g, it); g.say("You scrape your trays clean."); closeAll(); } },
      ],
    };
  };
  openMenu(build());
}

// ---------------------------------------------------------------------------
// The desk: bill of fare, upgrades, journal

export function openDesk(g: Game): void {
  const ready = UPGRADES.filter((u) => !g.upgrades.has(u.id) && g.totalServed >= u.unlockAtServed).length;
  openMenu({
    title: "Desk",
    items: [
      { label: "📜 Bill of fare", sub: `${g.menu.size} on today`, action: () => openBillOfFare(g) },
      { label: "🔧 Upgrades", sub: ready ? `${ready} ready to choose` : `${g.totalServed} served so far`, action: () => openUpgrades(g) },
      { label: "📖 Journal", sub: g.journalUnread ? `${g.journalUnread} new` : "", action: () => openJournal(g) },
    ],
  });
}

export function openBillOfFare(g: Game): void {
  const build = () => ({
    title: "📜 Bill of fare",
    body: "Tick what's on. Patrons only order what's on the board, even if it's run out.",
    items: [
      ...RECIPES.map((r) => ({
        label: `${g.menu.has(r.id) ? "☑" : "☐"} ${r.icon} ${r.name}`,
        sub: r.storedIn === "piesafe" ? "whole pies, sliced" : r.servings ? "by the pot" : r.station === "tap" ? "on tap" : `~${r.minutes[0]} min`,
        action: () => {
          if (g.menu.has(r.id)) g.menu.delete(r.id); else g.menu.add(r.id);
          g.menuChosen = true;
          g.bus.emit({ type: "Paper", what: "menu" });
          replaceMenu(build());
        },
      })),
      { label: "Done", sub: "", action: () => { g.menuChosen = true; back(); } },
    ],
  });
  openMenu(build());
}

function openUpgrades(g: Game): void {
  const build = () => ({
    title: "🔧 Upgrades",
    body: `No coin yet: upgrades open up as you serve more people. Served so far: <b>${g.totalServed}</b>.`,
    items: UPGRADES.map((u) => {
      const have = g.upgrades.has(u.id);
      const open = g.totalServed >= u.unlockAtServed;
      return {
        label: `${have ? "✓" : open ? "＋" : "🔒"} ${u.icon} ${u.name}`,
        sub: have ? "yours" : open ? u.desc : `after ${u.unlockAtServed} served`,
        disabled: have || !open,
        action: () => { g.upgrades.add(u.id); g.say(`${u.icon} ${u.name}: ${u.desc}`); replaceMenu(build()); },
      };
    }),
  });
  openMenu(build());
}

export function openPieSafe(g: Game): void {
  const slices = () => trayItems(g).filter((i) => i.recipeId === "pie");
  if (!g.pieSafe.length && !slices().length) { g.say("The pie safe is empty. Bake one in the oven."); return; }
  const build = () => ({
    title: "Pie safe",
    body: "Pies keep fresh here for the day they're baked.",
    items: [
      ...g.pieSafe.map((p) => ({
        label: `🥧 Take a slice: ${p.item.name}`,
        sub: `${p.left}/${p.total} · ${p.item.tags.join(", ")}`,
        action: () => { takeSlice(g, p.id); refresh(); },
      })),
      ...slices().map((it) => ({
        label: `↩ Put back: ${it.name}`,
        sub: it.ticketName ? `was for ${it.ticketName}` : "",
        action: () => { returnSlice(g, it); refresh(); },
      })),
    ],
  });
  const refresh = () => (g.pieSafe.length || slices().length ? replaceMenu(build()) : closeAll());
  openMenu(build());
}

/** The unasked-serve card (C). In this build it's always in hand and never spent. */
export function offerUnasked(g: Game, t: Target | null): void {
  if (t?.type !== "patron") { g.say("🃏 Stand next to someone to offer them something unasked."); return; }
  const p = t.p;
  if (p.state === "entering" || p.state === "leaving") return;
  const items = trayItems(g);
  if (!items.length) { g.say("🃏 You've nothing on your trays to offer."); return; }
  openMenu({
    title: `🃏 Offer ${p.name} something unasked`,
    body: "They didn't order it, so it won't count as their order. It's just a gift.",
    items: items.map((it) => ({
      label: `${iconFor(it.recipeId, it.garnish)} ${it.name}`,
      sub: it.tags.join(", "),
      action: () => { closeAll(); serveUnasked(g, p, it); },
    })),
  });
}

/** Q: set a tray down on the counter or a table. */
export function askSetDown(g: Game): void {
  const [a, b] = g.keeper.trays;
  if (!a.items.length && !b.items.length) { g.say("Your trays are empty."); return; }
  if (!a.items.length) { setTrayDown(g, 1); return; }
  if (!b.items.length) { setTrayDown(g, 0); return; }
  const desc = (i: 0 | 1) => g.keeper.trays[i].items.map((x) => x.name).join(", ");
  openMenu({
    title: "Set down which tray?",
    items: [
      { label: "Left tray", sub: desc(0), action: () => { closeAll(); setTrayDown(g, 0); } },
      { label: "Right tray", sub: desc(1), action: () => { closeAll(); setTrayDown(g, 1); } },
    ],
  });
}

// ---------------------------------------------------------------------------
// Crafting menus

function openCraftMenu(g: Game, f: Furniture): void {
  const recipes = recipesFor(g, f);
  openMenu({
    title: f.name,
    items: recipes.map((r) => ({
      label: `${r.icon} ${r.name}`,
      sub: `${r.servings ? `about ${r.servings[0]} servings · ` : ""}${r.baseTags.join(", ")} · ~${r.minutes[0]} min${r.tended ? " · tended" : ""}`,
      action: () => chooseIngredients(g, f, r, []),
    })),
  });
}

function chooseIngredients(g: Game, f: Furniture, r: Recipe, chosen: string[]): void {
  if (chosen.length >= r.slots) { confirmCraft(g, f, r, chosen); return; }
  const spec = {
    title: `${r.name}: ingredient ${chosen.length + 1} of ${r.slots}`,
    body: chosen.length ? `So far: ${chosen.map((id) => INGREDIENTS.find((i) => i.id === id)!.name).join(", ")}` : undefined,
    items: r.options.map((id) => {
      const ing = INGREDIENTS.find((i) => i.id === id)!;
      return {
        label: ing.name,
        sub: ing.tags.join(", "),
        disabled: chosen.includes(id),
        action: () => chooseIngredients(g, f, r, [...chosen, id]),
      };
    }),
  };
  openMenu(spec);
}

function confirmCraft(g: Game, f: Furniture, base: Recipe, chosen: string[]): void {
  const r = base;
  const preview = makeItem(r, chosen);
  const ticket = ticketFor(g, r);
  const forLine = r.storedIn === "piesafe"
    ? `A whole pie: about ${r.servings?.[0] ?? 6} slices. It goes into the pie safe behind the counter.`
    : r.servings
    ? `A batch: about ${r.servings[0]} servings, served straight from the ${f.name.toLowerCase()}.`
    : ticket ? `For <b>${ticket.name}</b> (their order is the oldest one for this).` : "Nobody has ordered this yet: it'll go to whoever asks first.";
  openMenu({
    title: `Make ${preview.name}?`,
    body: `Tags: <b>${preview.tags.join(", ")}</b><br>About ${r.minutes[0]} minutes${r.tended ? ", and it needs you at the station" : ""}.<br>${forLine}`,
    items: [
      { label: "Make it", action: () => { startJob(g, f, r, chosen, ticket); closeAll(); } },
      ...(ticket ? [{ label: "Make it for nobody in particular", action: () => { startJob(g, f, r, chosen, null); closeAll(); } }] : []),
      { label: "Back", action: () => back() },
    ],
  });
}

// ---------------------------------------------------------------------------
// Journal: what happened, never the answer.

export function openJournal(g: Game): void {
  g.journalUnread = 0;
  const known = REGULARS.filter((d) => (g.regulars.get(d.id)?.visits ?? 0) > 0);
  openMenu({
    title: "Journal",
    body: known.length ? undefined : "Nobody you know yet. Regulars will turn up over the days.",
    items: [
      ...known.map((d) => {
        const st = g.regulars.get(d.id)!;
        return { label: d.name, sub: `${st.visits} visit${st.visits === 1 ? "" : "s"}`, action: () => journalPage(g, d.id) };
      }),
      { label: "Passing visitors", sub: `${g.visitorNotes.length} notes`, action: () => visitorPage(g) },
    ],
  });
}

function journalPage(g: Game, id: string): void {
  const d = REGULARS.find((x) => x.id === id)!;
  const st = g.regulars.get(id)!;
  const entries = st.journal.slice(-40).reverse();
  openMenu({
    title: d.name,
    body: `<div class="journal"><i>${d.blurb}</i>${entries.map((e) => `<div class="je ${e.kind ?? ""}"><span class="t">Day ${e.day} ${e.time}</span> ${e.text}</div>`).join("") || `<div class="muted">No notes yet. Serve them something.</div>`}</div>`,
    items: [{ label: "Back", action: () => back() }],
  });
}

function visitorPage(g: Game): void {
  const entries = g.visitorNotes.slice(-30).reverse();
  openMenu({
    title: "Passing visitors",
    body: `<div class="journal">${entries.map((e) => `<div class="je ${e.kind ?? ""}"><span class="t">Day ${e.day} ${e.time}</span> ${e.text}</div>`).join("") || "Nothing yet."}</div>`,
    items: [{ label: "Back", action: () => back() }],
  });
}

// ---------------------------------------------------------------------------
// Garnish menus (drinks only)

export function openGarnishMenu(g: Game): void {
  const drinks = garnishableDrinks(g);
  if (!drinks.length) { g.say("No ungarnished drinks on your trays."); return; }
  const chooseGarnish = (itemIndex: number) => {
    const item = drinks[itemIndex];
    openMenu({
      title: `Garnish ${item.name}`,
      items: GARNISHES.map((gar) => ({
        label: `${gar.icon} ${gar.name}`,
        sub: gar.tags.join(", "),
        action: () => {
          replaceMenu({
            title: `${item.name} + ${gar.name.toLowerCase()}?`,
            body: `Tags after: <b>${[...new Set([...item.tags, ...gar.tags])].join(", ")}</b>`,
            items: [
              { label: "Garnish it", action: () => { applyGarnish(g, item, gar.id); closeAll(); } },
              { label: "Back", action: () => back() },
            ],
          });
        },
      })),
    });
  };
  if (drinks.length === 1) { chooseGarnish(0); return; }
  openMenu({
    title: "Which drink?",
    items: drinks.map((d, i) => ({ label: `${iconFor(d.recipeId, d.garnish)} ${d.name}`, sub: d.tags.join(", "), action: () => chooseGarnish(i) })),
  });
}

// ---------------------------------------------------------------------------
// Turning in

export function askTurnIn(g: Game): void {
  openMenu({
    title: "Turn in?",
    modal: true,
    items: [
      { label: "OK", action: () => { closeAll(); goToSleep(g); } },
      { label: "Cancel", action: () => closeAll() },
    ],
  });
}

export function forcedTurnIn(g: Game): void {
  openMenu({
    title: "“I should turn in…”",
    modal: true,
    items: [{ label: "OK", action: () => { closeAll(); goToSleep(g); } }],
  });
}

function goToSleep(g: Game): void {
  const fade = document.getElementById("fade")!;
  g.modal = true;
  fade.classList.add("on");
  setTimeout(() => {
    const s = endDay(g);
    const o = s.outcomes;
    const row = (k: string, v: number | string) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    openMenu({
      title: `End of day ${s.day}`,
      modal: true,
      body: `<table class="summary">
        ${row("Patrons", s.arrivals)}
        ${row("Served", s.served)}
        ${row("Delight", o.DELIGHT)}
        ${row("Pleased", o.PLEASED)}
        ${row("Fulfilled", o.FULFILLED)}
        ${row("Unfinished", o.UNFINISHED)}
        ${row("Complaints", o.COMPLAINS)}
        ${row("Left early", s.leftEarly)}
        ${row("Left without being served", s.leftUnserved)}
        ${row("Crafted / garnished", `${s.crafted} / ${s.garnished}`)}
        ${row("Cleaned up", s.cleaned)}
      </table>${s.moments.length ? `<div class="moments">${s.moments.map((m) => `<div>✦ ${m}</div>`).join("")}</div>` : ""}`,
      items: [{
        label: `Wake up: day ${s.day + 1}`,
        action: () => {
          closeAll();
          startNextDay(g);
          fade.classList.remove("on");
        },
      }],
    });
  }, 900);
}
