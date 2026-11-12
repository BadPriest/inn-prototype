// Canvas drawing. Basic shapes only: rectangles for furniture, circles for people.

import { RECIPES, ROOM_LABELS, TUNING } from "../data.js";
import type { Game, Patron } from "../game.js";
import type { Target } from "../interact.js";
import { iconFor } from "../serving.js";

export interface View { ts: number; ox: number; oy: number }

/** Fit the whole inn if it's big enough to read; otherwise zoom in and follow the keeper. */
export function computeView(canvas: HTMLCanvasElement, g: Game, minTile = 22): View {
  const fit = Math.floor(Math.min(canvas.width / g.world.w, canvas.height / g.world.h));
  const dpr = window.devicePixelRatio || 1;
  const min = Math.floor(minTile * dpr);
  if (fit >= min) {
    return { ts: fit, ox: Math.floor((canvas.width - fit * g.world.w) / 2), oy: Math.floor((canvas.height - fit * g.world.h) / 2) };
  }
  const ts = min;
  const mapW = ts * g.world.w, mapH = ts * g.world.h;
  const clampAxis = (want: number, map: number, view: number) => map <= view ? Math.floor((view - map) / 2) : Math.min(0, Math.max(view - map, want));
  const ox = clampAxis(Math.floor(canvas.width / 2 - g.keeper.pos.x * ts), mapW, canvas.width);
  const oy = clampAxis(Math.floor(canvas.height / 2 - g.keeper.pos.y * ts), mapH, canvas.height);
  return { ts, ox, oy };
}

const OUTCOME_COLOR: Record<string, string> = {
  DELIGHT: "#ffd34d",
  PLEASED: "#9be27a",
  FULFILLED: "#d8d8d8",
  UNFINISHED: "#e0a060",
  COMPLAINS: "#ff7a6a",
  LEAVING: "#ff5a5a",
};

export function draw(ctx: CanvasRenderingContext2D, g: Game, v: View, target: Target | null, clickDest: { x: number; y: number } | null): void {
  const { ts, ox, oy } = v;
  ctx.fillStyle = "#15110f";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const X = (x: number) => ox + x * ts;
  const Y = (y: number) => oy + y * ts;

  // Floors and walls
  for (const row of g.world.tiles) {
    for (const t of row) {
      ctx.fillStyle = t.def.floor;
      ctx.fillRect(X(t.x), Y(t.y), ts, ts);
      if (t.def.kind !== "wall") {
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.strokeRect(X(t.x) + 0.5, Y(t.y) + 0.5, ts - 1, ts - 1);
      }
    }
  }
  // Room labels
  ctx.font = `${Math.floor(ts * 0.5)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,240,220,0.18)";
  for (const r of ROOM_LABELS) ctx.fillText(r.text, X(r.x), Y(r.y));

  // Simple fixed shapes per tile kind
  for (const row of g.world.tiles) {
    for (const t of row) {
      const k = t.def.kind;
      const x = X(t.x), y = Y(t.y);
      if (k === "door") { ctx.fillStyle = "#4a3426"; ctx.fillRect(x + ts * 0.1, y + ts * 0.1, ts * 0.8, ts * 0.8); }
      if (k === "front") {
        ctx.fillStyle = g.open ? (g.lastCall ? "#c98a3a" : "#6fbf5f") : "#7a3a2a";
        if (g.frontDoor.open) {
          // Ajar: the door swung to one side, the doorway dark behind it
          ctx.fillStyle = "#1a1410";
          ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84);
          ctx.fillStyle = g.open ? (g.lastCall ? "#c98a3a" : "#6fbf5f") : "#7a3a2a";
          ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.22, ts * 0.84);
        } else ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84);
      }
      if (k === "counter") { ctx.fillStyle = "#5a3d28"; ctx.fillRect(x, y + ts * 0.1, ts, ts * 0.8); }
      if (k === "table") { ctx.fillStyle = "#6b4a30"; ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.84); }
      if (k === "chair") { ctx.fillStyle = "#4e3826"; ctx.fillRect(x + ts * 0.28, y + ts * 0.28, ts * 0.44, ts * 0.44); }
      if (k === "bench") { ctx.fillStyle = "#4e3826"; ctx.fillRect(x + ts * 0.12, y + ts * 0.12, ts * 0.76, ts * 0.76); }
      if (k === "stool") {
        ctx.fillStyle = "#4e3826";
        ctx.beginPath(); ctx.arc(x + ts / 2, y + ts / 2, ts * 0.22, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Snack bowls
  for (const [key, b] of g.bowls) {
    const [tx, ty] = key.split(",").map(Number);
    const cx = X(tx) + ts * 0.72, cy = Y(ty) + ts * 0.72;
    ctx.fillStyle = "#d9c9a8";
    ctx.beginPath(); ctx.arc(cx, cy, ts * 0.2, 0, Math.PI * 2); ctx.fill();
    if (b.left > 0) {
      ctx.fillStyle = b.snack === "olives" ? "#6b7a2a" : b.snack === "eggs" ? "#f1e3b0" : "#b0773a";
      ctx.beginPath(); ctx.arc(cx, cy, ts * 0.16 * Math.sqrt(b.left), 0, Math.PI * 2); ctx.fill();
    }
  }

  // Reserved tables: a little card on the table
  for (const [key] of g.reservations) {
    const [tx, ty] = key.split(",").map(Number);
    ctx.fillStyle = "#f3e6d0";
    ctx.fillRect(X(tx) + ts * 0.3, Y(ty) + ts * 0.3, ts * 0.4, ts * 0.32);
    ctx.fillStyle = "#7a3a2a";
    ctx.font = `bold ${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("R", X(tx) + ts * 0.5, Y(ty) + ts * 0.47);
  }

  // Mess: crumbs on tables, spills on the floor
  for (const [key, d] of g.dirt) {
    if (d <= 0.3) continue;
    const [ax, ay] = key.split(",").map(Number);
    const tf = g.world.furniture.find((ff) => ff.kind === "table" && ff.tiles[0].x === ax && ff.tiles[0].y === ay);
    for (const { x: tx, y: ty } of tf ? tf.tiles : [{ x: ax, y: ay }]) {
    const n = Math.min(7, Math.ceil(d * 2.5));
    ctx.fillStyle = d >= TUNING.tableDirtyAt ? "#d9c6a0" : "rgba(217,198,160,0.7)";
    for (let i = 0; i < n; i++) {
      const rx = ((i * 37 + tx * 13) % 10) / 10, ry = ((i * 53 + ty * 7) % 10) / 10;
      ctx.fillRect(X(tx) + ts * (0.18 + rx * 0.6), Y(ty) + ts * (0.18 + ry * 0.6), ts * 0.08, ts * 0.08);
    }
    if (d >= TUNING.tableDirtyAt) { ctx.strokeStyle = "rgba(255,200,120,0.5)"; ctx.strokeRect(X(tx) + 3, Y(ty) + 3, ts - 6, ts - 6); }
    }
  }
  for (const sp of g.spills) {
    ctx.fillStyle = "rgba(190,150,70,0.55)";
    ctx.beginPath(); ctx.ellipse(X(sp.x) + ts / 2, Y(sp.y) + ts / 2, ts * 0.32, ts * 0.2, 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Furniture pieces
  ctx.textBaseline = "middle";
  for (const f of g.world.furniture) {
    if (f.kind === "frontdoor") continue;
    const xs = f.tiles.map((t) => t.x), ys = f.tiles.map((t) => t.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
    const px = X(x0) + ts * 0.06, py = Y(y0) + ts * 0.06, pw = (x1 - x0) * ts - ts * 0.12, ph = (y1 - y0) * ts - ts * 0.12;
    let fill = "#3d2d22";
    if (f.kind === "station") fill = "#4f4a44";
    if (f.kind === "hatch") fill = "#6a5a3a";
    if (f.kind === "tap") fill = "#7a5530";
    if (f.kind === "piesafe") fill = "#7a5a46";
    if (f.kind === "bin") fill = "#3f4a3a";
    if (f.kind === "garnish") fill = "#6e7a3a";
    if (f.kind === "fireplace") fill = g.fireLit ? "#d2691e" : "#3a3330";
    if (f.kind === "bed") fill = "#8a5a5a";
    ctx.fillStyle = fill;
    ctx.fillRect(px, py, pw, ph);
    if (f.kind === "fireplace" && g.fireLit) {
      const glow = ctx.createRadialGradient(X(f.center.x), Y(f.center.y), ts * 0.3, X(f.center.x), Y(f.center.y), ts * 4);
      glow.addColorStop(0, "rgba(255,160,60,0.25)");
      glow.addColorStop(1, "rgba(255,160,60,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(X(f.center.x) - ts * 4, Y(f.center.y) - ts * 4, ts * 8, ts * 8);
    }
    const label = g.world.tile(x0, y0)?.def.label ?? "";
    ctx.fillStyle = "#f3e6d0";
    ctx.font = `${Math.floor(ts * 0.32)}px system-ui, sans-serif`;
    if (label) ctx.fillText(label, px + pw / 2, py + ph / 2);

    // Crafting progress
    const job = g.jobs.get(f.id);
    if (job) {
      const r = RECIPES.find((x) => x.id === job.recipeId)!;
      const pct = Math.min(1, job.progress / job.total);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(px, py + ph + 2, pw, ts * 0.18);
      ctx.fillStyle = job.done ? "#ffd34d" : r.tended ? "#ff9f43" : "#7fd37f";
      ctx.fillRect(px, py + ph + 2, pw * pct, ts * 0.18);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.floor(ts * 0.28)}px system-ui, sans-serif`;
      ctx.fillText(r.name, px + pw / 2, py + ph + ts * 0.45);
    }
    const pot = g.pots.get(f.id);
    if (pot) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(px, py + ph + 2, pw, ts * 0.18);
      ctx.fillStyle = "#e0b060";
      ctx.fillRect(px, py + ph + 2, pw * (pot.left / pot.total), ts * 0.18);
      badge(ctx, px + pw - 2, py + 2, String(pot.left), ts);
    }
    if (f.kind === "piesafe" && g.pieSafe.length) {
      badge(ctx, px + pw - 2, py + 2, String(g.pieSafe.reduce((a, p) => a + p.left, 0)), ts);
    }
    if (f.kind === "hatch" && g.hatch.length) {
      badge(ctx, px + pw - 2, py + 2, String(g.hatch.length), ts);
    }
  }

  // Target highlight
  if (target) {
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 2;
    if (target.type === "furniture") {
      for (const t of target.f.tiles) ctx.strokeRect(X(t.x) + 1, Y(t.y) + 1, ts - 2, ts - 2);
    } else {
      const c = target.type === "patron" ? target.p.pos : target.type === "tray" ? { x: target.t.x + 0.5, y: target.t.y + 0.5 } : { x: target.s.x + 0.5, y: target.s.y + 0.5 };
      ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), ts * 0.48, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // Trays set down on counters and tables
  for (const sd of g.setDown) {
    const x = X(sd.x) + ts * 0.15, y = Y(sd.y) + ts * 0.25;
    ctx.fillStyle = sd.tray.kind === "food" ? "#c9a46b" : "#8fb3c9";
    ctx.fillRect(x, y, ts * 0.7, ts * 0.5);
    ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, ts * 0.7, ts * 0.5); ctx.lineWidth = 1;
    ctx.fillStyle = "#2a1d14";
    sd.tray.items.forEach((_, j) => ctx.fillRect(x + ts * 0.06 + j * ts * 0.15, y + ts * 0.15, ts * 0.1, ts * 0.2));
  }

  if (clickDest) {
    ctx.fillStyle = "rgba(255,224,138,0.5)";
    ctx.beginPath(); ctx.arc(X(clickDest.x), Y(clickDest.y), ts * 0.12, 0, Math.PI * 2); ctx.fill();
  }

  // Patrons
  for (const p of g.patrons) drawPatron(ctx, g, p, X, Y, ts);

  // Keeper
  const k = g.keeper;
  ctx.fillStyle = "#f2e2c2";
  ctx.strokeStyle = "#2a1d14";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X(k.pos.x), Y(k.pos.y), ts * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = "#2a1d14";
  ctx.beginPath(); ctx.arc(X(k.pos.x + k.facing.x * 0.22), Y(k.pos.y + k.facing.y * 0.22), ts * 0.07, 0, Math.PI * 2); ctx.fill();
  // Trays: one per arm, showing what's on them
  k.trays.forEach((tray, i) => {
    const side = i === 0 ? -1 : 1;
    const n = Math.max(1, tray.items.length);
    const w = Math.max(ts * 0.4, n * ts * 0.32 + ts * 0.08);
    const tx = X(k.pos.x) + side * (ts * 0.4) + (side < 0 ? -w : 0), ty = Y(k.pos.y) + ts * 0.1;
    ctx.fillStyle = tray.kind ? (tray.kind === "food" ? "rgba(201,164,107,0.9)" : "rgba(143,179,201,0.9)") : "rgba(255,255,255,0.15)";
    ctx.fillRect(tx, ty, w, ts * 0.38);
    ctx.font = `${Math.floor(ts * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    tray.items.forEach((it, j) => ctx.fillText(iconFor(it.recipeId, it.garnish) || "🥣", tx + ts * 0.2 + j * ts * 0.32, ty + ts * 0.2));
  });

  if (g.keeperLine && g.minute < g.keeperLine.until) {
    ctx.font = `italic ${Math.floor(ts * 0.3)}px Georgia, serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffe08a"; ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.lineWidth = 3;
    const t = `“${g.keeperLine.text}”`;
    ctx.strokeText(t, X(k.pos.x), Y(k.pos.y) - ts * 0.62);
    ctx.fillText(t, X(k.pos.x), Y(k.pos.y) - ts * 0.62);
    ctx.lineWidth = 1;
  }

  const busy = g.cleaning ?? g.pouring;
  if (busy) {
    const pct = Math.min(1, busy.progress / busy.total);
    const bx = X(k.pos.x) - ts * 0.5, by = Y(k.pos.y) - ts * 0.75;
    ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(bx, by, ts, ts * 0.16);
    ctx.fillStyle = g.pouring ? "#e8b25a" : "#8fd3ff"; ctx.fillRect(bx, by, ts * pct, ts * 0.16);
  }

  // Paused overlay
  if (g.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.floor(ts * 1.2)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText("Paused", ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.font = `${Math.floor(ts * 0.5)}px system-ui, sans-serif`;
    ctx.fillText("Press P to resume", ctx.canvas.width / 2, ctx.canvas.height / 2 + ts);
  }
}

function drawPatron(ctx: CanvasRenderingContext2D, g: Game, p: Patron, X: (n: number) => number, Y: (n: number) => number, ts: number): void {
  const x = X(p.pos.x), y = Y(p.pos.y);
  ctx.fillStyle = p.color;
  ctx.globalAlpha = p.state === "leaving" ? 0.6 : 1;
  ctx.beginPath(); ctx.arc(x, y, ts * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f8f0e0";
  ctx.font = `${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(p.name, x, y + ts * 0.55);

  // What's in front of them: a dish or a drink, slowly going down
  if (p.consuming && p.state === "consuming") {
    const cx = x + ts * 0.42, cy = y - ts * 0.05;
    const total = Math.max(1, p.consumeUntil - p.consuming.from);
    const left = Math.max(0, Math.min(1, (p.consumeUntil - g.minute) / total));
    ctx.fillStyle = "rgba(255,248,235,0.92)";
    ctx.beginPath(); ctx.arc(cx, cy, ts * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.consuming.kind === "drink" ? "#5b8fc9" : "#c98a3a";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, ts * 0.22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.font = `${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.consuming.icon, cx, cy + 1);
  }
  let lineY = y - ts * 0.58;
  // Order bubble
  const o = g.order(p.orderId);
  if (o?.open && p.state === "waiting") {
    const waited = g.minute - p.waitedSince;
    const urgency = Math.min(1, waited / p.patience);
    const text = `${iconFor(o.recipeId, o.wantGarnish)} ${o.label}`;
    ctx.font = `${Math.floor(ts * 0.3)}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + ts * 0.3;
    ctx.fillStyle = `rgb(255,${Math.floor(250 - urgency * 120)},${Math.floor(235 - urgency * 160)})`;
    roundRect(ctx, x - w / 2, lineY - ts * 0.22, w, ts * 0.42, ts * 0.12);
    ctx.fill();
    ctx.fillStyle = "#2a1d14";
    ctx.fillText(text, x, lineY);
    lineY -= ts * 0.5;
  }
  // Outcome marker (debug-visible state)
  if (p.marker && g.minute < p.marker.until) {
    ctx.font = `bold ${Math.floor(ts * 0.3)}px system-ui, sans-serif`;
    ctx.fillStyle = OUTCOME_COLOR[p.marker.text] ?? "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(p.marker.text, x, lineY);
    ctx.fillText(p.marker.text, x, lineY);
    ctx.lineWidth = 1;
    lineY -= ts * 0.4;
  }
  // Spoken line
  if (p.line && g.minute < p.line.until && p.line.text) {
    ctx.font = `italic ${Math.floor(ts * 0.28)}px Georgia, serif`;
    ctx.fillStyle = "#fff6e0";
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 3;
    ctx.strokeText(`“${p.line.text}”`, x, lineY);
    ctx.fillText(`“${p.line.text}”`, x, lineY);
    ctx.lineWidth = 1;
  }
}

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, ts: number): void {
  ctx.fillStyle = "#ffd34d";
  ctx.beginPath(); ctx.arc(x, y, ts * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a1d14";
  ctx.font = `bold ${Math.floor(ts * 0.26)}px system-ui, sans-serif`;
  ctx.fillText(text, x, y + 1);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
