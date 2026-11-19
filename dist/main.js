// Wiring: input, the main loop, and the order systems run in.
import { TUNING } from "./data.js";
import { openInnPicker, openLocationPicker } from "./ui/location.js";
import { buildRooms } from "./sound/engine.js";
import { updateTickets } from "./ui/tickets.js";
import { openBillOfFare, openDeskScreen } from "./ui/desk.js";
import { arrangeAnother, arrangeBuy, arrangeCancel, arrangeClick, arrangeHover, arrangeRemove, drawArrange } from "./ui/arrange.js";
import { openCalendar } from "./ui/calendar.js";
import { newWeather } from "./weather.js";
import { Game } from "./game.js";
import { dist } from "./world.js";
import { simDelta, updateClock, load, beginDay, save } from "./day.js";
import { longDate, shortDate } from "./calendar.js";
import { updateCrafting } from "./crafting.js";
import { initTalk, updatePatrons } from "./patrons.js";
import { updateNeeds } from "./needs.js";
import { updateWeather } from "./weather.js";
import { initLight, updateLamps } from "./ui/light.js";
import { updateFrontDoor } from "./door.js";
import { cancelPour, updatePour } from "./serving.js";
import { watchObjectives } from "./objectives.js";
import { emptyHere, offerUnasked, putDownHere, cleanable, cleanStep, findTargets, targetName, forcedTurnIn, interact, openGarnishMenu, openJournal, promptFor, targetId } from "./interact.js";
import { draw, computeView } from "./ui/render.js";
import { computeIsoView, drawIso, isoPick } from "./ui/render-iso.js";
import { P, screenDir } from "./ui/proj.js";
import { initPad, padActive, padGlyphs, pollPad } from "./gamepad.js";
import { updateHud, initDebug, toggleDebug } from "./ui/hud.js";
import { back, initMenus, menuKey, menuOpen } from "./ui/menu.js";
import { initSound, isMuted, soundscape, toggleMute, unlockAudio } from "./sound.js";
import { setBusVolume } from "./sound/engine.js";
import { updateWinding } from "./sound/gramophone.js";
import { BUILD } from "./version.js";
import { openMenu, closeAll, replaceMenu } from "./ui/menu.js";
const g = new Game();
load(g);
beginDay(g);
window.game = g;
void document.fonts?.load('700 16px "Playfair Display"'); // the ticket numerals, on the canvas too // handy from the browser console
window.__innView = () => view; // for tests: where tiles are on screen
window.__innBill = () => openBillOfFare(g); // for tests: the bill of fare without walking to the desk
window.__innDesk = () => openDeskScreen(g, () => openJournal(g)); // for tests: the desk
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
let view = { ts: 24, ox: 0, oy: 0 };
let target = null;
let clickDest = null;
initMenus(document.getElementById("menu"), (modal) => { g.modal = modal; }, () => g.bus.emit({ type: "Confirmed" }));
initDebug(g);
initSound(g);
initTalk(g);
initLight(g);
// For checking from the browser console (and screenshots): the game state.
window.innGame = g;
const wm = document.getElementById("watermark");
if (wm)
    wm.textContent = `Travelling Inn · lofi prototype · ${BUILD}`;
window.addEventListener("pointerdown", unlockAudio);
/** Canvas pixels to keep clear at the top of the map, so the status card never covers it. */
function statusClearance() {
    const st = document.getElementById("status");
    if (!st || st.offsetParent === null)
        return 0; // hidden (short screens)
    const gap = st.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top + 6;
    return Math.max(0, gap) * (window.devicePixelRatio || 1);
}
function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
}
window.addEventListener("resize", resize);
resize();
// ---------------------------------------------------------------------------
// Input
const keys = new Set();
window.addEventListener("keydown", (e) => {
    if (e.target?.tagName === "INPUT" || e.target?.tagName === "SELECT")
        return;
    unlockAudio();
    if (e.key === " " || e.key.startsWith("Arrow") || e.key === "Backspace")
        e.preventDefault();
    // The debug view opens over anything, the pause screen included.
    if ((e.key === "`" || e.key === "F2") && !e.repeat) {
        toggleDebug();
        e.preventDefault();
        return;
    }
    if (menuOpen()) {
        if (g.paused && (e.key === "p" || e.key === "P" || e.key === "Escape") && !e.repeat) {
            resume();
            return;
        }
        if (!e.repeat || e.key.startsWith("Arrow"))
            menuKey(e);
        return;
    }
    if (g.modal)
        return; // fading to sleep
    if (g.arranging) {
        // Arranging the kitchen: the mouse does it all; Esc puts back or finishes, Delete gets rid of one,
        // B buys something else, A another of what you just placed.
        if (e.key === "Escape")
            arrangeCancel(g);
        else if (e.key === "Delete" || e.key === "Backspace")
            arrangeRemove(g);
        else if (e.key.toLowerCase() === "b" && !e.repeat)
            arrangeBuy(g);
        else if (e.key.toLowerCase() === "a" && !e.repeat)
            arrangeAnother(g);
        keys.clear();
        return;
    }
    const k = e.key.toLowerCase();
    keys.add(k);
    if (e.repeat)
        return;
    switch (k) {
        case " ":
            g.holdingSpace = true;
            if (!g.paused)
                press(target);
            break;
        case "tab":
            e.preventDefault();
            cyclePick(e.shiftKey ? -1 : 1);
            break;
        case "e":
            if (target?.type === "furniture" && target.f.kind === "garnish")
                openGarnishMenu(g);
            break;
        case "q":
        case "r": // one key puts things down: back where they came from, or a tray on the nearest spot
            putDownHere(g, target);
            break;
        case "c":
            offerUnasked(g, target);
            break;
        case "x":
            emptyHere(g, target);
            break;
        case "o":
            g.showObjectives = !g.showObjectives;
            break;
        case "h":
        case "?":
            openKeys();
            break;
        case "j":
            openJournal(g);
            break;
        case "k":
            openCalendar(g);
            break;
        case "m":
            g.say(toggleMute() ? "Sound off." : "Sound on.");
            break;
        case "v":
            toggleIso();
            g.say(settings.iso ? "Isometric view." : "Top-down view.");
            break;
        case "[":
            setZoom(zoom() / ZOOM_STEP);
            break;
        case "]":
            setZoom(zoom() * ZOOM_STEP);
            break;
        case ",":
            turnCamera(-1);
            break;
        case ".":
            turnCamera(1);
            break;
        case "p":
        case "escape":
            openPause();
            break;
        case "-":
        case "_":
            g.speedIndex = Math.max(0, g.speedIndex - 1);
            break;
        case "=":
        case "+":
            g.speedIndex = Math.min(TUNING.speeds.length - 1, g.speedIndex + 1);
            break;
        case "`":
        case "f2":
            toggleDebug();
            e.preventDefault();
            break;
    }
});
window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (k === " ") {
        g.holdingSpace = false;
        release();
    }
});
window.addEventListener("blur", () => { keys.clear(); g.holdingSpace = false; });
// Out of sight pauses: another tab, a minimised window, or (Chrome/Edge) a window covering it.
// Focus alone doesn't: the address bar or devtools take it too, and the game is still on screen.
document.addEventListener("visibilitychange", () => { if (document.hidden)
    pauseIfAway(); });
/** Pause for someone who's gone. Modal screens already hold the clock. */
function pauseIfAway() {
    if (g.paused || g.modal)
        return;
    if (menuOpen())
        closeAll(); // a card screen: the clock runs under those, so set it aside
    openPause();
}
function toTile(e) {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr;
    if (view.iso)
        return isoPick(g, view, sx, sy); // allows for height: the side of the counter is the counter
    return { x: (sx - view.ox) / view.ts, y: (sy - view.oy) / view.ts };
}
let lastWalk = 0;
function walkToPoint(p) {
    const now = performance.now();
    g.keeper.running = now - lastWalk < 320; // double tap / double right-click runs
    lastWalk = now;
    walkTo({ x: Math.floor(p.x), y: Math.floor(p.y) }, null);
}
canvas.addEventListener("contextmenu", (e) => e.preventDefault()); // right-click stops (see pointerdown)
// Double-click (or double tap) on something: run there instead of walking.
let lastClickAt = 0;
let lastClickTile = "";
/** Left-click or tap on something: interact if close, otherwise walk over and then interact. */
function clickAt(p, slop = 0) {
    const now = performance.now();
    const tileKey = `${Math.floor(p.x)},${Math.floor(p.y)}`;
    const dbl = now - lastClickAt < 350 && tileKey === lastClickTile;
    lastClickAt = now;
    lastClickTile = tileKey;
    const go = (tile, id) => { walkTo(tile, id); g.keeper.running = dbl; };
    // A second click right after the first shouldn't use the thing twice (two ales from one double-click).
    const use = (t) => { if (!dbl)
        press(t); };
    const patron = g.patrons.find((q) => dist(q.pos, p) < 0.55 && q.state !== "leaving" && q.state !== "entering");
    if (patron) {
        const t = { type: "patron", p: patron };
        if (dist(g.keeper.pos, patron.pos) <= 2.3) {
            use(t);
            return true;
        }
        const spot = nearestReachable(patron.pos, 2.0);
        if (spot)
            go(spot, `patron:${patron.id}`);
        return true;
    }
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    const sd = g.setDown.find((s) => s.x === tx && s.y === ty);
    if (sd) {
        if (dist(g.keeper.pos, { x: tx + 0.5, y: ty + 0.5 }) <= 1.5) {
            use({ type: "tray", t: sd });
            return true;
        }
        const spot = nearestReachable({ x: tx + 0.5, y: ty + 0.5 }, 1.4);
        if (spot)
            go(spot, `tray:${sd.id}`);
        return true;
    }
    const sp = g.spills.find((s) => s.x === tx && s.y === ty);
    if (sp) {
        if (dist(g.keeper.pos, { x: tx + 0.5, y: ty + 0.5 }) > 1.1)
            walkTo({ x: tx, y: ty }, null);
        return true;
    }
    // On a touch screen a finger is less exact than a mouse: a tap just off a table's edge counts as on it.
    const off = (t) => Math.hypot(Math.max(t.x - p.x, 0, p.x - (t.x + 1)), Math.max(t.y - p.y, 0, p.y - (t.y + 1)));
    const f = g.world.furniture.find((ff) => ff.tiles.some((t) => t.x === tx && t.y === ty))
        ?? (slop > 0 ? g.world.furniture.filter((ff) => ff.kind === "table" && ff.tiles.some((t) => off(t) <= slop))
            .sort((a, b) => Math.min(...a.tiles.map(off)) - Math.min(...b.tiles.map(off)))[0] : undefined);
    if (f) {
        const near = f.tiles.some((t) => dist(g.keeper.pos, { x: t.x + 0.5, y: t.y + 0.5 }) <= 1.45);
        if (near) {
            faceTowards({ x: tx + 0.5, y: ty + 0.5 });
            use({ type: "furniture", f });
            return true;
        }
        const spots = g.world.approachTiles(f).sort((a, b) => dist(a, g.keeper.pos) - dist(b, g.keeper.pos));
        for (const s of spots) {
            if (keeperPath(s)) {
                go(s, f.id);
                return true;
            }
        }
        return true;
    }
    return false;
}
function faceTowards(p) {
    const k = g.keeper;
    const d = dist(p, k.pos) || 1;
    k.facing = { x: (p.x - k.pos.x) / d, y: (p.y - k.pos.y) / d };
}
// One handler for mouse, touch and pen.
let touchHolding = false;
let mouseHeld = false; // the left button is down: holding it on a mess cleans it
let mouseAt = { x: 0, y: 0 };
/** The mess under the mouse, if it's in reach: a spill (or one you stand on) or a dirty table. */
function messAt(p) {
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    const sp = g.spills.find((s) => s.x === tx && s.y === ty);
    if (sp) {
        const t = { type: "spill", s: sp };
        return inReach(t) ? t : null;
    }
    const f = g.world.furniture.find((ff) => ff.kind === "table" && ff.tiles.some((t) => t.x === tx && t.y === ty));
    if (f) {
        const t = { type: "furniture", f };
        return inReach(t) && cleanable(g, t) ? t : null;
    }
    return null;
}
canvas.addEventListener("pointerdown", (e) => {
    unlockAudio();
    if (menuOpen() || g.paused)
        return;
    if (g.arranging) {
        e.preventDefault();
        if (e.button === 2)
            arrangeCancel(g);
        else
            arrangeClick(g, toTile(e));
        return;
    }
    if (e.pointerType === "mouse") {
        // One button, like touch: click the floor to walk, click a thing or person to use it,
        // double-click to run, hold on a mess to clean it. Right-click stops.
        if (e.button === 2) {
            stopKeeper();
            return;
        }
        if (e.button !== 0)
            return;
        const p = toTile(e);
        mouseHeld = true;
        mouseAt = p;
        holdSince = performance.now();
        if (!clickAt(p))
            walkToPoint(p);
        return;
    }
    // Touch: tap a thing to use it, tap the floor to walk, double tap to run.
    e.preventDefault();
    if (fingers.size > 1)
        return; // a pinch, not a tap
    holdSince = performance.now();
    document.getElementById("touchhint")?.remove(); // the hint goes once you've got the idea
    const p = toTile(e);
    const near = dist(g.keeper.pos, p) <= 1.6;
    if (near)
        faceTowards(p);
    const handled = clickAt(p, TOUCH_SLOP);
    if (!handled)
        walkToPoint(p);
    // Holding a finger on something close by works like holding Space (hurry cooking, clean).
    if (near) {
        touchHolding = true;
        g.holdingSpace = true;
    }
});
const endTouch = () => { mouseHeld = false; release(); if (touchHolding) {
    touchHolding = false;
    g.holdingSpace = false;
} };
canvas.addEventListener("pointermove", (e) => { if (g.arranging)
    arrangeHover(g, toTile(e)); if (mouseHeld)
    mouseAt = toTile(e); });
window.addEventListener("pointerup", () => { mouseHeld = false; release(); });
// The wheel zooms (a trackpad's small steps zoom a little; a mouse notch about 15%).
canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (menuOpen())
        return;
    const steps = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100; // lines or pixels, in mouse notches
    setZoom(zoom() * Math.pow(ZOOM_STEP, -steps));
}, { passive: false });
// Two fingers pinch to zoom. The first finger's tap already went; the second calls it off.
const fingers = new Map();
let pinchFrom = 0;
const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch")
        return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
        stopKeeper();
        touchHolding = false;
        g.holdingSpace = false;
        release();
        pinchFrom = spread();
    }
}, { capture: true });
canvas.addEventListener("pointermove", (e) => {
    if (!fingers.has(e.pointerId))
        return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2 && pinchFrom > 0) {
        const now = spread();
        setZoom(zoom() * (now / pinchFrom));
        pinchFrom = now;
    }
});
const liftFinger = (e) => { fingers.delete(e.pointerId); if (fingers.size < 2)
    pinchFrom = 0; };
canvas.addEventListener("pointerup", liftFinger);
canvas.addEventListener("pointercancel", liftFinger);
canvas.addEventListener("pointerup", endTouch);
canvas.addEventListener("pointercancel", endTouch);
canvas.addEventListener("pointerleave", endTouch);
// On-screen buttons (shown on touch screens; they work with a mouse too).
function bindButton(id, fn) {
    const el = document.getElementById(id);
    if (el)
        el.addEventListener("click", (e) => { e.preventDefault(); unlockAudio(); fn(); });
}
bindButton("tb-pause", () => { if (g.paused)
    resume();
else if (!menuOpen())
    openPause(); });
bindButton("tb-slower", () => { g.speedIndex = Math.max(0, g.speedIndex - 1); });
bindButton("tb-faster", () => { g.speedIndex = Math.min(TUNING.speeds.length - 1, g.speedIndex + 1); });
bindButton("tb-objectives", () => { g.showObjectives = !g.showObjectives; document.body.classList.add("panel-open"); });
bindButton("tb-card", () => { if (!menuOpen())
    offerUnasked(g, target); });
// The controller: it presses the same keys and clicks as you would (gamepad.ts).
const HAND = ["card"]; // the cards in hand, as their buttons' ids: just "offer unasked" for now
let handIndex = 0;
function showHandPick() {
    HAND.forEach((id, i) => document.getElementById(id)?.classList.toggle("picked", i === handIndex && padActive()));
}
initPad({
    menuOpen,
    arranging: () => !!g.arranging,
    paused: () => g.paused,
    setWalk: (v, run) => { padWalk = v; padRun = run; },
    zoomBy: (f) => setZoom(zoom() * f),
    cardStep: (by) => {
        handIndex = (handIndex + by + HAND.length) % HAND.length;
        showHandPick();
        const el = document.getElementById(HAND[handIndex]);
        el?.classList.remove("nudge");
        void el?.offsetWidth;
        el?.classList.add("nudge");
    },
    playCard: () => { if (!menuOpen()) {
        showHandPick();
        offerUnasked(g, target);
    } },
    keeperOnScreen: () => {
        const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        const q = P(view, g.keeper.pos.x, g.keeper.pos.y);
        return { x: r.left + q.x / dpr, y: r.top + q.y / dpr };
    },
    canvas,
});
bindButton("card", () => { if (!menuOpen())
    offerUnasked(g, target); });
bindButton("tb-setdown", () => { if (!menuOpen())
    putDownHere(g, target); });
bindButton("tb-empty", () => { if (!menuOpen())
    emptyHere(g, target); });
bindButton("tb-journal", () => { if (!menuOpen())
    openJournal(g); });
document.getElementById("status")?.addEventListener("click", () => { if (!menuOpen() && !g.modal)
    openCalendar(g); });
bindButton("tb-sound", () => g.say(toggleMute() ? "Sound off." : "Sound on."));
bindButton("tb-debug", () => toggleDebug());
bindButton("tb-panel", () => document.body.classList.toggle("panel-open"));
// ---------------------------------------------------------------------------
// Tap or hold. Pressing on something that holding would clean (a dirty table, a spill) waits a moment:
// let go quickly and it's a tap (serve, snacks); keep holding and you clean it.
const HOLD_MS = 260;
let holdSince = 0; // when the current press (Space, mouse or finger) started
let pressed = null; // a tap waiting to be decided
function press(t) {
    holdSince = performance.now();
    if (!t)
        return;
    if (cleanable(g, t)) {
        pressed = { id: targetId(t), at: holdSince };
        return;
    }
    interact(g, t);
}
function release() {
    const p = pressed;
    pressed = null;
    if (!p || performance.now() - p.at >= HOLD_MS)
        return; // it was a hold: the cleaning already happened
    const t = resolveTarget(p.id);
    if (t && !menuOpen() && !g.paused)
        interact(g, t);
}
/** Held long enough to count as holding, not a tap. */
function holding() {
    return performance.now() - holdSince >= HOLD_MS;
}
// Several things in reach: the best is chosen, unless you've picked another with Tab.
let candidates = [];
let pickedId = null;
function cyclePick(dir) {
    if (candidates.length < 2)
        return;
    const i = Math.max(0, candidates.findIndex((c) => targetId(c) === targetId(target)));
    pickedId = targetId(candidates[(i + dir + candidates.length) % candidates.length]);
}
function chooseTarget() {
    candidates = findTargets(g);
    const picked = pickedId ? candidates.find((c) => targetId(c) === pickedId) : undefined;
    if (!picked)
        pickedId = null;
    return picked ?? candidates[0] ?? null;
}
const touchScreen = window.matchMedia("(pointer: coarse)").matches;
function choiceHint() {
    if (candidates.length < 2 || touchScreen)
        return "";
    const others = candidates.filter((c) => targetId(c) !== targetId(target)).slice(0, 3).map(targetName);
    return ` · Tab: ${others.join(", ")}${candidates.length > 4 ? "…" : ""}`;
}
function nearestReachable(pos, range) {
    const cands = [];
    for (let y = Math.floor(pos.y - range); y <= Math.ceil(pos.y + range); y++) {
        for (let x = Math.floor(pos.x - range); x <= Math.ceil(pos.x + range); x++) {
            const t = g.world.tile(x, y);
            if (t?.keeperWalk && dist({ x: x + 0.5, y: y + 0.5 }, pos) <= range && dist({ x: x + 0.5, y: y + 0.5 }, pos) > 0.6)
                cands.push({ x, y });
        }
    }
    cands.sort((a, b) => dist(a, g.keeper.pos) - dist(b, g.keeper.pos));
    return cands.find((c) => keeperPath(c)) ?? null;
}
/** Tiles where guests are standing or sitting: the keeper walks round them when there's a way. */
function guestTiles() {
    const out = new Set();
    for (const p of g.patrons)
        out.add(`${Math.floor(p.pos.x)},${Math.floor(p.pos.y)}`);
    for (const s of g.world.seats)
        if (s.occupant !== null)
            out.add(`${s.tile.x},${s.tile.y}`);
    return out;
}
/** The keeper's way to a tile: round the guests if possible, straight through the gaps if not. */
function keeperPath(tile) {
    return g.world.path(g.keeper.pos, tile, "keeper", guestTiles()) ?? g.world.path(g.keeper.pos, tile, "keeper");
}
function walkTo(tile, interactWith) {
    const path = keeperPath(tile);
    if (!path)
        return;
    replans = 0;
    walkGoal = tile;
    g.keeper.path = path;
    g.keeper.pendingInteract = interactWith;
    clickDest = { x: tile.x + 0.5, y: tile.y + 0.5 };
}
// ---------------------------------------------------------------------------
// Keeper movement (real time: mood and speed settings never touch the player's hands)
const R = 0.3;
function walkable(x, y) {
    for (const [cx, cy] of [[x - R, y - R], [x + R, y - R], [x - R, y + R], [x + R, y + R]]) {
        if (!g.world.tile(Math.floor(cx), Math.floor(cy))?.keeperWalk)
            return false;
    }
    return true;
}
/** Guests are solid: a step may not bring the keeper into one (stepping away is always fine). */
const BODY = 0.6; // keeper and guest centres stay at least this far apart
const TOUCH_SLOP = 0.4; // tiles: how far off a table's edge a tap still counts as on it
function bumpsGuest(from, to) {
    for (const p of g.patrons) {
        const d = dist(to, p.pos);
        if (d < BODY && d < dist(from, p.pos))
            return true;
    }
    return false;
}
function canStep(from, x, y) {
    return walkable(x, y) && !bumpsGuest(from, { x, y });
}
/** Is a target close enough to use from where the keeper stands? */
function inReach(t) {
    const k = g.keeper.pos;
    if (t.type === "patron")
        return dist(t.p.pos, k) <= 2.3;
    if (t.type === "tray")
        return dist({ x: t.t.x + 0.5, y: t.t.y + 0.5 }, k) <= 1.5;
    if (t.type === "spill")
        return dist({ x: t.s.x + 0.5, y: t.s.y + 0.5 }, k) <= 1.2;
    return t.f.tiles.some((tt) => dist({ x: tt.x + 0.5, y: tt.y + 0.5 }, k) <= 1.45);
}
function targetPos(t) {
    return t.type === "patron" ? t.p.pos : t.type === "furniture" ? t.f.center : t.type === "tray" ? { x: t.t.x + 0.5, y: t.t.y + 0.5 } : { x: t.s.x + 0.5, y: t.s.y + 0.5 };
}
/** Arrived (or close enough): face the thing and use it. */
function arriveAndUse() {
    const k = g.keeper;
    const id = k.pendingInteract;
    k.path = [];
    k.pendingInteract = null;
    k.running = false;
    clickDest = null;
    if (!id)
        return;
    const t = resolveTarget(id);
    if (!t)
        return;
    const tp = targetPos(t);
    const d = dist(tp, k.pos) || 1;
    k.facing = { x: (tp.x - k.pos.x) / d, y: (tp.y - k.pos.y) / d };
    if (mouseHeld && cleanable(g, t))
        return; // still holding the mouse on a mess: that's cleaning
    interact(g, t);
}
/** Stop where you are: right-click, or a guest in the way for too long. */
function stopKeeper() {
    const k = g.keeper;
    k.path = [];
    k.pendingInteract = null;
    k.running = false;
    clickDest = null;
    cancelPour(g);
}
let blockedFor = 0;
let replans = 0; // fresh routes tried since someone got in the way
let walkGoal = null;
let padWalk = null; // the controller's left stick, in screen directions
let padRun = false;
function moveKeeper(dt) {
    const k = g.keeper;
    if (menuOpen() || g.paused || g.modal)
        return;
    let dx = 0, dy = 0;
    if (keys.has("w") || keys.has("arrowup"))
        dy -= 1;
    if (keys.has("s") || keys.has("arrowdown"))
        dy += 1;
    if (keys.has("a") || keys.has("arrowleft"))
        dx -= 1;
    if (keys.has("d") || keys.has("arrowright"))
        dx += 1;
    let pace = 1; // the stick can walk slowly; keys walk at full pace
    if (!dx && !dy && padWalk) {
        dx = padWalk.x;
        dy = padWalk.y;
        pace = Math.min(1, Math.hypot(dx, dy));
    }
    const run = keys.has("shift") || (padRun && !!padWalk);
    if ((dx || dy) && view.iso)
        ({ x: dx, y: dy } = screenDir(view, dx, dy)); // isometric: up on screen is up
    if (dx || dy) {
        k.path = [];
        k.pendingInteract = null;
        clickDest = null;
        const len = Math.hypot(dx, dy);
        const sp = (run ? TUNING.keeperRun : TUNING.keeperWalk) * dt * pace;
        const nx = k.pos.x + (dx / len) * sp, ny = k.pos.y + (dy / len) * sp;
        if (canStep(k.pos, nx, k.pos.y))
            k.pos.x = nx;
        if (canStep(k.pos, k.pos.x, ny))
            k.pos.y = ny;
        k.facing = { x: dx / len, y: dy / len };
        return;
    }
    if (k.path.length) {
        let step = (k.running ? TUNING.keeperRun : TUNING.keeperWalk) * dt;
        let moved = false;
        while (step > 0 && k.path.length) {
            const t = k.path[0];
            const ddx = t.x - k.pos.x, ddy = t.y - k.pos.y;
            const d = Math.hypot(ddx, ddy);
            if (d > 0.001)
                k.facing = { x: ddx / d, y: ddy / d };
            const next = d <= step ? { ...t } : { x: k.pos.x + (ddx / d) * step, y: k.pos.y + (ddy / d) * step };
            if (bumpsGuest(k.pos, next))
                break; // someone's in the way: wait for them
            moved = true;
            if (d <= step) {
                k.pos = next;
                k.path.shift();
                step -= d;
            }
            else {
                k.pos = next;
                step = 0;
            }
        }
        if (!k.path.length) {
            blockedFor = 0;
            arriveAndUse();
            return;
        }
        if (moved) {
            blockedFor = 0;
            return;
        }
        // Waiting on a guest. If what we're going to is already in reach, just use it from here.
        blockedFor += dt;
        const t = k.pendingInteract ? resolveTarget(k.pendingInteract) : null;
        if (t && inReach(t)) {
            blockedFor = 0;
            arriveAndUse();
            return;
        }
        // Someone stepped into the way: after a moment, find a way round them. Only give up if there's none.
        if (blockedFor > 0.3 && walkGoal) {
            blockedFor = 0;
            const round = g.world.path(k.pos, walkGoal, "keeper", guestTiles());
            if (round && replans++ < 8) {
                k.path = round;
                return;
            }
            if (replans > 8 || !round) {
                stopKeeper();
                g.say("Someone's in the way.");
            }
        }
    }
}
function resolveTarget(id) {
    if (id.startsWith("spill:")) {
        const sp = g.spills.find((x) => x.id === Number(id.slice(6)));
        return sp ? { type: "spill", s: sp } : null;
    }
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
let carried = new Map();
function watchTrays() {
    const now = new Map();
    for (const t of [...g.keeper.trays, ...g.setDown.map((s) => s.tray)])
        for (const i of t.items)
            now.set(i.id, i.name);
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
// Settings (kept in this browser): sound volumes and UI size.
const SETTINGS_KEY = "travelling-inn-settings";
let settings = {};
try {
    settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
}
catch { /* defaults */ }
let uiChoice = settings.ui ?? "auto";
function saveSettings() {
    settings.ui = uiChoice;
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    catch { /* fine */ }
}
function volume(k) {
    const v = settings[k];
    return v === false ? 0 : v === true || v === undefined ? 1 : v;
}
const pct = (v) => (v === 0 ? "off" : `${Math.round(v * 100)}%`);
function applySound() {
    setBusVolume("cue", volume("cues"));
    setBusVolume("ambience", volume("atmosphere"));
    setBusVolume("music", volume("music"));
}
applySound();
/** Straight down or isometric (V, or the pause screen's Display tab). Only the drawing changes. */
function toggleIso() {
    settings.iso = !settings.iso;
    saveSettings();
    showView(settings.iso ? "Isometric" : "Top-down");
}
// Zoom (wheel, pinch, [ and ]) and the isometric camera's corner (, and .), each kept per view.
const ZOOM_STEP = 1.15;
const ZOOM_MIN = 0.5, ZOOM_MAX = 3;
function zoom() { return (settings.iso ? settings.zoomIso : settings.zoomFlat) ?? 1; }
function setZoom(z) {
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    if (Math.abs(z - 1) < 0.03)
        z = 1; // snaps to "fits the inn" on the way past
    if (settings.iso)
        settings.zoomIso = z;
    else
        settings.zoomFlat = z;
    saveSettings();
    showView(`Zoom ${Math.round(z * 100)}%`);
}
const CORNERS = ["south-east", "north-east", "north-west", "south-west"];
function turnCamera(by) {
    if (!settings.iso) {
        showView("Turning works in the isometric view (V)");
        return;
    }
    settings.rot = (((settings.rot ?? 0) + by) % 4 + 4) % 4;
    saveSettings();
    showView(`Looking from the ${CORNERS[settings.rot]}`);
}
/** A note over the map for a moment: the zoom level, or where the camera is. */
let viewNote = { text: "", until: 0 };
function showView(text) { viewNote = { text, until: performance.now() + 1400 }; }
function drawViewNote() {
    const left = viewNote.until - performance.now();
    if (left <= 0)
        return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, left / 300);
    ctx.font = `600 ${Math.round(14 * dpr * uiScale())}px system-ui, sans-serif`;
    const w = ctx.measureText(viewNote.text).width + 28 * dpr;
    const x = canvas.width / 2 - w / 2, y = canvas.height - 64 * dpr * uiScale();
    ctx.fillStyle = "rgba(22,17,13,0.85)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, 30 * dpr * uiScale(), 8 * dpr);
    ctx.fill();
    ctx.fillStyle = "#f3e6d0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(viewNote.text, canvas.width / 2, y + 15 * dpr * uiScale());
    ctx.restore();
}
function autoUi() {
    // 1 on laptops and phones, larger on big high-resolution screens (a 4K screen at 100% gets about 2).
    return Math.max(1, Math.min(2.5, Math.round((window.innerWidth / 1700) * 4) / 4));
}
function uiScale() {
    return uiChoice === "auto" ? autoUi() : uiChoice;
}
function applyUi() {
    document.documentElement.style.setProperty("--ui", String(uiScale()));
    requestAnimationFrame(resize);
}
applyUi();
window.addEventListener("resize", () => { if (uiChoice === "auto")
    applyUi(); });
function resume() {
    closeAll();
    g.paused = false;
    g.bus.emit({ type: "Resumed" });
}
const PAUSE_TABS = [
    { id: "game", label: "▶ Game" }, { id: "sound", label: "🔊 Sound" }, { id: "display", label: "🔍 Display" },
];
let pauseTab = "game";
function slider(key, icon, name, sub, value, min, max, step, shown) {
    return `<label class="set-row"><span class="set-name">${icon} ${name}<small>${sub}</small></span>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-set="${key}">
    <b class="set-val" data-val="${key}">${shown}</b></label>`;
}
function openPause() {
    g.paused = true;
    g.bus.emit({ type: "Paused" });
    const build = () => {
        const redraw = () => replaceMenu(build());
        const tabs = `<div class="bf-tabs set-tabs">${PAUSE_TABS.map((t) => `<button class="${pauseTab === t.id ? "on" : ""}" data-pick="tab:${t.id}">${t.label}</button>`).join("")}</div>`;
        let panel = "";
        if (pauseTab === "game") {
            panel = `<div class="set-list">
        <button class="set-btn" data-pick="objectives">✅ Objectives <small>${g.showObjectives ? "shown" : "hidden"}</small></button>
        <button class="set-btn" data-pick="howto">❔ How to play</button>
        <button class="set-btn" data-pick="keys">⌨️ Keys and controls <small>H</small></button>
      </div>`;
        }
        else if (pauseTab === "sound") {
            panel = `<div class="set-list">
        <button class="set-btn" data-pick="mute">${isMuted() ? "🔇 Sound is off" : "🔊 Sound is on"} <small>${isMuted() ? "turn it on" : "mute everything (M)"}</small></button>
        ${slider("cues", "🔔", "Sound effects", "orders, outcomes, the bell, pouring", Math.round(volume("cues") * 100), 0, 100, 5, pct(volume("cues")))}
        ${slider("music", "🎵", "Music", "the gramophone and background music", Math.round(volume("music") * 100), 0, 100, 5, pct(volume("music")))}
        ${slider("atmosphere", "🌧", "Background", "crowd, rain, wind, fire, cooking, the street", Math.round(volume("atmosphere") * 100), 0, 100, 5, pct(volume("atmosphere")))}
      </div>`;
        }
        else {
            panel = `<div class="set-list">
        ${slider("ui", "🔍", "UI size", "panels, cards, pop-ups and tickets", Math.round(uiScale() * 100), 75, 250, 5, `${Math.round(uiScale() * 100)}%`)}
        <button class="set-btn" data-pick="iso">${settings.iso ? "◆ Isometric view" : "▦ Top-down view"} <small>switch to ${settings.iso ? "top-down" : "isometric"} (V)</small></button>
        ${slider("zoom", "🔎", "Zoom", `${settings.iso ? "isometric" : "top-down"} view · wheel, pinch, [ ]`, Math.round(zoom() * 100), ZOOM_MIN * 100, ZOOM_MAX * 100, 5, `${Math.round(zoom() * 100)}%`)}
        ${settings.iso ? `<button class="set-btn" data-pick="turn">🧭 Looking from the ${CORNERS[settings.rot ?? 0]} <small>turn the camera ( , and . )</small></button>` : ""}
        <button class="set-btn" data-pick="uiauto">${uiChoice === "auto" ? "☑" : "☐"} Automatic <small>size to fit the screen (${Math.round(autoUi() * 100)}% here)</small></button>
      </div>`;
        }
        return {
            title: "Paused",
            modal: true,
            view: {
                html: tabs + panel,
                onPick: (v) => {
                    const [k, arg] = v.split(":");
                    if (k === "tab") {
                        pauseTab = arg;
                        redraw();
                    }
                    else if (k === "objectives") {
                        g.showObjectives = !g.showObjectives;
                        redraw();
                    }
                    else if (k === "keys")
                        openKeys(true);
                    else if (k === "howto")
                        openMenu({ title: "How to play", body: welcomeBody(), items: [{ label: "Back", button: "secondary", action: () => back() }] });
                    else if (k === "mute") {
                        toggleMute();
                        redraw();
                    }
                    else if (k === "iso") {
                        toggleIso();
                        redraw();
                    }
                    else if (k === "turn") {
                        turnCamera(1);
                        redraw();
                    }
                    else if (k === "uiauto") {
                        uiChoice = uiChoice === "auto" ? uiScale() : "auto";
                        saveSettings();
                        applyUi();
                        redraw();
                    }
                },
                onKey: (e) => {
                    if (e.key !== "Tab")
                        return false;
                    e.preventDefault();
                    const i = PAUSE_TABS.findIndex((t) => t.id === pauseTab);
                    pauseTab = PAUSE_TABS[(i + (e.shiftKey ? -1 : 1) + PAUSE_TABS.length) % PAUSE_TABS.length].id;
                    redraw();
                    return true;
                },
                onMount: (root) => {
                    root.querySelectorAll("input[data-set]").forEach((el) => {
                        const key = el.dataset.set;
                        const label = root.querySelector(`[data-val="${key}"]`);
                        el.oninput = () => {
                            const v = Number(el.value) / 100;
                            if (key === "ui") {
                                if (label)
                                    label.textContent = `${Math.round(v * 100)}%`;
                                return;
                            } // applied on release: resizing mid-drag jumps the slider
                            if (key === "zoom") {
                                setZoom(v);
                                if (label)
                                    label.textContent = `${Math.round(zoom() * 100)}%`;
                                return;
                            }
                            settings[key] = v;
                            if (label)
                                label.textContent = pct(v);
                            applySound();
                        };
                        el.onchange = () => {
                            if (key === "ui") {
                                uiChoice = Number(el.value) / 100;
                                applyUi();
                            }
                            saveSettings();
                            el.blur(); // so P and Esc reach the game again
                            if (key === "ui")
                                redraw();
                        };
                    });
                },
            },
            items: [{ label: "▶ Resume", sub: "P", button: "primary", action: () => resume() }],
        };
    };
    openMenu(build());
}
// Every key and control in one place (H, or the pause screen). The side panel keeps just a line.
const KEYS = [
    { group: "Getting about", rows: [
            ["Click / tap the floor", "walk there (double: run)"], ["Right-click", "stop"], ["WASD or arrows", "walk"], ["Shift", "run"],
        ] },
    { group: "Using things", rows: [
            ["Click / tap a thing or person", "go and use it"], ["Space", "use what's in reach: serve, pick up, pour, cook"],
            ["Tab", "pick between things in reach · in menus: switch tabs (PageUp/PageDown: the tabs inside)"], ["Hold Space / hold the mouse", "hurry cooking · clean a mess"],
        ] },
    { group: "Serving", rows: [
            ["E", "garnish a drink (at the counter)"], ["C", "offer something unasked"],
            ["R (or Q)", "put down: a dish back where you picked it up, or else a tray on the nearest spot"], ["X", "empty a pot, urn or kettle"],
        ] },
    { group: "Arranging the kitchen", rows: [
            ["Click", "pick up a piece, then click where it goes"], ["B", "buy something else"], ["A", "another of what you just placed"],
            ["Delete", "sell the piece in hand (half its price)"], ["Esc", "put it back · finish"],
        ] },
    { group: "Looking", rows: [
            ["Wheel / pinch / [ ]", "zoom"], ["V", "top-down or isometric"], [", .", "turn the isometric camera"],
        ] },
    { group: "Controller (PS5 or similar)", rows: [
            ["Left stick", "walk (all the way, or R2: run)"], ["✕", "use, like Space (hold: hurry, clean)"],
            ["L1 / R1", "pick between things in reach · menu tabs"],
            ["D-pad ← →, ↑", "choose a card, play it"], ["D-pad ↓ / hold ↓", "put down (a dish back, or a tray) / empty a pot"], ["Right stick", "zoom ↑↓ · turn the camera ←→"],
            ["In menus", "✕ pick · □ confirm (Cook, Put up…) · ○ back or close"],
            ["L1 / R1 · L2 / R2", "in menus: tabs · the tabs inside them (the meals)"],
            ["R3 · Options · touchpad", "isometric · pause · this list"], ["Arranging", "stick moves the cursor · ✕ click · □ buy · △ next delivered · L2 sell it"],
        ] },
    { group: "The day", rows: [
            ["J", "journal"], ["K", "calendar"], ["O", "objectives"], ["− / =", "slower / faster"],
            ["M", "sound on or off"], ["P / Esc", "pause and settings"], ["H", "this list"], ["` / F2", "debug"],
        ] },
];
function openKeys(fromPause = false) {
    const html = `<div class="keys">${KEYS.map((k) => `<div class="keys-group"><h4>${k.group}</h4>${k.rows.map(([key, what]) => `<div class="keys-row"><b>${key}</b><span>${what}</span></div>`).join("")}</div>`).join("")}</div>`;
    openMenu({
        title: "⌨️ Keys and controls",
        holdsClock: true,
        view: { html },
        items: [{ label: fromPause ? "Back" : "Close", button: "secondary", action: () => (fromPause ? back() : closeAll()) }],
    });
}
// A welcome before anything moves. The clock starts when the player presses Start.
const touch = window.matchMedia("(pointer: coarse)").matches;
const controls = touch
    ? `<b>Tap</b> the floor to walk, <b>double tap</b> to run. <b>Tap</b> things and people to use them. <b>Keep your finger</b> on a pot or a mess to hurry or clean. The buttons on the side do the rest.`
    : `<b>Click</b> the floor to walk, <b>click</b> things and people to use them, <b>double-click</b> to run, <b>right-click</b> to stop. Or <b>WASD</b> to walk (<b>Shift</b> runs) and <b>Space</b> to use. Hold <b>Space</b> to hurry cooking; hold <b>Space</b> or the mouse on a mess to clean it. <b>R</b> puts back a dish picked up by mistake; <b>X</b> empties a pot. When several things are in reach, <b>Tab</b> picks one. The <b>wheel</b> zooms; <b>V</b> switches to an isometric view. <b>P</b> pauses; <b>H</b> lists every key.`;
function welcomeBody() {
    return `<div class="welcome">
    <p><b>${longDate(g.date)}.</b></p>
    <p>You're the keeper. Each day you wake at 6, get the inn ready, open the door, and look after whoever comes in.</p>
    <p><b>Guests order</b> food at tables and drinks at the counter. Cook in the kitchen and pick dishes up where they were made, pour at the taps, and carry them over on your two trays.</p>
    <p><b>Everyone has hidden tastes.</b> Which ingredients you choose decides how a dish lands. Watch how people react, and read your <b>journal</b> at the desk: regulars reward getting to know them.</p>
    <p><b>Nothing burns, nothing is ruined,</b> and there's no rush. The checklist on the side ("Today") shows where to start.</p>
    <p class="muted">${controls}</p>
  </div>`;
}
if (g.location) {
    openMenu({
        title: g.day > 1 ? `Welcome back: ${shortDate(g.date)}` : "Welcome to the Travelling Inn",
        modal: true,
        body: welcomeBody(),
        items: [{ label: g.day > 1 ? "Continue" : "Start game", button: "primary", action: () => { closeAll(); unlockAudio(); } }],
    });
}
else {
    // A new save: the welcome, then where does the inn stand (it shapes the year, the weather and who comes
    // in), then which inn: the big tavern or a small one.
    const settle = (id) => {
        g.location = id;
        openInnPicker((inn) => {
            g.setInn(inn);
            buildRooms(g); // sound carries through this inn's rooms
            g.weather = newWeather(g.date.season, g.loc);
            g.log.length = 0;
            beginDay(g); // the morning again, at the chosen place
            save(g);
            closeAll();
        });
    };
    openMenu({
        title: "Welcome to the Travelling Inn",
        modal: true,
        body: welcomeBody(),
        items: [{ label: "Start game", button: "primary", action: () => { unlockAudio(); openLocationPicker(settle, true); } }],
    });
}
let last = performance.now();
let hudTimer = 0;
function frame(now) {
    const realDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    pollPad(realDt);
    moveKeeper(realDt);
    target = chooseTarget();
    // Cleaning is a hold (Space, mouse or finger) on something dirty; a quick tap does the other thing.
    const cleaningWhat = !holding() ? null : (mouseHeld ? messAt(mouseAt) : null) ?? (g.holdingSpace ? target : null);
    if (cleaningWhat && !g.paused && !g.modal && !menuOpen() && cleanable(g, cleaningWhat))
        cleanStep(g, cleaningWhat, realDt);
    else if (g.cleaning && (!cleaningWhat || targetId(cleaningWhat) !== g.cleaning.targetId))
        g.cleaning = null;
    if (!g.paused)
        updatePour(g, realDt);
    updateWinding(g, realDt);
    const sim = simDelta(g, realDt);
    if (sim > 0) {
        updateCrafting(g, sim, target?.type === "furniture" ? target.f : null);
        updatePatrons(g, sim);
        updateNeeds(g, sim);
        updateWeather(g, sim);
        updateLamps(g);
        updateFrontDoor(g, now);
        updateClock(g, sim, () => forcedTurnIn(g));
    }
    watchTrays();
    watchObjectives(g);
    soundscape(g, realDt);
    view = settings.iso ? computeIsoView(canvas, g, 34, statusClearance(), zoom(), settings.rot ?? 0) : computeView(canvas, g, 22, statusClearance(), zoom());
    (view.iso ? drawIso : draw)(ctx, g, view, g.arranging ? null : target, clickDest);
    drawArrange(ctx, g, view);
    drawViewNote();
    updateTickets(g);
    hudTimer -= realDt;
    if (hudTimer <= 0) {
        hudTimer = 0.15;
        updateHud(g, padGlyphs(promptFor(g, target) + choiceHint()));
    }
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
