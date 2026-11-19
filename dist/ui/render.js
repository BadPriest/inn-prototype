import { breadCaseKeys } from "../crafting.js";
// Canvas drawing. Basic shapes only: rectangles for furniture, circles for people.
import { RECIPES, SNACKS, SOAKING, TUNING, PIE_SAFE_CAPACITY } from "../data.js";
import { spotOf } from "../interact.js";
import { iconFor, TRAY_COLOUR, trayLook } from "../serving.js";
import { drawLight } from "./light.js";
import { RING_TRACK, ringColor } from "./tickets.js";
import { walkoutProgress } from "../patrons.js";
import { worldGuide } from "../walkthrough.js";
import { P } from "./proj.js";
import { drawLevelUp } from "./levelup.js";
import { COINS, coinParts } from "../money.js";
/** Fit the whole inn if it's big enough to read; otherwise zoom in and follow the keeper. */
/** `top`: canvas pixels kept clear at the top (the status card sits there). */
/** `zoom`: 1 is that size; more is closer (following the keeper), less is farther. */
export function computeView(canvas, g, minTile = 22, top = 0, zoom = 1) {
    const fit = Math.min(canvas.width / g.world.w, (canvas.height - top) / g.world.h);
    const min = minTile * (window.devicePixelRatio || 1);
    const ts = Math.max(6, Math.floor(Math.max(fit, min) * zoom));
    const mapW = ts * g.world.w, mapH = ts * g.world.h;
    const clampAxis = (want, map, view) => map <= view ? Math.floor((view - map) / 2) : Math.min(0, Math.max(view - map, want));
    const ox = clampAxis(Math.floor(canvas.width / 2 - g.keeper.pos.x * ts), mapW, canvas.width);
    const oy = top + clampAxis(Math.floor((canvas.height - top) / 2 - g.keeper.pos.y * ts), mapH, canvas.height - top);
    return { ts, ox, oy };
}
/** Numeral size on the plaque over a guest, as a share of the plaque's radius (1-digit numbers; 2 and 3 digits shrink to fit). The ticket's size is .tk-plaque in index.html. */
const PLAQUE_FONT = 1.4;
export const OUTCOME_COLOR = {
    DELIGHT: "#ffd34d",
    PLEASED: "#9be27a",
    FULFILLED: "#d8d8d8",
    UNFINISHED: "#e0a060",
    COMPLAINS: "#ff7a6a",
    LEAVING: "#ff5a5a",
};
export function draw(ctx, g, v, target, clickDest) {
    const { ts, ox, oy } = v;
    ctx.fillStyle = "#15110f";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const X = (x) => ox + x * ts;
    const Y = (y) => oy + y * ts;
    // Floors and walls
    for (const row of g.world.tiles) {
        for (const t of row) {
            ctx.fillStyle = t.def.floor;
            ctx.fillRect(X(t.x), Y(t.y), ts, ts);
            if (t.def.name === "Window") {
                // A pane of glass in the wall: a lighter frame, split in four.
                ctx.strokeStyle = "rgba(220,235,245,0.45)";
                ctx.lineWidth = 2;
                ctx.strokeRect(X(t.x) + 3, Y(t.y) + 3, ts - 6, ts - 6);
                ctx.beginPath();
                ctx.moveTo(X(t.x) + ts / 2, Y(t.y) + 3);
                ctx.lineTo(X(t.x) + ts / 2, Y(t.y) + ts - 3);
                ctx.moveTo(X(t.x) + 3, Y(t.y) + ts / 2);
                ctx.lineTo(X(t.x) + ts - 3, Y(t.y) + ts / 2);
                ctx.stroke();
                ctx.lineWidth = 1;
            }
            if (t.def.kind !== "wall") {
                ctx.strokeStyle = "rgba(0,0,0,0.08)";
                ctx.strokeRect(X(t.x) + 0.5, Y(t.y) + 0.5, ts - 1, ts - 1);
            }
        }
    }
    // Room labels
    ctx.font = `${Math.floor(ts * 0.5)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,240,220,0.18)";
    for (const r of g.innDef.rooms)
        ctx.fillText(r.text, X(r.x), Y(r.y));
    // Simple fixed shapes per tile kind
    for (const row of g.world.tiles) {
        for (const t of row) {
            const k = t.def.kind;
            const x = X(t.x), y = Y(t.y);
            if (k === "door" && t.ch !== "f") {
                ctx.fillStyle = "#4a3426";
                ctx.fillRect(x + ts * 0.1, y + ts * 0.1, ts * 0.8, ts * 0.8);
            }
            if (t.ch === "f") {
                // The counter flap: a hinged plank folded back against the wall, and a gap you can walk through.
                ctx.fillStyle = "#6b4a32";
                ctx.fillRect(X(t.x) + ts * 0.78, Y(t.y) + ts * 0.08, ts * 0.16, ts * 0.84);
                ctx.strokeStyle = "rgba(255,230,190,0.35)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(X(t.x) + ts * 0.06, Y(t.y) + ts * 0.5);
                ctx.lineTo(X(t.x) + ts * 0.7, Y(t.y) + ts * 0.5);
                ctx.stroke();
            }
            if (k === "front") {
                ctx.fillStyle = g.open ? (g.lastCall ? "#c98a3a" : "#6fbf5f") : "#7a3a2a";
                if (g.frontDoor.open) {
                    // Ajar: the door swung to one side, the doorway dark behind it
                    ctx.fillStyle = "#1a1410";
                    ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84);
                    ctx.fillStyle = g.open ? (g.lastCall ? "#c98a3a" : "#6fbf5f") : "#7a3a2a";
                    ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.22, ts * 0.84);
                }
                else
                    ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84);
            }
            if (k === "counter") {
                ctx.fillStyle = "#5a3d28";
                ctx.fillRect(x, y + ts * 0.1, ts, ts * 0.8);
            }
            if (k === "table") {
                ctx.fillStyle = "#6b4a30";
                ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84);
            }
            if (k === "chair") {
                ctx.fillStyle = "#4e3826";
                ctx.fillRect(x + ts * 0.28, y + ts * 0.28, ts * 0.44, ts * 0.44);
            }
            if (k === "bench") {
                ctx.fillStyle = "#4e3826";
                ctx.fillRect(x + ts * 0.12, y + ts * 0.12, ts * 0.76, ts * 0.76);
            }
            if (k === "stool") {
                ctx.fillStyle = "#4e3826";
                ctx.beginPath();
                ctx.arc(x + ts / 2, y + ts / 2, ts * 0.22, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    // Snack bowls
    // Reserved tables: a little card on the table
    for (const [key] of g.reservations) {
        const [tx, ty] = key.split(",").map(Number);
        ctx.fillStyle = "#f3e6d0";
        ctx.fillRect(X(tx) + ts * 0.3, Y(ty) + ts * 0.3, ts * 0.4, ts * 0.32);
        ctx.fillStyle = "#7a3a2a";
        ctx.font = `bold ${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("R", X(tx) + ts * 0.5, Y(ty) + ts * 0.47);
    }
    // Mess: crumbs on tables, spills on the floor
    for (const [key, d] of g.dirt) {
        if (d <= 0.3)
            continue;
        const [ax, ay] = key.split(",").map(Number);
        const tf = g.world.furniture.find((ff) => ff.kind === "table" && ff.tiles[0].x === ax && ff.tiles[0].y === ay);
        for (const { x: tx, y: ty } of tf ? tf.tiles : [{ x: ax, y: ay }]) {
            const n = Math.min(7, Math.ceil(d * 2.5));
            ctx.fillStyle = d >= TUNING.tableDirtyAt ? "#d9c6a0" : "rgba(217,198,160,0.7)";
            for (let i = 0; i < n; i++) {
                const rx = ((i * 37 + tx * 13) % 10) / 10, ry = ((i * 53 + ty * 7) % 10) / 10;
                ctx.fillRect(X(tx) + ts * (0.18 + rx * 0.6), Y(ty) + ts * (0.18 + ry * 0.6), ts * 0.08, ts * 0.08);
            }
            if (d >= TUNING.tableDirtyAt) {
                ctx.strokeStyle = "rgba(255,200,120,0.5)";
                ctx.strokeRect(X(tx) + 3, Y(ty) + 3, ts - 6, ts - 6);
            }
        }
    }
    for (const sp of g.spills) {
        ctx.fillStyle = "rgba(190,150,70,0.55)";
        ctx.beginPath();
        ctx.ellipse(X(sp.x) + ts / 2, Y(sp.y) + ts / 2, ts * 0.32, ts * 0.2, 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    // Furniture pieces
    ctx.textBaseline = "middle";
    for (const f of g.world.furniture) {
        if (f.kind === "frontdoor")
            continue;
        const xs = f.tiles.map((t) => t.x), ys = f.tiles.map((t) => t.y);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
        const px = X(x0) + ts * 0.06, py = Y(y0) + ts * 0.06, pw = (x1 - x0) * ts - ts * 0.12, ph = (y1 - y0) * ts - ts * 0.12;
        let fill = "#3d2d22";
        if (f.kind === "station")
            fill = "#4f4a44";
        if (f.kind === "hatch")
            fill = "#6a5a3a";
        if (f.kind === "tap")
            fill = "#7a5530";
        if (f.kind === "urn")
            fill = "#5e6470";
        if (f.kind === "breadcase")
            fill = "#8a6a3e";
        if (f.kind === "piesafe")
            fill = "#7a5a46";
        if (f.kind === "bin")
            fill = "#3f4a3a";
        if (f.kind === "garnish")
            fill = "#6e7a3a";
        if (f.kind === "fireplace")
            fill = g.fireLit ? "#d2691e" : "#3a3330";
        if (f.kind === "bed")
            fill = "#8a5a5a";
        ctx.fillStyle = fill;
        ctx.fillRect(px, py, pw, ph);
        if (f.kind === "fireplace" && g.fireLit) {
            const glow = ctx.createRadialGradient(X(f.center.x), Y(f.center.y), ts * 0.3, X(f.center.x), Y(f.center.y), ts * 4);
            glow.addColorStop(0, "rgba(255,160,60,0.25)");
            glow.addColorStop(1, "rgba(255,160,60,0)");
            ctx.fillStyle = glow;
            ctx.fillRect(X(f.center.x) - ts * 4, Y(f.center.y) - ts * 4, ts * 8, ts * 8);
        }
        const label = g.world.tile(x0, y0)?.def.label ?? "";
        ctx.fillStyle = "#f3e6d0";
        ctx.font = `${Math.floor(ts * 0.32)}px system-ui, sans-serif`;
        if (label)
            ctx.fillText(label, px + pw / 2, py + ph / 2);
        // Each place to cook (a hob, an oven) gets its share of the width: progress, pot, waiting dishes.
        const slots = f.slots ?? [];
        slots.forEach((sl, si) => {
            const sw = pw / slots.length, sx = px + sw * si;
            if (slots.length > 1) {
                // Show the hobs and the oven: a ring for a hob, a door for an oven.
                ctx.strokeStyle = "rgba(255,240,220,0.35)";
                ctx.lineWidth = 1;
                const cx = sx + sw / 2, cy = py + ph * 0.72;
                if (sl.kinds.includes("oven"))
                    ctx.strokeRect(cx - sw * 0.3, cy - ph * 0.14, sw * 0.6, ph * 0.22);
                else {
                    ctx.beginPath();
                    ctx.arc(cx, cy, Math.min(sw, ph) * 0.14, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            const job = g.jobs.get(sl.id);
            if (job) {
                const r = RECIPES.find((x) => x.id === job.recipeId);
                const pct = Math.min(1, job.progress / job.total);
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(sx + 1, py + ph + 2, sw - 2, ts * 0.18);
                ctx.fillStyle = job.done ? "#ffd34d" : r.tended ? "#ff9f43" : "#7fd37f";
                ctx.fillRect(sx + 1, py + ph + 2, (sw - 2) * pct, ts * 0.18);
                if (!job.done && (slots.length === 1 || (target?.type === "furniture" && target.part?.id === sl.id)))
                    barLabel(ctx, jobWord(r.station), sx + sw / 2, py + ph + 1, ts);
                ctx.fillStyle = "#fff";
                ctx.font = `${Math.floor(ts * (slots.length > 1 ? 0.24 : 0.28))}px system-ui, sans-serif`;
                ctx.fillText(slots.length > 1 ? r.icon : r.name, sx + sw / 2, py + ph + ts * 0.45);
            }
            const pot = g.pots.get(sl.id);
            if (pot) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(sx + 1, py + ph + 2, sw - 2, ts * 0.18);
                ctx.fillStyle = "#e0b060";
                ctx.fillRect(sx + 1, py + ph + 2, (sw - 2) * (pot.left / pot.total), ts * 0.18);
                badge(ctx, sx + sw - 2, py + 2, String(pot.left), ts);
                if (slots.length > 1) {
                    ctx.font = `${Math.floor(ts * 0.24)}px system-ui, sans-serif`;
                    ctx.fillText(iconFor(pot.item.recipeId) || "🍲", sx + sw / 2, py + ph + ts * 0.45);
                }
            }
            if (sl.gear && !job && !pot) {
                ctx.fillStyle = "#fff";
                ctx.font = `${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
                ctx.fillText(sl.gear.icon, sx + sw / 2, py + ph * 0.3);
            }
            // Finished dishes waiting: a warm outline and their icons, ready to pick up.
            const shelf = g.shelves.get(sl.id);
            if (shelf?.length) {
                ctx.strokeStyle = "#ffd34d";
                ctx.lineWidth = Math.max(1, ts * 0.06);
                ctx.strokeRect(sx + 1, py + 1, sw - 2, ph - 2);
                ctx.lineWidth = 1;
                ctx.font = `${Math.floor(ts * 0.42)}px system-ui, sans-serif`;
                ctx.textAlign = "center";
                shelf.forEach((it, i) => ctx.fillText(iconFor(it.recipeId, it.garnish) || "🍽", sx + ts * 0.3 + i * ts * 0.42, py - ts * 0.18));
            }
        });
        if (f.kind === "breadcase") {
            const n = breadCaseKeys(f.id).reduce((a, k) => a + (g.pots.get(k)?.left ?? 0), 0);
            if (n)
                badge(ctx, px + pw - 2, py + 2, String(n), ts);
        }
        if (f.kind === "urn") {
            const pot = g.pots.get(f.id);
            if (pot)
                badge(ctx, px + pw - 2, py + 2, String(pot.left), ts);
        }
        if (f.kind === "piesafe" && g.pieSafe.length) {
            // Pie safes share the pies, filling in order: each shows the slices in its own share.
            const safes = g.layout.filter((p) => p.type === "pieSafe").map((p) => p.uid);
            const i = Math.max(0, safes.indexOf(f.id)), cap = PIE_SAFE_CAPACITY;
            const mine = g.pieSafe.slice(i * cap, (i + 1) * cap).reduce((a, p) => a + p.left, 0);
            if (mine)
                badge(ctx, px + pw - 2, py + 2, String(mine), ts);
        }
        if (f.kind === "hatch" && g.hatch.length) {
            badge(ctx, px + pw - 2, py + 2, String(g.hatch.length), ts);
        }
    }
    // A bowl you can see from across the room: the snack's icon in a pale bowl, a ring for how full it is.
    for (const [key, b] of g.bowls) {
        const [tx, ty] = key.split(",").map(Number);
        // On a table, the bowl sits in the middle of the whole table (a long table is keyed by its first tile).
        const table = g.world.furniture.find((f) => f.kind === "table" && f.tiles[0].x === tx && f.tiles[0].y === ty);
        const cx = table ? X(table.center.x) : X(tx) + ts * 0.5, cy = table ? Y(table.center.y) : Y(ty) + ts * 0.5;
        const r = ts * 0.3;
        ctx.fillStyle = "#efe3c8";
        ctx.strokeStyle = "#5a4636";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (b.left > 0) {
            ctx.strokeStyle = b.left < 0.15 ? "#d9634a" : "#c9a24a";
            ctx.lineWidth = Math.max(2, ts * 0.07);
            ctx.beginPath();
            ctx.arc(cx, cy, r + ts * 0.04, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.left);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
        const sn = SNACKS.find((x) => x.id === b.snack);
        ctx.globalAlpha = b.left > 0.02 ? 1 : 0.35;
        ctx.font = `${Math.floor(ts * 0.36)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sn?.icon ?? "🥣", cx, cy + 1);
        ctx.globalAlpha = 1;
    }
    // Target highlight
    if (target) {
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 2;
        if (target.type === "furniture") {
            for (const t of target.f.tiles)
                ctx.strokeRect(X(t.x) + 1, Y(t.y) + 1, ts - 2, ts - 2);
        }
        else {
            const c = target.type === "patron" ? target.p.pos : spotOf(target);
            ctx.beginPath();
            ctx.arc(X(c.x), Y(c.y), ts * 0.48, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.lineWidth = 1;
    }
    // The carter's crates, on the floor until unpacked.
    for (const cr of g.crates) {
        ctx.fillStyle = "#a8743f";
        ctx.fillRect(X(cr.x) + ts * 0.15, Y(cr.y) + ts * 0.15, ts * 0.7, ts * 0.7);
        ctx.strokeStyle = "#5a3a1a";
        ctx.lineWidth = 2;
        ctx.strokeRect(X(cr.x) + ts * 0.15, Y(cr.y) + ts * 0.15, ts * 0.7, ts * 0.7);
        ctx.lineWidth = 1;
        ctx.font = `${Math.floor(ts * 0.42)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("📦", X(cr.x) + ts / 2, Y(cr.y) + ts / 2);
    }
    // Trays set down on counters and tables
    for (const sd of g.setDown) {
        const x = X(sd.x) + ts * 0.15, y = Y(sd.y) + ts * 0.25;
        ctx.fillStyle = TRAY_COLOUR[trayLook(sd.tray) ?? "mixed"];
        ctx.fillRect(x, y, ts * 0.7, ts * 0.5);
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, ts * 0.7, ts * 0.5);
        ctx.lineWidth = 1;
        ctx.fillStyle = "#2a1d14";
        sd.tray.items.forEach((_, j) => ctx.fillRect(x + ts * 0.06 + j * ts * 0.15, y + ts * 0.15, ts * 0.1, ts * 0.2));
    }
    if (clickDest) {
        ctx.fillStyle = "rgba(255,224,138,0.5)";
        ctx.beginPath();
        ctx.arc(X(clickDest.x), Y(clickDest.y), ts * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }
    // Patrons and keeper: bodies first, then the light, then what they say and carry (so it stays readable).
    for (const p of g.patrons)
        drawPatron(ctx, g, p, X, Y, ts, "body");
    // Keeper
    const k = g.keeper;
    ctx.fillStyle = "#f2e2c2";
    ctx.strokeStyle = "#2a1d14";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(k.pos.x), Y(k.pos.y), ts * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = "#2a1d14";
    {
        const f = k.facing, side = { x: -f.y * 0.11, y: f.x * 0.11 };
        const at = (s) => ({ x: X(k.pos.x + f.x * 0.2 + side.x * s), y: Y(k.pos.y + f.y * 0.2 + side.y * s) });
        drawEyes(ctx, at(-1), at(1), ts);
    }
    drawLight(ctx, g, (x, y) => ({ x: X(x), y: Y(y) }), ts);
    for (const p of g.patrons)
        drawPatron(ctx, g, p, X, Y, ts, "words");
    if (g.keeperLine && g.minute < g.keeperLine.until) {
        speech.push({ x: X(k.pos.x), anchor: Y(k.pos.y) - ts * 0.38, text: `“${g.keeperLine.text}”`, color: "#ffe08a" });
    }
    drawLevelUp(ctx, g, v);
    drawGuide(ctx, g, v);
    drawSpeech(ctx, ts);
    drawCoinPops(ctx, g, v); // over the speech, so the coin always reads
    const busy = g.cleaning ?? g.pouring ?? g.winding;
    if (busy) {
        const pct = Math.min(1, busy.progress / busy.total);
        const bx = X(k.pos.x) - ts * 0.5, by = Y(k.pos.y) - ts * 0.75;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(bx, by, ts, ts * 0.16);
        ctx.fillStyle = g.winding ? "#c9a24a" : g.pouring ? "#e8b25a" : "#8fd3ff";
        ctx.fillRect(bx, by, ts * pct, ts * 0.16);
        barLabel(ctx, busyWord(g), bx + ts / 2, by - 2, ts);
    }
    // Paused overlay
    if (g.paused) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.floor(ts * 1.2)}px Georgia, serif`;
        ctx.textAlign = "center";
        ctx.fillText("Paused", ctx.canvas.width / 2, ctx.canvas.height / 2);
        ctx.font = `${Math.floor(ts * 0.5)}px system-ui, sans-serif`;
        ctx.fillText("Press P to resume", ctx.canvas.width / 2, ctx.canvas.height / 2 + ts);
    }
}
/** "body": the circle (dimmed by the light, drawn after). "words": name, dish, order, marker, speech. */
function drawPatron(ctx, g, p, X, Y, ts, part) {
    // Soaked: a shiver, a cold tint, a drop falling. All fade as they dry.
    const wet = p.soaked ?? 0;
    const t = performance.now() / 1000;
    const shiver = wet > 0.08 ? Math.sin(t * 38 + p.id) * ts * 0.035 * Math.min(1, wet * 1.5) : 0;
    const x = X(p.pos.x) + shiver, y = Y(p.pos.y);
    if (part === "body") {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.state === "leaving" ? 0.6 : 1;
        ctx.beginPath();
        ctx.arc(x, y, ts * 0.32, 0, Math.PI * 2);
        ctx.fill();
        if (wet > 0.05) {
            ctx.fillStyle = SOAKING.tint;
            ctx.globalAlpha *= Math.min(0.6, wet * 0.7);
            ctx.beginPath();
            ctx.arc(x, y, ts * 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = Math.min(0.9, wet + 0.2);
            const fall = (t * 1.4 + p.id * 0.37) % 1;
            ctx.beginPath();
            ctx.arc(x + ts * 0.18, y + ts * (0.2 + fall * 0.3), ts * 0.05, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
    }
    drawPatronWords(ctx, g, p, x, y, ts);
}
/** Name, what's in front of them, the order plaque, a marker and what they say, around a guest standing at (x, y) on screen. */
export function drawPatronWords(ctx, g, p, x, y, ts) {
    ctx.fillStyle = "#f8f0e0";
    ctx.font = `${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(p.name, x, y + ts * 0.55);
    // What's in front of them: a dish or a drink, slowly going down
    if (p.consuming && p.state === "consuming") {
        const cx = x + ts * 0.42, cy = y - ts * 0.05;
        const total = Math.max(1, p.consumeUntil - p.consuming.from);
        const left = Math.max(0, Math.min(1, (p.consumeUntil - g.minute) / total));
        ctx.fillStyle = "rgba(255,248,235,0.92)";
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.consuming.kind === "drink" ? "#5b8fc9" : "#c98a3a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.font = `${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.consuming.icon, cx, cy + 1);
    }
    let lineY = y - ts * 0.58;
    // Order plaque: the same as the one on the ticket, ring and all, on the same clock.
    const o = g.order(p.orderId);
    if (o?.open && p.state === "waiting") {
        const f = walkoutProgress(g, p) ?? 0;
        const R = ts * 0.34, r = R * (30 / 38); // the ticket's proportions: 38px ring, 30px plaque
        lineY -= ts * 0.06;
        ctx.fillStyle = RING_TRACK;
        ctx.beginPath();
        ctx.arc(x, lineY, R, 0, Math.PI * 2);
        ctx.fill();
        if (f > 0) {
            ctx.fillStyle = ringColor(f);
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.arc(x, lineY, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = "#f4efe4";
        ctx.strokeStyle = "#222";
        ctx.lineWidth = Math.max(1, ts * 0.04);
        ctx.beginPath();
        ctx.arc(x, lineY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#222";
        const digits = String(o.no).length;
        ctx.font = `700 ${Math.floor(r * (digits >= 3 ? PLAQUE_FONT * 0.72 : digits === 2 ? PLAQUE_FONT * 0.86 : PLAQUE_FONT))}px "Playfair Display", Georgia, serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        const m = ctx.measureText(String(o.no));
        const gx = x - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
        const gy = lineY + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
        ctx.fillText(String(o.no), gx, gy);
        lineY -= ts * 0.62;
    }
    // Outcome marker (debug-visible state)
    if (p.marker && g.minute < p.marker.until) {
        ctx.font = `bold ${Math.floor(ts * 0.3)}px system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        const w = ctx.measureText(p.marker.text).width + ts * 0.3;
        ctx.fillStyle = PLATE;
        roundRect(ctx, x - w / 2, lineY - ts * 0.2, w, ts * 0.4, ts * 0.12);
        ctx.fill();
        ctx.fillStyle = OUTCOME_COLOR[p.marker.text] ?? "#fff";
        ctx.fillText(p.marker.text, x, lineY + 1);
        lineY -= ts * 0.45;
    }
    // Spoken line: collected here, laid out together after everyone's drawn so bubbles don't overlap.
    if (p.line && g.minute < p.line.until && p.line.text) {
        speech.push({ x, anchor: lineY + ts * 0.2, text: `“${p.line.text}”`, color: "#fff6e0" });
    }
}
// ---------------------------------------------------------------------------
// Speech bubbles: a dark, semi-transparent rounded plate with a small tail pointing at the speaker.
// Collected during the frame, then placed so plates from different speakers nudge apart.
export const PLATE = "rgba(22,17,13,0.82)";
const speech = [];
/** A line to show this frame, over the point (x, anchor); laid out with the rest by drawSpeech. */
export function say(x, anchor, text, color) { speech.push({ x, anchor, text, color }); }
function wrapText(ctx, text, maxW) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (cur && ctx.measureText(next).width > maxW) {
            lines.push(cur);
            cur = w;
        }
        else
            cur = next;
    }
    if (cur)
        lines.push(cur);
    return lines;
}
export function drawSpeech(ctx, ts) {
    if (!speech.length)
        return;
    ctx.font = `italic ${Math.floor(ts * 0.28)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lh = ts * 0.34, padX = ts * 0.18, padY = ts * 0.1, tail = ts * 0.16, gap = ts * 0.06;
    const boxes = speech.map((s) => {
        const lines = wrapText(ctx, s.text, ts * 5.5);
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
        const h = lines.length * lh + padY * 2;
        let bx = s.x - w / 2;
        bx = Math.max(2, Math.min(ctx.canvas.width - w - 2, bx));
        return { s, lines, w, h, x: bx, y: s.anchor - tail - h };
    });
    // Lowest speakers first; anyone above who'd overlap gets nudged up (or sideways if there's no room above).
    boxes.sort((a, b) => b.s.anchor - a.s.anchor);
    const placed = [];
    const hits = (a, b) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
    for (const b of boxes) {
        for (let tries = 0; tries < 12; tries++) {
            const other = placed.find((o) => hits(b, o));
            if (!other)
                break;
            b.y = other.y - b.h - gap;
        }
        if (b.y < 2)
            b.y = 2;
        placed.push(b);
    }
    for (const b of placed) {
        ctx.fillStyle = PLATE;
        roundRect(ctx, b.x, b.y, b.w, b.h, ts * 0.14);
        ctx.fill();
        // The tail: from the plate's bottom edge to just above the speaker (it stretches if the plate was nudged).
        const tx = Math.max(b.x + ts * 0.2, Math.min(b.x + b.w - ts * 0.2, b.s.x));
        ctx.beginPath();
        ctx.moveTo(tx - ts * 0.09, b.y + b.h - 0.5);
        ctx.lineTo(tx + ts * 0.09, b.y + b.h - 0.5);
        ctx.lineTo(b.s.x, b.s.anchor);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = b.s.color;
        b.lines.forEach((l, i) => ctx.fillText(l, b.x + b.w / 2, b.y + padY + lh * (i + 0.5) + 1));
    }
    speech.length = 0;
}
/** A small turned coin: an ellipse with its edge showing on one side, in the coin's metal. */
export function drawCoin(ctx, cx, cy, r, coin) {
    const c = COINS[coin];
    const rx = r * 0.68, edge = r * 0.22;
    ctx.fillStyle = c.edge; // the edge, seen because the coin is turned
    ctx.beginPath();
    ctx.ellipse(cx + edge, cy, rx, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx, cy - r, edge, r * 2);
    ctx.fillStyle = c.face;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = c.rim;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.72, r * 0.74, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)"; // a glint
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.35, cy - r * 0.4, rx * 0.18, r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();
}
/** Money on the canvas, left-aligned at (x, baseline y): a coin, its count, the next coin… Returns the width. */
export function drawMoney(ctx, x, y, pence, size, prefix = "") {
    const r = size * 0.5, gap = size * 0.2;
    let at = x;
    const text = (t) => {
        ctx.strokeText(t, at, y);
        ctx.fillText(t, at, y);
        at += ctx.measureText(t).width;
    };
    if (prefix)
        text(prefix);
    for (const p of coinParts(pence)) {
        drawCoin(ctx, at + r * 0.75, y - size * 0.38, r, p.coin);
        at += r * 1.9 + gap * 0.5;
        text(String(p.n));
        at += gap;
    }
    return at - x;
}
/** Coin changing hands: "+ coins", and a tip after it, rising beside the guest and fading. */
const POP_SECONDS = 1.8;
export function drawCoinPops(ctx, g, v) {
    const now = performance.now();
    g.coinPops = g.coinPops.filter((c) => now - c.at < POP_SECONDS * 1000);
    if (!g.coinPops.length)
        return;
    const ts = v.ts, size = Math.max(12, Math.floor(ts * 0.38));
    ctx.save();
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    for (const c of g.coinPops) {
        const t = (now - c.at) / (POP_SECONDS * 1000);
        // Beside the guest; drawn over the speech so it always reads.
        const at = P(v, c.x, c.y, v.iso ? 0.9 : 0);
        let x = at.x + ts * 0.45;
        const y = at.y + ts * 0.3 - t * ts * 0.6;
        ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ctx.lineWidth = Math.max(3, size * 0.22);
        ctx.strokeStyle = "rgba(20,14,6,0.9)";
        ctx.fillStyle = "#fff4d6";
        if (c.paid)
            x += drawMoney(ctx, x, y, c.paid, size, "+") + size * 0.2;
        if (c.tip) {
            ctx.fillStyle = "#fff1a8";
            drawMoney(ctx, x, y, c.tip, c.paid ? size : Math.round(size * 1.2), c.paid ? "tip " : "tip +");
        }
    }
    ctx.restore();
}
/**
 * The guide (walkthrough.ts): a soft ring on the floor and an arrow bobbing over where to go. Off the
 * screen, the arrow waits at the edge, pointing the way. Both views; drawn over everything but the speech.
 */
export function drawGuide(ctx, g, v) {
    if (g.arranging)
        return;
    const guide = worldGuide(g);
    if (!guide)
        return;
    const t = performance.now() / 1000, ts = v.ts;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const squash = v.iso ? 0.5 : 1;
    const c = P(v, guide.at.x, guide.at.y, 0);
    const r = ts * (0.62 + 0.06 * pulse) * guide.size;
    ctx.save();
    ctx.lineWidth = Math.max(1.5, ts * 0.045);
    ctx.strokeStyle = `rgba(255,211,77,${0.25 + 0.25 * pulse})`;
    ctx.shadowColor = "rgba(255,211,77,0.6)";
    ctx.shadowBlur = ts * 0.2;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * squash, 0, 0, Math.PI * 2);
    ctx.stroke();
    const top = P(v, guide.at.x, guide.at.y, v.iso ? guide.z : 0);
    const aw = ts * 0.28;
    const bob = ts * 0.14 * Math.abs(Math.sin(t * 2.6));
    const W = ctx.canvas.width, H = ctx.canvas.height, m = aw * 1.6;
    const tipX = top.x, tipY = top.y - ts * (v.iso ? 0.25 : 0.7);
    const onScreen = tipX > m && tipX < W - m && tipY > m * 1.4 && tipY < H - m * 0.5;
    // On screen it points down at the place; off it, it sits at the edge and points toward it.
    const x = onScreen ? tipX : Math.max(m, Math.min(W - m, tipX));
    const y = onScreen ? tipY - bob : Math.max(m, Math.min(H - m, tipY));
    const angle = onScreen ? 0 : Math.atan2(tipY - y, tipX - x) - Math.PI / 2;
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (!onScreen)
        ctx.translate(0, -bob);
    ctx.shadowBlur = ts * 0.15;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.fillStyle = "#ffd34d";
    ctx.strokeStyle = "#3a2a00";
    ctx.lineWidth = Math.max(1.5, ts * 0.045);
    ctx.beginPath();
    ctx.moveTo(-aw * 0.4, -aw * 1.2);
    ctx.lineTo(aw * 0.4, -aw * 1.2);
    ctx.lineTo(aw * 0.4, -aw * 0.55);
    ctx.lineTo(aw * 0.9, -aw * 0.55);
    ctx.lineTo(0, aw * 0.3);
    ctx.lineTo(-aw * 0.9, -aw * 0.55);
    ctx.lineTo(-aw * 0.4, -aw * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (guide.label) {
        ctx.rotate(-angle);
        ctx.shadowBlur = 0;
        ctx.font = `600 ${Math.max(11, Math.floor(ts * 0.3))}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = ctx.measureText(guide.label).width, ph = ts * 0.46, pw = tw + ts * 0.5;
        const ly = onScreen ? -aw * 1.2 - ph * 0.75 : (y < H / 2 ? aw * 1.6 + ph / 2 : -aw * 1.6 - ph / 2);
        const lx = Math.max(-x + pw / 2 + 4, Math.min(W - x - pw / 2 - 4, 0));
        ctx.fillStyle = "rgba(22,17,13,0.88)";
        ctx.strokeStyle = "#ffd34d";
        ctx.lineWidth = 1.5;
        roundRect(ctx, lx - pw / 2, ly - ph / 2, pw, ph, ph / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffe08a";
        ctx.fillText(guide.label, lx, ly + 1);
    }
    ctx.restore();
}
/** What the keeper's busy bar is for. */
export const busyWord = (g) => (g.winding ? "Winding…" : g.pouring ? "Pouring…" : "Cleaning…");
/** What a station's bar is doing, by where it's made. */
export const jobWord = (station) => station === "kettle" ? "Boiling…" : station === "coffee" ? "Brewing…" : station === "oven" ? "Baking…" : station === "prep" ? "Preparing…" : "Cooking…";
/** A small word over a progress bar, centred at x with its foot at y. */
export function barLabel(ctx, text, x, y, ts) {
    ctx.save();
    ctx.font = `600 ${Math.max(10, Math.floor(ts * 0.22))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = Math.max(2, ts * 0.06);
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x, y);
    ctx.restore();
}
/** How open the keeper's eyes are, 0 to 1: a blink every few seconds, now and then a double one. */
export function eyeOpen(now = performance.now()) {
    const t = (now / 1000) % 5.3;
    const shut = (at) => Math.max(0, 1 - Math.abs(t - at) / 0.075);
    return 1 - Math.max(shut(0.08), t > 2.6 && Math.floor(now / 5300) % 3 === 0 ? shut(2.75) : 0);
}
/** The keeper's eyes: two upright ovals, side by side where they're looking. */
export function drawEyes(ctx, a, b, ts) {
    const open = eyeOpen();
    ctx.fillStyle = "#2a1d14";
    for (const e of [a, b]) {
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, ts * 0.032, Math.max(ts * 0.008, ts * 0.062 * open), 0, 0, Math.PI * 2);
        ctx.fill();
    }
}
export function badge(ctx, x, y, text, ts) {
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.arc(x, y, ts * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1d14";
    ctx.font = `bold ${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
    ctx.fillText(text, x, y + 1);
}
export function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
