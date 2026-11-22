// Supplies (inn#61): a pencilled slip per supplier on the desk, item by item. Send it and pay, and the carter
// brings it on that supplier's next delivery day (one fee a morning, however many crates); or fetch it
// yourself while the inn is shut and they're open. Slips stay on the desk whatever you do.
import { INGREDIENTS } from "./data.js";
import { uid } from "./core.js";
import { setOutDelivered } from "./readymade.js";
import { ECONOMY_DATA, INGREDIENTS_DATA, LOCATIONS_DATA, SUPPLIERS_DATA } from "./gamedata.gen.js";
import { fmtMoney, spend } from "./money.js";
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
/** The calendar seasons an ingredient can be had: "summer", "autumn and winter". */
export function seasonsText(id) {
    const s = INGREDIENTS_DATA.ingredients.find((i) => i.id === id)?.seasons ?? [];
    const names = CALENDAR.seasons.filter((x) => s.includes(x.id)).map((x) => x.name.toLowerCase());
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
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
/** The weekdays a supplier delivers (mon…sun). */
export function supplierDays(s) {
    return !s.deliveryDays ? [] : s.deliveryDays === "daily" ? Object.values(WEEKDAY_IDS) : [...s.deliveryDays];
}
const DAY_NAMES = { mon: "Mondays", tue: "Tuesdays", wed: "Wednesdays", thu: "Thursdays", fri: "Fridays", sat: "Saturdays", sun: "Sundays" };
export const dayName = (id) => DAY_NAMES[id]?.slice(0, -1) ?? id;
/** When a standing order comes: "every morning", "on Mondays and Fridays". */
export function standingWhen(o) {
    const s = SUPPLIERS_DATA.suppliers.find((x) => x.id === o.supplierId);
    const all = s ? supplierDays(s) : [];
    if (o.days.length === 7)
        return "every morning";
    if (all.length && all.every((d) => o.days.includes(d)) && s?.deliveryDays !== "daily")
        return `on ${deliveryDaysText(s).replace("delivers ", "")}`;
    const names = Object.values(WEEKDAY_IDS).filter((d) => o.days.includes(d)).map((d) => DAY_NAMES[d]);
    return `on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}`;
}
/** The next delivery day a standing order is placed for. */
function nextStandingDay(g, s, o) {
    const first = nextDeliveryDay(g, s);
    if (first === undefined)
        return undefined;
    for (let d = first; d < first + 14; d++)
        if (deliversOn(s, g.dateOfDay(d).weekday) && o.days.includes(WEEKDAY_IDS[g.dateOfDay(d).weekday]))
            return d;
    return undefined;
}
/** Send the slip, and keep it as a new standing order: placed again for each of their delivery days (all of them, to start). */
export function sendStanding(g, s) {
    const slip = { ...slipOf(g, s) };
    if (!sendSlip(g, s))
        return false;
    const o = { id: uid(), supplierId: s.id, slip, days: supplierDays(s) };
    g.standing.push(o);
    const d = g.deliveries[g.deliveries.length - 1];
    if (d?.supplierId === s.id) {
        d.standing = true;
        d.standingId = o.id;
    }
    g.say(`📌 A standing order with ${s.name}: the same ${standingWhen(o)}, paid as it's placed.`);
    return true;
}
/** Pause or resume a standing order: while paused it's kept, but nothing is placed or paid. */
export function pauseStanding(g, o, paused) {
    o.paused = paused || undefined;
    const name = SUPPLIERS_DATA.suppliers.find((x) => x.id === o.supplierId)?.name ?? o.supplierId;
    g.say(paused ? `⏸ A standing order with ${name} is paused: nothing more is placed until you resume it. Anything already sent still comes.` : `📌 A standing order with ${name} is resumed: it's placed again from tomorrow morning.`);
}
/** A standing order's days: one on or off (never none). */
export function toggleStandingDay(o, day) {
    if (o.days.includes(day)) {
        if (o.days.length > 1)
            o.days = o.days.filter((d) => d !== day);
    }
    else
        o.days = Object.values(WEEKDAY_IDS).filter((d) => d === day || o.days.includes(d));
}
export function stopStanding(g, o) {
    g.standing = g.standing.filter((x) => x !== o);
    const name = SUPPLIERS_DATA.suppliers.find((x) => x.id === o.supplierId)?.name ?? o.supplierId;
    g.say(`📌 A standing order with ${name} is cancelled. Anything already sent still comes.`);
}
/** Can a sent order still be cancelled: until the supplier's order-by hour the evening before it comes. */
export function canCancel(g, d) {
    const s = SUPPLIERS_DATA.suppliers.find((x) => x.id === d.supplierId);
    return d.day > g.day + 1 || (d.day === g.day + 1 && g.hour < (s?.orderBy ?? 24));
}
/** Cancel a sent order: the money back, and (unless a standing order placed it) its lines back on the slip to change and send again. */
export function cancelDelivery(g, d) {
    const s = SUPPLIERS_DATA.suppliers.find((x) => x.id === d.supplierId);
    if (!s || !canCancel(g, d) || !g.deliveries.includes(d))
        return false;
    const back = slipTotal(s, d.slip);
    g.deliveries = g.deliveries.filter((x) => x !== d);
    logDelivery(g, s.id, d.day, d.slip, "cancelled");
    g.purse += back;
    g.stats.spent = (g.stats.spent ?? 0) - back;
    if (d.standing)
        g.standingSkips.push(`${d.standingId}@${d.day}`);
    else {
        const slip = slipOf(g, s);
        for (const [id, n] of Object.entries(d.slip))
            slip[id] = (slip[id] ?? 0) + n;
    }
    g.say(`Order from ${s.name} for ${whenText(g, d.day)} cancelled: ${fmtMoney(back)} back in the purse.${d.standing ? " The standing order carries on after it." : " It's back on the slip."}`);
    return true;
}
/** Each morning: every standing order not paused is placed for its next delivery day, if it isn't already, and paid for. */
export function placeStanding(g) {
    g.standingSkips = g.standingSkips.filter((k) => Number(k.split("@")[1]) > g.day);
    for (const o of g.standing) {
        if (o.paused)
            continue;
        const s = SUPPLIERS_DATA.suppliers.find((x) => x.id === o.supplierId);
        const day = s && nextStandingDay(g, s, o);
        if (!s || day === undefined || g.deliveries.some((d) => d.standingId === o.id && d.day === day) || g.standingSkips.includes(`${o.id}@${day}`))
            continue;
        const slip = { ...o.slip };
        dropOutOfSeason(g, slip);
        if (slipEmpty(slip))
            continue;
        if (!spend(g, slipTotal(s, slip))) {
            g.say(`📌 Not enough in the purse for a standing order with ${s.name} (${fmtMoney(slipTotal(s, slip))}): it isn't sent this time.`);
            continue;
        }
        g.deliveries.push({ supplierId: s.id, day, slip, standing: true, standingId: o.id });
        g.say(`📌 Your standing order with ${s.name} is placed and paid: it comes ${whenText(g, day)}.`);
    }
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
    logDelivery(g, s.id, g.day, slip, "fetched");
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
/** Where the carter leaves crates: a free corner of the kitchen (else a spot along a wall), nearest the pantry. Crates pile up there. */
export function deliverySpot(g) {
    const w = g.world;
    const pantry = w.furniture.find((f) => f.name === "Pantry");
    const kitchen = (x, y) => w.tile(x, y)?.ch === "," && !w.tile(x, y)?.equip;
    // In a corner of the kitchen if one's free (else along a wall), nearest the pantry, out of every doorway
    // and off the spots where the keeper stands to use things.
    const inTheWay = new Set(w.furniture.flatMap((f) => w.approachTiles(f)).map((t) => `${t.x},${t.y}`));
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let best = null, bestD = Infinity;
    for (let y = 0; y < w.h; y++)
        for (let x = 0; x < w.w; x++) {
            if (!kitchen(x, y) || inTheWay.has(`${x},${y}`))
                continue;
            const near = sides.map(([dx, dy]) => w.tile(x + dx, y + dy));
            if (near.some((t) => t?.ch === "D"))
                continue;
            const walls = near.filter((t) => !t || t.ch === "#").length;
            if (!walls)
                continue;
            const d = (pantry ? Math.hypot(x + 0.5 - pantry.center.x, y + 0.5 - pantry.center.y) : 0) + (walls >= 2 ? 0 : 4);
            if (d < bestD) {
                bestD = d;
                best = { x, y };
            }
        }
    if (best)
        return best;
    const by = pantry ? w.approachTiles(pantry)[0] : undefined;
    return by ? { x: Math.floor(by.x), y: Math.floor(by.y) } : { x: w.frontDoor.x, y: w.frontDoor.y - 1 };
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
/** Kept in the delivery log: the last this many. */
const LOG_KEEP = 60;
export function logDelivery(g, supplierId, day, slip, how) {
    const s = SUPPLIERS_DATA.suppliers.find((x) => x.id === supplierId);
    g.deliveryLog.push({ supplierId, day, slip: { ...slip }, total: s ? slipTotal(s, slip) : 0, how });
    if (g.deliveryLog.length > LOG_KEEP)
        g.deliveryLog.splice(0, g.deliveryLog.length - LOG_KEEP);
}
export function deliveriesArrive(g) {
    const due = g.deliveries.filter((d) => d.day <= g.day);
    if (!due.length)
        return;
    for (const d of due)
        logDelivery(g, d.supplierId, g.day, d.slip, d.standing ? "standing" : "sent");
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
    g.say(`🛻 The carter's left a crate in the kitchen: ${got.join(", ")}. ${fee}d for the carter.${pile > 1 ? ` That's ${pile} crates waiting.` : ""} Carry it in to the pantry.`);
}
/** "8 pints" in a pack, for the slip. */
export const packContents = (l) => amount(l.item, l.pack.units);
