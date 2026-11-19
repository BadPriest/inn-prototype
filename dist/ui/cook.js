// Cooking at a station, on one template (docs/specs/ui.md):
//   choose a recipe   cards: time, who's waiting, on the board or not, tags; the drawer says how it's made
//   build the dish    a result panel pinned on top (the dish as it will come out, new tags lit), then the
//                     ingredient cards, then one main button saying what happens and for whom
//   steep tea         the same panel and cards; picking a leaf pours the cup
// Click an ingredient to add it, again to take it out.
import { INGREDIENTS, RECIPES } from "../data.js";
import { startPour } from "../serving.js";
import { makeItem, recipesFor, slotName, startJob, ticketFor } from "../crafting.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { chip, grid, gridKeys } from "./cards.js";
/** The panel at the top of a crafting screen: what you'll get. */
export function resultPanel(o) {
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
const timeOf = (r) => `~${Math.round(r.minutes[0])} min${r.tended ? ", stay with it" : ""}`;
/** What one go makes. */
function makesOf(r, f) {
    if (r.storedIn === "piesafe")
        return `A whole pie, ~${r.servings?.[0] ?? 6} slices, for the pie safe`;
    if (r.id === "water")
        return `Hot water for ~${r.servings?.[0] ?? 3} cups, each steeped with its own leaf`;
    if (r.servings)
        return `A batch of ~${r.servings[0]} servings, served from the ${slotName(f)}`;
    return "One serving, waiting here when it's done";
}
// ---------------------------------------------------------------------------
// Choose what to make
export function openRecipeScreen(g, slot) {
    const recipes = recipesFor(g, slot);
    const waiting = (r) => g.orders.filter((o) => o.open && o.recipeId === r.id).length;
    // What guests are waiting for comes first.
    const list = [...recipes].sort((a, b) => waiting(b) - waiting(a));
    if (list.length === 1) {
        openCookScreen(g, slot, list[0]);
        return;
    }
    const st = { focus: 0 };
    const build = () => {
        const cards = list.map((r, i) => {
            const n = waiting(r);
            const onBoard = g.billNow().has(r.id);
            return {
                pick: String(i), icon: r.icon, name: r.name, focus: i === st.focus,
                fact: timeOf(r),
                status: n ? `${n} waiting` : r.internal ? "" : onBoard ? "on the board" : "not on the board",
                tone: n ? "good" : onBoard || r.internal ? undefined : "muted",
                tags: r.baseTags,
                detail: `${makesOf(r, slot)}. ${r.slots === 1 ? "Choose 1 ingredient" : `Choose ${r.slots} ingredients`}${r.maxSlots && r.maxSlots > r.slots ? ` (up to ${r.maxSlots})` : ""}.`,
                flavour: r.blurb,
                does: "Choose its ingredients",
            };
        });
        const pick = (i) => { const r = list[i]; if (r)
            openCookScreen(g, slot, r); };
        return {
            title: `${slot.f.name}${(slot.f.slots?.length ?? 1) > 1 ? `: ${slot.name.toLowerCase()}` : ""}`,
            subtitle: "What will you make?",
            view: {
                html: grid(cards),
                onPick: (v) => pick(Number(v)),
                onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, pick),
            },
            items: [],
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// Steep a cup from the kettle's hot water
/** The kettle's boiled: pick a leaf for the next cup. Shows who's waiting for tea, and for which leaf. */
export function openSteepScreen(g, f) {
    const tea = RECIPES.find((r) => r.id === "tea");
    const water = g.pots.get(f.id);
    const st = { focus: 0 };
    const build = () => {
        const waiting = g.orders.filter((o) => o.open && o.recipeId === "tea").sort((a, b) => a.placedAt - b.placedAt);
        const wanted = (id) => waiting.filter((o) => o.wantOption === id).map((o) => g.patron(o.patronId)?.name).filter(Boolean);
        const steep = (id) => { closeAll(); startPour(g, f.id, `leaf:${id}`); };
        const cards = tea.options.map((id, i) => {
            const ing = INGREDIENTS.find((x) => x.id === id);
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
                onKey: gridKeys(() => tea.options.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => steep(tea.options[i])),
            },
            items: [],
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// Build the dish
export function openCookScreen(g, f, r) {
    const state = { chosen: [], focus: 0 };
    openMenu(cookSpec(g, f, r, state));
}
function cookSpec(g, f, r, st) {
    const min = r.slots;
    const max = Math.max(min, r.maxSlots ?? min);
    const full = st.chosen.length >= max;
    const ready = st.chosen.length >= min;
    const ticket = ticketFor(g, r);
    const refresh = () => replaceMenu(cookSpec(g, f, r, st));
    const toggle = (id) => {
        const at = st.chosen.indexOf(id);
        if (at >= 0)
            st.chosen.splice(at, 1);
        else if (st.chosen.length < max)
            st.chosen.push(id);
        else if (max === 1)
            st.chosen = [id]; // one slot: picking another swaps it
        else
            return;
        st.focus = Math.max(0, r.options.indexOf(id));
        refresh();
    };
    // The dish as it stands
    const item = makeItem(r, st.chosen);
    const forWho = r.servings ? "" : ticket ? `For <b>${ticket.name}</b>: the oldest order for it` : "Nobody's asked for it yet: it goes to whoever does";
    // Ingredient cards: what each adds to the dish.
    const cards = r.options.map((id, i) => {
        const ing = INGREDIENTS.find((x) => x.id === id);
        const on = st.chosen.includes(id);
        const adds = ing.tags.filter((t) => !r.baseTags.includes(t));
        const blocked = !on && full && max > 1;
        return {
            pick: id, icon: ing.icon, name: ing.name, tags: ing.tags, on, off: blocked, focus: i === st.focus,
            detail: adds.length ? `Adds ${adds.join(" and ")} to the ${r.name.toLowerCase()}.` : `Keeps the ${r.name.toLowerCase()} as it is.`,
            does: on ? "Take it out" : blocked ? `Full: take one out first (${max} at most)` : max === 1 && st.chosen.length ? "Use this instead" : "Add it",
        };
    });
    const left = min - st.chosen.length;
    const choose = max > min ? `choose ${min} to ${max}` : `choose ${min}`;
    const cook = (forTicket) => {
        if (!ready)
            return;
        startJob(g, f, r, [...st.chosen], forTicket ? ticket : null);
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        closeAll();
    };
    const verb = r.id === "water" ? "Boil" : r.storedIn === "piesafe" || f.kinds.includes("oven") ? "Bake" : "Cook";
    return {
        title: `${r.icon} ${r.name}`,
        subtitle: `At the ${slotName(f)} · ${timeOf(r)}`,
        flavour: r.blurb,
        view: {
            pinned: resultPanel({ icon: r.icon, name: st.chosen.length ? item.name : r.name, tags: item.tags, lit: item.tags.filter((t) => !r.baseTags.includes(t)), meta: makesOf(r, f), forWho, empty: !st.chosen.length }),
            html: `<div class="sec-h"><h4>Ingredients</h4><small>${choose}${st.chosen.length ? ` · ${st.chosen.length} chosen` : ""}</small></div>${grid(cards, { cols: Math.min(6, cards.length) })}`,
            onPick: toggle,
            onKey: (e) => {
                if (e.key === "Enter") {
                    cook(true);
                    return true;
                }
                return gridKeys(() => r.options.length, () => st.focus, (i) => { st.focus = i; refresh(); }, (i) => toggle(r.options[i]))(e);
            },
        },
        items: [
            ...(ticket ? [{ label: "For nobody in particular", button: "secondary", disabled: !ready, action: () => cook(false) }] : []),
            { label: verb, sub: !ready ? `choose ${left} more` : ticket ? `for ${ticket.name} · ${timeOf(r)}` : timeOf(r), button: "primary", disabled: !ready, action: () => cook(true) },
        ],
    };
}
