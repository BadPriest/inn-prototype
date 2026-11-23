// Manage stove: what stands on a stove's back spots (kettles, coffee pots, a Dutch oven), and the spares
// waiting to go on. Swapping is instant. A tab on the stove's menus.
import { EQUIPMENT, lowerName } from "../data.js";
import { emptyPot } from "../crafting.js";
import { askChoice, back, openMenu, replaceMenu } from "./menu.js";
import { grid, heading } from "./cards.js";
import { seasonLevel, toNextLevel, traitById } from "../seasoning.js";
const newUid = () => `eq-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const gearOf = (id) => EQUIPMENT.find((e) => e.id === id && e.gear);
/** A stove with back spots for gear. */
export const hasBackSpots = (f) => (f.equip?.hotSlots ?? 0) > 0;
/** Anything that cooks has a Manage tab: how it's wearing in, and its back spots or hooks if it has them. */
export const hasManage = (f) => (f.kind === "station" || f.kind === "fireplace") && !!f.equip;
/** The tabs on a stove's screens: whatever its own tabs are, then Manage stove. */
export function stoveTabs(own, current, pick) {
    return { list: [...own, { id: "manage", name: "🔧 Manage" }].map((t) => ({ id: t.id, label: t.name })), current, pick };
}
/** Spare gear on the shelf: bought or taken off, not on a stove. */
const spares = (g) => [...new Set(g.toPlace.filter((id) => gearOf(id)))];
/** The Manage stove screen. `own`: the stove's other tabs; `leave(tab)`: go to one of them. */
export function manageStoveSpec(g, stoveId, own, leave, st = { focus: 0, holding: undefined }) {
    const f = g.world.furniture.find((x) => x.id === stoveId);
    const placed = g.layout.find((p) => p.uid === stoveId);
    const spots = f.equip?.hotSlots ?? 0;
    const on = g.layout.filter((p) => p.on === stoveId);
    const hearth = !!f.equip?.hearth;
    const spare = spares(g).filter((id) => hearth || !gearOf(id)?.hearthOnly);
    const spotWord = hearth ? "hook" : "spot";
    const redraw = () => replaceMenu(manageStoveSpec(g, stoveId, own, leave, st));
    const rebuild = () => { g.rebuildWorld(); redraw(); };
    /** What's keeping a spot busy, if anything. */
    const busy = (uid) => {
        if (g.jobs.has(uid))
            return "busy: wait till it's done";
        if (g.shelves.get(uid)?.length)
            return "something's ready on it: pick it up first";
        return null;
    };
    const takeOff = (uid, then) => {
        const q = on.find((p) => p.uid === uid);
        const why = busy(uid);
        const name = lowerName(gearOf(q.type)?.name ?? "it");
        if (why) {
            g.say(`The ${name} is ${why}.`);
            return;
        }
        const remove = () => { g.layout = g.layout.filter((p) => p !== q); g.toPlace.push(q.type); then(); };
        const pot = g.pots.get(uid);
        if (!pot) {
            remove();
            return;
        }
        askChoice({
            title: `Pour away the ${pot.item.name.toLowerCase()}?`,
            body: `<p>The ${name} still has ${pot.left} left in it. Taking it off pours that away.</p>`,
            confirm: "Pour it away", cancel: "Keep it on", danger: true,
            onConfirm: () => { emptyPot(g, uid); back(); remove(); },
            onCancel: () => back(),
        });
    };
    const putOn = (type) => {
        g.layout.push({ uid: newUid(), type, x: placed.x, y: placed.y, on: stoveId });
        g.toPlace.splice(g.toPlace.indexOf(type), 1);
        const n = g.newGear.indexOf(type);
        if (n >= 0)
            g.newGear.splice(n, 1);
        g.say(`You set the ${lowerName(gearOf(type).name)} on the ${f.name.toLowerCase()}.`);
    };
    const spotCards = Array.from({ length: spots }, (_, i) => {
        const q = on[i];
        const gear = q && gearOf(q.type);
        const why = q ? busy(q.uid) : null;
        const pot = q ? g.pots.get(q.uid) : undefined;
        return {
            pick: `spot:${i}`, icon: gear?.icon ?? "⬚", name: gear?.name ?? `Empty ${spotWord}`,
            fact: `${hearth ? "Hook" : "Spot"} ${i + 1}`,
            status: st.holding ? (q ? `swap for the ${lowerName(gearOf(st.holding).name)}` : `put the ${lowerName(gearOf(st.holding).name)} here`) : !q ? "free" : why ? why : pot ? `${pot.left} left in it` : "take it off",
            tone: st.holding ? "good" : why ? "warn" : q ? undefined : "muted",
            does: st.holding ? (q ? "Swap them" : "Set it here") : q ? "Take it off, onto the shelf" : "Pick something from the shelf to set here",
        };
    });
    const spareCards = spare.map((id) => {
        const gear = gearOf(id);
        const n = g.toPlace.filter((x) => x === id).length;
        return {
            pick: `spare:${id}`, icon: gear.icon, name: gear.name, on: st.holding === id,
            fact: n > 1 ? `${n} on the shelf` : "on the shelf",
            status: st.holding === id ? "now pick a spot" : on.length < spots ? "set it on" : "swap it in",
            tone: "good",
            does: on.length < spots ? (hearth ? "Hang it over the fire" : "Set it on the stove") : "Choose which to swap it for",
        };
    });
    const pieces = [...((f.equip?.slots.length ?? 0) > 0 ? [{ uid: f.id, icon: f.equip.icon, name: f.name }] : []),
        ...on.map((q) => ({ uid: q.uid, icon: gearOf(q.type)?.icon ?? "•", name: gearOf(q.type)?.name ?? q.type }))];
    const pieceCards = pieces.map((p) => {
        const s = g.seasoning[p.uid] ?? { made: 0, traits: [] };
        const level = seasonLevel(s.made);
        const next = toNextLevel(s.made);
        const traits = s.traits.map(traitById).filter((t) => !!t);
        return {
            pick: `piece:${p.uid}`, icon: p.icon, name: p.name,
            fact: `level ${level}`,
            status: next ? `${next.left} more servings to level ${level + 1}` : "fully worn in",
            tone: traits.length ? "good" : "muted",
            body: traits.length ? traits.map((t) => `<div class="desc"><b>${t.name}</b>: ${t.text}</div>`).join("") : `<div class="desc">Nothing yet. It picks something up at each level.</div>`,
            detail: `${s.made} servings made on it. ${next ? `Level ${level + 1} at ${next.at}.` : "It's reached its last level."}`,
        };
    });
    const cards = [...pieceCards, ...spotCards, ...spareCards];
    st.focus = Math.min(st.focus, Math.max(0, cards.length - 1));
    cards.forEach((c, i) => { c.focus = i === st.focus; });
    const pick = (v) => {
        st.focus = Math.max(0, cards.findIndex((c) => c.pick === v));
        if (v.startsWith("piece:"))
            return;
        if (v.startsWith("spare:")) {
            const id = v.slice(6);
            if (on.length < spots) {
                putOn(id);
                st.holding = undefined;
                g.bus.emit({ type: "MenuSound", sound: "tick" });
                rebuild();
                return;
            }
            st.holding = st.holding === id ? undefined : id;
            st.focus = 0;
            redraw();
            return;
        }
        const q = on[Number(v.slice(5))];
        if (st.holding) {
            const id = st.holding;
            if (!q) {
                putOn(id);
                st.holding = undefined;
                g.bus.emit({ type: "MenuSound", sound: "tick" });
                rebuild();
                return;
            }
            takeOff(q.uid, () => { putOn(id); st.holding = undefined; g.bus.emit({ type: "MenuSound", sound: "tick" }); rebuild(); });
            return;
        }
        if (q)
            takeOff(q.uid, () => { g.say(`You take the ${lowerName(gearOf(q.type).name)} off and set it on the shelf.`); g.bus.emit({ type: "MenuSound", sound: "tick" }); rebuild(); });
    };
    const where = hearth ? "over the fire" : "on the stove";
    const hint = st.holding ? `Where should the ${lowerName(gearOf(st.holding).name)} go? Pick a ${spotWord} ${where}.`
        : spareCards.length ? `Pick something ${where} to take it off, or something on the shelf to ${hearth ? "hang" : "set"} it on.`
            : `Pick something ${where} to take it off. Nothing spare on the shelf: kettles, coffee pots, a Dutch oven${hearth ? " and a hanging pot" : ""} are bought at the desk.`;
    const wornIn = pieceCards.length ? `${heading("Worn in with use", "each level, it picks something up")}${grid(pieceCards)}` : "";
    const spotsHtml = spots ? `${heading(hearth ? "Over the fire, and on the shelf" : "On the stove, and on the shelf", `${hint}`)}${grid([...spotCards, ...spareCards])}` : "";
    return {
        title: f.name,
        holdsClock: true,
        subtitle: !spots ? "How it's wearing in: the more you make on it, the more it picks up" : hearth ? `${spots} hook${spots === 1 ? "" : "s"} over the fire for a kettle, a coffee pot, a Dutch oven or a hanging pot · they cook while the fire's lit`
            : `${spots} spot${spots === 1 ? "" : "s"} at the back for a kettle, a coffee pot or a Dutch oven`,
        tabs: own.length ? stoveTabs(own, "manage", (id) => { if (id !== "manage")
            leave(id); }) : undefined,
        cards: `${wornIn}${spotsHtml}`,
        nav: { count: () => cards.length, focus: () => st.focus, setFocus: (i) => { st.focus = i; redraw(); }, use: (i) => pick(cards[i].pick) },
        onPick: pick,
        cancel: st.holding ? { label: "Put it back", run: () => { st.holding = undefined; redraw(); } } : undefined,
    };
}
/** Open the stove straight on its Manage stove tab (from where there's no other menu to tab from). */
export function openManageStove(g, stoveId) {
    openMenu(manageStoveSpec(g, stoveId, [], () => { }));
}
