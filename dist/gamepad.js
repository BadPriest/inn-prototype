// A controller (a PS5 DualSense, or anything the browser maps to the standard layout): read each frame
// and turned into what the keyboard and mouse already do, so every screen works without knowing about it.
//
// Playing:  left stick walk (all the way, or R2, runs) · ✕ use (hold: hurry, clean; garnishes at the
//           counter) · L1/R1 pick between things in reach · D-pad ←/→ choose a card, ↑ play it,
//           ↓ put down (a dish back where it came from, or else a tray; hold ↓: empty a pot) · right
//           stick zoom (↑↓) and turn the isometric camera (←→) · R3 top-down or isometric · Options
//           pause · touchpad the keys · □ hold: hurry (F). ○ and △ are free while playing.
// Menus:    D-pad or left stick move · ✕ pick (like Space: a card, an item) · □ confirm the screen (like
//           Enter: Cook, Put up…, without going to the button) · ○ the negative choice (Not now, Keep playing), else back or close · L1/R1 switch tabs, L2/R2 the tabs inside them
// Kitchen:  left stick moves a cursor · ✕ pick up / place · ○ put back or finish · □ buy · △ another ·
//           L2 get rid of the piece in hand
import { padCancel, padConfirm } from "./ui/menu.js";
// Standard mapping (what Chrome and Edge give a DualSense).
const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, touchpad: 17 };
const DEAD = 0.22; // stick dead zone
const HOLD = 0.5; // seconds: a long press
const CURSOR_SPEED = 900; // client pixels a second at full tilt
let hooks = null;
let prev = [];
let downAt = [];
let longFired = [];
let active = false; // the controller was the last thing used: prompts show its buttons
let lastIndex = -1;
// Menus: the left stick repeats like a held arrow key.
let stickDir = "";
let stickNext = 0;
// Kitchen: the cursor, in client pixels.
let cursor = null;
let cursorEl = null;
// Right stick: one camera turn per push.
let turned = false;
export function initPad(h) {
    hooks = h;
    window.addEventListener("gamepadconnected", () => setActive(true));
    // Anything from the keyboard or mouse hands the prompts back to them.
    window.addEventListener("keydown", (e) => { if (e.isTrusted)
        setActive(false); }, true);
    window.addEventListener("pointerdown", (e) => { if (e.isTrusted)
        setActive(false); }, true);
}
/** The controller is in use: buttons show its glyphs (body.pad). */
function setActive(on) {
    if (on === active)
        return;
    active = on;
    document.body.classList.toggle("pad", on);
}
/** Whether to show controller buttons in the prompts. */
export function padActive() { return active; }
/** The keyboard's prompt, in controller buttons. */
export function padGlyphs(text) {
    if (!active)
        return text;
    return text
        .replace(/\bSpace or E\b/g, "✕")
        .replace(/\bhold Space\b/gi, "hold ✕")
        .replace(/\bSpace\b/g, "✕")
        .replace(/\bR: /g, "↓: ")
        .replace(/\bX: /g, "hold ↓: ")
        .replace(/\bC: /g, "↑: ")
        .replace(/\bTab\b/g, "L1/R1");
}
function key(k, opts = {}) {
    const init = { key: k, bubbles: true, cancelable: true, shiftKey: !!opts.shift };
    if (opts.down !== false)
        window.dispatchEvent(new KeyboardEvent("keydown", init));
    if (opts.up !== false)
        window.dispatchEvent(new KeyboardEvent("keyup", init));
}
function pointer(type, at) {
    const ev = new PointerEvent(type, { clientX: at.x, clientY: at.y, button: 0, pointerType: "mouse", bubbles: true, cancelable: true });
    (type === "pointerup" ? window : hooks.canvas).dispatchEvent(ev);
}
const stick = (x, y) => {
    const m = Math.hypot(x, y);
    if (m < DEAD)
        return null;
    const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
    return { x: x * k, y: y * k };
};
/** Each frame: read the controller and act. */
export function pollPad(dt) {
    if (!hooks)
        return;
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected && p.mapping === "standard") ?? [...pads].find((p) => p && p.connected) ?? null;
    if (!pad) {
        if (lastIndex >= 0) {
            hooks.setWalk(null, false);
            lastIndex = -1;
        }
        hideCursor();
        return;
    }
    if (pad.index !== lastIndex) {
        prev = [];
        downAt = [];
        longFired = [];
        lastIndex = pad.index;
    }
    const now = performance.now() / 1000;
    const btn = pad.buttons.map((b) => b.pressed);
    const pressed = (i) => btn[i] && !prev[i];
    const released = (i) => !btn[i] && prev[i];
    btn.forEach((b, i) => { if (b && !prev[i]) {
        downAt[i] = now;
        longFired[i] = false;
    } });
    const heldFor = (i) => (btn[i] ? now - (downAt[i] ?? now) : 0);
    const left = stick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const right = stick(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    if (btn.some(Boolean) || left || right)
        setActive(true);
    if (hooks.menuOpen()) {
        hooks.setWalk(null, false);
        hideCursor();
        // Move: D-pad, or the left stick repeating like a held key.
        if (pressed(B.up))
            key("ArrowUp");
        if (pressed(B.down))
            key("ArrowDown");
        if (pressed(B.left))
            key("ArrowLeft");
        if (pressed(B.right))
            key("ArrowRight");
        const dir = left ? (Math.abs(left.x) > Math.abs(left.y) ? (left.x > 0 ? "ArrowRight" : "ArrowLeft") : left.y > 0 ? "ArrowDown" : "ArrowUp") : "";
        if (dir !== stickDir) {
            stickDir = dir;
            if (dir) {
                key(dir);
                stickNext = now + 0.35;
            }
        }
        else if (dir && now >= stickNext) {
            key(dir);
            stickNext = now + 0.12;
        }
        if (pressed(B.cross))
            key(" ");
        if (pressed(B.square))
            padConfirm();
        if (pressed(B.circle) && !padCancel())
            key(hooks.paused() ? "Escape" : "Backspace");
        // Tabs: L1/R1 the outer level, L2/R2 the inner one (the meals on the bill of fare).
        if (pressed(B.l1))
            key("Tab", { shift: true });
        if (pressed(B.r1))
            key("Tab");
        if (pressed(B.l2))
            key("PageUp");
        if (pressed(B.r2))
            key("PageDown");
        if (pressed(B.options))
            key("Escape");
    }
    else if (hooks.arranging()) {
        hooks.setWalk(null, false);
        // The cursor: a mouse driven by the left stick.
        if (!cursor)
            cursor = hooks.keeperOnScreen();
        if (left) {
            const r = hooks.canvas.getBoundingClientRect();
            cursor = {
                x: Math.max(r.left, Math.min(r.right - 1, cursor.x + left.x * CURSOR_SPEED * dt)),
                y: Math.max(r.top, Math.min(r.bottom - 1, cursor.y + left.y * CURSOR_SPEED * dt)),
            };
            pointer("pointermove", cursor);
        }
        showCursor(cursor);
        if (pressed(B.cross)) {
            pointer("pointermove", cursor);
            pointer("pointerdown", cursor);
            pointer("pointerup", cursor);
        }
        if (pressed(B.circle))
            key("Escape");
        if (pressed(B.square))
            key("b");
        if (pressed(B.triangle))
            key("a");
        if (pressed(B.l2))
            key("Delete");
        if (pressed(B.options))
            key("p");
    }
    else {
        hideCursor();
        cursor = null;
        // Walking: screen directions; all the way over, or R2, runs.
        const run = btn[B.r2] || (left ? Math.hypot(left.x, left.y) > 0.95 : false);
        hooks.setWalk(left, run);
        // ✕ is Space: press and hold.
        if (pressed(B.cross))
            key(" ", { up: false });
        if (released(B.cross))
            key(" ", { down: false });
        if (pressed(B.l1))
            key("Tab", { shift: true });
        if (pressed(B.r1))
            key("Tab");
        // Square is F: hold to hurry what's cooking at the target.
        if (pressed(B.square))
            key("f", { up: false });
        if (released(B.square))
            key("f", { down: false });
        // The cards: ←/→ choose, ↑ plays. ↓ puts down: a tap puts a dish back (or a tray down), a hold empties a pot.
        if (pressed(B.left))
            hooks.cardStep(-1);
        if (pressed(B.right))
            hooks.cardStep(1);
        if (pressed(B.up))
            hooks.playCard();
        if (btn[B.down] && !longFired[B.down] && heldFor(B.down) >= HOLD) {
            longFired[B.down] = true;
            key("x");
        }
        if (released(B.down) && !longFired[B.down])
            key("r");
        // Right stick: zoom up and down; a push left or right turns the camera.
        if (right && Math.abs(right.y) > Math.abs(right.x))
            hooks.zoomBy(Math.pow(1.8, -right.y * dt));
        if (right && Math.abs(right.x) > 0.7 && Math.abs(right.x) > Math.abs(right.y)) {
            if (!turned) {
                turned = true;
                key(right.x > 0 ? "." : ",");
            }
        }
        else if (!right || Math.abs(right.x) < 0.3)
            turned = false;
        if (pressed(B.r3))
            key("v");
        if (pressed(B.options))
            key("p");
        if (pressed(B.touchpad))
            key("h");
    }
    prev = btn;
}
function showCursor(at) {
    if (!cursorEl) {
        cursorEl = document.createElement("div");
        cursorEl.id = "padcursor";
        document.body.appendChild(cursorEl);
    }
    cursorEl.style.display = "block";
    cursorEl.style.transform = `translate(${at.x}px, ${at.y}px)`;
}
function hideCursor() {
    if (cursorEl)
        cursorEl.style.display = "none";
}
