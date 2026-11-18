// Coin (Nov 17 economy session). Three coins, ten of each to the next: 10d = 1s, 10s = 1 crown.
// Guests always pay for what they ordered; tips follow the reaction; unasked serves are on the house.
// Prices come from the dish and what went in it, never inflate, and move only with the house knob.
//
// Kept apart from reputation and knowledge: coin is spent, the other two never are.
/** All money is counted in pennies. */
export const PENCE_PER_SHILLING = 10;
export const PENCE_PER_CROWN = 100;
/** What a new keeper starts with: about two crowns (a week's restock and one small buy). */
export const STARTING_PURSE = 2 * PENCE_PER_CROWN;
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
// Prices. Placeholders from the session's baseline (ale 4d, tea 3d, stew 6d), to be tuned in play.
/** What a dish sells for at Fair, in pennies: the dish and its prep. */
const DISH_PRICE = {
    ale: 4, cider: 4, tea: 3, coffee: 3,
    stew: 6, porridge: 3, fish: 7, pie: 6, salad: 5, scrambled: 5, toast: 3, fryup: 8, bread: 2, roast: 9,
};
/** Dearer things that go in it add to the price. Everything else is in the dish's price already. */
const INGREDIENT_EXTRA = { beef: 1, sausage: 1, meat: 1, bacon: 1, cheese: 1, herring: 1, pork: 1, lamb: 2, fowl: 1 };
/** A garnish on a drink: a penny. */
const GARNISH_EXTRA = 1;
export const PRICE_LEVELS = [
    { id: "cheap", name: "Cheap", factor: 0.75, flow: 1.1, blurb: "a quarter off everything; a few more come in" },
    { id: "fair", name: "Fair", factor: 1, flow: 1, blurb: "what things are worth" },
    { id: "dear", name: "Dear", factor: 1.3, flow: 0.9, blurb: "a bit more on everything; a few fewer come in" },
];
export const priceLevel = (g) => PRICE_LEVELS.find((l) => l.id === g.priceLevel) ?? PRICE_LEVELS[1];
/** What a dish on the bill sells for now (no ingredients chosen: the plain dish). */
export function priceOfRecipe(g, recipeId, options = [], garnished = false) {
    const base = (DISH_PRICE[recipeId] ?? 4) + options.reduce((a, o) => a + (INGREDIENT_EXTRA[o] ?? 0), 0) + (garnished ? GARNISH_EXTRA : 0);
    return Math.max(1, Math.round(base * priceLevel(g).factor));
}
export function priceOf(g, item) {
    return priceOfRecipe(g, item.recipeId, item.options ?? [], !!item.garnish);
}
/** A tip, by how it went: a Delight tips well, Pleased a little, anything else nothing. Modest either way. */
export function tipFor(outcome, price) {
    if (outcome === "DELIGHT")
        return Math.max(2, Math.round(price * 0.5));
    if (outcome === "PLEASED")
        return Math.max(1, Math.round(price * 0.15));
    return 0;
}
/**
 * A guest pays for what they ordered, now. A tip isn't handed over yet: it builds up over the visit and
 * is paid in one go when they get up to leave (payTips), so a good visit ends on a bigger moment.
 */
export function takeCoin(g, p, paid, tip, delight = false) {
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
/** Walking out on an order: they still leave half the tip they'd built up (well served all evening, one thing went wrong). */
export function halveTips(p) {
    p.tipOwed = Math.floor((p.tipOwed ?? 0) / 2);
}
/** Spend from the purse (equipment, upkeep, supplies: later tasks). False if there isn't enough. */
export function spend(g, pence) {
    if (g.purse < pence)
        return false;
    g.purse -= pence;
    g.stats.spent = (g.stats.spent ?? 0) + pence;
    return true;
}
