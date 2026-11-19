// A level up: a golden wave rises from the keeper's feet, then a banner says so.

import type { Game } from "../game.js";
import { P } from "./proj.js";
import type { View } from "./render.js";

const WAVE_SECONDS = 1.5;
const BANNER_AFTER_MS = 900;
const BANNER_MS = 3400;

let waveAt = -Infinity;

export function initLevelUp(g: Game): void {
  g.bus.on((e) => {
    if (e.type !== "LevelUp") return;
    waveAt = performance.now();
    setTimeout(() => showBanner(e.level), BANNER_AFTER_MS);
  });
}

function showBanner(level: number): void {
  document.querySelector(".levelup")?.remove();
  const el = document.createElement("div");
  el.className = "levelup";
  el.innerHTML = `<div class="lu-ribbon"><div class="lu-title">Level Up!</div><div class="lu-sub">Level ${level} · new skills at the desk</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("out"), BANNER_MS);
  setTimeout(() => el.remove(), BANNER_MS + 700);
}

/** Seeded so each spark keeps its path from frame to frame. */
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function drawLevelUp(ctx: CanvasRenderingContext2D, g: Game, v: View): void {
  const t = (performance.now() - waveAt) / 1000;
  if (t < 0 || t > WAVE_SECONDS + 0.6) return;
  const k = g.keeper, ts = v.ts;
  const squash = v.iso ? 0.5 : 1;
  const foot = P(v, k.pos.x, k.pos.y, 0);
  const rise = Math.min(1, t / WAVE_SECONDS);
  const ease = 1 - (1 - rise) ** 3;
  const fade = t > WAVE_SECONDS ? 1 - (t - WAVE_SECONDS) / 0.6 : 1;
  const height = ts * 1.6;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // The ring spreading out from the feet.
  const r = ts * (0.3 + 1.3 * ease);
  ctx.strokeStyle = `rgba(255,205,80,${0.7 * (1 - ease) * fade})`;
  ctx.lineWidth = ts * 0.08;
  ctx.beginPath(); ctx.ellipse(foot.x, foot.y, r, r * squash, 0, 0, Math.PI * 2); ctx.stroke();
  // The column of light, its top edge climbing from the feet to above the head.
  const topY = foot.y - height * ease;
  const w = ts * 0.55;
  const grad = ctx.createLinearGradient(0, foot.y, 0, topY);
  grad.addColorStop(0, `rgba(255,200,70,${0.05 * fade})`);
  grad.addColorStop(0.75, `rgba(255,215,100,${0.35 * fade})`);
  grad.addColorStop(1, `rgba(255,240,170,${0.6 * fade})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y, w, w * squash, 0, 0, Math.PI);
  ctx.lineTo(foot.x - w, topY);
  ctx.ellipse(foot.x, topY, w, w * squash * 0.6, 0, Math.PI, Math.PI * 2);
  ctx.closePath(); ctx.fill();
  // The bright band at the wave's front.
  ctx.fillStyle = `rgba(255,236,150,${0.75 * fade})`;
  ctx.shadowColor = "rgba(255,210,80,0.9)"; ctx.shadowBlur = ts * 0.4;
  ctx.beginPath(); ctx.ellipse(foot.x, topY, w * 1.05, w * squash * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // Sparks carried up with it.
  for (let i = 0; i < 18; i++) {
    const delay = rnd(i) * 0.6;
    const p = (t - delay) / 1.1;
    if (p < 0 || p > 1) continue;
    const a = rnd(i + 50) * Math.PI * 2;
    const sx = foot.x + Math.cos(a) * w * (0.4 + 0.8 * p);
    const sy = foot.y + Math.sin(a) * w * squash * 0.6 - height * 1.15 * p;
    ctx.fillStyle = `rgba(255,${220 + Math.floor(rnd(i + 9) * 35)},140,${(1 - p) * fade})`;
    ctx.beginPath(); ctx.arc(sx, sy, ts * (0.025 + 0.03 * rnd(i + 3)), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
