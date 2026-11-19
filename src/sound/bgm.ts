// Background music: when no music has played for a while (BGM.quietSeconds), a track fades in softly from
// nowhere in particular and fades away over its last seconds; then quiet again, and another (not the same one twice running). The gramophone
// takes over: winding it fades the track out, and the quiet is counted again once it has stopped.
// On the music bus, so the Music setting covers it too.

import type { Game } from "../game.js";
import { BGM } from "../data.js";
import { hasSound, isPlaying, play, remaining, stop, type Voice } from "./engine.js";

let track: Voice | null = null;
let last: string | null = null;
let quiet = 0; // real seconds without any music

/** Something else is the music for a moment (the turning-in jingle): fade out, and count the quiet afresh. */
export function hushBgm(): void {
  if (track) { stop(track, BGM.hushMs); track = null; }
  quiet = 0;
}

export function bgmSound(g: Game, realDt: number): void {
  // The gramophone is playing, or being wound: it's the music now.
  if (g.gramophone.on || g.winding) {
    if (track) { stop(track, BGM.fadeOutMs); track = null; }
    quiet = 0;
    return;
  }
  if (track) {
    if (isPlaying(track)) {
      // Its last seconds: fade it away (stop() fades the level down, then ends it).
      const left = remaining(track);
      if (left <= BGM.endFadeMs / 1000) stop(track, left * 1000);
      return;
    }
    track = null; // it finished: quiet again before the next
    quiet = 0;
  }
  if (g.paused) return;
  quiet += realDt;
  if (quiet < BGM.quietSeconds) return;
  const ready = BGM.tracks.filter((k) => hasSound(k));
  if (!ready.length) { quiet = 0; return; } // none yet: check again after another quiet spell
  const pool = ready.length > 1 ? ready.filter((k) => k !== last) : ready;
  last = pool[Math.floor(Math.random() * pool.length)];
  track = play(last, null, { fadeInMs: BGM.fadeInMs });
  quiet = 0;
}
