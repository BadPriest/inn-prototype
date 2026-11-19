// Where a dish is made, and what a kitchen needs to make it.
import { EQUIPMENT } from "../data.js";
/** What a dish needs that this kitchen hasn't got (buy it at the desk). */
const NEEDS = { stove: "needs a hob", griddle: "needs a hob", oven: "needs an oven or a Dutch oven", kettle: "needs a kettle", coffee: "needs a coffee pot", prep: "needs a prep table" };
/** Where a dish is made, in a few words, and in full (which pieces of equipment) for the hover. */
const WHERE = { stove: "🔥 a pot on a hob", griddle: "🍳 a pan on a hob", oven: "🍞 in an oven or a Dutch oven", kettle: "🫖 the kettle", coffee: "☕ the coffee pot", prep: "🔪 the prep table" };
export const whereShort = (r) => (r.station === "tap" ? `🍺 the ${r.name.toLowerCase()} barrel` : WHERE[r.station] ?? "");
export const whereFull = (r) => {
    const on = EQUIPMENT.filter((e) => (r.station === "tap" ? e.tap === r.id : e.slots.some((sl) => sl.kinds.includes(r.station)))).map((e) => e.name.toLowerCase());
    return on.length ? `Made at: ${on.join(", ")}` : "";
};
export const needs = (r) => (r.station === "tap" ? `needs a barrel of ${r.name.toLowerCase()}` : NEEDS[r.station] ?? "needs equipment");
