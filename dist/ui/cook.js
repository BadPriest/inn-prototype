// Cooking at a station: pick a recipe from the list, then build the dish from ingredient cards.
// Click a card to add it, click again to take it out. The dish below changes as you choose.
// COOK becomes available once enough ingredients are chosen.
import { INGREDIENTS } from "../data.js";
import { makeItem, startJob, ticketFor } from "../crafting.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { chip, grid, gridKeys } from "./cards.js";
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
        : r.servings ? `a batch of about ${r.servings[0]} servings, served from the ${f.name.toLowerCase()}`
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
        subtitle: `At the ${f.name.toLowerCase()}`,
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
            { label: "Cook", sub: ticket ? `for ${ticket.name}` : undefined, button: "primary", disabled: !ready, action: () => cook(true) },
        ],
    };
}
