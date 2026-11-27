// Light: daylight through the windows (by the hour, the calendar season and the weather), lamps the
// keeper lights when it gets gloomy (earlier on a rainy day), candles on the tables, the fire's glow,
// and a flash when thunder cracks close by. Drawn as a layer of darkness over the inn with light cut
// out of it, so the bodies dim while speech and orders, drawn after, stay readable. Tuning: LIGHT.

import { hasLampOil } from "../upkeep.js";
import { LIGHT, TUNING } from "../data.js";
import { yearFraction } from "../calendar.js";
import type { Game } from "../game.js";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Hours later dawn and earlier dusk today: most at midwinter, least (negative) at midsummer. */
export function dayShift(g: Game): number {
  const { midwinter, midsummer } = LIGHT.yearShift;
  const fromMidwinter = yearFraction(g.date, g.loc.days) - 0.875;
  return (midwinter + midsummer) / 2 + ((midwinter - midsummer) / 2) * Math.cos(2 * Math.PI * fromMidwinter);
}

/** Daylight outside, 0 (night) to 1 (full day): dawn and dusk move through the year. */
export function daylight(g: Game): number {
  const h = ((TUNING.dayStartHour * 60 + g.minute) / 60) % 24; // clock hour, with the minutes
  const shift = dayShift(g);
  const [d0, d1] = [LIGHT.dawn[0] - shift, LIGHT.dawn[1] - shift];
  const [k0, k1] = [LIGHT.dusk[0] + shift, LIGHT.dusk[1] + shift];
  if (h <= d0 || h >= k1) return 0;
  if (h < d1) return (h - d0) / (d1 - d0);
  if (h <= k0) return 1;
  return 1 - (h - k0) / (k1 - k0);
}

/** How much of the daylight the weather lets through. */
function weatherDim(g: Game): number {
  const w = g.weather;
  if (w.sky === "rain" && w.snow) return clamp01(LIGHT.snow.lets - LIGHT.snow.perIntensity * w.rain);
  if (w.sky === "rain") return clamp01(LIGHT.weather.rain - LIGHT.weather.rainPerIntensity * w.rain);
  return LIGHT.weather[w.sky];
}

/** Light indoors from the windows, 0..1. */
export function indoorLight(g: Game): number {
  return daylight(g) * weatherDim(g);
}

/** Every frame: the keeper lights the lamps when it gets gloomy inside, and puts them out when it's bright. */
export function updateLamps(g: Game): void {
  const inside = indoorLight(g);
  const dark = !g.lampsLit && inside < LIGHT.lampsOnBelow && !hasLampOil(g);
  if (dark && !g.dark) g.say("🛢️ It's getting dark and there's no oil for the lamps. Guests won't stay long in the dark, and from the road the inn looks shut.");
  g.dark = dark;
  if (!g.lampsLit && inside < LIGHT.lampsOnBelow && hasLampOil(g)) {
    g.lampsLit = true;
    g.say(daylight(g) > 0.5 ? "It's gloomy out; you light the lamps." : "You light the lamps.");
  } else if (g.lampsLit && inside > LIGHT.lampsOffAbove) {
    g.lampsLit = false;
    g.say("It's bright enough; you put the lamps out.");
  }
}

let flash = 0; // 0..1, fades fast
let flashAt = 0;
/** Thunder close by lights the room for a moment. */
export function initLight(g: Game): void {
  g.bus.on((e) => {
    if (e.type === "Thunder") { flash = e.near ? LIGHT.flash.near : LIGHT.flash.far; flashAt = performance.now(); }
  });
}

let shade: HTMLCanvasElement | null = null;

const LT = LIGHT.temperature;
/** How cold the light looks, 0..1 (1 at freezing). */
function coldness(g: Game): number { return clamp01((LT.coldBelow - g.weather.temp) / LT.coldBelow); }
/** How hot the light looks, 0..1 (1 at hot). */
function heat(g: Game): number { return clamp01((g.weather.temp - LT.hotAbove) / (5 - LT.hotAbove)); }
/** Snow at a window: flakes drifting past while it falls (by how hard), and a white sill while it falls and after. */
export function snowAtWindow(g: Game): { flakes: number; sill: boolean } {
  const w = g.weather;
  const falling = w.band && w.snow ? w.rain : 0;
  return { flakes: falling > 0 ? Math.ceil(LIGHT.snow.flakes * (0.4 + falling)) : 0, sill: falling > 0 || w.afterSnow > 0 };
}

/** A flake's place on a pane, 0..1 across and down: drifting down and sideways, over and over. */
export function flakeAt(i: number, seed: number): { a: number; d: number } {
  const t = performance.now() / 1000;
  const d = (t * (0.25 + (i % 3) * 0.07) + i * 0.37 + seed * 0.13) % 1;
  return { a: (((i * 0.29 + seed * 0.17) % 1) + Math.sin(t * 1.3 + i * 2) * 0.06 + 1) % 1, d };
}

/** Frost on the window panes, 0..1. */
export function frost(g: Game): number { return clamp01((LT.frostBelow - g.weather.temp) / LT.frostBelow); }

function mix(a: string, b: string, t: number): string {
  const x = a.split(",").map(Number), y = b.split(",").map(Number);
  return x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",");
}

/** The cast the temperature puts over daylight: its colour and how strong. */
function cast(g: Game): { rgb: string; a: number } | null {
  const c = coldness(g), h = heat(g);
  if (c > 0) return { rgb: LT.coldCast, a: LT.coldCastMax * c };
  if (h > 0) return { rgb: LT.hotCast, a: LT.hotCastMax * h };
  return null;
}

interface Glow { x: number; y: number; r: number; strength: number; warm: number }

/** A window pane's tint: pale with daylight, grey in the rain, dark blue at night; frosted white when freezing, golden when hot. */
/** What shows through an open window: the air beyond, darker than the glass. */
export const OPEN_WINDOW = "rgba(14,22,32,0.85)";

export function windowColor(g: Game): string {
  const day = daylight(g);
  const f = frost(g), h = heat(g);
  const a = 0.15 + 0.45 * day * weatherDim(g) + 0.35 * f;
  if (day <= 0.05) return f > 0 ? `rgba(150,170,205,${0.35 + 0.3 * f})` : "rgba(20,30,60,0.35)";
  const w = g.weather;
  const base = w.sky === "rain" ? (w.snow ? "232,238,246" : "170,185,200") : h > 0 ? mix("225,238,248", "255,232,180", h) : "225,238,248";
  return `rgba(${f > 0 ? mix(base, "240,248,255", f) : base},${Math.min(0.9, a)})`;
}

/**
 * The darkness layer, with light cut out of it, and a warm haze around flames.
 * `P`: a floor point (in tiles) to the screen. `unit`: pixels a tile across. `squash`: how flat a pool of
 * light looks (1 seen from above; 0.5 isometric). `windows`: tint the panes here (the isometric view does its own).
 */
export function drawLight(ctx: CanvasRenderingContext2D, g: Game, P: (x: number, y: number) => { x: number; y: number }, unit: number, squash = 1, windows = true): void {
  const ts = unit;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const inside = indoorLight(g);
  const dark = LIGHT.maxDark * (1 - inside);
  const t = performance.now() / 1000;

  // Windows: pale with daylight, grey in the rain, dark blue at night.
  const day = daylight(g);
  if (windows) for (const row of g.world.tiles) for (const tile of row) {
    if (tile.def.name !== "Window") continue;
    ctx.fillStyle = windowColor(g);
    const c = P(tile.x, tile.y);
    ctx.fillRect(c.x + 3, c.y + 3, ts - 6, ts - 6);
    const f = frost(g);
    if (f > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * f})`; ctx.lineWidth = Math.max(1, ts * 0.08); ctx.strokeRect(c.x + 5, c.y + 5, ts - 10, ts - 10); }
    const sn = snowAtWindow(g);
    ctx.fillStyle = "rgba(250,252,255,0.9)";
    if (sn.sill) ctx.fillRect(c.x + 3, c.y + ts - 3 - (ts - 6) * LIGHT.snow.sill, ts - 6, (ts - 6) * LIGHT.snow.sill);
    for (let i = 0; i < sn.flakes; i++) { const k = flakeAt(i, tile.x * 7 + tile.y); ctx.beginPath(); ctx.arc(c.x + 4 + k.a * (ts - 8), c.y + 4 + k.d * (ts - 8), Math.max(1, ts * 0.04), 0, Math.PI * 2); ctx.fill(); }
  }

  const glows: Glow[] = [];
  // Daylight spills in at the windows.
  if (day > 0.05) for (const row of g.world.tiles) for (const tile of row) {
    if (tile.def.name === "Window") glows.push({ x: tile.x + 0.5, y: tile.y + 0.5, r: LIGHT.windowReach, strength: 0.7 * inside, warm: 0 });
  }
  // The fire, flickering.
  const fire = g.world.furniture.find((f) => f.kind === "fireplace")?.center;
  if (fire && g.fireLit) {
    const flicker = 1 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1);
    glows.push({ x: fire.x, y: fire.y, r: LIGHT.fire.reach * flicker, strength: LIGHT.fire.strength, warm: LIGHT.fire.warm });
  }
  // Lit heaters glow a little.
  for (const f of g.world.furniture) {
    if (f.kind !== "heater" || !g.heatersLit.has(f.id)) continue;
    const flicker = 1 + 0.04 * Math.sin(t * 6.1 + f.center.x);
    glows.push({ x: f.center.x, y: f.center.y, r: LIGHT.heater.reach * flicker, strength: LIGHT.heater.strength, warm: LIGHT.heater.warm });
  }
  // Lamps and table candles, when lit.
  if (g.lampsLit) {
    for (const l of g.innDef.lamps) glows.push({ x: l.x, y: l.y, r: l.r, strength: LIGHT.lampStrength, warm: LIGHT.lampWarm });
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
    if (!shade) shade = document.createElement("canvas");
    if (shade.width !== W || shade.height !== H) { shade.width = W; shade.height = H; }
    const s = shade.getContext("2d")!;
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, W, H);
    const c = coldness(g), h = heat(g);
    const tint = c > 0 ? mix(LIGHT.nightTint, LT.nightCold, c) : h > 0 ? mix(LIGHT.nightTint, LT.nightWarm, h) : LIGHT.nightTint;
    s.fillStyle = `rgba(${tint},${dark})`;
    s.fillRect(0, 0, W, H);
    // Light cuts the darkness away.
    s.globalCompositeOperation = "destination-out";
    for (const gl of glows) {
      const c = P(gl.x, gl.y), r = gl.r * ts;
      s.save(); s.translate(c.x, c.y); s.scale(1, squash);
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

  // The temperature's colour over the daylight, and stronger in the pools of light by the windows.
  const tc = cast(g);
  if (tc && inside > 0.02) {
    ctx.fillStyle = `rgba(${tc.rgb},${tc.a * inside})`;
    ctx.fillRect(0, 0, W, H);
    for (const row of g.world.tiles) for (const tile of row) {
      if (tile.def.name !== "Window") continue;
      const c = P(tile.x + 0.5, tile.y + 0.5), r = LIGHT.windowReach * ts;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, squash);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(${tc.rgb},${LT.windowPool * (tc.a / Math.max(LT.coldCastMax, LT.hotCastMax)) * inside})`);
      grad.addColorStop(1, `rgba(${tc.rgb},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }

  // A warm haze around flames, stronger the darker it is, and the colder.
  const haze = (0.35 + 0.65 * (1 - inside)) * (1 + LT.fireHazeCold * coldness(g));
  for (const gl of glows) {
    if (!gl.warm) continue;
    const c = P(gl.x, gl.y), r = gl.r * ts;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, squash);
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
    if (a <= 0) flash = 0;
    else { ctx.fillStyle = `rgba(235,240,255,${a})`; ctx.fillRect(0, 0, W, H); }
  }
}
