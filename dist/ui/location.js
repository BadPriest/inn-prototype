// Where the inn stands: picked on cards when a save starts. Card screens: cards.ts.
import { INNS, LOCATIONS } from "../data.js";
import { confirmed, openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
/** The card screen for choosing a location. `onChosen` runs once it's settled. */
export function openLocationPicker(onChosen, replace = false) {
    const st = { focus: 0, chosen: 0 };
    const build = () => {
        const chosen = LOCATIONS[st.chosen];
        const cards = LOCATIONS.map((l, i) => ({
            pick: String(i),
            icon: l.icon,
            name: l.name,
            note: `spring ${l.days[0]} · summer ${l.days[1]}<br>autumn ${l.days[2]} · winter ${l.days[3]}`,
            tags: l.traits,
            on: i === st.chosen,
            focus: i === st.focus,
        }));
        const choose = (i) => { st.chosen = i; st.focus = i; replaceMenu(build()); };
        const settle = () => { confirmed(); onChosen(LOCATIONS[st.chosen].id); };
        return {
            title: "Where does your inn stand?",
            subtitle: "It shapes the year, the weather, and who comes through the door",
            modal: true,
            view: {
                // A fixed size (the cards in one row, room for the longest description), so the screen
                // doesn't jump or re-wrap as you move between places.
                html: `<div style="width:min(560px, 86vw)">${grid(cards)}<p class="explain" style="min-height:4.8em"><b>${chosen.icon} ${chosen.name}.</b> ${chosen.blurb}</p></div>`,
                onPick: (v) => choose(Number(v)),
                onKey: (e) => {
                    if (e.key === "Enter") {
                        settle();
                        return true;
                    }
                    return gridKeys(() => LOCATIONS.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, choose)(e);
                },
            },
            items: [{ label: "Settle here", sub: chosen.name, button: "primary", action: settle }],
        };
    };
    if (replace)
        replaceMenu(build());
    else
        openMenu(build());
}
/** Then which inn: the big tavern (the default) or a small one, the real start. */
export function openInnPicker(onChosen) {
    const st = { focus: 0, chosen: 0 };
    const build = () => {
        const chosen = INNS[st.chosen];
        const cards = INNS.map((inn, i) => ({
            pick: String(i), icon: inn.icon, name: inn.name, tags: inn.traits, on: i === st.chosen, focus: i === st.focus,
        }));
        const choose = (i) => { st.chosen = i; st.focus = i; replaceMenu(build()); };
        const settle = () => { confirmed(); onChosen(INNS[st.chosen].id); };
        return {
            title: "Which inn is yours?",
            subtitle: "The small one is the easiest start; the big one is busy enough to need staff",
            modal: true,
            view: {
                html: `<div style="width:min(560px, 86vw)">${grid(cards)}<p class="explain" style="min-height:4.8em"><b>${chosen.icon} ${chosen.name}.</b> ${chosen.blurb}</p></div>`,
                onPick: (v) => choose(Number(v)),
                onKey: (e) => {
                    if (e.key === "Enter") {
                        settle();
                        return true;
                    }
                    return gridKeys(() => INNS.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, choose)(e);
                },
            },
            items: [{ label: "Move in", sub: chosen.name, button: "primary", action: settle }],
        };
    };
    replaceMenu(build());
}
