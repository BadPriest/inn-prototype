// Menus, in two shapes. Lists and dialogs (MenuSpec): rows or buttons you move through, for settings, the
// pause menu, yes-or-no questions. Card screens (CardScreen): every screen of cards in the game, built the
// same way: a title, a subtitle saying what it's for and what to do, tabs, a summary panel, the cards, and
// at most three buttons under them: confirm, an alternative, cancel. Anything else a screen offers is a card.
// Arrows / Enter / Backspace / Esc, the mouse, or a controller (gamepad.ts turns it into the same keys).

import { flipCard, gridKeys, settleCards } from "./cards.js";
import { padActive, padGlyphs, padText } from "../gamepad.js";

export interface MenuItem {
  label: string;
  sub?: string;
  disabled?: boolean;
  /** Shown as a button at the bottom instead of a list row. "primary" is the main thing to do. */
  button?: "primary" | "secondary";
  /** Play the confirm sound (piano) when pressed: decisions outside the world (where to start, settings).
   *  In-world menus tick a box instead (the MenuSound "tick"). */
  confirmSound?: boolean;
  /** The negative choice (Not now, Back, Keep playing): ○ on a controller presses it. */
  cancel?: boolean;
  action: () => void;
}

/** A list or a dialog: rows, or buttons at the bottom. */
export interface MenuSpec {
  title: string;
  subtitle?: string; // one line under the title: what this screen is for
  flavour?: string; // a quiet italic line of colour, kept apart from what you need to know
  body?: string; // optional HTML shown above the items
  items: MenuItem[];
  /** Modal menus stop the clock and can't be dismissed with Esc. */
  modal?: boolean;
  /** Stops the clock while it (or anything opened over it) is up, but closes as usual: the desk and its
   *  screens (bill of fare, calendar, newspaper, upgrades, journal), wherever they're opened from. */
  holdsClock?: boolean;
  onClose?: () => void;
  /** This screen is left: Back, or the menus closing (not when it's redrawn with replaceMenu). */
  onLeave?: () => void;
  /** Which item starts selected, when it shouldn't be the first. */
  focus?: number;
}

/** One of a card screen's three buttons. */
export interface Action {
  label: string;
  sub?: string;
  disabled?: boolean;
  /** Play the confirm sound (piano) when pressed. */
  confirmSound?: boolean;
  run: () => void;
}

/** A row of tabs: L1/R1 (Tab) for `tabs`, L2/R2 (PgUp/PgDn) for `modes`. */
export interface TabSet {
  list: { id: string; label: string }[];
  current: string;
  pick: (id: string) => void;
}

/** The cards on a screen, for the arrows and Space: how many, which has the focus, and using one. */
export interface CardNav {
  count: () => number;
  focus: () => number;
  setFocus: (i: number) => void;
  use: (i: number) => void;
}

/** A screen of cards. Its buttons: confirm (□, Enter), alternative (△, 1), cancel (○, Backspace; Back or Close if left out). */
export interface CardScreen {
  title: string;
  /** What this screen is for and what to do here, in a line. */
  subtitle: string;
  flavour?: string;
  tabs?: TabSet;
  modes?: TabSet;
  /** A panel above the cards that stays in place: what you'll get, the slip, your level. */
  summary?: string;
  /** The scrolling part: grid() or section() of cards, or a line saying there's nothing. */
  cards: string;
  nav?: CardNav;
  /** A click on an element with a data-pick attribute (tab:, mode: picks are the tabs'). */
  onPick?: (value: string) => void;
  /** Keys the screen adds (Delete takes one off, say). Return true if handled. */
  onKey?: (e: KeyboardEvent) => boolean;
  /** Those keys, for the hint line: "Delete takes one off". */
  keys?: string;
  /** After it's drawn: wire up what clicks alone can't (sliders, say). */
  onMount?: (root: HTMLElement) => void;
  confirm?: Action;
  alt?: Action;
  /** False: no way out but confirm (the end of the day). */
  cancel?: Action | false;
  modal?: boolean;
  holdsClock?: boolean;
  onClose?: () => void;
  onLeave?: () => void;
}

const isScreen = (s: MenuSpec | CardScreen): s is CardScreen => "cards" in s;

type Open = { list: MenuSpec; index: number; screen?: undefined } | { screen: CardScreen; list?: undefined; index: number };
const specOf = (o: Open) => (o.screen ?? o.list)!;

const stack: Open[] = [];
let root: HTMLElement;
let onModalChange: (modal: boolean) => void = () => {};
let onConfirm: () => void = () => {};

export function initMenus(el: HTMLElement, modalChanged: (modal: boolean) => void, confirmed?: () => void): void {
  root = el;
  onModalChange = modalChanged;
  if (confirmed) onConfirm = confirmed;
}

/** The confirm sound, for decisions made by keys or card picks rather than a confirmSound button. */
export function confirmed(): void {
  onConfirm();
}

function run(it: MenuItem): void {
  if (it.confirmSound) onConfirm();
  it.action();
}
function press(a: Action | undefined | false): boolean {
  if (!a) return false;
  if (!a.disabled) { if (a.confirmSound) onConfirm(); a.run(); }
  return true;
}

export function menuOpen(): boolean {
  return stack.length > 0;
}

/** A card screen's cancel: its own, else Back (or Close at the bottom of the stack); none when it says false. */
function cancelOf(s: CardScreen): Action | undefined {
  if (s.cancel === false) return undefined;
  return s.cancel ?? { label: stack.length > 1 ? "Back" : "Close", run: back };
}

export function openMenu(spec: MenuSpec | CardScreen): void {
  if (isScreen(spec)) stack.push({ screen: spec, index: 0 });
  else stack.push({ list: spec, index: spec.focus ?? Math.max(0, spec.items.findIndex((i) => !i.disabled)) });
  render();
}

/** Replace the current menu (for multi-step flows without growing the back stack). */
export function replaceMenu(spec: MenuSpec | CardScreen): void {
  stack.pop();
  openMenu(spec);
}

/**
 * A yes-or-no question in a modal: confirm (□ on a controller) and cancel (○). A `danger` question starts
 * on cancel, so a stray press doesn't do it.
 */
export function askChoice(o: { title: string; body: string; confirm: string; cancel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }): void {
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
export function padConfirm(): void {
  if (!stack.length) return;
  const top = stack[stack.length - 1];
  if (top.screen) {
    if (top.screen.onKey?.(new KeyboardEvent("keydown", { key: "Enter" }))) return;
    if (!press(top.screen.confirm)) top.screen.nav?.use(top.screen.nav.focus());
    return;
  }
  const items = top.list.items;
  const i = items.findIndex((it) => it.button === "primary" && !it.disabled);
  const it = items[i >= 0 ? i : top.index];
  if (it && !it.disabled) { top.index = i >= 0 ? i : top.index; run(it); }
}

/** △ on a controller: a card screen's alternative. False if there's none. */
export function padAlt(): boolean {
  const top = stack[stack.length - 1];
  return !!top?.screen && press(top.screen.alt);
}

/** ○ on a controller: the negative choice if there is one; false if not (it's then back or close). */
export function padCancel(): boolean {
  if (!stack.length) return false;
  const top = stack[stack.length - 1];
  if (top.screen) return press(cancelOf(top.screen));
  const it = top.list.items.find((x) => x.cancel && !x.disabled);
  if (!it) return false;
  run(it);
  return true;
}

export function back(): void {
  const top = stack.pop();
  if (top) specOf(top).onLeave?.();
  if (top && stack.length === 0) specOf(top).onClose?.();
  render();
}

export function closeAll(): void {
  const had = stack.length > 0;
  const bottom = stack[0];
  for (const o of stack.splice(0).reverse()) specOf(o).onLeave?.();
  if (had) specOf(bottom).onClose?.();
  render();
}

function isModal(): boolean {
  return stack.some((s) => specOf(s).modal);
}

function stepTab(t: TabSet | undefined, by: number): boolean {
  if (!t || t.list.length < 2) return !!t;
  const i = t.list.findIndex((x) => x.id === t.current);
  t.pick(t.list[(i + by + t.list.length) % t.list.length].id);
  return true;
}

/** A card screen's keys. */
function screenKey(s: CardScreen, e: KeyboardEvent): boolean {
  if ((e.key === "f" || e.key === "F") && flipCard()) return true;
  if (s.onKey?.(e)) return true;
  if (e.key === "Tab" && s.tabs) { e.preventDefault(); return stepTab(s.tabs, e.shiftKey ? -1 : 1); }
  if ((e.key === "PageUp" || e.key === "PageDown") && s.modes) { e.preventDefault(); return stepTab(s.modes, e.key === "PageUp" ? -1 : 1); }
  if (e.key === "Enter") { if (!press(s.confirm)) s.nav?.use(s.nav.focus()); return true; }
  if (e.key === "1") { press(s.alt); return true; }
  if (e.key === "Backspace" || (e.key === "Escape" && isModal())) {
    if (!press(cancelOf(s)) && e.key === "Backspace" && !isModal()) back();
    return true;
  }
  if (e.key === "Escape") { closeAll(); return true; }
  if (s.nav && gridKeys(s.nav.count, s.nav.focus, s.nav.setFocus, s.nav.use)(e)) return true;
  return true; // swallow other keys while a menu is open
}

/** Returns true if the menu handled the key. */
export function menuKey(e: KeyboardEvent): boolean {
  if (!stack.length) return false;
  const top = stack[stack.length - 1];
  if (top.screen) return screenKey(top.screen, e);
  const items = top.list.items;
  const move = (d: number) => {
    if (!items.length) return;
    let i = top.index;
    for (let n = 0; n < items.length; n++) {
      i = (i + d + items.length) % items.length;
      if (!items[i].disabled) break;
    }
    top.index = i;
    render();
  };
  switch (e.key) {
    case "ArrowUp": case "w": case "W": case "ArrowLeft": case "a": case "A": move(-1); return true;
    case "ArrowDown": case "s": case "S": case "ArrowRight": case "d": case "D": move(1); return true;
    case "Enter": case " ": {
      const it = items[top.index];
      if (it && !it.disabled) run(it);
      return true;
    }
    case "Backspace":
      if (!(top.list.modal && stack.length === 1)) back();
      return true;
    case "Escape":
      if (!isModal()) closeAll();
      return true;
  }
  return true; // swallow other keys while a menu is open
}

const tabRow = (t: TabSet, kind: "tab" | "mode") =>
  `<div class="${kind === "tab" ? "bf-tabs" : "bf-modes"}">${t.list.map((x) => `<button class="${x.id === t.current ? "on" : ""}" data-pick="${kind}:${x.id}">${x.label}</button>`).join("")}</div>`;

function render(): void {
  onModalChange(isModal() || stack.some((o) => specOf(o).holdsClock));
  if (!root) return;
  if (!stack.length) {
    root.innerHTML = "";
    root.style.display = "none";
    return;
  }
  const top = stack[stack.length - 1];
  root.style.display = "flex";
  const s = specOf(top);
  // Redrawing the same screen (a card picked, a tab changed) keeps where its view was scrolled to.
  const prevView = root.querySelector<HTMLElement>(".menu-view");
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
    const glyph = (k: "sq" | "tr" | "ci") => k === "tr"
      ? `<span class="pad-glyph tx g-tr">${padText("△")}</span><kbd class="key-glyph">1</kbd>`
      : `<span class="pad-glyph ${k}"></span>`;
    const btn = (a: Action, k: "sq" | "tr" | "ci", cls: string) =>
      `<button class="menu-btn ${cls}" data-act="${k}" ${a.disabled ? "disabled" : ""}><span class="btn-row">${glyph(k)}<span>${a.label}</span></span>${a.sub ? `<span class="sub">${a.sub}</span>` : ""}</button>`;
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
    root.querySelectorAll<HTMLElement>("[data-pick]").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const v = el.dataset.pick!;
        if (v.startsWith("tab:") && sc.tabs) { if (v.slice(4) !== sc.tabs.current) sc.tabs.pick(v.slice(4)); return; }
        if (v.startsWith("mode:") && sc.modes) { if (v.slice(5) !== sc.modes.current) sc.modes.pick(v.slice(5)); return; }
        sc.onPick?.(v);
      };
    });
    root.querySelector<HTMLElement>('[data-act="sq"]')?.addEventListener("click", () => press(sc.confirm));
    root.querySelector<HTMLElement>('[data-act="tr"]')?.addEventListener("click", () => press(sc.alt));
    root.querySelector<HTMLElement>('[data-act="ci"]')?.addEventListener("click", () => press(cancel));
    settleCards(root);
    const view = root.querySelector<HTMLElement>(".menu-view");
    if (view) {
      view.scrollTop = keepScroll;
      root.querySelector<HTMLElement>(".menu-view .focus")?.scrollIntoView({ block: "nearest" }); // keys move the focus off-screen
    }
    sc.onMount?.(root);
  } else {
    const l = top.list;
    const onlyButtons = l.items.length > 0 && l.items.every((it) => it.button);
    const hint = padActive()
      ? padGlyphs(`D-pad choose · Space confirms${l.modal && stack.length === 1 ? "" : " · ○ back"}`)
      : l.modal && stack.length === 1 ? `${onlyButtons ? "←→" : "↑↓"} choose · Enter confirm` : "↑↓ choose · Enter confirm · Backspace back · Esc close";
    const row = (it: MenuItem, i: number) => `
          <div class="menu-item ${i === top.index ? "sel" : ""} ${it.disabled ? "dis" : ""}" data-i="${i}">
            <span>${it.label}</span>${it.sub ? `<span class="sub">${it.sub}</span>` : ""}
          </div>`;
    const glyph = (it: MenuItem) => (it.button === "primary" ? `<span class="pad-glyph sq"></span>` : it.cancel ? `<span class="pad-glyph ci"></span>` : "");
    const btn = (it: MenuItem, i: number) =>
      `<button class="menu-btn ${it.button} ${i === top.index ? "sel" : ""}" data-i="${i}" ${it.disabled ? "disabled" : ""}><span class="btn-row">${glyph(it)}<span>${it.label}</span></span>${it.sub ? `<span class="sub">${it.sub}</span>` : ""}</button>`;
    const listed = l.items.map((it, i) => (it.button ? "" : row(it, i))).join("");
    const buttons = l.items.map((it, i) => (it.button ? btn(it, i) : "")).join("");
    root.innerHTML = `
    <div class="menu ${l.modal ? "modal" : ""}">${head}
      ${l.body ? `<div class="menu-body">${l.body}</div>` : ""}
      ${listed ? `<div class="menu-items">${listed}</div>` : ""}
      ${buttons ? `<div class="menu-actions">${buttons}</div>` : ""}
      <div class="menu-hint">${hint}</div>
    </div>`;
    root.querySelectorAll<HTMLElement>(".menu-item, .menu-btn").forEach((el) => {
      el.onclick = () => {
        const i = Number(el.dataset.i);
        const it = l.items[i];
        if (it && !it.disabled) { top.index = i; run(it); }
      };
    });
    settleCards(root);
  }
  root.querySelector<HTMLElement>('[data-act="back"]')?.addEventListener("click", () => back());
  root.querySelector<HTMLElement>('[data-act="close"]')?.addEventListener("click", () => closeAll());
}
