// Patrons: arrivals, walking, ordering, waiting, eating, mess and leaving.
import { chance, organic, pick, uid, weightedPick } from "./core.js";
import { ARCHETYPES, CHATTER, NAMES, GARNISHES, INGREDIENTS, RECIPES, REGULARS, SNACKS, TALK_TUNING, TUNING, WEATHER_NAMES, NEEDS, SOAKING, SHELTER, SEASONAL_TASTES, MARKET, SPECIFIC_ORDERS } from "./data.js";
import { emptyTastes } from "./game.js";
import { appeal, prepareVisit, tagScore } from "./tastes.js";
import { arrivalNeeds, closeAllStretches } from "./needs.js";
import { cameIn, weatherTags } from "./weather.js";
import { marketDay } from "./newspaper.js";
import { halveTips, payTips, priceLevel } from "./money.js";
import { dist } from "./world.js";
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
export function tableKey(v) {
    return `${v.x},${v.y}`;
}
export function tableDirty(g, seat) {
    return !!seat.table && (g.dirt.get(tableKey(seat.table)) ?? 0) >= TUNING.tableDirtyAt;
}
/**
 * How much they want something of this kind: 0 when full (below NEEDS.fullAt), 1 past NEEDS.wantAt.
 * foodBias leans it a little toward food or drink.
 */
export function wants(needs, foodBias, kind) {
    const n = kind === "food" ? needs.hunger : needs.thirst;
    const w = Math.max(0, Math.min(1, (n - NEEDS.fullAt) / (NEEDS.wantAt - NEEDS.fullAt)));
    return w * (kind === "food" ? 0.5 + foodBias : 1.5 - foodBias);
}
/** Would they sooner eat than drink, going by how they feel? (Chooses a chair or a stool.) */
function hungrier(needs, foodBias) {
    const f = wants(needs, foodBias, "food") + 0.05, d = wants(needs, foodBias, "drink") + 0.05;
    return chance(f / (f + d));
}
/**
 * How many more come in because of the weather: rain pulls passers-by indoors (by the location's
 * shelter), a storm thins the street. 1 on a dry day.
 */
export function shelterFactor(g) {
    const w = g.weather;
    if (w.sky !== "rain")
        return 1;
    const pull = 1 + g.loc.shelter * Math.min(1, w.rain / SHELTER.fullAt);
    const out = w.band === "storm" ? 1 - SHELTER.stormThins : 1;
    return pull * out;
}
/** Why someone's coming in: the extra rush from the rain is shelter; otherwise what they need most. */
function reasonFor(g, needs) {
    const f = shelterFactor(g);
    if (f > 1 && chance((f - 1) / f))
        return "shelter";
    if (Math.max(needs.hunger, needs.thirst) < NEEDS.wantAt)
        return "company";
    return needs.hunger >= needs.thirst ? "food" : "drink";
}
/** Who's passing: archetypes by their weight, times how common they are where the inn stands. */
function passerBy(g) {
    return weightedPick(ARCHETYPES, (x) => x.weight * (g.loc.visitors[x.id] ?? 1));
}
/** How wet someone coming in now gets: the rain's intensity, give or take. */
function soakedNow(g) {
    return g.weather.sky === "rain" ? clamp01(g.weather.rain * organic(SOAKING.fromRain)) : 0;
}
/** Pick a seat: anyone, or for the soaked, one by a lit fire if they can. */
function pickSeat(g, seats, soaked) {
    const fire = g.world.furniture.find((f) => f.kind === "fireplace")?.center;
    if (!fire || !g.fireLit || soaked < 0.15)
        return pick(seats);
    return weightedPick(seats, (s) => 1 + SOAKING.fireSeatPull * soaked * Math.max(0, 1 - dist(s.tile, fire) / SOAKING.fireSeatRange)) ?? pick(seats);
}
function chooseSeat(g, wantsFood, fussiness, soaked = 0) {
    const free = g.world.seats.filter((s) => s.occupant === null && s.kind !== "bench" && !(s.table && g.reservations.has(tableKey(s.table))));
    const stools = free.filter((s) => s.kind === "stool");
    // Dirty tables are skipped while a clean one is free; the fussy mind more.
    const chairsAll = free.filter((s) => s.kind === "chair");
    const clean = chairsAll.filter((s) => !tableDirty(g, s));
    const chairs = clean.length ? clean : fussiness > 0.6 ? [] : chairsAll;
    if (!wantsFood && stools.length && chance(0.6))
        return pickSeat(g, stools, soaked);
    if (chairs.length)
        return pickSeat(g, chairs, soaked);
    if (stools.length)
        return pickSeat(g, stools, soaked);
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
    p.cameIn = cameIn(g);
    seat.occupant = p.id;
    g.patrons.push(p);
    g.stats.arrivals++;
    g.bus.emit({ type: "PatronArrived", patronId: p.id });
    g.say(`${p.name} comes in.`);
    return p;
}
/** A name for a passing visitor: not one that's in the room already, nor a regular's. */
function visitorName(g) {
    const taken = new Set([...g.patrons.map((q) => q.trueName), ...REGULARS.map((r) => r.name)]);
    const free = NAMES.visitors.filter((n) => !taken.has(n));
    return pick(free.length ? free : NAMES.visitors);
}
/**
 * Maybe they tell you their name (after a hello or a serve). Regulars do once you know them well
 * enough for how open they are; a passing visitor might, by how open their kind is.
 */
export function maybeIntroduce(g, p) {
    if (!p.trueName || p.name === p.trueName || p.state === "leaving")
        return;
    const def = g.regularDef(p.regularId);
    const st = g.regular(p.regularId);
    if (def && st) {
        if (st.familiarity < (NAMES.learnAt[def.schema] ?? 0))
            return;
        st.nameKnown = true;
    }
    else if (!chance(p.archetype?.openness ?? 0.4))
        return;
    const role = p.name;
    p.name = p.trueName;
    const lines = p.schema === "reserved" ? NAMES.reservedLines : NAMES.lines;
    setTimeoutGame(g, p, pick(lines).replace("{name}", p.name), 1.5);
    if (def) {
        const m = `${role}: their name is ${p.name}.`;
        g.journal(p, m, "moment");
        g.stats.moments.push(m);
        g.say(`✦ ${m}`);
    }
    else
        g.say(`You learn the ${role.toLowerCase()}'s name: ${p.name}.`);
}
export function spawnPatron(g, archetype, forced) {
    const a = archetype ?? passerBy(g);
    const fussiness = clamp01(organic(a.fussiness));
    const needs = arrivalNeeds(a.needs);
    const soaked = soakedNow(g);
    needs.warmth = clamp01(needs.warmth + soaked * SOAKING.warmthOnArrival);
    const seat = forced?.seat ?? chooseSeat(g, hungrier(needs, a.foodBias), fussiness, soaked);
    if (!seat)
        return null;
    const extra = a.extraLikes.filter((t) => !a.tastes.love.includes(t) && !a.tastes.dislike.includes(t));
    const t = {
        love: [...a.tastes.love],
        like: [...new Set([...a.tastes.like, extra[Math.floor(Math.random() * extra.length)]].filter(Boolean))],
        dislike: [...a.tastes.dislike],
    };
    const p = {
        ...basePatron(g, seat),
        name: a.name,
        trueName: visitorName(g),
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
        needs,
        soaked,
        reason: reasonFor(g, needs),
        weatherTaste: a.weather,
        unmet: {},
        groupId: forced?.groupId,
    };
    if (soaked > SOAKING.warmCraving)
        p.craving = { tag: "warm", honest: true };
    else if (chance(SEASONAL_TASTES.visitorCraving))
        p.craving = { tag: pick(SEASONAL_TASTES.inSeason[g.date.season]), honest: true };
    return admit(g, p, seat);
}
// ---------------------------------------------------------------------------
// Groups and the waiting bench
function rollGroupSize(g) {
    const maxTable = Math.max(1, ...g.world.tables.map((t) => t.chairs.length));
    const sizes = TUNING.groupSizeWeights.map((w, i) => ({ n: i + 1, w })).filter((x) => x.n <= maxTable);
    return weightedPick(sizes, (x) => x.w)?.n ?? 1;
}
function emptyTableFor(g, size, soaked = 0) {
    const fits = g.world.tables.filter((t) => t.chairs.length >= size && !g.reservations.has(t.key) && t.chairs.every((c) => c.occupant === null));
    // Clean tables first; then a party in from the rain heads for the fire, if it's lit; else the
    // smallest table that fits.
    const fire = g.world.furniture.find((f) => f.kind === "fireplace")?.center;
    const toFire = (t) => (fire && g.fireLit && soaked >= 0.15 ? dist(t.tile, fire) : 0);
    const dirty = (t) => ((g.dirt.get(t.key) ?? 0) >= TUNING.tableDirtyAt ? 1 : 0);
    fits.sort((a, b) => dirty(a) - dirty(b) || toFire(a) - toFire(b) || a.chairs.length - b.chairs.length);
    return fits[0];
}
function freeBench(g) {
    return g.world.seats.filter((s) => s.kind === "bench" && s.occupant === null);
}
/** Visitors arrive alone or in a group. No table that fits? They wait on the bench, if there's room. */
export function spawnVisitors(g, archetype) {
    const a = archetype ?? passerBy(g);
    const size = rollGroupSize(g);
    if (size === 1 && spawnPatron(g, a))
        return true;
    const group = { id: uid(), members: [], waiting: false };
    const table = size > 1 ? emptyTableFor(g, size, soakedNow(g)) : undefined;
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
    const needs = arrivalNeeds(def.needs);
    const soaked = soakedNow(g);
    needs.warmth = clamp01(needs.warmth + soaked * SOAKING.warmthOnArrival);
    const seat = chooseSeat(g, hungrier(needs, def.foodBias), def.fussiness, soaked);
    if (!seat)
        return null;
    const p = {
        ...basePatron(g, seat),
        name: st.nameKnown || !def.role ? def.name : def.role,
        trueName: def.name,
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
        needs,
        soaked,
        reason: reasonFor(g, needs),
        weatherTaste: def.weather,
        unmet: {},
    };
    prepareVisit(p, def, st, g.date.season);
    if (soaked > SOAKING.warmCraving && !p.craving)
        p.craving = { tag: "warm", honest: true };
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
            joined.push(def.role ? `${/^[aeiou]/i.test(def.role) ? "an" : "a"} ${def.role.toLowerCase()}` : def.name);
        }
    }
    return joined;
}
function seatOf(g, p) {
    return g.world.seats.find((s) => s.id === p.seatId);
}
function placeOrder(g, p) {
    const seat = seatOf(g, p);
    // Only what's on the bill of fare. If it's run out, that's the keeper's problem.
    const offered = (k) => RECIPES.filter((r) => r.kind === k && g.billNow().has(r.id));
    // Food or drink, by how hungry and thirsty they are (salty snacks already showed up as thirst).
    // Stools are for drinks. On sitting down everyone has something, even if they're hardly in need.
    const stool = seat?.kind === "stool";
    const grace = p.graceDrink === true;
    p.graceDrink = false;
    const wf = stool || grace ? 0 : wants(p.needs, p.foodBias, "food");
    const wd = grace ? 1 : wants(p.needs, p.foodBias, "drink");
    let kind = wf + wd <= 0 ? (stool || p.needs.thirst >= p.needs.hunger ? "drink" : "food") : chance(wf / (wf + wd)) ? "food" : "drink";
    if (!offered(kind).length)
        kind = kind === "food" ? "drink" : stool ? "drink" : "food";
    // Someone nearby was delighted by something: they might want the same, unless they're full of it.
    const insp = p.inspiredBy;
    p.inspiredBy = undefined;
    const inspired = insp ? RECIPES.find((r) => r.id === insp.recipeId && g.billNow().has(r.id) && (!stool || r.kind === "drink")
        && (wants(p.needs, p.foodBias, r.kind) > 0 || (grace && r.kind === "drink"))) : undefined;
    if (inspired) {
        kind = inspired.kind;
    }
    const menu = offered(kind);
    if (!menu.length) {
        g.speak(p, g.pickLine(["Nothing on the board for me {now}.", "Is the kitchen closed?"]));
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
        // Cold (or wet through): something warm appeals more.
        if (r.baseTags.includes("warm"))
            w *= 1 + SOAKING.warmOrderPull * p.needs.warmth;
        // What's in season sounds good.
        w *= 1 + SEASONAL_TASTES.orderPull * r.baseTags.filter((tag) => SEASONAL_TASTES.inSeason[g.date.season].includes(tag)).length;
        return w;
    });
    let wantGarnish;
    if (kind === "drink" && chance(p.garnishAsk)) {
        const gar = weightedPick(GARNISHES, (x) => Math.max(0, tagScore(x.tags, t).score) + 0.2 + (p.craving && x.tags.includes(p.craving.tag) ? 2 : 0));
        wantGarnish = gar?.id;
    }
    const wantOption = namedOption(g, p, recipe);
    const opt = INGREDIENTS.find((x) => x.id === wantOption);
    const garName = GARNISHES.find((x) => x.id === wantGarnish)?.name.toLowerCase();
    const named = opt ? (recipe.id === "tea" ? `${opt.name} tea` : `${recipe.name}, ${opt.name.toLowerCase()}`) : recipe.name;
    const o = {
        id: uid(), patronId: p.id, recipeId: recipe.id, wantGarnish, wantOption,
        label: garName ? `${named} with ${garName}` : named,
        placedAt: g.minute, open: true, no: g.stats.orders = (g.stats.orders ?? 0) + 1,
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
    if (grace) {
        p.lastGraceAt = g.minute;
        g.speak(p, pick(["Go on then, one more.", "Just the one more.", "Well, since I'm here…"]));
    }
    if (inspired && insp) {
        p.inspiredTimes = (p.inspiredTimes ?? 0) + 1;
        const said = `I'll have what ${insp.from} had.`;
        g.speak(p, said);
        g.journal(p, `ordered ${recipe.name.toLowerCase()} after seeing ${insp.from} enjoy it.`, "note");
        return;
    }
    // A craving hint, the first time they order this visit (the reserved keep it to themselves).
    if (p.craving && p.ordersPlaced === 1 && p.schema !== "reserved") {
        const hint = g.pickLine([`Something ${p.craving.tag} would be nice.`, `I could do with something ${p.craving.tag}.`, `Feel like something ${p.craving.tag} {now}.`]);
        g.speak(p, hint, 1.3);
        g.journal(p, `said: “${hint}”`, "said");
    }
}
/**
 * Do they ask for a particular leaf or bean? Regulars who are open about their tastes often do, fussy
 * strangers sometimes. They name the one they truly like best (if they like any of them at all).
 */
function namedOption(g, p, recipe) {
    if (recipe.kind !== "drink" || recipe.slots !== 1 || !recipe.options.length)
        return undefined;
    const st = g.regular(p.regularId);
    const knowsOwnMind = st ? (p.schema === "open" || st.openedUp || st.resolved) : false;
    const asks = chance(knowsOwnMind ? SPECIFIC_ORDERS.regular : p.fussiness >= SPECIFIC_ORDERS.fussyAt ? SPECIFIC_ORDERS.fussy : SPECIFIC_ORDERS.anyone);
    if (!asks)
        return undefined;
    const best = recipe.options
        .map((id) => ({ id, s: tagScore(INGREDIENTS.find((x) => x.id === id)?.tags ?? [], p.tastes[recipe.kind]).score }))
        .sort((a, b) => b.s - a.s)[0];
    return best && best.s > 0 ? best.id : undefined;
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
        if (wants(q.needs, q.foodBias, item.kind) <= 0)
            continue; // full of that sort of thing
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
const isFussy = (p) => p.fussiness >= 0.55;
/** After the reminder, the share of their patience a guest still gives you: fussy ones less. */
const secondWait = (p) => (isFussy(p) ? 0.4 : 1);
/**
 * How close a waiting guest is to giving up, 0 (just ordered) to 1 (walking out), honestly: it follows
 * the same clock as the walkout (patience, one reminder, then a shorter or equal second wait).
 * null when they aren't waiting on an order.
 */
export function walkoutProgress(g, p) {
    if (p.state !== "waiting")
        return null;
    const total = p.patience * (1 + secondWait(p));
    const leftNow = p.waitedSince + p.patience - g.minute;
    const left = p.remindedOnce ? leftNow : leftNow + p.patience * secondWait(p);
    return Math.max(0, Math.min(1, 1 - left / total));
}
export function startLeaving(g, p, early = false) {
    if (p.state === "leaving")
        return;
    closeAllStretches(g, p, "left");
    const seat = seatOf(g, p);
    if (seat)
        seat.occupant = null;
    const o = g.order(p.orderId);
    if (o?.open) {
        o.open = false;
        g.stats.leftUnserved++;
    }
    // Tips are paid on the way out; walking out on an order, half of it.
    if (early)
        halveTips(p);
    payTips(g, p);
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
/**
 * Done with what's in front of them: do they want anything else? Hunger and thirst decide. Full up,
 * now and then one more drink anyway (the soft edge of full), but not too often.
 */
function wantsMore(g, p) {
    const seat = seatOf(g, p);
    const f = seat?.kind === "stool" ? 0 : wants(p.needs, p.foodBias, "food");
    const d = wants(p.needs, p.foodBias, "drink");
    const strongest = Math.min(1, Math.max(f, d));
    if (strongest > 0)
        return chance(strongest);
    const graceReady = g.minute - (p.lastGraceAt ?? -Infinity) >= NEEDS.graceEvery;
    if (graceReady && chance(NEEDS.graceChance)) {
        p.graceDrink = true;
        return true;
    }
    return false;
}
/**
 * Waiting for the rain to stop. When it does, they go (inn#23 will make that a choice). Meanwhile they
 * look out now and then, may order again as they get thirsty, and won't wait forever.
 */
function waitOutRain(g, p) {
    const done = () => { p.waitingOut = undefined; };
    if (!g.open || g.lastCall) {
        done();
        startLeaving(g, p);
        return;
    }
    if (g.weather.sky !== "rain") {
        done();
        startLeaving(g, p);
        return;
    } // (the decision came when it stopped)
    if (g.minute < p.nextThinkAt)
        return;
    p.nextThinkAt = g.minute + organic(SHELTER.checkEvery);
    if (g.minute - p.stayUntil > organic(SHELTER.waitOut)) {
        done();
        if (p.schema !== "reserved")
            g.speak(p, pick(SHELTER.braveLines));
        startLeaving(g, p);
        return;
    }
    if (wantsMore(g, p)) {
        done();
        placeOrder(g, p);
    }
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
    const weather = !hint && chance(CHATTER.weatherChance) ? weatherLine(g, p) : null;
    const text = hint ?? weather?.text ?? g.pickLine(CHATTER.small);
    if (weather?.taste && dist(g.keeper.pos, p.pos) <= TALK_TUNING.overhearRange)
        g.journal(p, `overheard: “${weather.text}”`, "said");
    g.speak(p, text);
    if (mates.length && chance(0.7)) {
        const m = pick(mates);
        m.nextChatAt = Math.max(m.nextChatAt ?? 0, g.minute + 3);
        setTimeoutGame(g, m, pick(CHATTER.replies), 1.5);
    }
    if (hint && dist(g.keeper.pos, p.pos) <= TALK_TUNING.overhearRange)
        g.journal(p, `overheard: “${hint}”`, "said");
}
/**
 * Something about the weather right now. A weather they love or dislike comes first, and gives that
 * taste away (the journal notes it when overheard).
 */
function weatherLine(g, p) {
    const tags = weatherTags(g);
    const loved = tags.filter((t) => p.weatherTaste.love.includes(t) && WEATHER_NAMES[t]);
    const hated = tags.filter((t) => p.weatherTaste.dislike.includes(t) && WEATHER_NAMES[t]);
    if ((loved.length || hated.length) && chance(0.5)) {
        const love = loved.length && (!hated.length || chance(0.5));
        const tag = pick(love ? loved : hated);
        const name = WEATHER_NAMES[tag][love ? "love" : "dislike"];
        const text = pick(love ? CHATTER.weatherLove : CHATTER.weatherDislike).replace("{w}", name).replace("{W}", name[0].toUpperCase() + name.slice(1));
        return { text, taste: true };
    }
    const about = tags.filter((t) => CHATTER.weather[t]);
    if (!about.length)
        return null;
    const text = g.pickLine(CHATTER.weather[pick(about)]);
    return text ? { text, taste: false } : null;
}
/** How likely someone is to go now the rain has stopped: why they came, against what they still need. */
function leaveChance(g, p) {
    let c = SHELTER.leaveFor[p.reason] ?? 0.3;
    if (p.waitingOut !== undefined)
        c += SHELTER.idleLeave;
    if (g.minute > p.stayUntil)
        c += SHELTER.overstayLeave;
    const seat = seatOf(g, p);
    const still = Math.max(seat?.kind === "stool" ? 0 : wants(p.needs, p.foodBias, "food"), wants(p.needs, p.foodBias, "drink"));
    c -= SHELTER.stillWants * Math.min(1, still);
    return clamp01(c);
}
/** Going: right away if there's nothing in front of them or coming; else once they've finished it. */
function goWhenDone(g, p) {
    p.waitingOut = undefined;
    if (p.state === "seated" && !p.orderId)
        startLeaving(g, p);
    else
        p.leaveAfter = true;
}
/**
 * The rain has stopped: everyone inside decides whether to go. A party decides as one (and leaves
 * together, through the usual lingering); one of them says why, so it reads as a choice, not dice.
 */
function rainStopped(g) {
    const here = g.patrons.filter((p) => p.state === "seated" || p.state === "waiting" || p.state === "consuming");
    const decided = new Set();
    for (const p of here) {
        if (decided.has(p.id))
            continue;
        const group = groupOf(g, p);
        const party = group ? here.filter((q) => q.groupId === group.id) : [p];
        party.forEach((q) => decided.add(q.id));
        const chanceToGo = party.reduce((a, q) => a + leaveChance(g, q), 0) / party.length;
        const go = chance(chanceToGo);
        const speaker = party.find((q) => q.schema !== "reserved");
        if (speaker && chance(0.6))
            setTimeoutGame(g, speaker, pick(go ? SHELTER.goLines : SHELTER.stayLines), 0.5 + Math.random() * 3);
        if (!go) {
            party.forEach((q) => { q.waitingOut = undefined; });
            continue;
        }
        if (group && party.length > 1) {
            group.leaving = true;
            for (const q of party) {
                q.waitingOut = undefined;
                if (q.state === "seated" && !q.orderId) {
                    q.lingering = true;
                    q.lingerSince = g.minute;
                }
                else
                    q.leaveAfter = true;
            }
        }
        else
            goWhenDone(g, p);
    }
}
/** A guest or two remark when the weather turns. */
export function initTalk(g) {
    g.bus.on((e) => {
        if (e.type === "WeatherChanged" && e.from === "rain")
            rainStopped(g);
        let lines;
        if (e.type === "WeatherChanged") {
            if (e.to === "rain")
                lines = CHATTER.weatherTurns.rainStarts;
            else if (e.from === "rain")
                lines = CHATTER.weatherTurns.rainStops;
            else if (e.to === "clear")
                lines = CHATTER.weatherTurns.clears;
        }
        else if (e.type === "RainBandChanged" && e.to === "storm")
            lines = CHATTER.weatherTurns.stormBreaks;
        if (!lines)
            return;
        const seated = g.patrons.filter((p) => (p.state === "seated" || p.state === "waiting" || p.state === "consuming") && p.schema !== "reserved");
        const who = seated.sort(() => Math.random() - 0.5).slice(0, chance(0.5) ? 2 : 1);
        who.forEach((p, i) => setTimeoutGame(g, p, pick(lines), 0.5 + i * 1.5));
    });
}
/** Say something a little later (in game minutes). */
function setTimeoutGame(g, p, text, afterMinutes) {
    pendingLines.push({ id: p.id, text, at: g.minute + afterMinutes });
}
const pendingLines = [];
/** Walking up to someone starts a quick hello. Once per visit. */
function greetings(g) {
    for (const p of g.patrons) {
        if (p.greeted || p.state === "entering" || p.state === "leaving")
            continue;
        if (dist(g.keeper.pos, p.pos) > TALK_TUNING.greetRange)
            continue;
        p.greeted = true;
        g.keeperLine = { text: CHATTER.greet[g.timeOfDay], until: g.minute + g.readTime(CHATTER.greet[g.timeOfDay]).full };
        const st = g.regular(p.regularId);
        const fam = st?.familiarity ?? 0;
        let answer = g.pickLine(fam >= 8 ? CHATTER.answer.friend : fam >= 3 ? CHATTER.answer.known : CHATTER.answer.stranger);
        if (p.schema === "reserved" && !st?.openedUp)
            answer = g.pickLine(CHATTER.answer.reserved);
        else if (p.craving && fam >= 3 && chance(0.5))
            answer += g.words(` Fancy something ${p.craving.tag} {now}.`);
        setTimeoutGame(g, p, answer, 1);
        if (st)
            st.familiarity += 1; // a hello counts for something
        maybeIntroduce(g, p);
    }
}
/** A puddle on the floor next to them. False if there's nowhere to put it. */
function spillNear(g, p) {
    const near = [];
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const t = g.world.tile(Math.floor(p.pos.x) + dx, Math.floor(p.pos.y) + dy);
        if (t && t.def.kind === "floor")
            near.push({ x: t.x, y: t.y });
    }
    if (!near.length || g.spills.length >= 12)
        return false;
    const s = pick(near);
    if (g.spills.some((x) => x.x === s.x && x.y === s.y))
        return false;
    g.spills.push({ id: uid(), x: s.x, y: s.y });
    return true;
}
/** Wet guests drip as they come in and while they dry. */
function drip(g, p, simDt) {
    if (p.soaked <= 0.05 || p.state === "leaving")
        return;
    if (chance((SOAKING.dripPerHour * p.soaked / 60) * simDt))
        spillNear(g, p);
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
    const key = g.bowlKeyFor(seatOf(g, p));
    if (!key)
        return;
    const bowl = g.bowls.get(key);
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
        g.speak(p, line);
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
        const market = marketDay(g) && g.hour >= MARKET.from && g.hour < MARKET.to ? MARKET.flow : 1;
        const rate = TUNING.flowByHour[g.hour] * g.loc.traffic * shelterFactor(g) * market * g.flowMultiplier * priceLevel(g).flow; // per hour
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
    g.flushLines();
    for (let i = pendingLines.length - 1; i >= 0; i--) {
        const l = pendingLines[i];
        if (g.minute >= l.at) {
            const q = g.patron(l.id);
            if (q && q.state !== "leaving")
                g.speak(q, l.text);
            pendingLines.splice(i, 1);
        }
    }
    for (const p of [...g.patrons]) {
        chatter(g, p);
        drip(g, p, simDt);
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
                    // In from the rain: they might say so.
                    const from = p.cameIn?.band ? CHATTER.cameIn[p.cameIn.band] : undefined;
                    if (from && p.schema !== "reserved" && chance(0.5))
                        g.speak(p, pick(from));
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
                if (p.waitingOut !== undefined) {
                    waitOutRain(g, p);
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
                const fussy = isFussy(p);
                if (g.minute - p.waitedSince > p.patience) {
                    const o = g.order(p.orderId);
                    if (!p.remindedOnce) {
                        p.remindedOnce = true;
                        p.waitedSince = g.minute - p.patience * (1 - secondWait(p));
                        if (p.schema !== "reserved") {
                            const nudge = fussy ? "Is anyone coming?" : `Still hoping for that ${o?.label.toLowerCase() ?? "order"}.`;
                            g.speak(p, nudge, 1, true);
                            g.say(`${p.name}: “${nudge}”`);
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
                    const group = groupOf(g, p);
                    const raining = g.weather.sky === "rain";
                    const canStay = !group?.leaving && g.open && !g.lastCall;
                    const stay = canStay && !p.leaveAfter && (g.minute < p.stayUntil || raining) && wantsMore(g, p);
                    if (stay) {
                        p.state = "seated";
                        p.nextThinkAt = g.minute + organic([4, 3]);
                    }
                    else if (canStay && raining && !p.leaveAfter) {
                        // Done, but it's raining: they sit it out.
                        p.state = "seated";
                        p.waitingOut = g.minute;
                        p.nextThinkAt = g.minute + organic(SHELTER.checkEvery);
                        if (p.schema !== "reserved" && chance(0.5))
                            g.speak(p, pick(SHELTER.waitLines));
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
        if (p.state !== "leaving")
            payTips(g, p, false); // closing time: everyone still in settles up
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
