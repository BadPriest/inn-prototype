// The Supplies screen at the desk: a tab per supplier, their goods as cards (pick one to pencil a pack onto
// the slip, - or Delete takes one off), the slip and the supplier's terms pinned on top.
import { INGREDIENTS } from "../data.js";
import { fmtMoney, moneyHtml } from "../money.js";
import { amount } from "../stock.js";
import { canFetchFrom, deliveryDaysText, fetchSlip, linesOf, nextDeliveryDay, packContents, packPrice, sendSlip, slipEmpty, slipOf, slipTotal, suppliersHere, whenText, } from "../supplies.js";
import { closeAll, openMenu, replaceMenu } from "./menu.js";
import { grid, gridKeys } from "./cards.js";
let tab = 0; // the screen opens on the supplier you left it at
export function openSupplies(g) {
    const st = { focus: 0 };
    const build = () => {
        const all = suppliersHere(g);
        tab = Math.min(tab, all.length - 1);
        const s = all[tab];
        const lines = linesOf(s);
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
                status: on ? `${on} on the slip` : `${amount(l.item, g.stock[l.item] ?? 0)} in the pantry`,
                tone: on ? "good" : (g.stock[l.item] ?? 0) <= 0 ? "warn" : undefined,
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
          <div class="meta">${onSlip.length ? onSlip.map((l) => `${slip[l.item]} × ${l.pack.name} of ${ing(l.item).name.toLowerCase()}`).join(", ") : "Nothing pencilled in yet"}${onSlip.length ? ` · ${moneyHtml(total)}` : ""}</div>
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
                html: grid(cards),
                onPick: (v) => { if (v.startsWith("tab:")) {
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
