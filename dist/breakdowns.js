import { EQUIPMENT_DATA } from "./gamedata.gen.js";
import { lowerName, pieceById } from "./data.js";
import { knack } from "./skills.js";
import { spend, fmtMoney } from "./money.js";
import { TUNING } from "./data.js";
import { pieceOf } from "./seasoning.js";
const H = EQUIPMENT_DATA.health;
export const mostHealth = (type) => H.base + H.perTier * ((pieceById(type)?.tier ?? 1) - 1);
const stateOf = (g, uid) => (g.seasoning[uid] ??= { made: 0, traits: [] });
export const healthOf = (g, uid, type) => g.seasoning[uid]?.health ?? mostHealth(type);
export const isBrokenPiece = (g, uid) => !!g.seasoning[uid]?.broken;
/** Is the piece this place to cook belongs to broken? Its name, if so. */
export function brokenAt(g, slotId) {
    const p = pieceOf(g, slotId);
    return p && isBrokenPiece(g, p.uid) ? p.name : undefined;
}
const BREAKS = ["a hob's cracked", "the flue's blocked", "a hinge has gone", "the handle's come off", "it's sprung a leak", "something inside went clunk"];
/** Something was finished here: it wears a little, and may break. */
export function wearDown(g, slotId, servings) {
    const p = pieceOf(g, slotId);
    if (!p)
        return;
    const s = stateOf(g, p.uid);
    const most = mostHealth(p.type);
    s.health = Math.max(0, (s.health ?? most) - H.lossPerServing * servings * knack(g, "gentleHands", 1));
    if (s.broken || Math.random() >= H.breakChanceAtZero * (1 - s.health / most) ** 3)
        return;
    s.broken = true;
    g.say(`🔧 The ${lowerName(p.name)} has broken down: ${BREAKS[Math.floor(Math.random() * BREAKS.length)]}. Nothing cooks on it until it's mended: call the tinker from its Manage tab.`);
}
/** What the tinker charges to mend it. */
export const tinkerFee = (type) => Math.max(H.tinker.least, Math.round((pieceById(type)?.price ?? 0) * H.tinker.share));
export const tinkerComing = (g, uid) => g.tinkerCalls.find((c) => c.uid === uid);
/** Send for the tinker: paid now, he comes in a couple of hours (or first thing tomorrow). */
export function callTinker(g, uid, type, name) {
    if (tinkerComing(g, uid))
        return false;
    const fee = tinkerFee(type);
    if (!spend(g, fee)) {
        g.say(`The tinker wants ${fmtMoney(fee)}; you have ${fmtMoney(g.purse)}.`);
        return false;
    }
    const at = g.minute + H.tinker.minutes;
    const late = at >= TUNING.dayLengthMinutes;
    g.tinkerCalls.push({ uid, name, day: late ? g.day + 1 : g.day, minute: late ? 60 : at });
    g.say(`You send for the tinker (${fmtMoney(fee)}). ${late ? "He'll come first thing tomorrow." : `He'll be here in about ${Math.round(H.tinker.minutes / 60)} hours.`}`);
    return true;
}
function mended(g, uid, type, share) {
    const s = stateOf(g, uid);
    s.broken = false;
    s.health = Math.max(s.health ?? 0, mostHealth(type) * share);
}
/** Every frame the clock runs: the tinker arrives when he's due. */
export function updateTinker(g) {
    for (const c of [...g.tinkerCalls]) {
        if (g.day < c.day || (g.day === c.day && g.minute < c.minute))
            continue;
        g.tinkerCalls.splice(g.tinkerCalls.indexOf(c), 1);
        const p = g.layout.find((x) => x.uid === c.uid);
        if (!p)
            continue;
        mended(g, c.uid, p.type, 1);
        g.say(`🔧 The tinker's been: the ${lowerName(c.name)} is mended, good as new.`);
    }
}
/** Can a piece be looked over today? */
export const canLookOver = (g, uid) => !isBrokenPiece(g, uid) && g.seasoning[uid]?.lookedOver !== g.day;
/** Start looking a piece over, or mending it yourself: you stay with it for a few seconds. */
export function startMending(g, uid, name, kind) {
    g.mending = { uid, name, kind, progress: 0, total: kind === "look" ? H.lookOver.seconds : H.mendSeconds, at: { ...g.keeper.pos } };
    g.say(kind === "look" ? `You look the ${lowerName(name)} over. Stay with it a moment.` : `You set about mending the ${lowerName(name)}. Stay with it a moment.`);
}
/** Every frame: the looking over or mending under way. Walking away stops it. */
export function updateMending(g, realDt) {
    const m = g.mending;
    if (!m || g.paused)
        return;
    if (Math.hypot(g.keeper.pos.x - m.at.x, g.keeper.pos.y - m.at.y) > 0.3) {
        g.mending = null;
        g.say(`You leave the ${lowerName(m.name)} for now.`);
        return;
    }
    m.progress += realDt;
    if (m.progress < m.total)
        return;
    g.mending = null;
    const p = g.layout.find((x) => x.uid === m.uid);
    if (!p)
        return;
    if (m.kind === "mend") {
        mended(g, m.uid, p.type, knack(g, "handy", 0));
        g.say(`🔧 You've mended the ${lowerName(m.name)}.`);
    }
    else {
        const s = stateOf(g, m.uid);
        s.health = Math.min(mostHealth(p.type), healthOf(g, m.uid, p.type) + H.lookOver.restores);
        s.lookedOver = g.day;
        g.say(`You've looked the ${lowerName(m.name)} over: tightened, cleaned, oiled.`);
    }
}
