// The pantry: what the inn has of each ingredient, in its units, as batches by the day they came in.
// Cooking, pouring, steeping, garnishing and setting out snack bowls use it up, oldest batch first;
// supplies fill it. Free things (water) never run out.
//
// Shelf life (inn#63): a batch ages from the morning after it arrives, through its ingredient's
// spoilage profile (data/spoilage.json): fresh, then on the turn, stale, spoiled. A dish made with
// something past fresh takes that stage's tags (day-old, sour…). Spoiled batches can't be used, and
// stay on the shelves until they're cleared.
import { INGREDIENTS, TUNING, URN_CAPACITY } from "./data.js";
import { ECONOMY_DATA, INGREDIENTS_DATA, SPOILAGE_DATA } from "./gamedata.gen.js";
const ingredient = (id) => INGREDIENTS.find((x) => x.id === id);
export const isFree = (id) => (ingredient(id)?.worth ?? 0) === 0;
export const unitsOf = (id) => ingredient(id)?.unit ?? "unit";
export const nameOf = (id) => ingredient(id)?.name ?? id;
const IRREGULAR = { loaf: "loaves", pinch: "pinches", bunch: "bunches", lb: "lb", handful: "handfuls", bowlful: "bowlfuls" };
/** "1 loaf", "6 loaves", "2.5 lb". */
export function amount(id, n) {
    const unit = unitsOf(id);
    const shown = +n.toFixed(1);
    return `${shown} ${shown === 1 ? unit : IRREGULAR[unit] ?? `${unit}s`}`;
}
const NO_EFFECT = { addTags: [], removeTags: [], priceFactor: 1, tastePenalty: 0 };
/** Its stages in order (by the age, in days, each starts at). */
function stagesOf(id) {
    const ing = INGREDIENTS_DATA.ingredients.find((x) => x.id === id);
    const profile = SPOILAGE_DATA.profiles[ing?.spoilage ?? "keeps"] ?? SPOILAGE_DATA.profiles.keeps;
    return Object.entries(profile.stages).sort((a, b) => a[1] - b[1]).map(([sid, at]) => ({
        id: sid, at,
        effect: { ...NO_EFFECT, ...SPOILAGE_DATA.stageEffects[sid], ...profile.stageEffects?.[sid], ...ing?.spoilageOverrides?.[sid] },
    }));
}
/** Days old: nothing ages on the day it arrives; from the next morning, by the clock. */
export const ageOf = (g, lot) => Math.max(0, g.day + g.minute / TUNING.dayLengthMinutes - (lot.day + 1));
export function stageOf(g, id, lot) {
    const stages = stagesOf(id);
    const age = ageOf(g, lot);
    let i = 0;
    while (i + 1 < stages.length && age >= stages[i + 1].at)
        i++;
    return { id: stages[i].id, index: i, last: i === stages.length - 1, effect: stages[i].effect, nextAt: stages[i + 1] ? stages[i + 1].at - age : undefined };
}
const usable = (g, id, lot) => !stageOf(g, id, lot).effect.unservable;
/** A stage's name for people: "fresh", "on the turn", "stale", "spoiled", "sour"… */
export function stageName(stageId) {
    return { fresh: "fresh", onTheTurn: "on the turn", stale: "stale", spoiled: "spoiled", sour: "sour", curdled: "curdled", flat: "flat" }[stageId] ?? stageId;
}
// ---------------------------------------------------------------------------
// What's there
export const lotsOf = (g, id) => g.lots[id] ?? [];
/** Usable stock: everything but spoiled batches. */
export function have(g, id) {
    if (isFree(id))
        return Infinity;
    return lotsOf(g, id).reduce((n, l) => n + (usable(g, id, l) ? l.units : 0), 0);
}
/** Everything on the shelves, by how it's keeping: fresh, past fresh (still usable), spoiled. */
export function condition(g, id) {
    const out = { fresh: 0, turning: 0, spoiled: 0 };
    for (const l of lotsOf(g, id)) {
        const s = stageOf(g, id, l);
        if (s.effect.unservable)
            out.spoiled += l.units;
        else if (s.index === 0) {
            out.fresh += l.units;
            if (s.nextAt !== undefined)
                out.nextTurn = Math.min(out.nextTurn ?? Infinity, s.nextAt);
        }
        else {
            out.turning += l.units;
            out.turningStage ??= s.id;
        }
    }
    return out;
}
export function addStock(g, id, units, day = g.day) {
    if (units <= 0 || isFree(id))
        return;
    const lots = (g.lots[id] ??= []);
    const same = lots.find((l) => l.day === day);
    if (same)
        same.units += units;
    else {
        lots.push({ units, day });
        lots.sort((a, b) => a.day - b.day);
    }
}
/** What one go of a recipe takes from the pantry, with these choices. A role takes whichever ingredient with it there's enough of, cheapest first. */
export function usesOf(g, r, chosen) {
    const times = r.storedIn === "urn" ? URN_CAPACITY : 1;
    const uses = [];
    for (const u of r.fundamental) {
        const candidates = u.role ? INGREDIENTS.filter((x) => x.roles.includes(u.role)).sort((a, b) => a.worth - b.worth).map((x) => x.id) : [u.id];
        const id = candidates.find((c) => have(g, c) >= u.units * times) ?? u.id;
        uses.push({ id, units: u.units * times });
    }
    for (const id of chosen) {
        const units = [...r.base.options, ...r.optional.options].find((o) => o.id === id)?.units ?? 1;
        uses.push({ id, units: units * times });
    }
    if (r.boughtAs)
        uses.push({ id: r.boughtAs, units: 1 });
    return uses;
}
/** What's missing for these uses, if anything. */
export function shortOf(g, uses) {
    const need = new Map();
    for (const u of uses)
        need.set(u.id, (need.get(u.id) ?? 0) + u.units);
    return [...need].filter(([id, n]) => have(g, id) < n).map(([id, n]) => ({ id, units: n - have(g, id) }));
}
/** Take these from the pantry, oldest usable batch first, all or nothing. Null (and nothing taken) if anything is short. */
export function takeStockFrom(g, uses) {
    if (shortOf(g, uses).length)
        return null;
    const taken = { addTags: [], removeTags: [], past: [] };
    for (const u of uses) {
        if (isFree(u.id))
            continue;
        let left = u.units;
        for (const l of lotsOf(g, u.id)) {
            if (left <= 1e-9)
                break;
            const s = stageOf(g, u.id, l);
            if (s.effect.unservable)
                continue;
            const n = Math.min(left, l.units);
            l.units -= n;
            left -= n;
            if (s.index > 0) {
                taken.addTags.push(...s.effect.addTags);
                taken.removeTags.push(...s.effect.removeTags);
                if (!taken.past.some((p) => p.id === u.id))
                    taken.past.push({ id: u.id, stage: s.id });
            }
        }
        g.lots[u.id] = lotsOf(g, u.id).filter((l) => l.units > 1e-9);
    }
    taken.addTags = [...new Set(taken.addTags.filter((t) => t !== "fresh"))];
    taken.removeTags = [...new Set(taken.removeTags)];
    return taken;
}
export const takeStock = (g, uses) => takeStockFrom(g, uses) !== null;
/** Put what was taken onto a dish: its tags, and what's past fresh in its name's notes. */
export function applyTaken(tags, taken) {
    if (!taken || (!taken.addTags.length && !taken.removeTags.length))
        return tags;
    return [...new Set([...tags.filter((t) => !taken.removeTags.includes(t)), ...taken.addTags])];
}
/** Clear out every spoiled batch. What went, by ingredient. */
export function clearSpoiled(g) {
    const gone = [];
    for (const id of Object.keys(g.lots)) {
        let n = 0;
        g.lots[id] = lotsOf(g, id).filter((l) => { if (usable(g, id, l))
            return true; n += l.units; return false; });
        if (n > 0)
            gone.push({ id, units: n });
    }
    return gone;
}
/** Everything that's spoiled now, by ingredient. */
export function spoiledNow(g) {
    return Object.keys(g.lots).map((id) => ({ id, units: condition(g, id).spoiled })).filter((u) => u.units > 0);
}
/** The stage of the batch the next use takes (the oldest usable), if it's past fresh. */
export function nextPastFresh(g, id) {
    for (const l of lotsOf(g, id)) {
        const s = stageOf(g, id, l);
        if (s.effect.unservable || l.units <= 1e-9)
            continue;
        return s.index > 0 ? s.id : null;
    }
    return null;
}
/** Waking: what's turned or spoiled on the shelves, in a line (or nothing, if it's all fresh). */
export function pantryNews(g) {
    const byStage = new Map();
    const spoiled = [];
    for (const id of Object.keys(g.lots)) {
        const c = condition(g, id);
        const name = nameOf(id).toLowerCase();
        if (c.spoiled > 0)
            spoiled.push(name);
        if (c.turning > 0) {
            const st = stageName(c.turningStage ?? "onTheTurn");
            byStage.set(st, [...(byStage.get(st) ?? []), name]);
        }
    }
    if (!byStage.size && !spoiled.length)
        return null;
    const list = (xs) => (xs.length > 4 ? `${xs.slice(0, 4).join(", ")} and ${xs.length - 4} more` : xs.join(", "));
    const turned = [...byStage].map(([st, xs]) => `${st}: ${list(xs)}`).join("; ");
    return `🧺 In the pantry${turned ? `, ${turned}. Use it first.` : "."}${spoiled.length ? ` Spoiled: ${list(spoiled)}. Clear it out at the pantry.` : ""}`;
}
/** "2 lb of beef and 1 jug of milk". */
export function describeUses(uses) {
    return uses.map((u) => `${amount(u.id, u.units)} of ${nameOf(u.id).toLowerCase()}`).join(" and ");
}
/** A new keeper's pantry, as amounts. */
export const startingPantry = () => ({ ...ECONOMY_DATA.startingPantry });
/** A new keeper's pantry, as batches that came in today. */
export function startingLots(day) {
    return Object.fromEntries(Object.entries(startingPantry()).map(([id, units]) => [id, [{ units, day }]]));
}
