// The weather, heard. Rain intensity crossfades the layers (WEATHER_SOUND in data.ts), so there's no
// loop per band: soft rain fades into steady rain fades into the storm.
//   indoors   the rain on the building, heard everywhere inside
//   outdoors  swells in through the front door while it's open, fades as it closes
//   window    rain on the glass, louder as the keeper walks near a window
//   street    the street outside, through the open door; heavy rain drowns it
//   wind      by how wild it is (rain intensity, or a breeze on grey days): faint inside, full at the door
//   thunder   on the Thunder event (storm band): close or nearby
// Layers start when they're needed and stop after a while silent.
import { WEATHER_SOUND as W } from "../data.js";
import { dist } from "../world.js";
import { moveVoice, play, setLevel, stop } from "./engine.js";
const layers = new Map();
/** A layer's share at this intensity: [from, full, fadesFrom, gone]. */
function share(r, [from, full, fadesFrom, gone]) {
    if (r <= from || r >= gone)
        return 0;
    if (r < full)
        return (r - from) / (full - from);
    if (r <= fadesFrom)
        return 1;
    return 1 - (r - fadesFrom) / (gone - fadesFrom);
}
let windows = null;
function windowTiles(g) {
    windows ??= g.world.tiles.flat().filter((t) => t.def.name === "Window").map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
    return windows;
}
function nearestWindow(g) {
    let best = null;
    for (const at of windowTiles(g)) {
        const d = dist(at, g.keeper.pos);
        if (!best || d < best.d)
            best = { at, d };
    }
    return best;
}
/** Bring a layer toward `level`: start it if it's needed, stop it once it's been silent a while. */
function drive(key, level, at, seconds, realDt, id = key) {
    let l = layers.get(id);
    if (!l) {
        l = { voice: null, level: 0, silentFor: 0 };
        layers.set(id, l);
    }
    if (level > 0.001 && !l.voice) {
        l.voice = play(key, at, { level: 0 });
        l.level = 0;
    }
    if (!l.voice)
        return;
    moveVoice(l.voice, at);
    if (Math.abs(level - l.level) > 0.005) {
        setLevel(l.voice, level, seconds);
        l.level = level;
    }
    l.silentFor = level <= 0.001 ? l.silentFor + realDt : 0;
    if (l.silentFor > W.idleStopSeconds) {
        stop(l.voice, 300);
        l.voice = null;
        l.silentFor = 0;
    }
}
/** Thunder, when the weather says so. */
export function thunder(near) {
    play(near ? "thunderClose" : "thunderNearby", null);
}
export function weatherSound(g, realDt) {
    const w = g.weather;
    const r = w.sky === "rain" ? w.rain : 0;
    const soft = share(r, W.layers.soft);
    const medium = share(r, W.layers.medium);
    const storm = share(r, W.layers.storm);
    const drift = W.driftSeconds;
    drive("rainSoftIn", soft, null, drift, realDt);
    drive("rainMediumIn", medium, null, drift, realDt);
    drive("rainStormIn", storm, null, drift, realDt);
    // Outdoors through the door. There's no outdoor storm recording: the steady rain carries it, louder.
    const door = { x: g.world.frontDoor.x + 0.5, y: g.world.frontDoor.y + 0.5 };
    const open = g.frontDoor.open ? 1 : 0;
    drive("rainSoftOut", soft * open, door, W.doorSeconds, realDt);
    drive("rainMediumOut", Math.min(1, medium + storm * 1.2) * open, door, W.doorSeconds, realDt);
    // Wind: faint around the building, full through the open door (the same loop, from two places).
    const wild = r > 0 ? r : W.greyBreeze[w.sky] ?? 0;
    for (const [layer, key] of [["soft", "windSoft"], ["medium", "windMedium"], ["strong", "windStrong"]]) {
        const s = share(wild, W.wind[layer]);
        drive(key, s * W.windIndoors, null, drift, realDt, `${key}@in`);
        drive(key, s * open, door, W.doorSeconds, realDt, `${key}@door`);
    }
    // The street, under it all; heavy rain drowns it out.
    drive(g.loc.street, open * (1 - W.rainDrownsStreet * Math.min(1, r * 1.4)), door, W.doorSeconds, realDt);
    // The nearest window: on the glass, louder up close and with the rain.
    const near = nearestWindow(g);
    const closeness = near ? Math.max(0, Math.min(1, 1 - (near.d - W.window.fullWithin) / (W.window.goneAt - W.window.fullWithin))) : 0;
    const onGlass = r > 0 ? (0.45 + 0.55 * r) * closeness : 0;
    drive("rainWindow", onGlass, near?.at ?? null, 0.8, realDt);
}
