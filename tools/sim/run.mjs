// The autopilot keeper: runs the real game for some days in headless Chrome and reports the money,
// the guests by hour, and how often serves delight.
//   node tools/sim/run.mjs [--days 7] [--level cheap|fair|dear] [--keeper random|learner] [--walk 1] [--location mountainside] [--season winter] [--json out.json]
// Needs a fresh standalone.html (node tools/build.mjs --no-bump) and Chrome (CHROME=path to override).
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(" ") || true]; }));
const days = Number(args.days ?? 7);
const opts = { level: args.level ?? "fair", keeper: args.keeper ?? "random", walk: Number(args.walk ?? 1) };
if (args.menu) opts.menu = String(args.menu).split(",");

const chromePath = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "inn-sim-"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--mute-audio",
  "--window-size=1280,800", pathToFileURL(join(root, "standalone.html")).href], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets = [];
for (let i = 0; i < 150 && !targets.find((t) => t.type === "page"); i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* not up yet */ }
  await sleep(200);
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); });
const evaluate = (expression) => new Promise((r) => {
  const id = ++nextId;
  pending.set(id, (m) => r(m.result?.result?.value ?? m.result?.exceptionDetails?.exception?.description));
  ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
});

await sleep(5000);
await evaluate(`(async () => {
  navigator.getGamepads = () => [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (t) => [...document.querySelectorAll("button")].find((b) => b.textContent.toLowerCase().includes(t))?.click();
  click("start game"); await wait(600);
  const place = ${JSON.stringify(String(args.location ?? "").toLowerCase())};
  if (place) { [...document.querySelectorAll("[data-pick]")].find((b) => b.textContent.toLowerCase().includes(place))?.click(); await wait(300); }
  click("settle here"); await wait(400); click("move in"); await wait(900);
})()`);
if (args.season) console.log(await evaluate(`(() => {
  const g = window.game;
  g.calendarStart = ["spring", "summer", "autumn", "winter"].indexOf(${JSON.stringify(args.season)});
  return "at " + g.loc.name + ", " + g.date.season;
})()`));
await evaluate(`window.SIM_OPTS = ${JSON.stringify(opts)}; 1`);
console.log(await evaluate(readFileSync(join(here, "keeper.js"), "utf8")));

const results = [];
for (let d = 0; d < days; d++) {
  const r = await evaluate("simDay().then((r) => JSON.stringify(r)).catch((e) => 'ERR ' + e.stack)");
  if (typeof r !== "string" || r.startsWith("ERR")) { console.log(r); break; }
  results.push(JSON.parse(r));
}
const seasoning = await evaluate("JSON.stringify(Object.fromEntries(Object.entries(window.game.seasoning).map(([k, v]) => [window.game.world.slot(k)?.gear?.name ?? window.game.world.furniture.find((f) => f.id === k)?.name ?? k, v])))");
ws.close();
chrome.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }

const pad = (v, n) => String(v).padStart(n);
const sh = (pence) => `${(pence / 10).toFixed(1)}s`;
console.log("\nday  guests served walked  taken  tips  supplies upkeep  wear(messy)  purse      delight  snow  roads");
for (const r of results) {
  const o = r.outcomes;
  console.log(`${r.wd} ${pad(r.day, 2)} ${pad(r.arrivals, 5)} ${pad(r.served, 6)} ${pad(r.leftEarly, 6)} ${pad(sh(r.taken), 7)} ${pad(sh(r.tips), 6)} ${pad(sh(r.supplies), 8)} ${pad(sh(r.upkeep), 6)} ${pad(sh(r.wear), 6)}(${pad(r.messy, 2)})  ${pad(sh(r.purse0), 6)}→${pad(sh(r.purse1), 7)} ${pad(Math.round((100 * o.DELIGHT) / Math.max(1, r.served)), 4)}%  ${pad(r.snow ? Math.round(r.snow / 60) + "h" : "", 4)}  ${r.roads ?? ""}`);
}
if (results.length) {
  const k = results.length;
  const net = (results[k - 1].purse1 - results[0].purse0) / k;
  const served = results.reduce((a, r) => a + r.served, 0), delights = results.reduce((a, r) => a + r.outcomes.DELIGHT, 0);
  console.log(`\nworn in: ${seasoning}`);
  console.log(`\nnet ${sh(net)} a day · keeper busy ${Math.round(results.reduce((a, r) => a + r.util, 0) / k)}% of opening hours · delight ${Math.round((100 * delights) / Math.max(1, served))}% of serves`);
  console.log("\nhour  guests  away  in room  delight   (averaged over the days)");
  for (let h = 6; h < 30; h++) {
    const hh = h % 24;
    const a = (f) => results.reduce((s, r) => s + f(r.byHour[hh]), 0) / k;
    if (a((x) => x.inRoom + x.arrivals + x.turnedAway) === 0) continue;
    const sv = a((x) => x.served);
    console.log(`${pad(hh, 2)}:00 ${pad(a((x) => x.arrivals).toFixed(1), 6)} ${pad(a((x) => x.turnedAway).toFixed(1), 5)} ${pad(a((x) => x.inRoom).toFixed(1), 8)} ${pad(sv ? Math.round((100 * a((x) => x.delights)) / sv) + "%" : "", 8)}`);
  }
  const dl = (r) => Math.round((100 * r.outcomes.DELIGHT) / Math.max(1, r.served));
  console.log(`\ndelight by day: ${results.map(dl).join("% ")}%`);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify({ opts, results }, null, 1));
process.exit(0);
