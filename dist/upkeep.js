// Upkeep (inn#60): the cost of keeping the inn open, each something you can see (economy.json upkeep).
// Firewood burns in the hearth and the wood stoves, lamp oil in the lamps, sundries go with each
// guest served; all three are pantry goods, ordered like any other. The licence is paid weekly.
import { ECONOMY_DATA } from "./gamedata.gen.js";
import { INGREDIENTS } from "./data.js";
import { have, takeStockFrom } from "./stock.js";
const U = ECONOMY_DATA.upkeep;
const worth = (id) => INGREDIENTS.find((x) => x.id === id)?.worth ?? 0;
/** Use some up, if there's enough; it counts towards today's upkeep. */
function use(g, id, units) {
    if (units <= 0)
        return true;
    if (have(g, id) < units)
        return false;
    takeStockFrom(g, [{ id, units }]);
    g.stats.upkeep = (g.stats.upkeep ?? 0) + worth(id) * units;
    return true;
}
/** Wood stoves with something cooking on them now. */
function stovesBurning(g) {
    return g.world.furniture.filter((f) => f.equip?.fuel === "wood" && (f.slots ?? []).some((sl) => { const j = g.jobs.get(sl.id); return j && !j.done; })).length;
}
/** Out of something: said once, until there's some again. */
const saidOut = new Set();
function out(g, id, line) {
    if (saidOut.has(id))
        return;
    saidOut.add(id);
    g.say(line);
}
/** Every frame the clock runs: burn wood and oil. `simMinutes`: game minutes passed. */
export function updateUpkeep(g, simMinutes) {
    const h = simMinutes / 60;
    const wood = U.firewood.item;
    if (g.fireLit) {
        const cold = g.date.season === "winter" || g.weather.rain > 0 ? U.firewood.coldOrWetFactor : 1;
        if (!use(g, wood, U.firewood.fireLogsPerHour * cold * h)) {
            g.fireLit = false;
            out(g, "fire", "🪵 The fire's burned down: there's no firewood left. Order some at the desk (Supplies).");
        }
    }
    const stoves = stovesBurning(g);
    g.noFirewood = stoves > 0 && !use(g, wood, U.firewood.stoveLogsPerHour * stoves * h);
    if (g.noFirewood)
        out(g, "stove", "🪵 No firewood for the stove: the cooking's stopped. Order some at the desk (Supplies).");
    if (g.lampsLit && !use(g, U.lampOil.item, U.lampOil.pintsPerHour * h)) {
        g.lampsLit = false;
        out(g, "oil", "🛢️ The lamps sputter out: no lamp oil left. Order some at the desk (Supplies).");
    }
    if (have(g, wood) > 0) {
        saidOut.delete("fire");
        saidOut.delete("stove");
    }
    if (have(g, U.lampOil.item) > 0)
        saidOut.delete("oil");
}
/** Can the lamps be lit? */
export const hasLampOil = (g) => have(g, U.lampOil.item) >= U.lampOil.pintsPerHour / 4;
/** Can the fire be lit? */
export const hasFirewood = (g) => have(g, U.firewood.item) >= 1;
/** A guest served: sundries go with it. False if there were none (tips suffer). */
export function useSundries(g) {
    if (use(g, U.sundries.item, U.sundries.perGuest)) {
        saidOut.delete("sundries");
        return true;
    }
    out(g, "sundries", "🧻 No napkins, no soap: you're out of sundries, and guests notice. Order a box at the desk (Supplies).");
    return false;
}
/** What a tip comes to with no sundries in the house. */
export const tipWithoutSundries = (tip) => Math.floor(tip * U.sundries.tipShareWithout);
/** Morning: the licence, on its weekday (not on the very first day). */
export function payLicence(g) {
    if (g.day <= 1 || g.date.weekday !== U.licence.weekday)
        return;
    const p = U.licence.pence;
    g.purse -= p;
    g.stats.spent = (g.stats.spent ?? 0) + p;
    g.stats.upkeep = (g.stats.upkeep ?? 0) + p;
    g.say(`🧾 The licence for the week is due: ${p}d paid.`);
}
/** Upkeep goods running low (under about a day's worth), for the morning checklist. */
export function upkeepLow(g) {
    const low = [];
    if (have(g, U.firewood.item) < 15)
        low.push("firewood");
    if (have(g, U.lampOil.item) < 1.5)
        low.push("lamp oil");
    if (have(g, U.sundries.item) < 0.5)
        low.push("sundries");
    return low;
}
