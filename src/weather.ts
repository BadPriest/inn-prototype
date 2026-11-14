// Weather: states with allowed transitions and minimum times, and a rain intensity with named bands.
//
// Nothing here plays sounds or draws anything. It keeps the state, says what changed (events and a
// log line for the keeper), and offers tags so everyone else can read it: chatter, tastes, soaking,
// flow, sound, light. Tuning is WEATHER in data.ts.

import { chance, organic, weightedPick } from "./core.js";
import { WEATHER, type CalendarSeasonId, type RainBandId, type SkyId } from "./data.js";
import type { Game } from "./game.js";

export interface WeatherState {
  sky: SkyId;
  hours: number; // in this sky so far
  rain: number; // intensity 0..1; 0 unless raining
  target: number; // where the intensity is easing toward
  band: RainBandId | null; // null unless raining
  ending: boolean; // rain easing off to stop
  wanderIn: number; // game minutes until the rain picks a new target
  bandMinutes?: number; // in this rain band so far
}

/** What a patron walked in from. Soaking (inn#21) reads this. */
export interface CameIn { sky: SkyId; band: RainBandId | null; rain: number }

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const BANDS = WEATHER.bands;

/** The band for an intensity, moving from `current` with hysteresis so it doesn't flicker at an edge. */
function bandFor(rain: number, current: RainBandId | null): RainBandId {
  let i = current ? BANDS.findIndex((b) => b.id === current) : 0;
  while (i + 1 < BANDS.length && rain >= BANDS[i + 1].from) i++;
  while (i > 0 && rain < BANDS[i].from - WEATHER.hysteresis) i--;
  return BANDS[i].id;
}

function startRain(w: WeatherState, season: CalendarSeasonId, sudden: boolean): void {
  const S = WEATHER.seasons[season];
  w.rain = sudden ? clamp(organic(WEATHER.showerStart), 0.36, 0.9) : 0.08;
  w.target = clamp(organic(S.rain), 0.15, 0.95);
  w.wanderIn = organic(WEATHER.rainWanderEvery);
  w.ending = false;
  w.band = bandFor(w.rain, null);
  w.bandMinutes = 0;
}

/** The weather on the first morning of a save. */
export function newWeather(season: CalendarSeasonId): WeatherState {
  const S = WEATHER.seasons[season];
  const skies = Object.keys(S.start) as SkyId[];
  const sky = weightedPick(skies, (k) => S.start[k]) ?? "cloudy";
  const w: WeatherState = { sky, hours: 0, rain: 0, target: 0, band: null, ending: false, wanderIn: 0 };
  if (sky === "rain") { startRain(w, season, false); w.rain = w.target; w.band = bandFor(w.rain, null); } // already set in
  return w;
}

// Overnight the weather carries on, but nobody's awake to hear about it.
let quiet = false;
function tell(g: Game, line: string | undefined): void {
  if (line && !quiet) g.say(line);
}

function moveSky(g: Game, to: SkyId, abrupt: boolean): void {
  const w = g.weather;
  const from = w.sky;
  const fromBand = w.band;
  w.sky = to;
  w.hours = 0;
  if (to === "rain") startRain(w, g.date.season, abrupt);
  else { w.rain = 0; w.target = 0; w.band = null; w.ending = false; }
  if (quiet) return;
  tell(g, WEATHER.lines.sky[`${from}>${to}`]);
  g.bus.emit({ type: "WeatherChanged", from, to, abrupt });
  if (fromBand !== w.band) g.bus.emit({ type: "RainBandChanged", from: fromBand, to: w.band, abrupt });
}

export function updateWeather(g: Game, simDt: number): void {
  const w = g.weather;
  const S = WEATHER.seasons[g.date.season];
  const hours = simDt / 60;
  w.hours += hours;

  if (w.sky === "rain") {
    let broke = false;
    if (!w.ending) {
      w.wanderIn -= simDt;
      if (w.wanderIn <= 0) { w.target = clamp(organic(S.rain), 0.15, 0.95); w.wanderIn = organic(WEATHER.rainWanderEvery); }
      // A storm breaks: abrupt, straight up into the storm band (or near it).
      if (w.band !== "storm" && chance(S.storm * hours)) {
        broke = true;
        w.target = clamp(0.8 + Math.random() * 0.15);
        w.rain = clamp(w.rain + WEATHER.stormJump);
        w.wanderIn = organic(WEATHER.stormLasts);
      }
    }
    const step = WEATHER.rainEasePerHour * hours;
    w.rain = clamp(w.rain + clamp(w.target - w.rain, -step, step));
    w.bandMinutes = (w.bandMinutes ?? 0) + simDt;
    const band = bandFor(w.rain, w.band);
    if (band !== w.band && (broke || w.bandMinutes >= WEATHER.bandMinMinutes)) {
      w.bandMinutes = 0;
      const from = w.band;
      const up = BANDS.findIndex((b) => b.id === band) > BANDS.findIndex((b) => b.id === from);
      w.band = band;
      tell(g, broke ? WEATHER.lines.stormBreaks : up ? WEATHER.lines.heavier[band] : WEATHER.lines.easing[band]);
      if (!quiet) g.bus.emit({ type: "RainBandChanged", from, to: band, abrupt: broke });
    }
    if (w.band === "storm" && !quiet && chance(WEATHER.thunderPerHour * hours)) {
      g.bus.emit({ type: "Thunder", near: chance(0.3) });
    }
    // Easing off: it stops once it's down to almost nothing.
    if (w.ending && w.rain < WEATHER.rainEndsBelow) {
      const to = weightedPick(Object.keys(S.to.rain) as SkyId[], (k) => S.to.rain[k] ?? 0) ?? "overcast";
      moveSky(g, to, false);
      return;
    }
  }

  // Past its minimum time, a sky may move on.
  if (w.ending || w.hours < WEATHER.skies[w.sky].minHours) return;
  if (!chance((1 - S.stay[w.sky]) * hours)) return;
  if (w.sky === "rain") { w.ending = true; w.target = 0; return; } // rain eases off before it stops
  const options = S.to[w.sky];
  const to = weightedPick(Object.keys(options) as SkyId[], (k) => options[k] ?? 0);
  if (to) moveSky(g, to, w.sky === "cloudy" && to === "rain"); // a sudden shower
}

/** The hours between turning in and waking: the weather carries on, quietly. */
export function passNight(g: Game, minutes: number): void {
  quiet = true;
  try { for (let m = 0; m < minutes; m += 10) updateWeather(g, 10); }
  finally { quiet = false; }
}

/** Everything the weather is right now, as tags: the sky's, the rain band's, and `cold`. */
export function weatherTags(g: Game): string[] {
  const w = g.weather;
  const tags = [...WEATHER.skies[w.sky].tags];
  if (w.band) tags.push(...(BANDS.find((b) => b.id === w.band)?.tags ?? []));
  const season = g.date.season;
  const late = g.timeOfDay === "evening" || g.timeOfDay === "night";
  if (WEATHER.coldSeasons.includes(season) || (late && WEATHER.coldNightSeasons.includes(season))) tags.push("cold");
  return tags;
}

/** "🌧️ Rain", "⛈️ Storm", "🌙 Clear". */
export function weatherLabel(g: Game): string {
  const w = g.weather;
  if (w.band) { const b = BANDS.find((x) => x.id === w.band)!; return `${b.icon} ${b.name}`; }
  const s = WEATHER.skies[w.sky];
  return `${g.timeOfDay === "night" ? s.nightIcon : s.icon} ${s.name}`;
}

/** What the keeper sees on waking. */
export function morningLine(g: Game): string {
  const w = g.weather;
  if (w.band === "storm") return "A storm's raging outside.";
  if (w.band) return w.band === "light-rain" ? "A light rain is falling." : "It's raining.";
  return { clear: "Clear skies.", cloudy: "Some cloud about.", overcast: "Grey and overcast." }[w.sky as Exclude<SkyId, "rain">];
}

/** Debug: set the weather straight away. `rain` picks a band's middle when forcing rain. */
export function forceWeather(g: Game, sky: SkyId, band?: RainBandId): void {
  const w = g.weather;
  if (sky !== "rain") { moveSky(g, sky, true); return; }
  if (w.sky !== "rain") moveSky(g, "rain", true);
  const mid = { "light-rain": 0.2, rain: 0.52, storm: 0.85 }[band ?? "rain"];
  const from = w.band;
  w.rain = w.target = mid;
  w.ending = false;
  w.band = bandFor(mid, null);
  if (from !== w.band) g.bus.emit({ type: "RainBandChanged", from, to: w.band, abrupt: true });
}

export function cameIn(g: Game): CameIn {
  return { sky: g.weather.sky, band: g.weather.band, rain: Math.round(g.weather.rain * 100) / 100 };
}
