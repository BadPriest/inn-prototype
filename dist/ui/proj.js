// Where a point of the inn lands on screen, for either view: straight down (a tile is `ts` pixels square)
// or isometric (a tile is a diamond, twice as wide as it is tall; height lifts things up the screen).
// The isometric camera can stand at any of the four corners (`rot`, quarter turns): the floor is turned
// first, then projected. The game itself only knows tiles; only drawing and clicking go through here.
/** Isometric proportions, in units of `ts`: half a diamond's width, half its height, and a tile of height. */
export const ISO = { a: 0.75, b: 0.375, z: 0.8 };
/** The floor turned for the camera: (x, y) in the inn to (u, w), where u and w grow toward the viewer. */
export function turn(v, x, y) {
    const W = v.mw ?? 0, H = v.mh ?? 0;
    switch (v.rot ?? 0) {
        case 1: return { x: H - y, y: x };
        case 2: return { x: W - x, y: H - y };
        case 3: return { x: y, y: W - x };
        default: return { x, y };
    }
}
/** Back from the turned floor to the inn's own tiles. */
export function unturn(v, u, w) {
    const W = v.mw ?? 0, H = v.mh ?? 0;
    switch (v.rot ?? 0) {
        case 1: return { x: w, y: H - u };
        case 2: return { x: W - u, y: H - w };
        case 3: return { x: W - w, y: u };
        default: return { x: u, y: w };
    }
}
/** The turned floor's size: a quarter turn swaps width and height. */
export function turnedSize(v) {
    const W = v.mw ?? 0, H = v.mh ?? 0;
    return (v.rot ?? 0) % 2 ? { w: H, h: W } : { w: W, h: H };
}
/** A point on the turned floor (u, w, height z) to canvas pixels. */
export function Pt(v, u, w, z = 0) {
    return { x: v.ox + (u - w) * ISO.a * v.ts, y: v.oy + (u + w) * ISO.b * v.ts - z * ISO.z * v.ts };
}
/** A point in tiles (z: height in tiles) to canvas pixels. */
export function P(v, x, y, z = 0) {
    if (!v.iso)
        return { x: v.ox + x * v.ts, y: v.oy + y * v.ts };
    const t = turn(v, x, y);
    return Pt(v, t.x, t.y, z);
}
/** Canvas pixels to a point on the floor, in tiles. */
export function unproject(v, sx, sy) {
    if (!v.iso)
        return { x: (sx - v.ox) / v.ts, y: (sy - v.oy) / v.ts };
    const a = (sx - v.ox) / (ISO.a * v.ts), b = (sy - v.oy) / (ISO.b * v.ts);
    return unturn(v, (a + b) / 2, (b - a) / 2);
}
/** A direction pressed on screen (WASD) to a direction on the floor, so up on screen is always up. */
export function screenDir(v, dx, dy) {
    if (!v.iso)
        return { x: dx, y: dy };
    const du = (dx + dy) / 2, dw = (dy - dx) / 2;
    switch (v.rot ?? 0) {
        case 1: return { x: dw, y: -du };
        case 2: return { x: -du, y: -dw };
        case 3: return { x: -dw, y: du };
        default: return { x: du, y: dw };
    }
}
/** Trace the floor area x..x+w, y..y+h (inset by `inset` tiles), at height z: a rectangle, or a diamond-ish shape. */
export function floorPath(ctx, v, x, y, w, h, inset = 0, z = 0) {
    const pts = [P(v, x + inset, y + inset, z), P(v, x + w - inset, y + inset, z), P(v, x + w - inset, y + h - inset, z), P(v, x + inset, y + h - inset, z)];
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const q of pts.slice(1))
        ctx.lineTo(q.x, q.y);
    ctx.closePath();
}
