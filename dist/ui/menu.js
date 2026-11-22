// Menus, in two shapes. Lists and dialogs (MenuSpec): rows or buttons you move through, for settings, the
// pause menu, yes-or-no questions. Card screens (CardScreen): every screen of cards in the game, built the
// same way: a title, a subtitle saying what it's for and what to do, tabs, a summary panel, the cards, and
// at most three buttons under them: confirm, an alternative, cancel. Anything else a screen offers is a card.
// Arrows / Enter / Backspace / Esc, the mouse, or a controller (gamepad.ts turns it into the same keys).
import { flipCard, gridKeys, settleCards } from "./cards.js";
import { padActive, padGlyphs, padText } from "../gamepad.js";
const isScreen = (s) => "cards" in s;
const specOf = (o) => (o.screen ?? o.list);
const stack = [];
let root;
let onModalChange = () => { };
let onConfirm = () => { };
export function initMenus(el, modalChanged, confirmed) {
    root = el;
    onModalChange = modalChanged;
    if (confirmed)
        onConfirm = confirmed;
}
/** The confirm sound, for decisions made by keys or card picks rather than a confirmSound button. */
export function confirmed() {
    onConfirm();
}
function run(it) {
    if (it.confirmSound)
        onConfirm();
    it.action();
}
function press(a) {
    if (!a)
        return false;
    if (!a.disabled) {
        if (a.confirmSound)
            onConfirm();
        a.run();
    }
    return true;
}
export function menuOpen() {
    return stack.length > 0;
}
/** A card screen's cancel: its own, else Back (or Close at the bottom of the stack); none when it says false. */
function cancelOf(s) {
    if (s.cancel === false)
        return undefined;
    return s.cancel ?? { label: stack.length > 1 ? "Back" : "Close", run: back };
}
export function openMenu(spec) {
    if (isScreen(spec))
        stack.push({ screen: spec, index: 0 });
    else
        stack.push({ list: spec, index: spec.focus ?? Math.max(0, spec.items.findIndex((i) => !i.disabled)) });
    render();
}
/** Replace the current menu (for multi-step flows without growing the back stack). */
export function replaceMenu(spec) {
    stack.pop();
    openMenu(spec);
}
/**
 * A yes-or-no question in a modal: confirm (□ on a controller) and cancel (○). A `danger` question starts
 * on cancel, so a stray press doesn't do it.
 */
export function askChoice(o) {
    openMenu({
        title: o.title,
        modal: true,
        body: o.body,
        focus: o.danger ? 1 : 0,
        items: [
            { label: o.confirm, button: "primary", confirmSound: true, action: o.onConfirm },
            { label: o.cancel, button: "secondary", confirmSound: true, cancel: true, action: o.onCancel },
        ],
    });
}
/** □ on a controller: the confirm button; on a card screen without one, the focused card. */
export function padConfirm() {
    if (!stack.length)
        return;
    const top = stack[stack.length - 1];
    if (top.screen) {
        if (top.screen.onKey?.(new KeyboardEvent("keydown", { key: "Enter" })))
            return;
        if (!press(top.screen.confirm))
            top.screen.nav?.use(top.screen.nav.focus());
        return;
    }
    const items = top.list.items;
    const i = items.findIndex((it) => it.button === "primary" && !it.disabled);
    const it = items[i >= 0 ? i : top.index];
    if (it && !it.disabled) {
        top.index = i >= 0 ? i : top.index;
        run(it);
    }
}
/** △ on a controller: a card screen's alternative. False if there's none. */
export function padAlt() {
    const top = stack[stack.length - 1];
    return !!top?.screen && press(top.screen.alt);
}
/** ○ on a controller: the negative choice if there is one; false if not (it's then back or close). */
export function padCancel() {
    if (!stack.length)
        return false;
    const top = stack[stack.length - 1];
    if (top.screen)
        return press(cancelOf(top.screen));
    const it = top.list.items.find((x) => x.cancel && !x.disabled);
    if (!it)
        return false;
    run(it);
    return true;
}
export function back() {
    const top = stack.pop();
    if (top)
        specOf(top).onLeave?.();
    if (top && stack.length === 0)
        specOf(top).onClose?.();
    render();
}
export function closeAll() {
    const had = stack.length > 0;
    const bottom = stack[0];
    for (const o of stack.splice(0).reverse())
        specOf(o).onLeave?.();
    if (had)
        specOf(bottom).onClose?.();
    render();
}
function isModal() {
    return stack.some((s) => specOf(s).modal);
}
function stepTab(t, by) {
    if (!t || t.list.length < 2)
        return !!t;
    const i = t.list.findIndex((x) => x.id === t.current);
    t.pick(t.list[(i + by + t.list.length) % t.list.length].id);
    return true;
}
/** A card screen's keys. */
function screenKey(s, e) {
    if ((e.key === "f" || e.key === "F") && flipCard())
        return true;
    if (s.onKey?.(e))
        return true;
    if (e.key === "Tab" && s.tabs) {
        e.preventDefault();
        return stepTab(s.tabs, e.shiftKey ? -1 : 1);
    }
    if ((e.key === "PageUp" || e.key === "PageDown") && s.modes) {
        e.preventDefault();
        return stepTab(s.modes, e.key === "PageUp" ? -1 : 1);
    }
    if (e.key === "Enter") {
        if (!press(s.confirm))
            s.nav?.use(s.nav.focus());
        return true;
    }
    if (e.key === "1") {
        press(s.alt);
        return true;
    }
    if (e.key === "Backspace" || (e.key === "Escape" && isModal())) {
        if (!press(cancelOf(s)) && e.key === "Backspace" && !isModal())
            back();
        return true;
    }
    if (e.key === "Escape") {
        closeAll();
        return true;
    }
    if (s.nav && gridKeys(s.nav.count, s.nav.focus, s.nav.setFocus, s.nav.use)(e))
        return true;
    return true; // swallow other keys while a menu is open
}
/** Returns true if the menu handled the key. */
export function menuKey(e) {
    if (!stack.length)
        return false;
    const top = stack[stack.length - 1];
    if (top.screen)
        return screenKey(top.screen, e);
    const items = top.list.items;
    const move = (d) => {
        if (!items.length)
            return;
        let i = top.index;
        for (let n = 0; n < items.length; n++) {
            i = (i + d + items.length) % items.length;
            if (!items[i].disabled)
                break;
        }
        top.index = i;
        render();
    };
    switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
        case "ArrowLeft":
        case "a":
        case "A":
            move(-1);
            return true;
        case "ArrowDown":
        case "s":
        case "S":
        case "ArrowRight":
        case "d":
        case "D":
            move(1);
            return true;
        case "Enter":
        case " ": {
            const it = items[top.index];
            if (it && !it.disabled)
                run(it);
            return true;
        }
        case "Backspace":
            if (!(top.list.modal && stack.length === 1))
                back();
            return true;
        case "Escape":
            if (!isModal())
                closeAll();
            return true;
    }
    return true; // swallow other keys while a menu is open
}
const tabRow = (t, kind) => `<div class="${kind === "tab" ? "bf-tabs" : "bf-modes"}">${t.list.map((x) => `<button class="${x.id === t.current ? "on" : ""}" data-pick="${kind}:${x.id}">${x.label}</button>`).join("")}</div>`;
function render() {
    onModalChange(isModal() || stack.some((o) => specOf(o).holdsClock));
    if (!root)
        return;
    if (!stack.length) {
        root.innerHTML = "";
        root.style.display = "none";
        return;
    }
    const top = stack[stack.length - 1];
    root.style.display = "flex";
    const s = specOf(top);
    // Redrawing the same screen (a card picked, a tab changed) keeps where its view was scrolled to.
    const prevView = root.querySelector(".menu-view");
    const keepScroll = prevView && root.dataset.title === s.title ? prevView.scrollTop : 0;
    root.dataset.title = s.title;
    const head = `
      <div class="menu-head">
        ${stack.length > 1 ? `<button class="mbtn" data-act="back" aria-label="Back">‹</button>` : ""}
        <div class="menu-title">${s.title}${s.subtitle ? `<div class="menu-subtitle">${s.subtitle}</div>` : ""}</div>
        ${!isModal() ? `<button class="mbtn" data-act="close" aria-label="Close">✕</button>` : ""}
      </div>
      ${s.flavour ? `<div class="menu-flavour">${s.flavour}</div>` : ""}`;
    if (top.screen) {
        const sc = top.screen;
        const cancel = cancelOf(sc);
        const glyph = (k) => k === "tr"
            ? `<span class="pad-glyph tx g-tr">${padText("△")}</span><kbd class="key-glyph">1</kbd>`
            : `<span class="pad-glyph ${k}"></span>`;
        const btn = (a, k, cls) => `<button class="menu-btn ${cls}" data-act="${k}" ${a.disabled ? "disabled" : ""}><span class="btn-row">${glyph(k)}<span>${a.label}</span></span>${a.sub ? `<span class="sub">${a.sub}</span>` : ""}</button>`;
        const buttons = [sc.confirm ? btn(sc.confirm, "sq", "primary sel") : "", sc.alt ? btn(sc.alt, "tr", "secondary") : "", cancel ? btn(cancel, "ci", "secondary") : ""].join("");
        const parts = [sc.tabs ? (padActive() ? "L1/R1 tabs" : "Tab tabs") : "", sc.modes ? (padActive() ? "L2/R2 pages" : "PgUp/PgDn pages") : "", sc.keys ?? ""].filter(Boolean).join(" · ");
        const hint = padActive()
            ? padGlyphs(`D-pad choose · Space picks${parts ? ` · ${parts}` : ""}`)
            : `Arrows choose · Space picks${parts ? ` · ${parts}` : ""} · Esc close`;
        const pinned = [sc.tabs ? tabRow(sc.tabs, "tab") : "", sc.modes ? tabRow(sc.modes, "mode") : "", sc.summary ?? ""].join("");
        root.innerHTML = `
    <div class="menu wide ${sc.modal ? "modal" : ""}">${head}
      ${pinned ? `<div class="menu-pinned">${pinned}</div>` : ""}
      <div class="menu-view">${sc.cards}</div>
      ${buttons ? `<div class="menu-actions">${buttons}</div>` : ""}
      <div class="menu-hint">${hint}</div>
    </div>`;
        root.querySelectorAll("[data-pick]").forEach((el) => {
            el.onclick = (e) => {
                e.stopPropagation();
                const v = el.dataset.pick;
                if (v.startsWith("tab:") && sc.tabs) {
                    if (v.slice(4) !== sc.tabs.current)
                        sc.tabs.pick(v.slice(4));
                    return;
                }
                if (v.startsWith("mode:") && sc.modes) {
                    if (v.slice(5) !== sc.modes.current)
                        sc.modes.pick(v.slice(5));
                    return;
                }
                sc.onPick?.(v);
            };
        });
        root.querySelector('[data-act="sq"]')?.addEventListener("click", () => press(sc.confirm));
        root.querySelector('[data-act="tr"]')?.addEventListener("click", () => press(sc.alt));
        root.querySelector('[data-act="ci"]')?.addEventListener("click", () => press(cancel));
        settleCards(root);
        const view = root.querySelector(".menu-view");
        if (view) {
            view.scrollTop = keepScroll;
            root.querySelector(".menu-view .focus")?.scrollIntoView({ block: "nearest" }); // keys move the focus off-screen
        }
        sc.onMount?.(root);
    }
    else {
        const l = top.list;
        const onlyButtons = l.items.length > 0 && l.items.every((it) => it.button);
        const hint = padActive()
            ? padGlyphs(`D-pad choose · Space confirms${l.modal && stack.length === 1 ? "" : " · ○ back"}`)
            : l.modal && stack.length === 1 ? `${onlyButtons ? "←→" : "↑↓"} choose · Enter confirm` : "↑↓ choose · Enter confirm · Backspace back · Esc close";
        const row = (it, i) => `
          <div class="menu-item ${i === top.index ? "sel" : ""} ${it.disabled ? "dis" : ""}" data-i="${i}">
            <span>${it.label}</span>${it.sub ? `<span class="sub">${it.sub}</span>` : ""}
          </div>`;
        const glyph = (it) => (it.button === "primary" ? `<span class="pad-glyph sq"></span>` : it.cancel ? `<span class="pad-glyph ci"></span>` : "");
        const btn = (it, i) => `<button class="menu-btn ${it.button} ${i === top.index ? "sel" : ""}" data-i="${i}" ${it.disabled ? "disabled" : ""}><span class="btn-row">${glyph(it)}<span>${it.label}</span></span>${it.sub ? `<span class="sub">${it.sub}</span>` : ""}</button>`;
        const listed = l.items.map((it, i) => (it.button ? "" : row(it, i))).join("");
        const buttons = l.items.map((it, i) => (it.button ? btn(it, i) : "")).join("");
        root.innerHTML = `
    <div class="menu ${l.modal ? "modal" : ""}">${head}
      ${l.body ? `<div class="menu-body">${l.body}</div>` : ""}
      ${listed ? `<div class="menu-items">${listed}</div>` : ""}
      ${buttons ? `<div class="menu-actions">${buttons}</div>` : ""}
      <div class="menu-hint">${hint}</div>
    </div>`;
        root.querySelectorAll(".menu-item, .menu-btn").forEach((el) => {
            el.onclick = () => {
                const i = Number(el.dataset.i);
                const it = l.items[i];
                if (it && !it.disabled) {
                    top.index = i;
                    run(it);
                }
            };
        });
        settleCards(root);
    }
    root.querySelector('[data-act="back"]')?.addEventListener("click", () => back());
    root.querySelector('[data-act="close"]')?.addEventListener("click", () => closeAll());
}
