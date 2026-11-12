// The side panel (clock, orders, trays, log) and the debug view.
import { ARCHETYPES, REGULARS, TUNING } from "../data.js";
import { spawnRegular, spawnVisitors } from "../patrons.js";
import { emptyTastes } from "../game.js";
import { resetSave } from "../day.js";
import { iconFor, itemLabel } from "../serving.js";
import { objectives } from "../objectives.js";
const $ = (id) => document.getElementById(id);
export function updateHud(g, prompt) {
    const status = g.open ? (g.lastCall ? "LAST CALL" : "OPEN") : "CLOSED";
    $("clock").innerHTML = `Day ${g.day} · <b>${g.clockText()}</b> · <span class="st ${status.replace(" ", "")}">${status}</span> · ×${g.speed}${g.paused ? " · paused" : ""}`;
    $("prompt").textContent = prompt;
    // Journal heads-up: a toast for the latest note, and a count until the journal is opened.
    const toast = document.getElementById("toast");
    if (toast) {
        const t = g.journalToast;
        toast.textContent = t && performance.now() < t.until ? t.text : "";
        toast.style.opacity = toast.textContent ? "1" : "0";
    }
    const jb = document.getElementById("tb-journal");
    if (jb)
        jb.dataset.badge = g.journalUnread ? String(Math.min(99, g.journalUnread)) : "";
    const jn = document.getElementById("journal-new");
    if (jn)
        jn.textContent = g.journalUnread ? `📖 ${g.journalUnread} new in the journal (J)` : "";
    const mini = document.getElementById("miniclock");
    const carrying = g.keeper.trays.map((t) => t.items.map((i) => iconFor(i.recipeId, i.garnish) || "🥣").join("") || "–").join(" | ");
    if (mini)
        mini.innerHTML = `${$("clock").innerHTML}<div>Trays: ${carrying}</div>${prompt ? `<div style="color:var(--accent)">${prompt}</div>` : ""}`;
    const orders = g.orders.filter((o) => o.open).sort((a, b) => a.placedAt - b.placedAt);
    $("orders").innerHTML = orders.length
        ? orders.map((o) => {
            const p = g.patron(o.patronId);
            const waited = Math.floor(g.minute - o.placedAt);
            return `<div class="order"><span><span class="ic">${iconFor(o.recipeId, o.wantGarnish)}</span> ${o.label}</span><span class="who">${p?.name ?? "?"} · ${waited}m</span></div>`;
        }).join("")
        : `<div class="muted">No orders.</div>`;
    $("trays").innerHTML = g.keeper.trays.map((t, i) => {
        const head = `${i === 0 ? "Left" : "Right"} tray: ${t.kind ? `${t.kind} ${t.items.length}/${g.trayCap(t.kind)}` : "empty"}`;
        return `<div class="tray"><div class="tray-h">${head}</div>${t.items.map((it) => `<div class="it">${itemLabel(it)}<span class="tags">${it.tags.join(", ")}</span></div>`).join("")}</div>`;
    }).join("");
    if (g.setDown.length) {
        $("trays").innerHTML += g.setDown.map((sd) => {
            const where = g.world.tile(sd.x, sd.y)?.def.kind === "table" ? "on a table" : "on the counter";
            return `<div class="tray"><div class="tray-h">Set down ${where}: ${sd.tray.items.length} ${sd.tray.kind ?? ""}</div>${sd.tray.items.map((it) => `<div class="it">${itemLabel(it)}</div>`).join("")}</div>`;
        }).join("");
    }
    // Ready to pick up: on the station shelves (and the hatch, once there's a cook).
    const ready = [
        ...[...g.shelves].flatMap(([fid, items]) => {
            const where = g.world.furniture.find((f) => f.id === fid)?.name.toLowerCase() ?? "station";
            return items.map((it) => `<div class="it">${itemLabel(it)} <span class="muted">· ${where}</span></div>`);
        }),
        ...g.hatch.map((it) => `<div class="it">${itemLabel(it)} <span class="muted">· hatch</span></div>`),
    ];
    $("hatch").innerHTML = ready.length ? ready.join("") : `<div class="muted">Nothing waiting.</div>`;
    const pies = document.getElementById("pies");
    if (pies)
        pies.innerHTML = g.pieSafe.length
            ? g.pieSafe.map((p) => `<div class="it">🥧 ${p.item.name} · ${p.left}/${p.total}</div>`).join("")
            : `<div class="muted">Empty.</div>`;
    $("log").innerHTML = g.log.slice(-9).reverse().map((l) => `<div${l.text.startsWith("⚠") ? ' style="color:#ff7a6a"' : ""}><span class="t">${g.clockText(l.at)}</span> ${l.text}</div>`).join("");
    updateObjectives(g);
    if ($("debug").style.display !== "none")
        updateDebug(g);
}
/** The optional morning checklist, so new players know where to start. */
function updateObjectives(g) {
    const el = document.getElementById("objectives");
    if (!el)
        return;
    const sec = el.parentElement;
    if (!g.showObjectives) {
        sec.style.display = "none";
        return;
    }
    sec.style.display = "";
    const list = objectives(g);
    if (g.open && list.every((o) => o.done || o.optional)) {
        el.innerHTML = `<div class="muted">All set. Enjoy the evening. (O hides this)</div>`;
        return;
    }
    el.innerHTML = list.map((o) => `<div class="obj ${o.done ? "done" : ""}">${o.done ? "☑" : "☐"} ${o.text}${o.optional ? ' <span class="muted">(optional)</span>' : ""}</div>`).join("");
}
export function initDebug(g) {
    const sel = $("dbg-arch");
    sel.innerHTML = `<option value="">Random visitor</option>` + ARCHETYPES.map((a) => `<option value="${a.id}">${a.name}</option>`).join("")
        + REGULARS.map((r) => `<option value="reg:${r.id}">${r.name} (${r.schema})</option>`).join("");
    $("dbg-spawn").onclick = () => {
        if (sel.value.startsWith("reg:")) {
            const def = REGULARS.find((r) => r.id === sel.value.slice(4));
            if (g.patrons.some((p) => p.regularId === def.id)) {
                g.say(`${def.name} is already here.`);
                return;
            }
            if (!g.regulars.has(def.id))
                g.regulars.set(def.id, { id: def.id, familiarity: 0, visits: 0, locks: emptyTastes(), resolved: false, openedUp: false, journal: [] });
            if (!spawnRegular(g, def, g.regulars.get(def.id)))
                g.say("No free seat.");
            return;
        }
        const a = ARCHETYPES.find((x) => x.id === sel.value);
        if (!spawnVisitors(g, a))
            g.say("No room, not even on the bench.");
    };
    const flow = $("dbg-flow");
    flow.oninput = () => { g.flowMultiplier = Number(flow.value); $("dbg-flow-v").textContent = `×${flow.value}`; };
    $("dbg-skip").onclick = () => {
        const target = (17 - TUNING.dayStartHour) * 60;
        if (g.minute < target)
            g.minute = target;
    };
    const reset = $("dbg-reset");
    let armed = false;
    reset.onclick = () => {
        if (!armed) {
            armed = true;
            reset.textContent = "Click again to forget all days";
            setTimeout(() => { armed = false; reset.textContent = "Reset save"; }, 3000);
            return;
        }
        resetSave();
        location.reload();
    };
}
export function toggleDebug() {
    const d = $("debug");
    d.style.display = d.style.display === "none" ? "block" : "none";
}
function updateDebug(g) {
    $("dbg-patrons").innerHTML = g.patrons.map((p) => {
        const o = g.order(p.orderId);
        const t = p.tastes;
        const st = g.regular(p.regularId);
        return `<div class="dp"><b style="color:${p.color}">${p.name}</b>${p.groupId && (g.groups.find((x) => x.id === p.groupId)?.members.length ?? 0) > 1 ? ` <span class="muted">(party #${p.groupId})</span>` : ""} · ${p.state}${o?.open ? ` · wants ${o.label} (${Math.floor(g.minute - p.waitedSince)}/${Math.floor(p.patience)}m)` : ""}
      <div>schema: ${p.schema}${st ? ` · familiarity ${st.familiarity}${st.resolved ? " · resolved" : ""}${st.openedUp ? " · opened up" : ""}` : ""} · fuss ${p.fussiness.toFixed(2)} · mess ${p.messiness.toFixed(2)}</div>
      ${p.craving ? `<div>craving: ${p.craving.tag}${p.schema === "veiled" ? (p.craving.honest ? " (honest)" : " (noise)") : ""}</div>` : ""}
      <div>food ♥ ${t.food.love.join(", ") || "–"} · + ${t.food.like.join(", ") || "–"} · ✗ ${t.food.dislike.join(", ") || "–"}</div>
      <div>drink ♥ ${t.drink.love.join(", ") || "–"} · + ${t.drink.like.join(", ") || "–"} · ✗ ${t.drink.dislike.join(", ") || "–"}</div>
      ${st && (st.locks.food.love.length + st.locks.food.dislike.length + st.locks.drink.love.length + st.locks.drink.dislike.length) ? `<div>locked: food ♥${st.locks.food.love.join(",")} ✗${st.locks.food.dislike.join(",")} · drink ♥${st.locks.drink.love.join(",")} ✗${st.locks.drink.dislike.join(",")}</div>` : ""}</div>`;
    }).join("") || `<div class="muted">Nobody inside.</div>`;
    $("dbg-regulars").innerHTML = [...g.regulars.values()].map((r) => {
        const d = g.regularDef(r.id);
        return `<div>${d.name} (${d.schema}) · fam ${r.familiarity} · visits ${r.visits}${r.resolved ? " · resolved" : ""}${r.openedUp ? " · opened up" : ""} · today ${r.visitedToday ? "came" : r.arriveAt !== undefined ? `~${g.clockText(r.arriveAt)}` : "–"}</div>`;
    }).join("");
    const h = g.history.slice(-5).map((s) => `<div>Day ${s.day}: ${s.arrivals} in, ${s.served} served, ${s.outcomes.DELIGHT} delight, ${s.outcomes.COMPLAINS} complaints, ${s.leftEarly} left early</div>`).join("");
    $("dbg-history").innerHTML = h || `<div class="muted">No finished days yet.</div>`;
    $("dbg-next").textContent = g.open && !g.lastCall ? `next arrival ~${g.clockText(g.nextArrivalAt)} · flow now ${(TUNING.flowByHour[g.hour] * g.flowMultiplier).toFixed(1)}/h` : "inn closed";
}
