// Arranging the kitchen: pick up a stove, an oven, a kettle… and put it somewhere else, or place one
// you've just bought. The clock stops while you do. What's cooking on it moves with it (its slots keep
// their ids). A spot is allowed when it's kitchen floor, behind the bar or a nook in the counter wall,
// nothing else stands there, and the keeper can still reach everything.
import { EQUIPMENT, PLACEABLE_ON } from "../data.js";
let grab = { x: 0, y: 0 }; // where on the piece it was picked up
const verdicts = new Map();
const newUid = () => `eq-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const eqOf = (type) => EQUIPMENT.find((e) => e.id === type);
export function startArranging(g, buyType) {
    g.arranging = buyType ? { holding: { uid: newUid(), type: buyType, isNew: true } } : {};
    grab = { x: 0, y: 0 };
    g.keeper.path = [];
    g.keeper.pendingInteract = null;
    verdicts.clear();
    bar(g);
}
export function stopArranging(g) {
    if (g.arranging?.holding?.isNew)
        g.say(`You send the ${eqOf(g.arranging.holding.type).name.toLowerCase()} back.`);
    g.arranging = null;
    document.getElementById("arrange-bar")?.remove();
}
/** Where the held piece would go, from the tile under the mouse. */
function anchor(g) {
    const a = g.arranging;
    if (!a?.hover)
        return null;
    return { x: a.hover.x - grab.x, y: a.hover.y - grab.y };
}
function allowed(g, type, at, moving) {
    const key = `${type}|${at.x},${at.y}|${moving}`;
    let ok = verdicts.get(key);
    if (ok === undefined) {
        ok = g.world.canPlace(type, at.x, at.y, moving, g.layout, g.keeper.pos);
        verdicts.set(key, ok);
    }
    return ok;
}
export function arrangeHover(g, p) {
    if (g.arranging)
        g.arranging.hover = { x: Math.floor(p.x), y: Math.floor(p.y) };
}
export function arrangeClick(g, p) {
    const a = g.arranging;
    if (!a)
        return;
    arrangeHover(g, p);
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (!a.holding) {
        const uid = g.world.tile(tx, ty)?.equip;
        const placed = g.layout.find((x) => x.uid === uid);
        if (!placed)
            return;
        a.holding = { uid: placed.uid, type: placed.type, isNew: false };
        grab = { x: tx - placed.x, y: ty - placed.y };
        g.bus.emit({ type: "Paper", what: "menu" });
        bar(g);
        return;
    }
    const at = anchor(g);
    const h = a.holding;
    const placed = g.layout.find((x) => x.uid === h.uid);
    if (placed && placed.x === at.x && placed.y === at.y) {
        a.holding = undefined;
        bar(g);
        return;
    } // put back where it was
    if (!allowed(g, h.type, at, h.isNew ? null : h.uid)) {
        g.say("It won't go there: it needs kitchen floor, and room to get at everything.");
        return;
    }
    const name = eqOf(h.type).name.toLowerCase();
    if (h.isNew) {
        g.layout.push({ uid: h.uid, type: h.type, x: at.x, y: at.y });
        g.say(`The ${name} is in.`);
    }
    else if (placed) {
        placed.x = at.x;
        placed.y = at.y;
        g.say(`You move the ${name}.`);
    }
    a.holding = undefined;
    grab = { x: 0, y: 0 };
    verdicts.clear();
    g.rebuildWorld();
    g.bus.emit({ type: "Confirmed" });
    bar(g);
}
/** Esc or right-click: put back what you're holding; with nothing held, finish arranging. */
export function arrangeCancel(g) {
    const a = g.arranging;
    if (!a)
        return;
    if (a.holding) {
        if (a.holding.isNew)
            g.say(`You send the ${eqOf(a.holding.type).name.toLowerCase()} back.`);
        a.holding = undefined;
        grab = { x: 0, y: 0 };
        bar(g);
        return;
    }
    stopArranging(g);
}
/** Delete: get rid of the piece you're holding, if nothing's cooking on it. */
export function arrangeRemove(g) {
    const h = g.arranging?.holding;
    if (!h)
        return;
    if (h.isNew) {
        arrangeCancel(g);
        return;
    }
    const f = g.world.furniture.find((x) => x.id === h.uid);
    const busy = (f?.slots ?? []).some((sl) => g.jobs.has(sl.id) || g.pots.has(sl.id) || g.shelves.get(sl.id)?.length);
    if (busy) {
        g.say("Something's still on it. Finish with that first.");
        return;
    }
    g.layout = g.layout.filter((x) => x.uid !== h.uid);
    g.say(`The ${eqOf(h.type).name.toLowerCase()} goes out to the shed.`);
    g.arranging.holding = undefined;
    verdicts.clear();
    g.rebuildWorld();
    bar(g);
}
/** The banner at the top: what to do now, and Done. */
function bar(g) {
    let el = document.getElementById("arrange-bar");
    if (!el) {
        el = document.createElement("div");
        el.id = "arrange-bar";
        document.getElementById("stage")?.appendChild(el);
    }
    const h = g.arranging?.holding;
    const what = h ? eqOf(h.type).name.toLowerCase() : "";
    el.innerHTML = `<span>🛠 <b>Arranging the kitchen</b> · the clock's stopped · ${h
        ? `click where the ${what} should go · Esc ${h.isNew ? "sends it back" : "puts it back"}${h.isNew ? "" : " · Delete gets rid of it"}`
        : "click a stove, oven, kettle or coffee pot to move it"}</span><button>Done</button>`;
    el.querySelector("button").onclick = () => stopArranging(g);
}
/** Over the map: where things can go, the piece in hand (green where it fits, red where it doesn't). */
export function drawArrange(ctx, g, view) {
    const a = g.arranging;
    if (!a)
        return;
    const { ts, ox, oy } = view;
    const X = (x) => ox + x * ts, Y = (y) => oy + y * ts;
    // Free spots for equipment: a faint wash.
    ctx.fillStyle = "rgba(160,220,140,0.08)";
    for (const row of g.world.tiles)
        for (const t of row) {
            if (PLACEABLE_ON.includes(t.base) && !t.equip)
                ctx.fillRect(X(t.x) + 1, Y(t.y) + 1, ts - 2, ts - 2);
        }
    // Every piece of equipment, outlined; the one in hand dimmed where it stood.
    ctx.setLineDash([ts * 0.12, ts * 0.08]);
    ctx.lineWidth = Math.max(1, ts * 0.05);
    for (const p of g.layout) {
        const eq = eqOf(p.type);
        const held = a.holding?.uid === p.uid;
        ctx.strokeStyle = held ? "rgba(255,255,255,0.35)" : "#ffd34d";
        ctx.strokeRect(X(p.x) + 2, Y(p.y) + 2, eq.w * ts - 4, eq.h * ts - 4);
        if (held) {
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(X(p.x) + 2, Y(p.y) + 2, eq.w * ts - 4, eq.h * ts - 4);
        }
    }
    ctx.setLineDash([]);
    // The piece in hand.
    const at = anchor(g);
    if (a.holding && at) {
        const eq = eqOf(a.holding.type);
        const ok = allowed(g, eq.id, at, a.holding.isNew ? null : a.holding.uid);
        ctx.fillStyle = ok ? "rgba(110,190,110,0.55)" : "rgba(210,90,80,0.5)";
        ctx.strokeStyle = ok ? "#9be27a" : "#e07060";
        ctx.lineWidth = 2;
        ctx.fillRect(X(at.x) + 2, Y(at.y) + 2, eq.w * ts - 4, eq.h * ts - 4);
        ctx.strokeRect(X(at.x) + 2, Y(at.y) + 2, eq.w * ts - 4, eq.h * ts - 4);
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.floor(ts * 0.32)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(eq.label, X(at.x) + (eq.w * ts) / 2, Y(at.y) + (eq.h * ts) / 2);
        ctx.lineWidth = 1;
    }
}
