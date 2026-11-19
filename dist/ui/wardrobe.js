// The wardrobe: which coat the keeper wears, shown as their colour in the room.
import { openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
export const COATS = [
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
export const coatColor = (g) => (COATS.find((c) => c.id === g.coat) ?? COATS[0]).color;
/** Dark eyes on a light coat, light ones on a dark coat. */
export function eyeColor(coat) {
    const n = parseInt(coat.slice(1), 16);
    const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return lum < 110 ? "#f4ead6" : "#2a1d14";
}
export function openWardrobe(g) {
    const st = { focus: Math.max(0, COATS.findIndex((c) => c.id === g.coat)) };
    const build = () => {
        const cards = COATS.map((c, i) => ({
            pick: String(i), name: c.name, focus: i === st.focus, on: c.id === g.coat,
            icon: `<span class="coat-swatch" style="background:${c.color}"></span>`,
            status: c.id === g.coat ? "wearing it" : "",
            tone: "good",
        }));
        const pick = (i) => {
            const c = COATS[i];
            if (!c)
                return;
            st.focus = i;
            if (g.coat !== c.id) {
                g.coat = c.id;
                g.bus.emit({ type: "MenuSound", sound: "tick" });
                g.say(`You put on the ${c.name.toLowerCase()} coat.`);
            }
            replaceMenu(build());
        };
        return {
            title: "🧥 Wardrobe",
            subtitle: "Your good coat, your other coats",
            view: {
                html: grid(cards, { cols: 5, size: "s" }),
                onPick: (v) => pick(Number(v)),
                onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, pick),
            },
            items: [],
        };
    };
    openMenu(build());
}
