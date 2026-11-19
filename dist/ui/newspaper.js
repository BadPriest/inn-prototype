// Reading the morning paper, from the desk.
import { longDate } from "../calendar.js";
import { back, openMenu } from "./menu.js";
export function openNewspaper(g) {
    const p = g.paper;
    if (!p)
        return;
    p.read = true;
    g.bus.emit({ type: "MenuSound", sound: "paperOpen" });
    const title = `The ${g.loc.name === "Town centre" ? "Town" : g.loc.name} Courier`;
    openMenu({
        title: `📰 ${title}`,
        holdsClock: true,
        subtitle: longDate(g.date),
        body: `<div class="paper">
      <div class="sec-h"><h4>Weather</h4><small>forecasts may be wrong</small></div><p>${p.forecast}</p>
      <div class="sec-h"><h4>Around town</h4><small>news and gossip</small></div>${p.news.map((n) => `<p>${n}</p>`).join("")}
    </div>`,
        items: [{ label: "Fold it up", button: "secondary", action: () => back() }],
        onLeave: () => g.bus.emit({ type: "MenuSound", sound: "paperClose" }),
    });
}
