// Ready-made goods (inn#64): a baker's pie for the pie safe, a batch of the baker's bread for the
// bread case. They serve guests who order pie or bread like your own, with one broad tag: pleasant
// for most, a Delight for almost nobody. No recipe needed, and no oven. Priced from what they cost
// (economy.json price.readyMade).
import { RECIPES } from "./data.js";
import { uid } from "./core.js";
import { breadCaseKeys } from "./crafting.js";
import { applyTaken, have, takeStockFrom } from "./stock.js";
/** Each ready-made good: the dish it serves as, how many servings, and where it's kept. */
export const READY_MADE = {
    bakersPie: { dish: "pie", servings: 6, name: "Baker's pie", keptIn: "piesafe" },
    bakersBread: { dish: "bread", servings: 8, name: "Baker's bread", keptIn: "breadcase" },
};
const goodFor = (dish) => Object.entries(READY_MADE).find(([, r]) => r.dish === dish);
function readyItem(id, tags) {
    const r = READY_MADE[id];
    return { id: uid(), recipeId: r.dish, name: r.name, kind: "food", tags, options: [], readyMade: id };
}
/** Somewhere to keep it: a pie safe, a bread case. */
const keepers = (g, keptIn) => g.world.furniture.filter((f) => f.kind === keptIn);
/** Set one out from the pantry: a pie into the pie safe, a batch into a bread case. False if there's none or no room. */
export function setOut(g, id, quiet = false) {
    const r = READY_MADE[id];
    if (!r || have(g, id) < 1)
        return false;
    if (r.keptIn === "piesafe") {
        if (!keepers(g, "piesafe").length || g.pieSafe.length >= g.pieSafeCapacity)
            return false;
        const taken = takeStockFrom(g, [{ id, units: 1 }]);
        const item = readyItem(id, applyTaken(["homely"], taken));
        g.pieSafe.push({ id: uid(), item, left: r.servings, total: r.servings, bakedDay: g.day });
    }
    else {
        const key = keepers(g, "breadcase").flatMap((f) => breadCaseKeys(f.id)).find((k) => !g.pots.has(k));
        if (!key)
            return false;
        const taken = takeStockFrom(g, [{ id, units: 1 }]);
        g.pots.set(key, { item: readyItem(id, applyTaken(["homely"], taken)), left: r.servings, total: r.servings });
    }
    if (!quiet)
        g.say(`${r.name} set out: ${r.servings} ${r.keptIn === "piesafe" ? "slices in the pie safe" : "slices in the bread case"}.`);
    return true;
}
/** After a delivery's carried in: set out whatever fits, and say so. */
export function setOutDelivered(g) {
    for (const id of Object.keys(READY_MADE)) {
        let n = 0;
        while (setOut(g, id, true))
            n++;
        if (n)
            g.say(`${READY_MADE[id].name}${n > 1 ? ` ×${n}` : ""} set out in the ${READY_MADE[id].keptIn === "piesafe" ? "pie safe" : "bread case"}.`);
    }
}
/** Can this dish be served without cooking it: a place to keep it, and some kept or in the pantry. */
export function servedReadyMade(g, dish) {
    const found = goodFor(dish);
    if (!found)
        return false;
    const [id, r] = found;
    if (!keepers(g, r.keptIn).length)
        return false;
    if (r.keptIn === "piesafe")
        return g.pieSafe.length > 0 || have(g, id) > 0;
    return keepers(g, "breadcase").some((f) => breadCaseKeys(f.id).some((k) => g.pots.has(k))) || have(g, id) > 0;
}
export const readyMadeRecipe = (id) => RECIPES.find((x) => x.id === READY_MADE[id]?.dish);
