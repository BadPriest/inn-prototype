// Cards: the visual language for things you pick (dishes, ingredients, equipment, desk screens...).
// Shared building blocks so every card screen looks and handles the same.
//
// A card has two sizes. At rest it shows what you need to choose: icon, name, one key fact, its state,
// and tags where they matter (food). With the cursor on it (keys, controller, mouse) it lifts, and a
// drawer under it adds the rest: what it is, and what picking it does. Text never mixes kinds:
//   fact     what it is or costs (plain)            status   its state now (small, coloured by `tone`)
//   detail   more about it, in the drawer           does     what picking it does, in the drawer
//   flavour  a line of colour, in the drawer, italic and quiet
export function chip(tag, highlight = false) {
    return `<span class="chip ${highlight ? "new" : ""}">${tag}</span>`;
}
export function card(c) {
    const open = !!c.open;
    const have = c.have ?? c.owned ?? 0;
    const extra = `${c.detail ? `<div class="detail">${c.detail}</div>` : ""}${c.flavour ? `<div class="flavour">${c.flavour}</div>` : ""}${c.does ? `<div class="does">${c.does}</div>` : ""}`;
    // Open cards (a few big choices) show it all on the face; the rest keep it for the drawer.
    const drawer = !open && (c.detail || c.does || c.flavour) ? `<div class="more">${extra}</div>` : "";
    const cls = ["icard", c.on && "on", c.off && "off", c.focus && "focus", have && "has", c.warn && "warn", drawer && "drawer"].filter(Boolean).join(" ");
    return `<div class="${cls}" data-pick="${c.pick}"${c.title ? ` title="${c.title}"` : ""}>
      <div class="face">
        <span class="ic">${c.icon}</span><span class="nm">${c.name}</span>
        ${c.fact ? `<div class="fact">${c.fact}</div>` : ""}
        ${c.where ? `<div class="where">${c.where}</div>` : ""}
        ${c.status ? `<div class="status ${c.tone ?? ""}">${c.status}</div>` : ""}
        ${c.note ? `<div class="note">${c.note}</div>` : ""}
        ${c.tags?.length ? `<div class="chips">${c.tags.map((t) => chip(t)).join("")}</div>` : ""}
        ${open && extra ? `<div class="open">${extra}</div>` : ""}
      </div>
      ${have ? `<div class="have">You have ${have}</div>` : ""}
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
 * After a menu is drawn: every card in a grid as tall as the tallest, and the drawer of the card under
 * the cursor. The drawer floats over the menu (outside its scrolling part, so it's never cut off): below
 * the card, or above it when there's no room below. The mouse shows the card it's over; otherwise the
 * keyboard's.
 */
export function settleCards(root) {
    root.querySelectorAll(".cards").forEach((g) => {
        const cs = [...g.querySelectorAll(":scope > .icard")];
        if (!cs.length)
            return;
        cs.forEach((c) => { c.style.height = ""; });
        const h = Math.max(...cs.map((c) => c.offsetHeight));
        cs.forEach((c) => { c.style.height = `${h}px`; });
    });
    const tip = document.createElement("div");
    tip.className = "cardtip";
    root.appendChild(tip);
    const focused = () => root.querySelector(".icard.focus");
    const show = (c, hover = false) => {
        const more = c?.querySelector(".more");
        if (!c || !more) {
            tip.style.display = "none";
            return;
        }
        tip.innerHTML = more.innerHTML;
        tip.classList.toggle("hover", hover);
        tip.style.display = "block";
        const z = Number(getComputedStyle(document.documentElement).getPropertyValue("--ui")) || 1;
        const r = c.getBoundingClientRect(), box = root.getBoundingClientRect();
        const w = Math.max(r.width, 190 * z);
        tip.style.width = `${w / z}px`;
        const th = tip.getBoundingClientRect().height;
        let left = r.left - box.left + r.width / 2 - w / 2;
        left = Math.max(6, Math.min(box.width - w - 6, left));
        let top = r.bottom - box.top + 4;
        if (top + th > box.height - 6)
            top = r.top - box.top - th - 4;
        tip.style.left = `${left / z}px`;
        tip.style.top = `${Math.max(6, top) / z}px`;
    };
    root.querySelectorAll(".icard").forEach((c) => {
        c.addEventListener("mouseenter", () => show(c, true));
        c.addEventListener("mouseleave", () => show(focused()));
    });
    root.querySelector(".menu-view")?.addEventListener("scroll", () => show(focused()));
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
/**
 * Arrow keys move the focus over a grid of `count` cards; Space uses the focused card.
 * Returns a key handler for a MenuView. Enter also uses the focused card; a screen with a main button
 * (COOK) handles Enter itself before calling this.
 */
export function gridKeys(count, focus, setFocus, use) {
    return (e) => {
        const n = count();
        if (!n)
            return false;
        const cols = columns();
        const to = (i) => { setFocus((i + n) % n); return true; };
        // Up and down stop at the edge rather than wrapping: a short last row has nothing below some cards.
        const row = (by) => {
            const i = focus() + by * cols;
            if (i < 0 || i >= n) {
                const lastRow = Math.floor((n - 1) / cols) * cols;
                return to(by > 0 ? (focus() >= lastRow ? focus() : n - 1) : focus());
            }
            return to(i);
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
            case "W": return row(-1);
            case "ArrowDown":
            case "s":
            case "S": return row(1);
            case " ":
            case "Enter":
                use(focus());
                return true;
        }
        return false;
    };
}
