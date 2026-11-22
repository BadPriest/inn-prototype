// Cards: the visual language for things you pick (dishes, ingredients, equipment, desk screens...).
// Shared building blocks so every card screen looks and handles the same.
//
// A card has two sizes. At rest it shows what you need to choose: icon, name, one key fact, its state,
// and tags where they matter (food). With the cursor on it (keys, controller, mouse) it grows in place,
// animated, and the rest fades in inside it: what it is, and what picking it does. Text never mixes kinds:
//   fact     what it is or costs (plain)            status   its state now (small, coloured by `tone`)
//   detail   more about it, when grown              does     what picking it does, when grown
//   flavour  a line of colour, when grown, italic and quiet
import { padActive } from "../gamepad.js";
export function chip(tag, highlight = false) {
    return `<span class="chip ${highlight ? "new" : ""}">${tag}</span>`;
}
/** A section of a card screen: its name, and a line on what to do there. Cards (grid()) follow it. */
export const heading = (title, note) => `<div class="sec-h"><h4>${title}</h4><small>${note}</small></div>`;
/** A stage's colour, by what it does to a dish: costs it (taste or price), fresh, or past fresh but harmless. */
export const stageTone = (index, e) => (e.tastePenalty < 0 || e.priceFactor < 1 ? "cost" : index === 0 ? "fresh" : "past");
function bandHtml(b) {
    return `<div class="band b-${b.tone}">${b.shuffle ? `<button class="shuffle" data-pick="${b.shuffle}" title="Shuffle: the next stage on top">⇄</button>` : ""}<span class="bl">${b.label}</span>${b.at ? `<span class="at">${b.at}</span>` : ""}</div>`;
}
function countHtml(c) {
    return `<div class="count"><button class="cminus" data-pick="${c.minus}"${c.n ? "" : " disabled"} title="Take one off">−</button><span class="cn">${c.n}</span><button class="cplus" data-pick="${c.plus}"${c.plusOff ? " disabled" : ""} title="Add one">+</button></div>`;
}
/** The cards stacked under one: each peeks out behind it, its stage's band showing. */
const underCards = (u) => u.map((t, k) => `<i class="uc b-${t}" style="--k:${k + 1}"></i>`).reverse().join("");
// ---------------------------------------------------------------------------
// The feel of a card in the hand: it tilts towards the pointer with a sheen across it, and the one
// picked up turns over to its back (F, right-click, R3 on a controller); the right stick tilts it.
/** Tilt a card: x and y from -1 to 1 (right, down), as the pointer or the right stick puts them. */
function tilt(el, x, y) {
    el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 9).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(50 + x * 50).toFixed(1)}%`);
    el.style.setProperty("--my", `${(50 + y * 50).toFixed(1)}%`);
}
function untilt(el) {
    for (const v of ["--rx", "--ry", "--mx", "--my"])
        el.style.removeProperty(v);
}
function followPointer(el) {
    el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        tilt(el, ((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    });
    el.addEventListener("pointerleave", () => untilt(el));
}
/** The card picked up now, if any. */
const pickedUp = () => document.querySelector(".icard.zoomed");
/** Which card is turned over (its pick), so it stays turned when the screen redraws. */
let turned = null;
/** The mouse picks cards up only once it has moved since the last key: a still pointer doesn't steal the keys' card when the screen redraws under it. */
let pointerLive = false;
let lastX = -1, lastY = -1;
window.addEventListener("keydown", () => { pointerLive = false; }, true);
window.addEventListener("pointermove", (e) => {
    if (!e.isTrusted || (Math.abs(e.clientX - lastX) < 2 && Math.abs(e.clientY - lastY) < 2))
        return;
    lastX = e.clientX;
    lastY = e.clientY;
    pointerLive = true;
}, true);
/** Turn the card that's picked up over, or back. False if none is picked up or it has no back. */
export function flipCard() {
    const el = pickedUp();
    if (!el?.querySelector(".side.back"))
        return false;
    el.classList.toggle("flipped");
    turned = el.classList.contains("flipped") ? el.dataset.pick ?? null : null;
    fitters.get(el)?.();
    return true;
}
/** Each card picked up resizes to the side showing: the front's height face up, the back's (as far as the menu allows) turned over. */
const fitters = new WeakMap();
/** The right stick on a controller: tilts the card picked up (or the one with the focus). */
export function padTilt(x, y) {
    const el = pickedUp() ?? document.querySelector(".menu-view .icard.focus");
    if (!el)
        return;
    if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01)
        untilt(el);
    else
        tilt(el, x, y);
}
export function card(c) {
    const open = !!c.open;
    const have = c.have ?? 0;
    const extra = `${c.detail ? `<div class="detail">${c.detail}</div>` : ""}${c.flavour ? `<div class="flavour">${c.flavour}</div>` : ""}${c.does ? `<div class="does">${c.does}</div>` : ""}`;
    // Open cards (a few big choices) show it all on the face; the rest keep it for the drawer.
    const drawer = !open && (c.detail || c.does || c.flavour) ? `<div class="more">${extra}</div>` : "";
    const cls = ["icard", c.on && "on", c.off && "off", c.focus && "focus", have && "has", c.warn && "warn", drawer && "drawer", open && "isopen", c.sub && "subbed", c.band && "banded", c.under?.length && "deck", c.count && "counted"].filter(Boolean).join(" ");
    return `<div class="${cls}" data-pick="${c.pick}"${c.title ? ` title="${c.title}"` : ""}>
      ${underCards(c.under ?? [])}${c.on && !c.count ? `<i class="seal">✓</i>` : ""}
      ${c.band ? bandHtml(c.band) : ""}
      <div class="face">
        <span class="ic">${c.icon}</span><span class="nm">${c.name}</span>${c.sub ? `<div class="sub">${c.sub}</div>` : ""}
        ${c.fact ? `<div class="fact">${c.fact}</div>` : ""}
        ${c.status ? `<div class="status ${c.tone ?? ""}">${c.status}</div>` : ""}
        ${c.body ? `<div class="body">${c.body}</div>` : ""}
        ${c.tags?.length ? `<div class="chips">${c.tags.map((t) => chip(t)).join("")}</div>` : ""}
        ${c.cta ? `<div class="cta">${c.cta} <span class="arr">→</span></div>` : ""}
        ${open && extra ? `<div class="open">${extra}</div>` : ""}
      </div>
      ${have ? `<div class="have">You have ${have}</div>` : ""}
      ${c.count ? countHtml(c.count) : ""}
      ${drawer}
    </div>`;
}
/**
 * Cards in balanced rows: a fixed card width, rows centred (seven cards sit as four and three), every
 * card the same height. `cols` caps the row; left out, it's picked from the count.
 */
export function grid(cards, opts = {}) {
    const n = cards.length;
    const cols = opts.cols ?? (n <= 4 ? n : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6);
    return `<div class="cards size-${opts.size ?? "m"}" style="--cols:${Math.max(1, cols)}">${cards.map((c) => card({ ...c, open: c.open ?? opts.open })).join("")}</div>`;
}
/**
 * After a menu is drawn: every card in a grid as tall as the tallest, and the card under the cursor grown.
 * The grown card is a copy laid over the menu (outside its scrolling part, so it's never cut off): it
 * starts at the card's own size and place and grows around it, kept on screen, and its extra text fades
 * in. The mouse grows the card it's over; otherwise the keyboard's card is grown.
 */
export function settleCards(root) {
    root.querySelectorAll(".icard .face > .body").forEach((b) => b.classList.toggle("clipped", b.scrollHeight > b.clientHeight + 1));
    let zoom = null;
    let shown = null;
    const focused = () => root.querySelector(".icard.focus");
    const show = (c, animate = true) => {
        const more = c?.querySelector(".more");
        root.querySelectorAll(".cards .icard").forEach((x) => x.style.removeProperty("--shift"));
        if (!c) {
            zoom?.remove();
            zoom = null;
            shown = null;
            return;
        }
        if (c === shown && animate)
            return;
        zoom?.remove();
        shown = c;
        const z = Number(getComputedStyle(document.documentElement).getPropertyValue("--ui")) || 1;
        const r = c.getBoundingClientRect(), box = root.getBoundingClientRect();
        const el = document.createElement("div");
        el.className = `${c.className} zoomed`;
        el.dataset.pick = c.dataset.pick;
        // Picked up: the front as it lies, with what picking it does; the back has the rest to read.
        const box2 = document.createElement("div");
        box2.innerHTML = more?.innerHTML ?? "";
        const does = box2.querySelector(".does");
        does?.remove();
        const back = box2.innerHTML.trim();
        el.innerHTML = `${[...c.querySelectorAll(".uc")].map((u) => u.outerHTML).join("")}${c.querySelector(".seal")?.outerHTML ?? ""}<div class="flipper">
        <div class="side front">${c.querySelector(".band")?.outerHTML ?? ""}${c.querySelector(".face")?.outerHTML ?? ""}${does ? `<div class="open" style="border:none;margin:0;padding:0 10px 6px">${does.outerHTML}</div>` : ""}${c.querySelector(".have")?.outerHTML ?? ""}${c.querySelector(".count")?.outerHTML ?? ""}</div>
        ${back ? `<div class="side back"><div class="bk-name">${c.querySelector(".nm")?.innerHTML ?? ""}</div><div class="open">${back}</div></div>` : ""}
      </div>${back ? `<button class="flip-tab" title="Turn it over (F, right-click)"><span class="fa">↻</span><span class="fk">${padActive() ? "R3" : "F"}</span><span class="fw">flip</span></button>` : ""}`;
        if (back && turned === c.dataset.pick)
            el.classList.add("flipped");
        else
            turned = null;
        el.querySelector(".flip-tab")?.addEventListener("click", (e) => { e.stopPropagation(); flipCard(); });
        root.appendChild(el);
        zoom = el;
        // Where it ends up: wider, as tall as its text needs, centred on the card and kept on screen.
        const w = Math.max(r.width * 1.45, 210 * z);
        // The cards beside it in its row slide aside, so less of them is hidden under it.
        const shift = Math.min(14, ((w - r.width) / 2) * 0.5) / z;
        const row = [...(c.parentElement?.querySelectorAll(":scope > .icard") ?? [])].filter((x) => Math.abs(x.offsetTop - c.offsetTop) <= 4);
        const at = row.indexOf(c);
        row[at - 1]?.style.setProperty("--shift", `${-shift}px`);
        row[at + 1]?.style.setProperty("--shift", `${shift}px`);
        el.style.width = `${w / z}px`;
        el.style.height = "auto";
        // Kept inside the menu, below its tabs: centred on the card where there's room.
        const m = root.querySelector(".menu")?.getBoundingClientRect() ?? box;
        const v = root.querySelector(".menu-view")?.getBoundingClientRect() ?? m;
        const area = { left: m.left - box.left + 6, top: v.top - box.top + 2, right: m.right - box.left - 6, bottom: m.bottom - box.top - 6 };
        const frontH = Math.max(el.getBoundingClientRect().height, r.height * 1.12);
        const backEl = el.querySelector(".side.back");
        const backH = backEl ? Math.min(backEl.scrollHeight * z, area.bottom - area.top) : 0;
        const left = Math.max(area.left, Math.min(area.right - w, r.left - box.left + r.width / 2 - w / 2));
        const topFor = (h) => Math.max(area.top, Math.min(area.bottom - h, r.top - box.top + r.height / 2 - h / 2));
        const place = (x, y, ww, hh) => {
            el.style.left = `${x / z}px`;
            el.style.top = `${y / z}px`;
            el.style.width = `${ww / z}px`;
            el.style.height = `${hh / z}px`;
        };
        const heightNow = () => (el.classList.contains("flipped") ? Math.max(frontH, backH) : frontH);
        fitters.set(el, () => place(left, topFor(heightNow()), w, heightNow()));
        if (!animate) {
            place(left, topFor(heightNow()), w, heightNow());
            el.classList.add("grown");
        }
        else {
            place(r.left - box.left, r.top - box.top, r.width, r.height); // from the card itself...
            void el.offsetWidth;
            el.classList.add("grown");
            place(left, topFor(heightNow()), w, heightNow()); // ...to its grown size
        }
        el.addEventListener("contextmenu", (e) => { e.preventDefault(); flipCard(); });
        followPointer(el);
        el.addEventListener("click", (e) => {
            const inner = e.target.closest("[data-pick]");
            const twin = inner && inner !== el ? c.querySelector(`[data-pick="${inner.dataset.pick}"]`) : null;
            (twin ?? c).click();
        });
        el.addEventListener("mouseleave", (e) => {
            if (!pointerLive)
                return;
            turned = null; // put down: it lies face up again
            const to = e.relatedTarget?.closest?.(".cards .icard");
            show(to ?? focused());
        });
    };
    root.querySelectorAll(".cards .icard").forEach((c) => {
        c.addEventListener("mouseenter", () => { if (pointerLive)
            show(c); });
        c.addEventListener("pointermove", () => { if (pointerLive && shown !== c)
            show(c); });
        followPointer(c);
    });
    const view = root.querySelector(".menu-view");
    if (view)
        view.onscroll = () => { const c = shown; shown = null; show(c?.isConnected ? c : focused(), false); };
    show(focused());
}
/** How many cards fit in a row right now (the grid wraps to the screen). */
export function columns() {
    const cards = [...document.querySelectorAll(".cards .icard")];
    if (!cards.length)
        return 1;
    const top = cards[0].offsetTop;
    return Math.max(1, cards.filter((c) => c.offsetTop === top).length);
}
/** The cards on the open screen, in order (not the grown copy). */
const screenCards = () => [...document.querySelectorAll(".menu-view .cards .icard:not(.zoomed)")];
/**
 * The card to go to from card `from`, moving by sight: the nearest card whose middle lies that way,
 * across rows and sections (screens with several grids, rows that don't line up). -1 if there's none.
 */
function nearest(from, dx, dy) {
    // Where each card sits in the grid, not where it's drawn: the lift, tilt and nudge of a picked-up card
    // (scaled by the UI size) would otherwise put a card beside it "below" it.
    const cs = screenCards();
    const view = document.querySelector(".menu-view");
    const at = (el) => {
        let x = 0, y = 0;
        for (let e = el; e && e !== view; e = e.offsetParent) {
            x += e.offsetLeft;
            y += e.offsetTop;
        }
        return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight };
    };
    const a = cs[from] ? at(cs[from]) : null;
    if (!a)
        return -1;
    const step = Math.abs(dy) ? a.h / 2 : a.w / 2;
    let best = -1, bestScore = Infinity;
    cs.forEach((c, i) => {
        if (i === from)
            return;
        const b = at(c);
        const x = b.x - a.x, y = b.y - a.y;
        const along = x * dx + y * dy;
        const across = Math.abs(x * dy - y * dx);
        if (along < step)
            return;
        const score = along + across * 2.5;
        if (score < bestScore) {
            bestScore = score;
            best = i;
        }
    });
    return best;
}
/**
 * Arrow keys (and the D-pad) move the focus over the cards on screen; Space uses the focused card.
 * Returns a key handler for a card screen (CardScreen.nav). Left and right go to the card before and after (wrapping);
 * up and down go to the nearest card above or below, and stay put at the top and bottom rows. Enter is left
 * to the menu: it presses the screen's main button, or uses the focused card when there's none (menuKey).
 */
export function gridKeys(count, focus, setFocus, use) {
    return (e) => {
        const n = count();
        if (!n)
            return false;
        const to = (i) => { setFocus((i + n) % n); return true; };
        const vertical = (dy) => {
            const i = nearest(focus(), 0, dy);
            return i >= 0 && i < n ? to(i) : dy < 0;
        };
        switch (e.key) {
            case "ArrowLeft":
            case "a":
            case "A": return to(focus() - 1);
            case "ArrowRight":
            case "d":
            case "D": return to(focus() + 1);
            case "ArrowUp":
            case "w":
            case "W": return vertical(-1);
            case "ArrowDown":
            case "s":
            case "S": return vertical(1);
            case " ":
                use(focus());
                return true;
        }
        return false;
    };
}
