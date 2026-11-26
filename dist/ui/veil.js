// Behind a menu that stops the clock: the inn blurred, and a faint stained-glass window of the game's
// own over it, fading in. Large irregular panes in shades of blue with hairline lead; the room still
// shows through. The window is made once, from a seed picked when the game starts, and kept for the
// session (remade only for a new screen size); the blurred room is taken once as the menu opens.
let made = null;
let madeFor = "";
let blurred = null;
let shown = 0;
/** How strongly the window shows over the inn: a faint tint, the room still seen through it. */
const STRENGTH = 0.22;
/** How blurred the room is behind it (CSS pixels). */
const BLUR = 5;
/** Every frame, after the inn is drawn. `on`: a menu that stops the clock is open. */
export function drawVeil(ctx, canvas, look, on, dt) {
    if (!on || look === "dim") {
        shown = 0;
        blurred = null;
        return;
    }
    const veil = veilFor(canvas);
    if (!blurred || blurred.width !== canvas.width || blurred.height !== canvas.height)
        blurred = blurOf(canvas);
    shown = Math.min(1, shown + dt / 0.35);
    const ease = shown * shown * (3 - 2 * shown);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = ease;
    ctx.drawImage(blurred, 0, 0);
    ctx.globalAlpha = STRENGTH * ease;
    ctx.drawImage(veil, 0, 0);
    ctx.restore();
}
/** The room as it is now, blurred. */
function blurOf(canvas) {
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    const x = c.getContext("2d");
    const px = canvas.width / (canvas.clientWidth || canvas.width);
    x.filter = `blur(${Math.round(BLUR * px)}px)`;
    x.drawImage(canvas, 0, 0);
    return c;
}
/** Make the window ahead of time, while the game is idle, so the first menu opens without a pause. */
export function prepareVeil(canvas) {
    const later = window.requestIdleCallback ?? ((f) => setTimeout(f, 200));
    later(() => veilFor(canvas));
}
function veilFor(canvas) {
    const key = `${canvas.width}x${canvas.height}`;
    if (!made || madeFor !== key) {
        made = stainedGlass(canvas);
        madeFor = key;
    }
    return made;
}
// --- Making the window -------------------------------------------------------------------------
const seed = Math.floor(Math.random() * 2 ** 31);
function seeded(s) {
    let a = s;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Smooth noise 0..1, for the light across the window and the mottling in the glass. */
function hash(x, y) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => 0.55 * noise(x, y) + 0.3 * noise(x * 2.1, y * 2.1) + 0.15 * noise(x * 4.3, y * 4.3);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
/** The blues the window drifts through, in order: deep navy, cobalt, azure, sky, pale ice. */
const RAMP = ["#14306e", "#1f4fae", "#2f7fd6", "#5eaee8", "#a6d6f2"].map(hex);
function ramp(t) {
    const x = Math.min(0.999, Math.max(0, t)) * (RAMP.length - 1), i = Math.floor(x), f = x - i;
    const a = RAMP[i], b = RAMP[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
/**
 * Worked out at most 1200 pixels wide, then scaled up. Each pixel finds its pane (the nearest of the
 * jittered seed points) and exactly how far it is from the pane's edge, which gives the lead, its
 * rounded corners, and the shading by the lead.
 */
function stainedGlass(src) {
    const W = src.width, H = src.height;
    const k = Math.min(1, 1200 / W), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const css = w / (src.clientWidth || W);
    const rand = seeded(seed);
    const cw = 64 * css;
    const cols = Math.ceil(w / cw) + 3, rows = Math.ceil(h / cw) + 3, n = cols * rows;
    const sx = new Float32Array(n), sy = new Float32Array(n);
    const col = new Float32Array(n * 3), dirX = new Float32Array(n), dirY = new Float32Array(n), lift = new Float32Array(n);
    // Colour drifts across the window in clouds; where the light is strongest the glass looks paler.
    const hueScale = 420 * css, glowScale = 300 * css;
    for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
            const m = j * cols + i;
            const x0 = (i - 1 + 0.1 + rand() * 0.8) * cw, y0 = (j - 1 + 0.1 + rand() * 0.8) * cw;
            sx[m] = x0;
            sy[m] = y0;
            const hueAt = (fbm(x0 / hueScale + 11.3, y0 / hueScale + 4.1) - 0.36) / 0.28 + (rand() - 0.5) * 0.25;
            const glow = fbm(x0 / glowScale + 3.7, y0 / glowScale + 9.2);
            const c = ramp(hueAt);
            // Where the light's strongest the glass looks paler; now and then a pane is nearly white.
            const pale = Math.min(0.85, 0.4 * glow * rand() + (rand() < 0.03 * glow ? 0.6 : 0));
            const light = 0.85 + 0.3 * rand();
            for (let q = 0; q < 3; q++)
                col[m * 3 + q] = Math.min(255, (c[q] + (255 - c[q]) * pale) * light);
            const a = rand() * Math.PI * 2;
            dirX[m] = Math.cos(a);
            dirY[m] = Math.sin(a);
            lift[m] = rand();
        }
    const lead = 0.12 * css;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const oc = out.getContext("2d");
    const img = oc.createImageData(w, h), px = img.data;
    const near = new Int32Array(9);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            // The panes around this pixel, then the nearest of them.
            const ci = Math.floor(x / cw) + 1, cj = Math.floor(y / cw) + 1;
            let found = 0, best = 0, bestD = Infinity;
            for (let j = cj - 1; j <= cj + 1; j++)
                for (let i = ci - 1; i <= ci + 1; i++) {
                    if (i < 0 || j < 0 || i >= cols || j >= rows)
                        continue;
                    const m = j * cols + i;
                    near[found++] = m;
                    const dx = sx[m] - x, dy = sy[m] - y, d = dx * dx + dy * dy;
                    if (d < bestD) {
                        bestD = d;
                        best = m;
                    }
                }
            // How far to the pane's edge: its two nearest borders with the others.
            let e1 = Infinity, e2 = Infinity;
            const ax = sx[best], ay = sy[best];
            for (let q = 0; q < found; q++) {
                const m = near[q];
                if (m === best)
                    continue;
                const vx = sx[m] - ax, vy = sy[m] - ay;
                const e = -(vx * (x - (ax + sx[m]) / 2) + vy * (y - (ay + sy[m]) / 2)) / Math.hypot(vx, vy);
                if (e < e1) {
                    e2 = e1;
                    e1 = e;
                }
                else if (e < e2)
                    e2 = e;
            }
            // Rounded corners: the lead thickens where panes meet.
            const edge = ((e1 * e2) / Math.sqrt(e1 * e1 + e2 * e2 + 1e-6)) * 1.3;
            const glass = smooth(lead - 0.35, lead + 0.35, edge);
            // The pane: nearly flat, a touch lighter towards one side, a little darker close to the lead.
            const across = ((x - ax) * dirX[best] + (y - ay) * dirY[best]) / cw;
            let f = 0.96 + 0.12 * across * lift[best];
            f *= 0.8 + 0.2 * smooth(lead, lead + 3 * css, edge);
            const lr = 12, lg = 26, lb = 58;
            const p = (y * w + x) * 4;
            px[p] = lr + (col[best * 3] * f - lr) * glass;
            px[p + 1] = lg + (col[best * 3 + 1] * f - lg) * glass;
            px[p + 2] = lb + (col[best * 3 + 2] * f - lb) * glass;
            px[p + 3] = 255;
        }
    oc.putImageData(img, 0, 0);
    if (w === W && h === H)
        return out;
    const big = document.createElement("canvas");
    big.width = W;
    big.height = H;
    const bc = big.getContext("2d");
    bc.imageSmoothingQuality = "high";
    bc.drawImage(out, 0, 0, W, H);
    return big;
}
