// The shared game state. Systems read and change it; the UI only reads it.

import { servedReadyMade } from "./readymade.js";
import { EventBus, type Outcome } from "./core.js";
import { STARTING_PURSE, type PriceLevel } from "./money.js";
import { startingLots, type Lot, type Taken } from "./stock.js";
import { World, defaultLayout, type Placed, type Vec } from "./world.js";
import { dateOf, randomStartSeason, type GameDate } from "./calendar.js";
import { newWeather, type CameIn, type WeatherState } from "./weather.js";
import type { Paper } from "./newspaper.js";
import type { WalkthroughState } from "./walkthrough.js";
import { SKILLS_DATA } from "./gamedata.gen.js";
import type { KnackId } from "./gamedata.js";
import { TIME_WORDS, TUNING, timeOfDayAt, type Archetype, type ItemKind, type Line, type NeedId, type Regular, type SchemaId, type TasteSet, type TimeOfDay, type WeatherTaste, type Location, type LocationId, type MealId, MEALS, RECIPES, innOf, type Inn, type InnId } from "./data.js";

export interface Item {
  id: number;
  recipeId: string;
  name: string;
  kind: ItemKind;
  tags: string[];
  garnish?: string; // garnish id
  madeDay?: number;
  snack?: string; // a filled snack bowl (snack id)
  options?: string[]; // ingredients that went in (the leaf, the beans…)
  whole?: number; // a whole pie, this many slices: carried from the oven to the pie safe, never served
  ticket?: number; // patron id this single serving was made for
  ticketName?: string;
  /** Picked up from this place to cook (a slot id), off its shelf or (`fromPot`) as a serving from its pot: it can go back. */
  from?: string;
  fromPot?: boolean;
  /** Which pot it came out of (its dish's id). It can go back into any pot of the same dish made the same way. */
  fromPotId?: number;
  /** Bought, not made (a baker's pie): the ingredient id it came as. Priced from what it cost. */
  readyMade?: string;
}

export interface Tray {
  items: Item[];
}

export interface Meal { id: MealId; from: number; to: number; menu: Set<string> }

export interface Order {
  id: number;
  patronId: number;
  recipeId: string;
  wantGarnish?: string;
  wantOption?: string; // a particular leaf or bean, asked for by name
  label: string;
  placedAt: number; // game minute
  open: boolean;
  /** Today's ticket number: 1, 2, 3… reset each morning, never reused within a day. */
  no: number;
}

export type PatronState = "entering" | "queued" | "seated" | "waiting" | "consuming" | "leaving";

/** People who came in together. If no table fits them, they wait on the bench by the entrance. */
export interface Group { id: number; members: number[]; waiting: boolean; tableKey?: string; leaving?: boolean }

export interface Tastes { food: TasteSet; drink: TasteSet }

export interface Patron {
  id: number;
  /** What you call them: their role ("Farmhand") until they tell you their name. */
  name: string;
  /** Their real name, once known it becomes `name`. */
  trueName?: string;
  archetype?: Archetype;
  regularId?: string;
  groupId?: number;
  schema: SchemaId;
  color: string;
  pos: Vec;
  path: Vec[];
  speed: number; // tiles per game minute
  state: PatronState;
  seatId: number | null;
  /** The tastes that score tonight's serves (for unformed: tonight's roll plus locks). */
  tastes: Tastes;
  craving?: { tag: string; honest: boolean };
  fussiness: number;
  messiness: number;
  patience: number;
  consumeTime: [number, number];
  foodBias: number;
  garnishAsk: number;
  stayUntil: number; // game minute
  arrivedAt: number;
  orderId: number | null;
  waitedSince: number;
  remindedOnce: boolean;
  consumeUntil: number;
  nextThinkAt: number;
  ordersPlaced: number;
  snackNoted?: boolean; // said something about the snack bowl this visit
  inspiredBy?: { recipeId: string; from: string }; // saw someone delighted by this
  inspiredTimes?: number; // how many times they've been swayed this visit
  hadRecipes?: string[]; // what they've ordered this visit
  lingering?: boolean; // done, waiting for the rest of their party
  lingerSince?: number;
  greeted?: boolean; // the keeper has said hello this visit
  wants?: string; // the dish they came in for: their first order, while it's on the bill
  nextChatAt?: number;
  consuming?: { icon: string; kind: ItemKind; from: number; tags?: string[]; needs?: Record<NeedId, number> }; // what's in front of them
  marker?: { text: Outcome | string; until: number };
  /** Tips earned this visit, paid all at once when they get up to leave (pennies); whether any came from a Delight. */
  tipOwed?: number;
  tipDelight?: boolean;
  /** What they're saying: shown until `until`; cut short at `minUntil` if someone at the table is waiting to talk. */
  line?: { text: string; until: number; minUntil?: number };
  /** Lines waiting their turn: one voice per table at a time (see Game.speak). */
  lineQueue?: { text: string; minutes: number; queuedAt: number }[];
  leftEarly: boolean;
  /** Why they came in: out of the rain, to eat, to drink, or for the company. */
  reason: "shelter" | "food" | "drink" | "company";
  /** Decided to go (the rain stopped): finish what's coming, then leave without ordering more. */
  leaveAfter?: boolean;
  /** Done, wanting nothing, but waiting for the rain to stop (since this game minute). */
  waitingOut?: number;
  /** How wet they are, 0..1: from the rain they came in from, drying off inside. */
  soaked: number;
  /** The weather they walked in from: sky, rain band and intensity. */
  cameIn?: CameIn;
  /** Full, but having one more drink anyway (the soft edge of full); and when they last did. */
  graceDrink?: boolean;
  lastGraceAt?: number;
  /** Weather they love or dislike (by weather tag). */
  weatherTaste: WeatherTaste;
  /** 0 = fully met, 1 = desperate. Measured only, for now: nothing reacts to them yet. */
  needs: Record<NeedId, number>;
  /** Needs currently unmet, with when it started and what was going on meanwhile. */
  unmet: Partial<Record<NeedId, { since: number; peak: number; while: Set<string> }>>;
}

/** One stretch of a patron going without: the raw material for designing mood. */
export interface UnmetStretch {
  who: string;
  type: string; // archetype id, or "regular:<id>"
  need: NeedId;
  from: string; // clock time it started
  minutes: number;
  peak: number;
  ended: "met" | "left" | "closing";
  while: string[]; // what was going on during it: "fire out", "waiting on food", …
}

export interface Job {
  recipeId: string;
  ingredients: string[];
  total: number; // minutes
  progress: number; // minutes done
  done: boolean;
  item?: Item; // finished, waiting for room on the shelf
  taken?: Taken; // what went in that was past fresh, and the tags it gives the dish
  ticket?: number;
  ticketName?: string;
  batch?: boolean; // made as a batch (the tea urn)
}

export interface Pot { item: Item; left: number; total: number }

/** A whole pie in the pie safe. */
export interface WholePie { id: number; item: Item; left: number; total: number; bakedDay: number }

export interface Keeper {
  pos: Vec;
  facing: Vec;
  trays: [Tray, Tray];
  path: Vec[];
  running: boolean;
  pendingInteract: string | null; // target id to interact with on arrival
}

export interface DayStats {
  day: number;
  arrivals: number;
  /** Orders taken today: also the last ticket's number. Missing in saves from before tickets. */
  orders?: number;
  served: number;
  outcomes: Record<string, number>;
  leftEarly: number;
  leftUnserved: number;
  crafted: number;
  garnished: number;
  cleaned: number;
  moments: string[]; // locks, breakthroughs, opening up
  unmet?: UnmetStretch[]; // missing in saves from before needs
  /** Coin: paid for orders, tips, spent. Missing in saves from before coin. */
  taken?: number;
  tips?: number;
  spent?: number;
  sold?: number;
  /** The day's weather, while the keeper was up: minutes of rain, a storm or not, minutes per sky. */
  weather?: { rainMinutes: number; storm: boolean; sky: Record<string, number> };
}

export function emptyStats(day: number): DayStats {
  return {
    day, arrivals: 0, orders: 0, served: 0, taken: 0, tips: 0, spent: 0, leftEarly: 0, leftUnserved: 0, crafted: 0, garnished: 0, cleaned: 0,
    outcomes: { DELIGHT: 0, PLEASED: 0, FULFILLED: 0, UNFINISHED: 0, COMPLAINS: 0 },
    moments: [], unmet: [], weather: { rainMinutes: 0, storm: false, sky: {} },
  };
}

export interface JournalEntry { day: number; time: string; text: string; kind?: "moment" | "serve" | "said" | "note" }

/** What persists about a named regular between days. */
export interface RegularState {
  id: string;
  familiarity: number;
  visits: number;
  locks: Tastes; // unformed: tags locked in so far
  resolved: boolean; // unformed and veiled: solved, now plays as open
  openedUp: boolean; // reserved
  /** They've told you their name. */
  nameKnown?: boolean;
  journal: JournalEntry[];
  // today only (not saved)
  arriveAt?: number;
  visitedToday?: boolean;
}

export function emptyTastes(): Tastes {
  return { food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] } };
}

export interface LogLine { at: number; text: string }

export interface Spill { id: number; x: number; y: number }
/** Supplies the carter left at the kitchen door, until they're carried in. `day`: the day it came (it ages from the next). */
export interface Crate { id: number; x: number; y: number; day: number; lines: { item: string; units: number }[]; got: string[] }

export interface Cleaning { targetId: string; progress: number; total: number }

/** A tray the keeper has set down on a counter or table. */
export interface SetDownTray { id: number; x: number; y: number; tray: Tray }

export class Game {
  bus = new EventBus();
  /** Which inn: its map. Picked when a save starts (saves from before there was a choice are the big tavern). */
  inn: InnId = "medium";
  /** Where the kitchen equipment stands (bought, placed and moved by the keeper). Saved. */
  layout: Placed[] = defaultLayout(this.inn);
  world = new World(this.layout, this.inn);
  /** Arranging the kitchen: the clock stops; `holding` is a piece being moved or just bought. */
  arranging: { holding?: { uid: string; type: string; isNew: boolean }; hover?: Vec } | null = null;
  day = 1; // days played, from 1. The date is worked out from this: see `date`.
  calendarStart = randomStartSeason(); // index of the calendar season this save began in
  /** Where the inn stands; unset until the player picks, on a new save (town centre meanwhile). */
  location?: LocationId;
  weather: WeatherState = newWeather(dateOf(1, this.calendarStart).season);
  minute = 0; // minutes since the day started (6 AM)
  speedIndex = 1;
  paused = false;
  modal = false; // a modal dialog is open (sim stops)
  open = false;
  lastCall = false;
  fireLit = false;
  lampsLit = false;
  /** The gramophone: playing or not, which record, and how many records the spring has left. */
  // spring: seconds of music left in it. resumeAt: where in the record it stopped when the spring gave out
  // mid-record (seconds), so winding it again picks up there; null: start the record from the top.
  gramophone = { on: false, record: 0, spring: 0, resumeAt: null as number | null };
  /** The keeper winding the gramophone (real seconds; walking away stops it). */
  winding: { progress: number; total: number; at: { x: number; y: number } } | null = null;
  /** This morning's paper (newspaper.ts). */
  paper?: Paper; // the keeper lights the lamps when it gets gloomy (ui/light.ts)
  flowMultiplier = 1;
  /** Coin, in pennies (money.ts). */
  purse = STARTING_PURSE;
  /** The house-wide price knob: Cheap, Fair or Dear. */
  priceLevel: PriceLevel = "fair";
  /** "+6d" rising over a guest who's just paid (drawn, then dropped after a moment). */
  coinPops: { x: number; y: number; paid: number; tip: number; at: number }[] = [];
  /** Bought, coming with the carter tomorrow morning (equipment and goods ids). */
  onOrder: string[] = [];
  /** The pantry: units of each ingredient. */
  lots: Record<string, Lot[]> = startingLots(1); // the pantry, as batches by the day they came in
  /** Pencilled slips on the desk, one per supplier (item id -> packs); the last one sent to each; what's coming. */
  slips: Record<string, Record<string, number>> = {};
  lastSlips: Record<string, Record<string, number>> = {};
  deliveries: { supplierId: string; day: number; slip: Record<string, number> }[] = [];
  /** Delivered pieces waiting to be placed in the kitchen (equipment ids). */
  toPlace: string[] = [];
  nextArrivalAt = 0;
  keeper: Keeper;
  patrons: Patron[] = [];
  orders: Order[] = [];
  hatch: Item[] = []; // for a hired cook later; the keeper's own cooking waits on the station shelf
  shelves = new Map<string, Item[]>(); // station id -> finished dishes waiting to be picked up
  jobs = new Map<string, Job>(); // furniture id -> job
  pots = new Map<string, Pot>(); // furniture id -> communal pot
  pieSafe: WholePie[] = [];
  dirt = new Map<string, number>(); // table key "x,y" -> dirt units
  spills: Spill[] = [];
  crates: Crate[] = [];
  coat = "slate"; // the keeper's coat, chosen at the wardrobe
  under = "linen"; // what shows under it: the head
  newGear: string[] = []; // kettles, coffee pots, Dutch ovens the carter brought, not yet set on a stove
  setDown: SetDownTray[] = [];
  groups: Group[] = [];
  reservations = new Map<string, number>(); // table key -> group id waiting for it
  bowls = new Map<string, { snack: string; left: number }>(); // table key -> snack bowl (left: 0..1)
  menu = new Set<string>(DEFAULT_MENU); // recipe ids on today's bill of fare
  menuChosen = false; // the keeper has set the bill of fare at least once
  /** Meal times mode: each meal has its own bill; between meals, only the drinks on `betweenMenu`. */
  mealMode = false;
  meals: Meal[] = MEALS.map((m) => ({ id: m.id, from: m.from, to: m.to, menu: new Set<string>() }));
  betweenMenu = new Set<string>();
  /** The meal that was on last time we looked (for "Lunch is on" in the log). */
  mealOn?: MealId | null;
  upgrades = new Set<string>();
  totalServed = 0; // across all days
  showObjectives = true;
  known = new Set<string>(SKILLS_DATA.startKnown); // the recipe book
  pointsSpent = 0; // skill points spent on recipes and knacks
  xp = 0; // experience from guests served, across all days
  knacks: Partial<Record<KnackId, number>> = {}; // tiers bought
  newSkills = false; // levelled up and Skills not opened since
  hurrying = false; // F held: hurry what's cooking at the target
  walkthrough?: WalkthroughState;
  cleaning: Cleaning | null = null;
  /** A drink being poured (at a tap, or a cup from the urn). Walking away stops it. */
  pouring: { id: number; from: string; recipeId?: string; at: { x: number; y: number }; progress: number; total: number } | null = null;
  regulars = new Map<string, RegularState>();
  visitorNotes: JournalEntry[] = [];
  stats: DayStats = emptyStats(1);
  history: DayStats[] = [];
  log: LogLine[] = [];
  holdingSpace = false;
  keeperLine?: { text: string; until: number };
  frontDoor = { open: false, quick: false, openedAt: 0, clearSince: null as number | null };
  journalUnread = 0;
  journalToast?: { text: string; until: number }; // real-time ms
  /** Item ids that left the trays through a known path this frame (the watchdog checks the rest). */
  accountedFor = new Set<number>();
  turnInPrompted = false;
  /** "Spring is here." on the first morning of a new calendar season, until the day starts. */
  seasonNews?: string;

  constructor() {
    const b = this.world.bedSide;
    this.keeper = {
      pos: { x: b.x + 0.5, y: b.y + 0.5 },
      facing: { x: 0, y: 1 },
      trays: [{ items: [] }, { items: [] }],
      path: [],
      running: false,
      pendingInteract: null,
    };
    this.bus.on((e) => {
      if (e.type === "Log") this.log.push({ at: this.minute, text: e.text });
      if (this.log.length > 60) this.log.shift();
    });
  }

  /** Clock hour right now, with the fraction: 13.5 is half past one; past midnight goes on to 24, 25… */
  get clockHour(): number {
    return TUNING.dayStartHour + this.minute / 60;
  }

  /** The meal being served right now, in meal times mode. */
  mealNow(): Meal | null {
    if (!this.mealMode) return null;
    const h = this.clockHour;
    return this.meals.find((m) => h >= m.from && h < m.to) ?? null;
  }

  /** The bill of fare that applies right now: the all-day bill, this meal's, or between meals (drinks). */
  /** What guests can order right now: the bill that's up, less anything this kitchen can't make. */
  billNow(): Set<string> {
    const bill = !this.mealMode ? this.menu : this.mealNow()?.menu ?? this.betweenMenu;
    return new Set([...bill].filter((r) => this.canMake(r)));
  }

  /** Everything that's on any bill today (for what to prepare). */
  billAllDay(): Set<string> {
    const all = !this.mealMode ? this.menu : new Set([...this.meals.flatMap((m) => [...m.menu]), ...this.betweenMenu]);
    return new Set([...all].filter((r) => this.canMake(r)));
  }

  get pieSafeCapacity(): number {
    return PIE_SAFE_CAPACITY * this.layout.filter((p) => p.type === "pieSafe").length;
  }

  /** The equipment moved: build the inn again around it. Seats keep who's sitting in them. */
  rebuildWorld(): void {
    const sitting = new Map(this.world.seats.map((s) => [s.id, s.occupant]));
    this.world = new World(this.layout, this.inn);
    for (const s of this.world.seats) s.occupant = sitting.get(s.id) ?? null;
    this.keeper.pendingInteract = null;
  }

  /** Move into another inn (a new save picks one): its map, its equipment where the map puts it, the keeper by the bed. */
  setInn(id: InnId): void {
    this.inn = id;
    this.layout = defaultLayout(id);
    this.world = new World(this.layout, id);
    const b = this.world.bedSide;
    this.keeper.pos = { x: b.x + 0.5, y: b.y + 0.5 };
    this.keeper.path = [];
    this.keeper.pendingInteract = null;
    for (const r of [...this.menu]) if (!this.canMake(r)) this.menu.delete(r); // nothing on the bill you can't make here
  }

  get innDef(): Inn {
    return innOf(this.inn);
  }

  /** Whether this kitchen can make a dish at all: a barrel that pours it, or somewhere to cook it. */
  canMake(recipeId: string): boolean {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return false;
    if (servedReadyMade(this, r.id)) return true;
    if (!r.internal && r.station !== "tap" && !this.known.has(r.id)) return false;
    if (r.station === "tap") return this.world.furniture.some((f) => f.tap === r.id);
    return this.world.furniture.some((f) => (f.slots ?? []).some((sl) => sl.kinds.includes(r.station as never)));
  }

  say(text: string): void {
    this.bus.emit({ type: "Log", text });
  }

  /**
   * A guest says something over their head. One voice per table at a time: if someone at the same
   * table is still talking, the line waits its turn (flushed by `flushLines`). Stale lines are dropped.
   */
  /** `toKeeper`: a reply to the keeper (a dish, a reminder) goes to the front of the queue. `weight` > 1 lingers longer. */
  speak(p: Patron, text: string, weight = 1, toKeeper = false): void {
    const entry = { text, minutes: weight, queuedAt: this.minute };
    if (toKeeper) (p.lineQueue ??= []).unshift(entry);
    else (p.lineQueue ??= []).push(entry);
    this.flushLines();
  }

  /**
   * How long a line stays up, in game minutes, from how long it takes to read in real seconds at the
   * current speed. `min` is the shortest it may be cut to when someone else at the table wants to talk.
   */
  readTime(text: string, weight = 1): { full: number; min: number } {
    const T = TUNING.speech;
    const secs = Math.max(T.minSeconds, Math.min(T.maxSeconds, T.baseSeconds + text.length * T.perChar)) * weight;
    const perSec = this.speed / TUNING.realSecondsPerGameMinute; // game minutes per real second
    return { full: secs * perSec, min: secs * T.cutShare * perSec };
  }

  /** Who shares a voice with this guest: their table, or just themselves at the counter or on the bench. */
  voiceOf(p: Patron): string {
    const seat = this.world.seats.find((s) => s.id === p.seatId);
    return seat?.table ? `t${seat.table.x},${seat.table.y}` : `p${p.id}`;
  }

  /** Let the next waiting line through wherever its table has gone quiet (or has had long enough). */
  flushLines(): void {
    const waiting = new Set<string>();
    for (const q of this.patrons) {
      const queue = q.lineQueue;
      if (!queue?.length) continue;
      while (queue.length && this.minute - queue[0].queuedAt > TUNING.lineStaleMinutes) queue.shift();
      if (queue.length && q.state !== "leaving") waiting.add(this.voiceOf(q));
    }
    if (!waiting.size) return;
    // A voice is busy while its line is up; with someone waiting, only until its minimum read.
    const busy = new Set<string>();
    for (const q of this.patrons) {
      if (!q.line || this.minute >= q.line.until) continue;
      const v = this.voiceOf(q);
      if (this.minute < (waiting.has(v) ? q.line.minUntil ?? q.line.until : q.line.until)) busy.add(v);
    }
    for (const q of this.patrons) {
      const queue = q.lineQueue;
      if (!queue?.length || q.state === "leaving") continue;
      const voice = this.voiceOf(q);
      if (busy.has(voice)) continue;
      // Whoever was still talking at this table stops: one voice at a time.
      for (const o of this.patrons) if (o.line && this.voiceOf(o) === voice) o.line.until = Math.min(o.line.until, this.minute);
      const next = queue.shift()!;
      const t = this.readTime(next.text, next.minutes);
      q.line = { text: next.text, until: this.minute + t.full, minUntil: this.minute + t.min };
      busy.add(voice);
    }
  }


  get speed(): number {
    return TUNING.speeds[this.speedIndex];
  }

  /** Clock hour 0-23 for the current minute. */
  get hour(): number {
    return Math.floor((TUNING.dayStartHour * 60 + this.minute) / 60) % 24;
  }

  /** Today's date: "Spring 12, year 1", a Tuesday. */
  get date(): GameDate {
    return dateOf(this.day, this.calendarStart, this.loc.days);
  }

  /** Where the inn stands: how long its calendar seasons run, its weather, who passes by. */
  get loc(): Location {
    return LOCATION_LOOKUP.get(this.location ?? "town")!;
  }

  /** The date of any day of play (journal entries and past days keep their day number). */
  dateOfDay(day: number): GameDate {
    return dateOf(day, this.calendarStart, this.loc.days);
  }

  /** Morning, midday, afternoon, evening or night: the one value everything reads. */
  get timeOfDay(): TimeOfDay {
    return timeOfDayAt(this.hour);
  }

  /** Fill {time} and {now} in a line from the time of day ("Evening", "tonight"). */
  words(text: string): string {
    const w = TIME_WORDS[this.timeOfDay];
    return text.replaceAll("{time}", w.time).replaceAll("{now}", w.now);
  }

  /** Pick a line that fits the time of day, with its words filled in. */
  pickLine(lines: readonly Line[]): string {
    const now = this.timeOfDay;
    const fits = lines.filter((l) => typeof l === "string" || l.when.includes(now));
    const l = fits[Math.floor(Math.random() * fits.length)] ?? "";
    return this.words(typeof l === "string" ? l : l.text);
  }

  clockText(minute = this.minute): string {
    const total = TUNING.dayStartHour * 60 + minute;
    const h = Math.floor(total / 60) % 24;
    const m = Math.floor(total % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  patron(id: number | null | undefined): Patron | undefined {
    return this.patrons.find((p) => p.id === id);
  }

  order(id: number | null): Order | undefined {
    return this.orders.find((o) => o.id === id);
  }

  regular(id: string | undefined): RegularState | undefined {
    return id ? this.regulars.get(id) : undefined;
  }

  journal(p: Patron, text: string, kind: JournalEntry["kind"] = "serve"): void {
    const e = { day: this.day, time: this.clockText(), text, kind };
    // Anything beyond a routine serve is worth a heads-up.
    if (kind !== "serve") {
      this.journalUnread++;
      this.journalToast = { text: `📖 ${p.name}: ${text}`, until: performance.now() + 4000 };
      this.bus.emit({ type: "Paper", what: "journal" });
    }
    const r = this.regular(p.regularId);
    if (r) {
      r.journal.push(e);
      if (r.journal.length > 300) r.journal.splice(0, r.journal.length - 300);
    }
    else {
      this.visitorNotes.push({ ...e, text: `${p.name}: ${text}` });
      if (this.visitorNotes.length > 40) this.visitorNotes.shift();
    }
  }

  /** Slots on each tray: the best tray the keeper has. */
  get traySlots(): number {
    return bestInLine(this.upgrades, "tray")?.traySlots ?? 4;
  }

  /** The snack bowl a seat can reach: its table's, or for a stool, the nearest snack spot on the counter. */
  bowlKeyFor(seat: { kind: string; tile: Vec; table?: Vec } | undefined): string | undefined {
    if (!seat) return undefined;
    if (seat.table) return `${seat.table.x},${seat.table.y}`;
    if (seat.kind !== "stool") return undefined;
    const spot = this.world.furniture
      .filter((f) => f.kind === "snacks")
      .map((f) => ({ f, d: Math.hypot(f.tiles[0].x - seat.tile.x, f.tiles[0].y - seat.tile.y) }))
      .filter((x) => x.d <= 2.3)
      .sort((a, b) => a.d - b.d)[0];
    return spot ? `${spot.f.tiles[0].x},${spot.f.tiles[0].y}` : undefined;
  }

  regularDef(id: string | undefined): Regular | undefined {
    return REGULAR_LOOKUP.get(id ?? "");
  }
}

import { REGULARS, DEFAULT_MENU, LOCATIONS, PIE_SAFE_CAPACITY, bestInLine, TUNING as T2 } from "./data.js";
const LOCATION_LOOKUP = new Map(LOCATIONS.map((l) => [l.id, l]));
const REGULAR_LOOKUP = new Map(REGULARS.map((r) => [r.id, r]));
