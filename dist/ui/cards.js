// Cards: the visual language for things you pick (ingredients, snacks, pies, and more later).
// Shared building blocks so every card screen looks and handles the same.
export function chip(tag, highlight = false) {
    return `<span class="chip ${highlight ? "new" : ""}">${tag}</span>`;
}
export function card(c) {
    return `<div class="icard ${c.on ? "on" : ""} ${c.off ? "off" : ""} ${c.focus ? "focus" : ""}" data-pick="${c.pick}"${c.title ? ` title="${c.title}"` : ""}>
      <span class="ic">${c.icon}</span>${c.name}
      ${c.note ? `<div class="note">${c.note}</div>` : ""}
      ${c.tags?.length ? `<div class="chips">${c.tags.map((t) => chip(t)).join("")}</div>` : ""}
    </div>`;
}
export function grid(cards) {
    return `<div class="cards">${cards.map(card).join("")}</div>`;
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
        switch (e.key) {
            case "ArrowLeft":
            case "a":
            case "A": return to(focus() - 1);
            case "ArrowRight":
            case "d":
            case "D": return to(focus() + 1);
            case "ArrowUp":
            case "w":
            case "W": return to(focus() - cols);
            case "ArrowDown":
            case "s":
            case "S": return to(focus() + cols);
            case " ":
            case "Enter":
                use(focus());
                return true;
        }
        return false;
    };
}
