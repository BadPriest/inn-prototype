// Wiring: input, the main loop, and the order systems run in.

import { TUNING } from "./data.js";
import { Game } from "./game.js";
import { dist, type Vec } from "./world.js";
import { simDelta, updateClock, load, beginDay } from "./day.js";
import { updateCrafting } from "./crafting.js";
import { updatePatrons } from "./patrons.js";
import { updateFrontDoor } from "./door.js";
import { updatePour } from "./serving.js";
import { watchObjectives } from "./objectives.js";
import { askSetDown, offerUnasked, cleanable, cleanStep, findTarget, forcedTurnIn, interact, openGarnishMenu, openJournal, promptFor, targetId, type Target } from "./interact.js";
import { draw, computeView, type View } from "./ui/render.js";
import { updateHud, initDebug, toggleDebug } from "./ui/hud.js";
import { back, initMenus, menuKey, menuOpen } from "./ui/menu.js";
import { initSound, isMuted, soundscape, toggleMute, unlockAudio } from "./sound.js";
import { BUILD } from "./version.js";
import { openMenu, closeAll, replaceMenu } from "./ui/menu.js";

const g = new Game();
load(g);
beginDay(g);
(window as unknown as { game: Game }).game = g; // handy from the browser console

const canvas = document.getElementById("view") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let view: View = { ts: 24, ox: 0, oy: 0 };
let target: Target | null = null;
let clickDest: Vec | null = null;

initMenus(document.getElementById("menu")!, (modal) => { g.modal = modal; });
initDebug(g);
initSound(g);
const wm = document.getElementById("watermark");
if (wm) wm.textContent = `Travelling Inn · lofi prototype · ${BUILD}`;
window.addEventListener("pointerdown", unlockAudio);

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
// Input

const keys = new Set<string>();

window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
  unlockAudio();
  if (e.key === " " || e.key.startsWith("Arrow") || e.key === "Backspace") e.preventDefault();
  if (menuOpen()) {
    if (g.paused && (e.key === "p" || e.key === "P" || e.key === "Escape") && !e.repeat) { resume(); return; }
    if (!e.repeat || e.key.startsWith("Arrow")) menuKey(e);
    return;
  }
  if (g.modal) return; // fading to sleep
  const k = e.key.toLowerCase();
  keys.add(k);
  if (e.repeat) return;
  switch (k) {
    case " ":
      g.holdingSpace = true;
      if (!g.paused) interact(g, target);
      break;
    case "e":
      if (target?.type === "furniture" && target.f.kind === "garnish") openGarnishMenu(g);
      break;
    case "q":
      askSetDown(g);
      break;
    case "c":
      offerUnasked(g, target);
      break;
    case "o":
      g.showObjectives = !g.showObjectives;
      break;
    case "j":
      openJournal(g);
      break;
    case "m":
      g.say(toggleMute() ? "Sound off." : "Sound on.");
      break;
    case "p": case "escape":
      openPause();
      break;
    case "-": case "_":
      g.speedIndex = Math.max(0, g.speedIndex - 1); break;
    case "=": case "+":
      g.speedIndex = Math.min(TUNING.speeds.length - 1, g.speedIndex + 1); break;
    case "`": case "f2":
      toggleDebug(); e.preventDefault(); break;
  }
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  keys.delete(k);
  if (k === " ") g.holdingSpace = false;
});
window.addEventListener("blur", () => { keys.clear(); g.holdingSpace = false; });

function toTile(e: { clientX: number; clientY: number }): Vec {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return { x: ((e.clientX - r.left) * dpr - view.ox) / view.ts, y: ((e.clientY - r.top) * dpr - view.oy) / view.ts };
}

let lastWalk = 0;
function walkToPoint(p: Vec): void {
  const now = performance.now();
  g.keeper.running = now - lastWalk < 320; // double tap / double right-click runs
  lastWalk = now;
  walkTo({ x: Math.floor(p.x), y: Math.floor(p.y) }, null);
}

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (menuOpen() || g.paused) return;
  walkToPoint(toTile(e));
});

// Double-click (or double tap) on something: run there instead of walking.
let lastClickAt = 0;
let lastClickTile = "";

/** Left-click or tap on something: interact if close, otherwise walk over and then interact. */
function clickAt(p: Vec): boolean {
  const now = performance.now();
  const tileKey = `${Math.floor(p.x)},${Math.floor(p.y)}`;
  const dbl = now - lastClickAt < 350 && tileKey === lastClickTile;
  lastClickAt = now;
  lastClickTile = tileKey;
  const go = (tile: Vec, id: string) => { walkTo(tile, id); g.keeper.running = dbl; };
  // A second click right after the first shouldn't use the thing twice (two ales from one double-click).
  const use = (t: Target) => { if (!dbl) interact(g, t); };
  const patron = g.patrons.find((q) => dist(q.pos, p) < 0.55 && q.state !== "leaving" && q.state !== "entering");
  if (patron) {
    const t: Target = { type: "patron", p: patron };
    if (dist(g.keeper.pos, patron.pos) <= 2.3) { use(t); return true; }
    const spot = nearestReachable(patron.pos, 2.0);
    if (spot) go(spot, `patron:${patron.id}`);
    return true;
  }
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  const sd = g.setDown.find((s) => s.x === tx && s.y === ty);
  if (sd) {
    if (dist(g.keeper.pos, { x: tx + 0.5, y: ty + 0.5 }) <= 1.5) { use({ type: "tray", t: sd }); return true; }
    const spot = nearestReachable({ x: tx + 0.5, y: ty + 0.5 }, 1.4);
    if (spot) go(spot, `tray:${sd.id}`);
    return true;
  }
  const sp = g.spills.find((s) => s.x === tx && s.y === ty);
  if (sp) {
    if (dist(g.keeper.pos, { x: tx + 0.5, y: ty + 0.5 }) > 1.1) walkTo({ x: tx, y: ty }, null);
    return true;
  }
  const f = g.world.furniture.find((ff) => ff.tiles.some((t) => t.x === tx && t.y === ty));
  if (f) {
    const near = f.tiles.some((t) => dist(g.keeper.pos, { x: t.x + 0.5, y: t.y + 0.5 }) <= 1.45);
    if (near) {
      faceTowards({ x: tx + 0.5, y: ty + 0.5 });
      use({ type: "furniture", f });
      return true;
    }
    const spots = g.world.approachTiles(f).sort((a, b) => dist(a, g.keeper.pos) - dist(b, g.keeper.pos));
    for (const s of spots) {
      if (g.world.path(g.keeper.pos, s, "keeper")) { go(s, f.id); return true; }
    }
    return true;
  }
  return false;
}

function faceTowards(p: Vec): void {
  const k = g.keeper;
  const d = dist(p, k.pos) || 1;
  k.facing = { x: (p.x - k.pos.x) / d, y: (p.y - k.pos.y) / d };
}

// One handler for mouse, touch and pen.
let touchHolding = false;
canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  if (menuOpen() || g.paused) return;
  if (e.pointerType === "mouse") {
    if (e.button === 0) clickAt(toTile(e));
    return;
  }
  // Touch: tap a thing to use it, tap the floor to walk, double tap to run.
  e.preventDefault();
  document.getElementById("touchhint")?.remove(); // the hint goes once you've got the idea
  const p = toTile(e);
  const near = dist(g.keeper.pos, p) <= 1.6;
  if (near) faceTowards(p);
  const handled = clickAt(p);
  if (!handled) walkToPoint(p);
  // Holding a finger on something close by works like holding Space (hurry cooking, clean).
  if (near) { touchHolding = true; g.holdingSpace = true; }
});
const endTouch = () => { if (touchHolding) { touchHolding = false; g.holdingSpace = false; } };
canvas.addEventListener("pointerup", endTouch);
canvas.addEventListener("pointercancel", endTouch);
canvas.addEventListener("pointerleave", endTouch);

// On-screen buttons (shown on touch screens; they work with a mouse too).
function bindButton(id: string, fn: () => void): void {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", (e) => { e.preventDefault(); unlockAudio(); fn(); });
}
bindButton("tb-pause", () => { if (g.paused) resume(); else if (!menuOpen()) openPause(); });
bindButton("tb-slower", () => { g.speedIndex = Math.max(0, g.speedIndex - 1); });
bindButton("tb-faster", () => { g.speedIndex = Math.min(TUNING.speeds.length - 1, g.speedIndex + 1); });
bindButton("tb-objectives", () => { g.showObjectives = !g.showObjectives; document.body.classList.add("panel-open"); });
bindButton("tb-card", () => { if (!menuOpen()) offerUnasked(g, target); });
bindButton("card", () => { if (!menuOpen()) offerUnasked(g, target); });
bindButton("tb-setdown", () => { if (!menuOpen()) askSetDown(g); });
bindButton("tb-journal", () => { if (!menuOpen()) openJournal(g); });
bindButton("tb-sound", () => g.say(toggleMute() ? "Sound off." : "Sound on."));
bindButton("tb-debug", () => toggleDebug());
bindButton("tb-panel", () => document.body.classList.toggle("panel-open"));

function nearestReachable(pos: Vec, range: number): Vec | null {
  const cands: Vec[] = [];
  for (let y = Math.floor(pos.y - range); y <= Math.ceil(pos.y + range); y++) {
    for (let x = Math.floor(pos.x - range); x <= Math.ceil(pos.x + range); x++) {
      const t = g.world.tile(x, y);
      if (t?.keeperWalk && dist({ x: x + 0.5, y: y + 0.5 }, pos) <= range && dist({ x: x + 0.5, y: y + 0.5 }, pos) > 0.6) cands.push({ x, y });
    }
  }
  cands.sort((a, b) => dist(a, g.keeper.pos) - dist(b, g.keeper.pos));
  return cands.find((c) => g.world.path(g.keeper.pos, c, "keeper")) ?? null;
}

function walkTo(tile: Vec, interactWith: string | null): void {
  const path = g.world.path(g.keeper.pos, tile, "keeper");
  if (!path) return;
  g.keeper.path = path;
  g.keeper.pendingInteract = interactWith;
  clickDest = { x: tile.x + 0.5, y: tile.y + 0.5 };
}

// ---------------------------------------------------------------------------
// Keeper movement (real time: mood and speed settings never touch the player's hands)

const R = 0.3;
function walkable(x: number, y: number): boolean {
  for (const [cx, cy] of [[x - R, y - R], [x + R, y - R], [x - R, y + R], [x + R, y + R]]) {
    if (!g.world.tile(Math.floor(cx), Math.floor(cy))?.keeperWalk) return false;
  }
  return true;
}

function moveKeeper(dt: number): void {
  const k = g.keeper;
  if (menuOpen() || g.paused || g.modal) return;
  let dx = 0, dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  const run = keys.has("shift");
  if (dx || dy) {
    k.path = [];
    k.pendingInteract = null;
    clickDest = null;
    const len = Math.hypot(dx, dy);
    const sp = (run ? TUNING.keeperRun : TUNING.keeperWalk) * dt;
    const nx = k.pos.x + (dx / len) * sp, ny = k.pos.y + (dy / len) * sp;
    if (walkable(nx, k.pos.y)) k.pos.x = nx;
    if (walkable(k.pos.x, ny)) k.pos.y = ny;
    k.facing = { x: dx / len, y: dy / len };
    return;
  }
  if (k.path.length) {
    let step = (k.running ? TUNING.keeperRun : TUNING.keeperWalk) * dt;
    while (step > 0 && k.path.length) {
      const t = k.path[0];
      const ddx = t.x - k.pos.x, ddy = t.y - k.pos.y;
      const d = Math.hypot(ddx, ddy);
      if (d > 0.001) k.facing = { x: ddx / d, y: ddy / d };
      if (d <= step) { k.pos = { ...t }; k.path.shift(); step -= d; }
      else { k.pos.x += (ddx / d) * step; k.pos.y += (ddy / d) * step; step = 0; }
    }
    if (!k.path.length) {
      clickDest = null;
      k.running = false;
      if (k.pendingInteract) {
        const id = k.pendingInteract;
        k.pendingInteract = null;
        const t = resolveTarget(id);
        if (t) {
          const tp = t.type === "patron" ? t.p.pos : t.type === "furniture" ? t.f.center : t.type === "tray" ? { x: t.t.x + 0.5, y: t.t.y + 0.5 } : { x: t.s.x + 0.5, y: t.s.y + 0.5 };
          const d = dist(tp, k.pos) || 1;
          k.facing = { x: (tp.x - k.pos.x) / d, y: (tp.y - k.pos.y) / d };
          interact(g, t);
        }
      }
    }
  }
}

function resolveTarget(id: string): Target | null {
  if (id.startsWith("tray:")) {
    const t = g.setDown.find((x) => x.id === Number(id.slice(5)));
    return t ? { type: "tray", t } : null;
  }
  if (id.startsWith("patron:")) {
    const p = g.patron(Number(id.slice(7)));
    return p ? { type: "patron", p } : null;
  }
  const f = g.world.furniture.find((x) => x.id === id);
  return f ? { type: "furniture", f } : null;
}

// ---------------------------------------------------------------------------
// Main loop

// Watchdog: anything that leaves the trays without a known reason gets reported in the log.
let carried = new Map<number, string>();
function watchTrays(): void {
  const now = new Map<number, string>();
  for (const t of [...g.keeper.trays, ...g.setDown.map((s) => s.tray)]) for (const i of t.items) now.set(i.id, i.name);
  for (const [id, name] of carried) {
    if (!now.has(id) && !g.accountedFor.has(id)) {
      g.say(`⚠ Bug: ${name} vanished from your trays. Please send Claude the lines just above this one.`);
      console.warn("Item vanished", id, name, JSON.parse(JSON.stringify(g.keeper.trays)));
    }
  }
  g.accountedFor.clear();
  carried = now;
}

// ---------------------------------------------------------------------------
// Settings (kept in this browser): UI size for big screens.

const SETTINGS_KEY = "travelling-inn-settings";
type UiChoice = "auto" | number;
let uiChoice: UiChoice = "auto";
try { uiChoice = (JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { ui?: UiChoice }).ui ?? "auto"; } catch { /* defaults */ }
const UI_STEPS: UiChoice[] = ["auto", 1, 1.25, 1.5, 1.75, 2, 2.5];

function autoUi(): number {
  // 1 on laptops and phones, larger on big high-resolution screens (a 4K screen at 100% gets about 2).
  return Math.max(1, Math.min(2.5, Math.round((window.innerWidth / 1700) * 4) / 4));
}
function applyUi(): void {
  const s = uiChoice === "auto" ? autoUi() : uiChoice;
  document.documentElement.style.setProperty("--ui", String(s));
  requestAnimationFrame(resize);
}
function uiLabel(): string {
  return uiChoice === "auto" ? `Auto (${Math.round(autoUi() * 100)}%)` : `${Math.round(uiChoice * 100)}%`;
}
applyUi();
window.addEventListener("resize", () => { if (uiChoice === "auto") applyUi(); });

function resume(): void {
  closeAll();
  g.paused = false;
  g.bus.emit({ type: "Resumed" });
}

function openPause(): void {
  g.paused = true;
  g.bus.emit({ type: "Paused" });
  const build = () => ({
    title: "Paused",
    modal: true,
    items: [
      { label: "▶ Resume", sub: "P", action: () => resume() },
      { label: "🔍 UI size", sub: uiLabel(), action: () => {
        uiChoice = UI_STEPS[(UI_STEPS.indexOf(uiChoice) + 1) % UI_STEPS.length];
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ui: uiChoice })); } catch { /* fine */ }
        applyUi();
        replaceMenu(build());
      } },
      { label: "🔊 Sound", sub: isMuted() ? "off" : "on", action: () => { toggleMute(); replaceMenu(build()); } },
      { label: "✅ Objectives", sub: g.showObjectives ? "shown" : "hidden", action: () => { g.showObjectives = !g.showObjectives; replaceMenu(build()); } },
      { label: "❔ How to play", sub: "", action: () => openMenu({ title: "How to play", body: welcomeBody(), items: [{ label: "Back", action: () => back() }] }) },
    ],
  });
  openMenu(build());
}

// A welcome before anything moves. The clock starts when the player presses Start.
const touch = window.matchMedia("(pointer: coarse)").matches;
const controls = touch
  ? `<b>Tap</b> the floor to walk, <b>double tap</b> to run. <b>Tap</b> things and people to use them. <b>Keep your finger</b> on a pot or a mess to hurry or clean. The buttons on the side do the rest.`
  : `<b>WASD</b> to walk (<b>Shift</b> runs), or <b>right-click</b> to walk somewhere. <b>Space</b> or <b>left-click</b> uses things; <b>double-click</b> runs there. Hold <b>Space</b> to hurry cooking or to clean. <b>P</b> pauses.`;
function welcomeBody(): string {
  return `<div class="welcome">
    <p>You're the keeper. Each day you wake at 6, get the inn ready, open the door, and look after whoever comes in.</p>
    <p><b>Guests order</b> food at tables and drinks at the counter. Cook in the kitchen, pick dishes up from the hatch, pour at the taps, and carry them over on your two trays.</p>
    <p><b>Everyone has hidden tastes.</b> Which ingredients you choose decides how a dish lands. Watch how people react, and read your <b>journal</b> at the desk: regulars reward getting to know them.</p>
    <p><b>Nothing burns, nothing is ruined,</b> and there's no rush. The checklist on the side ("Today") shows where to start.</p>
    <p class="muted">${controls}</p>
  </div>`;
}
openMenu({
  title: g.day > 1 ? `Welcome back: day ${g.day}` : "Welcome to the Travelling Inn",
  modal: true,
  body: welcomeBody(),
  items: [{ label: g.day > 1 ? "Continue" : "Start game", action: () => { closeAll(); unlockAudio(); } }],
});

let last = performance.now();
let hudTimer = 0;
function frame(now: number): void {
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;

  moveKeeper(realDt);
  target = findTarget(g);
  // Cleaning is a hold: progress while Space is held on something dirty.
  if (g.holdingSpace && !g.paused && !g.modal && !menuOpen() && cleanable(g, target)) cleanStep(g, target!, realDt);
  else if (g.cleaning && (!g.holdingSpace || targetId(target) !== g.cleaning.targetId)) g.cleaning = null;
  if (!g.paused) updatePour(g, realDt);
  const sim = simDelta(g, realDt);
  if (sim > 0) {
    updateCrafting(g, sim, target?.type === "furniture" ? target.f : null);
    updatePatrons(g, sim);
    updateFrontDoor(g, now);
    updateClock(g, sim, () => forcedTurnIn(g));
  }

  watchTrays();
  watchObjectives(g);
  soundscape(g, realDt);
  view = computeView(canvas, g);
  draw(ctx, g, view, target, clickDest);
  hudTimer -= realDt;
  if (hudTimer <= 0) {
    hudTimer = 0.15;
    updateHud(g, promptFor(g, target));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
