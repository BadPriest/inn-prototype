// Where a point of the inn lands on screen, for either view: straight down (a tile is `ts` pixels square)
// or isometric (a tile is a diamond, twice as wide as it is tall; height lifts things up the screen).
// The game itself only knows tiles; only drawing and clicking go through here.

import type { Vec } from "../world.js";
import type { View } from "./render.js";

/** Isometric proportions, in units of `ts`: half a diamond's width, half its height, and a tile of height. */
export const ISO = { a: 0.75, b: 0.375, z: 0.8 };

/** A point in tiles (z: height in tiles) to canvas pixels. */
export function P(v: View, x: number, y: number, z = 0): Vec {
  if (!v.iso) return { x: v.ox + x * v.ts, y: v.oy + y * v.ts };
  return { x: v.ox + (x - y) * ISO.a * v.ts, y: v.oy + (x + y) * ISO.b * v.ts - z * ISO.z * v.ts };
}

/** Canvas pixels to a point on the floor, in tiles. */
export function unproject(v: View, sx: number, sy: number): Vec {
  if (!v.iso) return { x: (sx - v.ox) / v.ts, y: (sy - v.oy) / v.ts };
  const u = (sx - v.ox) / (ISO.a * v.ts), w = (sy - v.oy) / (ISO.b * v.ts);
  return { x: (u + w) / 2, y: (w - u) / 2 };
}

/** Trace the floor area x..x+w, y..y+h (inset by `inset` tiles), at height z: a rectangle, or a diamond-ish shape. */
export function floorPath(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, w: number, h: number, inset = 0, z = 0): void {
  const pts = [P(v, x + inset, y + inset, z), P(v, x + w - inset, y + inset, z), P(v, x + w - inset, y + h - inset, z), P(v, x + inset, y + h - inset, z)];
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath();
}
