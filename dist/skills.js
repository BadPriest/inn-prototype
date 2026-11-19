// The keeper's level and recipe book (data/skills.json). Guests served earn experience by how they took
// it; each level up is a point to spend in Skills at the desk, on a recipe or a knack's next tier.
// What's bought in (ale, cider, bought snacks) needs no recipe.
import { SKILLS_DATA } from "./gamedata.gen.js";
import { RECIPES } from "./data.js";
export const SKILLS = SKILLS_DATA;
/** Needs a recipe: made at a station, and not the kettle's hot water. */
export const needsRecipe = (r) => !r.internal && r.station !== "tap";
export function knows(g, id) {
    const r = RECIPES.find((x) => x.id === id);
    return !r || !needsRecipe(r) || g.known.has(id);
}
export const costOf = (id) => SKILLS.recipes.find((x) => x.dish === id)?.points ?? 0;
/** Experience needed to reach this many levels up from the start. */
export const xpFor = (levels) => levels * SKILLS.levels.first + (SKILLS.levels.step * levels * (levels - 1)) / 2;
/** Levels gained so far: one point each. */
export function earnedPoints(g) {
    let n = 0;
    while (xpFor(n + 1) <= g.xp)
        n++;
    return n;
}
/** The keeper's level, starting at 1. */
export const levelOf = (g) => earnedPoints(g) + 1;
export const pointsLeft = (g) => Math.max(0, earnedPoints(g) - g.pointsSpent);
/** Towards the next level: experience in, and needed for, this level. */
export function levelProgress(g) {
    const n = earnedPoints(g);
    return { have: g.xp - xpFor(n), need: xpFor(n + 1) - xpFor(n) };
}
export function gainXp(g, outcome) {
    g.xp += SKILLS.xpPerServe[outcome] ?? 0;
}
export function learn(g, id) {
    const cost = costOf(id);
    if (g.known.has(id) || pointsLeft(g) < cost)
        return false;
    g.known.add(id);
    g.pointsSpent += cost;
    return true;
}
// ---------------------------------------------------------------------------
// Knacks: bought a tier at a time
export const knackById = (id) => SKILLS.knacks.find((k) => k.id === id);
export const tierOf = (g, id) => g.knacks[id] ?? 0;
/** The next tier to buy, if any. */
export const nextTier = (g, id) => knackById(id).tiers[tierOf(g, id)];
/** What a knack does now: its tier's value, or `none` before the first. */
export function knack(g, id, none) {
    const t = tierOf(g, id);
    return t > 0 ? knackById(id).tiers[t - 1].value : none;
}
export function buyKnack(g, id) {
    const t = nextTier(g, id);
    if (!t || pointsLeft(g) < t.points)
        return false;
    g.knacks[id] = tierOf(g, id) + 1;
    g.pointsSpent += t.points;
    return true;
}
/** A level up: said once, celebrated, and the desk pointed out until Skills is opened. */
let lastEarned = null;
export function watchSkills(g) {
    const now = earnedPoints(g);
    if (lastEarned !== null && now > lastEarned) {
        g.newSkills = true;
        g.say(`✦ Level ${now + 1}! New skills available: spend your point${pointsLeft(g) === 1 ? "" : "s"} in Skills, at the desk.`);
        g.bus.emit({ type: "LevelUp", level: now + 1 });
    }
    lastEarned = now;
}
