// The shared game state. Systems read and change it; the UI only reads it.

import { EventBus, type Outcome } from "./core.js";
import { World, type Vec } from "./world.js";
import { TUNING, type Archetype, type ItemKind, type Regular, type SchemaId, type TasteSet } from "./data.js";

export interface Item {
  id: number;
  recipeId: string;
  name: string;
  kind: ItemKind;
  tags: string[];
  garnish?: string; // garnish id
  madeDay?: number;
  snack?: string; // a filled snack bowl (snack id)
  ticket?: number; // patron id this single serving was made for
  ticketName?: string;
}

export interface Tray {
  kind: ItemKind | null;
  items: Item[];
}

export interface Order {
  id: number;
  patronId: number;
  recipeId: string;
  wantGarnish?: string;
  label: string;
  placedAt: number; // game minute
  open: boolean;
}

export type PatronState = "entering" | "queued" | "seated" | "waiting" | "consuming" | "leaving";

/** People who came in together. If no table fits them, they wait on the bench by the entrance. */
export interface Group { id: number; members: number[]; waiting: boolean; tableKey?: string; leaving?: boolean }

export interface Tastes { food: TasteSet; drink: TasteSet }

export interface Patron {
  id: number;
  name: string;
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
  nextChatAt?: number;
  consuming?: { icon: string; kind: ItemKind; from: number }; // what's in front of them
  marker?: { text: Outcome | string; until: number };
  line?: { text: string; until: number };
  leftEarly: boolean;
}

export interface Job {
  recipeId: string;
  ingredients: string[];
  total: number; // minutes
  progress: number; // minutes done
  done: boolean;
  item?: Item; // finished, waiting for room on the shelf
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
  served: number;
  outcomes: Record<string, number>;
  leftEarly: number;
  leftUnserved: number;
  crafted: number;
  garnished: number;
  cleaned: number;
  moments: string[]; // locks, breakthroughs, opening up
}

export function emptyStats(day: number): DayStats {
  return {
    day, arrivals: 0, served: 0, leftEarly: 0, leftUnserved: 0, crafted: 0, garnished: 0, cleaned: 0,
    outcomes: { DELIGHT: 0, PLEASED: 0, FULFILLED: 0, UNFINISHED: 0, COMPLAINS: 0 },
    moments: [],
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

export interface Cleaning { targetId: string; progress: number; total: number }

/** A tray the keeper has set down on a counter or table. */
export interface SetDownTray { id: number; x: number; y: number; tray: Tray }

export class Game {
  bus = new EventBus();
  world = new World();
  day = 1;
  minute = 0; // minutes since the day started (6 AM)
  speedIndex = 1;
  paused = false;
  modal = false; // a modal dialog is open (sim stops)
  open = false;
  lastCall = false;
  fireLit = false;
  flowMultiplier = 1;
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
  setDown: SetDownTray[] = [];
  groups: Group[] = [];
  reservations = new Map<string, number>(); // table key -> group id waiting for it
  bowls = new Map<string, { snack: string; left: number }>(); // table key -> snack bowl (left: 0..1)
  menu = new Set<string>(DEFAULT_MENU); // recipe ids on today's bill of fare
  menuChosen = false; // the keeper has set the bill of fare at least once
  upgrades = new Set<string>();
  totalServed = 0; // across all days
  showObjectives = true;
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

  constructor() {
    const b = this.world.bedSide;
    this.keeper = {
      pos: { x: b.x + 0.5, y: b.y + 0.5 },
      facing: { x: 0, y: 1 },
      trays: [{ kind: null, items: [] }, { kind: null, items: [] }],
      path: [],
      running: false,
      pendingInteract: null,
    };
    this.bus.on((e) => {
      if (e.type === "Log") this.log.push({ at: this.minute, text: e.text });
      if (this.log.length > 60) this.log.shift();
    });
  }

  say(text: string): void {
    this.bus.emit({ type: "Log", text });
  }

  get speed(): number {
    return TUNING.speeds[this.speedIndex];
  }

  /** Clock hour 0-23 for the current minute. */
  get hour(): number {
    return Math.floor((TUNING.dayStartHour * 60 + this.minute) / 60) % 24;
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

  /** Tray capacity, with upgrades. */
  trayCap(kind: ItemKind): number {
    return T2.trayCapacity[kind] + (this.upgrades.has("trays") ? 1 : 0);
  }

  regularDef(id: string | undefined): Regular | undefined {
    return REGULAR_LOOKUP.get(id ?? "");
  }
}

import { REGULARS, DEFAULT_MENU, TUNING as T2 } from "./data.js";
const REGULAR_LOOKUP = new Map(REGULARS.map((r) => [r.id, r]));
