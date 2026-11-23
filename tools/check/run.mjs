// Drive the built game (standalone.html) in headless Chrome and take screenshots.
//   node tools/check/run.mjs <steps.json> [--out dir] [--size 1600x900] [--new-game] [--pad] [--ui 1.6] [--inn small|medium]
// Steps, run in order:
//   { "eval": "js" }            run in the page (awaited); a returned value is printed as "eval: …"
//   { "evalFile": "path.js" }   the same, from a file (relative to the repo)
//   { "wait": ms }
//   { "key": "Escape", "code": "Escape" }   a key press
//   { "cdp": "Method", "params": {} }        any Chrome DevTools Protocol call (Input.dispatchKeyEvent for a held key)
//   { "shot": "name", "clip"?: {x,y,width,height} }   a PNG in the out folder
// --new-game clicks through the welcome, the location and the inn (small unless --inn), and skips the tutorial.
// --pad stands in a DualSense: window.__pad.buttons[i] can be pressed from a step (see crawl.js).
// Needs a fresh standalone.html (node tools/build.mjs --no-bump) and Chrome (CHROME=path to override).
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, d) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : d; };
const stepsFile = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.match(/^--(out|size|ui|inn)$/));
const steps = stepsFile ? JSON.parse(readFileSync(resolve(stepsFile), "utf8")) : [];
const outDir = resolve(opt("out", join(root, "tools", "check", "out")));
mkdirSync(outDir, { recursive: true });

const PAD = "window.__pad={connected:true,mapping:'standard',index:0,id:'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',timestamp:0,buttons:Array.from({length:18},()=>({pressed:false,value:0})),axes:[0,0,0,0]};navigator.getGamepads=()=>[window.__pad];";
const NO_PAD = "navigator.getGamepads=()=>[];";
const NEW_GAME = `(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const click=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.toLowerCase().includes(t))?.click();
click('start game');await sl(600);click('settle here');await sl(400);
${opt("inn") === "medium" ? "[...document.querySelectorAll('[data-pick]')].find(b=>/big tavern/i.test(b.textContent))?.click();await sl(300);" : ""}
click('move in');await sl(900);[...document.querySelectorAll('button')].find(b=>/skip it/i.test(b.textContent))?.click();await sl(300);return 'new game: '+window.game.inn})()`;

const before = [
  { cdp: "Page.enable" },
  { cdp: "Page.addScriptToEvaluateOnNewDocument", params: { source: flag("pad") ? PAD : NO_PAD } },
  { eval: "localStorage.clear();location.reload();1" },
  { wait: 5000 },
  ...(flag("new-game") ? [{ eval: NEW_GAME }] : []),
  ...(opt("ui") ? [{ eval: `document.documentElement.style.setProperty('--ui','${opt("ui")}');1` }, { wait: 300 }] : []),
];

const chromePath = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "inn-check-"));
const port = 9300 + Math.floor(Math.random() * 500);
const [w, h] = opt("size", "1600x900").split("x");
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
  "--autoplay-policy=no-user-gesture-required", "--mute-audio", pathToFileURL(join(root, "standalone.html")).href], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = [];
for (let i = 0; i < 150 && !targets.find((t) => t.type === "page"); i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* not up yet */ }
  await sleep(200);
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === "Runtime.exceptionThrown") console.log("PAGE ERROR:", JSON.stringify(m.params.exceptionDetails?.exception?.description ?? m.params).slice(0, 400));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
await sleep(1000);

for (const s of [...before, ...steps]) {
  const code = s.evalFile ? readFileSync(resolve(root, s.evalFile), "utf8") : s.eval;
  if (code) {
    const r = await send("Runtime.evaluate", { expression: code, returnByValue: true, awaitPromise: true });
    const v = r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description;
    if (v !== undefined && v !== 1) console.log("eval:", typeof v === "string" ? v : JSON.stringify(v));
  }
  if (s.cdp) { const r = await send(s.cdp, s.params ?? {}); if (r.error) console.log("cdp error:", JSON.stringify(r.error)); }
  if (s.wait) await sleep(s.wait);
  if (s.key) for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: s.key, code: s.code, text: type === "keyDown" && s.key.length === 1 ? s.key : undefined });
  if (s.shot) {
    const r = await send("Page.captureScreenshot", { format: "png", ...(s.clip ? { clip: { ...s.clip, scale: 1 } } : {}) });
    writeFileSync(join(outDir, `${s.shot}.png`), Buffer.from(r.result.data, "base64"));
    console.log("shot:", join(outDir, `${s.shot}.png`));
  }
}
ws.close();
chrome.kill();
await sleep(400);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
process.exit(0);
