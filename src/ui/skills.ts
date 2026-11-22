// Skills at the desk: the keeper's level, and what its points buy: recipes, by kind, and knacks.

import type { Game } from "../game.js";
import { EQUIPMENT, RECIPES, dishData, type Recipe } from "../data.js";
import type { Knack } from "../gamedata.js";
import { SKILLS, buyKnack, costOf, learn, levelOf, levelProgress, nextTier, pointsLeft, tierOf } from "../skills.js";
import { openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { grid, gridKeys, type CardSpec } from "./cards.js";
import { ingredientsHtml } from "./cook.js";
import { needs, whereFull, whereShort } from "./where.js";

type Tab = "drinks" | "breakfast" | "meals" | "snacks" | "knacks";
const TABS: { id: Tab; name: string }[] = [
  { id: "drinks", name: "☕ Drinks" },
  { id: "breakfast", name: "🍳 Breakfast" },
  { id: "meals", name: "🍲 Meals" },
  { id: "snacks", name: "🧀 Snacks" },
  { id: "knacks", name: "✋ Knacks" },
];

/** Drinks; snacks (any time of day); breakfast (not served at dinner); and the rest, meals. */
function tabOf(r: Recipe): Tab {
  if (r.kind === "drink") return "drinks";
  const meals = dishData(r.id)?.meals ?? [];
  if (meals.includes("between")) return "snacks";
  if (meals.includes("breakfast") && !meals.includes("dinner")) return "breakfast";
  return "meals";
}

const BOOK = RECIPES.filter((r) => !r.internal && r.station !== "tap" && (costOf(r.id) > 0 || SKILLS.startKnown.includes(r.id)));
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const pts = (n: number) => `${n} point${n === 1 ? "" : "s"}`;
let lastTab: Tab = "meals";

export function openSkills(g: Game, changed: () => void): void {
  g.newSkills = false;
  const st = { focus: 0, tab: lastTab };
  const canMakeHere = (r: Recipe) => g.world.furniture.some((f) => (f.slots ?? []).some((sl) => sl.kinds.includes(r.station as never)));
  const waiting = (r: Recipe) => EQUIPMENT.find((e) => g.toPlace.includes(e.id) && e.slots.some((sl) => sl.kinds.includes(r.station as never)));
  const kitchenNote = (r: Recipe) => {
    if (canMakeHere(r)) return "";
    const w = waiting(r);
    return w ? `set out the ${w.name.toLowerCase()} to make it` : needs(r);
  };

  const build = (): MenuSpec => {
    const left = pointsLeft(g);
    type Entry = { card: CardSpec; use: () => boolean };
    let entries: Entry[];
    if (st.tab === "knacks") {
      entries = SKILLS.knacks.map((k: Knack) => {
        const tier = tierOf(g, k.id), next = nextTier(g, k.id);
        const afford = !!next && left >= next.points;
        const tiers = k.tiers.map((t, i) => `<div>${i < tier ? "✓" : "·"} ${k.name} ${ROMAN[i + 1]}: ${t.text} (${pts(t.points)})</div>`).join("");
        return {
          card: {
            pick: "", icon: k.icon, name: tier ? `${k.name} ${ROMAN[tier]}` : k.name, on: !next, off: !!next && !afford,
            fact: `${tier} of ${k.tiers.length}`,
            status: !next ? "mastered" : afford ? `${ROMAN[tier + 1]}: ${next.text} · ${pts(next.points)}` : `${ROMAN[tier + 1]}: ${pts(next.points - left)} more`,
            tone: !next || afford ? "good" : "muted",
            detail: `${k.text}${tiers}`,
            does: !next ? "You've learned all of it" : afford ? `Learn ${k.name} ${ROMAN[tier + 1]}: ${pts(next.points)}` : "Level up to earn points",
          },
          use: () => {
            if (!buyKnack(g, k.id)) return false;
            g.say(`${k.icon} ${k.name} ${ROMAN[tierOf(g, k.id)]}: ${k.tiers[tierOf(g, k.id) - 1].text}.`);
            return true;
          },
        };
      });
    } else {
      const list = BOOK.filter((r) => tabOf(r) === st.tab).sort((a, b) => Number(g.known.has(a.id)) - Number(g.known.has(b.id)) || costOf(a.id) - costOf(b.id));
      entries = list.map((r) => {
        const has = g.known.has(r.id);
        const cost = costOf(r.id);
        const afford = left >= cost;
        const here = canMakeHere(r);
        const note = kitchenNote(r);
        return {
          card: {
            pick: "", icon: r.icon, name: r.name, on: has, off: !has && !afford,
            fact: has ? "known" : pts(cost),
            status: has ? note || "ready to cook" : afford ? `learn it: ${pts(cost)}` : `${pts(cost)}: you have ${left}`,
            tone: has ? (note ? "warn" : "good") : afford ? "good" : "muted",
            note: !has && note ? note : undefined,
            tags: r.baseTags,
            detail: `${r.blurb ?? ""}<div class="where-full">${whereShort(r)}${whereFull(r) ? ` · ${whereFull(r)}` : ""}</div>${ingredientsHtml(g, r)}`,
            does: has ? "You know this one" : afford ? `Learn it: ${pts(cost)}${note ? ` (you can learn it now; ${note})` : ""}` : `Level up to earn ${pts(cost - left)} more`,
          },
          use: () => {
            if (!learn(g, r.id)) return false;
            g.say(`You've learned to make ${r.name.toLowerCase()}.${here ? " Put it on the bill of fare when you're ready." : ` To cook it: ${note}.`}`);
            return true;
          },
        };
      });
    }
    st.focus = Math.min(st.focus, Math.max(0, entries.length - 1));
    const cards = entries.map((e, i) => ({ ...e.card, pick: String(i), focus: i === st.focus }));
    const pick = (i: number) => {
      const e = entries[i];
      if (!e) return;
      st.focus = i;
      if (e.use()) { g.bus.emit({ type: "MenuSound", sound: "tick" }); changed(); }
      replaceMenu(build());
    };
    const switchTab = (by: number) => {
      const i = TABS.findIndex((t) => t.id === st.tab);
      st.tab = lastTab = TABS[(i + by + TABS.length) % TABS.length].id;
      st.focus = 0;
      replaceMenu(build());
    };
    const prog = levelProgress(g);
    const xp = SKILLS.xpPerServe;
    const tabs = `<div class="bf-tabs">${TABS.map((t) => `<button class="${st.tab === t.id ? "on" : ""}" data-pick="tab:${t.id}">${t.name}</button>`).join("")}</div>`;
    const keys = gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, pick);
    return {
      title: "📚 Skills",
      holdsClock: true,
      subtitle: `${pts(left)} to spend · a point each level`,
      view: {
        pinned: `<div class="dish result"><span class="ic">🧑‍🍳</span><div class="dish-body">
          <div class="nm">Level ${levelOf(g)}</div>
          <div class="meta">${prog.have} of ${prog.need} to level ${levelOf(g) + 1} · a guest delighted earns ${xp.DELIGHT ?? 0}, pleased ${xp.PLEASED ?? 0}, served ${xp.FULFILLED ?? 0}</div>
          <div class="skill-bar"><span style="width:${Math.round((prog.have / prog.need) * 100)}%"></span></div>
        </div></div>${tabs}`,
        html: cards.length ? grid(cards, { size: "l" }) : `<p class="blurb">Nothing here yet.</p>`,
        onPick: (v) => {
          if (v.startsWith("tab:")) { st.tab = lastTab = v.slice(4) as Tab; st.focus = 0; replaceMenu(build()); return; }
          pick(Number(v));
        },
        onKey: (e) => {
          if (e.key === "Tab") { e.preventDefault(); switchTab(e.shiftKey ? -1 : 1); return true; }
          return keys(e);
        },
      },
      items: [],
    };
  };
  openMenu(build());
}
