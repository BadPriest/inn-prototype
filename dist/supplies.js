// Supplies (inn#61): a pencilled slip per supplier on the desk, item by item. Send it and pay, and the carter
// brings it on that supplier's next delivery day (one fee a morning, however many crates); or fetch it
// yourself while the inn is shut and they're open. Slips stay on the desk whatever you do.
import { INGREDIENTS } from "./data.js";
import { uid } from "./core.js";
import { setOutDelivered } from "./readymade.js";
import { ECONOMY_DATA, INGREDIENTS_DATA, LOCATIONS_DATA, SUPPLIERS_DATA } from "./gamedata.gen.js";
import { spend } from "./money.js";
import { addStock, amount } from "./stock.js";
import { canFetch } from "./shop.js";
import { CALENDAR, TUNING } from "./data.js";
const WEEKDAY_IDS = { Monday: "mon", Tuesday: "tue", Wednesday: "wed", Thursday: "thu", Friday: "fri", Saturday: "sat", Sunday: "sun" };
/** The suppliers at this inn's location, with the location's own terms for them. Only those with something to put on a slip. */
export function suppliersHere(g) {
    const loc = LOCATIONS_DATA.locations.find((l) => l.id === (g.location ?? "town")) ?? LOCATIONS_DATA.locations[0];
    return loc.suppliers
        .map((o) => {
        const base = SUPPLIERS_DATA.suppliers.find((s) => s.id === o.id);
        return base ? { ...base, ...o, inventory: o.inventory ? [...base.inventory, ...o.inventory] : base.inventory } : undefined;
    })
        .filter((s) => !!s && s.inventory.some((l) => !!l.pack && INGREDIENTS.some((i) => i.id === l.item)));
}
export const linesOf = (s) => s.inventory.filter((l) => !!l.pack && INGREDIENTS.some((i) => i.id === l.item));
/** What one pack costs from this supplier. */
export function packPrice(s, line) {
    const worth = INGREDIENTS.find((i) => i.id === line.item)?.worth ?? 0;
    return worth * (line.pack?.units ?? 1) * (s.priceFactor ?? 1) * ECONOMY_DATA.suppliers.priceFactor;
}
export const slipOf = (g, s) => (g.slips[s.id] ??= {});
/** Whether an ingredient can be had this calendar season (ingredients.json `seasons`; none: all year). */
export function inSeason(g, id) {
    const s = INGREDIENTS_DATA.ingredients.find((i) => i.id === id)?.seasons;
    return !s?.length || s.includes(g.date.season);
}
/** The calendar season an out-of-season ingredient comes back. */
export function backIn(g, id) {
    const s = INGREDIENTS_DATA.ingredients.find((i) => i.id === id)?.seasons;
    if (!s?.length)
        return undefined;
    const order = CALENDAR.seasons.map((x) => x.id);
    const at = order.indexOf(g.date.season);
    for (let k = 1; k <= order.length; k++) {
        const n = CALENDAR.seasons[(at + k) % order.length];
        if (s.includes(n.id))
            return n.name.toLowerCase();
    }
    return undefined;
}
/** Off the slip: whatever's out of season. */
function dropOutOfSeason(g, slip) {
    for (const id of Object.keys(slip))
        if (!inSeason(g, id))
            delete slip[id];
}
export function slipTotal(s, slip) {
    return linesOf(s).reduce((a, l) => a + (slip[l.item] ?? 0) * packPrice(s, l), 0);
}
export const slipEmpty = (slip) => !slip || Object.values(slip).every((n) => !n);
function deliversOn(s, weekday) {
    if (!s.deliveryDays)
        return false;
    return s.deliveryDays === "daily" || s.deliveryDays.includes(WEEKDAY_IDS[weekday]);
}
/** The day a slip sent now would arrive: the first delivery day from tomorrow (the day after, past the cut-off). */
export function nextDeliveryDay(g, s) {
    if (!s.deliveryDays)
        return undefined;
    const first = g.day + (g.hour >= (s.orderBy ?? 24) ? 2 : 1);
    for (let d = first; d < first + 14; d++)
        if (deliversOn(s, g.dateOfDay(d).weekday))
            return d;
    return undefined;
}
export function whenText(g, day) {
    return day === g.day + 1 ? "tomorrow morning" : `${g.dateOfDay(day).weekday} morning`;
}
export function deliveryDaysText(s) {
    if (!s.deliveryDays)
        return "doesn't deliver";
    if (s.deliveryDays === "daily")
        return "delivers every morning";
    const names = { mon: "Mondays", tue: "Tuesdays", wed: "Wednesdays", thu: "Thursdays", fri: "Fridays", sat: "Saturdays", sun: "Sundays" };
    return `delivers ${s.deliveryDays.map((d) => names[d]).join(" and ")}`;
}
/** Send the slip: paid now, it comes with the carter. */
export function sendSlip(g, s) {
    const slip = slipOf(g, s);
    dropOutOfSeason(g, slip);
    const day = nextDeliveryDay(g, s);
    if (slipEmpty(slip) || day === undefined)
        return false;
    const total = slipTotal(s, slip);
    if (!spend(g, total)) {
        g.say(`The slip comes to more than you have.`);
        return false;
    }
    g.deliveries.push({ supplierId: s.id, day, slip: { ...slip } });
    g.lastSlips[s.id] = { ...slip };
    g.slips[s.id] = {};
    g.say(`Sent to ${s.name}: it comes with the carter ${whenText(g, day)}.`);
    return true;
}
export function canFetchFrom(g, s) {
    const [from, to] = s.openHours ?? [0, 0];
    return s.distanceInMinutes !== undefined && canFetch(g) && g.hour >= from && g.hour < to;
}
/** Fetch it yourself: paid now, you're out for the trip, and it's in the pantry when you're back. No carter's fee. */
export function fetchSlip(g, s) {
    const slip = slipOf(g, s);
    dropOutOfSeason(g, slip);
    if (slipEmpty(slip) || !canFetchFrom(g, s))
        return false;
    if (!spend(g, slipTotal(s, slip))) {
        g.say(`The slip comes to more than you have.`);
        return false;
    }
    g.minute = Math.min(g.minute + (s.distanceInMinutes ?? 0), TUNING.dayLengthMinutes - 1);
    stockUp(g, s, slip);
    setOutDelivered(g);
    g.lastSlips[s.id] = { ...slip };
    g.slips[s.id] = {};
    g.say(`You fetch it from ${s.name} yourself. It's ${g.clockText()} when you get back.`);
    return true;
}
/** What a slip brings: amounts for the pantry, and in words. */
function packOf(s, slip) {
    const lines = [], got = [];
    for (const l of linesOf(s)) {
        const packs = slip[l.item] ?? 0;
        if (!packs)
            continue;
        lines.push({ item: l.item, units: packs * l.pack.units });
        got.push(`${packs > 1 ? `${packs} × ` : ""}${l.pack.name} of ${INGREDIENTS.find((i) => i.id === l.item)?.name.toLowerCase()}`);
    }
    return { lines, got };
}
function stockUp(g, s, slip) {
    const { lines, got } = packOf(s, slip);
    for (const l of lines)
        addStock(g, l.item, l.units);
    return got;
}
/** Where the carter leaves crates: the kitchen floor just inside the kitchen door, beside the doorway. Crates pile up there. */
export function deliverySpot(g) {
    const w = g.world;
    const kitchen = (x, y) => w.tile(x, y)?.ch === "," && !w.tile(x, y)?.equip;
    for (let y = 0; y < w.h; y++)
        for (let x = 0; x < w.w; x++) {
            if (w.tile(x, y)?.ch !== "D")
                continue;
            // The door's kitchen side, then a step to one side of it, out of the doorway.
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const ix = x + dx, iy = y + dy;
                if (!kitchen(ix, iy))
                    continue;
                for (const [sx, sy] of dx === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]])
                    if (kitchen(ix + sx, iy + sy))
                        return { x: ix + sx, y: iy + sy };
                return { x: ix, y: iy };
            }
        }
    const pantry = g.world.furniture.find((f) => f.name === "Pantry");
    const by = pantry ? g.world.approachTiles(pantry)[0] : undefined;
    return by ? { x: Math.floor(by.x), y: Math.floor(by.y) } : { x: g.world.frontDoor.x, y: g.world.frontDoor.y - 1 };
}
/** Carrying the delivery in: every crate in the pile goes in the pantry, each dated the day it came. */
export function unpackCrate(g, c) {
    const pile = g.crates.filter((x) => x.x === c.x && x.y === c.y);
    for (const cr of pile)
        for (const l of cr.lines)
            addStock(g, l.item, l.units, cr.day);
    g.crates = g.crates.filter((x) => !pile.includes(x));
    setOutDelivered(g);
    g.bus.emit({ type: "MenuSound", sound: "tick" });
    const got = pile.flatMap((x) => x.got);
    g.say(`📦 ${pile.length > 1 ? `${pile.length} crates` : "The crate"} carried in to the pantry: ${got.join(", ")}.`);
}
/** Morning: everything due today comes with the carter, who charges once. */
export function deliveriesArrive(g) {
    const due = g.deliveries.filter((d) => d.day <= g.day);
    if (!due.length)
        return;
    g.deliveries = g.deliveries.filter((d) => d.day > g.day);
    const packs = due.map((d) => {
        const s = SUPPLIERS_DATA.suppliers.find((x) => x.id === d.supplierId);
        return s ? packOf(s, d.slip) : { lines: [], got: [] };
    });
    const lines = packs.flatMap((p) => p.lines), got = packs.flatMap((p) => p.got);
    if (lines.length)
        g.crates.push({ id: uid(), ...deliverySpot(g), day: g.day, lines, got });
    const fee = ECONOMY_DATA.deliveryFee;
    g.purse -= fee;
    g.stats.spent = (g.stats.spent ?? 0) + fee;
    const pile = g.crates.length;
    g.say(`🛻 The carter's left a crate at the kitchen door: ${got.join(", ")}. ${fee}d for the carter.${pile > 1 ? ` That's ${pile} crates waiting.` : ""} Carry it in to the pantry.`);
}
/** "8 pints" in a pack, for the slip. */
export const packContents = (l) => amount(l.item, l.pack.units);
