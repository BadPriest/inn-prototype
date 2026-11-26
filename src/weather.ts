// Weather: states with allowed transitions and minimum times, and a rain intensity with named bands.
//
// Nothing here plays sounds or draws anything. It keeps the state, says what changed (events and a
// log line for the keeper), and offers tags so everyone else can read it: chatter, tastes, soaking,
// flow, sound, light. Tuning is WEATHER in data.ts.

import { chance, organic, weightedPick } from "./core.js";
import { LOCATIONS, TUNING, WEATHER, type CalendarSeasonId, type Location, type RainBandId, type SkyId, type Tracks } from "./data.js";
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
  temp: number; // outdoor temperature in steps (0 freezing … 5 hot), moving smoothly
  tempStep: number; // the named step it counts as, with hysteresis
  spell: number; // steps a warm spell (+) or cold snap (−) adds just now
  spellTarget: number;
  spellIn: number; // hours until a new spell sets in
  ground: number; // how wet the ground outside is, 0..1
  snow: boolean; // what falls is snow (the temperature decides); stays set after it stops
  afterSnow: number; // hours left of the snow's aftermath: guests still come in snowy
}

/** What a patron walked in from. Soaking (inn#21) reads this; `tracks` is what their boots leave at the door. */
export interface CameIn { sky: SkyId; band: RainBandId | null; rain: number; tracks?: Tracks; snow?: "falling" | "after" }

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const BANDS = WEATHER.bands;
const SN = WEATHER.snow;

/** The band for an intensity, moving from `current` with hysteresis so it doesn't flicker at an edge. */
function bandFor(rain: number, current: RainBandId | null): RainBandId {
  let i = current ? BANDS.findIndex((b) => b.id === current) : 0;
  while (i + 1 < BANDS.length && rain >= BANDS[i + 1].from) i++;
  while (i > 0 && rain < BANDS[i].from - WEATHER.hysteresis) i--;
  return BANDS[i].id;
}

type Odds = (typeof WEATHER.seasons)[CalendarSeasonId];

/** The calendar season's weather odds, tilted by the location's climate that season (wetter, stormier, or gentler). */
export function oddsFor(season: CalendarSeasonId, loc: Location = LOCATIONS[0]): Odds {
  const S = WEATHER.seasons[season];
  const { rain, storm } = loc.climate[season];
  const to = Object.fromEntries(Object.entries(S.to).map(([from, opts]) =>
    [from, Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, k === "rain" ? (v ?? 0) * rain : v]))])) as Odds["to"];
  return {
    ...S,
    start: { ...S.start, rain: S.start.rain * rain },
    stay: { ...S.stay, rain: Math.min(0.97, 1 - (1 - S.stay.rain) / rain) }, // wet places: rain lingers
    to,
    storm: S.storm * storm,
  };
}

const T = WEATHER.temperature;
const stepIndex = (id: string) => T.steps.findIndex((s) => s.id === id);

/** How far into the warm part of the day an hour is: 0 just before dawn, 1 mid-afternoon. */
function warmthOfHour(hour: number): number {
  const rise = T.warmestHour - T.coldestHour;
  if (hour >= T.coldestHour && hour <= T.warmestHour) return (1 - Math.cos(Math.PI * (hour - T.coldestHour) / rise)) / 2;
  const since = (hour - T.warmestHour + 24) % 24;
  return (1 + Math.cos(Math.PI * Math.pow(since / (24 - rise), T.eveningFall))) / 2;
}

/** Where the temperature should be at this hour, in steps: the climate's range for the day, the sky, the rain, the spell. */
function temperatureFor(w: WeatherState, season: CalendarSeasonId, loc: Location, hour: number): number {
  const [coldest, warmest] = loc.climate[season].temperature.map(stepIndex);
  const f = warmthOfHour(hour);
  const sky = T.sky[w.sky];
  const t = coldest + (warmest - coldest) * f + sky.day * f + sky.night * (1 - f) + T.rainPerIntensity * w.rain + w.spell;
  return clamp(t, 0, T.steps.length - 1);
}

/** The named step for a temperature, moving from `current` only once it's past the edge by the hysteresis. */
function stepFor(temp: number, current: number): number {
  const near = Math.round(temp);
  return Math.abs(temp - current) > 0.5 + T.hysteresis ? near : current;
}

const clockHour = (minute: number) => ((TUNING.dayStartHour * 60 + minute) / 60) % 24;
const newSpell = () => (Math.random() + Math.random() - 1) * T.spell.size;

/** Temperature and ground for a save from before they existed, or a new one: set straight to where they'd be. */
export function settleWeather(w: WeatherState, season: CalendarSeasonId, loc: Location, minute: number): void {
  w.afterSnow ??= 0;
  if (typeof w.temp === "number") { w.snow ??= w.temp < SN.below; return; }
  w.spell = w.spellTarget = newSpell();
  w.spellIn = organic(T.spell.everyHours);
  w.temp = temperatureFor(w, season, loc, clockHour(minute));
  w.tempStep = Math.round(w.temp);
  w.snow = w.temp < SN.below;
  w.ground = w.sky === "rain" && !w.snow ? 0.6 : 0;
}

/** Every tick: the temperature eases toward where it should be, spells come and go, the ground wets and dries. */
function updateTemperature(g: Game, w: WeatherState, hours: number): void {
  w.spellIn -= hours;
  if (w.spellIn <= 0) { w.spellTarget = newSpell(); w.spellIn = organic(T.spell.everyHours); }
  const s = T.spell.easePerHour * hours;
  w.spell += clamp(w.spellTarget - w.spell, -s, s);
  const target = temperatureFor(w, g.date.season, g.loc, clockHour(g.minute));
  const step = T.easePerHour * hours;
  w.temp += clamp(target - w.temp, -step, step);
  const now = stepFor(w.temp, w.tempStep);
  if (now !== w.tempStep) {
    const id = T.steps[now].id;
    tell(g, now > w.tempStep ? T.lines.up[id] : T.lines.down[id]);
    w.tempStep = now;
  }
  const snow = w.snow ? w.temp < SN.above : w.temp < SN.below;
  if (snow !== w.snow) {
    w.snow = snow;
    if (w.sky === "rain") tell(g, snow ? SN.lines.toSnow : SN.lines.toRain);
  }
  w.afterSnow = Math.max(0, w.afterSnow - hours);
  const G = WEATHER.ground;
  if (w.sky === "rain" && !w.snow) w.ground += G.wetPerHour * Math.max(0.15, w.rain) * hours;
  else w.ground -= G.dryPerHour[w.sky] * (1 + G.dryPerStep * w.temp) * hours;
  w.ground = clamp(w.ground);
}

/** The temperature's name now: "Cold". */
export function temperatureName(g: Game): string {
  return T.steps[g.weather.tempStep].name;
}

/** What boots bring in from outside: snow, mud off a wet road (not a frozen one), or just wet. */
function tracksNow(w: WeatherState): Tracks | undefined {
  const G = WEATHER.ground;
  if ((w.band && w.snow) || w.afterSnow > 0) return "snow";
  if (w.ground >= G.muddyFrom && w.temp >= G.frozenBelow) return "mud";
  if (w.band || w.ground >= G.muddyFrom) return "wet";
  return undefined;
}

function startRain(w: WeatherState, S: Odds, sudden: boolean): void {
  w.rain = sudden ? clamp(organic(WEATHER.showerStart), 0.36, 0.9) : 0.08;
  w.target = clamp(organic(S.rain), 0.15, 0.95);
  w.wanderIn = organic(WEATHER.rainWanderEvery);
  w.ending = false;
  w.band = bandFor(w.rain, null);
  w.bandMinutes = 0;
}

/** The weather on the first morning of a save. */
export function newWeather(season: CalendarSeasonId, loc: Location = LOCATIONS[0]): WeatherState {
  const S = oddsFor(season, loc);
  const skies = Object.keys(S.start) as SkyId[];
  const sky = weightedPick(skies, (k) => S.start[k]) ?? "cloudy";
  const w = { sky, hours: 0, rain: 0, target: 0, band: null, ending: false, wanderIn: 0 } as unknown as WeatherState;
  if (sky === "rain") { startRain(w, S, false); w.rain = w.target; w.band = bandFor(w.rain, null); } // already set in
  settleWeather(w, season, loc, 0);
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
  if (to === "rain") { startRain(w, oddsFor(g.date.season, g.loc), abrupt); w.afterSnow = 0; }
  else { w.rain = 0; w.target = 0; w.band = null; w.ending = false; }
  if (from === "rain" && w.snow) w.afterSnow = organic(SN.aftermathHours);
  if (quiet) return;
  const snowLine = !w.snow ? undefined : to === "rain" ? (abrupt ? SN.lines.sudden : SN.lines.starts) : from === "rain" ? SN.lines.stops : undefined;
  tell(g, snowLine ?? WEATHER.lines.sky[`${from}>${to}`]);
  g.bus.emit({ type: "WeatherChanged", from, to, abrupt });
  if (fromBand !== w.band) g.bus.emit({ type: "RainBandChanged", from: fromBand, to: w.band, abrupt });
}

export function updateWeather(g: Game, simDt: number): void {
  const w = g.weather;
  if (!quiet) { // the day's weather, for the calendar (not the quiet runs: overnight, forecasts)
    const s = (g.stats.weather ??= { rainMinutes: 0, storm: false, sky: {} });
    s.sky[w.sky] = (s.sky[w.sky] ?? 0) + simDt;
    if (w.sky === "rain" && w.snow) s.snowMinutes = (s.snowMinutes ?? 0) + simDt;
    else if (w.sky === "rain") s.rainMinutes += simDt;
    if (w.band === "storm") s.storm = true;
  }
  const S = oddsFor(g.date.season, g.loc);
  const hours = simDt / 60;
  w.hours += hours;
  updateTemperature(g, w, hours);

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
      const L = w.snow ? { stormBreaks: SN.lines.heavier.storm, heavier: SN.lines.heavier, easing: SN.lines.easing } : WEATHER.lines;
      tell(g, broke ? L.stormBreaks : up ? L.heavier[band] : L.easing[band]);
      if (!quiet) g.bus.emit({ type: "RainBandChanged", from, to: band, abrupt: broke });
    }
    if (w.band === "storm" && !w.snow && !quiet && chance(WEATHER.thunderPerHour * hours)) {
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

/** Run the weather ahead quietly from now, calling `look` every 10 minutes, then put it all back. */
export function foresee(g: Game, minutes: number, look: (minute: number, w: WeatherState) => void): void {
  const saved = structuredClone(g.weather);
  const savedMinute = g.minute;
  quiet = true;
  try {
    for (let m = 0; m < minutes; m += 10) { g.minute = savedMinute + m; updateWeather(g, 10); look(m, g.weather); }
  } finally {
    quiet = false;
    g.weather = saved;
    g.minute = savedMinute;
  }
}

/** The hours between turning in and waking: the weather carries on, quietly. */
export function passNight(g: Game, minutes: number): void {
  const savedMinute = g.minute;
  quiet = true;
  try { for (let m = 0; m < minutes; m += 10) { g.minute = savedMinute + m; updateWeather(g, 10); } }
  finally { quiet = false; g.minute = savedMinute; }
}

/** What's falling, as a band to show: rain's, or snow's when it's snow. */
function shownBand(w: WeatherState): { name: string; icon: string; tags: string[] } | undefined {
  if (!w.band) return undefined;
  return w.snow ? SN.bands[w.band] : BANDS.find((b) => b.id === w.band);
}

/** Everything the weather is right now, as tags: the sky's (not `wet` in snow), what's falling, and `cold`. */
export function weatherTags(g: Game): string[] {
  const w = g.weather;
  const tags = w.band && w.snow ? [] : [...WEATHER.skies[w.sky].tags];
  tags.push(...(shownBand(w)?.tags ?? []));
  if (w.tempStep <= T.coldTagAt) tags.push("cold");
  if (w.tempStep <= T.freezingTagAt) tags.push("freezing");
  if (w.tempStep >= T.hotTagAt) tags.push("hot");
  return tags;
}

/** "🌧️ Rain", "❄️ Blizzard", "🌙 Clear". */
export function skyLabel(g: Game): string {
  const w = g.weather;
  const b = shownBand(w);
  if (b) return `${b.icon} ${b.name}`;
  const s = WEATHER.skies[w.sky];
  return `${g.timeOfDay === "night" ? s.nightIcon : s.icon} ${s.name}`;
}

/** "🌧️ Rain · Cool", "❄️ Blizzard · Freezing", "🌙 Clear · Cold". */
export function weatherLabel(g: Game): string {
  return `${skyLabel(g)} · ${temperatureName(g)}`;
}

/** Where the outdoor temperature sits from freezing (0) to hot (1), each step a sixth of the way. */
export function temperatureLevel(g: Game): number {
  const w = g.weather, lo = w.tempStep - 0.5, hi = w.tempStep + 0.5;
  return (Math.max(lo, Math.min(hi, w.temp)) + 0.5) / T.steps.length;
}

/** What the keeper sees on waking. */
export function morningLine(g: Game): string {
  const w = g.weather;
  const temp = `It's ${temperatureName(g).toLowerCase()} out.`;
  if (w.band && w.snow) return `${{ "light-rain": "A few flakes are drifting down.", rain: "It's snowing.", storm: "A blizzard's blowing outside." }[w.band]} ${temp}`;
  if (w.afterSnow > 0) return `Snow fell in the night; it's stopped now. ${temp}`;
  if (w.band === "storm") return `A storm's raging outside. ${temp}`;
  if (w.band) return `${w.band === "light-rain" ? "A light rain is falling." : "It's raining."} ${temp}`;
  return `${{ clear: "Clear skies.", cloudy: "Some cloud about.", overcast: "Grey and overcast." }[w.sky as Exclude<SkyId, "rain">]} ${temp}`;
}

/** Debug: set the weather straight away. `rain` picks a band's middle when forcing rain; `snow` makes it freezing first. */
export function forceWeather(g: Game, sky: SkyId, band?: RainBandId, snow = false): void {
  const w = g.weather;
  if (snow) { w.temp = Math.min(w.temp, 0.4); w.tempStep = 0; w.snow = true; }
  else if (sky === "rain" && w.snow) { w.temp = Math.max(w.temp, 2.5); w.tempStep = 3; w.snow = false; }
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
  const w = g.weather;
  const snow = w.band && w.snow ? "falling" : w.afterSnow > 0 ? "after" : undefined;
  return { sky: w.sky, band: w.band, rain: Math.round(w.rain * 100) / 100, tracks: tracksNow(w), snow };
}

/** How much snow someone coming in now has on them, 0..1: the snowfall's intensity, or a little after it stops. */
export function snowyNow(g: Game): number {
  const w = g.weather;
  if (w.band && w.snow) return clamp(w.rain * organic([1, 0.25]));
  return w.afterSnow > 0 ? clamp(0.3 * Math.min(1, w.afterSnow / 2)) : 0;
}
