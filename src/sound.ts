// Sounds: what plays when. Which files, how loud: SOUNDS in data.ts.
//   sound/engine.ts     loading, evening out loudness, playing from places (distance, pan, walls)
//   sound/loops.ts      kettle and stew, while they're cooking
//   sound/footsteps.ts  a step per stride, keeper and guests
//   sound/crowd.ts      the taproom murmur, by headcount
//   sound/fire.ts       the fire: catches, roars, settles; embers when put out
//   sound/weather.ts    rain indoors, through the open door, and at the windows, mixed by intensity
//   sound/gramophone.ts records from the gramophone, a few per winding
//   sound/bgm.ts        background music when the gramophone has been quiet a while
// This file listens to game events and calls soundscape() every frame. M mutes; pause silences everything.

import type { Game } from "./game.js";
import type { MenuSound } from "./core.js";
import { DOOR_TUNING, OUTCOME_SOUND, SOUND_TUNING as T } from "./data.js";
import { attach, output, play, ready, resume, ringsOut, stop, suspend, updateVoices, vary, wakeUp, type Voice } from "./sound/engine.js";
import { cookingLoops } from "./sound/loops.js";
import { footsteps } from "./sound/footsteps.js";
import { crowd } from "./sound/crowd.js";
import { fire } from "./sound/fire.js";
import { thunder, weatherSound } from "./sound/weather.js";
import { gramophoneSound } from "./sound/gramophone.js";
import { bgmSound, hushBgm } from "./sound/bgm.js";

export { isMuted, toggleMute, unlockAudio } from "./sound/engine.js";

/** Call every frame with real seconds. */
export function soundscape(g: Game, realDt: number): void {
  if (!ready()) return;
  cookingLoops(g);
  footsteps(g, realDt);
  crowd(g);
  fire(g, realDt);
  weatherSound(g, realDt);
  gramophoneSound(g, realDt);
  bgmSound(g, realDt);
  updateVoices();
}

// The door makes one sound at a time: opening and closing never overlap.
let doorSound: Voice | null = null;
function door(g: Game, state: "opening" | "closing", quick: boolean): void {
  const at = { x: g.world.frontDoor.x + 0.5, y: g.world.frontDoor.y + 0.5 };
  stop(doorSound, DOOR_TUNING.fadeMs);
  const rate = quick ? DOOR_TUNING.quickRate : 1;
  doorSound = play(state === "opening" ? "doorOpens" : "doorCloses", at, { rate });
  // The bell hangs on the door: it rings as the door swings, and isn't cut off by it.
  if (state === "opening") setTimeout(() => play("bell", at, { rate }), DOOR_TUNING.bellDelayMs / rate);
}

// Serving reactions play one after the other, like someone playing chords: each rings out,
// then a breath, then the next. A whole table served at once queues up.
const reactions: string[] = [];
let reacting = false;
function reaction(sound: string): void {
  reactions.push(sound);
  if (!reacting) nextReaction();
}
function nextReaction(): void {
  if (reactions.length && !ready()) { setTimeout(nextReaction, 200); return; } // paused: wait, don't pile up
  const sound = reactions.shift();
  if (!sound) { reacting = false; return; }
  reacting = true;
  const v = play(sound, null);
  const breath = T.outcomeBreathMs + (Math.random() * 2 - 1) * T.outcomeBreathJitterMs;
  setTimeout(nextReaction, ringsOut(v) * 1000 + breath);
}

// A guest paying us. A tip (paid on the way out) is the Delight coins if anything that visit delighted
// them, else the coin purse for a bigger one and the small tip sound for a few pennies. An order goes by
// the biggest coin in it: a few pennies, a handful, silver, or crowns. A table paying at once clinks one
// after another.
function coinSound(paid: number, tip: number, delight: boolean): string {
  if (tip) return delight ? "coinsDelight" : tip >= T.bigTipPence ? "coinsTip" : "coinsTipSmall";
  if (paid >= 100) return "coinsCrowns";
  if (paid >= 10) return "coinsSilver";
  return paid <= 3 ? "coinsPennies" : "coinsPayment";
}
let nextCoinAt = 0;
function coin(paid: number, tip: number, delight: boolean): void {
  const now = performance.now();
  const at = Math.max(now + T.coinDelayMs, nextCoinAt);
  nextCoinAt = at + T.coinGapMs;
  const key = coinSound(paid, tip, delight);
  setTimeout(() => { if (ready()) play(key, null); }, at - now);
}

// Paper: ticking the checklist, the bill of fare, a new journal note. Two at once sound as one.
let lastPaper = 0;
function paper(): void {
  const t = performance.now();
  if (t - lastPaper < T.paperGapMs) return;
  lastPaper = t;
  play("paper", null);
}

// One pour at a time; its sound stops when the pour does (done or walked away).
const pours = new Map<number, Voice | null>();

// ---------------------------------------------------------------------------
// Synthesised placeholders (not from anywhere: these are the game talking to you)

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine"): void {
  const o = output();
  if (!o) return;
  const t0 = o.ac.currentTime + start;
  const osc = o.ac.createOscillator();
  const gn = o.ac.createGain();
  osc.type = type;
  osc.frequency.value = vary(freq, 0.04);
  gn.gain.setValueAtTime(0, t0);
  gn.gain.linearRampToValueAtTime(vary(vol, 0.15), t0 + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gn).connect(o.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const synth = {
  moment: () => { tone(659, 0, 0.6, 0.05); tone(880, 0.12, 0.8, 0.05); tone(1319, 0.24, 1.2, 0.04); },
  leave: () => tone(330, 0, 0.25, 0.03, "sine"),
  snap: () => { tone(1800, 0, 0.035, 0.035, "triangle"); tone(900, 0.012, 0.05, 0.03, "triangle"); },
};

// The in-world menus. Opening the desk is two sounds: you sit, then shuffle the papers.
const MENU_KEY: Record<Exclude<MenuSound, "desk">, string> = {
  tick: "menuTick", pageTurn: "menuPageTurn", journal: "menuJournal", paperOpen: "menuPaperOpen", paperClose: "menuPaperClose",
  calendar: "menuCalendar", billOfFare: "menuBillOfFare", prices: "menuPrices", coins: "menuCoins", penClick: "menuPenClick", tableTap: "menuTableTap",
};
let paperOpening: Voice | null = null;
function menuSound(s: MenuSound): void {
  if (s === "desk") { play("menuSit", null); setTimeout(() => play("menuShuffle", null), T.deskShuffleAfterMs); return; }
  if (s === "paperClose") { stop(paperOpening, 150); paperOpening = null; } // folded up before it finished opening
  const v = play(MENU_KEY[s], null);
  if (s === "paperOpen") paperOpening = v;
}

export function initSound(g: Game): void {
  attach(g);
  g.bus.on((e) => {
    switch (e.type) {
      // Opening and closing the inn: no sound yet.
      case "FrontDoor": door(g, e.state, e.quick); break;
      case "PourStarted": pours.set(e.id, play(e.from === "urn" ? "urnPour" : "pour", { ...g.keeper.pos })); break;
      case "PourEnded": stop(pours.get(e.id), e.done ? 250 : 120); pours.delete(e.id); break;
      case "OrderPlaced": {
        // Heard anywhere, panned toward whoever ordered.
        const o = g.order(e.orderId);
        const p = o && g.patrons.find((x) => x.id === o.patronId);
        play("order", p ? { ...p.pos } : null);
        setTimeout(() => synth.snap(), 60); // the ticket snapping into place up top
        break;
      }
      case "ServeOutcome": { const s = OUTCOME_SOUND[e.outcome]; if (s) reaction(s); break; }
      case "Paper": paper(); break;
      case "Reward": synth.moment(); setTimeout(() => play("coinsSilver", null), 300); break;
      case "CoinPaid": coin(e.paid, e.tip, e.delight); break;
      case "DayStarted": wakeUp(); break;
      case "Thunder": thunder(e.near); break;
      case "Confirmed": if (T.confirmSound) play("confirm", null); break;
      case "MenuSound": menuSound(e.sound); break;
      case "TurnedIn": hushBgm(); play("turnIn", null); break; // The Last Candle
      case "PatronLeft": if (e.early) synth.leave(); break;
      case "Log": if (e.text.startsWith("✦")) setTimeout(() => synth.moment(), 350); break;
      case "Paused": { const v = play("menuPause", null); suspend(v ? ringsOut(v) * 1000 + 50 : 0); break; } // the latch, then quiet
      case "Resumed": resume(); break;
    }
  });
}
