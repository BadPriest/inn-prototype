// Plain keyboard menus and dialogs. Arrows / Enter / Backspace / Esc, or the mouse.
import { flipCard, settleCards } from "./cards.js";
import { padActive, padGlyphs } from "../gamepad.js";
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
/** Run an item's action, with the confirm sound first if it asks for one. */
/** A button's action is running from the buttons under a card screen: a redraw keeps the focus there. */
let fromItems = false;
function run(it) {
    if (it.confirmSound)
        onConfirm();
    fromItems = !!stack[stack.length - 1]?.inItems;
    try {
        it.action();
    }
    finally {
        fromItems = false;
    }
}
export function menuOpen() {
    return stack.length > 0;
}
export function openMenu(spec) {
    const first = spec.items.findIndex((i) => !i.disabled);
    stack.push({ spec, index: spec.focus ?? Math.max(0, first) });
    render();
}
/** Replace the current menu (for multi-step flows without growing the back stack). */
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
/** □ on a controller: the screen's main button (what Enter does on screens that have one). */
export function padConfirm() {
    if (!stack.length)
        return;
    const top = stack[stack.length - 1];
    if (top.spec.view?.onKey?.(new KeyboardEvent("keydown", { key: "Enter" })))
        return;
    if (top.spec.view && top.spec.items.some((it) => it.button === "primary" && it.disabled))
        return;
    const i = top.spec.items.findIndex((it) => it.button === "primary" && !it.disabled);
    const it = top.spec.items[i >= 0 ? i : top.index];
    if (it && !it.disabled) {
        top.index = i >= 0 ? i : top.index;
        run(it);
    }
}
/** ○ on a controller: the negative choice if there is one; false if not (it's then back or close). */
export function padCancel() {
    if (!stack.length)
        return false;
    const it = stack[stack.length - 1].spec.items.find((x) => x.cancel && !x.disabled);
    if (!it)
        return false;
    run(it);
    return true;
}
export function replaceMenu(spec) {
    const was = stack.pop();
    openMenu(spec);
    // Still in the buttons (one was pressed and the screen redrawn): stay there, on the same one if it's still there.
    const top = stack[stack.length - 1];
    if (was?.inItems && fromItems && spec.view && spec.items.some((it) => !it.disabled)) {
        top.inItems = true;
        top.index = Math.min(was.index, spec.items.length - 1);
        if (spec.items[top.index].disabled)
            top.index = spec.items.findIndex((it) => !it.disabled);
        render();
    }
}
export function back() {
    const top = stack.pop();
    top?.spec.onLeave?.();
    if (top && stack.length === 0)
        top.spec.onClose?.();
    render();
}
export function closeAll() {
    const had = stack.length > 0;
    const bottom = stack[0];
    for (const o of stack.splice(0).reverse())
        o.spec.onLeave?.();
    if (had)
        bottom.spec.onClose?.();
    render();
}
function isModal() {
    return stack.some((s) => s.spec.modal);
}
/** Returns true if the menu handled the key. */
export function menuKey(e) {
    if (!stack.length)
        return false;
    const top = stack[stack.length - 1];
    const items = top.spec.items;
    const view = top.spec.view;
    // Card screens: the arrows move over the cards; down past the last row goes to the buttons under them,
    // and up from the buttons comes back.
    if (view && top.inItems) {
        const step = (d) => { let i = top.index; for (let n = 0; n < items.length; n++) {
            i = (i + d + items.length) % items.length;
            if (!items[i].disabled)
                break;
        } top.index = i; render(); return true; };
        switch (e.key) {
            case "ArrowUp":
            case "w":
            case "W":
                top.inItems = false;
                render();
                return true;
            case "ArrowLeft":
            case "a":
            case "A": return step(-1);
            case "ArrowRight":
            case "d":
            case "D":
            case "ArrowDown":
            case "s":
            case "S": return step(1);
            case " ":
            case "Enter": {
                const it = items[top.index];
                if (it && !it.disabled)
                    run(it);
                return true;
            }
        }
    }
    if (view && (e.key === "f" || e.key === "F") && flipCard())
        return true;
    if (view?.onKey?.(e))
        return true;
    if (view && !top.inItems && ["ArrowDown", "s", "S"].includes(e.key)) {
        const first = items.findIndex((it) => !it.disabled);
        if (first >= 0) {
            top.inItems = true;
            top.index = first;
            render();
        }
        return true;
    }
    if (view && ["ArrowUp", "w", "W", "ArrowLeft", "a", "A", "ArrowRight", "d", "D"].includes(e.key))
        return true;
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
            // On a card screen, Enter is the main button (Send it, Cook…); with none, it uses the focused card.
            if (e.key === "Enter" && top.spec.view) {
                const main = items.find((it) => it.button === "primary");
                if (main) {
                    if (!main.disabled)
                        run(main);
                }
                else
                    top.spec.view.onKey?.(new KeyboardEvent("keydown", { key: " " }));
                return true;
            }
            if (view && !top.inItems)
                return true; // on a card screen, ✕ presses a button only once the focus is down on them
            const it = items[top.index];
            if (it && !it.disabled)
                run(it);
            return true;
        }
        case "Backspace":
            if (!(top.spec.modal && stack.length === 1))
                back();
            return true;
        case "Escape":
            if (!isModal())
                closeAll();
            return true;
    }
    return true; // swallow other keys while a menu is open
}
function render() {
    onModalChange(isModal() || stack.some((o) => o.spec.holdsClock));
    if (!root)
        return;
    if (!stack.length) {
        root.innerHTML = "";
        root.style.display = "none";
        return;
    }
    const top = stack[stack.length - 1];
    root.style.display = "flex";
    const s = top.spec;
    const onlyButtons = s.items.length > 0 && s.items.every((it) => it.button);
    const hint = padActive()
        ? padGlyphs(s.view ? `D-pad choose · Space picks${s.view.html.includes('class="more"') ? " · R3 turns a card over" : ""}${s.view.keys ? ` · ${s.view.keys}` : ""}${s.items.some((it) => it.button === "primary") ? " · □ confirms" : ""} · ○ back` : `D-pad choose · Space confirms${s.modal && stack.length === 1 ? "" : " · ○ back"}`)
        : s.view ? `Arrows choose · Space picks${s.view.html.includes('class="more"') ? " · F turns a card over" : ""}${s.view.keys ? ` · ${s.view.keys}` : ""} · Enter confirms · Backspace back · Esc close`
            : s.modal && stack.length === 1 ? `${onlyButtons ? "←→" : "↑↓"} choose · Enter confirm` : "↑↓ choose · Enter confirm · Backspace back · Esc close";
    const row = (it, i) => `
          <div class="menu-item ${i === top.index && (!s.view || top.inItems) ? "sel" : ""} ${it.disabled ? "dis" : ""}" data-i="${i}">
            <span>${it.label}</span>${it.sub ? `<span class="sub">${it.sub}</span>` : ""}
          </div>`;
    const glyph = (it) => (it.button === "primary" ? `<span class="pad-glyph sq"></span>` : it.cancel ? `<span class="pad-glyph ci"></span>` : "");
    const btn = (it, i) => `<button class="menu-btn ${it.button} ${top.inItems ? (i === top.index ? "sel" : "") : i === top.index && (!s.view || it.button === "primary" || s.focus !== undefined) ? "sel" : ""}" data-i="${i}" ${it.disabled ? "disabled" : ""}><span class="btn-row">${glyph(it)}<span>${it.label}</span></span>${it.sub ? `<span class="sub">${it.sub}</span>` : ""}</button>`;
    const listed = s.items.map((it, i) => (it.button ? "" : row(it, i))).join("");
    const buttons = s.items.map((it, i) => (it.button ? btn(it, i) : "")).join("");
    // Redrawing the same screen (a card picked, a tab changed) keeps where its view was scrolled to.
    const prevView = root.querySelector(".menu-view");
    const prevTitle = root.dataset.title;
    const keepScroll = prevView && prevTitle === s.title ? prevView.scrollTop : 0;
    root.dataset.title = s.title;
    root.innerHTML = `
    <div class="menu ${s.modal ? "modal" : ""} ${s.view ? "wide" : ""} ${top.inItems ? "in-items" : ""}">
      <div class="menu-head">
        ${stack.length > 1 ? `<button class="mbtn" data-act="back" aria-label="Back">‹</button>` : ""}
        <div class="menu-title">${s.title}${s.subtitle ? `<div class="menu-subtitle">${s.subtitle}</div>` : ""}</div>
        ${!isModal() ? `<button class="mbtn" data-act="close" aria-label="Close">✕</button>` : ""}
      </div>
      ${s.flavour ? `<div class="menu-flavour">${s.flavour}</div>` : ""}
      ${s.body ? `<div class="menu-body">${s.body}</div>` : ""}
      ${s.view?.pinned ? `<div class="menu-pinned">${s.view.pinned}</div>` : ""}
      ${s.view ? `<div class="menu-view">${s.view.html}</div>` : ""}
      ${listed ? `<div class="menu-items">${listed}</div>` : ""}
      ${buttons ? `<div class="menu-actions">${buttons}</div>` : ""}
      <div class="menu-hint">${hint}</div>
    </div>`;
    if (s.view?.onPick) {
        const pick = s.view.onPick;
        root.querySelectorAll("[data-pick]").forEach((el) => { el.onclick = (e) => { e.stopPropagation(); pick(el.dataset.pick); }; });
    }
    settleCards(root);
    const view = root.querySelector(".menu-view");
    if (view) {
        view.scrollTop = keepScroll;
        root.querySelector(".menu-view .focus")?.scrollIntoView({ block: "nearest" }); // keys move the focus off-screen
    }
    s.view?.onMount?.(root);
    root.querySelector('[data-act="back"]')?.addEventListener("click", () => back());
    root.querySelector('[data-act="close"]')?.addEventListener("click", () => closeAll());
    root.querySelectorAll(".menu-item, .menu-btn").forEach((el) => {
        el.onclick = () => {
            const i = Number(el.dataset.i);
            const it = s.items[i];
            if (it && !it.disabled) {
                top.index = i;
                run(it);
            }
        };
    });
}
