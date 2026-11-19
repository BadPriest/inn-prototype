// The keeper's recipe book: what they know how to make, and the points guests served earn to learn more
// (data/skills.json). What's bought in (ale, cider, bought snacks) needs no recipe.
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
export const earnedPoints = (g) => Math.floor(g.totalServed / SKILLS.servedPerPoint);
export const pointsLeft = (g) => Math.max(0, earnedPoints(g) - g.pointsSpent);
/** Guests still to serve before the next point. */
export const toNextPoint = (g) => SKILLS.servedPerPoint - (g.totalServed % SKILLS.servedPerPoint);
export function learn(g, id) {
    const cost = costOf(id);
    if (g.known.has(id) || pointsLeft(g) < cost)
        return false;
    g.known.add(id);
    g.pointsSpent += cost;
    return true;
}
/** A new point earned: said once, with a chime. */
let lastEarned = null;
export function watchSkills(g) {
    const now = earnedPoints(g);
    if (lastEarned !== null && now > lastEarned) {
        const left = pointsLeft(g);
        g.say(`✦ You've picked up enough to learn a new recipe: ${left} point${left === 1 ? "" : "s"} to spend in Skills, at the desk.`);
    }
    lastEarned = now;
}
