// The Supplies screen at the desk: a tab per supplier, their goods as cards (pick one to pencil a pack onto
// the slip, - or Delete takes one off), the slip and the supplier's terms pinned on top.
import { INGREDIENTS, RECIPES } from "../data.js";
import { fmtMoney, moneyHtml } from "../money.js";
import { amount, startingPantry } from "../stock.js";
import { canFetchFrom, deliveryDaysText, fetchSlip, linesOf, nextDeliveryDay, packContents, packPrice, sendSlip, slipEmpty, slipOf, slipTotal, suppliersHere, whenText, } from "../supplies.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
let tab = 0; // the screen opens on the supplier you left it at
/** Below this share of the starting pantry, an ingredient the bill uses is running low. */
const LOW_SHARE = 0.25;
/** Each ingredient the dishes on the bill of fare use, with those dishes' names. */
function usedByBill(g) {
    const out = new Map();
    for (const r of RECIPES.filter((x) => g.billAllDay().has(x.id))) {
        const ids = new Set([...r.fundamental.map((u) => u.id), ...r.base.options.map((o) => o.id), ...r.optional.options.map((o) => o.id), ...(r.boughtAs ? [r.boughtAs] : [])]);
        for (const id of ids)
            out.set(id, [...(out.get(id) ?? []), r.name.toLowerCase()]);
    }
    return out;
}
export function openSupplies(g) {
    const st = { focus: 0 };
    const build = () => {
        const all = suppliersHere(g);
        tab = Math.min(tab, all.length - 1);
        const s = all[tab];
        const uses = usedByBill(g);
        const start = startingPantry();
        const left = (id) => (g.stock[id] ?? 0) / Math.max(1, start[id] ?? 1);
        const low = (id) => left(id) < LOW_SHARE;
        const lines = [...linesOf(s)].sort((a, b) => Number(uses.has(b.item)) - Number(uses.has(a.item)) || (uses.has(a.item) ? left(a.item) - left(b.item) : 0));
        const forBill = lines.filter((l) => uses.has(l.item)).length;
        const slip = slipOf(g, s);
        const ing = (id) => INGREDIENTS.find((x) => x.id === id);
        const refresh = () => replaceMenu(build());
        const change = (i, by) => {
            const l = lines[i];
            if (!l)
                return;
            slip[l.item] = Math.max(0, (slip[l.item] ?? 0) + by);
            st.focus = i;
            g.bus.emit({ type: "MenuSound", sound: by > 0 ? "penClick" : "tick" });
            refresh();
        };
        const switchTab = (by) => { tab = (tab + by + all.length) % all.length; st.focus = 0; g.bus.emit({ type: "MenuSound", sound: "pageTurn" }); refresh(); };
        const cards = lines.map((l, i) => {
            const x = ing(l.item);
            const on = slip[l.item] ?? 0;
            return {
                pick: String(i), icon: x.icon, name: x.name, tags: x.tags, focus: i === st.focus, on: on > 0,
                fact: `${moneyHtml(packPrice(s, l))} <span class="unit">${l.pack.name}</span>`,
                status: on ? `${on} on the slip` : `${amount(l.item, g.stock[l.item] ?? 0)} in the pantry${uses.has(l.item) ? ` · for ${uses.get(l.item).join(", ")}` : ""}${uses.has(l.item) && low(l.item) ? " · running low" : ""}`,
                tone: on ? "good" : (g.stock[l.item] ?? 0) <= 0 || (uses.has(l.item) && low(l.item)) ? "warn" : undefined,
                detail: `${l.pack.name[0].toUpperCase()}${l.pack.name.slice(1)}: ${packContents(l)}. In the pantry: ${amount(l.item, g.stock[l.item] ?? 0)}.`,
                does: on ? "Add another (- or Delete takes one off)" : "Pencil it onto the slip",
            };
        });
        const total = slipTotal(s, slip);
        const day = nextDeliveryDay(g, s);
        const coming = g.deliveries.filter((d) => d.supplierId === s.id);
        const onSlip = lines.filter((l) => slip[l.item]);
        const terms = [
            deliveryDaysText(s) + (s.orderBy !== undefined ? `, order by ${s.orderBy}:00` : ""),
            s.distanceInMinutes !== undefined ? `fetch it yourself: ${s.distanceInMinutes} min there and back, open ${s.openHours?.[0]}:00–${s.openHours?.[1]}:00` : "",
            coming.length ? `🛻 coming ${coming.map((d) => whenText(g, d.day)).join(", ")}` : "",
        ].filter(Boolean).join(" · ");
        const pinned = `<div class="bf-tabs">${all.map((x, i) => `<button class="${i === tab ? "on" : ""}" data-pick="tab:${i}">${x.icon} ${x.name}${slipEmpty(g.slips[x.id]) ? "" : " ✎"}</button>`).join("")}</div>
      <div class="dish result ${onSlip.length ? "" : "empty"}">
        <span class="ic">📝</span>
        <div class="dish-body">
          <div class="nm">Slip for ${s.name}${s.people[0] ? ` <small>(${s.people[0]})</small>` : ""}</div>
          <div class="meta slip-lines">${onSlip.length ? onSlip.map((l) => `<span class="slip-line">${slip[l.item]} × ${l.pack.name} of ${ing(l.item).name.toLowerCase()} <button class="ghost slip-minus" data-pick="minus:${lines.indexOf(l)}" title="Take one off">−</button></span>`).join(" ") : "Nothing pencilled in yet"}${onSlip.length ? ` · ${moneyHtml(total)}` : ""}</div>
          <div class="meta">${terms}</div>
        </div>
      </div>`;
        const items = [];
        if (onSlip.length) {
            items.push({ label: day !== undefined ? `🛻 Send it: ${fmtMoney(total)}` : "They don't deliver", sub: day !== undefined ? `comes ${whenText(g, day)} · the carter charges a few pence a morning` : "fetch it yourself",
                button: "primary", disabled: day === undefined || g.purse < total, action: () => { if (sendSlip(g, s)) {
                    g.bus.emit({ type: "MenuSound", sound: "coins" });
                    refresh();
                } } });
            if (s.distanceInMinutes !== undefined)
                items.push({ label: `🚶 Fetch it yourself: ${fmtMoney(total)}`, sub: canFetchFrom(g, s) ? `you're out ${s.distanceInMinutes} min; no carter's fee` : "only while the inn is shut and empty, and they're open",
                    disabled: !canFetchFrom(g, s) || g.purse < total, action: () => { if (fetchSlip(g, s)) {
                        g.bus.emit({ type: "MenuSound", sound: "coins" });
                        closeAll();
                    } } });
            for (const l of onSlip)
                items.push({ label: `− ${l.pack.name} of ${ing(l.item).name.toLowerCase()}`, sub: `${slip[l.item]} on the slip`, button: "secondary", action: () => change(lines.indexOf(l), -1) });
            items.push({ label: "Tear it up", button: "secondary", action: () => { g.slips[s.id] = {}; g.bus.emit({ type: "MenuSound", sound: "paperClose" }); refresh(); } });
        }
        else if (!slipEmpty(g.lastSlips[s.id])) {
            items.push({ label: "Copy last slip", sub: "the same again", action: () => { g.slips[s.id] = { ...g.lastSlips[s.id] }; refresh(); } });
        }
        return {
            title: "🧺 Supplies",
            subtitle: `${moneyHtml(g.purse)} in the purse · pencil packs onto a slip, then send it or fetch it`,
            holdsClock: true,
            view: {
                pinned,
                html: (forBill ? `<div class="sec-h"><h4>For your bill of fare</h4><small>what's on it uses these · lowest first</small></div>${grid(cards.slice(0, forBill))}` : "")
                    + (cards.length > forBill ? `<div class="sec-h"><h4>${forBill ? "Everything else" : "Their goods"}</h4><small>${forBill ? "nothing on your bill uses these" : "nothing on your bill comes from here"}</small></div>${grid(cards.slice(forBill))}` : ""),
                onPick: (v) => { if (v.startsWith("minus:")) {
                    change(Number(v.slice(6)), -1);
                    return;
                } if (v.startsWith("tab:")) {
                    const i = Number(v.slice(4));
                    if (i !== tab) {
                        tab = i;
                        st.focus = 0;
                        g.bus.emit({ type: "MenuSound", sound: "pageTurn" });
                        refresh();
                    }
                    return;
                } change(Number(v), 1); },
                onKey: (e) => {
                    if (e.key === "Tab") {
                        e.preventDefault();
                        switchTab(e.shiftKey ? -1 : 1);
                        return true;
                    }
                    if (e.key === "-" || e.key === "Delete") {
                        change(st.focus, -1);
                        return true;
                    }
                    return gridKeys(() => cards.length, () => st.focus, (i) => { st.focus = i; refresh(); }, (i) => change(i, 1))(e);
                },
            },
            items,
        };
    };
    openMenu(build());
}
