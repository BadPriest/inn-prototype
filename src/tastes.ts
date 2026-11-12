// Hidden tastes, taste schemas and scoring. One place decides how a serve lands.
// Each schema is a small strategy with the same three hooks:
//   prepareVisit  set tonight's tastes and craving
//   score         how a serve scores (the veiled add noise here)
//   afterServe    what a strong reaction changes (locks, breakthroughs, opening up)

import { chance, pick, type Outcome } from "./core.js";
import { GARNISHES, SCHEMA_TUNING, TASTE_POOL, TUNING, type ItemKind, type Regular, type SchemaId, type TasteSet } from "./data.js";
import { emptyTastes, type Game, type Item, type Order, type Patron, type RegularState, type Tastes } from "./game.js";

export function tagScore(tags: string[], t: TasteSet): { score: number; hitLove: boolean } {
  const s = TUNING.scoring;
  let score = 0;
  let hitLove = false;
  for (const tag of new Set(tags)) {
    if (tag === TUNING.staleTag) { score += TUNING.stalePenalty; continue; }
    if (t.love.includes(tag)) { score += s.love; hitLove = true; }
    else if (t.like.includes(tag)) score += s.like;
    else if (t.dislike.includes(tag)) score += s.dislike;
  }
  return { score, hitLove };
}

/** How appealing a recipe sounds to a patron before it's made, from its base tags. */
export function appeal(baseTags: string[], t: TasteSet): number {
  return tagScore(baseTags, t).score;
}

function copy(t: TasteSet): TasteSet {
  return { love: [...t.love], like: [...t.like], dislike: [...t.dislike] };
}

function sample(pool: string[], n: number): string[] {
  const p = [...pool];
  const out: string[] = [];
  while (out.length < n && p.length) out.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
  return out;
}

/** The schema a regular plays as right now (solved unformed and veiled play as open). */
export function effectiveSchema(def: Regular, st: RegularState): SchemaId {
  if ((def.schema === "unformed" || def.schema === "veiled") && st.resolved) return "open";
  return def.schema;
}

// ---------------------------------------------------------------------------
// prepareVisit

export function prepareVisit(p: Patron, def: Regular, st: RegularState): void {
  const schema = effectiveSchema(def, st);
  p.schema = schema;
  if (def.schema === "unformed") {
    p.tastes = st.resolved ? { food: copy(st.locks.food), drink: copy(st.locks.drink) } : rollUnformed(st.locks);
  } else {
    p.tastes = { food: copy(def.food), drink: copy(def.drink) };
  }
  // A solved regular sometimes drifts a little: one like fades tonight, another appears.
  if (st.resolved || (def.schema === "open" && st.visits > 6) || st.openedUp) {
    if (chance(SCHEMA_TUNING.driftChance)) {
      const kind: ItemKind = chance(0.5) ? "food" : "drink";
      const t = p.tastes[kind];
      if (t.like.length) {
        t.like.splice(Math.floor(Math.random() * t.like.length), 1);
        const fresh = TASTE_POOL.filter((x) => !t.love.includes(x) && !t.like.includes(x) && !t.dislike.includes(x));
        if (fresh.length) t.like.push(pick(fresh));
      }
    }
  }
  // Tonight's craving
  if (chance(SCHEMA_TUNING.cravingChance)) {
    if (def.schema === "veiled" && !st.resolved) {
      const honest = chance(SCHEMA_TUNING.veiledHonestCraving);
      const pool = honest ? [...def.food.love, ...def.food.like, ...def.drink.love] : TASTE_POOL;
      p.craving = { tag: pick(pool), honest };
    } else if (def.schema === "unformed" && !st.resolved) {
      p.craving = { tag: pick(def.cravings), honest: false };
    } else {
      p.craving = { tag: pick(def.cravings), honest: true };
    }
  }
}

function rollUnformed(locks: Tastes): Tastes {
  const out = emptyTastes();
  for (const kind of ["food", "drink"] as const) {
    const L = locks[kind];
    const free = TASTE_POOL.filter((t) => !L.love.includes(t) && !L.dislike.includes(t));
    const r = SCHEMA_TUNING.unformedRoll;
    const rolled = sample(free, r.love + r.like + r.dislike);
    out[kind] = {
      love: [...L.love, ...rolled.slice(0, r.love)],
      like: rolled.slice(r.love, r.love + r.like),
      dislike: [...L.dislike, ...rolled.slice(r.love + r.like)],
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// score and judge

export interface Verdict {
  outcome: Outcome;
  score: number;
  rawScore: number; // before fussiness
  line: string;
  hitCraving: boolean;
  trueDelight: boolean; // veiled: would this have delighted their true self?
}

function threshold(g: Game, p: Patron): number {
  if (p.schema === "reserved") {
    const st = g.regular(p.regularId);
    if (st?.openedUp) return TUNING.delightThreshold;
    const fam = st?.familiarity ?? 0;
    const bands = SCHEMA_TUNING.reservedBands;
    let i = 0;
    for (let b = 0; b < bands.length; b++) if (fam >= bands[b]) i = b;
    return SCHEMA_TUNING.reservedThreshold[i];
  }
  return TUNING.delightThreshold;
}

function noisy(t: TasteSet, itemTags: string[]): TasteSet {
  const out = copy(t);
  for (const tag of sample(itemTags, SCHEMA_TUNING.veiledNoiseFlips)) {
    const wasGood = out.love.includes(tag) || out.like.includes(tag);
    out.love = out.love.filter((x) => x !== tag);
    out.like = out.like.filter((x) => x !== tag);
    out.dislike = out.dislike.filter((x) => x !== tag);
    if (wasGood) out.dislike.push(tag);
    else if (chance(0.5)) out.like.push(tag);
    else out.dislike.push(tag);
  }
  return out;
}

export function judge(g: Game, p: Patron, item: Item, order: Order | null): Verdict {
  const kind = item.kind;
  const truth = p.tastes[kind];
  const veiledNoise = p.schema === "veiled";
  const used = veiledNoise ? noisy(truth, item.tags) : truth;
  let { score, hitLove } = tagScore(item.tags, used);
  const hitCraving = !!p.craving && item.tags.includes(p.craving.tag);
  if (hitCraving) score += SCHEMA_TUNING.cravingBonus;
  let missingGarnish = false;
  if (order?.wantGarnish && item.garnish !== order.wantGarnish) {
    score += TUNING.scoring.missingGarnish;
    missingGarnish = true;
  }
  const rawScore = score;
  if (score < 0) score = score * (0.6 + p.fussiness); // fussy patrons feel the bad parts more sharply

  // Veiled: would their true self have been delighted?
  let trueDelight = false;
  if (veiledNoise) {
    const t = tagScore(item.tags, truth);
    const ts = t.score + (hitCraving && p.craving?.honest ? SCHEMA_TUNING.cravingBonus : 0);
    trueDelight = ts >= TUNING.delightThreshold && t.hitLove;
  }

  // Placeholder Delight rule: clear the threshold AND hit a love or the craving. (Cards will shape this later.)
  let outcome: Outcome;
  if (trueDelight || (score >= threshold(g, p) && (hitLove || hitCraving))) outcome = "DELIGHT";
  else if (score >= 1) outcome = "PLEASED";
  else if (score > -0.5) outcome = "FULFILLED";
  else if (score <= -2 && p.fussiness >= 0.45 && p.schema !== "reserved") outcome = "COMPLAINS";
  else outcome = "UNFINISHED";

  const g2 = GARNISHES.find((x) => x.id === order?.wantGarnish);
  let line = "";
  if (p.schema === "reserved") {
    line = outcome === "DELIGHT" ? "…Thank you." : "";
  } else {
    switch (outcome) {
      case "DELIGHT": line = hitCraving ? pick(["That's exactly it.", "How did you know?", "Just what I wanted."]) : pick(["Oh, that's lovely.", "Now that's something.", "Just what I needed."]); break;
      case "PLEASED": line = pick(["Mm. Good.", "That'll do nicely.", "Thank you."]); break;
      case "FULFILLED": line = pick(["Thanks.", "Right.", ""]); break;
      case "COMPLAINS": line = missingGarnish && g2 ? `No ${g2.name.toLowerCase()}? Really?` : pick(["Not quite to my taste.", "Hm. No.", "That's... not for me."]); break;
      default: line = "";
    }
  }
  return { outcome, score, rawScore, line, hitCraving, trueDelight };
}

// ---------------------------------------------------------------------------
// afterServe: locks, breakthroughs, opening up. Returns journal moments.

export function afterServe(g: Game, p: Patron, item: Item, v: Verdict): string[] {
  const def = g.regularDef(p.regularId);
  const st = g.regular(p.regularId);
  if (!def || !st) return [];
  const moments: string[] = [];
  st.familiarity += v.outcome === "DELIGHT" ? 2 : 1; // never goes down: even a miss teaches you something

  if (def.schema === "unformed" && !st.resolved) {
    const kind = item.kind;
    const L = st.locks[kind];
    const tonight = p.tastes[kind];
    const newly: string[] = [];
    if (v.outcome === "DELIGHT") {
      for (const tag of item.tags) {
        const good = tonight.love.includes(tag) || (p.craving?.tag === tag);
        if (good && !L.love.includes(tag) && !L.dislike.includes(tag)) { L.love.push(tag); newly.push(`loves ${tag}`); }
      }
    } else if (v.rawScore <= SCHEMA_TUNING.unformedDislikeLockAt) {
      for (const tag of item.tags) {
        if (tonight.dislike.includes(tag) && !L.love.includes(tag) && !L.dislike.includes(tag)) { L.dislike.push(tag); newly.push(`dislikes ${tag}`); }
      }
    }
    if (newly.length) moments.push(`Something settled in ${def.name}: ${newly.join(", ")}.`);
    const t = def.target!;
    const count = (x: TasteSet) => x.love.length + x.dislike.length;
    if (count(st.locks.food) >= t.food && count(st.locks.drink) >= t.drink) {
      st.resolved = true;
      moments.push(`${def.name} knows what they like now.`);
    }
  }
  if (def.schema === "veiled" && !st.resolved && v.trueDelight) {
    st.resolved = true;
    const f = def.food, d = def.drink;
    moments.push(`Breakthrough with ${def.name}. Food: loves ${f.love.join(", ")}; likes ${f.like.join(", ") || "–"}; can't stand ${f.dislike.join(", ") || "–"}. Drink: loves ${d.love.join(", ")}; can't stand ${d.dislike.join(", ") || "–"}.`);
  }
  if (def.schema === "reserved" && !st.openedUp && v.outcome === "DELIGHT") {
    st.openedUp = true;
    moments.push(`${def.name} opened up a little. She smiled.`);
  }
  return moments;
}

/** A plain-words description of how the plate came back (what the journal records). */
export function describeReaction(p: Patron, v: Verdict): string {
  if (p.schema === "reserved") {
    switch (v.outcome) {
      case "DELIGHT": return "ate it all, and nodded";
      case "PLEASED": return "finished all of it";
      case "FULFILLED": return "ate most of it";
      default: return "left most of it";
    }
  }
  switch (v.outcome) {
    case "DELIGHT": return "delighted";
    case "PLEASED": return "pleased";
    case "FULFILLED": return "fine with it";
    case "UNFINISHED": return "left it unfinished";
    case "COMPLAINS": return "complained";
    default: return v.outcome.toLowerCase();
  }
}
