// Where the inn stands: picked on cards when a save starts. Card screens: cards.ts.

import { INNS, LOCATIONS, type InnId, type LocationId } from "../data.js";
import { confirmed, openMenu, replaceMenu, type MenuSpec } from "./menu.js";
import { grid, gridKeys, type CardSpec } from "./cards.js";

const SEASONS = [["spring", "🌱"], ["summer", "☀️"], ["autumn", "🍂"], ["winter", "❄️"]] as const;
/** The year as a bar: each season as long as its days. */
const yearBar = (days: number[]): string => `<div class="yearbar">${SEASONS.map(([id, ic], i) =>
  `<span class="ys ys-${id}" style="flex:${days[i]}" title="${id}: ${days[i]} days"><i>${ic}</i>${days[i]}</span>`).join("")}</div>`;
const dots = (v: number, max: number): string => { const n = Math.max(1, Math.min(4, Math.round((v / max) * 4))); return "●".repeat(n) + `<span class="off">${"●".repeat(4 - n)}</span>`; };
/** Passing trade, and how much the rain drives in. */
const meters = (traffic: number, shelter: number): string =>
  `<div class="meters"><span>👣 passers-by <b>${dots(traffic, 1.3)}</b></span><span>☔ rain brings in <b>${dots(shelter, 1.5)}</b></span></div>`;

/** The back of a card: what it is, then a little of what it's like. */
const backHtml = (icon: string, name: string, blurb: string, back: string): string =>
  `<p class="place-back"><b>${icon} ${name}.</b> ${blurb}</p>${back ? `<p class="place-flav">${back}</p>` : ""}`;

/** The card screen for choosing a location. `onChosen` runs once it's settled. */
export function openLocationPicker(onChosen: (id: LocationId) => void, replace = false): void {
  const st = { focus: 0, chosen: 0 };
  const build = (): MenuSpec => {
    const chosen = LOCATIONS[st.chosen];
    const cards: CardSpec[] = LOCATIONS.map((l, i) => ({
      pick: String(i),
      icon: l.icon,
      name: l.name,
      body: yearBar(l.days) + meters(l.traffic, l.shelter),
      detail: backHtml(l.icon, l.name, l.blurb, l.back),
      tags: l.traits,
      on: i === st.chosen,
      focus: i === st.focus,
    }));
    const choose = (i: number) => { st.chosen = i; st.focus = i; replaceMenu(build()); };
    const settle = () => { confirmed(); onChosen(LOCATIONS[st.chosen].id); };
    return {
      title: "Where does your inn stand?",
      subtitle: "It shapes the year, the weather, and who comes through the door",
      modal: true,
      view: {
        // A fixed size (the cards in one row, room for the longest description), so the screen
        // doesn't jump or re-wrap as you move between places.
        html: `<div style="width:min(640px, 88vw)">${grid(cards, { size: "l", cols: 3 })}</div>`,
        onPick: (v) => choose(Number(v)),
        onKey: (e) => {
          if (e.key === "Enter") { settle(); return true; }
          return gridKeys(() => LOCATIONS.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, choose)(e);
        },
      },
      items: [{ label: "Settle here", sub: chosen.name, button: "primary", action: settle }],
    };
  };
  if (replace) replaceMenu(build()); else openMenu(build());
}

/** Then which inn: the big tavern (the default) or a small one, the real start. */
export function openInnPicker(onChosen: (id: InnId) => void): void {
  const st = { focus: 0, chosen: 0 };
  const build = (): MenuSpec => {
    const chosen = INNS[st.chosen];
    const cards: CardSpec[] = INNS.map((inn, i) => ({
      pick: String(i), icon: inn.icon, name: inn.name, tags: inn.traits, on: i === st.chosen, focus: i === st.focus,
      detail: backHtml(inn.icon, inn.name, inn.blurb, inn.back),
    }));
    const choose = (i: number) => { st.chosen = i; st.focus = i; replaceMenu(build()); };
    const settle = () => { confirmed(); onChosen(INNS[st.chosen].id); };
    return {
      title: "Which inn is yours?",
      subtitle: "The small one is the easiest start; the big one is busy enough to need staff",
      modal: true,
      view: {
        html: `<div style="width:min(640px, 88vw)">${grid(cards, { size: "l", cols: 3 })}</div>`,
        onPick: (v) => choose(Number(v)),
        onKey: (e) => {
          if (e.key === "Enter") { settle(); return true; }
          return gridKeys(() => INNS.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, choose)(e);
        },
      },
      items: [{ label: "Move in", sub: chosen.name, button: "primary", action: settle }],
    };
  };
  replaceMenu(build());
}
