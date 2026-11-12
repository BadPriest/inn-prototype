// Cooking sounds that run while something is happening: the kettle while tea brews,
// the stew bubbling while it cooks and simmering while the pot has servings.
// Each frame: what should be sounding, and from where? Start what's missing, fade out what's done.

import type { Game } from "../game.js";
import { RECIPES, SOUND_TUNING as T } from "../data.js";
import type { Vec } from "../world.js";
import { play, stop, type Voice } from "./engine.js";

const loops = new Map<string, Voice | null>(); // "<sound>@<furniture id>" -> voice

function wanted(g: Game): Map<string, Vec> {
  const want = new Map<string, Vec>();
  const at = (fid: string) => g.world.furniture.find((x) => x.id === fid)?.center;
  for (const [fid, job] of g.jobs) {
    const r = RECIPES.find((x) => x.id === job.recipeId);
    const c = at(fid);
    if (job.done || !r || !c) continue;
    if (r.station === "kettle") want.set(`kettle@${fid}`, c);
    else if (r.id === "stew") want.set(`stewCooking@${fid}`, c);
  }
  for (const [fid, pot] of g.pots) {
    const c = at(fid);
    if (pot.left > 0 && pot.item.recipeId === "stew" && c) want.set(`stewSimmering@${fid}`, c);
  }
  return want;
}

export function cookingLoops(g: Game): void {
  const want = wanted(g);
  for (const [id, v] of loops) if (!want.has(id)) { stop(v, T.loopFadeMs); loops.delete(id); }
  for (const [id, at] of want) if (!loops.get(id)) loops.set(id, play(id.split("@")[0], at, { fadeInMs: T.loopFadeMs }));
}
