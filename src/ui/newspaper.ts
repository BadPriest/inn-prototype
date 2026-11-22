// Reading the morning paper, from the desk.

import { heading } from "./cards.js";
import type { Game } from "../game.js";
import { longDate } from "../calendar.js";
import { back, openMenu } from "./menu.js";

export function openNewspaper(g: Game): void {
  const p = g.paper;
  if (!p) return;
  p.read = true;
  g.bus.emit({ type: "MenuSound", sound: "paperOpen" });
  const title = `The ${g.loc.name === "Town centre" ? "Town" : g.loc.name} Courier`;
  openMenu({
    title: `📰 ${title}`,
    holdsClock: true,
    subtitle: longDate(g.date),
    body: `<div class="paper">
      ${heading(`Weather`, `forecasts may be wrong`)}<p>${p.forecast}</p>
      ${heading(`Around town`, `news and gossip`)}${p.news.map((n) => `<p>${n}</p>`).join("")}
    </div>`,
    items: [{ label: "Fold it up", button: "secondary", cancel: true, action: () => back() }],
    onLeave: () => g.bus.emit({ type: "MenuSound", sound: "paperClose" }),
  });
}
