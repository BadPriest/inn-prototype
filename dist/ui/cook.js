// Cooking at a station, on one template (docs/specs/ui.md):
//   choose a recipe   cards: time, who's waiting, on the board or not, tags; the drawer says how it's made
//   build the dish    a result panel pinned on top (the dish as it will come out, new tags lit), then the
//                     ingredient cards, then one main button saying what happens and for whom
//   steep tea         the same panel and cards; picking a leaf pours the cup
// Click an ingredient to add it, again to take it out.
import { amount, describeUses, have, optionStages, previewTaken, shortOf, stageName, stagesInPantry, usesOf } from "../stock.js";
import { INGREDIENTS, RECIPES, defaultForRole } from "../data.js";
import { startPour } from "../serving.js";
import { makeItem, recipesFor, slotName, startJob, ticketFor } from "../crafting.js";
import { back, closeAll, openMenu, replaceMenu } from "./menu.js";
import { hasBackSpots, manageStoveSpec, stoveTabs } from "./stove.js";
import { chip, grid, stageTone, heading } from "./cards.js";
const toneOf = stageTone;
/** What a stage does to the dish, in a few words: "keeps it fresh", "not fresh", "day-old, −1 taste". */
function effectText(index, e) {
    if (index === 0)
        return "keeps it fresh";
    const bits = [...e.addTags.filter((t) => t !== "fresh"), ...(e.removeTags.includes("fresh") && !e.addTags.length ? ["not fresh"] : [])];
    if (e.tastePenalty < 0)
        bits.push(`${e.tastePenalty === -1 ? "−1" : `−${-e.tastePenalty}`} taste`);
    if (e.priceFactor < 1)
        bits.push("sells for less");
    return bits.join(", ") || "no different";
}
const ingName = (id) => INGREDIENTS.find((x) => x.id === id)?.name.toLowerCase() ?? id;
/** What always goes in: "water, salt". */
const alwaysIn = (r) => r.fundamental.map((u) => ingName(u.id)).join(", ");
/** What a dish takes: what always goes in, then the choices; with `pantry`, how much of each is in the pantry. */
export function ingredientsHtml(g, r, pantry = true) {
    const one = (id, units) => {
        const ing = INGREDIENTS.find((x) => x.id === id);
        const left = pantry ? have(g, id) : Infinity;
        const short = left !== Infinity && left < units;
        return `<span class="ing${short ? " short" : ""}">${ing?.icon ?? ""} ${ing?.name.toLowerCase() ?? id}${left === Infinity ? "" : ` <small>${amount(id, left)}</small>`}</span>`;
    };
    const part = ([lo, hi]) => (lo === hi ? `choose ${lo}` : lo === 0 ? `up to ${hi}` : `${lo} to ${hi}`);
    const rows = [
        r.fundamental.length ? `<div><b>Always in it:</b> ${r.fundamental.map((u) => one(u.id, u.units)).join(", ")}</div>` : "",
        r.base.pick[1] > 0 ? `<div><b>Base</b> (${part(r.base.pick)}): ${r.base.options.map((o) => one(o.id, o.units)).join(", ")}</div>` : "",
        r.optional.pick[1] > 0 ? `<div><b>Extras</b> (${part(r.optional.pick)}): ${r.optional.options.map((o) => one(o.id, o.units)).join(", ")}</div>` : "",
    ].filter(Boolean);
    if (!rows.length && r.boughtAs)
        rows.push(`<div><b>Bought in:</b> ${one(r.boughtAs, 1)}</div>`);
    return rows.length ? `<div class="ings">${rows.join("")}</div>` : "";
}
/** What always goes in, as icons (a role, like the liquid, shows its plainest). */
const fundamentalIcons = (r) => r.fundamental.map((u) => INGREDIENTS.find((x) => x.id === u.id)?.icon ?? (u.role ? defaultForRole(u.role)?.icon : "") ?? "").join("");
/** Under a dish card's name, as small pills: how long, whether you stay with it, how much it makes. */
function cardPills(r) {
    const serves = r.storedIn === "piesafe" ? `${r.servings?.[0] ?? 6} slices` : r.servings ? `${r.servings[0]} servings` : "1 serving";
    return [`⏱ ${Math.round(r.minutes[0])} min`, r.tended ? "tended" : "", r.id === "water" ? "" : serves].filter(Boolean).map((t) => `<span class="pill">${t}</span>`).join("");
}
/** The base choices as icons, for a card's face. */
export const baseIcons = (r) => r.base.options.map((o) => INGREDIENTS.find((x) => x.id === o.id)?.icon ?? "").join("");
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
let recipeTab = "dishes";
export function openRecipeScreen(g, slot) {
    const recipes = recipesFor(g, slot);
    const waiting = (r) => g.orders.filter((o) => o.open && o.recipeId === r.id).length;
    const hasSnacks = recipes.some((r) => r.tableSnack) && recipes.some((r) => !r.tableSnack);
    if (!hasSnacks)
        recipeTab = recipes.some((r) => !r.tableSnack) ? "dishes" : "snacks";
    const manage = hasBackSpots(slot.f);
    if (recipes.length === 1 && !manage) {
        openCookScreen(g, slot, recipes[0]);
        return;
    }
    const st = { focus: 0 };
    const own = hasSnacks ? [{ id: "dishes", name: "🍲 Dishes" }, { id: "snacks", name: "🥜 Table snacks" }] : [{ id: "cook", name: "🔥 Cook" }];
    /** Back from Manage stove: the stove may have changed, so the screen opens afresh on that tab. */
    const leave = (tab) => {
        if (tab === "dishes" || tab === "snacks")
            recipeTab = tab;
        back();
        const fresh = g.world.furniture.flatMap((x) => x.slots ?? []).find((s) => s.id === slot.id);
        if (fresh)
            openRecipeScreen(g, fresh);
    };
    const showManage = () => { g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); replaceMenu(manageStoveSpec(g, slot.f.id, own, leave)); };
    const build = () => {
        // What guests are waiting for comes first.
        const list = recipes.filter((r) => !!r.tableSnack === (recipeTab === "snacks")).sort((a, b) => waiting(b) - waiting(a));
        const switchTab = () => { recipeTab = recipeTab === "dishes" ? "snacks" : "dishes"; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); replaceMenu(build()); };
        const pickTab = (id) => { if (id === "manage")
            showManage();
        else if (hasSnacks && id !== recipeTab)
            switchTab(); };
        const tabs = manage ? stoveTabs(own, hasSnacks ? recipeTab : "cook", pickTab) : hasSnacks ? { list: own.map((t) => ({ id: t.id, label: t.name })), current: recipeTab, pick: pickTab } : undefined;
        const cards = list.map((r, i) => {
            const n = waiting(r);
            const onBoard = g.billNow().has(r.id);
            const extras = r.optional.pick[1];
            const lines = [
                r.fundamental.length ? `<div class="icons" title="Always in it">${fundamentalIcons(r)}</div>` : "",
                r.base.options.length ? `<div class="icons" title="Base: choose ${r.base.pick[0] === r.base.pick[1] ? r.base.pick[0] : `${r.base.pick[0]}–${r.base.pick[1]}`}">${baseIcons(r)}</div>` : "",
                extras ? `<div class="extras">+ up to ${extras} extra${extras === 1 ? "" : "s"}</div>` : "",
                r.blurb ? `<div class="flav">${r.blurb}</div>` : "",
            ].filter(Boolean).join("");
            return {
                pick: String(i), icon: r.icon, name: r.name, focus: i === st.focus,
                sub: cardPills(r),
                status: r.internal ? "" : n ? `${n} waiting for it` : onBoard ? "On the menu" : "",
                tone: n ? "warn" : "good",
                body: lines,
                tags: r.baseTags,
                detail: `${makesOf(r, slot)}.${ingredientsHtml(g, r)}`,
                flavour: r.blurb,
            };
        });
        const pick = (i) => { const r = list[i]; if (r)
            openCookScreen(g, slot, r); };
        return {
            title: `${slot.f.name}${(slot.f.slots?.length ?? 1) > 1 ? `: ${slot.name.toLowerCase()}` : ""}`,
            subtitle: "What will you make? Pick a dish to choose what goes in it",
            tabs,
            cards: `<div class="dishes">${grid(cards, { size: "l" })}</div>`,
            onPick: (v) => pick(Number(v)),
            nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: pick },
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
        const leaves = tea.base.options.map((o) => o.id);
        const cards = leaves.map((id, i) => {
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
            subtitle: `Pick a leaf to steep a cup · hot water for ${water?.left ?? 0} more`,
            summary: resultPanel({ icon: tea.icon, name: "Tea", tags: tea.baseTags, meta: `One cup, steeped now`, forWho }),
            cards: `${heading(`Leaves`, `choose one`)}${grid(cards)}`,
            onPick: steep,
            nav: { count: () => leaves.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: (i) => steep(leaves[i]) },
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// Build the dish
export function openCookScreen(g, f, r) {
    const state = { base: [], optional: [], focus: 0, stage: {} };
    openMenu(cookSpec(g, f, r, state));
}
function cookSpec(g, f, r, st) {
    const groups = [
        { key: "base", title: "Base", choice: r.base, chosen: st.base },
        { key: "optional", title: "Extras", choice: r.optional, chosen: st.optional },
    ].filter((x) => x.choice.pick[1] > 0);
    const picks = groups.flatMap((grp) => grp.choice.options.map((o) => ({ grp, id: o.id })));
    const chosen = [...st.base, ...st.optional];
    // Each choice's deck: one card per stage on the shelves that the dish takes, freshest first. The top
    // card is the cook's pick, else what cooking would take first (the oldest, for a dish that wants it old).
    const deckOf = (id) => stagesInPantry(g, id, optionStages(r, id));
    const topOf = (id) => {
        const d = deckOf(id);
        const wantsOld = !!optionStages(r, id) && !optionStages(r, id).includes("fresh");
        return d.find((x) => x.stage === st.stage[id]) ?? (wantsOld ? d[d.length - 1] : d[0]);
    };
    const prefer = Object.fromEntries(chosen.map((id) => [id, topOf(id)?.stage]).filter((x) => !!x[1]));
    const uses = usesOf(g, r, chosen, prefer);
    const short = shortOf(g, uses);
    const ready = groups.every((grp) => grp.chosen.length >= grp.choice.pick[0]) && !short.length;
    const ticket = ticketFor(g, r);
    const refresh = () => replaceMenu(cookSpec(g, f, r, st));
    const toggle = (i) => {
        const p = picks[i];
        if (!p)
            return;
        const list = p.grp.chosen;
        const max = p.grp.choice.pick[1];
        const at = list.indexOf(p.id);
        const units = p.grp.choice.options.find((o) => o.id === p.id)?.units ?? 1;
        if (at < 0 && have(g, p.id) < units) {
            g.say(`Not enough ${ingName(p.id)} in the pantry.`);
            return;
        }
        if (at >= 0)
            list.splice(at, 1);
        else if (list.length < max)
            list.push(p.id);
        else if (max === 1 && p.grp.key === "base")
            list.splice(0, 1, p.id); // the one base: picking another swaps it
        else
            return;
        st.focus = i;
        refresh();
    };
    /** The next stage to the top of an ingredient's deck. */
    const shuffle = (i) => {
        const p = picks[i];
        if (!p)
            return;
        const d = deckOf(p.id);
        if (d.length < 2)
            return;
        const at = d.findIndex((x) => x.stage === topOf(p.id)?.stage);
        st.stage[p.id] = d[(at + 1) % d.length].stage;
        st.focus = i;
        g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
        refresh();
    };
    // The dish as it stands, with what its ingredients' stages do to it
    const item = makeItem(r, chosen, previewTaken(g, uses) ?? undefined);
    const forWho = r.servings ? "" : ticket ? `For <b>${ticket.name}</b>: the oldest order for it` : "Nobody's asked for it yet: it goes to whoever does";
    // Ingredient cards, a section per group: what each adds to the dish.
    let n = 0;
    const sections = groups.map((grp) => {
        const max = grp.choice.pick[1];
        const full = grp.chosen.length >= max;
        const cards = grp.choice.options.map((o) => {
            const i = n++;
            const ing = INGREDIENTS.find((x) => x.id === o.id);
            const on = grp.chosen.includes(o.id);
            const adds = ing.tags.filter((t) => !r.baseTags.includes(t));
            const left = have(g, o.id);
            const enough = left >= o.units;
            const blocked = (!on && full && (max > 1 || grp.key === "optional")) || (!on && !enough);
            const deck = deckOf(o.id);
            const at = deck.findIndex((x) => x.stage === topOf(o.id)?.stage);
            const top = deck[at];
            const rest = top ? [...deck.slice(at + 1), ...deck.slice(0, at)] : [];
            const topTone = top ? toneOf(top.index, top.effect) : undefined;
            const pantry = deck.map((x) => `${amount(o.id, x.units)} ${stageName(x.stage)}${x.index ? ` (${effectText(x.index, x.effect)})` : ""}`).join(" · ");
            return {
                pick: String(i), icon: ing.icon, name: ing.name, tags: ing.tags, on, off: blocked, focus: i === st.focus,
                band: top ? { label: stageName(top.stage), tone: topTone, at: deck.length > 1 ? `${at + 1}/${deck.length}` : undefined, shuffle: deck.length > 1 ? `shuffle:${i}` : undefined } : undefined,
                under: rest.map((x) => toneOf(x.index, x.effect)),
                status: left === Infinity ? "" : !enough ? `short: needs ${amount(o.id, o.units)}` : top?.index ? `${amount(o.id, top.units)} · ${effectText(top.index, top.effect)}` : top ? `${amount(o.id, top.units)} in the pantry` : `${amount(o.id, left)} in the pantry`,
                tone: !enough || topTone === "cost" ? "warn" : undefined,
                detail: `${adds.length ? `Adds ${adds.join(" and ")} to the ${r.name.toLowerCase()}.` : `Keeps the ${r.name.toLowerCase()} as it is.`}${deck.length ? `<br>In the pantry: ${pantry}.` : ""}${deck.length > 1 ? `<br>Tab or ⇄ puts the next one on top; the top one goes in first.` : ""}`,
                does: on ? "Take it out" : !enough ? "Not enough in the pantry: order more at the desk" : blocked ? `Full: take one out first (${max} at most)` : max === 1 && grp.chosen.length ? "Use this instead" : "Add it",
            };
        });
        const [lo, hi] = grp.choice.pick;
        const rule = lo === hi ? `choose ${lo}` : lo === 0 ? `up to ${hi}` : `choose ${lo} to ${hi}`;
        return `${heading(`${grp.title}`, `${rule}${grp.chosen.length ? ` · ${grp.chosen.length} chosen` : ""}`)}${grid(cards, { cols: Math.min(6, cards.length) })}`;
    });
    const always = r.fundamental.length ? `${heading(`Always in it`, `${alwaysIn(r)}`)}` : "";
    const shortNote = short.length ? `${heading(`Short`, `${describeUses(short)}: order more at the desk`)}` : "";
    const missing = groups.filter((grp) => grp.chosen.length < grp.choice.pick[0]).map((grp) => `${grp.choice.pick[0] - grp.chosen.length} ${grp.title.toLowerCase()}`).join(" and ");
    const cook = (forTicket) => {
        if (!ready)
            return;
        if (!startJob(g, f, r, chosen, forTicket ? ticket : null, prefer))
            return;
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        closeAll();
    };
    const verb = r.id === "water" ? "Boil" : r.storedIn === "piesafe" || f.kinds.includes("oven") ? "Bake" : "Cook";
    return {
        title: `${r.icon} ${r.name}`,
        subtitle: `At the ${slotName(f)} · ${timeOf(r)} · pick what goes in it`,
        flavour: r.blurb,
        summary: resultPanel({ icon: r.icon, name: chosen.length ? item.name : r.name, tags: item.tags, lit: item.tags.filter((t) => !r.baseTags.includes(t)), meta: makesOf(r, f), forWho, empty: !chosen.length }),
        cards: always + shortNote + sections.join(""),
        keys: Object.values(picks).some((p) => deckOf(p.id).length > 1) ? "Tab shuffles the stage" : undefined,
        onPick: (v) => (v.startsWith("shuffle:") ? shuffle(Number(v.slice(8))) : toggle(Number(v))),
        onKey: (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                shuffle(st.focus);
                return true;
            }
            return false;
        },
        nav: { count: () => picks.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; refresh(); }, use: toggle },
        confirm: { label: ticket ? `${verb} it for ${ticket.name}` : verb, sub: short.length ? "not enough in the pantry" : !ready ? `choose ${missing}` : timeOf(r), disabled: !ready, run: () => cook(true) },
        alt: ticket ? { label: `${verb} it for nobody in particular`, disabled: !ready, run: () => cook(false) } : undefined,
    };
}
