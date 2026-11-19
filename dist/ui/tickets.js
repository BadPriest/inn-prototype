// Order tickets along the top of the map: one card per open order, oldest on the left beside the
// status card. A new ticket pops in at the snap point (top right) with a magnetic snap, then slides
// left into the next free place. When the row is full, tickets stack at the snap point, newest on
// top, and feed back into the row as orders are served. Tickets are never hidden.
//
// The ring round the number counts down honestly to the guest walking out: neutral for most of the
// wait, warming cream → amber → soft red only in the last stretch. It does that one job.
import { TICKETS } from "../data.js";
import { walkoutProgress } from "../patrons.js";
import { iconFor } from "../serving.js";
const cards = new Map(); // by order id
let row = null;
function container() {
    if (row)
        return row;
    row = document.getElementById("tickets");
    return row;
}
function makeCard(o) {
    const el = document.createElement("div");
    el.className = "ticket pop";
    el.innerHTML = `<span class="tk-ic">${iconFor(o.recipeId, o.wantGarnish)}</span><span class="tk-label"></span>`
        + `<div class="tk-ring"><div class="tk-plaque"><span>${o.no}</span></div></div>`;
    el.querySelector(".tk-label").textContent = o.label;
    el.title = o.label;
    return { el, ring: el.querySelector(".tk-ring"), born: performance.now() };
}
/** The ring's empty part: solid, so it reads over the map as well as on the card. */
export const RING_TRACK = "#3a2e26";
/** Cream for most of the wait, then amber, then a soft red as the walkout nears. Shared with the plaque over the guest. */
export function ringColor(f) {
    const [warmFrom, redFrom] = TICKETS.warmFrom;
    const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
    const cream = [233, 223, 201], amber = [224, 168, 74], red = [208, 100, 79];
    if (f < warmFrom)
        return mix(cream, cream, 0);
    if (f < redFrom)
        return mix(cream, amber, (f - warmFrom) / (redFrom - warmFrom));
    return mix(amber, red, Math.min(1, (f - redFrom) / (1 - redFrom)));
}
export function updateTickets(g) {
    const box = container();
    if (!box)
        return;
    const now = performance.now();
    const open = g.orders.filter((o) => o.open).sort((a, b) => a.no - b.no || a.placedAt - b.placedAt);
    const openIds = new Set(open.map((o) => o.id));
    // Served or abandoned: the ticket snaps off; the row closes the gap.
    for (const [id, c] of cards) {
        if (openIds.has(id) || c.goneAt)
            continue;
        c.goneAt = now;
        c.el.classList.add("gone");
    }
    for (const [id, c] of cards)
        if (c.goneAt && now - c.goneAt > 260) {
            c.el.remove();
            cards.delete(id);
        }
    // Where everything goes: slots from the left, the snap point at the far right.
    const W = TICKETS.width, gap = TICKETS.gap;
    // The row is zoomed with the rest of the UI: work in its own (unzoomed) pixels.
    const ui = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui")) || 1;
    // Start just right of the status card (or the left edge when it's hidden).
    const st = document.getElementById("status"), stage = box.parentElement;
    if (st && stage) {
        const startPx = st.offsetParent ? (st.getBoundingClientRect().right - stage.getBoundingClientRect().left) / ui + 8 : 10;
        const ls = `${Math.round(startPx)}px`;
        if (box.style.left !== ls)
            box.style.left = ls;
    }
    const width = box.getBoundingClientRect().width / ui;
    const snapX = Math.max(0, width - W);
    const slots = Math.max(1, Math.floor(snapX / (W + gap)));
    let stacked = 0;
    open.forEach((o, i) => {
        let c = cards.get(o.id);
        if (!c) {
            c = makeCard(o);
            cards.set(o.id, c);
            c.el.style.left = `${snapX}px`;
            box.appendChild(c.el);
        }
        // Fresh tickets rest a moment at the snap point before sliding into the row.
        const settled = now - c.born > TICKETS.restMs;
        if (settled)
            c.el.classList.remove("pop");
        let left, z;
        if (i < slots && settled) {
            left = i * (W + gap);
            z = 1;
        }
        else {
            left = snapX - Math.min(stacked, 4) * 3;
            z = 10 + o.no;
            stacked++;
        }
        const ls = `${left}px`, zs = String(z);
        if (c.left !== ls) {
            c.el.style.left = ls;
            c.left = ls;
        }
        if (c.z !== zs) {
            c.el.style.zIndex = zs;
            c.z = zs;
        }
        const p = g.patron(o.patronId);
        const f = p ? walkoutProgress(g, p) ?? 0 : 0;
        c.ring.style.background = `conic-gradient(${ringColor(f)} ${(f * 360).toFixed(1)}deg, ${RING_TRACK} 0)`;
    });
    // How many more are hidden under the top of the stack.
    const under = stacked > 1 ? `+${stacked - 1}` : "";
    if (box.dataset.stack !== under)
        box.dataset.stack = under;
}
