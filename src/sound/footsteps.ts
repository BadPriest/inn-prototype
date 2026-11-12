// Footsteps: one step each time someone covers a stride, so the pace always matches how fast they move.
// The keeper walks or runs; guests are quieter, and only a few of their steps sound at once.

import type { Game } from "../game.js";
import { SOUNDS, SOUND_TUNING as T, TUNING } from "../data.js";
import type { Vec } from "../world.js";
import { placement, play, playingCount } from "./engine.js";

interface Walker { x: number; y: number; travelled: number }
const walkers = new Map<number | "keeper", Walker>();
const RUN_ABOVE = (TUNING.keeperWalk + TUNING.keeperRun) / 2; // tiles per second

/** Distance moved since last frame, and whether a step is due. Standing still primes the next step. */
function stride(id: number | "keeper", pos: Vec, length: number): { moved: number; step: boolean } {
  let w = walkers.get(id);
  if (!w) { w = { x: pos.x, y: pos.y, travelled: length * 0.7 }; walkers.set(id, w); }
  const moved = Math.hypot(pos.x - w.x, pos.y - w.y);
  w.x = pos.x; w.y = pos.y;
  if (moved > 2) return { moved: 0, step: false }; // moved by the game (new day, bedtime), not walked
  if (moved < 1e-4) { w.travelled = Math.max(w.travelled, length * 0.7); return { moved, step: false }; }
  w.travelled += moved;
  if (w.travelled < length) return { moved, step: false };
  w.travelled %= length;
  return { moved, step: true };
}

export function footsteps(g: Game, realDt: number): void {
  // The keeper. Speed decides walking or running (and the stride that goes with it).
  const k = g.keeper.pos;
  const prev = walkers.get("keeper");
  const speed = prev && realDt > 0 ? Math.hypot(k.x - prev.x, k.y - prev.y) / realDt : 0;
  const running = speed > RUN_ABOVE;
  if (stride("keeper", k, running ? T.keeperRunStride : T.keeperStride).step) {
    play(running ? "keeperRun" : "keeperWalk", { ...k });
  }

  // Guests: quieter, and capped so a busy room doesn't turn into a clatter.
  const here = new Set<number>();
  for (const p of g.patrons) {
    here.add(p.id);
    if (!stride(p.id, p.pos, T.patronStride).step) continue;
    if (playingCount("patronStep") >= T.patronStepsAtOnce) continue;
    if (placement(p.pos, SOUNDS.patronStep).gain < 0.02) continue; // out of earshot
    play("patronStep", { ...p.pos });
  }
  for (const id of walkers.keys()) if (id !== "keeper" && !here.has(id)) walkers.delete(id);
}
