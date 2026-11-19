// The objective card under the status card: the one thing to do next. Done, it's stamped and fades in
// gold, its reward flies to the purse, and the next one slides in. Also: the rings in the menus.

import type { Game } from "../game.js";
import { headline, objectives } from "../objectives.js";
import { STEPS, menuGuide } from "../walkthrough.js";
import { moneyHtml } from "../money.js";

let shown: { key: string; reward?: number; text: string } | null = null;
let busy = false;

function wasDone(g: Game, key: string): boolean {
  const [kind, a, b] = key.split(":");
  if (kind === "w") return !g.walkthrough || g.walkthrough.step > STEPS.findIndex((s) => s.id === a);
  if (Number(a) !== g.day) return false;
  return objectives(g).find((o) => o.id === b)?.done ?? true;
}

export function updateQuest(g: Game): void {
  const el = document.getElementById("quest");
  if (!el || busy) return;
  const h = g.showObjectives ? headline(g) : null;
  if (shown && h?.key === shown.key) {
    if (h.text !== shown.text) { shown.text = h.text; el.querySelector(".q-text")!.innerHTML = h.text; }
    return;
  }
  if (shown && h?.key !== shown.key && g.showObjectives && wasDone(g, shown.key)) {
    busy = true;
    el.classList.add("done");
    stamp(el);
    if (shown.reward) flyCoins(el.querySelector(".q-reward") ?? el);
    setTimeout(() => { busy = false; shown = null; el.classList.remove("done"); el.classList.add("hidden"); }, 1300);
    return;
  }
  shown = null;
  if (!h) { el.classList.add("hidden"); return; }
  shown = { key: h.key, reward: h.reward, text: h.text };
  el.innerHTML = `<div class="q-kicker">${h.kicker}</div><div class="q-text">${h.text}</div>${h.reward ? `<div class="q-reward">+${moneyHtml(h.reward)}</div>` : ""}`;
  el.classList.remove("hidden", "enter");
  void el.offsetWidth;
  el.classList.add("enter");
}

/** Done: a ✓ slides out from behind the card's right edge, clear of the text, and fades with it. */
function stamp(card: HTMLElement): void {
  const s = document.createElement("div");
  s.className = "q-stamp";
  s.textContent = "✓";
  s.style.left = `${card.offsetLeft + card.offsetWidth - 40}px`;
  s.style.top = `${card.offsetTop + card.offsetHeight / 2 - 19}px`;
  card.after(s);
  setTimeout(() => s.remove(), 1300);
}

/** A few coins from the card to the purse. */
function flyCoins(from: Element): void {
  const purse = document.querySelector("#status .st-purse");
  if (!purse) return;
  const a = from.getBoundingClientRect(), b = purse.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const c = document.createElement("span");
    c.className = "coin cr fly";
    const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 20, y0 = a.top + a.height / 2;
    const x1 = b.left + 10 + Math.random() * 20, y1 = b.top + b.height / 2;
    c.style.left = `${x0}px`; c.style.top = `${y0}px`;
    document.body.appendChild(c);
    const lift = 30 + Math.random() * 25;
    c.animate([
      { transform: "translate(0,0) scale(.6)", opacity: 0 },
      { transform: `translate(${(x1 - x0) * 0.4}px,${(y1 - y0) * 0.4 - lift}px) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.8)`, opacity: 0.9 },
    ], { duration: 750, delay: 250 + i * 70, easing: "cubic-bezier(.4,0,.3,1)", fill: "backwards" }).onfinish = () => c.remove();
  }
}

/** Light up what the walkthrough wants pressed in the open menu. */
export function updateMenuGuide(g: Game): void {
  const root = document.getElementById("menu");
  if (!root) return;
  const want = root.style.display === "none" ? [] : menuGuide(g, root.dataset.title ?? "", root);
  let target: Element | null = null;
  for (const m of want) {
    if (m instanceof Element) { target = m; break; }
    target = [...root.querySelectorAll(m.sel)].find((el) =>
      (!m.name || el.querySelector(".nm")?.textContent === m.name) && (!m.has || m.has.every((h) => el.textContent?.includes(h)))) ?? null;
    if (target) break;
  }
  root.querySelectorAll(".guided").forEach((el) => { if (el !== target) el.classList.remove("guided"); });
  target?.classList.add("guided");
}
