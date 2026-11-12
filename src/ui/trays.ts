// Card screens for what's on your trays: garnishing a drink, offering something unasked, the scrap bin,
// the kitchen hatch, and choosing which tray to set down. Same look and handling as cooking (cards.ts).

import { GARNISHES } from "../data.js";
import type { Game, Item, Patron } from "../game.js";
import {
  applyGarnish, garnishableDrinks, iconFor, pickupFromHatch, removeFromTray, serveUnasked, setTrayDown, takeFromHatch, trayItems,
} from "../serving.js";
import { closeAll, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { chip, grid, gridKeys, type CardSpec } from "./cards.js";

/** A dish or drink as a card. */
function itemCard(it: Item, pick: string, focus: boolean, extra: Partial<CardSpec> = {}): CardSpec {
  return {
    pick,
    icon: iconFor(it.recipeId, it.garnish) || "🍽",
    name: it.name,
    tags: it.tags,
    note: it.ticketName ? `for ${it.ticketName}` : undefined,
    focus,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Garnish: choose the drink (if there's more than one), choose the garnish, see what it becomes.

export function openGarnishScreen(g: Game): void {
  if (!garnishableDrinks(g).length) { g.say("No ungarnished drinks on your trays."); return; }
  openMenu(garnishSpec(g, { drink: 0, garnish: -1, focus: 0 }));
}

interface GarnishState { drink: number; garnish: number; focus: number }

function garnishSpec(g: Game, st: GarnishState): MenuSpec {
  const drinks = garnishableDrinks(g);
  st.drink = Math.min(st.drink, drinks.length - 1);
  const drink = drinks[st.drink];
  const refresh = () => replaceMenu(garnishSpec(g, st));
  // One list for the keyboard: the drinks (when there's a choice), then the garnishes.
  const showDrinks = drinks.length > 1;
  const picks = [...(showDrinks ? drinks.map((_, i) => `d:${i}`) : []), ...GARNISHES.map((_, i) => `g:${i}`)];
  const use = (v: string) => {
    const [k, n] = v.split(":");
    if (k === "d") st.drink = Number(n);
    else st.garnish = st.garnish === Number(n) ? -1 : Number(n);
    st.focus = Math.max(0, picks.indexOf(v));
    refresh();
  };
  const gar = GARNISHES[st.garnish];
  const after = gar ? [...new Set([...drink.tags, ...gar.tags])] : drink.tags;
  const go = () => {
    if (!gar) return;
    applyGarnish(g, drink, gar.id);
    closeAll();
  };
  const drinkCards = drinks.map((d, i) => itemCard(d, `d:${i}`, picks[st.focus] === `d:${i}`, { on: i === st.drink }));
  const garnishCards: CardSpec[] = GARNISHES.map((x, i) => ({
    pick: `g:${i}`, icon: x.icon, name: x.name, tags: x.tags, on: i === st.garnish, focus: picks[st.focus] === `g:${i}`,
  }));
  const html = `
    <p class="blurb">A little something on the rim. It changes how a drink lands, for better or worse.</p>
    ${showDrinks ? `<div class="need">Which drink?</div>${grid(drinkCards)}<div class="need" style="margin-top:12px">With what?</div>` : `<div class="need">With what?</div>`}
    ${grid(garnishCards)}
    <div class="dish ${gar ? "" : "empty"}">
      <span class="ic">${iconFor(drink.recipeId, gar?.id)}</span>
      <div>
        <div class="nm">${gar ? `${drink.name} with ${gar.name.toLowerCase()}` : drink.name}</div>
        <div class="chips">${after.map((t) => chip(t, !drink.tags.includes(t))).join("")}</div>
        ${drink.ticketName ? `<div class="for">For <b>${drink.ticketName}</b>.</div>` : ""}
      </div>
    </div>`;
  return {
    title: "🍋 Garnish a drink",
    subtitle: "At the counter",
    view: {
      html,
      onPick: use,
      onKey: (e) => {
        if (e.key === "Enter") { go(); return true; }
        return gridKeys(() => picks.length, () => st.focus, (i) => { st.focus = i; refresh(); }, (i) => use(picks[i]))(e);
      },
    },
    items: [{ label: "Garnish it", button: "primary", disabled: !gar, action: go }],
  };
}

// ---------------------------------------------------------------------------
// Offer something unasked (the 🃏 card): pick what to give.

export function openOfferScreen(g: Game, p: Patron): void {
  const st = { focus: 0 };
  const build = (): MenuSpec => {
    const items = trayItems(g);
    const give = (i: number) => { const it = items[i]; if (!it) return; closeAll(); serveUnasked(g, p, it); };
    return {
      title: `🃏 Something for ${p.name}?`,
      subtitle: "Unasked",
      view: {
        html: `<p class="blurb">They didn't order it, so it won't count as their order. It's just a gift, and it might be exactly what they needed.</p>
          ${grid(items.map((it, i) => itemCard(it, String(i), i === st.focus)))}`,
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

export function openBinScreen(g: Game): void {
  if (!trayItems(g).length) { g.say("Nothing on your trays to throw away."); return; }
  const st = { focus: 0 };
  const build = (): MenuSpec => {
    const items = trayItems(g);
    st.focus = Math.min(st.focus, Math.max(0, items.length - 1));
    const toss = (i: number) => {
      const it = items[i];
      if (!it) return;
      removeFromTray(g, it);
      g.say(`${it.name} goes in the bin.`);
      if (trayItems(g).length) replaceMenu(build()); else closeAll();
    };
    return {
      title: "🗑️ Scrap bin",
      subtitle: "For the hens",
      view: {
        html: `<p class="blurb">Nothing's wasted here: what goes in the bin goes to the hens.</p>
          <div class="need">Pick what to throw away:</div>${grid(items.map((it, i) => itemCard(it, String(i), i === st.focus)))}`,
        onPick: (v) => toss(Number(v)),
        onKey: gridKeys(() => items.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, toss),
      },
      items: [{
        label: "Everything on your trays", sub: `${items.length} item${items.length === 1 ? "" : "s"}`, button: "secondary",
        action: () => { for (const it of trayItems(g)) removeFromTray(g, it); g.say("You scrape your trays clean."); closeAll(); },
      }],
    };
  };
  openMenu(build());
}

// ---------------------------------------------------------------------------
// The kitchen hatch (for a hired cook, later): pick what to take.

export function openHatchScreen(g: Game): void {
  if (!g.hatch.length) { g.say("The hatch is empty."); return; }
  const st = { focus: 0 };
  const build = (): MenuSpec => {
    st.focus = Math.min(st.focus, Math.max(0, g.hatch.length - 1));
    const take = (i: number) => {
      const it = g.hatch[i];
      if (!it) return;
      takeFromHatch(g, it);
      if (g.hatch.length) replaceMenu(build()); else closeAll();
    };
    return {
      title: "🪟 Kitchen hatch",
      view: {
        html: `<div class="need">Pick a dish to take:</div>${grid(g.hatch.map((it, i) => itemCard(it, String(i), i === st.focus)))}`,
        onPick: (v) => take(Number(v)),
        onKey: gridKeys(() => g.hatch.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, take),
      },
      items: [{ label: "Take everything that fits", sub: "oldest first", button: "primary", action: () => { pickupFromHatch(g); closeAll(); } }],
    };
  };
  openMenu(build());
}

// ---------------------------------------------------------------------------
// Set a tray down: which one?

export function openSetDownScreen(g: Game): void {
  const st = { focus: 0 };
  const build = (): MenuSpec => {
    const put = (i: number) => { closeAll(); setTrayDown(g, i as 0 | 1); };
    const cards: CardSpec[] = g.keeper.trays.map((t, i) => ({
      pick: String(i),
      icon: t.items.map((x) => iconFor(x.recipeId, x.garnish) || "🍽").join(""),
      name: i === 0 ? "Left tray" : "Right tray",
      note: t.items.map((x) => x.name).join(", "),
      focus: i === st.focus,
    }));
    return {
      title: "Set down which tray?",
      view: {
        html: `<p class="blurb">On the counter or a nearby table, to free your hands. On a table where people are waiting, you can serve them all from it.</p>${grid(cards)}`,
        onPick: (v) => put(Number(v)),
        onKey: gridKeys(() => 2, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, put),
      },
      items: [],
    };
  };
  openMenu(build());
}

