// Innsight (inn#90): hold L2 (Alt) to read the room; R2 (Shift+Alt) adds what only a debugger sees.
// The camera eases in, the room greys out, guests show their occupation's colour, and a card under
// each one says what the keeper has seen: who they are, roughly how they're doing, what they were
// served and how it went. Tastes stay unknown: the card shows evidence, never the answer.
import { RECIPES } from "../data.js";
import { have } from "../stock.js";
import { COATS } from "./wardrobe.js";
import { PLATE } from "./render.js";
const held = { key: null, pad: null };
let mix = 0;
let ease = 0;
export const INSIGHT = { zoom: 1.9, seconds: 0.45, saturation: 0.8, dim: 0.22 };
export function holdInsight(from, mode) { held[from] = mode; }
export const insightMode = () => held.pad ?? held.key;
export const insightMix = () => mix;
/** Each frame: ease towards held or let go. Returns the zoom to multiply the camera's by. */
export function updateInsight(realDt) {
    const target = insightMode() ? 1 : 0;
    ease = Math.max(0, Math.min(1, ease + Math.sign(target - ease) * (realDt / INSIGHT.seconds)));
    mix = ease * ease * (3 - 2 * ease);
    return 1 + (INSIGHT.zoom - 1) * mix;
}
const hash = (s) => { let h = 2166136261; for (const c of s)
    h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const seedOf = (p) => hash(p.regularId ?? `v${p.id}`);
function lerp(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
/** Everyday clothes, like the keeper's; their occupation's colour shows through under Innsight. */
export const guestColor = (p) => lerp(COATS[seedOf(p) % COATS.length].color, p.color, mix);
export const guestHead = (p) => lerp(COATS[(seedOf(p) >>> 8) % COATS.length].color, p.color, mix);
/** Grey the room out (everything drawn so far). */
export function washRoom(ctx) {
    if (mix <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = `rgba(128,128,128,${INSIGHT.saturation * mix})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(14,10,8,${INSIGHT.dim * mix})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
}
const FACE = { DELIGHT: "😍", PLEASED: "🙂", FULFILLED: "😐", UNFINISHED: "😕", COMPLAINS: "😠", LEAVING: "🚪" };
function needWords(p) {
    const band = (v, mild, strong) => (v >= 0.66 ? strong : v >= 0.36 ? mild : "");
    const out = [band(p.needs.hunger, "🍽 peckish", "🍽 hungry"), band(p.needs.thirst, "💧 a bit dry", "💧 thirsty"), band(p.needs.warmth, "❄ chilly", "❄ cold")].filter(Boolean);
    return out.length ? out.join(" · ") : "content";
}
function lines(g, p, debug) {
    const def = g.regularDef(p.regularId);
    const st = g.regular(p.regularId);
    const role = def ? def.role : p.archetype?.name;
    const knowName = p.trueName ? p.name === p.trueName : def ? !def.role || !!st?.nameKnown : false;
    const who = role ? `${knowName ? (p.trueName ?? def?.name ?? p.name) : "???"} · ${role}` : p.name;
    const out = [{ text: who, bold: true, color: "#fff3d6" }];
    out.push({ text: needWords(p), color: "#d8ccb8" });
    if (p.craving && p.ordersPlaced >= 1 && p.schema !== "reserved")
        out.push({ text: `said: “something ${p.craving.tag}”`, color: "#e8d9a8" });
    const before = (st?.served ?? []).filter((s) => s.day < g.day).slice(-4).map((s) => `${s.icon}${FACE[s.outcome]}`);
    const now = (p.served ?? []).map((s) => `${s.icon}${FACE[s.outcome]}`);
    out.push({ text: now.length || before.length ? [before.length ? `before: ${before.join(" ")}` : "", now.length ? `now: ${now.join(" ")}` : ""].filter(Boolean).join("  ") : "nothing served yet", color: "#f0e6d2" });
    out.push({ text: "tastes ???", color: "#9c8f7c" });
    if (debug) {
        const t = p.tastes;
        const set = (k) => `${k} ♥ ${t[k].love.join(", ") || "–"} · + ${t[k].like.join(", ") || "–"} · ✗ ${t[k].dislike.join(", ") || "–"}`;
        out.push({ text: set("food"), color: "#ffb3c7" }, { text: set("drink"), color: "#9fd0ff" });
        out.push({ text: `hunger ${p.needs.hunger.toFixed(2)} thirst ${p.needs.thirst.toFixed(2)} cold ${p.needs.warmth.toFixed(2)} · ${p.schema} · fuss ${p.fussiness.toFixed(2)}${p.craving ? ` · craving ${p.craving.tag}${p.craving.honest ? "" : " (noise)"}` : ""}`, color: "#c9c9c9" });
    }
    return out;
}
const queued = [];
/** Queue a card; flushCards lays them all out so none overlap, then draws them. */
function plate(rows, x, top, ts) { queued.push({ rows, x, top, ts }); }
export function flushCards(ctx) {
    if (!queued.length)
        return;
    ctx.save();
    ctx.globalAlpha = mix;
    const boxes = queued.map((q) => {
        const size = Math.max(9, Math.floor(q.ts * 0.2));
        const lh = size * 1.3, pad = size * 0.5;
        const font = (bold) => `${bold ? "600 " : ""}${size}px system-ui, sans-serif`;
        const w = Math.max(...q.rows.map((r) => { ctx.font = font(r.bold); return ctx.measureText(r.text).width; })) + pad * 2;
        const h = q.rows.length * lh + pad;
        return { ...q, size, lh, pad, font, w, h, left: Math.max(2, Math.min(ctx.canvas.width - w - 2, q.x - w / 2)) };
    }).sort((a, b) => a.top - b.top);
    const placed = [];
    for (const b of boxes) {
        const gap = b.size * 0.3;
        for (let moved = true, n = 0; moved && n < 40; n++) {
            moved = false;
            for (const o of placed) {
                if (b.left < o.left + o.w + gap && o.left < b.left + b.w + gap && b.top < o.top + o.h + gap && o.top < b.top + b.h + gap) {
                    b.top = o.top + o.h + gap;
                    moved = true;
                }
            }
        }
        placed.push(b);
        ctx.fillStyle = PLATE;
        ctx.beginPath();
        ctx.roundRect(b.left, b.top, b.w, b.h, b.size * 0.5);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        b.rows.forEach((r, i) => { ctx.font = b.font(r.bold); ctx.fillStyle = r.color ?? "#fff"; ctx.fillText(r.text, b.left + b.w / 2, b.top + b.pad / 2 + b.lh * (i + 0.5)); });
    }
    queued.length = 0;
    ctx.restore();
}
/** The card under a guest standing at (x, y) on screen. */
export function drawGuestCard(_ctx, g, p, x, y, ts) {
    if (mix < 0.05 || p.state === "leaving")
        return;
    plate(lines(g, p, insightMode() === "debug"), x, y, ts);
}
/** What each piece of equipment is doing, and how much is left in it, over the piece. */
export function drawEquipmentCards(_ctx, g, at, ts) {
    if (mix < 0.05)
        return;
    for (const f of g.world.furniture) {
        const rows = [];
        for (const s of f.slots ?? []) {
            const job = g.jobs.get(s.id), pot = g.pots.get(s.id);
            const name = (id) => RECIPES.find((r) => r.id === id)?.name.toLowerCase() ?? id;
            const text = job && !job.done ? `cooking ${name(job.recipeId)} ${Math.floor((100 * job.progress) / job.total)}%`
                : pot ? `${pot.item.recipeId === "water" ? "hot water" : name(pot.item.recipeId)}: ${pot.left} left` : "empty";
            rows.push({ text: `${s.name}: ${text}`, color: pot || job ? "#f0e6d2" : "#9c8f7c" });
        }
        if (f.tap) {
            const r = RECIPES.find((x) => x.id === f.tap);
            if (r?.boughtAs)
                rows.push({ text: `${r.name}: ${Math.floor(have(g, r.boughtAs))} left`, color: "#f0e6d2" });
        }
        if (f.kind === "fireplace")
            rows.push({ text: g.fireLit ? `🔥 lit · firewood ${Math.floor(have(g, "firewood"))}` : `fire out · firewood ${Math.floor(have(g, "firewood"))}`, color: g.fireLit ? "#ffcf8a" : "#9c8f7c" });
        if (!rows.length)
            continue;
        const xs = f.tiles.map((t) => t.x + 0.5), ys = f.tiles.map((t) => t.y + 0.5);
        const c = at(xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length);
        plate(rows, c.x, c.y - ts * 0.2, ts);
    }
}
