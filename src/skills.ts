// The keeper's recipe book: what they know how to make, and the points guests served earn to learn more
// (data/skills.json). What's bought in (ale, cider, bought snacks) needs no recipe.

import { SKILLS_DATA } from "./gamedata.gen.js";
import { RECIPES, type Recipe } from "./data.js";
import type { Game } from "./game.js";

export const SKILLS = SKILLS_DATA;

/** Needs a recipe: made at a station, and not the kettle's hot water. */
export const needsRecipe = (r: Recipe): boolean => !r.internal && r.station !== "tap";

export function knows(g: Game, id: string): boolean {
  const r = RECIPES.find((x) => x.id === id);
  return !r || !needsRecipe(r) || g.known.has(id);
}

export const costOf = (id: string): number => SKILLS.recipes.find((x) => x.dish === id)?.points ?? 0;
export const earnedPoints = (g: Game): number => Math.floor(g.totalServed / SKILLS.servedPerPoint);
export const pointsLeft = (g: Game): number => Math.max(0, earnedPoints(g) - g.pointsSpent);
/** Guests still to serve before the next point. */
export const toNextPoint = (g: Game): number => SKILLS.servedPerPoint - (g.totalServed % SKILLS.servedPerPoint);

export function learn(g: Game, id: string): boolean {
  const cost = costOf(id);
  if (g.known.has(id) || pointsLeft(g) < cost) return false;
  g.known.add(id);
  g.pointsSpent += cost;
  return true;
}

/** A new point earned: said once, with a chime. */
let lastEarned: number | null = null;
export function watchSkills(g: Game): void {
  const now = earnedPoints(g);
  if (lastEarned !== null && now > lastEarned) {
    const left = pointsLeft(g);
    g.say(`✦ You've picked up enough to learn a new recipe: ${left} point${left === 1 ? "" : "s"} to spend in Skills, at the desk.`);
  }
  lastEarned = now;
}
