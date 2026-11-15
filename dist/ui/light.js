// Light: daylight through the windows (by the hour, the calendar season and the weather), lamps the
// keeper lights when it gets gloomy (earlier on a rainy day), candles on the tables, the fire's glow,
// and a flash when thunder cracks close by. Drawn as a layer of darkness over the inn with light cut
// out of it, so the bodies dim while speech and orders, drawn after, stay readable. Tuning: LIGHT.
import { LIGHT, TUNING } from "../data.js";
const clamp01 = (n) => Math.max(0, Math.min(1, n));
/** Daylight outside, 0 (night) to 1 (full day): dawn and dusk shift with the calendar season. */
export function daylight(g) {
    const h = ((TUNING.dayStartHour * 60 + g.minute) / 60) % 24; // clock hour, with the minutes
    const shift = LIGHT.seasonShift[g.date.season] ?? 0;
    const [d0, d1] = [LIGHT.dawn[0] - shift, LIGHT.dawn[1] - shift];
    const [k0, k1] = [LIGHT.dusk[0] + shift, LIGHT.dusk[1] + shift];
    if (h <= d0 || h >= k1)
        return 0;
    if (h < d1)
        return (h - d0) / (d1 - d0);
    if (h <= k0)
        return 1;
    return 1 - (h - k0) / (k1 - k0);
}
/** How much of the daylight the weather lets through. */
function weatherDim(g) {
    const w = g.weather;
    if (w.sky === "rain")
        return clamp01(LIGHT.weather.rain - LIGHT.weather.rainPerIntensity * w.rain);
    return LIGHT.weather[w.sky];
}
/** Light indoors from the windows, 0..1. */
export function indoorLight(g) {
    return daylight(g) * weatherDim(g);
}
/** Every frame: the keeper lights the lamps when it gets gloomy inside, and puts them out when it's bright. */
export function updateLamps(g) {
    const inside = indoorLight(g);
    if (!g.lampsLit && inside < LIGHT.lampsOnBelow) {
        g.lampsLit = true;
        g.say(daylight(g) > 0.5 ? "It's gloomy out; you light the lamps." : "You light the lamps.");
    }
    else if (g.lampsLit && inside > LIGHT.lampsOffAbove) {
        g.lampsLit = false;
        g.say("It's bright enough; you put the lamps out.");
    }
}
let flash = 0; // 0..1, fades fast
let flashAt = 0;
/** Thunder close by lights the room for a moment. */
export function initLight(g) {
    g.bus.on((e) => {
        if (e.type === "Thunder") {
            flash = e.near ? LIGHT.flash.near : LIGHT.flash.far;
            flashAt = performance.now();
        }
    });
}
let shade = null;
/** A window pane's tint: pale with daylight, grey in the rain, dark blue at night. */
export function windowColor(g) {
    const day = daylight(g);
    const a = 0.15 + 0.45 * day * weatherDim(g);
    return day > 0.05 ? (g.weather.sky === "rain" ? `rgba(170,185,200,${a})` : `rgba(225,238,248,${a})`) : "rgba(20,30,60,0.35)";
}
/**
 * The darkness layer, with light cut out of it, and a warm haze around flames.
 * `P`: a floor point (in tiles) to the screen. `unit`: pixels a tile across. `squash`: how flat a pool of
 * light looks (1 seen from above; 0.5 isometric). `windows`: tint the panes here (the isometric view does its own).
 */
export function drawLight(ctx, g, P, unit, squash = 1, windows = true) {
    const ts = unit;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const inside = indoorLight(g);
    const dark = LIGHT.maxDark * (1 - inside);
    const t = performance.now() / 1000;
    // Windows: pale with daylight, grey in the rain, dark blue at night.
    const day = daylight(g);
    if (windows)
        for (const row of g.world.tiles)
            for (const tile of row) {
                if (tile.def.name !== "Window")
                    continue;
                ctx.fillStyle = windowColor(g);
                const c = P(tile.x, tile.y);
                ctx.fillRect(c.x + 3, c.y + 3, ts - 6, ts - 6);
            }
    const glows = [];
    // Daylight spills in at the windows.
    if (day > 0.05)
        for (const row of g.world.tiles)
            for (const tile of row) {
                if (tile.def.name === "Window")
                    glows.push({ x: tile.x + 0.5, y: tile.y + 0.5, r: LIGHT.windowReach, strength: 0.7 * inside, warm: 0 });
            }
    // The fire, flickering.
    const fire = g.world.furniture.find((f) => f.kind === "fireplace")?.center;
    if (fire && g.fireLit) {
        const flicker = 1 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1);
        glows.push({ x: fire.x, y: fire.y, r: LIGHT.fire.reach * flicker, strength: LIGHT.fire.strength, warm: LIGHT.fire.warm });
    }
    // Lamps and table candles, when lit.
    if (g.lampsLit) {
        for (const l of LIGHT.lamps)
            glows.push({ x: l.x, y: l.y, r: l.r, strength: LIGHT.lampStrength, warm: LIGHT.lampWarm });
        for (const tb of g.world.tables) {
            const flicker = 1 + 0.05 * Math.sin(t * 9 + tb.tile.x * 3.1);
            glows.push({ x: tb.tile.x + 0.5, y: tb.tile.y + 0.5, r: LIGHT.candle.reach * flicker, strength: LIGHT.candle.strength, warm: LIGHT.candle.warm });
        }
    }
    // The keeper carries a candle: a small warm light wherever they go, once it's dim.
    if (dark > LIGHT.keeperCandle.from) {
        const k = g.keeper.pos;
        const flicker = 1 + 0.05 * Math.sin(t * 11.3) + 0.03 * Math.sin(t * 17.9);
        glows.push({ x: k.x, y: k.y, r: LIGHT.keeperCandle.reach * flicker, strength: LIGHT.keeperCandle.strength, warm: LIGHT.keeperCandle.warm });
    }
    if (dark > 0.01) {
        if (!shade)
            shade = document.createElement("canvas");
        if (shade.width !== W || shade.height !== H) {
            shade.width = W;
            shade.height = H;
        }
        const s = shade.getContext("2d");
        s.globalCompositeOperation = "source-over";
        s.clearRect(0, 0, W, H);
        s.fillStyle = `rgba(${LIGHT.nightTint},${dark})`;
        s.fillRect(0, 0, W, H);
        // Light cuts the darkness away.
        s.globalCompositeOperation = "destination-out";
        for (const gl of glows) {
            const c = P(gl.x, gl.y), r = gl.r * ts;
            s.save();
            s.translate(c.x, c.y);
            s.scale(1, squash);
            const grad = s.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, `rgba(0,0,0,${gl.strength})`);
            grad.addColorStop(0.5, `rgba(0,0,0,${gl.strength * 0.55})`);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            s.fillStyle = grad;
            s.fillRect(-r, -r, r * 2, r * 2);
            s.restore();
        }
        ctx.drawImage(shade, 0, 0);
    }
    // A warm haze around flames, stronger the darker it is.
    const haze = 0.35 + 0.65 * (1 - inside);
    for (const gl of glows) {
        if (!gl.warm)
            continue;
        const c = P(gl.x, gl.y), r = gl.r * ts;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(1, squash);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, `rgba(255,170,80,${gl.warm * haze})`);
        grad.addColorStop(1, "rgba(255,170,80,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
    }
    // Thunder: a flash that fades in a few tenths of a second.
    if (flash > 0) {
        const a = flash * Math.max(0, 1 - (performance.now() - flashAt) / LIGHT.flash.ms);
        if (a <= 0)
            flash = 0;
        else {
            ctx.fillStyle = `rgba(235,240,255,${a})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
}
