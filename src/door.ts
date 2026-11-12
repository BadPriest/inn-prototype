// The front door. It knows one thing: whether anyone is in the doorway.
// Someone in the doorway and the door is shut: it opens. The doorway clear for a moment: it closes.
// A group passing through keeps it open until the last of them is through, with no special case.
// It reports what it does as events; the sound (and anything else) just listens.

import { DOOR_TUNING as T } from "./data.js";
import type { Game } from "./game.js";
import { dist } from "./world.js";

function inDoorway(g: Game): number {
  const d = g.world.frontDoor;
  const c = { x: d.x + 0.5, y: d.y + 0.5 };
  return g.patrons.filter((p) => dist(p.pos, c) <= T.doorwayRadius).length;
}

/** Call every frame while the game is running. `now` is real time in ms. */
export function updateFrontDoor(g: Game, now: number): void {
  const door = g.frontDoor;
  const n = inDoorway(g);

  if (!door.open) {
    if (n > 0) {
      door.open = true;
      door.quick = n === 1; // one person on their own: a quicker open-and-shut
      door.openedAt = now;
      door.clearSince = null;
      g.bus.emit({ type: "FrontDoor", state: "opening", quick: door.quick });
    }
    return;
  }

  if (n > 0) {
    door.clearSince = null;
    if (n > 1) door.quick = false; // more people came through: it's a group now
    return;
  }

  door.clearSince ??= now;
  const hold = door.quick ? T.holdOpenQuickMs : T.holdOpenMs;
  if (now - door.clearSince >= T.settleMs && now - door.openedAt >= hold) {
    door.open = false;
    g.bus.emit({ type: "FrontDoor", state: "closing", quick: door.quick });
  }
}
