// The desk in your room: the bill of fare, upgrades, and the way to the journal. Card screens (cards.ts).
import { RECIPES, UPGRADES } from "../data.js";
import { back, openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
export function openDeskScreen(g, openJournal) {
    const st = { focus: 0 };
    const build = () => {
        const ready = UPGRADES.filter((u) => !g.upgrades.has(u.id) && g.totalServed >= u.unlockAtServed).length;
        const cards = [
            { pick: "fare", icon: "📜", name: "Bill of fare", note: `what's on the menu<br>${g.menu.size} on today` },
            { pick: "upgrades", icon: "🔧", name: "Upgrades", note: ready ? `${ready} ready to choose` : `${g.totalServed} served so far`, on: ready > 0 },
            { pick: "journal", icon: "📖", name: "Journal", note: g.journalUnread ? `${g.journalUnread} new` : "the people you've met", on: g.journalUnread > 0 },
        ].map((c, i) => ({ ...c, focus: i === st.focus }));
        const go = (v) => {
            if (v === "fare")
                openBillOfFare(g);
            else if (v === "upgrades")
                openUpgrades(g);
            else
                openJournal();
        };
        return {
            title: "🕯️ Desk",
            subtitle: "In your room",
            view: {
                html: grid(cards),
                onPick: go,
                onKey: gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, (i) => go(cards[i].pick)),
            },
            items: [],
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// The bill of fare: cards to put on the board or take off it.
export function openBillOfFare(g) {
    const st = { focus: 0 };
    const build = () => {
        const toggle = (i) => {
            const r = RECIPES[i];
            if (g.menu.has(r.id))
                g.menu.delete(r.id);
            else
                g.menu.add(r.id);
            g.menuChosen = true;
            g.bus.emit({ type: "Paper", what: "menu" });
            st.focus = i;
            replaceMenu(build());
        };
        const putUp = () => {
            g.menuChosen = true;
            g.bus.emit({ type: "Paper", what: "menu" });
            g.say(`The bill of fare is up: ${RECIPES.filter((r) => g.menu.has(r.id)).map((r) => r.icon).join(" ") || "nothing yet"}.`);
            back();
        };
        const cards = RECIPES.map((r, i) => ({
            pick: String(i),
            icon: r.icon,
            name: r.name,
            note: `${g.menu.has(r.id) ? "on the board · " : ""}${r.storedIn === "piesafe" ? "whole pies, sliced" : r.servings ? "by the pot" : r.station === "tap" ? "on tap" : `about ${r.minutes[0]} min`}`,
            tags: r.baseTags,
            on: g.menu.has(r.id),
            focus: i === st.focus,
        }));
        return {
            title: "📜 Bill of fare",
            subtitle: "What's on the menu tonight?",
            view: {
                html: `<p class="explain"><b>Pick what goes up on the board.</b> Guests only order what's on it, and they'll still order it after it runs out. Put up what you're ready to make; leave off what you'd rather not.</p>${grid(cards)}`,
                onPick: (v) => toggle(Number(v)),
                onKey: (e) => {
                    if (e.key === "Enter") {
                        putUp();
                        return true;
                    }
                    return gridKeys(() => RECIPES.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, toggle)(e);
                },
            },
            items: [{ label: "Put it up", sub: `${g.menu.size} on the board`, button: "primary", action: putUp }],
        };
    };
    openMenu(build());
}
// ---------------------------------------------------------------------------
// Upgrades: they open up as you serve more people. No coin yet.
export function openUpgrades(g) {
    const st = { focus: 0 };
    const build = () => {
        const take = (i) => {
            const u = UPGRADES[i];
            if (g.upgrades.has(u.id) || g.totalServed < u.unlockAtServed)
                return;
            g.upgrades.add(u.id);
            g.say(`${u.icon} ${u.name}: ${u.desc}`);
            st.focus = i;
            replaceMenu(build());
        };
        const cards = UPGRADES.map((u, i) => {
            const have = g.upgrades.has(u.id);
            const open = g.totalServed >= u.unlockAtServed;
            return {
                pick: String(i),
                icon: open || have ? u.icon : "🔒",
                name: u.name,
                note: have ? `yours<br>${u.desc}` : open ? u.desc : `opens after ${u.unlockAtServed} served`,
                on: have,
                off: !open && !have,
                focus: i === st.focus,
            };
        });
        return {
            title: "🔧 Upgrades",
            subtitle: "Earned by serving",
            view: {
                html: `<p class="explain">No coin yet: upgrades open up as you serve more people. Served so far: <b>${g.totalServed}</b>.</p>${grid(cards)}`,
                onPick: (v) => take(Number(v)),
                onKey: gridKeys(() => UPGRADES.length, () => st.focus, (i) => { st.focus = i; replaceMenu(build()); }, take),
            },
            items: [],
        };
    };
    openMenu(build());
}
