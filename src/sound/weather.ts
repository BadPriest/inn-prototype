// The weather, heard. Rain intensity crossfades the layers (WEATHER_SOUND in data.ts), so there's no
// loop per band: soft rain fades into steady rain fades into the storm.
//   indoors   the rain on the building, heard everywhere inside
//   outdoors  swells in through the front door while it's open, fades as it closes
//   window    rain on the glass, louder as the keeper walks near a window
// Layers start when they're needed and stop after a while silent.

import type { Game } from "../game.js";
import { WEATHER_SOUND as W } from "../data.js";
import type { Vec } from "../world.js";
import { dist } from "../world.js";
import { moveVoice, play, setLevel, stop, type Voice } from "./engine.js";

interface Layer { voice: Voice | null; level: number; silentFor: number }
const layers = new Map<string, Layer>();

/** A layer's share at this intensity: [from, full, fadesFrom, gone]. */
function share(r: number, [from, full, fadesFrom, gone]: [number, number, number, number]): number {
  if (r <= from || r >= gone) return 0;
  if (r < full) return (r - from) / (full - from);
  if (r <= fadesFrom) return 1;
  return 1 - (r - fadesFrom) / (gone - fadesFrom);
}

let windows: Vec[] | null = null;
function windowTiles(g: Game): Vec[] {
  windows ??= g.world.tiles.flat().filter((t) => t.def.name === "Window").map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  return windows;
}

function nearestWindow(g: Game): { at: Vec; d: number } | null {
  let best: { at: Vec; d: number } | null = null;
  for (const at of windowTiles(g)) {
    const d = dist(at, g.keeper.pos);
    if (!best || d < best.d) best = { at, d };
  }
  return best;
}

/** Bring a layer toward `level`: start it if it's needed, stop it once it's been silent a while. */
function drive(key: string, level: number, at: Vec | null, seconds: number, realDt: number): void {
  let l = layers.get(key);
  if (!l) { l = { voice: null, level: 0, silentFor: 0 }; layers.set(key, l); }
  if (level > 0.001 && !l.voice) {
    l.voice = play(key, at, { level: 0 });
    l.level = 0;
  }
  if (!l.voice) return;
  moveVoice(l.voice, at);
  if (Math.abs(level - l.level) > 0.005) { setLevel(l.voice, level, seconds); l.level = level; }
  l.silentFor = level <= 0.001 ? l.silentFor + realDt : 0;
  if (l.silentFor > W.idleStopSeconds) { stop(l.voice, 300); l.voice = null; l.silentFor = 0; }
}

export function weatherSound(g: Game, realDt: number): void {
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
  const door: Vec = { x: g.world.frontDoor.x + 0.5, y: g.world.frontDoor.y + 0.5 };
  const open = g.frontDoor.open ? 1 : 0;
  drive("rainSoftOut", soft * open, door, W.doorSeconds, realDt);
  drive("rainMediumOut", Math.min(1, medium + storm * 1.2) * open, door, W.doorSeconds, realDt);

  // The nearest window: on the glass, louder up close and with the rain.
  const near = nearestWindow(g);
  const closeness = near ? Math.max(0, Math.min(1, 1 - (near.d - W.window.fullWithin) / (W.window.goneAt - W.window.fullWithin))) : 0;
  const onGlass = r > 0 ? (0.45 + 0.55 * r) * closeness : 0;
  drive("rainWindow", onGlass, near?.at ?? null, 0.8, realDt);
}
