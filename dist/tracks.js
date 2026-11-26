// Prints on the floor from the front door: guests who walked in off a wet or muddy road leave a short trail
// that fades by itself (snow turns to wet first). What they bring in is stamped on arrival (CameIn.tracks,
// weather.ts). While it snows, flakes blow in at the open door and melt. Tuning: TRACKS.
import { chance } from "./core.js";
import { TRACKS, WEATHER } from "./data.js";
import { dist } from "./world.js";
const trails = new WeakMap();
export function updateTracks(g, simDt) {
    for (const f of g.footprints)
        f.age += simDt;
    g.footprints = g.footprints.filter((f) => f.age < TRACKS.kinds[f.kind].minutes);
    for (const p of g.patrons) {
        const kind = p.cameIn?.tracks;
        if (!kind || p.state !== "entering")
            continue;
        let trail = trails.get(p);
        if (!trail) {
            trail = { last: { ...p.pos }, left: TRACKS.kinds[kind].prints, leftFoot: true };
            trails.set(p, trail);
        }
        if (trail.left <= 0 || dist(p.pos, trail.last) < TRACKS.stride)
            continue;
        const angle = Math.atan2(p.pos.y - trail.last.y, p.pos.x - trail.last.x);
        const side = (trail.leftFoot ? -1 : 1) * TRACKS.side;
        g.footprints.push({ x: p.pos.x - Math.sin(angle) * side, y: p.pos.y + Math.cos(angle) * side, angle, kind, age: 0 });
        if (g.footprints.length > TRACKS.most)
            g.footprints.shift();
        trail.last = { ...p.pos };
        trail.leftFoot = !trail.leftFoot;
        trail.left--;
    }
    blowIn(g, simDt);
}
/** Snow blown in at the open door: a few flakes on the floor just inside, melting. */
function blowIn(g, simDt) {
    const w = g.weather;
    if (!g.frontDoor.open || !w.band || !w.snow)
        return;
    if (!chance(WEATHER.snow.doorFlakesPerMinute * w.rain * simDt))
        return;
    const d = g.world.frontDoor;
    const spots = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => g.world.tile(d.x + dx, d.y + dy)).filter((t) => t && (t.def.kind === "floor" || t.def.kind === "front"));
    const t = spots[Math.floor(Math.random() * spots.length)];
    if (!t)
        return;
    g.footprints.push({ x: t.x + 0.15 + Math.random() * 0.7, y: t.y + 0.15 + Math.random() * 0.7, angle: 0, kind: "snow", age: 0, flake: true });
    if (g.footprints.length > TRACKS.most)
        g.footprints.shift();
}
/** Each print as a small sole (or a round flake): where on the floor (tiles), which way it points, its colour as it fades or melts. */
export function footprintsToDraw(g) {
    return g.footprints.map((f) => {
        const k = TRACKS.kinds[f.kind];
        const left = 1 - f.age / k.minutes;
        let rgb = k.rgb, a = k.alpha * left;
        if (k.meltsTo) {
            const to = TRACKS.kinds[k.meltsTo], m = Math.max(0, Math.min(1, (f.age / k.minutes - 0.3) / 0.5));
            const x = k.rgb.split(",").map(Number), y = to.rgb.split(",").map(Number);
            rgb = x.map((v, i) => Math.round(v + (y[i] - v) * m)).join(",");
            a = (k.alpha + (to.alpha - k.alpha) * m) * Math.min(1, left * 2.5);
        }
        return { x: f.x, y: f.y, angle: f.angle, color: `rgba(${rgb},${a.toFixed(3)})`, flake: !!f.flake };
    });
}
