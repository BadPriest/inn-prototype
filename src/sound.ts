// Placeholder sounds, synthesised so there are no files to load. Every sound varies
// slightly in pitch and volume, so nothing repeats exactly. M mutes.

import type { Game } from "./game.js";

let ac: AudioContext | null = null;
let muted = false;

export function unlockAudio(): void {
  if (ac) { if (ac.state === "suspended") void ac.resume(); return; }
  try { ac = new AudioContext(); } catch { ac = null; }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

function vary(n: number, amount = 0.04): number {
  return n * (1 + (Math.random() * 2 - 1) * amount);
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine"): void {
  if (!ac || muted) return;
  const t0 = ac.currentTime + start;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = vary(freq);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vary(vol, 0.15), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const sounds = {
  chime: () => { tone(1320, 0, 0.9, 0.07); tone(1760, 0.09, 1.1, 0.05); }, // door bell: a patron walks in
  ding: () => tone(988, 0, 0.5, 0.06, "triangle"), // an order comes in
  deliver: [ // a small set, picked at random
    () => tone(520, 0, 0.12, 0.08, "triangle"),
    () => { tone(440, 0, 0.1, 0.06, "triangle"); tone(660, 0.06, 0.14, 0.05, "triangle"); },
    () => tone(380, 0, 0.18, 0.07, "sine"),
  ],
  delight: () => { tone(784, 0, 0.35, 0.06); tone(988, 0.08, 0.35, 0.05); tone(1175, 0.16, 0.5, 0.05); },
  moment: () => { tone(659, 0, 0.6, 0.05); tone(880, 0.12, 0.8, 0.05); tone(1319, 0.24, 1.2, 0.04); },
  leave: () => tone(330, 0, 0.25, 0.03, "sine"),
};

export function initSound(g: Game): void {
  g.bus.on((e) => {
    switch (e.type) {
      case "PatronArrived": sounds.chime(); break;
      case "OrderPlaced": sounds.ding(); break;
      case "ServeOutcome":
        if (e.outcome === "DELIGHT") sounds.delight();
        else sounds.deliver[Math.floor(Math.random() * sounds.deliver.length)]();
        break;
      case "PatronLeft": if (e.early) sounds.leave(); break;
      case "Log": if (e.text.startsWith("✦")) setTimeout(() => sounds.moment(), 350); break;
    }
  });
}
