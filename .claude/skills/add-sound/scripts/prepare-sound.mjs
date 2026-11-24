// Convert a sound file to .opus the way the game's files are made, and report what matters about it.
//
//   node prepare-sound.mjs <input> <output.opus> --kind cue|sfx|loop|record|bgm
//   node prepare-sound.mjs <input> --info          (report only, no conversion)
//
// Kinds (bitrates match the existing files: ~160k stereo for effects, ~56k mono for gramophone copies):
//   cue, sfx, loop  48 kHz, 160 kbps (stereo) / 96 kbps (mono source), channels as the source
//   record          48 kHz, 64 kbps mono: the gramophone narrows it to a horn's band anyway
//   bgm             48 kHz, 112 kbps stereo: background music is heard clean
//
// Report: duration, channels, peak and mean level, silence at the start and end (a cue with a gap
// before it lands late; a loop with silence at either end gaps when it repeats), file size, and how much
// it adds to standalone.html (base64, about 4/3 of the file).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

function findTool(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (spawnSync(name, ["-version"], { stdio: "ignore" }).status === 0) return name;
  // winget installs Gyan.FFmpeg under LocalAppData without always putting it on PATH for open shells.
  const pkgs = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages");
  if (existsSync(pkgs)) {
    for (const pkg of readdirSync(pkgs).filter((d) => d.toLowerCase().includes("ffmpeg"))) {
      for (const sub of readdirSync(join(pkgs, pkg))) {
        const p = join(pkgs, pkg, sub, "bin", exe);
        if (existsSync(p)) return p;
      }
    }
  }
  console.error(`${name} not found. Install it: winget install --id Gyan.FFmpeg -e`);
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const infoOnly = args.includes("--info");
const kind = flag("--kind");
const positional = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--kind"));
const [input, output] = positional;
if (!input || (!infoOnly && (!output || !kind))) {
  console.error("usage: node prepare-sound.mjs <input> <output.opus> --kind cue|sfx|loop|record|bgm\n       node prepare-sound.mjs <input> --info");
  process.exit(1);
}
if (!existsSync(input)) { console.error(`not found: ${input}`); process.exit(1); }

const ffmpeg = findTool("ffmpeg");
const ffprobe = findTool("ffprobe");

function probe(file) {
  const out = execFileSync(ffprobe, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels,sample_rate:format=duration", "-of", "json", file], { encoding: "utf8" });
  const j = JSON.parse(out);
  return { channels: j.streams?.[0]?.channels ?? 0, rate: Number(j.streams?.[0]?.sample_rate ?? 0), duration: Number(j.format?.duration ?? 0) };
}

function levels(file, duration) {
  const run = (af) => spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-af", af, "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const vol = run("volumedetect");
  const num = (re, text) => { const m = text.match(re); return m ? Number(m[1]) : null; };
  const peak = num(/max_volume: (-?[\d.]+) dB/, vol);
  // "Silence" is 40 dB under this file's own peak, so a quiet ambience isn't mistaken for silence.
  const floor = Math.max(-70, (peak ?? -10) - 40);
  const log = run(`silencedetect=noise=${floor}dB:d=0.05`);
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const lead = starts.length && starts[0] < 0.01 ? (ends[0] ?? duration) : 0;
  const lastStart = starts.length ? starts[starts.length - 1] : null;
  const tail = lastStart !== null && ends.length < starts.length ? duration - lastStart : 0;
  return { peak, mean: num(/mean_volume: (-?[\d.]+) dB/, vol), lead, tail };
}

function report(file, label) {
  const p = probe(file);
  const l = levels(file, p.duration);
  const bytes = statSync(file).size;
  const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
  console.log(`${label}: ${file}`);
  console.log(`  ${p.duration.toFixed(2)} s · ${p.channels === 1 ? "mono" : p.channels === 2 ? "stereo" : `${p.channels} ch`} · ${p.rate} Hz · ${kb(bytes)} (adds ~${kb(bytes * 4 / 3)} to standalone.html)`);
  console.log(`  peak ${l.peak} dB · mean ${l.mean} dB${l.peak !== null && l.peak >= -0.1 ? "  ⚠ touches 0 dB: may be clipped" : ""}`);
  const warn = [];
  if (l.lead > 0.03) warn.push(`${l.lead.toFixed(2)} s of silence at the start`);
  if (l.tail > 0.3) warn.push(`${l.tail.toFixed(2)} s of silence at the end`);
  console.log(`  ${warn.length ? "⚠ " + warn.join("; ") : "no long silence at either end"}`);
  return { ...p, ...l, bytes };
}

report(input, "source");
if (infoOnly) process.exit(0);

const src = probe(input);
const settings = {
  cue: { ch: src.channels, br: src.channels === 1 ? "96k" : "160k" },
  sfx: { ch: src.channels, br: src.channels === 1 ? "96k" : "160k" },
  loop: { ch: src.channels, br: src.channels === 1 ? "96k" : "160k" },
  record: { ch: 1, br: "64k" },
  bgm: { ch: 2, br: "112k" },
}[kind];
if (!settings) { console.error(`unknown --kind ${kind}`); process.exit(1); }

mkdirSync(dirname(output), { recursive: true });
const enc = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-map", "0:a:0", "-map_metadata", "-1",
  // To mono: average the channels (plain -ac 1 can sum them past 0 dB).
  ...(settings.ch === 1 && src.channels > 1 ? ["-af", `pan=mono|c0=${Array.from({ length: src.channels }, (_, i) => `${(1 / src.channels).toFixed(4)}*c${i}`).join("+")}`] : ["-ac", String(Math.min(2, settings.ch))]),
  "-ar", "48000", "-c:a", "libopus", "-b:a", settings.br, "-vbr", "on", "-application", "audio", output], { encoding: "utf8" });
if (enc.status !== 0) { console.error(enc.stderr); process.exit(enc.status ?? 1); }
const out = report(output, "opus");
if (kind === "loop" && (out.lead > 0.03 || out.tail > 0.3)) console.log("  ⚠ a loop with silence at either end will gap each time it repeats: trim the source, or ask for a cleaner file");
if (kind === "cue" && out.lead > 0.03) console.log("  (cues get trim: true, which drops the leading silence at load, so this is fine)");
const rel = output.replace(/\\/g, "/").split("assets/sounds/")[1];
if (rel) console.log(`  files: SND + "${rel}"`);
