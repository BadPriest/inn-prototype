// The wardrobe: which coat the keeper wears, shown as their colour in the room.

import type { Game } from "../game.js";
import { openMenu, replaceMenu, type CardScreen } from "./menu.js";
import { grid, type CardSpec } from "./cards.js";

export const COATS: { id: string; name: string; color: string }[] = [
  { id: "linen", name: "Linen", color: "#f2e2c2" },
  { id: "ochre", name: "Ochre", color: "#d9a441" },
  { id: "rust", name: "Rust", color: "#c0603a" },
  { id: "rose", name: "Rose", color: "#d98a9a" },
  { id: "plum", name: "Plum", color: "#7d4a78" },
  { id: "sage", name: "Sage", color: "#8fae86" },
  { id: "bottle", name: "Bottle green", color: "#3f6b4a" },
  { id: "slate", name: "Slate blue", color: "#5d7896" },
  { id: "navy", name: "Navy", color: "#2f3f63" },
  { id: "charcoal", name: "Charcoal", color: "#4a4744" },
];

export const coatColor = (g: Game): string => (COATS.find((c) => c.id === g.coat) ?? COATS[0]).color;
/** What shows under the coat: the head. */
export const underColor = (g: Game): string => (COATS.find((c) => c.id === g.under) ?? COATS[0]).color;

/** Dark eyes on a light coat, light ones on a dark coat. */
export function eyeColor(coat: string): string {
  const n = parseInt(coat.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 110 ? "#f4ead6" : "#2a1d14";
}

type Part = "coat" | "under";
let part: Part = "coat";

export function openWardrobe(g: Game): void {
  const st = { focus: Math.max(0, COATS.findIndex((c) => c.id === g[part])) };
  const build = (): CardScreen => {
    const worn = g[part];
    // Each swatch shows the whole keeper: the coat, and the head on top.
    const cards: CardSpec[] = COATS.map((c, i) => ({
      pick: String(i), name: c.name, focus: i === st.focus, on: c.id === worn,
      icon: `<span class="coat-swatch" style="background:${part === "coat" ? c.color : coatColor(g)}"><i style="background:${part === "under" ? c.color : underColor(g)}"></i></span>`,
      status: c.id === worn ? "wearing it" : "",
      tone: "good",
    }));
    const pick = (i: number) => {
      const c = COATS[i];
      if (!c) return;
      st.focus = i;
      if (g[part] !== c.id) {
        g[part] = c.id;
        g.bus.emit({ type: "MenuSound", sound: "tick" });
        g.say(part === "coat" ? `You put on the ${c.name.toLowerCase()} coat.` : `${c.name} underneath.`);
      }
      replaceMenu(build());
    };
    const switchTab = (to: Part) => { part = to; st.focus = Math.max(0, COATS.findIndex((c) => c.id === g[part])); g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); replaceMenu(build()); };
    return {
      title: "🧥 Wardrobe",
      subtitle: "Your good coat, your other coats, and what goes under · pick one to wear it",
      tabs: { list: [{ id: "coat", label: "🧥 Coat" }, { id: "under", label: "👕 Under it" }], current: part, pick: (id) => switchTab(id as Part) },
      cards: grid(cards, { cols: 5, size: "s" }),
      onPick: (v) => pick(Number(v)),
      nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: pick },
    };
  };
  openMenu(build());
}
