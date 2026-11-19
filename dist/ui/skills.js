// Skills at the desk: the recipe book. Known recipes, and those to learn with the points guests served earn.
import { RECIPES } from "../data.js";
import { SKILLS, costOf, earnedPoints, learn, pointsLeft, toNextPoint } from "../skills.js";
import { openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
import { ingredientsHtml } from "./cook.js";
export function openSkills(g, changed) {
    const st = { focus: 0 };
    const build = () => {
        const learnable = SKILLS.recipes.map((x) => RECIPES.find((r) => r.id === x.dish)).filter((r) => !!r);
        const known = RECIPES.filter((r) => g.known.has(r.id) && !learnable.includes(r));
        const list = [...learnable, ...known];
        const left = pointsLeft(g);
        const cards = list.map((r, i) => {
            const has = g.known.has(r.id);
            const cost = costOf(r.id);
            const afford = left >= cost;
            const somewhere = g.world.furniture.some((f) => (f.slots ?? []).some((sl) => sl.kinds.includes(r.station)));
            const station = somewhere || has ? "" : " · you'll need somewhere to make it";
            return {
                pick: String(i), icon: r.icon, name: r.name, focus: i === st.focus, on: has, off: !has && !afford,
                fact: has ? "Known" : `${cost} point${cost === 1 ? "" : "s"}`,
                status: has ? "" : afford ? `learn it now${station}` : `${cost - left} more point${cost - left === 1 ? "" : "s"}`,
                tone: has ? "good" : afford ? "good" : "muted",
                tags: r.baseTags,
                detail: `${r.blurb ?? ""}${ingredientsHtml(g, r)}`,
                does: has ? "You know this one" : afford ? `Learn it: ${cost} point${cost === 1 ? "" : "s"}` : "Serve more guests to earn points",
            };
        });
        const pick = (i) => {
            const r = list[i];
            if (!r)
                return;
            st.focus = i;
            if (learn(g, r.id)) {
                g.bus.emit({ type: "MenuSound", sound: "tick" });
                g.say(`You've learned to make ${r.name.toLowerCase()}. Put it on the bill of fare when you're ready.`);
                changed();
            }
            replaceMenu(build());
        };
        const per = SKILLS.servedPerPoint;
        const next = toNextPoint(g);
        return {
            title: "📚 Skills",
            holdsClock: true,
            subtitle: `${left} point${left === 1 ? "" : "s"} to spend · a point for every ${per} guests served`,
            view: {
                pinned: `<div class="dish result"><span class="ic">🧑‍🍳</span><div class="dish-body">
          <div class="nm">${g.totalServed} guest${g.totalServed === 1 ? "" : "s"} served · ${earnedPoints(g)} point${earnedPoints(g) === 1 ? "" : "s"} earned</div>
          <div class="meta">Next point in ${next} more</div>
          <div class="skill-bar"><span style="width:${Math.round(((per - next) / per) * 100)}%"></span></div>
        </div></div>`,
                html: grid(cards),
                onPick: (v) => pick(Number(v)),
                onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, pick),
            },
            items: [],
        };
    };
    openMenu(build());
}
