import { EQUIPMENT_DATA } from "./gamedata.gen.js";
import { lowerName } from "./data.js";
const S = EQUIPMENT_DATA.seasoning;
/** The piece a place to cook belongs to: the gear hanging or standing there, or the stove or oven itself. */
export function pieceOf(g, slotId) {
    const sl = g.world.slot(slotId);
    if (!sl)
        return undefined;
    return sl.gear ? { uid: sl.id, name: sl.gear.name, type: sl.gear.id } : { uid: sl.f.id, name: sl.f.name, type: sl.f.equip?.id ?? "" };
}
/** Level 1 to start; one more at each of `levelsAt`. */
export const seasonLevel = (made) => 1 + S.levelsAt.filter((n) => made >= n).length;
/** Servings still to make for the next level, if there is one. */
export const toNextLevel = (made) => {
    const at = S.levelsAt.find((n) => made < n);
    return at === undefined ? undefined : { left: at - made, at };
};
export const traitById = (id) => S.traits.find((t) => t.id === id);
const traitsAt = (g, slotId) => {
    const p = pieceOf(g, slotId);
    return p ? (g.seasoning[p.uid]?.traits ?? []).map(traitById).filter((t) => !!t) : [];
};
export const seasonedSpeed = (g, slotId) => traitsAt(g, slotId).reduce((a, t) => a * (t.speed ?? 1), 1);
export const seasonedServings = (g, slotId) => traitsAt(g, slotId).reduce((a, t) => a + (t.servings ?? 0), 0);
export const seasonedTags = (g, slotId) => traitsAt(g, slotId).flatMap((t) => (t.tag ? [t.tag] : []));
export function roll(level, have, batches, type) {
    const pool = S.traits.filter((t) => !have.includes(t.id) && (!t.tag || level >= S.tastesFromLevel) && (!t.batchesOnly || batches)
        && !t.usedOnly && (!t.fits || t.fits.includes(type)));
    let r = Math.random() * pool.reduce((a, t) => a + t.weight, 0);
    return pool.find((t) => (r -= t.weight) < 0) ?? pool[pool.length - 1];
}
/** Something was made here: count it, and level the piece up if it's due. */
export function countMade(g, slotId, servings, batch) {
    const p = pieceOf(g, slotId);
    if (!p)
        return;
    const s = (g.seasoning[p.uid] ??= { made: 0, traits: [] });
    if (batch)
        s.batches = true;
    const before = seasonLevel(s.made);
    s.made += servings;
    for (let level = before + 1; level <= seasonLevel(s.made); level++) {
        const t = roll(level, s.traits, !!s.batches, p.type);
        if (!t)
            continue;
        s.traits.push(t.id);
        const line = `The ${lowerName(p.name)} has worn in (level ${level}): ${t.name.toLowerCase()}, ${t.text}.`;
        g.say(`✦ ${line}`);
        g.stats.moments.push(line);
    }
}
/** The traits only used hardware has. */
export const usedOnlyTraits = () => S.traits.filter((t) => t.usedOnly);
/** Servings made to reach each level from 2 up. */
export const levelsAt = () => S.levelsAt;
