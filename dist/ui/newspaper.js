// Reading the morning paper, from the desk.
import { longDate } from "../calendar.js";
import { back, openMenu } from "./menu.js";
export function openNewspaper(g) {
    const p = g.paper;
    if (!p)
        return;
    p.read = true;
    g.bus.emit({ type: "Paper", what: "journal" });
    const title = `The ${g.loc.name === "Town centre" ? "Town" : g.loc.name} Courier`;
    openMenu({
        title: `📰 ${title}`,
        holdsClock: true,
        subtitle: longDate(g.date),
        body: `<div class="paper">
      <h4>Weather</h4><p>${p.forecast} <span class="muted">(Forecasts are a guess.)</span></p>
      <h4>Around town</h4>${p.news.map((n) => `<p>${n}</p>`).join("")}
    </div>`,
        items: [{ label: "Fold it up", button: "secondary", action: () => back() }],
    });
}
