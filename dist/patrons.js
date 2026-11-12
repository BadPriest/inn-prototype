// Patrons: arrivals, walking, ordering, waiting, eating, mess and leaving.
import { chance, organic, pick, uid, weightedPick } from "./core.js";
import { ARCHETYPES, CHATTER, GARNISHES, INGREDIENTS, RECIPES, REGULARS, SNACKS, TALK_TUNING, TUNING } from "./data.js";
import { emptyTastes } from "./game.js";
import { appeal, prepareVisit, tagScore } from "./tastes.js";
import { dist } from "./world.js";
const counts = new Map();
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
export function tableKey(v) {
    return `${v.x},${v.y}`;
}
export function tableDirty(g, seat) {
    return !!seat.table && (g.dirt.get(tableKey(seat.table)) ?? 0) >= TUNING.tableDirtyAt;
}
function chooseSeat(g, wantsFood, fussiness) {
    const free = g.world.seats.filter((s) => s.occupant === null && s.kind !== "bench" && !(s.table && g.reservations.has(tableKey(s.table))));
    const stools = free.filter((s) => s.kind === "stool");
    // Dirty tables are skipped while a clean one is free; the fussy mind more.
    const chairsAll = free.filter((s) => s.kind === "chair");
    const clean = chairsAll.filter((s) => !tableDirty(g, s));
    const chairs = clean.length ? clean : fussiness > 0.6 ? [] : chairsAll;
    if (!wantsFood && stools.length && chance(0.6))
        return pick(stools);
    if (chairs.length)
        return pick(chairs);
    if (stools.length)
        return pick(stools);
    return undefined;
}
function basePatron(g, seat) {
    const door = g.world.frontDoor;
    const start = { x: door.x + 0.5, y: door.y + 0.5 };
    return {
        id: uid(), pos: { ...start }, path: g.world.path(start, seat.tile, "patron") ?? [],
        state: "entering", seatId: seat.id, arrivedAt: g.minute, orderId: null, waitedSince: 0,
        remindedOnce: false, consumeUntil: 0, nextThinkAt: 0, ordersPlaced: 0, leftEarly: false,
    };
}
function admit(g, p, seat) {
    seat.occupant = p.id;
    g.patrons.push(p);
    g.stats.arrivals++;
    g.bus.emit({ type: "PatronArrived", patronId: p.id });
    g.say(`${p.name} comes in.`);
    return p;
}
export function spawnPatron(g, archetype, forced) {
    const a = archetype ?? weightedPick(ARCHETYPES, (x) => x.weight);
    const fussiness = clamp01(organic(a.fussiness));
    const seat = forced?.seat ?? chooseSeat(g, chance(a.foodBias), fussiness);
    if (!seat)
        return null;
    const n = (counts.get(a.id) ?? 0) + 1;
    counts.set(a.id, n);
    const extra = a.extraLikes.filter((t) => !a.tastes.love.includes(t) && !a.tastes.dislike.includes(t));
    const t = {
        love: [...a.tastes.love],
        like: [...new Set([...a.tastes.like, extra[Math.floor(Math.random() * extra.length)]].filter(Boolean))],
        dislike: [...a.tastes.dislike],
    };
    const p = {
        ...basePatron(g, seat),
        name: `${a.name} ${n}`,
        archetype: a,
        schema: "open",
        color: a.color,
        speed: Math.max(0.8, organic(a.walk)),
        tastes: { food: t, drink: { love: [...t.love], like: [...t.like], dislike: [...t.dislike] } },
        fussiness,
        messiness: clamp01(organic(a.messiness)),
        patience: Math.max(6, organic(a.patience)),
        consumeTime: a.consume,
        foodBias: a.foodBias,
        garnishAsk: a.garnishAsk,
        stayUntil: g.minute + Math.max(20, organic(a.stay)),
        groupId: forced?.groupId,
    };
    return admit(g, p, seat);
}
// ---------------------------------------------------------------------------
// Groups and the waiting bench
function rollGroupSize(g) {
    const maxTable = Math.max(1, ...g.world.tables.map((t) => t.chairs.length));
    const sizes = TUNING.groupSizeWeights.map((w, i) => ({ n: i + 1, w })).filter((x) => x.n <= maxTable);
    return weightedPick(sizes, (x) => x.w)?.n ?? 1;
}
function emptyTableFor(g, size) {
    const fits = g.world.tables.filter((t) => t.chairs.length >= size && !g.reservations.has(t.key) && t.chairs.every((c) => c.occupant === null));
    // Clean tables first, and the smallest table that fits.
    fits.sort((a, b) => ((g.dirt.get(a.key) ?? 0) >= TUNING.tableDirtyAt ? 1 : 0) - ((g.dirt.get(b.key) ?? 0) >= TUNING.tableDirtyAt ? 1 : 0) || a.chairs.length - b.chairs.length);
    return fits[0];
}
function freeBench(g) {
    return g.world.seats.filter((s) => s.kind === "bench" && s.occupant === null);
}
/** Visitors arrive alone or in a group. No table that fits? They wait on the bench, if there's room. */
export function spawnVisitors(g, archetype) {
    const a = archetype ?? weightedPick(ARCHETYPES, (x) => x.weight);
    const size = rollGroupSize(g);
    if (size === 1 && spawnPatron(g, a))
        return true;
    const group = { id: uid(), members: [], waiting: false };
    const table = size > 1 ? emptyTableFor(g, size) : undefined;
    let seats;
    if (table) {
        seats = table.chairs.slice(0, size);
    }
    else {
        const bench = freeBench(g);
        if (bench.length < size)
            return false; // full up: they look in and move on
        seats = bench.slice(0, size);
        group.waiting = true;
    }
    g.groups.push(group);
    for (const seat of seats) {
        const p = spawnPatron(g, a, { seat, groupId: group.id });
        if (p)
            group.members.push(p.id);
    }
    if (size > 1)
        g.say(`A party of ${size} ${a.name.toLowerCase()}s${group.waiting ? " waits by the door for a table" : ""}.`);
    else if (group.waiting)
        g.say("They wait by the door for a seat.");
    return true;
}
/** Each tick: a waiting group reserves the next table that will fit them, and goes over once it's free. */
function processQueue(g) {
    for (const group of g.groups) {
        if (!group.waiting)
            continue;
        const members = group.members.map((id) => g.patron(id)).filter((p) => !!p);
        if (!members.length)
            continue;
        if (!group.tableKey) {
            const candidates = g.world.tables
                .filter((t) => t.chairs.length >= members.length && !g.reservations.has(t.key))
                .sort((a, b) => b.chairs.filter((c) => c.occupant === null).length - a.chairs.filter((c) => c.occupant === null).length);
            const t = candidates[0];
            if (!t)
                continue;
            group.tableKey = t.key;
            g.reservations.set(t.key, group.id);
        }
        if (members.some((p) => p.state !== "queued"))
            continue; // still walking in
        const table = g.world.tables.find((t) => t.key === group.tableKey);
        const free = table.chairs.filter((c) => c.occupant === null);
        if (free.length < members.length)
            continue;
        members.forEach((p, i) => {
            const bench = g.world.seats.find((s) => s.id === p.seatId);
            if (bench)
                bench.occupant = null;
            const chair = free[i];
            chair.occupant = p.id;
            p.seatId = chair.id;
            p.path = g.world.path(p.pos, chair.tile, "patron") ?? [];
            p.state = "entering";
        });
        g.reservations.delete(table.key);
        group.waiting = false;
        group.tableKey = undefined;
        g.say(`${members.length > 1 ? "The party" : members[0].name} goes to their table.`);
    }
    // Forget groups whose members have all gone.
    g.groups = g.groups.filter((gr) => {
        const alive = gr.members.some((id) => g.patron(id));
        if (!alive && gr.tableKey)
            g.reservations.delete(gr.tableKey);
        return alive;
    });
}
export function spawnRegular(g, def, st) {
    const seat = chooseSeat(g, chance(def.foodBias), def.fussiness);
    if (!seat)
        return null;
    const p = {
        ...basePatron(g, seat),
        name: def.name,
        regularId: def.id,
        schema: def.schema,
        color: def.color,
        speed: Math.max(0.8, organic(def.walk)),
        tastes: emptyTastes(),
        fussiness: def.fussiness,
        messiness: def.messiness,
        patience: Math.max(6, organic(def.patience)),
        consumeTime: def.consume,
        foodBias: def.foodBias,
        garnishAsk: def.garnishAsk,
        stayUntil: g.minute + Math.max(20, organic(def.stay)),
    };
    prepareVisit(p, def, st);
    st.visits++;
    st.visitedToday = true;
    admit(g, p, seat);
    return p;
}
/** Each morning: which regulars come today, and roughly when. */
export function scheduleRegulars(g) {
    for (const def of REGULARS) {
        const st = g.regulars.get(def.id);
        if (!st)
            continue;
        st.visitedToday = false;
        const [a, b] = def.habit;
        const hourAt = a + Math.random() * (b - a);
        st.arriveAt = (hourAt - TUNING.dayStartHour) * 60;
    }
}
/** Regulars join over the first days, so there's always someone new to get to know. */
export function unlockRegulars(g) {
    const joined = [];
    for (const def of REGULARS) {
        if (def.joinsOnDay <= g.day && !g.regulars.has(def.id)) {
            g.regulars.set(def.id, {
                id: def.id, familiarity: 0, visits: 0, locks: emptyTastes(), resolved: false, openedUp: false, journal: [],
            });
            joined.push(def.name);
        }
    }
    return joined;
}
function seatOf(g, p) {
    return g.world.seats.find((s) => s.id === p.seatId);
}
function placeOrder(g, p) {
    const seat = seatOf(g, p);
    // A salty snack bowl on the table makes people thirstier.
    const bowl = seat?.table ? g.bowls.get(tableKey(seat.table)) : undefined;
    const thirst = bowl && bowl.left > 0 ? SNACKS.find((x) => x.id === bowl.snack)?.thirsty ?? 0 : 0;
    // Only what's on the bill of fare. If it's run out, that's the keeper's problem.
    const offered = (k) => RECIPES.filter((r) => r.kind === k && g.menu.has(r.id));
    let kind = seat?.kind === "stool" ? "drink" : chance(Math.max(0, p.foodBias - thirst)) ? "food" : "drink";
    if (!offered(kind).length)
        kind = kind === "food" ? "drink" : seat?.kind === "stool" ? "drink" : "food";
    // Someone nearby was delighted by something: they might want the same.
    const insp = p.inspiredBy;
    p.inspiredBy = undefined;
    const inspired = insp ? RECIPES.find((r) => r.id === insp.recipeId && g.menu.has(r.id) && (seat?.kind !== "stool" || r.kind === "drink")) : undefined;
    if (inspired) {
        kind = inspired.kind;
    }
    const menu = offered(kind);
    if (!menu.length) {
        p.line = { text: pick(["Nothing on the board for me tonight.", "Is the kitchen closed?"]), until: g.minute + 6 };
        g.say(`${p.name} finds nothing on the bill of fare, and leaves.`);
        startLeaving(g, p);
        return;
    }
    const t = p.tastes[kind];
    // Mostly what sounds good to them, sometimes a risky order. A craving pulls hard.
    const recipe = inspired ?? weightedPick(menu, (r) => {
        let w = Math.exp(0.7 * appeal(r.baseTags, t)) + 0.25;
        if (p.craving && (r.baseTags.includes(p.craving.tag) || r.options.some((o) => INGREDIENTS.find((i) => i.id === o)?.tags.includes(p.craving.tag))))
            w *= 2;
        return w;
    });
    let wantGarnish;
    if (kind === "drink" && chance(p.garnishAsk)) {
        const gar = weightedPick(GARNISHES, (x) => Math.max(0, tagScore(x.tags, t).score) + 0.2 + (p.craving && x.tags.includes(p.craving.tag) ? 2 : 0));
        wantGarnish = gar?.id;
    }
    const garName = GARNISHES.find((x) => x.id === wantGarnish)?.name.toLowerCase();
    const o = {
        id: uid(), patronId: p.id, recipeId: recipe.id, wantGarnish,
        label: garName ? `${recipe.name} with ${garName}` : recipe.name,
        placedAt: g.minute, open: true,
    };
    g.orders.push(o);
    p.orderId = o.id;
    p.state = "waiting";
    p.waitedSince = g.minute;
    p.remindedOnce = false;
    p.ordersPlaced++;
    g.bus.emit({ type: "OrderPlaced", orderId: o.id });
    g.say(`${p.name} would like ${o.label.toLowerCase()}.`);
    p.hadRecipes = [...(p.hadRecipes ?? []), recipe.id];
    if (inspired && insp) {
        p.inspiredTimes = (p.inspiredTimes ?? 0) + 1;
        const said = `I'll have what ${insp.from} had.`;
        p.line = { text: said, until: g.minute + 6 };
        g.journal(p, `ordered ${recipe.name.toLowerCase()} after seeing ${insp.from} enjoy it.`, "note");
        return;
    }
    // A craving hint, the first time they order tonight (the reserved keep it to themselves).
    if (p.craving && p.ordersPlaced === 1 && p.schema !== "reserved") {
        const hint = pick([`Something ${p.craving.tag} would be nice.`, `I could do with something ${p.craving.tag}.`, `Feel like something ${p.craving.tag} tonight.`]);
        p.line = { text: hint, until: g.minute + 8 };
        g.journal(p, `said: “${hint}”`, "said");
    }
}
/**
 * Someone was delighted. People nearby notice, and some think about having the same.
 * Whether they do depends on how good it sounds to them, and how set in their ways they are.
 */
export function inspireOthers(g, p, item) {
    for (const q of g.patrons) {
        if (q === p || q.state === "entering" || q.state === "leaving" || q.state === "queued")
            continue;
        // Excitement spreads, but fades: each time someone's been swayed it's about half as likely again,
        // another portion of the same thing is a bit less tempting, and three times a visit is plenty.
        const times = q.inspiredTimes ?? 0;
        if (q.inspiredBy || times >= 3)
            continue;
        if (dist(q.pos, p.pos) > TALK_TUNING.inspireRange)
            continue;
        const sounds = tagScore(item.tags, q.tastes[item.kind]).score;
        let pull = 0.2 + 0.12 * sounds - 0.25 * q.fussiness + (q.schema === "unformed" ? 0.15 : 0) - (q.schema === "reserved" ? 0.15 : 0);
        pull *= Math.pow(0.55, times);
        if (q.hadRecipes?.includes(item.recipeId))
            pull *= 0.6;
        if (chance(Math.max(0, Math.min(0.85, pull))))
            q.inspiredBy = { recipeId: item.recipeId, from: p.name };
    }
}
export function startLeaving(g, p, early = false) {
    if (p.state === "leaving")
        return;
    const seat = seatOf(g, p);
    if (seat)
        seat.occupant = null;
    const o = g.order(p.orderId);
    if (o?.open) {
        o.open = false;
        g.stats.leftUnserved++;
    }
    if (early) {
        p.leftEarly = true;
        g.stats.leftEarly++;
        p.marker = { text: "LEAVING", until: g.minute + TUNING.outcomeShowMinutes };
        g.journal(p, "gave up waiting and left.", "note");
    }
    p.state = "leaving";
    p.path = g.world.path(p.pos, g.world.frontDoor, "patron") ?? [];
}
function move(p, simDt) {
    let step = p.speed * simDt * TUNING.realSecondsPerGameMinute;
    while (step > 0 && p.path.length) {
        const t = p.path[0];
        const dx = t.x - p.pos.x, dy = t.y - p.pos.y;
        const d = Math.hypot(dx, dy);
        if (d <= step) {
            p.pos = { ...t };
            p.path.shift();
            step -= d;
        }
        else {
            p.pos.x += (dx / d) * step;
            p.pos.y += (dy / d) * step;
            step = 0;
        }
    }
    return p.path.length === 0;
}
function groupOf(g, p) {
    return p.groupId ? g.groups.find((x) => x.id === p.groupId) : undefined;
}
function othersPresent(g, p) {
    const gr = groupOf(g, p);
    if (!gr)
        return [];
    return gr.members.map((id) => g.patron(id)).filter((q) => !!q && q !== p && q.state !== "leaving");
}
/** A party member who's done waits for the rest; when everyone's done (or it's been ages), they all go. */
function lingerOrLeave(g, p) {
    const others = othersPresent(g, p);
    const allDone = others.every((q) => q.lingering);
    const tooLong = g.minute - (p.lingerSince ?? g.minute) > 90;
    if (!others.length || allDone || tooLong || !g.open) {
        for (const q of [p, ...others.filter((x) => x.lingering)]) {
            q.lingering = false;
            startLeaving(g, q);
        }
        if (others.length)
            g.say(`The party of ${others.length + 1} gets up to leave together.`);
    }
}
// ---------------------------------------------------------------------------
// Talk: people chat at their tables (sometimes giving a taste away), and say hello to the keeper.
function tablemates(g, p) {
    const seat = seatOf(g, p);
    if (!seat?.table)
        return [];
    const t = g.world.tables.find((x) => x.key === tableKey(seat.table));
    return (t?.chairs ?? []).map((c) => g.patron(c.occupant)).filter((q) => !!q && q !== p && q.state !== "leaving" && q.state !== "entering");
}
function tasteLine(p) {
    const kind = chance(0.6) ? "food" : "drink";
    const t = p.tastes[kind];
    const options = [["love", t.love], ["like", t.like], ["dislike", t.dislike]];
    const pool = options.filter(([, tags]) => tags.length);
    if (!pool.length)
        return null;
    const [kindOfLine, tags] = pool[Math.floor(Math.random() * pool.length)];
    const lines = CHATTER[kindOfLine];
    return pick(lines).replace("{tag}", pick(tags));
}
function chatter(g, p) {
    if (p.state === "entering" || p.state === "leaving")
        return;
    if (p.nextChatAt === undefined) {
        p.nextChatAt = g.minute + organic(TALK_TUNING.chatEvery);
        return;
    }
    if (g.minute < p.nextChatAt)
        return;
    p.nextChatAt = g.minute + organic(TALK_TUNING.chatEvery);
    const mates = tablemates(g, p);
    // People alone mostly keep to themselves; the reserved say very little.
    if (!mates.length && chance(0.7))
        return;
    if (p.schema === "reserved" && chance(0.8))
        return;
    const hint = chance(TALK_TUNING.hintChance) ? tasteLine(p) : null;
    const text = hint ?? pick(CHATTER.small);
    p.line = { text, until: g.minute + 6 };
    if (mates.length && chance(0.7)) {
        const m = pick(mates);
        m.nextChatAt = Math.max(m.nextChatAt ?? 0, g.minute + 3);
        setTimeoutGame(g, m, pick(CHATTER.replies), 1.5);
    }
    if (hint && dist(g.keeper.pos, p.pos) <= TALK_TUNING.overhearRange)
        g.journal(p, `overheard: “${hint}”`, "said");
}
/** Say something a little later (in game minutes). */
function setTimeoutGame(g, p, text, afterMinutes) {
    pendingLines.push({ id: p.id, text, at: g.minute + afterMinutes });
}
const pendingLines = [];
function partOfDay(g) {
    const h = g.hour;
    if (h >= 5 && h < 12)
        return "morning";
    if (h >= 12 && h < 17)
        return "afternoon";
    if (h >= 17 && h < 23)
        return "evening";
    return "late";
}
/** Walking up to someone starts a quick hello. Once per visit. */
function greetings(g) {
    for (const p of g.patrons) {
        if (p.greeted || p.state === "entering" || p.state === "leaving")
            continue;
        if (dist(g.keeper.pos, p.pos) > TALK_TUNING.greetRange)
            continue;
        p.greeted = true;
        g.keeperLine = { text: CHATTER.greet[partOfDay(g)], until: g.minute + 4 };
        const st = g.regular(p.regularId);
        const fam = st?.familiarity ?? 0;
        let answer = pick(fam >= 8 ? CHATTER.answer.friend : fam >= 3 ? CHATTER.answer.known : CHATTER.answer.stranger);
        if (p.schema === "reserved" && !st?.openedUp)
            answer = pick(["Mm.", "…Evening.", "Hm."]);
        else if (p.craving && fam >= 3 && chance(0.5))
            answer += ` Fancy something ${p.craving.tag} tonight.`;
        setTimeoutGame(g, p, answer, 1);
        if (st)
            st.familiarity += 1; // a hello counts for something
    }
}
function makeMess(g, p, simDt) {
    // Spills: occasional, while eating or drinking.
    const perMinute = (TUNING.spillChancePerHour * p.messiness) / 60;
    if (chance(perMinute * simDt)) {
        const near = [];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const t = g.world.tile(Math.floor(p.pos.x) + dx, Math.floor(p.pos.y) + dy);
            if (t && t.def.kind === "floor")
                near.push({ x: t.x, y: t.y });
        }
        if (near.length && g.spills.length < 12) {
            const s = pick(near);
            if (!g.spills.some((x) => x.x === s.x && x.y === s.y)) {
                g.spills.push({ id: uid(), x: s.x, y: s.y });
                g.say(`${p.name} spills a little.`);
            }
        }
    }
}
/** People pick at a snack bowl on their table, and may say what they think of it. */
function nibble(g, p, simDt) {
    const seat = seatOf(g, p);
    if (!seat?.table)
        return;
    const bowl = g.bowls.get(tableKey(seat.table));
    if (!bowl || bowl.left <= 0)
        return;
    const snack = SNACKS.find((x) => x.id === bowl.snack);
    const { score, hitLove } = tagScore(snack.tags, p.tastes.food);
    if (score >= 0)
        bowl.left = Math.max(0, bowl.left - (TUNING.bowlEatenPerHour / 60) * simDt * (hitLove ? 1.8 : 1));
    if (!p.snackNoted && (hitLove || score < 0) && chance(TUNING.bowlCommentChance * simDt / 20)) {
        p.snackNoted = true;
        const name = snack.name.toLowerCase();
        if (p.schema === "reserved") {
            g.journal(p, hitLove ? `kept reaching for the ${name}.` : `didn't touch the ${name}.`, "note");
            return;
        }
        const line = hitLove ? pick([`Oh, ${name}. You spoil us.`, `These ${name} are lovely.`]) : pick([`Not one for ${name}, me.`, `Could do without the ${name}.`]);
        p.line = { text: line, until: g.minute + 6 };
        g.journal(p, `about the ${name}: “${line}”`, "said");
    }
    if (bowl.left <= 0)
        g.say(`The ${snack.name.toLowerCase()} bowl is empty.`);
}
function leaveTableMess(g, p) {
    const seat = seatOf(g, p);
    if (!seat?.table)
        return;
    const k = tableKey(seat.table);
    const add = p.messiness * organic([1, 0.5]);
    g.dirt.set(k, (g.dirt.get(k) ?? 0) + add);
}
export function updatePatrons(g, simDt) {
    // Regulars arrive around their usual time, if the inn is open.
    if (g.open && !g.lastCall) {
        for (const def of REGULARS) {
            const st = g.regulars.get(def.id);
            if (!st || st.visitedToday || st.arriveAt === undefined)
                continue;
            const lateBy = g.minute - st.arriveAt;
            if (lateBy >= 0 && lateBy < 120 && !g.patrons.some((p) => p.regularId === def.id))
                spawnRegular(g, def, st);
        }
    }
    // Visitors arrive at the flow rate.
    if (g.open && !g.lastCall && g.minute >= g.nextArrivalAt) {
        const rate = TUNING.flowByHour[g.hour] * g.flowMultiplier; // per hour
        if (rate > 0.01) {
            spawnVisitors(g);
            g.nextArrivalAt = g.minute + Math.max(3, organic([60 / rate, 30 / rate]));
        }
        else {
            g.nextArrivalAt = g.minute + 10;
        }
    }
    processQueue(g);
    greetings(g);
    for (let i = pendingLines.length - 1; i >= 0; i--) {
        const l = pendingLines[i];
        if (g.minute >= l.at) {
            const q = g.patron(l.id);
            if (q && q.state !== "leaving")
                q.line = { text: l.text, until: g.minute + 6 };
            pendingLines.splice(i, 1);
        }
    }
    for (const p of [...g.patrons]) {
        chatter(g, p);
        switch (p.state) {
            case "entering":
                if (move(p, simDt)) {
                    // On the bench they just wait: no orders, no patience running out.
                    if (seatOf(g, p)?.kind === "bench") {
                        p.state = "queued";
                        break;
                    }
                    p.state = "seated";
                    p.nextThinkAt = g.minute + organic([2, 1.5]);
                }
                break;
            case "queued":
                if (!g.open || g.lastCall)
                    startLeaving(g, p);
                break;
            case "seated":
                if (p.lingering) {
                    lingerOrLeave(g, p);
                    break;
                }
                if (g.minute >= p.nextThinkAt) {
                    if (!g.open || g.lastCall)
                        startLeaving(g, p);
                    else
                        placeOrder(g, p);
                }
                break;
            case "waiting": {
                const fussy = p.fussiness >= 0.55;
                if (g.minute - p.waitedSince > p.patience) {
                    const o = g.order(p.orderId);
                    if (!p.remindedOnce) {
                        p.remindedOnce = true;
                        p.waitedSince = g.minute - p.patience * (fussy ? 0.6 : 0);
                        if (p.schema !== "reserved") {
                            p.line = { text: fussy ? "Is anyone coming?" : `Still hoping for that ${o?.label.toLowerCase() ?? "order"}.`, until: g.minute + 6 };
                            g.say(`${p.name}: “${p.line.text}”`);
                        }
                    }
                    else {
                        g.say(`${p.name} gives up waiting and leaves.`);
                        startLeaving(g, p, true);
                    }
                }
                break;
            }
            case "consuming":
                makeMess(g, p, simDt);
                nibble(g, p, simDt);
                if (g.minute >= p.consumeUntil) {
                    p.consuming = undefined;
                    leaveTableMess(g, p);
                    const decay = Math.pow(0.75, p.ordersPlaced - 1);
                    const group = groupOf(g, p);
                    const stay = !group?.leaving && g.open && !g.lastCall && g.minute < p.stayUntil && chance(TUNING.reorderChance * decay);
                    if (stay) {
                        p.state = "seated";
                        p.nextThinkAt = g.minute + organic([4, 3]);
                    }
                    else if (group && othersPresent(g, p).length && (group.leaving || chance(0.8))) {
                        // Parties mostly leave together: wait for the others to finish.
                        group.leaving = true;
                        p.state = "seated";
                        p.lingering = true;
                        p.lingerSince = g.minute;
                    }
                    else {
                        if (group && othersPresent(g, p).length)
                            g.say(`${p.name} heads off ahead of the others.`);
                        startLeaving(g, p);
                    }
                }
                break;
            case "leaving":
                if (move(p, simDt)) {
                    g.patrons.splice(g.patrons.indexOf(p), 1);
                    g.bus.emit({ type: "PatronLeft", patronId: p.id, early: p.leftEarly });
                }
                break;
        }
    }
    g.orders = g.orders.filter((o) => o.open);
}
/** Closing time: no new orders. Those already waiting still get served. */
export function callLastOrders(g) {
    for (const p of g.patrons)
        if (p.state === "seated" || p.state === "queued")
            startLeaving(g, p);
}
export function clearPatrons(g) {
    for (const p of g.patrons) {
        const o = g.order(p.orderId);
        if (o?.open)
            g.stats.leftUnserved++;
    }
    g.patrons = [];
    g.orders = [];
    g.groups = [];
    g.reservations.clear();
    for (const s of g.world.seats)
        s.occupant = null;
}
