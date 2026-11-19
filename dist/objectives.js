// The "Today" checklist: what to do before opening. The HUD shows it; ticking an item off
// is announced (a Paper event), so the sound of a pen tick can follow.
import { DEFAULT_MENU, RECIPES, SNACKS } from "./data.js";
import { stockOf } from "./crafting.js";
import { currentStep, stepText, STEPS } from "./walkthrough.js";
const defaultBill = () => DEFAULT_MENU.map((id) => RECIPES.find((r) => r.id === id)?.name.toLowerCase() ?? id).join(" and ");
export function objectives(g) {
    const big = RECIPES.filter((r) => g.billAllDay().has(r.id) && r.servings);
    const bigText = big.length
        ? `Get the pots going in the kitchen: ${big.map((r) => `${r.icon} ${r.name.toLowerCase()}${stockOf(g, r.id) ? " ✓" : ""}`).join(", ")}`
        : "Get the pots going in the kitchen (nothing on the bill needs one today)";
    return [
        { id: "bill", text: g.menuChosen ? "Sit at the desk in your room and set today's bill of fare" : `The bill of fare is on its default (${defaultBill()}). Sit at the desk in your room and set your own`, done: g.menuChosen },
        { id: "pots", text: bigText, done: big.every((r) => stockOf(g, r.id) > 0) },
        { id: "snacks", text: `Put a bowl of something out on the tables ${SNACKS.map((x) => x.icon).join("")}`, done: [...g.bowls.values()].some((b) => b.left > 0), optional: true },
        { id: "open", text: "Unbolt the front door and open the inn", done: g.open },
        ...(g.toPlace.length ? [{ id: "place", text: `The carter left ${g.toPlace.length === 1 ? "something" : `${g.toPlace.length} things`}: place ${g.toPlace.length === 1 ? "it" : "them"} from the desk, under Arrange the kitchen`, done: false, optional: true }] : []),
    ];
}
/** The one objective to show on the card: the walkthrough's step, else the first of today's still to do. */
export function headline(g) {
    const s = currentStep(g);
    if (s)
        return { key: `w:${s.id}`, kicker: `Step ${g.walkthrough.step + 1} of ${STEPS.length}`, text: stepText(g), reward: s.reward };
    const list = objectives(g);
    const required = list.filter((o) => !o.optional);
    if (g.open && required.every((o) => o.done))
        return null;
    const next = required.find((o) => !o.done) ?? list.find((o) => !o.done);
    return next ? { key: `d:${g.day}:${next.id}`, kicker: "Today", text: next.text } : null;
}
// Only an item that becomes done while you play is announced: not what's already done when a day starts.
let seen = null;
export function watchObjectives(g) {
    const done = objectives(g).map((o) => o.done);
    if (seen && seen.day === g.day && done.some((d, i) => d && !seen.done[i]))
        g.bus.emit({ type: "Paper", what: "objective" });
    seen = { day: g.day, done };
}
