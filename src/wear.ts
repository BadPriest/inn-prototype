import { ECONOMY_DATA } from "./gamedata.gen.js";
import type { Game } from "./game.js";
import { knack } from "./skills.js";

const W = ECONOMY_DATA.wear;

/** The share of today's takings and tips that wear will take. */
export function wearShare(g: Game): number {
  return Math.min(W.maxShare, (g.stats.messy ?? 0) * W.sharePerMessyGuest) * knack(g, "keenEye", 1);
}

function split(total: number, messy: number): { text: string; pence: number }[] {
  const pool = [...W.mishaps];
  const n = Math.max(1, Math.min(messy, W.mostMishaps, pool.length, total));
  const weights = Array.from({ length: n }, () => 0.5 + Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  const pence = weights.map((w) => Math.max(1, Math.floor((total * w) / sum)));
  pence[0] += total - pence.reduce((a, b) => a + b, 0);
  return pence.sort((a, b) => b - a).map((p) => ({ text: pool.splice(Math.floor(Math.random() * pool.length), 1)[0], pence: p }));
}

/** Turning in: pay for the day's mishaps. */
export function chargeWear(g: Game): void {
  const s = g.stats;
  const earned = (s.taken ?? 0) + (s.tips ?? 0);
  const pence = Math.min(Math.floor(earned * wearShare(g)), Math.max(0, Math.floor(g.purse)));
  if (pence < 1) return;
  g.purse -= pence;
  s.wear = pence;
  s.mishaps = split(pence, s.messy ?? 0);
}
