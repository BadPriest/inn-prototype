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

export function chip(tag: string, highlight = false): string {
  return `<span class="chip ${highlight ? "new" : ""}">${tag}</span>`;
}

export interface CardSpec {
  pick: string; // value handed to the view's onPick
  icon: string;
  name: string;
  sub?: string; // a line right under the name, above its rule: "~14 min · tended · 7 servings"
  fact?: string; // one key fact at rest: a price, a count, "6 on the board"
  status?: string; // its state: "on the table now", "short 1s 4d"
  tone?: "good" | "warn" | "muted"; // colours the status
  tags?: string[];
  body?: string; // more on the face, above the tags: lines of icons, a flavour line
  cta?: string; // at the foot of the face: what picking it does ("Choose dishes and drinks"), with an arrow
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
  /** A labelled strip along the top edge: which stage of an ingredient this is, coloured by what it does to a dish. */
  band?: Band;
  /** Cards stacked under this one, top first, by the colour of their band: the other stages there are. */
  under?: BandTone[];
  /** How many of it you've chosen, with − and + (pick values handed to onPick): a counter across the foot, in place of the ✓. */
  count?: { n: number; minus: string; plus: string; plusOff?: boolean };
  /** @deprecated older screens: a small line under the name. New cards use fact / status. */
  note?: string;
  /** @deprecated older screens: where a dish is made. New cards use fact. */
  where?: string;
  /** @deprecated use have */
  owned?: number;
}

/** fresh: as good as it gets · past: past fresh, does no harm · cost: costs the dish something (taste, price). */
export type BandTone = "fresh" | "past" | "cost";
export interface Band { label: string; tone: BandTone; at?: string; shuffle?: string }
/** A stage's colour, by what it does to a dish: costs it (taste or price), fresh, or past fresh but harmless. */
export const stageTone = (index: number, e: { tastePenalty: number; priceFactor: number }): BandTone => (e.tastePenalty < 0 || e.priceFactor < 1 ? "cost" : index === 0 ? "fresh" : "past");

function bandHtml(b: Band): string {
  return `<div class="band b-${b.tone}">${b.shuffle ? `<button class="shuffle" data-pick="${b.shuffle}" title="Shuffle: the next stage on top">⇄</button>` : ""}<span class="bl">${b.label}</span>${b.at ? `<span class="at">${b.at}</span>` : ""}</div>`;
}
function countHtml(c: NonNullable<CardSpec["count"]>): string {
  return `<div class="count"><button class="cminus" data-pick="${c.minus}"${c.n ? "" : " disabled"} title="Take one off">−</button><span class="cn">${c.n}</span><button class="cplus" data-pick="${c.plus}"${c.plusOff ? " disabled" : ""} title="Add one">+</button></div>`;
}
/** The cards stacked under one: each peeks out behind it, its stage's band showing. */
const underCards = (u: BandTone[]): string => u.map((t, k) => `<i class="uc b-${t}" style="--k:${k + 1}"></i>`).reverse().join("");

// ---------------------------------------------------------------------------
// The feel of a card in the hand: it tilts towards the pointer with a sheen across it, and the one
// picked up turns over to its back (F, right-click, R3 on a controller); the right stick tilts it.

/** Tilt a card: x and y from -1 to 1 (right, down), as the pointer or the right stick puts them. */
function tilt(el: HTMLElement, x: number, y: number): void {
  el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
  el.style.setProperty("--rx", `${(-y * 9).toFixed(2)}deg`);
  el.style.setProperty("--mx", `${(50 + x * 50).toFixed(1)}%`);
  el.style.setProperty("--my", `${(50 + y * 50).toFixed(1)}%`);
}
function untilt(el: HTMLElement): void {
  for (const v of ["--rx", "--ry", "--mx", "--my"]) el.style.removeProperty(v);
}
function followPointer(el: HTMLElement): void {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    tilt(el, ((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  });
  el.addEventListener("pointerleave", () => untilt(el));
}

/** The card picked up now, if any. */
const pickedUp = (): HTMLElement | null => document.querySelector<HTMLElement>(".icard.zoomed");
/** Which card is turned over (its pick), so it stays turned when the screen redraws. */
let turned: string | null = null;

/** Turn the card that's picked up over, or back. False if none is picked up or it has no back. */
export function flipCard(): boolean {
  const el = pickedUp();
  if (!el?.querySelector(".side.back")) return false;
  el.classList.toggle("flipped");
  turned = el.classList.contains("flipped") ? el.dataset.pick ?? null : null;
  return true;
}

/** The right stick on a controller: tilts the card picked up (or the one with the focus). */
export function padTilt(x: number, y: number): void {
  const el = pickedUp() ?? document.querySelector<HTMLElement>(".menu-view .icard.focus");
  if (!el) return;
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) untilt(el); else tilt(el, x, y);
}

export function card(c: CardSpec): string {
  const open = !!c.open;
  const have = c.have ?? c.owned ?? 0;
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
        ${c.where ? `<div class="where">${c.where}</div>` : ""}
        ${c.status ? `<div class="status ${c.tone ?? ""}">${c.status}</div>` : ""}
        ${c.note ? `<div class="note">${c.note}</div>` : ""}
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
  const focused = () => (root.querySelector(".menu.in-items") ? null : root.querySelector<HTMLElement>(".icard.focus"));
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
    // Picked up: the front as it lies, with what picking it does; the back has the rest to read.
    const box2 = document.createElement("div"); box2.innerHTML = more.innerHTML;
    const does = box2.querySelector(".does"); does?.remove();
    const back = box2.innerHTML.trim();
    el.innerHTML = `${[...c.querySelectorAll(".uc")].map((u) => u.outerHTML).join("")}<div class="flipper">
        <div class="side front">${c.querySelector(".band")?.outerHTML ?? ""}${c.querySelector(".face")?.outerHTML ?? ""}${does ? `<div class="open" style="border:none;margin:0;padding:0 10px 6px">${does.outerHTML}</div>` : ""}${c.querySelector(".have")?.outerHTML ?? ""}${c.querySelector(".count")?.outerHTML ?? ""}</div>
        ${back ? `<div class="side back"><div class="bk-name">${c.querySelector(".nm")?.innerHTML ?? ""}</div><div class="open">${back}</div></div>` : ""}
      </div>${back ? `<button class="flip-tab" title="Turn it over (F, right-click)"><span class="fa">↻</span><span class="fk">${padActive() ? "R3" : "F"}</span><span class="fw">flip</span></button>` : ""}`;
    if (back && turned === c.dataset.pick) el.classList.add("flipped"); else turned = null;
    el.querySelector(".flip-tab")?.addEventListener("click", (e) => { e.stopPropagation(); flipCard(); });
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
    if (!animate) { place(left, top, w, h); el.classList.add("grown"); }
    else {
      place(r.left - box.left, r.top - box.top, r.width, r.height); // from the card itself...
      void el.offsetWidth;
      el.classList.add("grown");
      place(left, top, w, h); // ...to its grown size
    }
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); flipCard(); });
    followPointer(el);
    el.addEventListener("click", (e) => {
      const inner = (e.target as HTMLElement).closest<HTMLElement>("[data-pick]");
      const twin = inner && inner !== el ? c.querySelector<HTMLElement>(`[data-pick="${inner.dataset.pick}"]`) : null;
      (twin ?? c).click();
    });
    el.addEventListener("mouseleave", (e) => {
      turned = null; // put down: it lies face up again
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.(".cards .icard") as HTMLElement | null;
      show(to ?? focused());
    });
  };
  root.querySelectorAll<HTMLElement>(".cards .icard").forEach((c) => {
    c.addEventListener("mouseenter", () => show(c));
    followPointer(c);
  });
  const view = root.querySelector<HTMLElement>(".menu-view");
  if (view) view.onscroll = () => { const c = shown; shown = null; show(c?.isConnected ? c : focused(), false); };
  show(focused());
}

/** How many cards fit in a row right now (the grid wraps to the screen). */
export function columns(): number {
  const cards = [...document.querySelectorAll<HTMLElement>(".cards .icard")];
  if (!cards.length) return 1;
  const top = cards[0].offsetTop;
  return Math.max(1, cards.filter((c) => c.offsetTop === top).length);
}

/** The cards on the open screen, in order (not the grown copy). */
const screenCards = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(".menu-view .cards .icard:not(.zoomed)")];

/**
 * The card to go to from card `from`, moving by sight: the nearest card whose middle lies that way,
 * across rows and sections (screens with several grids, rows that don't line up). -1 if there's none.
 */
function nearest(from: number, dx: number, dy: number): number {
  const cs = screenCards();
  const r = cs[from]?.getBoundingClientRect();
  if (!r) return -1;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = -1, bestScore = Infinity;
  cs.forEach((c, i) => {
    if (i === from) return;
    const b = c.getBoundingClientRect();
    const x = b.left + b.width / 2 - cx, y = b.top + b.height / 2 - cy;
    const along = x * dx + y * dy;
    const across = Math.abs(x * dy - y * dx);
    if (along < 8) return;
    const score = along + across * 2.5;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/**
 * Arrow keys (and the D-pad) move the focus over the cards on screen; Space uses the focused card.
 * Returns a key handler for a MenuView. Left and right go to the card before and after (wrapping);
 * up and down go to the nearest card above or below; down from the bottom row is left to the menu (it goes
 * to the buttons under the cards). Enter is left to the menu:
 * it presses the screen's main button, or uses the focused card when there's none (menuKey).
 */
export function gridKeys(count: () => number, focus: () => number, setFocus: (i: number) => void, use: (i: number) => void) {
  return (e: KeyboardEvent): boolean => {
    const n = count();
    if (!n) return false;
    const to = (i: number) => { setFocus((i + n) % n); return true; };
    const vertical = (dy: number) => {
      const i = nearest(focus(), 0, dy);
      return i >= 0 && i < n ? to(i) : dy < 0;
    };
    switch (e.key) {
      case "ArrowLeft": case "a": case "A": return to(focus() - 1);
      case "ArrowRight": case "d": case "D": return to(focus() + 1);
      case "ArrowUp": case "w": case "W": return vertical(-1);
      case "ArrowDown": case "s": case "S": return vertical(1);
      case " ": use(focus()); return true;
    }
    return false;
  };
}
