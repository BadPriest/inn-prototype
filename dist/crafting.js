// Crafting at stations. Nothing ever burns.
// What you make waits where you made it: single servings on the station's shelf (labelled for the
// order they were made for), pots on the station, whole pies in the pie safe. You pick them up there.
// The hatch is for a hired cook, later.
import { organic, uid } from "./core.js";
import { INGREDIENTS, RECIPES, TUNING } from "./data.js";
import { dist } from "./world.js";
import { addToTray, removeFromTray, trayItems } from "./serving.js";
export function recipesFor(g, f) {
    const list = RECIPES.filter((r) => r.station === f.station);
    const tea = list.find((r) => r.id === "tea");
    if (tea && g.upgrades.has("urn"))
        list.splice(list.indexOf(tea) + 1, 0, urnTea(tea));
    return list;
}
export function makeItem(recipe, ingredients) {
    const ings = ingredients.map((id) => INGREDIENTS.find((i) => i.id === id)).filter(Boolean);
    const tags = [...new Set([...recipe.baseTags, ...ings.flatMap((i) => i.tags)])];
    const base = recipe.id === "tea" ? "Tea" : recipe.name;
    const name = ings.length ? `${base} (${ings.map((i) => i.name.toLowerCase()).join(", ")})` : base;
    return { id: uid(), recipeId: recipe.id, name, kind: recipe.kind, tags };
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
    return { ...tea, name: "Tea, a whole urn", servings: [8, 1], minutes: [tea.minutes[0] * 2.5, tea.minutes[1]],
        blurb: "A whole urn, kept hot on the hearth and poured by the cup all evening. One leaf for everyone who asks." };
}
/** How a job's recipe is made: as itself, or as a batch (the urn). */
export function effectiveRecipe(_g, recipe, batch = false) {
    return batch && recipe.id === "tea" ? urnTea(recipe) : recipe;
}
export function startJob(g, f, recipeIn, ingredients, ticket) {
    const batch = recipeIn.id === "tea" && !!recipeIn.servings;
    const recipe = effectiveRecipe(g, RECIPES.find((r) => r.id === recipeIn.id), batch);
    if (recipe.servings)
        ticket = null;
    let total = Math.max(1, organic(recipe.minutes));
    if (recipe.id === "tea" && g.upgrades.has("kettle"))
        total *= 0.5;
    g.jobs.set(f.id, { recipeId: recipe.id, ingredients, total, progress: 0, done: false, ticket: ticket?.id, ticketName: ticket?.name, batch });
    const forWho = ticket ? ` for ${ticket.name}` : recipe.storedIn === "piesafe" ? " (a whole pie)" : recipe.servings ? " (a whole pot)" : "";
    g.say(`Started ${recipe.name.toLowerCase()}${forWho} at the ${f.name.toLowerCase()}${recipe.tended ? ". Stay with it" : ""}.`);
}
export function keeperNear(g, f, range = 1.5) {
    return f.tiles.some((t) => dist(g.keeper.pos, { x: t.x + 0.5, y: t.y + 0.5 }) <= range);
}
export function updateCrafting(g, simDt, target) {
    for (const [fid, job] of g.jobs) {
        const f = g.world.furniture.find((x) => x.id === fid);
        const recipe = effectiveRecipe(g, RECIPES.find((r) => r.id === job.recipeId), job.batch);
        if (!job.done) {
            const near = keeperNear(g, f);
            let rate = recipe.tended && !near ? 0 : 1;
            if (near && g.holdingSpace && target?.id === f.id)
                rate *= TUNING.speedUpFactor;
            job.progress += simDt * rate;
            if (job.progress >= job.total) {
                job.done = true;
                job.item = makeItem(recipe, job.ingredients);
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
    if (recipe.storedIn === "piesafe") {
        if (g.pieSafe.length >= TUNING.pieSafeCapacity)
            return; // waits on the station until there's room
        const n = Math.max(2, Math.round(organic(recipe.servings ?? [6, 1])));
        g.pieSafe.push({ id: uid(), item: job.item, left: n, total: n, bakedDay: g.day });
        g.jobs.delete(fid);
        g.say(`A whole ${job.item.name.toLowerCase()} goes into the pie safe: ${n} slices.`);
        return;
    }
    if (recipe.servings) {
        const n = Math.max(2, Math.round(organic(recipe.servings)));
        g.pots.set(fid, { item: job.item, left: n, total: n });
        g.jobs.delete(fid);
        g.say(`A pot of ${job.item.name.toLowerCase()} is ready: ${n} servings.`);
        return;
    }
    const shelf = g.shelves.get(fid) ?? [];
    if (shelf.length >= TUNING.shelfCapacity)
        return; // stays on the fire until there's room on the shelf
    shelf.push(job.item);
    g.shelves.set(fid, shelf);
    g.bus.emit({ type: "ItemCrafted", itemId: job.item.id });
    const f = g.world.furniture.find((x) => x.id === fid);
    g.say(`${job.item.name}${job.item.ticketName ? ` (for ${job.item.ticketName})` : ""} is ready at the ${f?.name.toLowerCase() ?? "station"}.`);
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
/** Put an untouched slice back into the pie safe: onto its own pie if it's there, else as a pie of its own. */
export function returnSlice(g, slice) {
    removeFromTray(g, slice);
    const baseName = slice.name.replace(/^(Day-old )?[Ss]lice of /, "");
    const pie = g.pieSafe.find((p) => p.item.name.toLowerCase() === baseName.toLowerCase() || p.item.tags.join() === slice.tags.join());
    if (pie) {
        pie.left = Math.min(pie.total, pie.left + 1);
    }
    else if (g.pieSafe.length < TUNING.pieSafeCapacity) {
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
    for (const t of g.keeper.trays) {
        t.items = t.items.filter(keep);
        if (!t.items.length)
            t.kind = null;
    }
    for (const sd of g.setDown)
        sd.tray.items = sd.tray.items.filter(keep);
    g.setDown = g.setDown.filter((sd) => sd.tray.items.length);
    for (const [fid, pot] of g.pots) {
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
/** Take one serving from a communal pot onto a tray. */
export function serveFromPot(g, fid) {
    const pot = g.pots.get(fid);
    if (!pot)
        return;
    const serving = { ...pot.item, id: uid(), tags: [...pot.item.tags] };
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
/** End of day: anything still cooking finishes and waits on its shelf. Nothing is ruined. */
export function finishAllJobs(g) {
    for (const [fid, job] of g.jobs) {
        const recipe = effectiveRecipe(g, RECIPES.find((r) => r.id === job.recipeId), job.batch);
        if (!job.item)
            job.item = makeItem(recipe, job.ingredients);
        job.item.ticket = undefined;
        job.item.ticketName = undefined;
        job.item.madeDay = g.day;
        if (recipe.storedIn === "piesafe") {
            const n = Math.max(2, Math.round(organic(recipe.servings ?? [6, 1])));
            g.pieSafe.push({ id: uid(), item: job.item, left: n, total: n, bakedDay: g.day });
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
