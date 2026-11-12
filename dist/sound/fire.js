// The fire's sound follows its life (FIRE in data.ts): lit, it catches small, roars up, then settles;
// put out, it falls to embers and goes quiet. Stages crossfade, and it's heard from the fireplace.
// Time only runs while the sound runs (pausing holds the fire where it is).
import { FIRE } from "../data.js";
import { play, stop } from "./engine.js";
let lit = null; // what we last saw; null before the first frame
let stages = [];
let stage = 0;
let elapsed = 0;
let voice = null;
let sounding = null;
function fireplaceAt(g) {
    return g.world.furniture.find((f) => f.kind === "fireplace")?.center ?? null;
}
export function fire(g, realDt) {
    if (g.fireLit !== lit) {
        // The first frame of a game already burning: skip straight to the settled fire.
        const fresh = lit === null;
        lit = g.fireLit;
        stages = lit ? FIRE.lighting : FIRE.dousing;
        stage = fresh && lit ? stages.length - 1 : fresh ? stages.length : 0;
        elapsed = 0;
    }
    else {
        elapsed += realDt;
        const cur = stages[stage];
        if (cur?.seconds !== undefined && elapsed >= cur.seconds) {
            stage++;
            elapsed = 0;
        }
    }
    const want = stages[stage]?.sound ?? null; // past the last stage of dousing: silence
    if (want === sounding && (voice || !want))
        return;
    stop(voice, FIRE.crossfadeMs);
    voice = null;
    sounding = want;
    const at = fireplaceAt(g);
    if (want && at)
        voice = play(want, at, { fadeInMs: FIRE.crossfadeMs });
}
