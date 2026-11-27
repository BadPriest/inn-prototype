// Table snack effects (inn#74): a bowl on a guest's table works on them while it isn't empty and
// they're eating from it (its tags suit them). Effects come from the dish's effects.onConsuming:
// patience (a share longer), hunger and thirst (added per game hour), openness, and flipTag (a tag
// on what they're served counts as another). Ale and cider's openness reaches whoever drinks them.
import { TOO_HOT, SNACKS, dishData } from "./data.js";
import { ECONOMY_DATA } from "./gamedata.gen.js";
import { tooHot } from "./warmth.js";
import { tagScore } from "./tastes.js";
/** The bowl a guest is eating from, if any: on their table, not empty, and to their taste. */
export function bowlFor(g, p) {
    const seat = g.world.seats.find((s) => s.id === p.seatId);
    const key = g.bowlKeyFor(seat);
    const bowl = key ? g.bowls.get(key) : undefined;
    if (!bowl || bowl.left <= 0)
        return undefined;
    const snack = SNACKS.find((x) => x.id === bowl.snack);
    if (!snack || tagScore(snack.tags, p.tastes.food).score < 0)
        return undefined;
    return snack;
}
/** Everything the bowl does for this guest now. */
export function bowlEffects(g, p) {
    return bowlFor(g, p)?.effects ?? [];
}
const sum = (effects, k) => effects.reduce((a, e) => a + (e[k] ?? 0), 0);
/** How long they'll wait, with the bowl's patience. */
export const patienceOf = (g, p) => p.patience * (1 + sum(bowlEffects(g, p), "patience")) * (g.dark ? ECONOMY_DATA.upkeep.lampOil.darkPatience : 1) * (1 - TOO_HOT.patience * tooHot(g, p));
/** Hunger and thirst the bowl adds, per game hour. */
export const bowlNeeds = (g, p) => { const e = bowlEffects(g, p); return { hunger: sum(e, "hunger"), thirst: sum(e, "thirst") }; };
/** Their openness: their own, the bowl's, and what they've drunk this visit. */
export const opennessOf = (g, p, base) => Math.min(1, base + sum(bowlEffects(g, p), "openness") + (p.opennessBonus ?? 0));
/** A dish or drink they've been served: its own effects on them (ale loosens tongues). */
export function servedEffects(p, recipeId) {
    const effects = dishData(recipeId)?.effects?.onConsuming ?? [];
    p.opennessBonus = (p.opennessBonus ?? 0) + sum(effects, "openness");
}
/** Tags as this guest tastes them, with the bowl's flips; and the flips that happened. */
export function flipTags(g, p, tags) {
    const flips = bowlEffects(g, p).map((e) => e.flipTag).filter((f) => !!f && tags.includes(f.from));
    if (!flips.length)
        return { tags, flips };
    return { tags: [...new Set(tags.map((t) => flips.find((f) => f.from === t)?.to ?? t))], flips };
}
/** Show a flip over a guest's head: the old tag in a pill, turning over to the new. */
export function showFlip(g, p, from, to) {
    g.tagFlips = g.tagFlips.filter((f) => f.patronId !== p.id);
    g.tagFlips.push({ patronId: p.id, from, to, at: performance.now() });
}
