// The side panel (clock, orders, trays, log) and the debug view.
import { earnedPoints, xpFor } from "../skills.js";
import { startingPantry } from "../stock.js";
import { ARCHETYPES, MEALS, NEED_IDS, REGULARS, TIME_WORDS, TUNING } from "../data.js";
import { unmetLogText } from "../needs.js";
import { isMuted, voicesNow } from "../sound/engine.js";
import { compactDate, shortDate } from "../calendar.js";
import { forceWeather, weatherLabel, weatherTags } from "../weather.js";
import { shelterFactor, spawnRegular, spawnVisitors } from "../patrons.js";
import { emptyTastes } from "../game.js";
import { resetSave } from "../day.js";
import { iconFor, itemLabel, slotsUsed } from "../serving.js";
import { objectives } from "../objectives.js";
import { updateQuest } from "./quest.js";
import { moneyHtml, PENCE_PER_CROWN } from "../money.js";
import { carterArrives } from "../shop.js";
const $ = (id) => document.getElementById(id);
export function updateHud(g, prompt) {
    const status = g.open ? (g.lastCall ? "LAST CALL" : "OPEN") : "CLOSED";
    updateStatus(g);
    const meal = g.mealMode ? MEALS.find((m) => m.id === g.mealNow()?.id) : undefined;
    const serving = g.mealMode ? ` · ${meal ? `${meal.icon} ${meal.name}` : "between meals"}` : "";
    $("clock").innerHTML = `<span class="st ${status.replace(" ", "")}">${status}</span>${serving} · ×${g.speed}${g.paused ? " · paused" : g.modal || g.arranging ? " · clock stopped" : ""}`;
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
    const orders = g.orders.filter((o) => o.open).sort((a, b) => a.no - b.no);
    $("orders").innerHTML = orders.length
        ? orders.map((o) => {
            const p = g.patron(o.patronId);
            const waited = Math.floor(g.minute - o.placedAt);
            return `<div class="order"><span>#${o.no} <span class="ic">${iconFor(o.recipeId, o.wantGarnish)}</span> ${o.label}</span><span class="who">${p?.name ?? "?"} · ${waited}m</span></div>`;
        }).join("")
        : `<div class="muted">No orders.</div>`;
    $("trays").innerHTML = g.keeper.trays.map((t, i) => {
        const head = `${i === 0 ? "Left" : "Right"} tray: ${t.items.length ? `${slotsUsed(t)} of ${g.traySlots} slots` : "empty"}`;
        return `<div class="tray"><div class="tray-h">${head}</div>${t.items.map((it) => `<div class="it">${itemLabel(it)}<span class="tags">${it.tags.join(", ")}</span></div>`).join("")}</div>`;
    }).join("");
    if (g.setDown.length) {
        $("trays").innerHTML += g.setDown.map((sd) => {
            const where = g.world.tile(sd.x, sd.y)?.def.kind === "table" ? "on a table" : "on the counter";
            return `<div class="tray"><div class="tray-h">Set down ${where}: ${sd.tray.items.length}</div>${sd.tray.items.map((it) => `<div class="it">${itemLabel(it)}</div>`).join("")}</div>`;
        }).join("");
    }
    // Ready to pick up: on the station shelves (and the hatch, once there's a cook).
    const ready = [
        ...[...g.shelves].flatMap(([fid, items]) => {
            const sl = g.world.slot(fid);
            const where = sl ? ((sl.f.slots?.length ?? 1) > 1 ? `${sl.f.name.toLowerCase()} (${sl.name.toLowerCase()})` : sl.f.name.toLowerCase()) : "station";
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
    updateQuest(g);
    if ($("debug").style.display !== "none")
        updateDebug(g);
}
/** The status card over the map: weekday, date, time and weather (the avatar slot waits for mood). */
function updateStatus(g) {
    const el = document.getElementById("status");
    if (!el)
        return;
    const d = g.date;
    el.querySelector(".st-day").textContent = d.weekday;
    el.querySelector(".st-date").textContent = shortDate(d);
    el.querySelector(".st-time b").textContent = g.clockText();
    el.querySelector(".st-wx").textContent = weatherLabel(g);
    // Redrawn only when the purse changes (it's HTML now: the coins).
    const purse = el.querySelector(".st-purse");
    if (purse.dataset.v !== String(g.purse)) {
        purse.dataset.v = String(g.purse);
        purse.innerHTML = moneyHtml(g.purse);
    }
    showGain(g, el);
}
/** Money coming in: "+…" beside the purse. Coins arriving close together add up. */
let lastPurse = null;
let gain = 0;
let gainTimer;
function showGain(g, el) {
    const before = lastPurse;
    lastPurse = g.purse;
    if (before === null || g.purse <= before)
        return;
    gain += g.purse - before;
    const tag = el.querySelector(".st-gain");
    tag.innerHTML = `+${moneyHtml(gain)}`;
    tag.classList.remove("on");
    void tag.offsetWidth;
    tag.classList.add("on");
    clearTimeout(gainTimer);
    gainTimer = window.setTimeout(() => { tag.classList.remove("on"); gain = 0; }, 2200);
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
        el.innerHTML = `<div class="muted">All set. Enjoy the ${TIME_WORDS[g.timeOfDay].part}. (O hides this)</div>`;
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
    $("dbg-coin-add").onclick = () => { g.purse += PENCE_PER_CROWN; };
    $("dbg-coin-sub").onclick = () => { g.purse = Math.max(0, g.purse - PENCE_PER_CROWN); };
    $("dbg-carter").onclick = () => { if (g.onOrder.length)
        carterArrives(g);
    else
        g.say("Nothing on order."); };
    $("dbg-pantry").onclick = () => { for (const [id, n] of Object.entries(startingPantry()))
        g.stock[id] = Math.max(g.stock[id] ?? 0, n); g.say("The pantry is stocked up."); };
    $("dbg-level").onclick = () => { g.xp = xpFor(earnedPoints(g) + 1); };
    const flow = $("dbg-flow");
    flow.oninput = () => { g.flowMultiplier = Number(flow.value); $("dbg-flow-v").textContent = `×${flow.value}`; };
    $("dbg-skip").onclick = () => {
        const target = (17 - TUNING.dayStartHour) * 60;
        if (g.minute < target)
            g.minute = target;
    };
    $("dbg-needs-copy").onclick = async () => {
        const note = $("dbg-needs-copied");
        try {
            await navigator.clipboard.writeText(unmetLogText(g));
            note.textContent = "Copied, tab-separated: paste into a sheet.";
        }
        catch {
            note.textContent = "Couldn't reach the clipboard.";
        }
        setTimeout(() => { note.textContent = ""; }, 3000);
    };
    $("dbg-weather-set").onclick = () => {
        const [sky, band] = $("dbg-weather").value.split(":");
        forceWeather(g, sky, band);
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
/** A patron's needs, 0 (met) to 1 (desperate). Unmet ones are marked, with how long so far. */
function needsLine(g, p) {
    return "needs: " + NEED_IDS.map((n) => {
        const v = p.needs[n].toFixed(2);
        const u = p.unmet[n];
        return u ? `<b style="color:#ff7a6a">${n} ${v} (${Math.floor(g.minute - u.since)}m)</b>` : `${n} ${v}`;
    }).join(" · ") + (p.soaked > 0.01 ? ` · <span style="color:#7fb0e0">soaked ${p.soaked.toFixed(2)}</span>` : "");
}
/** Count and average length per need, e.g. "hunger 4 × 23m · thirst 2 × 11m". */
function unmetSummary(list, inline = false) {
    const parts = NEED_IDS.map((n) => {
        const of = list.filter((u) => u.need === n);
        if (!of.length)
            return "";
        const avg = Math.round(of.reduce((a, u) => a + u.minutes, 0) / of.length);
        return `${n} ${of.length} × ${avg}m`;
    }).filter(Boolean).join(" · ");
    return inline || !parts ? parts : `<div>${parts}</div>`;
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
      <div>${needsLine(g, p)} · came for ${p.reason}${p.waitingOut !== undefined ? ` · waiting out the rain ${Math.floor(g.minute - p.waitingOut)}m` : ""}${p.leaveAfter ? " · leaving after this" : ""}</div>
      ${p.weatherTaste.love.length + p.weatherTaste.dislike.length ? `<div>weather ♥ ${p.weatherTaste.love.join(", ") || "–"} · ✗ ${p.weatherTaste.dislike.join(", ") || "–"}${p.cameIn?.band ? ` · came in from ${p.cameIn.band} (${p.cameIn.rain})` : ""}</div>` : ""}
      <div>schema: ${p.schema}${st ? ` · familiarity ${st.familiarity}${st.resolved ? " · resolved" : ""}${st.openedUp ? " · opened up" : ""}` : ""} · fuss ${p.fussiness.toFixed(2)} · mess ${p.messiness.toFixed(2)}</div>
      ${p.craving ? `<div>craving: ${p.craving.tag}${p.schema === "veiled" ? (p.craving.honest ? " (honest)" : " (noise)") : ""}</div>` : ""}
      <div>food ♥ ${t.food.love.join(", ") || "–"} · + ${t.food.like.join(", ") || "–"} · ✗ ${t.food.dislike.join(", ") || "–"}</div>
      <div>drink ♥ ${t.drink.love.join(", ") || "–"} · + ${t.drink.like.join(", ") || "–"} · ✗ ${t.drink.dislike.join(", ") || "–"}</div>
      ${st && (st.locks.food.love.length + st.locks.food.dislike.length + st.locks.drink.love.length + st.locks.drink.dislike.length) ? `<div>locked: food ♥${st.locks.food.love.join(",")} ✗${st.locks.food.dislike.join(",")} · drink ♥${st.locks.drink.love.join(",")} ✗${st.locks.drink.dislike.join(",")}</div>` : ""}</div>`;
    }).join("") || `<div class="muted">Nobody inside.</div>`;
    const w = g.weather;
    $("dbg-weather-now").textContent = `${weatherLabel(g)} · ${w.sky}${w.band ? ` ${w.rain.toFixed(2)} → ${w.target.toFixed(2)}${w.ending ? " (easing off)" : ""}` : ""} · ${w.hours.toFixed(1)}h · tags: ${weatherTags(g).join(", ") || "–"}`;
    const playing = voicesNow().filter((v) => v.gain > 0.01);
    $("dbg-sounds").textContent = playing.length ? playing.map((v) => `${v.key} ${v.gain.toFixed(2)}`).join(" · ") : (isMuted() ? "muted" : "nothing audible");
    const unmet = g.stats.unmet ?? [];
    const open = g.patrons.flatMap((p) => NEED_IDS.filter((n) => p.unmet[n]).map((n) => ({ p, n })));
    $("dbg-needs").innerHTML = (unmetSummary(unmet) || `<div class="muted">None logged yet.</div>`)
        + (open.length ? `<div>Going on now: ${open.map(({ p, n }) => `${p.name} ${n} ${Math.floor(g.minute - p.unmet[n].since)}m`).join(" · ")}</div>` : "")
        + unmet.slice(-6).reverse().map((u) => `<div class="muted">${u.from} ${u.who}: ${u.need} ${u.minutes}m (peak ${u.peak}, ${u.ended})${u.while.length ? ` · ${u.while.join(", ")}` : ""}</div>`).join("");
    $("dbg-regulars").innerHTML = [...g.regulars.values()].map((r) => {
        const d = g.regularDef(r.id);
        return `<div>${d.name} (${d.schema}) · fam ${r.familiarity} · visits ${r.visits}${r.resolved ? " · resolved" : ""}${r.openedUp ? " · opened up" : ""} · today ${r.visitedToday ? "came" : r.arriveAt !== undefined ? `~${g.clockText(r.arriveAt)}` : "–"}</div>`;
    }).join("");
    const h = g.history.slice(-5).map((s) => `<div>Day ${s.day} (${compactDate(g.dateOfDay(s.day), g.date.year)}): ${s.arrivals} in, ${s.served} served, ${s.outcomes.DELIGHT} delight, ${s.outcomes.COMPLAINS} complaints, ${s.leftEarly} left early${s.unmet?.length ? ` · unmet: ${unmetSummary(s.unmet, true)}` : ""}</div>`).join("");
    $("dbg-history").innerHTML = h || `<div class="muted">No finished days yet.</div>`;
    $("dbg-next").textContent = g.open && !g.lastCall ? `next arrival ~${g.clockText(g.nextArrivalAt)} · flow now ${(TUNING.flowByHour[g.hour] * g.loc.traffic * shelterFactor(g) * g.flowMultiplier).toFixed(1)}/h (shelter ×${shelterFactor(g).toFixed(2)})` : "inn closed";
    $("dbg-next").textContent = `${g.loc.name} · ${$("dbg-next").textContent}`;
}
