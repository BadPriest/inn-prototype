// Plain keyboard menus and dialogs. Arrows / Enter / Backspace / Esc, or the mouse.
const stack = [];
let root;
let onModalChange = () => { };
export function initMenus(el, modalChanged) {
    root = el;
    onModalChange = modalChanged;
}
export function menuOpen() {
    return stack.length > 0;
}
export function openMenu(spec) {
    const first = spec.items.findIndex((i) => !i.disabled);
    stack.push({ spec, index: Math.max(0, first) });
    render();
}
/** Replace the current menu (for multi-step flows without growing the back stack). */
export function replaceMenu(spec) {
    stack.pop();
    openMenu(spec);
}
export function back() {
    const top = stack.pop();
    if (top && stack.length === 0)
        top.spec.onClose?.();
    render();
}
export function closeAll() {
    const had = stack.length > 0;
    const bottom = stack[0];
    stack.length = 0;
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
            move(-1);
            return true;
        case "ArrowDown":
        case "s":
        case "S":
            move(1);
            return true;
        case "Enter":
        case " ": {
            const it = items[top.index];
            if (it && !it.disabled)
                it.action();
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
    onModalChange(isModal());
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
    const hint = s.modal && stack.length === 1 ? "↑↓ choose · Enter confirm" : "↑↓ choose · Enter confirm · Backspace back · Esc close";
    root.innerHTML = `
    <div class="menu ${s.modal ? "modal" : ""}">
      <div class="menu-head">
        ${stack.length > 1 ? `<button class="mbtn" data-act="back" aria-label="Back">‹</button>` : ""}
        <div class="menu-title">${s.title}</div>
        ${!isModal() ? `<button class="mbtn" data-act="close" aria-label="Close">✕</button>` : ""}
      </div>
      ${s.body ? `<div class="menu-body">${s.body}</div>` : ""}
      <div class="menu-items">
        ${s.items.map((it, i) => `
          <div class="menu-item ${i === top.index ? "sel" : ""} ${it.disabled ? "dis" : ""}" data-i="${i}">
            <span>${it.label}</span>${it.sub ? `<span class="sub">${it.sub}</span>` : ""}
          </div>`).join("")}
      </div>
      <div class="menu-hint">${hint}</div>
    </div>`;
    root.querySelector('[data-act="back"]')?.addEventListener("click", () => back());
    root.querySelector('[data-act="close"]')?.addEventListener("click", () => closeAll());
    root.querySelectorAll(".menu-item").forEach((el) => {
        el.onclick = () => {
            const i = Number(el.dataset.i);
            const it = s.items[i];
            if (it && !it.disabled) {
                top.index = i;
                it.action();
            }
        };
    });
}
