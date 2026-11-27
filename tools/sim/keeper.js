(async () => {
  const g = window.game;
  const M = (n) => import(`inn:${n}.js`);
  const [data, stock, sup, serving, crafting, patrons, day, upkeep, needs, weather, light, roads, warmth] = await Promise.all(
    ["data", "stock", "supplies", "serving", "crafting", "patrons", "day", "upkeep", "needs", "weather", "ui/light", "roads", "warmth"].map(M));
  const { RECIPES, INGREDIENTS, TUNING } = data;
  const R = (id) => RECIPES.find((r) => r.id === id);
  const worth = (id) => INGREDIENTS.find((i) => i.id === id)?.worth ?? 0;
  const OPT = window.SIM_OPTS ?? {};
  const learner = OPT.keeper === "learner";
  g.modal = null;
  document.querySelectorAll(".menu-wrap,.modal,.menu").forEach((e) => e.remove?.());
  g.paused = true;
  g.priceLevel = OPT.level ?? "fair";
  const MENU = (OPT.menu ?? ["stew", "porridge", "tea", "ale"]).filter((id) => g.canMake(id));
  g.menu = new Set(MENU); g.menuChosen = true; g.mealMode = false;

  if (OPT.heater && !g.layout.some((p) => p.uid === "simHeater")) {
    const tb = g.world.tables[0].tile;
    const near = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) near.push({ x: tb.x + dx, y: tb.y + dy });
    near.sort((a, b) => Math.hypot(a.x - tb.x, a.y - tb.y) - Math.hypot(b.x - tb.x, b.y - tb.y));
    const spot = near.find((t) => g.world.canPlace(OPT.heater, t.x, t.y, null, g.layout, g.keeper.pos));
    if (spot) { g.layout.push({ uid: "simHeater", type: OPT.heater, x: spot.x, y: spot.y }); g.rebuildWorld(); }
  }
  const slots = g.world.furniture.flatMap((f) => f.slots ?? []);
  const hobs = slots.filter((s) => s.kinds.includes("stove"));
  const kettle = slots.find((s) => s.kinds.includes("kettle"));
  const walk = OPT.walk ?? 1;
  let busy = 0, busyTotal = 0, openMin = 0;
  const use = (m) => { busy = g.minute + m; busyTotal += m; };
  const lastWanted = {};

  const memory = {};
  const kindOf = (p) => p.regularId ?? p.archetype?.id ?? "?";
  const SCORE = { DELIGHT: 1, PLEASED: 0.3, FULFILLED: 0, UNFINISHED: -0.5, COMPLAINS: -1 };
  function remember(p, item, outcome) {
    for (const key of [kindOf(p), "*"]) {
      const m = (memory[key] ??= {})[item.recipeId] ??= {};
      for (const id of item.options ?? []) m[id] = (m[id] ?? 0) + SCORE[outcome];
    }
  }
  function bestFor(key, recipeId, opts, n) {
    const m = memory[key]?.[recipeId] ?? {};
    const have = opts.filter((o) => stock.have(g, o.id) >= o.units);
    const known = have.filter((o) => m[o.id] !== undefined).sort((a, b) => m[b.id] - m[a.id]);
    const rest = have.filter((o) => m[o.id] === undefined).sort(() => Math.random() - 0.5);
    const ranked = [...known.filter((o) => m[o.id] > 0), ...rest, ...known.filter((o) => m[o.id] <= 0)];
    return ranked.slice(0, n).map((o) => o.id);
  }
  const pickRandom = (opts, n) => opts.filter((o) => stock.have(g, o.id) >= o.units).sort(() => Math.random() - 0.5).slice(0, n).map((o) => o.id);
  const pick = (key, r, opts, n) => (learner ? bestFor(key, r.id, opts, n) : pickRandom(opts, n));

  function startPot(slot, r) {
    const base = pick("*", r, r.base.options, Math.max(r.base.pick[0], Math.min(1, r.base.pick[1])));
    const extras = r.optional.pick[1] ? pick("*", r, r.optional.options, Math.min(OPT.extras ?? 1, r.optional.pick[1])) : [];
    return crafting.startJob(g, slot, r, [...base, ...extras], null);
  }
  const potOf = (id) => [...g.pots.entries()].find(([, p]) => p.item.recipeId === id && p.left > 0);
  const cooking = (id) => [...g.jobs.values()].some((j) => j.recipeId === id && !j.done);
  const freeHob = () => hobs.find((s) => !g.jobs.has(s.id) && !g.pots.has(s.id));
  const covered = (o) => serving.trayItems(g).some((i) => i.recipeId === o.recipeId && (!i.ticket || i.ticket === o.patronId));

  function produce(o) {
    const r = R(o.recipeId);
    if (r.boughtAs) { if (stock.have(g, r.boughtAs) < 1) return "out"; serving.pour(g, r.id); return 0.8; }
    if (r.id === "tea") {
      const w = g.pots.get(kettle.id);
      if (w && w.item.recipeId === "water") {
        const p = g.patron(o.patronId);
        const leaf = o.wantOption && stock.have(g, o.wantOption) >= 1 ? o.wantOption : (p && pick(kindOf(p), r, r.base.options, 1)[0]);
        if (!leaf) return "out";
        crafting.steepTea(g, kettle.id, leaf); return 0.6;
      }
      if (!g.jobs.has(kettle.id)) return crafting.startJob(g, kettle, R("water"), [], null) ? 0.5 : "out";
      return null;
    }
    const pot = potOf(r.id);
    if (pot) { crafting.serveFromPot(g, pot[0]); return 0.3; }
    if (cooking(r.id)) return null;
    let hob = freeHob();
    if (!hob) {
      const idle = hobs.filter((s) => g.pots.has(s.id)).sort((a, b) => (lastWanted[g.pots.get(a.id).item.recipeId] ?? -1e9) - (lastWanted[g.pots.get(b.id).item.recipeId] ?? -1e9))[0];
      const pid = idle && g.pots.get(idle.id).item.recipeId;
      if (idle && !g.orders.some((x) => x.open && x.recipeId === pid) && g.minute - (lastWanted[pid] ?? -1e9) > 45) {
        T.scrapped += g.pots.get(idle.id).left; crafting.emptyPot(g, idle.id); hob = idle;
      }
    }
    if (hob) return startPot(hob, r) ? 1 : "out";
    return null;
  }

  function serveRound() {
    const items = serving.trayItems(g);
    if (!items.length) return false;
    const waiting = g.patrons.filter((p) => p.state === "waiting" && g.order(p.orderId)?.open && items.some((i) => i.recipeId === g.order(p.orderId).recipeId));
    if (!waiting.length) return false;
    const tables = new Set();
    for (const p of waiting) {
      const seat = g.world.seats.find((s) => s.id === p.seatId);
      tables.add(seat?.table ? `${seat.table.x},${seat.table.y}` : `c${p.id}`);
      const before = new Set(serving.trayItems(g));
      if (!serving.deliverTo(g, p, true)) continue;
      const item = [...before].find((i) => !serving.trayItems(g).includes(i));
      const outcome = p.marker?.text;
      if (item && outcome) {
        remember(p, item, outcome);
        const h = T.byHour[g.hour];
        h.served++; if (outcome === "DELIGHT") h.delights++;
      }
    }
    use(walk * tables.size + 0.15 * waiting.length);
    return true;
  }

  function clean() {
    for (const [k, d] of g.dirt) if (d >= TUNING.tableDirtyAt) { g.dirt.set(k, 0); g.stats.cleaned++; use(1.3); return true; }
    if (g.spills.length) { g.spills.shift(); g.stats.cleaned++; use(1); return true; }
    return false;
  }

  function act() {
    for (const o of g.orders) if (o.open) lastWanted[o.recipeId] = g.minute;
    if (g.minute < busy) return;
    const open = g.orders.filter((o) => o.open && !covered(o)).sort((a, b) => a.placedAt - b.placedAt);
    let gathered = 0, cost = 0;
    for (const o of open) {
      if (!serving.trayRoomFor(g, o.recipeId)) break;
      const c = produce(o);
      if (c === "out") { T.outs[o.recipeId] = (T.outs[o.recipeId] ?? 0) + 1; continue; }
      if (c == null) continue;
      cost += c; gathered++;
      if (c >= 1 && R(o.recipeId).servings) break;
    }
    if (gathered) { use(cost + walk); return; }
    if (serveRound()) return;
    if (g.open) {
      const want = g.hour < 11 ? ["porridge"] : g.hour < 21 ? ["stew"] : [];
      for (const id of want) if (MENU.includes(id) && !potOf(id) && !cooking(id)) { const h = freeHob(); if (h && startPot(h, R(id))) { use(1); return; } }
    }
    clean();
  }

  const ids = INGREDIENTS.map((i) => i.id);
  const snap = () => Object.fromEntries(ids.map((id) => [id, stock.have(g, id)]));
  const value = (s) => ids.reduce((a, id) => a + ((s[id] || 0) * worth(id) || 0), 0);
  const avgUse = {};
  let T;

  function restock(morning) {
    const before = g.purse;
    const coming = {};
    for (const d of g.deliveries) { const s = sup.suppliersHere(g).find((x) => x.id === d.supplierId); for (const l of sup.linesOf(s)) if (d.slip[l.item]) coming[l.item] = (coming[l.item] ?? 0) + d.slip[l.item] * l.pack.units; }
    const sups = sup.suppliersHere(g).filter((s) => sup.nextDeliveryDay(g, s) !== undefined);
    for (const id of ids) {
      const used = Math.max(0, morning[id] - stock.have(g, id));
      const u = Math.max(used, avgUse[id] ?? 0);
      avgUse[id] = 0.5 * (avgUse[id] ?? used) + 0.5 * used;
      if (u <= 0) continue;
      const options = sups.flatMap((s) => sup.linesOf(s).filter((l) => l.item === id && sup.inSeason(g, id)).map((l) => ({ s, l, gap: sup.nextDeliveryDay(g, s) - g.day, ppu: sup.packPrice(s, l) / l.pack.units })));
      if (!options.length) continue;
      options.sort((a, b) => a.gap - b.gap || a.ppu - b.ppu);
      const best = options[0];
      const need = u * ((OPT.coverDays ?? 2) + best.gap) - stock.have(g, id, ["fresh"]) - (coming[id] ?? 0);
      if (need <= 0) continue;
      const slip = sup.slipOf(g, best.s);
      slip[id] = (slip[id] ?? 0) + Math.ceil(need / best.l.pack.units);
    }
    for (const s of sups) if (!sup.slipEmpty(g.slips[s.id])) sup.sendSlip(g, s);
    T.supplies = before - g.purse;
  }

  async function runDay() {
    T = { day: g.day, weekday: g.date.weekday, purse0: g.purse, outs: {}, scrapped: 0, roomSum: 0, outSum: 0, roomN: 0, guestN: 0, shiverN: 0,
      byHour: Array.from({ length: 24 }, () => ({ arrivals: 0, turnedAway: 0, inRoom: 0, samples: 0, served: 0, delights: 0 })) };
    busy = 0; busyTotal = 0; openMin = 0;
    for (const k in lastWanted) delete lastWanted[k];
    for (const t of g.keeper.trays) t.items.length = 0;
    for (const c of [...g.crates]) if (g.crates.includes(c)) sup.unpackCrate(g, c);
    const morning = snap();
    const pantry0 = value(morning);
    let turned = false, n = 0, ordered = false;
    const dt = 0.25;
    while (!turned) {
      if (OPT.stopAt && g.minute >= OPT.stopAt) return { stoppedAt: g.minute, patrons: g.patrons.length };
      if (!g.open && !g.lastCall && g.minute >= (OPT.openAt ?? 30) && g.minute < 1000) day.toggleInn(g);
      if (g.open && !g.lastCall && g.minute >= (OPT.lastCallAt ?? 1110)) day.toggleInn(g);
      if (g.lastCall && g.patrons.length === 0 && g.minute > 1110) day.toggleInn(g);
      const coldOrWet = g.date.season === "winter" || g.weather.rain > 0;
      const hot = weather.weatherTags(g).includes("hot");
      if (!g.fireLit && g.open && !hot && upkeep.hasFirewood(g) && (coldOrWet || g.hour >= 17 || g.hour < 2)) g.fireLit = true;
      if (g.fireLit && hot && !OPT.fireWhenHot) g.fireLit = false;
      if (g.fireLit && !g.open) g.fireLit = false;
      if (OPT.heater) {
        const room = warmth.roomTemp(g);
        if (g.open && !hot && room < 2.3 && upkeep.hasFirewood(g)) g.heatersLit.add("simHeater");
        if (!g.open || hot || room > 3.2) g.heatersLit.delete("simHeater");
      }
      if (OPT.windows) {
        const room = warmth.roomTemp(g);
        if (room >= 4 && !g.windowsOpen.size) for (const w of g.world.windows) g.windowsOpen.add(`${w.x},${w.y}`);
        if (room < 3 || !g.open) g.windowsOpen.clear();
      }
      if (g.open) { T.roomSum += warmth.roomTemp(g); T.outSum += g.weather.temp; T.roomN++; const inside = g.patrons.filter((p) => p.state !== "leaving"); T.guestN += inside.length; T.shiverN += inside.filter((p) => warmth.shiverOf(p) > 0).length; }
      act();
      if (g.open) openMin += dt;
      const h = T.byHour[g.hour];
      const tries = g.open && !g.lastCall && g.minute >= g.nextArrivalAt;
      const arrivals = g.stats.arrivals;
      crafting.updateCrafting(g, dt, null);
      patrons.updatePatrons(g, dt);
      if (tries && g.nextArrivalAt > g.minute + 0.01 && !(g.nextArrivalAt - g.minute === 10)) {
        if (g.stats.arrivals > arrivals) h.arrivals += g.stats.arrivals - arrivals; else h.turnedAway++;
      }
      if (g.open) { h.inRoom += g.patrons.filter((p) => p.state !== "leaving" && p.state !== "entering").length; h.samples++; }
      needs.updateNeeds(g, dt);
      weather.updateWeather(g, dt);
      light.updateLamps(g);
      upkeep.updateUpkeep(g, dt);
      warmth.updateRoom(g, dt);
      roads.updateCarter(g);
      for (const c of [...g.crates]) if (g.crates.includes(c)) sup.unpackCrate(g, c);
      if (g.minute >= 1170 && !ordered) { ordered = true; restock(morning); }
      day.updateClock(g, dt, () => { turned = true; });
      if (++n % 2000 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const st = day.endDay(g);
    const pantry1 = value(snap());
    day.startNextDay(g);
    return {
      day: T.day, wd: T.weekday.slice(0, 3), purse0: Math.round(T.purse0), purse1: Math.round(g.purse),
      arrivals: st.arrivals, served: st.served, leftEarly: st.leftEarly, taken: Math.round(st.taken), tips: st.tips,
      supplies: Math.round(T.supplies ?? 0), upkeep: Math.round(st.upkeep ?? 0), wear: st.wear ?? 0, messy: st.messy ?? 0, pantry0: Math.round(pantry0), pantry1: Math.round(pantry1),
      outcomes: st.outcomes, outs: T.outs, scrapped: T.scrapped, rain: Math.round(st.weather?.rainMinutes ?? 0), snow: Math.round(st.weather?.snowMinutes ?? 0), roads: g.roads ? (g.roads.shut ? "shut" : "late") : "",
      util: Math.round(100 * busyTotal / Math.max(1, openMin)),
      room: (T.roomSum / Math.max(1, T.roomN)).toFixed(1), outside: (T.outSum / Math.max(1, T.roomN)).toFixed(1), shiver: Math.round((100 * T.shiverN) / Math.max(1, T.guestN)),
      byHour: T.byHour.map((x) => ({ arrivals: x.arrivals, turnedAway: x.turnedAway, inRoom: x.samples ? +(x.inRoom / x.samples).toFixed(1) : 0, served: x.served, delights: x.delights })),
    };
  }
  window.simDay = runDay;
  return `ready: ${MENU.join(", ")} · ${learner ? "learner" : "random"} keeper · ${g.priceLevel}`;
})()
