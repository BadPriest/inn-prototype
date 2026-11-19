// Crafting at stations. Nothing ever burns.
// What you make waits where you made it: single servings on the station's shelf (labelled for the
// order they were made for), pots on the station, whole pies in the pie safe. You pick them up there.
// The hatch is for a hired cook, later.
import { applyTaken, describeUses, have, nameOf, shortOf, takeStockFrom, usesOf } from "./stock.js";
import { organic, uid } from "./core.js";
import { BREAD_CASE_BATCHES, INGREDIENTS, RECIPES, TUNING, URN_CAPACITY, utensilFor } from "./data.js";
import { dist } from "./world.js";
import { addToTray, removeFromTray, trayItems } from "./serving.js";
import { knows } from "./skills.js";
export function recipesFor(g, slot) {
    // At a kettle, tea isn't made as a job: you boil the kettle, then steep cups from the hot water.
    // With an urn in the kitchen, the kettle can also brew a whole pot of one tea to keep hot in it.
    const tea = RECIPES.find((r) => r.id === "tea");
    const list = RECIPES.filter((r) => slot.kinds.includes(r.station) && r.id !== "tea" && knows(g, r.id));
    if (slot.kinds.includes("kettle") && g.world.furniture.some((f) => f.kind === "urn"))
        list.push(urnTea(tea));
    return list;
}
/** The name of where something's made, for the log: "the stove (hob 2)". */
export function slotName(slot) {
    const base = slot.f.name.toLowerCase();
    return (slot.f.slots?.length ?? 1) > 1 ? `${base} (${slot.name.toLowerCase()})` : base;
}
/** A dish or drink from a recipe and the ingredients chosen. `taken`: anything past fresh that went in, and its tags. */
export function makeItem(recipe, ingredients, taken) {
    const ings = ingredients.map((id) => INGREDIENTS.find((i) => i.id === id)).filter(Boolean);
    const tags = applyTaken([...new Set([...recipe.baseTags, ...ings.flatMap((i) => i.tags)])], taken);
    const base = recipe.id === "tea" ? "Tea" : recipe.name;
    const name = ings.length ? `${base} (${ings.map((i) => i.name.toLowerCase()).join(", ")})` : base;
    return { id: uid(), recipeId: recipe.id, name, kind: recipe.kind, tags, options: [...ingredients] };
}
/** The oldest open order for this recipe that nothing is already being made for. */
export function ticketFor(g, recipe) {
    if (recipe.servings)
        return null; // pots feed the room, not a person
    const taken = new Set();
    for (const j of g.jobs.values())
        if (j.ticket)
            taken.add(j.ticket);
    for (const i of [...g.hatch, ...shelfItems(g), ...trayItems(g)])
        if (i.ticket)
            taken.add(i.ticket);
    const o = g.orders
        .filter((x) => x.open && x.recipeId === recipe.id && !taken.has(x.patronId))
        .sort((a, b) => a.placedAt - b.placedAt)[0];
    if (!o)
        return null;
    const p = g.patron(o.patronId);
    return p ? { id: p.id, name: p.name } : null;
}
/** The tea urn: a batch version of tea, offered alongside the single cup once you have the upgrade. */
export function urnTea(tea) {
    return { ...tea, name: "Tea for the urn", servings: [URN_CAPACITY, 0], minutes: [tea.minutes[0] * 2.5, tea.minutes[1]], storedIn: "urn",
        blurb: "A whole pot of one tea, carried to the urn and kept hot there, poured by the cup all day." };
}
/** How a job's recipe is made: as itself, or as a batch (the urn). */
export function effectiveRecipe(_g, recipe, batch = false) {
    return batch && recipe.id === "tea" ? urnTea(recipe) : recipe;
}
export function startJob(g, slot, recipeIn, ingredients, ticket) {
    const batch = recipeIn.id === "tea" && !!recipeIn.servings;
    const recipe = effectiveRecipe(g, RECIPES.find((r) => r.id === recipeIn.id), batch);
    const uses = usesOf(g, recipe, ingredients);
    const short = shortOf(g, uses);
    if (short.length) {
        g.say(`Not enough in the pantry: short ${describeUses(short)}.`);
        return false;
    }
    const taken = takeStockFrom(g, uses);
    if (recipe.servings)
        ticket = null;
    let total = Math.max(1, organic(recipe.minutes));
    total /= slot.speed ?? slot.f.equip?.craftingSpeed ?? 1;
    g.jobs.set(slot.id, { recipeId: recipe.id, ingredients, total, progress: 0, done: false, ticket: ticket?.id, ticketName: ticket?.name, batch, taken: taken ?? undefined });
    const forWho = ticket ? ` for ${ticket.name}` : recipe.storedIn === "piesafe" ? " (a whole pie)" : recipe.storedIn === "urn" ? "" : recipe.batch ? ` (${recipe.batch})` : recipe.servings ? " (a whole pot)" : "";
    if (recipe.id === "water") {
        g.say("You put the kettle on.");
        return true;
    }
    g.say(`Started ${recipe.name.toLowerCase()}${forWho} at the ${slotName(slot)}${recipe.tended ? ". Stay with it" : ""}.`);
    return true;
}
export function keeperNear(g, f, range = 1.5) {
    return f.tiles.some((t) => dist(g.keeper.pos, { x: t.x + 0.5, y: t.y + 0.5 }) <= range);
}
export function updateCrafting(g, simDt, target) {
    for (const [fid, job] of g.jobs) {
        const f = g.world.slot(fid)?.f;
        if (!f)
            continue;
        const recipe = effectiveRecipe(g, RECIPES.find((r) => r.id === job.recipeId), job.batch);
        if (!job.done) {
            const near = keeperNear(g, f);
            let rate = recipe.tended && !near ? 0 : 1;
            rate *= utensilFor(g.upgrades, recipe.station)?.craftingSpeed ?? 1;
            if (near && (g.holdingSpace || g.hurrying) && target?.f.id === f.id && (!target.part || target.part.id === fid))
                rate *= TUNING.speedUpFactor;
            job.progress += simDt * rate;
            if (job.progress >= job.total) {
                job.done = true;
                job.item = makeItem(recipe, job.ingredients, job.taken);
                if (job.ticket) {
                    job.item.ticket = job.ticket;
                    job.item.ticketName = job.ticketName;
                }
                g.stats.crafted++;
            }
        }
        if (job.done && job.item)
            finish(g, fid, job, recipe);
    }
}
function finish(g, fid, job, recipe) {
    job.item.madeDay = g.day;
    // Whole pies and pots of tea for the urn wait on the shelf like any dish; the keeper carries them where they're kept.
    if (recipe.storedIn)
        job.item.whole = Math.max(2, Math.round(organic(recipe.servings ?? [6, 1])));
    else if (recipe.servings) {
        const n = Math.max(2, Math.round(organic(recipe.servings))) + (utensilFor(g.upgrades, recipe.station)?.servingsBonus ?? 0);
        g.pots.set(fid, { item: job.item, left: n, total: n });
        g.jobs.delete(fid);
        const what = recipe.batch
            ? `${recipe.batch[0].toUpperCase()}${recipe.batch.slice(1)} (${(job.item.options ?? []).map((id) => INGREDIENTS.find((i) => i.id === id)?.name.toLowerCase()).filter(Boolean).join(", ")})`
            : `A pot of ${job.item.name.toLowerCase()}`;
        g.say(recipe.id === "water" ? `The kettle's boiled: hot water for ${n} cups.` : `${what} is ready: ${n} servings.`);
        return;
    }
    const slot = g.world.slot(fid);
    const who = job.item.ticketName ? ` (for ${job.item.ticketName})` : "";
    // A tended dish: the keeper's standing over it, so it goes straight onto a tray if there's room.
    if (recipe.tended && slot && keeperNear(g, slot.f)) {
        const item = job.item;
        item.from = fid;
        item.fromPot = false;
        if (addToTray(g, item)) {
            g.bus.emit({ type: "ItemCrafted", itemId: item.id });
            g.bus.emit({ type: "ItemPickedUp", itemId: item.id });
            g.say(`${item.name}${who} is done: you take it onto your tray.`);
            g.jobs.delete(fid);
            return;
        }
        item.from = undefined;
        item.fromPot = undefined;
    }
    const shelf = g.shelves.get(fid) ?? [];
    if (shelf.length >= TUNING.shelfCapacity)
        return; // stays on the fire until there's room on the shelf
    shelf.push(job.item);
    g.shelves.set(fid, shelf);
    g.bus.emit({ type: "ItemCrafted", itemId: job.item.id });
    g.say(`${job.item.name}${who} is ready at the ${slot ? slotName(slot) : "station"}.`);
    g.jobs.delete(fid);
}
export function shelfItems(g) {
    return [...g.shelves.values()].flat();
}
/** Pick up what's waiting on a station's shelf, oldest first, as much as fits on the trays. */
export function collectShelf(g, fid) {
    const shelf = g.shelves.get(fid);
    if (!shelf?.length)
        return 0;
    let took = 0;
    for (const item of [...shelf]) {
        item.from = fid;
        item.fromPot = false;
        if (!addToTray(g, item))
            break;
        shelf.splice(shelf.indexOf(item), 1);
        g.bus.emit({ type: "ItemPickedUp", itemId: item.id });
        took++;
    }
    if (!shelf.length)
        g.shelves.delete(fid);
    if (took)
        g.say(`Picked up ${took === 1 ? "one dish" : `${took} dishes`}${shelf.length ? ` (${shelf.length} still waiting)` : ""}.`);
    else
        g.say("No room on your trays.");
    return took;
}
/** How many servings of a batch dish (stew, pie, urn tea) are ready right now. */
export function stockOf(g, recipeId) {
    if (recipeId === "pie")
        return g.pieSafe.reduce((a, p) => a + p.left, 0);
    let n = 0;
    for (const pot of g.pots.values())
        if (pot.item.recipeId === recipeId)
            n += pot.left;
    return n;
}
/** Take one slice from a whole pie in the pie safe. */
export function takeSlice(g, pieId) {
    const pie = g.pieSafe.find((p) => p.id === pieId);
    if (!pie)
        return;
    const slice = { ...pie.item, id: uid(), tags: [...pie.item.tags], name: `Slice of ${pie.item.name.toLowerCase()}` };
    if (!addToTray(g, slice)) {
        g.say("No room on your trays.");
        return;
    }
    pie.left--;
    g.say(`${slice.name} (${pie.left} left).`);
    if (pie.left <= 0) {
        g.pieSafe = g.pieSafe.filter((p) => p !== pie);
        g.say("That pie's all gone.");
    }
}
/** Put a whole pie, carried from the oven, into the pie safe. False if the safe is full. */
export function storePie(g, pie) {
    if (g.pieSafe.length >= g.pieSafeCapacity) {
        g.say("The pie safe is full.");
        return false;
    }
    removeFromTray(g, pie);
    const n = pie.whole ?? 6;
    g.pieSafe.push({ id: uid(), item: { ...pie, whole: undefined }, left: n, total: n, bakedDay: pie.madeDay ?? g.day });
    g.accountedFor.add(pie.id);
    g.say(`The ${pie.name.toLowerCase()} goes into the pie safe: ${n} slices.`);
    return true;
}
/** Put an untouched slice back into the pie safe: onto its own pie if it's there, else as a pie of its own. */
export function returnSlice(g, slice) {
    removeFromTray(g, slice);
    const baseName = slice.name.replace(/^(Day-old )?[Ss]lice of /, "");
    const pie = g.pieSafe.find((p) => p.item.name.toLowerCase() === baseName.toLowerCase() || p.item.tags.join() === slice.tags.join());
    if (pie) {
        pie.left = Math.min(pie.total, pie.left + 1);
    }
    else if (g.pieSafe.length < g.pieSafeCapacity) {
        g.pieSafe.push({ id: uid(), item: { ...slice, name: baseName.charAt(0).toUpperCase() + baseName.slice(1) }, left: 1, total: 1, bakedDay: slice.madeDay ?? g.day });
    }
    else {
        addToTray(g, slice);
        g.say("The pie safe is full.");
        return;
    }
    g.say(`${slice.name} goes back in the pie safe.`);
}
/** Overnight: yesterday's food turns day-old; anything older goes to the hens. Drinks keep. */
export function ageFood(g) {
    const stale = (i) => {
        if (i.kind !== "food" || i.snack || i.tags.includes(TUNING.staleTag))
            return;
        i.tags = [...i.tags.filter((t) => t !== "warm" && t !== "crisp"), TUNING.staleTag];
        i.name = `Day-old ${i.name.charAt(0).toLowerCase()}${i.name.slice(1)}`;
    };
    let tossed = 0;
    g.pieSafe = g.pieSafe.filter((p) => {
        if (g.day - p.bakedDay >= 2) {
            tossed++;
            return false;
        }
        if (g.day - p.bakedDay >= 1)
            stale(p.item);
        return true;
    });
    const keep = (i) => {
        if (i.kind === "food" && i.tags.includes(TUNING.staleTag)) {
            tossed++;
            g.accountedFor.add(i.id);
            return false;
        }
        stale(i);
        return true;
    };
    g.hatch = g.hatch.filter(keep);
    for (const [fid, shelf] of g.shelves) {
        const left = shelf.filter(keep);
        if (left.length)
            g.shelves.set(fid, left);
        else
            g.shelves.delete(fid);
    }
    for (const t of g.keeper.trays)
        t.items = t.items.filter(keep);
    for (const sd of g.setDown)
        sd.tray.items = sd.tray.items.filter(keep);
    g.setDown = g.setDown.filter((sd) => sd.tray.items.length);
    for (const [fid, pot] of g.pots) {
        if (RECIPES.find((r) => r.id === pot.item.recipeId)?.tableSnack)
            continue;
        if (pot.item.tags.includes(TUNING.staleTag)) {
            g.pots.delete(fid);
            tossed++;
        }
        else
            stale(pot.item);
    }
    if (tossed)
        g.say(`Food older than a day went to the hens (${tossed}).`);
}
/**
 * A cup of tea from the kettle's hot water, with this leaf. Made for whoever's waited longest for tea,
 * and first for someone who asked for this very leaf.
 */
export function steepTea(g, fid, leaf) {
    const water = g.pots.get(fid);
    const tea = RECIPES.find((r) => r.id === "tea");
    if (!water || water.item.recipeId !== "water")
        return;
    const item = makeItem(tea, [leaf]);
    item.madeDay = g.day;
    const taken = new Set([...trayItems(g), ...shelfItems(g)].map((i) => i.ticket).filter(Boolean));
    const waiting = g.orders.filter((o) => o.open && o.recipeId === "tea" && !taken.has(o.patronId)).sort((a, b) => a.placedAt - b.placedAt);
    const o = waiting.find((x) => x.wantOption === leaf) ?? waiting.find((x) => !x.wantOption) ?? waiting[0];
    const p = o ? g.patron(o.patronId) : undefined;
    if (p) {
        item.ticket = p.id;
        item.ticketName = p.name;
    }
    if (have(g, leaf) < 1) {
        g.say(`There's no ${nameOf(leaf).toLowerCase()} left in the pantry.`);
        return;
    }
    if (!addToTray(g, item)) {
        g.say("No room on your trays.");
        return;
    }
    const leafTaken = takeStockFrom(g, [{ id: leaf, units: 1 }]);
    item.tags = applyTaken(item.tags, leafTaken);
    g.stats.crafted++;
    water.left--;
    g.say(`${item.name}${p ? ` for ${p.name}` : ""} (${water.left} cup${water.left === 1 ? "" : "s"} of hot water left).`);
    if (water.left <= 0) {
        g.pots.delete(fid);
        g.say("The kettle's empty.");
    }
}
/** Take one serving from a communal pot onto a tray. */
export function serveFromPot(g, fid) {
    const pot = g.pots.get(fid);
    if (!pot)
        return;
    const serving = { ...pot.item, id: uid(), tags: [...pot.item.tags], from: fid, fromPot: true, fromPotId: pot.item.id };
    if (!addToTray(g, serving)) {
        g.say("No room on your trays.");
        return;
    }
    pot.left--;
    g.say(`A serving of ${pot.item.name.toLowerCase()} (${pot.left} left).`);
    if (pot.left <= 0) {
        g.pots.delete(fid);
        g.say("The pot is empty.");
    }
}
/** The same dish made the same way: same recipe, same ingredients, same garnish. */
export function sameDish(a, b) {
    const opts = (i) => [...(i.options ?? [])].sort().join(",");
    return a.recipeId === b.recipeId && opts(a) === opts(b) && (a.garnish ?? "") === (b.garnish ?? "");
}
/**
 * Can this dish go back here? A serving goes into any pot of the same dish made the same way, with room
 * for it (fewer servings left than it started with), or onto the hob it came from if that's empty now.
 * A single dish goes back onto the shelf it was picked up from.
 */
export function canPutBack(g, fid, item) {
    if (!item.fromPot)
        return item.from === fid;
    const pot = g.pots.get(fid);
    if (pot)
        return sameDish(pot.item, item) && pot.left < pot.total;
    return item.from === fid && !g.jobs.has(fid);
}
/** Put a dish picked up here back where it was: on the shelf, or into its pot. False if it can't go back. */
export function putBack(g, fid, item) {
    if (!canPutBack(g, fid, item))
        return false;
    const pot = g.pots.get(fid);
    if (item.fromPot) {
        if (pot)
            pot.left++;
        else {
            // Its own pot's gone: it starts a pot again, with room for as many as a pot of it holds.
            const r = RECIPES.find((x) => x.id === item.recipeId);
            const room = r?.servings ? Math.round(r.servings[0] + r.servings[1]) : 1;
            g.pots.set(fid, { item: { ...item, id: uid(), from: undefined, fromPot: undefined, fromPotId: undefined }, left: 1, total: Math.max(1, room) });
        }
    }
    else
        g.shelves.set(fid, [...(g.shelves.get(fid) ?? []), item]);
    removeFromTray(g, item); // accounted for: it left the trays on purpose
    item.from = undefined;
    item.fromPot = undefined;
    item.fromPotId = undefined;
    return true;
}
/** Empty a pot (porridge nobody wants) so the hob is free: it goes to the hens with the scraps. */
export function emptyPot(g, fid) {
    const pot = g.pots.get(fid);
    if (!pot)
        return;
    g.pots.delete(fid);
    g.say(pot.item.recipeId === "water" ? "You tip out the hot water." : `You scrape the last of the ${pot.item.name.toLowerCase()} into the scraps for the hens.`);
}
/** End of day: anything still cooking finishes and waits on its shelf. Nothing is ruined. */
export function finishAllJobs(g) {
    for (const [fid, job] of g.jobs) {
        const recipe = effectiveRecipe(g, RECIPES.find((r) => r.id === job.recipeId), job.batch);
        if (!job.item)
            job.item = makeItem(recipe, job.ingredients, job.taken);
        job.item.ticket = undefined;
        job.item.ticketName = undefined;
        job.item.madeDay = g.day;
        if (recipe.storedIn) {
            job.item.whole = Math.max(2, Math.round(organic(recipe.servings ?? [6, 1])));
            g.shelves.set(fid, [...(g.shelves.get(fid) ?? []), job.item]);
        }
        else if (recipe.servings) {
            const n = Math.max(2, Math.round(organic(recipe.servings)));
            g.pots.set(fid, { item: job.item, left: n, total: n });
        }
        else
            g.shelves.set(fid, [...(g.shelves.get(fid) ?? []), job.item]);
        g.jobs.delete(fid);
    }
    // Tickets lapse overnight: yesterday's patrons have gone home.
    for (const i of [...g.hatch, ...shelfItems(g), ...trayItems(g)]) {
        i.ticket = undefined;
        i.ticketName = undefined;
    }
}
/** Pour a pot of tea, carried from the kettle, into the urn. It tops up the same tea; another tea waits until the urn is empty. */
export function fillUrn(g, urnId, item) {
    const pot = g.pots.get(urnId);
    if (pot && !sameDish(pot.item, item)) {
        g.say(`The urn still has ${pot.item.name.toLowerCase()} in it.`);
        return false;
    }
    if (pot && pot.left >= URN_CAPACITY) {
        g.say("The urn is full.");
        return false;
    }
    removeFromTray(g, item);
    const cups = item.whole ?? URN_CAPACITY;
    const tea = { ...item, whole: undefined };
    if (pot)
        pot.left = Math.min(URN_CAPACITY, pot.left + cups);
    else
        g.pots.set(urnId, { item: tea, left: Math.min(URN_CAPACITY, cups), total: URN_CAPACITY });
    g.say(`The ${item.name.toLowerCase()} goes into the urn: ${g.pots.get(urnId).left} cups.`);
    return true;
}
/** The batches in a bread case: each kept like a pot, under the case's id and its place in it. */
export const breadCaseKeys = (caseId) => Array.from({ length: BREAD_CASE_BATCHES }, (_, i) => `${caseId}#${i}`);
/** A bread case in the kitchen with room for another batch. */
export function breadCaseWithRoom(g) {
    return g.world.furniture.find((f) => f.kind === "breadcase" && breadCaseKeys(f.id).some((k) => !g.pots.has(k)))?.id;
}
/** Lift a whole batch out of the oven onto a tray, to carry to the bread case. Frees the oven. */
export function takeBatch(g, fid) {
    const pot = g.pots.get(fid);
    if (!pot)
        return;
    const batch = { ...pot.item, id: uid(), tags: [...pot.item.tags], whole: pot.left };
    if (!addToTray(g, batch)) {
        g.say("No room on your trays.");
        return;
    }
    g.pots.delete(fid);
    g.say(`You take the ${pot.item.name.toLowerCase()} out of the oven (${pot.left} slices).`);
}
/** Put a batch of bread, carried from the oven, into the bread case. */
export function storeBread(g, caseId, batch) {
    const key = breadCaseKeys(caseId).find((k) => !g.pots.has(k));
    if (!key) {
        g.say("The bread case is full.");
        return false;
    }
    removeFromTray(g, batch);
    const n = batch.whole ?? 1;
    g.pots.set(key, { item: { ...batch, whole: undefined }, left: n, total: n });
    g.say(`The ${batch.name.toLowerCase()} goes into the bread case: ${n} slices.`);
    return true;
}
