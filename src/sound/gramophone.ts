// The gramophone: records played from where it stands, one after another until the spring runs down.
// Wound by hand, so it plays a few records per winding (GRAMOPHONE in data.ts). The records' own length
// decides when the next starts, so the sequence lives with the sound:
//   wind:   the crank turns, then the needle drops and the record plays
//   change: the needle drops on the next record
//   a record ends: the run-out, then the next record, or the spring winds down and it stops
// A soft surface crackle runs underneath while it plays.

import type { Game } from "../game.js";
import { GRAMOPHONE } from "../data.js";
import { hasSound, isPlaying, play, ringsOut, stop, type Voice } from "./engine.js";

let song: Voice | null = null;
let crackle: Voice | null = null;
let playing = -1; // which record the song voice is
let startAt: number | null = null; // real ms: when the needle drops on the current record
let busy = false; // between records (run-out, winding down)

function where(g: Game) {
  return g.world.furniture.find((f) => f.kind === "gramophone")?.center ?? null;
}

/** Are any records loaded? (They may not be there yet.) */
export function recordsReady(): boolean {
  return GRAMOPHONE.records.some((r) => hasSound(r.sound));
}

/** Seconds a sound rings, or a fallback if it isn't loaded. */
function length(v: Voice | null, fallback: number): number {
  return v ? ringsOut(v) : fallback;
}

/** Wound up: the crank, then the record. */
export function gramophoneWound(g: Game): void {
  const crank = play("gramoCrank", where(g));
  startAt = performance.now() + length(crank, 1.2) * 1000;
}

/** A different record: lift the needle, drop it on the next. */
export function gramophoneChanged(): void {
  if (song) { stop(song, 200); song = null; }
  busy = false;
  startAt = performance.now() + 250;
}

export function gramophoneSound(g: Game): void {
  const gr = g.gramophone;
  const at = where(g);
  if (!gr.on) {
    if (song) { stop(song, 900); song = null; }
    if (crackle && !busy) { stop(crackle, 1200); crackle = null; }
    playing = -1;
    return;
  }
  if (!crackle) crackle = play("gramoCrackle", at, { fadeInMs: 800 });

  // Time for the needle to drop on the current record.
  if (startAt !== null && performance.now() >= startAt) {
    // A record still loading (they're long): skip to one that's ready, or try again in a moment.
    const n = GRAMOPHONE.records.length;
    let tries = 0;
    while (!hasSound(GRAMOPHONE.records[gr.record].sound) && tries++ < n) gr.record = (gr.record + 1) % n;
    if (tries >= n) { startAt = performance.now() + 1000; return; }
    startAt = null;
    busy = false;
    play("gramoNeedle", at);
    const rec = GRAMOPHONE.records[gr.record];
    song = play(rec.sound, at, { fadeInMs: 150 });
    playing = gr.record;
    if (song) g.say(`♪ ${rec.title}`);
    return;
  }

  // The record ran out: the run-out groove, then the next record or the spring gives up.
  if (song && playing === gr.record && !isPlaying(song) && !busy) {
    song = null;
    busy = true;
    const runout = play("gramoRunout", at);
    gr.left--;
    if (gr.left <= 0) {
      const after = length(runout, 1.5) * 1000;
      setTimeout(() => {
        const down = play("gramoWindDown", at);
        setTimeout(() => {
          gr.on = false;
          busy = false;
          g.say("The gramophone winds down.");
        }, length(down, 1.5) * 1000);
      }, after);
    } else {
      gr.record = (gr.record + 1) % GRAMOPHONE.records.length;
      startAt = performance.now() + length(runout, 1.5) * 1000;
    }
  }
}
