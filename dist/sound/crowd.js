// The murmur of the taproom, by how many people are in it (CROWD in data.ts).
// The headcount has to hold for a moment before the murmur changes, then the levels crossfade.
import { CROWD, SOUND_TUNING as T } from "../data.js";
import { play, roomAt, stop } from "./engine.js";
let playing = null; // the level we're sounding
let voice = null;
let heading = null; // the level the headcount points at
let since = 0;
export function crowd(g) {
    const count = g.patrons.filter((p) => roomAt(p.pos) === "taproom").length;
    const level = [...CROWD].reverse().find((c) => count >= c.from)?.sound ?? null;
    const t = performance.now();
    if (level !== heading) {
        heading = level;
        since = t;
    }
    if (heading !== playing && t - since >= T.crowdSettleMs) {
        stop(voice, T.crowdFadeMs);
        voice = null;
        playing = heading;
    }
    if (playing && !voice)
        voice = play(playing, null, { fadeInMs: T.crowdFadeMs });
}
