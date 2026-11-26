// Needs: hunger, thirst and warmth as real values. Groundwork for mood.
//
// Measured, not faked: orders grow from them (patrons.ts), nothing else reacts yet. Every stretch a
// patron spends with a need unmet is logged, with its length and what was going on meanwhile, so the
// logs tell us what mood must react to. Shown in the debug view.

import { bowlNeeds } from "./snacks.js";
import { organic } from "./core.js";
import { orderable } from "./readymade.js";
import { NEED_IDS, NEEDS, RECIPES, SNACKS, SOAKING, WEATHER, type NeedId, type NeedLevels } from "./data.js";
import type { Game, Patron, UnmetStretch } from "./game.js";
import { dist } from "./world.js";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** How hungry, thirsty and cold someone walks in. Weather will shift these on arrival, later. */
export function arrivalNeeds(levels: NeedLevels): Record<NeedId, number> {
  return {
    hunger: clamp01(organic(levels.hunger)),
    thirst: clamp01(organic(levels.thirst)),
    warmth: clamp01(organic(levels.warmth)),
  };
}

function firePos(g: Game) {
  return g.world.furniture.find((f) => f.kind === "fireplace")?.center;
}

/** 1 at the hearth, fading to 0 at the edge of the fire's reach. 0 when the fire is out. */
function fireWarmth(g: Game, p: Patron): number {
  const at = firePos(g);
  if (!g.fireLit || !at) return 0;
  return clamp01(1 - dist(p.pos, at) / NEEDS.fire.radius);
}

/** What's going on for this patron that bears on this need, right now. */
function circumstances(g: Game, p: Patron, need: NeedId): string[] {
  const out: string[] = [];
  const seat = g.world.seats.find((s) => s.id === p.seatId);
  if (p.state === "queued") out.push("waiting for a table");
  if (need === "warmth") {
    const at = firePos(g);
    if (!g.fireLit) out.push("fire out");
    else if (at && dist(p.pos, at) > NEEDS.fire.radius) out.push("far from the fire");
    if (p.soaked > 0.2) out.push("soaked");
    return out;
  }
  const kind = need === "hunger" ? "food" : "drink";
  const o = g.order(p.orderId);
  const ordered = o?.open ? RECIPES.find((r) => r.id === o.recipeId) : undefined;
  if (ordered?.kind === kind) out.push(`waiting on ${kind}`);
  else if (ordered) out.push(`ordered ${ordered.kind} instead`);
  else if (p.state === "seated" && !p.lingering) out.push("not ordered yet");
  if (p.lingering) out.push("waiting for their party");
  if (p.state === "consuming" && p.consuming?.kind === kind) out.push(`has ${kind}`);
  if (kind === "food" && seat?.kind === "stool") out.push("on a stool (drinks only)");
  const can = orderable(g);
  if (!RECIPES.some((r) => r.kind === kind && can.has(r.id))) out.push(`no ${kind} on the bill of fare or on display`);
  if (!g.open || g.lastCall) out.push("last call");
  return out;
}

function typeOf(p: Patron): string {
  return p.regularId ? `regular:${p.regularId}` : p.archetype?.id ?? "?";
}

function closeStretch(g: Game, p: Patron, need: NeedId, ended: UnmetStretch["ended"]): void {
  const s = p.unmet[need];
  if (!s) return;
  delete p.unmet[need];
  const log = (g.stats.unmet ??= []);
  if (log.length >= NEEDS.logCap) return;
  log.push({
    who: p.name, type: typeOf(p), need, from: g.clockText(s.since),
    minutes: Math.round(g.minute - s.since), peak: Math.round(s.peak * 100) / 100, ended, while: [...s.while],
  });
}

/** They're going (or the day is ending): whatever was still unmet is logged as it stands. */
export function closeAllStretches(g: Game, p: Patron, ended: UnmetStretch["ended"]): void {
  for (const need of NEED_IDS) closeStretch(g, p, need, ended);
}

export function updateNeeds(g: Game, simDt: number): void {
  const hours = simDt / 60;
  for (const p of g.patrons) {
    if (p.state === "leaving") continue;
    const n = p.needs;
    // Slow drift.
    for (const need of NEED_IDS) n[need] += NEEDS.risePerHour[need] * hours;
    const atFire = fireWarmth(g, p);
    n.warmth -= (NEEDS.indoorWarmthPerHour + NEEDS.fire.warmthPerHour * atFire) * hours;
    // Wet through: they dry off (fast by the fire), and until then the wet keeps them cold.
    if (p.soaked > 0) {
      n.warmth += SOAKING.chillPerHour * p.soaked * hours;
      p.soaked = clamp01(p.soaked - (SOAKING.dryPerHour + SOAKING.fireDryPerHour * atFire) * hours);
    }
    // Snow on them melts, faster by the fire, and the melt soaks them.
    if (p.snowy > 0) {
      const melt = Math.min(p.snowy, (WEATHER.snow.meltPerHour + SOAKING.fireDryPerHour * atFire) * hours);
      p.snowy -= melt;
      p.soaked = clamp01(p.soaked + melt * WEATHER.snow.meltWets);
    }
    // A salty snack bowl on the table.
    const seat = g.world.seats.find((s) => s.id === p.seatId);
    const bowlKey = g.bowlKeyFor(seat);
    const bowl = bowlKey ? g.bowls.get(bowlKey) : undefined;
    if (bowl && bowl.left > 0) { const bn = bowlNeeds(g, p); n.thirst += bn.thirst * hours; n.hunger += bn.hunger * hours; }
    // Eating or drinking: the serving's worth, spread over the time it takes.
    if (p.state === "consuming" && p.consuming) {
      const span = Math.max(1, p.consumeUntil - p.consuming.from);
      const share = simDt / span;
      const eases = p.consuming.needs ?? NEEDS.serving[p.consuming.kind];
      for (const need of NEED_IDS) n[need] -= eases[need] * share;
      if (!p.consuming.needs && p.consuming.tags?.includes("warm")) n.warmth -= NEEDS.warmTag * share;
    }
    for (const need of NEED_IDS) n[need] = clamp01(n[need]);

    // Unmet stretches.
    for (const need of NEED_IDS) {
      const s = p.unmet[need];
      if (!s && n[need] > NEEDS.unmetAt) {
        p.unmet[need] = { since: g.minute, peak: n[need], while: new Set(circumstances(g, p, need)) };
      } else if (s) {
        if (n[need] < NEEDS.metAt) { closeStretch(g, p, need, "met"); continue; }
        s.peak = Math.max(s.peak, n[need]);
        for (const c of circumstances(g, p, need)) s.while.add(c);
      }
    }
  }
}

/** Today's unmet stretches, plus earlier days, as tab-separated text for pasting into a sheet. */
export function unmetLogText(g: Game): string {
  const head = "day\twho\ttype\tneed\tfrom\tminutes\tpeak\tended\twhile";
  const rows = [...g.history, g.stats].flatMap((d) => (d.unmet ?? []).map((u) =>
    [d.day, u.who, u.type, u.need, u.from, u.minutes, u.peak, u.ended, u.while.join("; ")].join("\t")));
  return [head, ...rows].join("\n");
}
