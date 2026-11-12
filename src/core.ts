// Core helpers shared by every system: organic randomness and the event bus.

/** A value authored as a centre plus a spread. Nothing in the inn ticks like a metronome. */
export type Organic = [centre: number, spread: number];

export function organic([centre, spread]: Organic): number {
  // Triangular-ish distribution: average of two uniforms, centred on `centre`.
  const r = (Math.random() + Math.random()) / 2; // 0..1, peaks at 0.5
  return Math.max(0, centre + (r - 0.5) * 2 * spread);
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function weightedPick<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
  const ws = items.map((i) => Math.max(0, weight(i)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return undefined;
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

let nextId = 1;
export function uid(): number {
  return nextId++;
}

// ---------------------------------------------------------------------------
// Event bus. Systems emit and subscribe; they never call each other directly.

export type GameEvent =
  | { type: "PatronArrived"; patronId: number }
  | { type: "PatronLeft"; patronId: number; early: boolean }
  | { type: "OrderPlaced"; orderId: number }
  | { type: "OrderFulfilled"; orderId: number }
  | { type: "ItemCrafted"; itemId: number }
  | { type: "ItemPickedUp"; itemId: number }
  | { type: "ItemGarnished"; itemId: number }
  | { type: "ServeOutcome"; patronId: number; outcome: Outcome; score: number }
  | { type: "InnOpened" }
  | { type: "LastCall" }
  | { type: "InnClosed" }
  | { type: "FrontDoor"; state: "opening" | "closing"; quick: boolean }
  | { type: "Paper"; what: "objective" | "menu" | "journal" } // something written down or ticked off
  | { type: "Confirmed" } // a menu's main button was pressed
  | { type: "PourStarted"; id: number; from: "tap" | "urn" }
  | { type: "PourEnded"; id: number; done: boolean }
  | { type: "TurnInPrompted" }
  | { type: "DayEnded"; day: number }
  | { type: "DayStarted"; day: number }
  | { type: "Paused" }
  | { type: "Resumed" }
  | { type: "Log"; text: string };

export type Outcome = "DELIGHT" | "PLEASED" | "FULFILLED" | "UNFINISHED" | "COMPLAINS" | "LEAVING";

type Handler = (e: GameEvent) => void;

export class EventBus {
  private handlers: Handler[] = [];
  on(h: Handler): void {
    this.handlers.push(h);
  }
  emit(e: GameEvent): void {
    for (const h of this.handlers) h(e);
  }
}
