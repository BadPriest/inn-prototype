// The gramophone: records played from where it stands, one after another until the spring runs down.
// The spring runs for a while (GRAMOPHONE.springSeconds of music), then gives out:
//   wind:    the crank turns, then the needle drops and the record plays
//   change:  the needle drops on the next record
//   a record ends: the run-out, then the next record
//   the spring gives out mid-record: the record sags (pitch and speed drag down) with the
//            winding-down sound layered over it, then silence
//   the spring is spent as a record ends: the run-out, then the winding-down sound, then silence
//   wound again after it gave out mid-record: the record picks up where it stopped, coming up to speed
//            (after it was spent at a record's end: the next record)
// A soft surface crackle runs underneath while it plays. Sound effects go to the music bus, so
// "music off" silences all of it.
import { GRAMOPHONE } from "../data.js";
import { hasSound, isPlaying, play, position, rampRate, ringsOut, setLevel, stop } from "./engine.js";
let song = null;
let crackle = null;
let playing = -1; // which record the song voice is
let startAt = null; // real ms: when the needle drops on the current record
let ending = false; // the spring has given out (sagging or winding down): no more records
let crank = null;
function where(g) {
    return g.world.furniture.find((f) => f.kind === "gramophone")?.center ?? null;
}
/** Are any records loaded? (They may not be there yet.) */
export function recordsReady() {
    return GRAMOPHONE.records.some((r) => hasSound(r.sound));
}
/** Seconds a sound rings, or a fallback if it isn't loaded. */
function length(v, fallback) {
    return v ? ringsOut(v) : fallback;
}
/** The keeper starts winding: the crank turns, a bar fills; the record starts once it's wound. */
export function gramophoneWound(g) {
    ending = false;
    startAt = null;
    crank = play("gramoCrank", where(g));
    g.winding = { progress: 0, total: length(crank, 3), at: { ...g.keeper.pos } };
}
/** Every frame (real seconds): winding goes on while the keeper stays put. */
export function updateWinding(g, realDt) {
    const w = g.winding;
    if (!w || g.paused)
        return;
    if (Math.hypot(g.keeper.pos.x - w.at.x, g.keeper.pos.y - w.at.y) > 0.3) {
        g.winding = null;
        stop(crank, 150);
        crank = null;
        g.gramophone.on = false;
        g.say("You leave the gramophone unwound.");
        return;
    }
    w.progress += realDt;
    if (w.progress < w.total)
        return;
    g.winding = null;
    crank = null;
    g.gramophone.spring = GRAMOPHONE.springSeconds;
    startAt = performance.now();
}
/** A different record: lift the needle, drop it on the next. */
export function gramophoneChanged(g) {
    g.gramophone.resumeAt = null;
    if (song) {
        stop(song, 200);
        song = null;
    }
    startAt = performance.now() + 250;
}
/** The spring's spent: off, silently, after the last sound has played. */
function stopAfter(g, ms) {
    setTimeout(() => {
        g.gramophone.on = false;
        ending = false;
        g.say("The gramophone winds down.");
    }, ms);
}
export function gramophoneSound(g, realDt) {
    const gr = g.gramophone;
    const at = where(g);
    if (!gr.on) {
        if (song) {
            stop(song, 900);
            song = null;
        }
        if (crackle) {
            stop(crackle, 1200);
            crackle = null;
        }
        playing = -1;
        return;
    }
    if (!crackle && !ending && !g.winding)
        crackle = play("gramoCrackle", at, { fadeInMs: 800 }); // once the needle's down
    // The spring runs down while music plays (not while the game's paused).
    if (song && !g.paused && !ending) {
        gr.spring = Math.max(0, gr.spring - realDt);
        // It gives out mid-record: the music sags as the turntable slows, with the winding-down sound over it.
        if (gr.spring <= GRAMOPHONE.sag.seconds) {
            ending = true;
            const secs = Math.max(0.5, gr.spring);
            // Where the needle will stop: the speed falls steadily to toRate, then 0.3 s more at that speed.
            gr.resumeAt = position(song) + secs * (1 + GRAMOPHONE.sag.toRate) / 2 + 0.3 * GRAMOPHONE.sag.toRate;
            rampRate(song, GRAMOPHONE.sag.toRate, secs);
            setLevel(song, GRAMOPHONE.sag.toLevel, secs);
            play("gramoWindDown", at);
            const last = song;
            setTimeout(() => { stop(last, 300); if (song === last)
                song = null; if (crackle) {
                stop(crackle, 600);
                crackle = null;
            } }, secs * 1000);
            stopAfter(g, secs * 1000 + 300);
            return;
        }
    }
    // Time for the needle to drop on the current record.
    if (startAt !== null && performance.now() >= startAt && !ending) {
        // A record still loading (they're long): skip to one that's ready, or try again in a moment.
        const n = GRAMOPHONE.records.length;
        let tries = 0;
        while (!hasSound(GRAMOPHONE.records[gr.record].sound) && tries++ < n)
            gr.record = (gr.record + 1) % n;
        if (tries >= n) {
            startAt = performance.now() + 1000;
            return;
        }
        if (tries > 0)
            gr.resumeAt = null; // that one wasn't ready: a different record, from its start
        startAt = null;
        const rec = GRAMOPHONE.records[gr.record];
        if (gr.resumeAt !== null) {
            // The needle never left the record: it comes back up to speed from where it stopped.
            const { spinUpSeconds } = GRAMOPHONE.resume;
            song = play(rec.sound, at, { offset: gr.resumeAt, fadeInMs: 200, spinUpFrom: GRAMOPHONE.sag.toRate, spinUpSeconds });
            gr.resumeAt = null;
        }
        else {
            play("gramoNeedle", at);
            song = play(rec.sound, at, { fadeInMs: 150 });
        }
        playing = gr.record;
        if (song)
            g.say(`♪ ${rec.title}`);
        return;
    }
    // The record ran out: the run-out groove, then the next record, or the spring's spent.
    if (song && playing === gr.record && !isPlaying(song) && !ending) {
        song = null;
        const runout = play("gramoRunout", at);
        const after = length(runout, 1.5) * 1000;
        if (gr.spring <= GRAMOPHONE.sag.seconds * 2) {
            ending = true;
            gr.record = (gr.record + 1) % GRAMOPHONE.records.length; // wound again, it plays the next one
            gr.resumeAt = null;
            setTimeout(() => {
                if (crackle) {
                    stop(crackle, 600);
                    crackle = null;
                }
                const down = play("gramoWindDown", at);
                stopAfter(g, length(down, 1.5) * 1000);
            }, after);
        }
        else {
            gr.record = (gr.record + 1) % GRAMOPHONE.records.length;
            startAt = performance.now() + after;
        }
    }
}
/** The spring's state, for the prompt: "plenty", "a while", "nearly spent". */
export function springLeft(g) {
    const s = g.gramophone.spring;
    if (ending || s <= GRAMOPHONE.sag.seconds)
        return "winding down";
    return s > GRAMOPHONE.springSeconds * 0.6 ? "freshly wound" : s > GRAMOPHONE.springSeconds * 0.25 ? "running a while yet" : "nearly spent";
}
