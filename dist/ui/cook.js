// Cooking at a station: pick a recipe from the list, then build the dish from ingredient cards.
// Click a card to add it, click again to take it out. The dish below changes as you choose.
// COOK becomes available once enough ingredients are chosen.
import { INGREDIENTS, RECIPES } from "../data.js";
import { startPour } from "../serving.js";
import { makeItem, slotName, startJob, ticketFor } from "../crafting.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { chip, grid, gridKeys } from "./cards.js";
/** The kettle's boiled: pick a leaf for the next cup. Shows who's waiting for tea, and for which leaf. */
export function openSteepScreen(g, f) {
    const tea = RECIPES.find((r) => r.id === "tea");
    const water = g.pots.get(f.id);
    const st = { focus: 0 };
    const build = () => {
        const waiting = g.orders.filter((o) => o.open && o.recipeId === "tea").sort((a, b) => a.placedAt - b.placedAt);
        const wanted = (id) => waiting.filter((o) => o.wantOption === id).map((o) => g.patron(o.patronId)?.name).filter(Boolean);
        const steep = (id) => { closeAll(); startPour(g, f.id, `leaf:${id}`); };
        const cards = grid(tea.options.map((id, i) => {
            const ing = INGREDIENTS.find((x) => x.id === id);
            const who = wanted(id);
            return { pick: id, icon: ing.icon, name: ing.name, tags: ing.tags, note: who.length ? `asked for by ${who.join(", ")}` : "", on: who.length > 0, focus: i === st.focus };
        }));
        const queue = waiting.map((o) => `${g.patron(o.patronId)?.name ?? "?"}${o.wantOption ? ` (${INGREDIENTS.find((x) => x.id === o.wantOption)?.name.toLowerCase()})` : ""}`).join(", ");
        return {
            title: "🍵 Steep a cup",
            subtitle: `Hot water for ${water?.left ?? 0} more`,
            view: {
                html: `<p class="blurb">${waiting.length ? `Waiting for tea: ${queue}.` : "Nobody's waiting for tea just now; it'll go to whoever asks."}</p>${cards}`,
                onPick: steep,
                onKey: gridKeys(() => tea.options.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => steep(tea.options[i])),
            },
            items: [],
        };
    };
    openMenu(build());
}
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
    // Ingredient cards
    const cards = grid(r.options.map((id, i) => {
        const ing = INGREDIENTS.find((x) => x.id === id);
        const on = st.chosen.includes(id);
        return { pick: id, icon: ing.icon, name: ing.name, tags: ing.tags, on, off: !on && full && max > 1, focus: i === st.focus, title: ing.tags.join(", ") };
    }));
    // The dish as it stands
    const item = makeItem(r, st.chosen);
    const tags = item.tags.map((t) => chip(t, !r.baseTags.includes(t))).join("");
    const time = `about ${Math.round(r.minutes[0])} min${r.tended ? ", and it needs you at the station" : ""}`;
    const makes = r.storedIn === "piesafe" ? `a whole pie, about ${r.servings?.[0] ?? 6} slices, for the pie safe`
        : r.id === "water" ? `hot water for about ${r.servings?.[0] ?? 3} cups; you steep each with its own leaf`
            : r.servings ? `a batch of about ${r.servings[0]} servings, served from the ${slotName(f)}`
                : "one serving, waiting here when it's done";
    const forWho = r.servings ? "" : ticket ? `For <b>${ticket.name}</b>: theirs is the oldest order for this.` : "Nobody's asked for this yet: it'll go to whoever does.";
    const left = min - st.chosen.length;
    const need = ready
        ? (max > st.chosen.length ? `Ready to cook. You can add ${max - st.chosen.length} more.` : "Ready to cook.")
        : `Choose <b>${left}</b> more ingredient${left === 1 ? "" : "s"}${max > min ? ` (up to ${max})` : ""}.`;
    const html = `
    ${r.blurb ? `<p class="blurb">${r.blurb}</p>` : ""}
    <div class="need">${need}</div>
    ${cards}
    <div class="dish ${st.chosen.length ? "" : "empty"}">
      <span class="ic">${r.icon}</span>
      <div>
        <div class="nm">${item.name}</div>
        <div class="chips">${tags}</div>
        <div class="meta">Makes ${makes} · ${time}</div>
        ${forWho ? `<div class="for">${forWho}</div>` : ""}
      </div>
    </div>`;
    const cook = (forTicket) => {
        if (!ready)
            return;
        startJob(g, f, r, [...st.chosen], forTicket ? ticket : null);
        closeAll();
    };
    return {
        title: `${r.icon} ${r.name}`,
        subtitle: `At the ${slotName(f)}`,
        view: {
            html,
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
            ...(ticket ? [{ label: "Cook for nobody in particular", button: "secondary", disabled: !ready, action: () => cook(false) }] : []),
            { label: r.id === "water" ? "Boil" : "Cook", sub: ticket ? `for ${ticket.name}` : undefined, button: "primary", disabled: !ready, action: () => cook(true) },
        ],
    };
}
