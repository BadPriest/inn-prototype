// The "Today" checklist: what to do before opening. The HUD shows it; ticking an item off
// is announced (a Paper event), so the sound of a pen tick can follow.
import { RECIPES, SNACKS } from "./data.js";
import { stockOf } from "./crafting.js";
export function objectives(g) {
    const big = RECIPES.filter((r) => g.menu.has(r.id) && r.servings);
    const bigText = big.length
        ? `Prepare the big dishes on the menu: ${big.map((r) => `${r.icon} ${r.name.toLowerCase()}${stockOf(g, r.id) ? " ✓" : ""}`).join(", ")}`
        : "Prepare the big dishes on the menu (none today)";
    return [
        { text: "Set the bill of fare at the desk in your room", done: g.menuChosen },
        { text: bigText, done: big.every((r) => stockOf(g, r.id) > 0) },
        { text: `Set out snacks on the tables ${SNACKS.map((x) => x.icon).join("")}`, done: [...g.bowls.values()].some((b) => b.left > 0), optional: true },
        { text: "Open the inn at the front door", done: g.open },
    ];
}
// Only an item that becomes done while you play is announced: not what's already done when a day starts.
let seen = null;
export function watchObjectives(g) {
    const done = objectives(g).map((o) => o.done);
    if (seen && seen.day === g.day && done.some((d, i) => d && !seen.done[i]))
        g.bus.emit({ type: "Paper", what: "objective" });
    seen = { day: g.day, done };
}
