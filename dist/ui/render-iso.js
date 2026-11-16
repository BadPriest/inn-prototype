// The isometric view: the same inn as render.ts, drawn as blocks seen from above and to the front.
// Picked on the pause screen (Display); the game underneath doesn't change, only drawing and clicking.
//
// Everything with height is a block per tile, painted back to front (by x + y), with people in among
// them, so the keeper passes behind a table or the counter. Walls are low except along the back edges
// (the two edges farthest from the camera, whichever corner it stands at), so nothing in the room hides
// behind them. What you need to read (labels, cooking,
// bowls, orders, speech) is drawn over the blocks, so a guest standing in front never hides it.
import { RECIPES, SNACKS, SOAKING, TUNING } from "../data.js";
import { iconFor } from "../serving.js";
import { drawLight, windowColor } from "./light.js";
import { ISO, P, Pt, floorPath, turn, turnedSize, unproject, unturn } from "./proj.js";
import { badge, drawDeskHint, drawPatronWords, drawSpeech, say } from "./render.js";
/** Height of the back walls, in tiles; every other wall is a low stub so you can see past it. */
const TALL = 1.5;
const LOW_WALL = 0.3;
/** A person: head centre and radius (in tiles of height and `ts`). */
const HEAD_Z = 0.62, HEAD_R = 0.26;
const KIND_HEIGHT = { counter: 0.5, table: 0.42, chair: 0.2, bench: 0.22, stool: 0.24 };
const PIECE_HEIGHT = {
    bed: 0.32, desk: 0.45, wardrobe: 1.1, station: 0.5, hatch: 0.55, tap: 0.62, fireplace: 0.9, pantry: 1.0,
    coats: 0.9, piesafe: 0.8, bin: 0.35, gramophone: 0.55, table: 0.42,
};
const PIECE_COLOR = {
    station: "#4f4a44", hatch: "#6a5a3a", tap: "#7a5530", piesafe: "#7a5a46", bin: "#3f4a3a", garnish: "#6e7a3a", bed: "#8a5a5a",
};
/** How far each kind sits in from its tile's edges (not between tiles of the same piece). */
const INSET = { chair: 0.28, stool: 0.3, bench: 0.12, table: 0.08, counter: 0.06, furniture: 0.06 };
/** `zoom`: 1 fits the inn (or the smallest readable size, following the keeper); more is closer. `rot`: camera corner. */
export function computeIsoView(canvas, g, minTile = 34, top = 0, zoom = 1, rot = 0) {
    const base = { iso: true, rot, mw: g.world.w, mh: g.world.h, ts: 1, ox: 0, oy: 0 };
    const { w, h } = turnedSize(base);
    const cw = canvas.width, ch = canvas.height - top;
    const spanX = (w + h) * ISO.a, spanY = (w + h) * ISO.b + TALL * ISO.z; // the map's size, in ts
    const fit = Math.min(cw / spanX, ch / spanY);
    const min = minTile * (window.devicePixelRatio || 1);
    const ts = Math.max(6, Math.floor(Math.max(fit, min) * zoom));
    // Centred when it fits; otherwise follow the keeper, keeping the map's edges on screen.
    const k = turn(base, g.keeper.pos.x, g.keeper.pos.y);
    const kx = (k.x - k.y) * ISO.a * ts, ky = (k.x + k.y) * ISO.b * ts;
    const axis = (span, view, lead, want) => span <= view ? (view - span) / 2 + lead : Math.max(view - span + lead, Math.min(lead, want));
    const ox = axis(spanX * ts, cw, h * ISO.a * ts, cw / 2 - kx);
    const oy = top + axis(spanY * ts, ch, TALL * ISO.z * ts, ch / 2 - ky);
    return { ...base, ts, ox: Math.floor(ox), oy: Math.floor(oy) };
}
/** Where a tile sits on the turned floor (its corner nearest the back), and its depth for painting. */
function turnedTile(v, x, y) {
    const c = turn(v, x + 0.5, y + 0.5);
    return { u: c.x - 0.5, w: c.y - 0.5, d: c.x + c.y };
}
const depth = (v, p) => { const t = turn(v, p.x, p.y); return t.x + t.y; };
/** Which way in the inn is toward the camera: the turned floor's +u (lower right) and +w (lower left). */
function towardViewer(v) {
    const o = unturn(v, 0, 0), a = unturn(v, 1, 0), b = unturn(v, 0, 1);
    return { u: { x: Math.round(a.x - o.x), y: Math.round(a.y - o.y) }, w: { x: Math.round(b.x - o.x), y: Math.round(b.y - o.y) } };
}
// ---------------------------------------------------------------------------
// Shapes
function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (s) => Math.round(((n >> s) & 255) * f);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
}
function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const q of pts.slice(1))
        ctx.lineTo(q.x, q.y);
    ctx.closePath();
}
/** A block: its two faces toward the viewer (+u lower right, +w lower left), then its top. */
function drawBox(ctx, v, b) {
    const a = turn(v, b.x0, b.y0), c = turn(v, b.x1, b.y1);
    const u0 = Math.min(a.x, c.x), u1 = Math.max(a.x, c.x), w0 = Math.min(a.y, c.y), w1 = Math.max(a.y, c.y), z = b.z;
    if (b.faceW) {
        ctx.fillStyle = shade(b.color, 0.72);
        poly(ctx, [Pt(v, u0, w1, z), Pt(v, u1, w1, z), Pt(v, u1, w1, 0), Pt(v, u0, w1, 0)]);
        ctx.fill();
    }
    if (b.faceU) {
        ctx.fillStyle = shade(b.color, 0.55);
        poly(ctx, [Pt(v, u1, w0, z), Pt(v, u1, w1, z), Pt(v, u1, w1, 0), Pt(v, u1, w0, 0)]);
        ctx.fill();
    }
    ctx.fillStyle = b.color;
    poly(ctx, [Pt(v, u0, w0, z), Pt(v, u1, w0, z), Pt(v, u1, w1, z), Pt(v, u0, w1, z)]);
    ctx.fill();
}
/** Where a tile's block is on screen (for clicks): a hexagon. */
function boxOutline(v, x, y, z) {
    const { u, w } = turnedTile(v, x, y);
    return [Pt(v, u, w, z), Pt(v, u + 1, w, z), Pt(v, u + 1, w, 0), Pt(v, u + 1, w + 1, 0), Pt(v, u, w + 1, 0), Pt(v, u, w + 1, z)];
}
function inside(pts, p) {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
            hit = !hit;
    }
    return hit;
}
// ---------------------------------------------------------------------------
// What stands on each tile
function pieceIndex(g) {
    const m = new Map();
    for (const f of g.world.furniture)
        for (const t of f.tiles)
            m.set(`${t.x},${t.y}`, f);
    return m;
}
/** A wall along one of the two edges farthest from the camera. */
function isBackWall(v, t) {
    const { u, w } = turnedTile(v, t.x, t.y);
    return Math.round(u) === 0 || Math.round(w) === 0;
}
function heightOf(v, t, f) {
    const k = t.def.kind;
    if (k === "wall")
        return isBackWall(v, t) ? TALL : LOW_WALL;
    if (k === "floor" || k === "staff" || k === "door" || k === "front")
        return 0;
    if (f && PIECE_HEIGHT[f.kind] !== undefined && k === "furniture")
        return PIECE_HEIGHT[f.kind];
    return KIND_HEIGHT[k] ?? (k === "furniture" ? 0.5 : 0);
}
/** Tiles of the same piece (or a run of counter, or of wall) join up without a gap between them. */
function group(t, f) {
    if (t.def.kind === "counter")
        return "counter";
    if (t.def.kind === "wall")
        return "wall";
    if (t.def.kind === "chair" || t.def.kind === "stool" || t.def.kind === "bench")
        return null;
    return f?.id ?? null;
}
function colorOf(g, t, f) {
    const k = t.def.kind;
    if (k === "wall")
        return t.def.name === "Window" ? "#3a3a3c" : "#3b2f28";
    if (k === "counter")
        return t.def.interact === "garnish" ? PIECE_COLOR.garnish : "#5a3d28";
    if (k === "table")
        return "#6b4a30";
    if (k === "chair" || k === "bench" || k === "stool")
        return "#4e3826";
    if (f?.kind === "fireplace")
        return g.fireLit ? "#d2691e" : "#3a3330";
    return (f && PIECE_COLOR[f.kind]) ?? "#3d2d22";
}
function solids(g, v) {
    const idx = pieceIndex(g);
    const out = [];
    for (const row of g.world.tiles)
        for (const t of row) {
            const f = idx.get(`${t.x},${t.y}`);
            const z = heightOf(v, t, f);
            if (z > 0)
                out.push({ t, f, z });
        }
    return out;
}
function boxFor(g, v, s, all) {
    const { t, f, z } = s;
    const grp = group(t, f);
    const inset = INSET[t.def.kind] ?? 0;
    const joins = (dx, dy) => {
        const n = all.get(`${t.x + dx},${t.y + dy}`);
        return !!n && grp !== null && group(n.t, n.f) === grp;
    };
    const sameHeight = (dx, dy) => joins(dx, dy) && all.get(`${t.x + dx},${t.y + dy}`).z === z;
    const flap = t.ch === "f";
    const toward = towardViewer(v);
    return {
        x0: t.x + (joins(-1, 0) ? 0 : inset), x1: t.x + 1 - (joins(1, 0) ? 0 : inset),
        y0: t.y + (joins(0, -1) ? 0 : inset), y1: t.y + 1 - (joins(0, 1) ? 0 : inset),
        z, color: flap ? "#6b4a32" : colorOf(g, t, f), faceU: !sameHeight(toward.u.x, toward.u.y), faceW: !sameHeight(toward.w.x, toward.w.y),
    };
}
// ---------------------------------------------------------------------------
// People
function personBody(ctx, v, pos, color, alpha, wet, seed) {
    const ts = v.ts;
    const t = performance.now() / 1000;
    const shiver = wet > 0.08 ? Math.sin(t * 38 + seed) * ts * 0.035 * Math.min(1, wet * 1.5) : 0;
    const foot = P(v, pos.x, pos.y), head = P(v, pos.x, pos.y, HEAD_Z);
    foot.x += shiver;
    head.x += shiver;
    const r = HEAD_R * ts, bw = r * 0.85;
    const paint = () => {
        // A body tapering up from the floor to the head: a pawn, readable from any side.
        ctx.beginPath();
        ctx.moveTo(foot.x - bw, foot.y);
        ctx.lineTo(head.x - bw * 0.6, head.y);
        ctx.lineTo(head.x + bw * 0.6, head.y);
        ctx.lineTo(foot.x + bw, foot.y);
        ctx.ellipse(foot.x, foot.y, bw, bw * 0.5, 0, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
        ctx.fill();
    };
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    paint();
    if (wet > 0.05) {
        ctx.fillStyle = SOAKING.tint;
        ctx.globalAlpha = alpha * Math.min(0.6, wet * 0.7);
        paint();
        ctx.globalAlpha = Math.min(0.9, wet + 0.2);
        const fall = (t * 1.4 + seed * 0.37) % 1;
        ctx.beginPath();
        ctx.arc(head.x + r * 0.7, head.y + r * (0.8 + fall * 1.6), ts * 0.05, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}
function shadow(ctx, v, pos) {
    const c = P(v, pos.x, pos.y);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, v.ts * 0.3, v.ts * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
}
// ---------------------------------------------------------------------------
// The frame
export function drawIso(ctx, g, v, target, clickDest) {
    const ts = v.ts;
    ctx.fillStyle = "#15110f";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // The floor: a diamond per tile.
    for (const row of g.world.tiles)
        for (const t of row) {
            ctx.fillStyle = t.def.kind === "door" && t.ch !== "f" ? "#4a3426" : t.def.floor;
            floorPath(ctx, v, t.x, t.y, 1, 1);
            ctx.fill();
            if (t.def.kind !== "wall") {
                ctx.strokeStyle = "rgba(0,0,0,0.08)";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            if (t.def.kind === "front") {
                // The front door, set in the wall: green open, amber at last call, red closed; dark when it stands ajar.
                ctx.fillStyle = g.frontDoor.open ? "#1a1410" : g.open ? (g.lastCall ? "#c98a3a" : "#6fbf5f") : "#7a3a2a";
                floorPath(ctx, v, t.x, t.y, 1, 1, 0.08);
                ctx.fill();
            }
        }
    ctx.font = `${Math.floor(ts * 0.5)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,240,220,0.18)";
    for (const r of g.innDef.rooms) {
        const c = P(v, r.x, r.y);
        ctx.fillText(r.text, c.x, c.y);
    }
    for (const sp of g.spills) {
        const c = P(v, sp.x + 0.5, sp.y + 0.5);
        ctx.fillStyle = "rgba(190,150,70,0.55)";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, ts * 0.4, ts * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    if (clickDest) {
        const c = P(v, clickDest.x, clickDest.y);
        ctx.fillStyle = "rgba(255,224,138,0.5)";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, ts * 0.16, ts * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    for (const p of g.patrons)
        shadow(ctx, v, p.pos);
    shadow(ctx, v, g.keeper.pos);
    // Blocks and people, back to front.
    const solid = solids(g, v);
    const byTile = new Map(solid.map((s) => [`${s.t.x},${s.t.y}`, s]));
    const items = solid.map((s) => ({ d: turnedTile(v, s.t.x, s.t.y).d, pri: 0, draw: () => drawSolid(ctx, g, v, s, byTile) }));
    for (const p of g.patrons) {
        items.push({ d: depth(v, p.pos), pri: 1, draw: () => personBody(ctx, v, p.pos, p.color, p.state === "leaving" ? 0.6 : 1, p.soaked ?? 0, p.id) });
    }
    const k = g.keeper;
    items.push({
        d: depth(v, k.pos), pri: 1, draw: () => {
            personBody(ctx, v, k.pos, "#f2e2c2", 1, 0, 0);
            const eye = P(v, k.pos.x + k.facing.x * 0.16, k.pos.y + k.facing.y * 0.16, HEAD_Z);
            ctx.fillStyle = "#2a1d14";
            ctx.beginPath();
            ctx.arc(eye.x, eye.y, ts * 0.07, 0, Math.PI * 2);
            ctx.fill();
        },
    });
    items.sort((a, b) => a.d - b.d || a.pri - b.pri);
    for (const it of items)
        it.draw();
    drawReadables(ctx, g, v, byTile, target);
    drawLight(ctx, g, (x, y) => P(v, x, y), ts * ISO.a * Math.SQRT2, ISO.b / ISO.a, false);
    // What people say and carry, over everything.
    for (const p of g.patrons) {
        const foot = P(v, p.pos.x, p.pos.y);
        drawPatronWords(ctx, g, p, foot.x, foot.y - ts * 0.55, ts);
    }
    const kf = P(v, k.pos.x, k.pos.y), kh = P(v, k.pos.x, k.pos.y, HEAD_Z);
    k.trays.forEach((tray, i) => {
        const side = i === 0 ? -1 : 1;
        const n = Math.max(1, tray.items.length);
        const w = Math.max(ts * 0.4, n * ts * 0.32 + ts * 0.08);
        const tx = kf.x + side * (ts * 0.32) + (side < 0 ? -w : 0), ty = kf.y - ts * 0.5;
        ctx.fillStyle = tray.kind ? (tray.kind === "food" ? "rgba(201,164,107,0.9)" : "rgba(143,179,201,0.9)") : "rgba(255,255,255,0.15)";
        ctx.fillRect(tx, ty, w, ts * 0.38);
        ctx.font = `${Math.floor(ts * 0.3)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        tray.items.forEach((it, j) => ctx.fillText(iconFor(it.recipeId, it.garnish) || "🥣", tx + ts * 0.2 + j * ts * 0.32, ty + ts * 0.2));
    });
    if (g.keeperLine && g.minute < g.keeperLine.until)
        say(kh.x, kh.y - HEAD_R * ts - ts * 0.05, `“${g.keeperLine.text}”`, "#ffe08a");
    drawDeskHint(ctx, g, v);
    drawSpeech(ctx, ts);
    const busy = g.cleaning ?? g.pouring ?? g.winding;
    if (busy) {
        const pct = Math.min(1, busy.progress / busy.total);
        const bx = kh.x - ts * 0.5, by = kh.y - ts * 0.6;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(bx, by, ts, ts * 0.16);
        ctx.fillStyle = g.winding ? "#c9a24a" : g.pouring ? "#e8b25a" : "#8fd3ff";
        ctx.fillRect(bx, by, ts * pct, ts * 0.16);
    }
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
function drawSolid(ctx, g, v, s, byTile) {
    const t = s.t;
    if (t.ch === "f") {
        // The counter flap: a hinged plank folded back against its edge, and a gap to walk through.
        drawBox(ctx, v, { x0: t.x + 0.78, x1: t.x + 0.94, y0: t.y + 0.08, y1: t.y + 0.92, z: 0.5, color: "#6b4a32", faceU: true, faceW: true });
        return;
    }
    const b = boxFor(g, v, s, byTile);
    drawBox(ctx, v, b);
    if (t.def.name === "Window") {
        // Glass: on the face toward the room for a back wall, on top of a low one.
        ctx.fillStyle = windowColor(g);
        const m = 0.15, z0 = s.z * 0.25, z1 = s.z * 0.85;
        const { u, w } = turnedTile(v, t.x, t.y);
        if (s.z === TALL && Math.round(w) === 0)
            poly(ctx, [Pt(v, u + m, w + 1, z1), Pt(v, u + 1 - m, w + 1, z1), Pt(v, u + 1 - m, w + 1, z0), Pt(v, u + m, w + 1, z0)]);
        else if (s.z === TALL)
            poly(ctx, [Pt(v, u + 1, w + m, z1), Pt(v, u + 1, w + 1 - m, z1), Pt(v, u + 1, w + 1 - m, z0), Pt(v, u + 1, w + m, z0)]);
        else
            floorPath(ctx, v, t.x, t.y, 1, 1, 0.18, s.z);
        ctx.fill();
    }
}
/** Over the blocks: labels, cooking, waiting dishes, bowls, trays set down, mess, and what you're aiming at. */
function drawReadables(ctx, g, v, byTile, target) {
    const ts = v.ts;
    const zAt = (x, y) => byTile.get(`${x},${y}`)?.z ?? 0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Mess on tables: crumbs on the top; a warm outline once it wants wiping.
    for (const [key, d] of g.dirt) {
        if (d <= 0.3)
            continue;
        const [ax, ay] = key.split(",").map(Number);
        const tf = g.world.furniture.find((ff) => ff.kind === "table" && ff.tiles[0].x === ax && ff.tiles[0].y === ay);
        for (const { x: tx, y: ty } of tf ? tf.tiles : [{ x: ax, y: ay }]) {
            const z = zAt(tx, ty);
            const n = Math.min(7, Math.ceil(d * 2.5));
            ctx.fillStyle = d >= TUNING.tableDirtyAt ? "#d9c6a0" : "rgba(217,198,160,0.7)";
            for (let i = 0; i < n; i++) {
                const rx = ((i * 37 + tx * 13) % 10) / 10, ry = ((i * 53 + ty * 7) % 10) / 10;
                const c = P(v, tx + 0.18 + rx * 0.6, ty + 0.18 + ry * 0.6, z);
                ctx.fillRect(c.x - ts * 0.04, c.y - ts * 0.03, ts * 0.08, ts * 0.06);
            }
            if (d >= TUNING.tableDirtyAt) {
                ctx.strokeStyle = "rgba(255,200,120,0.5)";
                ctx.lineWidth = 1;
                floorPath(ctx, v, tx, ty, 1, 1, 0.1, z);
                ctx.stroke();
            }
        }
    }
    // Reserved tables: a card on the table.
    for (const [key] of g.reservations) {
        const [tx, ty] = key.split(",").map(Number);
        const c = P(v, tx + 0.5, ty + 0.5, zAt(tx, ty));
        ctx.fillStyle = "#f3e6d0";
        ctx.fillRect(c.x - ts * 0.2, c.y - ts * 0.36, ts * 0.4, ts * 0.32);
        ctx.fillStyle = "#7a3a2a";
        ctx.font = `bold ${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
        ctx.fillText("R", c.x, c.y - ts * 0.2);
    }
    // Furniture: its label, and for each place to cook, progress, the pot, and dishes waiting.
    for (const f of g.world.furniture) {
        if (f.kind === "frontdoor" || f.kind === "table")
            continue;
        const xs = f.tiles.map((t) => t.x), ys = f.tiles.map((t) => t.y);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
        const z = zAt(x0, y0);
        const top = P(v, f.center.x, f.center.y, z);
        const label = g.world.tile(x0, y0)?.def.label ?? "";
        if (label) {
            ctx.font = `${Math.floor(ts * 0.3)}px system-ui, sans-serif`;
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillText(label, top.x + 1, top.y + 1);
            ctx.fillStyle = "#f3e6d0";
            ctx.fillText(label, top.x, top.y);
        }
        const slots = f.slots ?? [];
        const alongX = x1 - x0 >= y1 - y0;
        slots.forEach((sl, si) => {
            const share = (si + 0.5) / slots.length;
            const cx = alongX ? x0 + (x1 - x0) * share : f.center.x, cy = alongX ? f.center.y : y0 + (y1 - y0) * share;
            const sp = P(v, cx, cy, z);
            const sw = Math.min(ts * 1.1, (ts * 1.4 * Math.max(x1 - x0, y1 - y0)) / slots.length);
            if (slots.length > 1) {
                ctx.strokeStyle = "rgba(255,240,220,0.4)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                if (sl.kinds.includes("oven"))
                    ctx.rect(sp.x - ts * 0.18, sp.y + ts * 0.02, ts * 0.36, ts * 0.14);
                else
                    ctx.ellipse(sp.x, sp.y + ts * 0.08, ts * 0.14, ts * 0.07, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            const barY = sp.y + ts * 0.32;
            const job = g.jobs.get(sl.id);
            if (job) {
                const r = RECIPES.find((x) => x.id === job.recipeId);
                const pct = Math.min(1, job.progress / job.total);
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(sp.x - sw / 2, barY, sw, ts * 0.16);
                ctx.fillStyle = job.done ? "#ffd34d" : r.tended ? "#ff9f43" : "#7fd37f";
                ctx.fillRect(sp.x - sw / 2, barY, sw * pct, ts * 0.16);
                ctx.fillStyle = "#fff";
                ctx.font = `${Math.floor(ts * (slots.length > 1 ? 0.24 : 0.26))}px system-ui, sans-serif`;
                ctx.fillText(slots.length > 1 ? r.icon : r.name, sp.x, barY + ts * 0.32);
            }
            const pot = g.pots.get(sl.id);
            if (pot) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(sp.x - sw / 2, barY, sw, ts * 0.16);
                ctx.fillStyle = "#e0b060";
                ctx.fillRect(sp.x - sw / 2, barY, sw * (pot.left / pot.total), ts * 0.16);
                badge(ctx, sp.x + sw / 2, sp.y - ts * 0.2, String(pot.left), ts);
                if (slots.length > 1) {
                    ctx.fillStyle = "#fff";
                    ctx.font = `${Math.floor(ts * 0.24)}px system-ui, sans-serif`;
                    ctx.fillText(iconFor(pot.item.recipeId) || "🍲", sp.x, barY + ts * 0.32);
                }
            }
            const shelf = g.shelves.get(sl.id);
            if (shelf?.length) {
                // Finished dishes waiting: a warm outline on its top, the dishes held up over it.
                const a0 = alongX ? x0 + ((x1 - x0) * si) / slots.length : x0, b0 = alongX ? y0 : y0 + ((y1 - y0) * si) / slots.length;
                const aw = alongX ? (x1 - x0) / slots.length : x1 - x0, bh = alongX ? y1 - y0 : (y1 - y0) / slots.length;
                ctx.strokeStyle = "#ffd34d";
                ctx.lineWidth = Math.max(1, ts * 0.06);
                floorPath(ctx, v, a0, b0, aw, bh, 0.06, z);
                ctx.stroke();
                ctx.lineWidth = 1;
                ctx.font = `${Math.floor(ts * 0.42)}px system-ui, sans-serif`;
                const w = (shelf.length - 1) * ts * 0.42;
                shelf.forEach((it, i) => ctx.fillText(iconFor(it.recipeId, it.garnish) || "🍽", sp.x - w / 2 + i * ts * 0.42, sp.y - ts * 0.55));
            }
        });
        if (f.kind === "piesafe" && g.pieSafe.length) {
            const safes = g.layout.filter((p) => p.type === "piesafe").map((p) => p.uid);
            const i = Math.max(0, safes.indexOf(f.id)), cap = TUNING.pieSafeCapacity;
            const mine = g.pieSafe.slice(i * cap, (i + 1) * cap).reduce((a, p) => a + p.left, 0);
            if (mine)
                badge(ctx, top.x + ts * 0.35, top.y - ts * 0.3, String(mine), ts);
        }
        if (f.kind === "hatch" && g.hatch.length)
            badge(ctx, top.x + ts * 0.35, top.y - ts * 0.3, String(g.hatch.length), ts);
    }
    // Snack bowls, on the middle of the table or the counter.
    for (const [key, b] of g.bowls) {
        const [tx, ty] = key.split(",").map(Number);
        const table = g.world.furniture.find((f) => f.kind === "table" && f.tiles[0].x === tx && f.tiles[0].y === ty);
        const c = table ? P(v, table.center.x, table.center.y, zAt(tx, ty)) : P(v, tx + 0.5, ty + 0.5, zAt(tx, ty));
        const r = ts * 0.3;
        ctx.fillStyle = "#efe3c8";
        ctx.strokeStyle = "#5a4636";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (b.left > 0) {
            ctx.strokeStyle = b.left < 0.15 ? "#d9634a" : "#c9a24a";
            ctx.lineWidth = Math.max(2, ts * 0.07);
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, r + ts * 0.04, r * 0.6 + ts * 0.04, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.left);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
        const sn = SNACKS.find((x) => x.id === b.snack);
        ctx.globalAlpha = b.left > 0.02 ? 1 : 0.35;
        ctx.font = `${Math.floor(ts * 0.36)}px system-ui, sans-serif`;
        ctx.fillText(sn?.icon ?? "🥣", c.x, c.y - ts * 0.04);
        ctx.globalAlpha = 1;
    }
    // Trays set down on counters and tables.
    for (const sd of g.setDown) {
        const z = zAt(sd.x, sd.y);
        floorPath(ctx, v, sd.x, sd.y, 1, 1, 0.18, z);
        ctx.fillStyle = sd.tray.kind === "food" ? "#c9a46b" : "#8fb3c9";
        ctx.fill();
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineWidth = 1;
        const c = P(v, sd.x + 0.5, sd.y + 0.5, z);
        ctx.fillStyle = "#2a1d14";
        sd.tray.items.forEach((_, j) => ctx.fillRect(c.x - ts * 0.2 + j * ts * 0.15, c.y - ts * 0.1, ts * 0.1, ts * 0.2));
    }
    // What you're aiming at.
    if (target) {
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 2;
        if (target.type === "furniture") {
            for (const t of target.f.tiles) {
                floorPath(ctx, v, t.x, t.y, 1, 1, 0.04, zAt(t.x, t.y));
                ctx.stroke();
            }
        }
        else {
            const c = target.type === "patron" ? target.p.pos : target.type === "tray" ? { x: target.t.x + 0.5, y: target.t.y + 0.5 } : { x: target.s.x + 0.5, y: target.s.y + 0.5 };
            const z = target.type === "tray" ? zAt(target.t.x, target.t.y) : 0;
            const q = P(v, c.x, c.y, z);
            ctx.beginPath();
            ctx.ellipse(q.x, q.y, ts * 0.5, ts * 0.25, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.lineWidth = 1;
    }
}
// ---------------------------------------------------------------------------
// Clicking: a person's body, then the blocks front to back, then the floor.
/** The point in the inn (tiles) under a canvas pixel, allowing for height: clicking the side of the counter means the counter. */
export function isoPick(g, v, sx, sy) {
    const ts = v.ts;
    const people = [...g.patrons].sort((a, b) => depth(v, b.pos) - depth(v, a.pos));
    for (const p of people) {
        const foot = P(v, p.pos.x, p.pos.y);
        if (Math.abs(sx - foot.x) < ts * 0.3 && sy < foot.y + ts * 0.12 && sy > foot.y - (HEAD_Z * ISO.z + HEAD_R) * ts)
            return { ...p.pos };
    }
    const blocks = solids(g, v).filter((s) => s.t.def.kind !== "wall").sort((a, b) => turnedTile(v, b.t.x, b.t.y).d - turnedTile(v, a.t.x, a.t.y).d);
    for (const s of blocks)
        if (inside(boxOutline(v, s.t.x, s.t.y, s.z), { x: sx, y: sy }))
            return { x: s.t.x + 0.5, y: s.t.y + 0.5 };
    return unproject(v, sx, sy);
}
