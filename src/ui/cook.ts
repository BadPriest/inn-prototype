// Cooking at a station, on one template (docs/specs/ui.md):
//   choose a recipe   cards: time, who's waiting, on the board or not, tags; the drawer says how it's made
//   build the dish    a result panel pinned on top (the dish as it will come out, new tags lit), then the
//                     ingredient cards, then one main button saying what happens and for whom
//   steep tea         the same panel and cards; picking a leaf pours the cup
// Click an ingredient to add it, again to take it out.

import { amount, describeUses, have, shortOf, usesOf } from "../stock.js";
import { INGREDIENTS, RECIPES, type Recipe } from "../data.js";
import { startPour } from "../serving.js";
import type { Game } from "../game.js";
import type { Slot } from "../world.js";
import { makeItem, recipesFor, slotName, startJob, ticketFor } from "../crafting.js";
import { back, closeAll, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { hasBackSpots, manageStoveSpec, stoveTabs } from "./stove.js";
import { chip, grid, gridKeys, type CardSpec } from "./cards.js";

interface CookState { base: string[]; optional: string[]; focus: number }

const ingName = (id: string) => INGREDIENTS.find((x) => x.id === id)?.name.toLowerCase() ?? id;
/** What always goes in: "water, salt". */
const alwaysIn = (r: Recipe) => r.fundamental.map((u) => ingName(u.id)).join(", ");

/** What a dish takes, and how much of each is in the pantry: what always goes in, then the choices. */
export function ingredientsHtml(g: Game, r: Recipe): string {
  const one = (id: string, units: number) => {
    const ing = INGREDIENTS.find((x) => x.id === id);
    const left = have(g, id);
    const short = left !== Infinity && left < units;
    return `<span class="ing${short ? " short" : ""}">${ing?.icon ?? ""} ${ing?.name.toLowerCase() ?? id}${left === Infinity ? "" : ` <small>${amount(id, left)}</small>`}</span>`;
  };
  const part = ([lo, hi]: [number, number]) => (lo === hi ? `choose ${lo}` : lo === 0 ? `up to ${hi}` : `${lo} to ${hi}`);
  const rows = [
    r.fundamental.length ? `<div><b>Always in it:</b> ${r.fundamental.map((u) => one(u.id, u.units)).join(", ")}</div>` : "",
    r.base.pick[1] > 0 ? `<div><b>Base</b> (${part(r.base.pick)}): ${r.base.options.map((o) => one(o.id, o.units)).join(", ")}</div>` : "",
    r.optional.pick[1] > 0 ? `<div><b>Extras</b> (${part(r.optional.pick)}): ${r.optional.options.map((o) => one(o.id, o.units)).join(", ")}</div>` : "",
  ].filter(Boolean);
  if (!rows.length && r.boughtAs) rows.push(`<div><b>Bought in:</b> ${one(r.boughtAs, 1)}</div>`);
  return rows.length ? `<div class="ings">${rows.join("")}</div>` : "";
}

/** The base choices as icons, for a card's face. */
export const baseIcons = (r: Recipe): string => r.base.options.map((o) => INGREDIENTS.find((x) => x.id === o.id)?.icon ?? "").join("");

/** The panel at the top of a crafting screen: what you'll get. */
export function resultPanel(o: { icon: string; name: string; tags: string[]; lit?: string[]; meta: string; forWho?: string; empty?: boolean }): string {
  return `<div class="dish result ${o.empty ? "empty" : ""}">
      <span class="ic">${o.icon}</span>
      <div class="dish-body">
        <div class="nm">${o.name}</div>
        <div class="chips">${o.tags.map((t) => chip(t, !!o.lit?.includes(t))).join("")}</div>
        <div class="meta">${o.meta}</div>
        ${o.forWho ? `<div class="for">${o.forWho}</div>` : ""}
      </div>
    </div>`;
}

/** How long, and whether you have to stay. */
const timeOf = (r: Recipe) => `~${Math.round(r.minutes[0])} min${r.tended ? ", stay with it" : ""}`;
/** What one go makes. */
function makesOf(r: Recipe, f: Slot): string {
  if (r.storedIn === "piesafe") return `A whole pie, ~${r.servings?.[0] ?? 6} slices, for the pie safe`;
  if (r.id === "water") return `Hot water for ~${r.servings?.[0] ?? 3} cups, each steeped with its own leaf`;
  if (r.servings) return `A batch of ~${r.servings[0]} servings, served from the ${slotName(f)}`;
  return "One serving, waiting here when it's done";
}

// ---------------------------------------------------------------------------
// Choose what to make

let recipeTab: "dishes" | "snacks" = "dishes";

export function openRecipeScreen(g: Game, slot: Slot): void {
  const recipes = recipesFor(g, slot);
  const waiting = (r: Recipe) => g.orders.filter((o) => o.open && o.recipeId === r.id).length;
  const hasSnacks = recipes.some((r) => r.tableSnack) && recipes.some((r) => !r.tableSnack);
  if (!hasSnacks) recipeTab = recipes.some((r) => !r.tableSnack) ? "dishes" : "snacks";
  const manage = hasBackSpots(slot.f);
  if (recipes.length === 1 && !manage) { openCookScreen(g, slot, recipes[0]); return; }
  const st = { focus: 0 };
  const own = hasSnacks ? [{ id: "dishes", name: "🍲 Dishes" }, { id: "snacks", name: "🥜 Table snacks" }] : [{ id: "cook", name: "🔥 Cook" }];
  const order = [...own.map((t) => t.id), "manage"];
  /** Back from Manage stove: the stove may have changed, so the screen opens afresh on that tab. */
  const leave = (tab: string) => {
    if (tab === "dishes" || tab === "snacks") recipeTab = tab;
    back();
    const fresh = g.world.furniture.flatMap((x) => x.slots ?? []).find((s) => s.id === slot.id);
    if (fresh) openRecipeScreen(g, fresh);
  };
  const showManage = () => { g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); replaceMenu(manageStoveSpec(g, slot.f.id, stoveTabs(own, "manage"), order, leave)); };
  const build = (): MenuSpec => {
    // What guests are waiting for comes first.
    const list = recipes.filter((r) => !!r.tableSnack === (recipeTab === "snacks")).sort((a, b) => waiting(b) - waiting(a));
    const switchTab = () => { recipeTab = recipeTab === "dishes" ? "snacks" : "dishes"; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); replaceMenu(build()); };
    const tabs = manage ? stoveTabs(own, hasSnacks ? recipeTab : "cook") : hasSnacks ? `<div class="bf-tabs">${(["dishes", "snacks"] as const).map((t) => `<button class="${recipeTab === t ? "on" : ""}" data-pick="tab:${t}">${t === "dishes" ? "🍲 Dishes" : "🥜 Table snacks"}</button>`).join("")}</div>` : undefined;
    const cards: CardSpec[] = list.map((r, i) => {
      const n = waiting(r);
      const onBoard = g.billNow().has(r.id);
      return {
        pick: String(i), icon: r.icon, name: r.name, focus: i === st.focus,
        fact: `${timeOf(r)}${r.base.options.length ? ` · ${baseIcons(r)}` : ""}`,
        status: n ? `${n} waiting` : r.internal ? "" : r.tableSnack ? "for the tables" : onBoard ? "on the board" : "not on the board",
        tone: n ? "good" : onBoard || r.internal || r.tableSnack ? undefined : "muted",
        tags: r.baseTags,
        detail: `${makesOf(r, slot)}.${ingredientsHtml(g, r)}`,
        flavour: r.blurb,
        does: "Choose its ingredients",
      };
    });
    const pick = (i: number) => { const r = list[i]; if (r) openCookScreen(g, slot, r); };
    return {
      title: `${slot.f.name}${(slot.f.slots?.length ?? 1) > 1 ? `: ${slot.name.toLowerCase()}` : ""}`,
      subtitle: "What will you make?",
      view: {
        pinned: tabs,
        html: grid(cards),
        onPick: (v) => {
          if (v === "tab:manage") { showManage(); return; }
          if (v.startsWith("tab:")) { if (hasSnacks && v.slice(4) !== recipeTab) switchTab(); return; }
          pick(Number(v));
        },
        onKey: (e) => {
          if (manage && e.key === "Tab") {
            e.preventDefault();
            const i = order.indexOf(hasSnacks ? recipeTab : "cook");
            const next = order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length];
            if (next === "manage") showManage(); else switchTab();
            return true;
          }
          if (hasSnacks && e.key === "Tab") { e.preventDefault(); switchTab(); return true; }
          return gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, pick)(e);
        },
      },
      items: [],
    };
  };
  openMenu(build());
}

// ---------------------------------------------------------------------------
// Steep a cup from the kettle's hot water

/** The kettle's boiled: pick a leaf for the next cup. Shows who's waiting for tea, and for which leaf. */
export function openSteepScreen(g: Game, f: Slot): void {
  const tea = RECIPES.find((r) => r.id === "tea")!;
  const water = g.pots.get(f.id);
  const st = { focus: 0 };
  const build = (): MenuSpec => {
    const waiting = g.orders.filter((o) => o.open && o.recipeId === "tea").sort((a, b) => a.placedAt - b.placedAt);
    const wanted = (id: string) => waiting.filter((o) => o.wantOption === id).map((o) => g.patron(o.patronId)?.name).filter(Boolean);
    const steep = (id: string) => { closeAll(); startPour(g, f.id, `leaf:${id}`); };
    const leaves = tea.base.options.map((o) => o.id);
    const cards: CardSpec[] = leaves.map((id, i) => {
      const ing = INGREDIENTS.find((x) => x.id === id)!;
      const who = wanted(id);
      return {
        pick: id, icon: ing.icon, name: ing.name, tags: ing.tags, focus: i === st.focus,
        status: who.length ? `for ${who.join(", ")}` : "", tone: "good", on: who.length > 0,
        detail: `A cup of tea with ${ing.name.toLowerCase()}: ${[...tea.baseTags, ...ing.tags].join(", ")}.`,
        does: "Steep a cup with it",
      };
    });
    const first = waiting[0];
    const forWho = first ? `Next: <b>${g.patron(first.patronId)?.name ?? "someone"}</b>${first.wantOption ? `, who asked for ${INGREDIENTS.find((x) => x.id === first.wantOption)?.name.toLowerCase()}` : ""}${waiting.length > 1 ? ` · ${waiting.length} waiting` : ""}` : "Nobody's waiting: it goes to whoever asks.";
    return {
      title: "🍵 Steep a cup",
      subtitle: `Pick a leaf · hot water for ${water?.left ?? 0} more`,
      view: {
        pinned: resultPanel({ icon: tea.icon, name: "Tea", tags: tea.baseTags, meta: `One cup, steeped now`, forWho }),
        html: `<div class="sec-h"><h4>Leaves</h4><small>choose one</small></div>${grid(cards)}`,
        onPick: steep,
        onKey: gridKeys(() => leaves.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => steep(leaves[i])),
      },
      items: [],
    };
  };
  openMenu(build());
}

// ---------------------------------------------------------------------------
// Build the dish

export function openCookScreen(g: Game, f: Slot, r: Recipe): void {
  const state: CookState = { base: [], optional: [], focus: 0 };
  openMenu(cookSpec(g, f, r, state));
}

function cookSpec(g: Game, f: Slot, r: Recipe, st: CookState): MenuSpec {
  const groups = [
    { key: "base" as const, title: "Base", choice: r.base, chosen: st.base },
    { key: "optional" as const, title: "Extras", choice: r.optional, chosen: st.optional },
  ].filter((x) => x.choice.pick[1] > 0);
  const picks = groups.flatMap((grp) => grp.choice.options.map((o) => ({ grp, id: o.id })));
  const chosen = [...st.base, ...st.optional];
  const short = shortOf(g, usesOf(g, r, chosen));
  const ready = groups.every((grp) => grp.chosen.length >= grp.choice.pick[0]) && !short.length;
  const ticket = ticketFor(g, r);
  const refresh = () => replaceMenu(cookSpec(g, f, r, st));

  const toggle = (i: number) => {
    const p = picks[i];
    if (!p) return;
    const list = p.grp.chosen;
    const max = p.grp.choice.pick[1];
    const at = list.indexOf(p.id);
    const units = p.grp.choice.options.find((o) => o.id === p.id)?.units ?? 1;
    if (at < 0 && have(g, p.id) < units) { g.say(`Not enough ${ingName(p.id)} in the pantry.`); return; }
    if (at >= 0) list.splice(at, 1);
    else if (list.length < max) list.push(p.id);
    else if (max === 1 && p.grp.key === "base") list.splice(0, 1, p.id); // the one base: picking another swaps it
    else return;
    st.focus = i;
    refresh();
  };

  // The dish as it stands
  const item = makeItem(r, chosen);
  const forWho = r.servings ? "" : ticket ? `For <b>${ticket.name}</b>: the oldest order for it` : "Nobody's asked for it yet: it goes to whoever does";

  // Ingredient cards, a section per group: what each adds to the dish.
  let n = 0;
  const sections = groups.map((grp) => {
    const max = grp.choice.pick[1];
    const full = grp.chosen.length >= max;
    const cards: CardSpec[] = grp.choice.options.map((o) => {
      const i = n++;
      const ing = INGREDIENTS.find((x) => x.id === o.id)!;
      const on = grp.chosen.includes(o.id);
      const adds = ing.tags.filter((t) => !r.baseTags.includes(t));
      const left = have(g, o.id);
      const enough = left >= o.units;
      const blocked = (!on && full && (max > 1 || grp.key === "optional")) || (!on && !enough);
      return {
        pick: String(i), icon: ing.icon, name: ing.name, tags: ing.tags, on, off: blocked, focus: i === st.focus,
        status: left === Infinity ? "" : enough ? `${amount(o.id, left)} in the pantry` : `short: needs ${amount(o.id, o.units)}`, tone: enough ? undefined : "warn",
        detail: adds.length ? `Adds ${adds.join(" and ")} to the ${r.name.toLowerCase()}.` : `Keeps the ${r.name.toLowerCase()} as it is.`,
        does: on ? "Take it out" : !enough ? "Not enough in the pantry: order more at the desk" : blocked ? `Full: take one out first (${max} at most)` : max === 1 && grp.chosen.length ? "Use this instead" : "Add it",
      };
    });
    const [lo, hi] = grp.choice.pick;
    const rule = lo === hi ? `choose ${lo}` : lo === 0 ? `up to ${hi}` : `choose ${lo} to ${hi}`;
    return `<div class="sec-h"><h4>${grp.title}</h4><small>${rule}${grp.chosen.length ? ` · ${grp.chosen.length} chosen` : ""}</small></div>${grid(cards, { cols: Math.min(6, cards.length) })}`;
  });
  const always = r.fundamental.length ? `<div class="sec-h"><h4>Always in it</h4><small>${alwaysIn(r)}</small></div>` : "";
  const shortNote = short.length ? `<div class="sec-h"><h4>Short</h4><small>${describeUses(short)}: order more at the desk</small></div>` : "";
  const missing = groups.filter((grp) => grp.chosen.length < grp.choice.pick[0]).map((grp) => `${grp.choice.pick[0] - grp.chosen.length} ${grp.title.toLowerCase()}`).join(" and ");

  const cook = (forTicket: boolean) => {
    if (!ready) return;
    if (!startJob(g, f, r, chosen, forTicket ? ticket : null)) return;
    g.bus.emit({ type: "MenuSound", sound: "tick" });
    closeAll();
  };

  const verb = r.id === "water" ? "Boil" : r.storedIn === "piesafe" || f.kinds.includes("oven" as never) ? "Bake" : "Cook";
  return {
    title: `${r.icon} ${r.name}`,
    subtitle: `At the ${slotName(f)} · ${timeOf(r)}`,
    flavour: r.blurb,
    view: {
      pinned: resultPanel({ icon: r.icon, name: chosen.length ? item.name : r.name, tags: item.tags, lit: item.tags.filter((t) => !r.baseTags.includes(t)), meta: makesOf(r, f), forWho, empty: !chosen.length }),
      html: always + shortNote + sections.join(""),
      onPick: (v) => toggle(Number(v)),
      onKey: (e) => {
        if (e.key === "Enter") { cook(true); return true; }
        return gridKeys(() => picks.length, () => st.focus, (i) => { st.focus = i; refresh(); }, toggle)(e);
      },
    },
    items: [
      ...(ticket ? [{ label: "For nobody in particular", button: "secondary" as const, disabled: !ready, action: () => cook(false) }] : []),
      { label: verb, sub: short.length ? "not enough in the pantry" : !ready ? `choose ${missing}` : ticket ? `for ${ticket.name} · ${timeOf(r)}` : timeOf(r), button: "primary" as const, disabled: !ready, action: () => cook(true) },
    ],
  };
}
