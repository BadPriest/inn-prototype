// Skills at the desk: the keeper's level, and what its points buy: recipes, by kind, and knacks.
import { EQUIPMENT, RECIPES, dishData } from "../data.js";
import { moneyHtml, priceOfRecipe } from "../money.js";
import { SKILLS, buyKnack, costOf, learn, levelOf, levelProgress, nextTier, pointsLeft, tierOf } from "../skills.js";
import { openMenu, replaceMenu } from "./menu.js";
import { grid } from "./cards.js";
import { ingredientsHtml } from "./cook.js";
import { needs, whereFull, whereShort } from "./where.js";
const TABS = [
    { id: "drinks", name: "☕ Drinks" },
    { id: "breakfast", name: "🍳 Breakfast" },
    { id: "meals", name: "🍲 Meals" },
    { id: "snacks", name: "🧀 Snacks" },
    { id: "knacks", name: "✋ Knacks" },
];
/** Drinks; snacks (any time of day); breakfast (not served at dinner); and the rest, meals. */
function tabOf(r) {
    if (r.kind === "drink")
        return "drinks";
    const meals = dishData(r.id)?.meals ?? [];
    if (meals.includes("between"))
        return "snacks";
    if (meals.includes("breakfast") && !meals.includes("dinner"))
        return "breakfast";
    return "meals";
}
const BOOK = RECIPES.filter((r) => !r.internal && r.station !== "tap" && (costOf(r.id) > 0 || SKILLS.startKnown.includes(r.id)));
export const ROMAN = ["", "I", "II", "III", "IV", "V"];
const pts = (n) => `${n} point${n === 1 ? "" : "s"}`;
let lastTab = "meals";
export function openSkills(g, changed) {
    g.newSkills = false;
    const st = { focus: 0, tab: lastTab };
    const canMakeHere = (r) => g.world.furniture.some((f) => (f.slots ?? []).some((sl) => sl.kinds.includes(r.station)));
    const waiting = (r) => EQUIPMENT.find((e) => g.toPlace.includes(e.id) && e.slots.some((sl) => sl.kinds.includes(r.station)));
    const kitchenNote = (r) => {
        if (canMakeHere(r))
            return "";
        const w = waiting(r);
        return w ? `set out the ${w.name.toLowerCase()} to make it` : needs(r);
    };
    const build = () => {
        const left = pointsLeft(g);
        let entries;
        if (st.tab === "knacks") {
            entries = SKILLS.knacks.map((k) => {
                const tier = tierOf(g, k.id), next = nextTier(g, k.id);
                const afford = !!next && left >= next.points;
                const tiers = k.tiers.map((t, i) => `<div>${i < tier ? "✓" : "·"} ${k.name} ${ROMAN[i + 1]}: ${t.text} (${pts(t.points)})</div>`).join("");
                // A stack: the next level on top, the levels after it underneath.
                return {
                    card: {
                        pick: "", icon: k.icon, name: next ? `${k.name} ${ROMAN[tier + 1]}` : `${k.name} ${ROMAN[tier]}`, on: !next, off: !!next && !afford,
                        fact: next ? pts(next.points) : "mastered",
                        status: next ? next.text : "", tone: "good",
                        body: `<div class="desc">${k.text}</div>`,
                        under: next ? k.tiers.slice(tier + 1).map(() => "plain") : [],
                        detail: `${k.text}${tiers}`,
                        does: !next ? "You've learned all of it" : afford ? `Learn ${k.name} ${ROMAN[tier + 1]}: ${pts(next.points)}` : "Level up to earn points",
                    },
                    use: () => {
                        if (!buyKnack(g, k.id))
                            return false;
                        g.say(`${k.icon} ${k.name} ${ROMAN[tierOf(g, k.id)]}: ${k.tiers[tierOf(g, k.id) - 1].text}.`);
                        return true;
                    },
                };
            });
        }
        else {
            const list = BOOK.filter((r) => tabOf(r) === st.tab).sort((a, b) => Number(g.known.has(a.id)) - Number(g.known.has(b.id)) || costOf(a.id) - costOf(b.id));
            entries = list.map((r) => {
                const has = g.known.has(r.id);
                const cost = costOf(r.id);
                const afford = left >= cost;
                const here = canMakeHere(r);
                const note = kitchenNote(r);
                const unit = r.storedIn === "piesafe" ? "a slice" : "each";
                const batch = r.storedIn === "piesafe" ? `${r.servings?.[0] ?? 6} a pie` : r.servings ? `~${r.servings[0]} a pot` : "";
                const varies = r.base.options.length > 1 || r.optional.pick[1] > 0;
                return {
                    card: {
                        pick: "", icon: r.icon, name: r.name, on: has, off: !has && !afford,
                        fact: has ? "known" : pts(cost),
                        status: whereShort(r),
                        tone: here ? undefined : "warn",
                        body: `<div class="earns">${varies ? "from " : ""}${moneyHtml(priceOfRecipe(g, r.id))} ${unit}${batch ? ` · ${batch}` : ""}</div>${r.blurb ? `<div class="desc">${r.blurb}</div>` : ""}`,
                        tags: r.baseTags,
                        detail: `${r.blurb ?? ""}${note ? `<div class="where-full">To cook it: ${note}.</div>` : ""}<div class="where-full">${whereFull(r)}</div>${ingredientsHtml(g, r, false)}`,
                        does: has ? "You know this one" : afford ? `Learn it: ${pts(cost)}` : `Level up to earn ${pts(cost - left)} more`,
                    },
                    use: () => {
                        if (!learn(g, r.id))
                            return false;
                        g.say(`You've learned to make ${r.name.toLowerCase()}.${here ? " Put it on the bill of fare when you're ready." : ` To cook it: ${note}.`}`);
                        return true;
                    },
                };
            });
        }
        st.focus = Math.min(st.focus, Math.max(0, entries.length - 1));
        const cards = entries.map((e, i) => ({ ...e.card, pick: String(i), focus: i === st.focus }));
        const pick = (i) => {
            const e = entries[i];
            if (!e)
                return;
            st.focus = i;
            if (e.use()) {
                g.bus.emit({ type: "MenuSound", sound: "tick" });
                changed();
            }
            replaceMenu(build());
        };
        const prog = levelProgress(g);
        const xp = SKILLS.xpPerServe;
        return {
            title: "📚 Skills",
            holdsClock: true,
            subtitle: `${pts(left)} to spend · a point each level · pick a card to learn it`,
            tabs: { list: TABS.map((t) => ({ id: t.id, label: t.name })), current: st.tab, pick: (id) => { st.tab = lastTab = id; st.focus = 0; replaceMenu(build()); } },
            summary: `<div class="dish result"><span class="ic">🧑‍🍳</span><div class="dish-body">
          <div class="nm">Level ${levelOf(g)}</div>
          <div class="meta">${prog.have} of ${prog.need} to level ${levelOf(g) + 1} · a guest delighted earns ${xp.DELIGHT ?? 0}, pleased ${xp.PLEASED ?? 0}, served ${xp.FULFILLED ?? 0}</div>
          <div class="skill-bar"><span style="width:${Math.round((prog.have / prog.need) * 100)}%"></span></div>
        </div></div>`,
            cards: cards.length ? grid(cards, { size: "l" }) : `<p class="blurb">Nothing here yet.</p>`,
            onPick: (v) => pick(Number(v)),
            nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; replaceMenu(build()); }, use: pick },
        };
    };
    openMenu(build());
}
