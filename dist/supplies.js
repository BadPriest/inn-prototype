// Supplies (inn#61): a pencilled slip per supplier on the desk, item by item. Send it and pay, and the carter
// brings it on that supplier's next delivery day (one fee a morning, however many crates); or fetch it
// yourself while the inn is shut and they're open. Slips stay on the desk whatever you do.
import { INGREDIENTS } from "./data.js";
import { uid } from "./core.js";
import { ECONOMY_DATA, LOCATIONS_DATA, SUPPLIERS_DATA } from "./gamedata.gen.js";
import { spend } from "./money.js";
import { addStock, amount } from "./stock.js";
import { canFetch } from "./shop.js";
import { TUNING } from "./data.js";
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
    if (slipEmpty(slip) || !canFetchFrom(g, s))
        return false;
    if (!spend(g, slipTotal(s, slip))) {
        g.say(`The slip comes to more than you have.`);
        return false;
    }
    g.minute = Math.min(g.minute + (s.distanceInMinutes ?? 0), TUNING.dayLengthMinutes - 1);
    stockUp(g, s, slip);
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
/** A free floor spot beside the pantry (else inside the front door) for the carter's crate. */
function crateSpot(g) {
    const taken = (t) => g.crates.some((c) => c.x === t.x && c.y === t.y) || g.spills.some((s) => s.x === t.x && s.y === t.y);
    const pantry = g.world.furniture.find((f) => f.name === "Pantry");
    const spots = pantry ? g.world.approachTiles(pantry) : [];
    const free = spots.map((s) => ({ x: Math.floor(s.x), y: Math.floor(s.y) })).find((t) => !taken(t));
    if (free)
        return free;
    const d = g.world.frontDoor;
    return { x: d.x, y: d.y - 1 };
}
/** Unpacking a crate: it all goes in the pantry. */
export function unpackCrate(g, c) {
    for (const l of c.lines)
        addStock(g, l.item, l.units);
    g.crates = g.crates.filter((x) => x !== c);
    g.bus.emit({ type: "MenuSound", sound: "tick" });
    g.say(`📦 Unpacked into the pantry: ${c.got.join(", ")}.`);
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
        g.crates.push({ id: uid(), ...crateSpot(g), lines, got });
    const fee = ECONOMY_DATA.deliveryFee;
    g.purse -= fee;
    g.stats.spent = (g.stats.spent ?? 0) + fee;
    g.say(`🛻 The carter's left a crate of supplies by the pantry: ${got.join(", ")}. ${fee}d for the carter. Unpack it to put it all away.`);
}
/** "8 pints" in a pack, for the slip. */
export const packContents = (l) => amount(l.item, l.pack.units);
