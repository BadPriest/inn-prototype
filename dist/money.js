// Coin (Nov 17 economy session). Three coins, ten of each to the next: 10d = 1s, 10s = 1 crown.
// Guests always pay for what they ordered; tips follow the reaction; unasked serves are on the house.
// Prices come from the dish and what went in it, never inflate, and move only with the house knob.
//
// Kept apart from reputation and knowledge: coin is spent, the other two never are.
import { knack } from "./skills.js";
import { ECONOMY_DATA, SPOILAGE_DATA } from "./gamedata.gen.js";
import { INGREDIENTS, RECIPES, TUNING, currentDishId, dishData, traySlotsOf } from "./data.js";
/** All money is counted in pennies. */
export const PENCE_PER_SHILLING = 10;
export const PENCE_PER_CROWN = 100;
export const STARTING_PURSE = ECONOMY_DATA.startingPurse;
/** 247 → "2 cr 4s 7d". Zero parts are left out; nothing at all is "0d". */
export function fmtMoney(pence) {
    const neg = pence < 0;
    let d = Math.abs(Math.round(pence));
    const cr = Math.floor(d / PENCE_PER_CROWN);
    d -= cr * PENCE_PER_CROWN;
    const s = Math.floor(d / PENCE_PER_SHILLING);
    d -= s * PENCE_PER_SHILLING;
    const parts = [cr ? `${cr} cr` : "", s ? `${s}s` : "", d || (!cr && !s) ? `${d}d` : ""].filter(Boolean);
    return `${neg ? "−" : ""}${parts.join(" ")}`;
}
export const COINS = {
    cr: { name: "crown", face: "#f6d24a", rim: "#b8860b", edge: "#8a6208" },
    s: { name: "shilling", face: "#e3e8ec", rim: "#9aa4ad", edge: "#6d767e" },
    d: { name: "penny", face: "#d98a4e", rim: "#9a5527", edge: "#6e3a17" },
};
/** 193 → [1 crown, 9 shillings, 3 pence]. Zero coins are left out; nothing at all is 0 pence. */
export function coinParts(pence) {
    let d = Math.abs(Math.round(pence));
    const cr = Math.floor(d / PENCE_PER_CROWN);
    d -= cr * PENCE_PER_CROWN;
    const s = Math.floor(d / PENCE_PER_SHILLING);
    d -= s * PENCE_PER_SHILLING;
    const parts = [];
    if (cr)
        parts.push({ coin: "cr", n: cr });
    if (s)
        parts.push({ coin: "s", n: s });
    if (d || !parts.length)
        parts.push({ coin: "d", n: d });
    return parts;
}
/** Money for the screen (HTML): each coin drawn, then its count. The words are kept for screen readers and hover. */
export function moneyHtml(pence) {
    const coins = coinParts(pence).map((p) => `<span class="cn"><i class="coin ${p.coin}"></i>${p.n}</span>`).join("");
    return `<span class="money" title="${fmtMoney(pence)}" aria-label="${fmtMoney(pence)}">${pence < 0 ? "−" : ""}${coins}</span>`;
}
// ---------------------------------------------------------------------------
// Prices, worked out from what goes in (data/economy.json):
//   (ingredient cost + prep + per tray slot x tray slots) x (1 + margin) x (1 + markup) x house level x staleness
const P = ECONOMY_DATA.price;
const worthOf = (id) => INGREDIENTS.find((x) => x.id === id)?.worth ?? 0;
const GARNISH_INGREDIENT = { sprig: "mint" };
const STALE_FACTOR = SPOILAGE_DATA.stageEffects.stale?.priceFactor ?? 1;
/** The units of an ingredient a dish uses when it's chosen (from its base or its extras). */
function unitsOf(r, id) {
    return [...r.base.options, ...r.optional.options].find((o) => o.id === id)?.units ?? 1;
}
/** The cheapest way to make a dish: the fewest, cheapest choices it allows. */
function cheapestChoices(r) {
    const cheapest = (c) => [...c.options].sort((a, b) => a.units * worthOf(a.id) - b.units * worthOf(b.id)).slice(0, c.pick[0]).map((o) => o.id);
    return [...cheapest(r.base), ...cheapest(r.optional)];
}
/** Worked out at Fair, before markup and the house level, for one serving. */
function workedOutPrice(r, options) {
    const fixed = dishData(r.id)?.price?.fixed;
    if (fixed !== undefined)
        return fixed;
    const servings = r.servings?.[0] ?? 1;
    const ingredients = r.fundamental.reduce((a, u) => a + u.units * worthOf(u.id), 0)
        + options.reduce((a, id) => a + unitsOf(r, id) * worthOf(id), 0)
        + (r.boughtAs ? worthOf(r.boughtAs) : 0);
    const prep = r.minutes[0] * (r.tended ? P.prepPerMinute.tended : P.prepPerMinute.untended);
    return (ingredients + prep) / servings + P.perTraySlot * traySlotsOf(r.id);
}
const LEVEL_NAMES = { cheap: "Cheap", fair: "Fair", dear: "Dear" };
function levelBlurb(factor, flow) {
    const pct = Math.round(Math.abs(factor - 1) * 100);
    const crowd = flow > 1 ? "; a few more come in" : flow < 1 ? "; a few fewer come in" : "";
    if (factor < 1)
        return `${pct}% off everything${crowd}`;
    if (factor > 1)
        return `${pct}% on everything${crowd}`;
    return `what things are worth${crowd}`;
}
export const PRICE_LEVELS = ECONOMY_DATA.houseLevels.map((l) => ({ ...l, name: LEVEL_NAMES[l.id], blurb: levelBlurb(l.factor, l.flow) }));
export const priceLevel = (g) => PRICE_LEVELS.find((l) => l.id === g.priceLevel) ?? PRICE_LEVELS.find((l) => l.id === "fair");
export const PRICE_MARKUP = 1 + ECONOMY_DATA.price.markup;
/** What a dish sells for, exactly (fractions of a penny kept). */
function exactPrice(g, recipeId, options, garnish, stale) {
    const r = RECIPES.find((x) => x.id === currentDishId(recipeId));
    if (!r)
        return 4;
    const garnishCost = garnish ? worthOf(GARNISH_INGREDIENT[garnish] ?? garnish) : 0;
    const base = workedOutPrice(r, options) + garnishCost;
    return Math.max(1, base * (1 + P.margin) * PRICE_MARKUP * priceLevel(g).factor * (stale ? STALE_FACTOR : 1));
}
/** What a dish on the bill sells for now, to the penny: made the cheapest way it allows, unless ingredients are given. */
export function priceOfRecipe(g, recipeId, options, garnish) {
    const r = RECIPES.find((x) => x.id === currentDishId(recipeId));
    return Math.round(exactPrice(g, recipeId, options ?? (r ? cheapestChoices(r) : []), garnish, false));
}
/** What a guest pays for this dish: exact, so the markup counts even on a 4d pint. */
export function priceOf(g, item) {
    return exactPrice(g, item.recipeId, item.options ?? [], item.garnish, item.tags.includes(TUNING.staleTag));
}
/** A tip, by how it went: a Delight tips well, Pleased a little, anything else nothing. Modest either way. */
export function tipFor(outcome, price) {
    const rule = outcome === "DELIGHT" ? ECONOMY_DATA.tips.delight : outcome === "PLEASED" ? ECONOMY_DATA.tips.pleased : null;
    return rule ? Math.max(rule.atLeast, Math.round(price * rule.share)) : 0;
}
/**
 * A guest pays for what they ordered, now. A tip isn't handed over yet: it builds up over the visit and
 * is paid in one go when they get up to leave (payTips), so a good visit ends on a bigger moment.
 */
export function takeCoin(g, p, paid, tip, delight = false) {
    if (tip > 0)
        tip += knack(g, "charm", 0);
    if (tip > 0) {
        p.tipOwed = (p.tipOwed ?? 0) + tip;
        if (delight)
            p.tipDelight = true;
    }
    if (paid <= 0)
        return;
    g.purse += paid;
    g.stats.taken = (g.stats.taken ?? 0) + paid;
    g.coinPops.push({ x: p.pos.x, y: p.pos.y, paid, tip: 0, at: performance.now() });
    g.bus.emit({ type: "CoinPaid", patronId: p.id, paid, tip: 0, delight: false });
}
/** Leaving: everything they meant to tip this visit, all at once. Quietly at closing time (shown = false). */
export function payTips(g, p, shown = true) {
    const tip = p.tipOwed ?? 0;
    if (tip <= 0)
        return;
    g.purse += tip;
    g.stats.tips = (g.stats.tips ?? 0) + tip;
    p.tipOwed = 0;
    if (!shown)
        return;
    g.coinPops.push({ x: p.pos.x, y: p.pos.y, paid: 0, tip, at: performance.now() });
    g.bus.emit({ type: "CoinPaid", patronId: p.id, paid: 0, tip, delight: !!p.tipDelight });
}
export function cutTipsForWalkout(p) {
    p.tipOwed = Math.floor((p.tipOwed ?? 0) * ECONOMY_DATA.tips.walkoutShare);
}
/** Spend from the purse (equipment, upkeep, supplies: later tasks). False if there isn't enough. */
export function spend(g, pence) {
    if (g.purse < pence)
        return false;
    g.purse -= pence;
    g.stats.spent = (g.stats.spent ?? 0) + pence;
    return true;
}
