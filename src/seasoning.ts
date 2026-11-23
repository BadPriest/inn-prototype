import { EQUIPMENT_DATA } from "./gamedata.gen.js";
import type { SeasoningTrait } from "./gamedata.js";
import type { Game } from "./game.js";
import { lowerName } from "./data.js";

const S = EQUIPMENT_DATA.seasoning;

/** The piece a place to cook belongs to: the gear hanging or standing there, or the stove or oven itself. */
export function pieceOf(g: Game, slotId: string): { uid: string; name: string } | undefined {
  const sl = g.world.slot(slotId);
  if (!sl) return undefined;
  return sl.gear ? { uid: sl.id, name: sl.gear.name } : { uid: sl.f.id, name: sl.f.name };
}

/** Level 1 to start; one more at each of `levelsAt`. */
export const seasonLevel = (made: number): number => 1 + S.levelsAt.filter((n) => made >= n).length;
/** Servings still to make for the next level, if there is one. */
export const toNextLevel = (made: number): { left: number; at: number } | undefined => {
  const at = S.levelsAt.find((n) => made < n);
  return at === undefined ? undefined : { left: at - made, at };
};

export const traitById = (id: string): SeasoningTrait | undefined => S.traits.find((t) => t.id === id);
const traitsAt = (g: Game, slotId: string): SeasoningTrait[] => {
  const p = pieceOf(g, slotId);
  return p ? (g.seasoning[p.uid]?.traits ?? []).map(traitById).filter((t): t is SeasoningTrait => !!t) : [];
};

export const seasonedSpeed = (g: Game, slotId: string): number => traitsAt(g, slotId).reduce((a, t) => a * (t.speed ?? 1), 1);
export const seasonedServings = (g: Game, slotId: string): number => traitsAt(g, slotId).reduce((a, t) => a + (t.servings ?? 0), 0);
export const seasonedTags = (g: Game, slotId: string): string[] => traitsAt(g, slotId).flatMap((t) => (t.tag ? [t.tag] : []));

function roll(level: number, have: string[], batches: boolean): SeasoningTrait | undefined {
  const pool = S.traits.filter((t) => !have.includes(t.id) && (!t.tag || level >= S.tastesFromLevel) && (!t.batchesOnly || batches));
  let r = Math.random() * pool.reduce((a, t) => a + t.weight, 0);
  return pool.find((t) => (r -= t.weight) < 0) ?? pool[pool.length - 1];
}

/** Something was made here: count it, and level the piece up if it's due. */
export function countMade(g: Game, slotId: string, servings: number, batch: boolean): void {
  const p = pieceOf(g, slotId);
  if (!p) return;
  const s = (g.seasoning[p.uid] ??= { made: 0, traits: [] });
  if (batch) s.batches = true;
  const before = seasonLevel(s.made);
  s.made += servings;
  for (let level = before + 1; level <= seasonLevel(s.made); level++) {
    const t = roll(level, s.traits, !!s.batches);
    if (!t) continue;
    s.traits.push(t.id);
    const line = `The ${lowerName(p.name)} has worn in (level ${level}): ${t.name.toLowerCase()}, ${t.text}.`;
    g.say(`✦ ${line}`);
    g.stats.moments.push(line);
  }
}
