// The warning card under the objective card: upkeep goods running low or out (inn#77), each with how
// long what's left lasts, and what to do: order at the desk, or unpack the crate, or wait for the carter.
import { upkeepWarnings } from "../upkeep.js";
import { whenText } from "../supplies.js";
import { bannerHtml, hideBanner, showBanner } from "./banner.js";
let shown = "";
/** What's on its way for an item: a crate in the kitchen, or a slip the carter brings. */
function comingOf(g, item) {
    if (g.crates.some((c) => c.lines.some((l) => l.item === item)))
        return "in a crate in the kitchen";
    const d = g.deliveries.filter((x) => (x.slip[item] ?? 0) > 0).sort((a, b) => a.day - b.day)[0];
    return d ? `coming ${whenText(g, d.day)}` : undefined;
}
export function updateWarnings(g) {
    const el = document.getElementById("warn");
    if (!el)
        return;
    const ws = upkeepWarnings(g, (item) => comingOf(g, item));
    const out = ws.filter((w) => w.out);
    const bare = (name) => name.split(" ").slice(1).join(" ").toLowerCase();
    const rows = ws.map((w) => `<div class="w-row${w.out ? " out" : ""}"><b>${w.name}</b><span>${w.left}</span></div>${w.coming ? `<div class="w-coming">${w.coming}</div>` : ""}`).join("");
    const waiting = ws.filter((w) => !w.coming);
    const text = rows + (waiting.length ? `<div class="w-act">Order more at the desk: 🧺 Buy Supplies</div>` : "");
    const kicker = out.length ? `Out of ${out.map((w) => bare(w.name)).join(" and ")}` : "Running low";
    const key = kicker + text;
    if (key === shown)
        return;
    const wasHidden = el.classList.contains("hidden");
    shown = key;
    if (!ws.length) {
        hideBanner(el);
        return;
    }
    el.classList.toggle("out", out.length > 0);
    if (wasHidden)
        showBanner(el, { kicker, text });
    else
        el.innerHTML = bannerHtml({ kicker, text });
}
