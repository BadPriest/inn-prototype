// Cards: the visual language for things you pick (dishes, ingredients, equipment, desk screens...).
// Shared building blocks so every card screen looks and handles the same.
//
// A card has two sizes. At rest it shows what you need to choose: icon, name, one key fact, its state,
// and tags where they matter (food). With the cursor on it (keys, controller, mouse) it grows in place,
// animated, and the rest fades in inside it: what it is, and what picking it does. Text never mixes kinds:
//   fact     what it is or costs (plain)            status   its state now (small, coloured by `tone`)
//   detail   more about it, when grown              does     what picking it does, when grown
//   flavour  a line of colour, when grown, italic and quiet

export function chip(tag: string, highlight = false): string {
  return `<span class="chip ${highlight ? "new" : ""}">${tag}</span>`;
}

export interface CardSpec {
  pick: string; // value handed to the view's onPick
  icon: string;
  name: string;
  fact?: string; // one key fact at rest: a price, a count, "6 on the board"
  status?: string; // its state: "on the table now", "short 1s 4d"
  tone?: "good" | "warn" | "muted"; // colours the status
  tags?: string[];
  detail?: string; // the drawer: more about it
  does?: string; // the drawer: what picking it does ("Opens the shop", "Takes it off the board")
  flavour?: string; // the drawer: a quiet italic line
  have?: number; // how many you have: a band across the foot, "You have n"
  on?: boolean; // chosen / current
  off?: boolean; // not available right now
  focus?: boolean; // keyboard focus
  warn?: boolean; // needs your attention: a pulsing amber border
  title?: string; // hover text
  open?: boolean; // show the drawer's text on the face (a few big choices)
  /** @deprecated older screens: a small line under the name. New cards use fact / status. */
  note?: string;
  /** @deprecated older screens: where a dish is made. New cards use fact. */
  where?: string;
  /** @deprecated use have */
  owned?: number;
}

export function card(c: CardSpec): string {
  const open = !!c.open;
  const have = c.have ?? c.owned ?? 0;
  const extra = `${c.detail ? `<div class="detail">${c.detail}</div>` : ""}${c.flavour ? `<div class="flavour">${c.flavour}</div>` : ""}${c.does ? `<div class="does">${c.does}</div>` : ""}`;
  // Open cards (a few big choices) show it all on the face; the rest keep it for the drawer.
  const drawer = !open && (c.detail || c.does || c.flavour) ? `<div class="more">${extra}</div>` : "";
  const cls = ["icard", c.on && "on", c.off && "off", c.focus && "focus", have && "has", c.warn && "warn", drawer && "drawer", open && "isopen"].filter(Boolean).join(" ");
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
export function grid(cards: CardSpec[], opts: { cols?: number; size?: "s" | "m" | "l"; open?: boolean } = {}): string {
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
export function settleCards(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".cards").forEach((g) => {
    const cs = [...g.querySelectorAll<HTMLElement>(":scope > .icard")];
    if (!cs.length) return;
    cs.forEach((c) => { c.style.height = ""; });
    const h = Math.max(...cs.map((c) => c.offsetHeight));
    cs.forEach((c) => { c.style.height = `${h}px`; });
  });
  let zoom: HTMLElement | null = null;
  let shown: HTMLElement | null = null;
  const focused = () => root.querySelector<HTMLElement>(".icard.focus");
  const show = (c: HTMLElement | null, animate = true) => {
    const more = c?.querySelector<HTMLElement>(".more");
    if (!c || !more) { zoom?.remove(); zoom = null; shown = null; return; }
    if (c === shown && animate) return;
    zoom?.remove();
    shown = c;
    const z = Number(getComputedStyle(document.documentElement).getPropertyValue("--ui")) || 1;
    const r = c.getBoundingClientRect(), box = root.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = `${c.className} zoomed`;
    el.dataset.pick = c.dataset.pick;
    el.innerHTML = `${c.querySelector(".face")?.outerHTML ?? ""}<div class="open">${more.innerHTML}</div>${c.querySelector(".have")?.outerHTML ?? ""}`;
    root.appendChild(el);
    zoom = el;
    // Where it ends up: wider, as tall as its text needs, centred on the card and kept on screen.
    const w = Math.max(r.width * 1.45, 210 * z);
    el.style.width = `${w / z}px`;
    el.style.height = "auto";
    const h = Math.max(el.getBoundingClientRect().height, r.height * 1.12);
    const left = Math.max(6, Math.min(box.width - w - 6, r.left - box.left + r.width / 2 - w / 2));
    const top = Math.max(6, Math.min(box.height - h - 6, r.top - box.top + r.height / 2 - h / 2));
    const place = (x: number, y: number, ww: number, hh: number) => {
      el.style.left = `${x / z}px`; el.style.top = `${y / z}px`; el.style.width = `${ww / z}px`; el.style.height = `${hh / z}px`;
    };
    if (!animate) { place(left, top, w, h); el.classList.add("grown"); return; }
    place(r.left - box.left, r.top - box.top, r.width, r.height); // from the card itself...
    void el.offsetWidth;
    el.classList.add("grown");
    place(left, top, w, h); // ...to its grown size
    el.addEventListener("click", () => c.click());
    el.addEventListener("mouseleave", (e) => {
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.(".cards .icard") as HTMLElement | null;
      show(to ?? focused());
    });
  };
  root.querySelectorAll<HTMLElement>(".cards .icard").forEach((c) => {
    c.addEventListener("mouseenter", () => show(c));
  });
  root.querySelector(".menu-view")?.addEventListener("scroll", () => { const c = shown; shown = null; show(c, false); });
  show(focused());
}

/** How many cards fit in a row right now (the grid wraps to the screen). */
export function columns(): number {
  const cards = [...document.querySelectorAll<HTMLElement>(".cards .icard")];
  if (!cards.length) return 1;
  const top = cards[0].offsetTop;
  return Math.max(1, cards.filter((c) => c.offsetTop === top).length);
}

/**
 * Arrow keys move the focus over a grid of `count` cards; Space uses the focused card.
 * Returns a key handler for a MenuView. Enter also uses the focused card; a screen with a main button
 * (COOK) handles Enter itself before calling this.
 */
export function gridKeys(count: () => number, focus: () => number, setFocus: (i: number) => void, use: (i: number) => void) {
  return (e: KeyboardEvent): boolean => {
    const n = count();
    if (!n) return false;
    const cols = columns();
    const to = (i: number) => { setFocus((i + n) % n); return true; };
    // Up and down stop at the edge rather than wrapping: a short last row has nothing below some cards.
    const row = (by: number) => {
      const i = focus() + by * cols;
      if (i < 0 || i >= n) { const lastRow = Math.floor((n - 1) / cols) * cols; return to(by > 0 ? (focus() >= lastRow ? focus() : n - 1) : focus()); }
      return to(i);
    };
    switch (e.key) {
      case "ArrowLeft": case "a": case "A": return to(focus() - 1);
      case "ArrowRight": case "d": case "D": return to(focus() + 1);
      case "ArrowUp": case "w": case "W": return row(-1);
      case "ArrowDown": case "s": case "S": return row(1);
      case " ": case "Enter": use(focus()); return true;
    }
    return false;
  };
}
