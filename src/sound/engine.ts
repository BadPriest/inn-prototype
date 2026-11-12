// The sound engine: loads the files, evens out their loudness, cuts footstep files into single steps,
// and plays sounds from places (distance, pan, muffled through walls). It knows nothing about the game
// beyond where the keeper stands and which tile is in which room. What plays when: sound.ts and sound/*.

import type { Game } from "../game.js";
import { ROOM_LINKS, ROOM_OF_TILE, SOUNDS, SOUND_TUNING as T, type SoundDef } from "../data.js";
import { dist, type Vec } from "../world.js";

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let game: Game | null = null;
const buffers = new Map<string, AudioBuffer>(); // file, or "file#n" for the nth slice of a sliced file
const evenOut = new Map<string, number>(); // buffer key -> gain that brings it to T.targetLoudness
const slices = new Map<string, string[]>(); // sliced file -> its slice keys
const ringsFor = new Map<string, number>(); // buffer key -> seconds until it has faded to near silence
let loading = false;

export function attach(g: Game): void {
  game = g;
  buildRooms(g);
}

export function ready(): boolean {
  return !!ac && ac.state === "running" && buffers.size > 0;
}

export function now(): number {
  return ac?.currentTime ?? 0;
}

// ---------------------------------------------------------------------------
// Loading

/** standalone.html carries the files inside itself (data URLs); the normal build fetches them. */
function urlFor(path: string): string {
  const packed = (window as unknown as { __INN_ASSETS?: Record<string, string> }).__INN_ASSETS;
  return packed?.[path] ?? path;
}

/** RMS of each `ms`-long window of the first channel. */
function windows(buf: AudioBuffer, ms: number): number[] {
  const data = buf.getChannelData(0);
  const win = Math.max(1, Math.floor((buf.sampleRate * ms) / 1000));
  const out: number[] = [];
  for (let i = 0; i + win <= data.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += data[j] * data[j];
    out.push(Math.sqrt(s / win));
  }
  return out;
}

/** Loudness of the audible part of a sound (silence between sounds doesn't count). */
function loudness(buf: AudioBuffer): number {
  const loud = windows(buf, 50).filter((r) => r > 0.003); // about -50 dB
  return loud.length ? loud.reduce((a, b) => a + b, 0) / loud.length : 0;
}

/** Cut a file holding several separate sounds (footsteps) at its quiet gaps. */
function slice(buf: AudioBuffer): AudioBuffer[] {
  const ms = 10;
  const rms = windows(buf, ms);
  const thr = Math.max(0.002, Math.max(...rms) * 0.12);
  const spans: [number, number][] = [];
  let start = -1, quiet = 0;
  rms.forEach((r, i) => {
    if (r >= thr) { if (start < 0) start = i; quiet = 0; }
    else if (start >= 0 && ++quiet >= 6) { spans.push([start, i - quiet + 1]); start = -1; quiet = 0; }
  });
  if (start >= 0) spans.push([start, rms.length]);
  const sr = buf.sampleRate;
  return spans
    .filter(([a, b]) => (b - a) * ms >= 40)
    .map(([a, b]) => {
      const from = Math.max(0, Math.floor(((a * ms - 15) * sr) / 1000));
      const to = Math.min(buf.length, Math.floor(((b * ms + 60) * sr) / 1000));
      const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: to - from, sampleRate: sr });
      const fadeIn = Math.floor(0.004 * sr), fadeOut = Math.floor(0.03 * sr);
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const src = buf.getChannelData(c).subarray(from, to);
        const dst = out.getChannelData(c);
        dst.set(src);
        for (let i = 0; i < fadeIn && i < dst.length; i++) dst[i] *= i / fadeIn;
        for (let i = 0; i < fadeOut && i < dst.length; i++) dst[dst.length - 1 - i] *= i / fadeOut;
      }
      return out;
    });
}

/** Drop the silence before a sound starts (keeping 5 ms), so it plays right when asked. */
function trimStart(buf: AudioBuffer): AudioBuffer {
  const ms = 5;
  const rms = windows(buf, ms);
  const thr = Math.max(0.002, Math.max(...rms) * 0.05);
  const first = rms.findIndex((r) => r >= thr);
  const from = Math.floor((Math.max(0, first * ms - 5) * buf.sampleRate) / 1000);
  if (first <= 1) return buf;
  const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: buf.length - from, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(from));
  return out;
}

function store(key: string, buf: AudioBuffer): void {
  const w = windows(buf, 10);
  const thr = Math.max(0.002, Math.max(...w) * 0.03); // about 30 dB below its peak
  let last = w.length - 1;
  while (last > 0 && w[last] < thr) last--;
  ringsFor.set(key, ((last + 1) * 10) / 1000);
  const l = loudness(buf);
  evenOut.set(key, l > 0 ? Math.min(6, Math.max(0.25, T.targetLoudness / l)) : 1);
  buffers.set(key, buf);
}

async function loadAll(): Promise<void> {
  if (!ac || loading) return;
  loading = true;
  const defs = Object.values(SOUNDS);
  const sliced = new Set(defs.filter((d) => d.slice).flatMap((d) => d.files));
  const trimmed = new Set(defs.filter((d) => d.trim).flatMap((d) => d.files));
  const paths = new Set(defs.flatMap((d) => d.files));
  await Promise.all([...paths].map(async (path) => {
    try {
      const res = await fetch(urlFor(path));
      let buf = await ac!.decodeAudioData(await res.arrayBuffer());
      if (trimmed.has(path)) buf = trimStart(buf);
      if (sliced.has(path)) {
        const keys = slice(buf).map((b, i) => { const k = `${path}#${i}`; store(k, b); return k; });
        slices.set(path, keys);
      } else store(path, buf);
    } catch {
      // Couldn't load or decode (old browser, opened oddly): that sound is simply missing.
    }
  }));
}

/** The buffers a sound can pick from. */
function choices(def: SoundDef): string[] {
  return def.files.flatMap((f) => (def.slice ? slices.get(f) ?? [] : buffers.has(f) ? [f] : []));
}

// ---------------------------------------------------------------------------
// Switching on, muting

export function unlockAudio(): void {
  if (ac) { if (ac.state === "suspended" && !game?.paused) void ac.resume(); return; }
  try {
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ac.destination);
  } catch { ac = null; }
  void loadAll();
}

export function suspend(): void { void ac?.suspend(); }
export function resume(): void { void ac?.resume(); }

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  if (ac && master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.03);
  return muted;
}

export function vary(n: number, amount: number): number {
  return n * (1 + (Math.random() * 2 - 1) * amount);
}

/** For the synthesised placeholders: the context and where to plug in. */
export function output(): { ac: AudioContext; out: GainNode } | null {
  return ac && master ? { ac, out: master } : null;
}

// ---------------------------------------------------------------------------
// Where sounds carry: which room each tile is in, and how many rooms apart two rooms are.

let roomGrid: (string | null)[][] = [];
const roomSteps = new Map<string, number>(); // "a|b" -> rooms apart

function buildRooms(g: Game): void {
  const { w: W, h: H, tiles } = g.world;
  const base = tiles.map((row) => row.map((t) => ROOM_OF_TILE[t.ch] ?? null));
  // Furniture, doors and walls take the most common room around them.
  roomGrid = base.map((row, y) => row.map((r, x) => {
    if (r || x >= W || y >= H) return r;
    const count = new Map<string, number>();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = base[y + dy]?.[x + dx];
      if (n) count.set(n, (count.get(n) ?? 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }));
  for (const from of new Set(ROOM_LINKS.flat())) {
    const seen = new Map([[from, 0]]);
    const queue = [from];
    while (queue.length) {
      const r = queue.shift()!;
      for (const [a, b] of ROOM_LINKS) {
        const next = a === r ? b : b === r ? a : null;
        if (next && !seen.has(next)) { seen.set(next, seen.get(r)! + 1); queue.push(next); }
      }
    }
    for (const [to, n] of seen) roomSteps.set(`${from}|${to}`, n);
  }
}

export function roomAt(p: Vec): string | null {
  return roomGrid[Math.floor(p.y)]?.[Math.floor(p.x)] ?? null;
}

function throughWalls(a: string | null, b: string | null): number {
  const steps = a && b ? roomSteps.get(`${a}|${b}`) ?? 9 : 0;
  return steps === 0 ? 1 : steps === 1 ? T.nextRoom : 0;
}

/** How loud a sound is where the keeper stands, and how far left or right. */
export function placement(at: Vec | null, def: SoundDef): { gain: number; pan: number } {
  if (!game) return { gain: 1, pan: 0 };
  const k = game.keeper.pos;
  if (def.room) return { gain: throughWalls(def.room, roomAt(k)), pan: 0 };
  if (!at) return { gain: 1, pan: 0 };
  const d = dist(at, k);
  let gain = d <= T.fullVolumeWithin ? 1 : Math.max(T.quietest, 1 - (d - T.fullVolumeWithin) / T.fadeOverTiles);
  if (!def.heardEverywhere) gain *= throughWalls(roomAt(at), roomAt(k));
  const pan = Math.max(-1, Math.min(1, (at.x - k.x) / T.panWidth)) * 0.8;
  return { gain, pan };
}

// ---------------------------------------------------------------------------
// Voices: a sound playing from somewhere. Loops with several files take turns, crossfading.

interface Source { src: AudioBufferSourceNode; gain: GainNode; endsAt: number; rings: number }
export interface Voice {
  key: string;
  def: SoundDef;
  at: Vec | null;
  rate: number;
  level: GainNode; // fades in and out
  spatial: GainNode;
  panner: StereoPannerNode | null;
  current: Source | null;
  turns: boolean; // a loop of several files, played one after another
  stopped: boolean;
}
const voices = new Set<Voice>();
const TURN_FADE = 0.25; // seconds of crossfade when a looping sound moves on to its next file

function startSource(v: Voice, when: number, offsetRandom: boolean, fadeIn: number): Source | null {
  const list = choices(v.def);
  if (!list.length || !ac) return null;
  // Taking turns: avoid the same file twice in a row when there's a choice.
  const prev = v.current?.src.buffer;
  const pool = list.length > 1 && prev ? list.filter((k) => buffers.get(k) !== prev) : list;
  const keyPick = pool[Math.floor(Math.random() * pool.length)];
  const buf = buffers.get(keyPick)!;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = v.def.loop === true && !v.turns;
  src.playbackRate.value = vary(v.rate, v.def.pitch);
  const gain = ac.createGain();
  const target = (evenOut.get(keyPick) ?? 1) * vary(v.def.volume, 0.1);
  if (fadeIn > 0) { gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(target, when + fadeIn); }
  else gain.gain.setValueAtTime(target, when);
  src.connect(gain).connect(v.level);
  // Loops start somewhere in the middle, so two pots never sound in step.
  const offset = offsetRandom ? Math.random() * buf.duration * 0.9 : 0;
  src.start(when, offset);
  const rate = src.playbackRate.value;
  const s: Source = { src, gain, endsAt: when + (buf.duration - offset) / rate, rings: (ringsFor.get(keyPick) ?? buf.duration) / rate };
  src.onended = () => { if (!src.loop && (v.stopped || !v.turns) && v.current === s) voices.delete(v); };
  return s;
}

export interface PlayOptions { rate?: number; fadeInMs?: number }

/** Play a sound from a place (null: from nowhere in particular). Null if it isn't loaded. */
export function play(key: string, at: Vec | null, opts: PlayOptions = {}): Voice | null {
  if (!ac || !master) return null;
  const def = SOUNDS[key];
  if (!def || !choices(def).length) return null;
  const level = ac.createGain();
  const t = ac.currentTime;
  const fade = (opts.fadeInMs ?? 0) / 1000;
  if (fade > 0) { level.gain.setValueAtTime(0, t); level.gain.linearRampToValueAtTime(1, t + fade); }
  const spatial = ac.createGain();
  const { gain, pan } = placement(at, def);
  spatial.gain.value = gain;
  let panner: StereoPannerNode | null = null;
  try { panner = ac.createStereoPanner(); panner.pan.value = pan; } catch { panner = null; }
  level.connect(spatial);
  if (panner) spatial.connect(panner).connect(master); else spatial.connect(master);
  const v: Voice = { key, def, at, rate: opts.rate ?? 1, level, spatial, panner, current: null,
    turns: def.loop === true && choices(def).length > 1, stopped: false };
  v.current = startSource(v, t, def.loop === true, 0);
  voices.add(v);
  return v;
}

/** Fade a sound out and stop it (so cutting it off doesn't click). */
export function stop(v: Voice | null | undefined, fadeMs = 70): void {
  if (!v || !ac || v.stopped) return;
  v.stopped = true;
  const t = ac.currentTime;
  v.level.gain.cancelScheduledValues(t);
  v.level.gain.setValueAtTime(v.level.gain.value, t);
  v.level.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
  try { v.current?.src.stop(t + fadeMs / 1000 + 0.02); } catch { /* already stopped */ }
  setTimeout(() => voices.delete(v), fadeMs + 100);
}

/** How long a voice's sound rings before it has faded to near silence (seconds). */
export function ringsOut(v: Voice | null): number {
  return v?.current?.rings ?? 0;
}

/** How many of this sound are playing right now. */
export function playingCount(key: string): number {
  let n = 0;
  for (const v of voices) if (v.key === key && !v.stopped) n++;
  return n;
}

/** Every frame: follow the keeper (volume, pan), and move turn-taking loops on to their next file. */
export function updateVoices(): void {
  if (!ac) return;
  const t = ac.currentTime;
  for (const v of voices) {
    const { gain, pan } = placement(v.at, v.def);
    v.spatial.gain.setTargetAtTime(gain, t, 0.12);
    v.panner?.pan.setTargetAtTime(pan, t, 0.12);
    if (v.turns && !v.stopped && v.current && v.current.endsAt - t < TURN_FADE + 0.1) {
      const old = v.current;
      const when = Math.max(t, old.endsAt - TURN_FADE);
      old.gain.gain.setValueAtTime(old.gain.gain.value, when);
      old.gain.gain.linearRampToValueAtTime(0, when + TURN_FADE);
      v.current = startSource(v, when, false, TURN_FADE) ?? old;
    }
  }
}

// For checking from the browser console.
const w = window as unknown as Record<string, unknown>;
w.innSoundsLoaded = () => buffers.size;
w.innSoundsPlaying = () => [...voices].filter((v) => !v.stopped).map((v) => ({ key: v.key, gain: +v.spatial.gain.value.toFixed(3) }));
w.innDurations = () => Object.fromEntries([...buffers].map(([k, b]) => [k.split("/").pop(), +b.duration.toFixed(2)]));
w.innSlices = () => Object.fromEntries([...slices].map(([f, k]) => [f.split("/").pop(), k.length]));
