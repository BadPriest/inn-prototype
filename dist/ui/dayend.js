// The tally when the keeper turns in: three placards side by side. The purse (what came in and went out),
// the guests (how many came, how many were served, and how they took it), and what was learned today.
import { moneyHtml } from "../money.js";
const OUTCOMES = [
    { key: "DELIGHT", name: "Delighted", tone: "de" },
    { key: "PLEASED", name: "Pleased", tone: "pl" },
    { key: "FULFILLED", name: "Fed", tone: "fu" },
    { key: "UNFINISHED", name: "Left some", tone: "un" },
    { key: "COMPLAINS", name: "Complained", tone: "co" },
];
const line = (label, value, cls = "") => `<div class="de-line ${cls}"><span>${label}</span><b>${value}</b></div>`;
function purse(g, s) {
    const taken = s.taken ?? 0, tips = s.tips ?? 0, sold = s.sold ?? 0, spent = s.spent ?? 0, upkeep = Math.round(s.upkeep ?? 0);
    const net = taken + tips + sold - spent - upkeep;
    return `<section class="de-card de-purse">
    <h3>🪙 The purse</h3>
    <div class="de-big ${net < 0 ? "down" : "up"}">${net < 0 ? "" : "+"}${moneyHtml(net)}</div>
    <div class="de-sub">${net < 0 ? "down on the day" : "up on the day"}</div>
    <div class="de-lines">
      ${line("Takings", moneyHtml(taken))}
      ${line("Tips", moneyHtml(tips))}
      ${sold ? line("Sold back", moneyHtml(sold)) : ""}
      ${spent ? line("Spent", `−${moneyHtml(spent)}`, "out") : ""}
      ${upkeep >= 1 ? line("Upkeep", `−${moneyHtml(upkeep)}`, "out") : ""}
    </div>
    <div class="de-foot">${line("In the purse", moneyHtml(g.purse))}</div>
  </section>`;
}
function guests(s) {
    const o = s.outcomes;
    const total = OUTCOMES.reduce((n, x) => n + (o[x.key] ?? 0), 0);
    const bar = total
        ? `<div class="de-bar">${OUTCOMES.filter((x) => o[x.key]).map((x) => `<i class="t-${x.tone}" style="flex:${o[x.key]}" title="${x.name}: ${o[x.key]}"></i>`).join("")}</div>`
        : `<div class="de-bar empty"></div>`;
    const away = s.leftEarly + s.leftUnserved;
    return `<section class="de-card de-guests">
    <h3>🧑‍🤝‍🧑 The guests</h3>
    <div class="de-big">${s.served}<small> served</small></div>
    <div class="de-sub">${s.arrivals} came in · ${s.orders ?? 0} orders</div>
    ${bar}
    <div class="de-lines">
      ${OUTCOMES.map((x) => line(`<i class="dot t-${x.tone}"></i>${x.name}`, String(o[x.key] ?? 0), o[x.key] ? "" : "nil")).join("")}
    </div>
    <div class="de-foot">${line("Walked out", String(away), away ? "out" : "nil")}${s.leftUnserved ? `<div class="de-note">${s.leftUnserved} never got what they asked for</div>` : ""}</div>
  </section>`;
}
function learned(s) {
    return `<section class="de-card de-learned">
    <h3>✦ Learned today</h3>
    ${s.moments.length
        ? `<div class="de-big">${s.moments.length}<small> ${s.moments.length === 1 ? "discovery" : "discoveries"}</small></div><ul class="de-moments">${s.moments.map((m) => `<li>${m}</li>`).join("")}</ul>`
        : `<div class="de-big quiet">Nothing new</div><div class="de-sub">Regulars tell you more about themselves each visit, the better you serve them.</div>`}
    <div class="de-foot"><div class="de-note">In the kitchen: ${s.crafted} made · ${s.garnished} garnished · ${s.cleaned} cleared away</div></div>
  </section>`;
}
/** The body of the end-of-day screen. */
export function dayEndBody(g, s) {
    return `<div class="dayend">${purse(g, s)}${guests(s)}${learned(s)}</div>`;
}
