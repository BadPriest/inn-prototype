# Headless checks

Ways to see the game and test it without a person at the keyboard. They all run the built single file, so build first:

```sh
node tools/build.mjs --no-bump     # compiles src/ and packs standalone.html; keeps the build number
```

Chrome is expected at `C:/Program Files/Google/Chrome/Application/chrome.exe`; set `CHROME` to use another.

## Screenshots and scripted steps: `run.mjs`

```sh
node tools/check/run.mjs tools/check/steps/screens.json --new-game
```

Screenshots land in `tools/check/out/` (not kept in git). Options:

| Option | Does |
| --- | --- |
| `--new-game` | Clicks through the welcome, the location and the inn, and skips the tutorial |
| `--inn medium` | With `--new-game`: the big tavern instead of the small one |
| `--pad` | Stands in a DualSense; steps press its buttons through `window.__pad` |
| `--ui 1.6` | The UI size setting |
| `--size 1920x1080` | The window |
| `--out dir` | Where screenshots go |

A steps file is a JSON list, run in order:

| Step | Does |
| --- | --- |
| `{ "eval": "js" }` | Runs in the page and is awaited; a returned value prints as `eval: …` |
| `{ "evalFile": "tools/check/crawl.js" }` | The same, from a file |
| `{ "wait": 500 }` | Waits, in milliseconds |
| `{ "key": "Escape", "code": "Escape" }` | A key press |
| `{ "cdp": "Input.dispatchKeyEvent", "params": { … } }` | Any DevTools Protocol call; use it to hold a key down, as `screens.json` does with Alt for Innsight |
| `{ "shot": "name" }` | A screenshot, `out/name.png` |

From a step, the game is `window.game`, and any module can be imported by its path under `src/`, as compiled:
`await import('inn:ui/menu.js')`. These are the same module instances the game runs, so opening a screen from a step
opens it in the game (`(await import('inn:ui/desk.js')).openShop(window.game)`).

The game reads the controller and the keys every frame, so state set from a step that input also sets (Innsight held,
for one) is overwritten on the next frame. Press real keys with `cdp` `Input.dispatchKeyEvent` instead.

`steps/screens.json` opens the desk, the shop, supplies, a stove's Manage tab, Skills and Innsight, and shoots each.

## The controller crawl: `crawl.mjs`

```sh
node tools/check/crawl.mjs
```

On every card screen (the desk and its screens, Skills tabs, the larder, every stove's Manage tab and every recipe and
cook screen), at UI sizes 1, 1.6 and 2, with a stand-in DualSense: D-pad down from the first card must land lower each
step until it stops, every card below must be reachable, up must come back, and a wide screen must have at most three
buttons, each with its controller glyph. It prints `no problems` per size, or each problem by screen. Run it after
changing any menu or card screen. The checks themselves are in `crawl.js`.

## Timing a frame

Headless Chrome draws without a graphics card and waits for the display, so frame rates there say little. To compare
the cost of drawing, call the renderer directly from a step and force the canvas to finish:

```js
const R = await import('inn:ui/render-iso.js');
const cv = document.querySelector('canvas'), ctx = cv.getContext('2d');
const v = R.computeIsoView(cv, window.game, 34, 0, 1, 0);
const t = performance.now();
for (let i = 0; i < 40; i++) { R.drawIso(ctx, window.game, v, null, null); ctx.getImageData(0, 0, 1, 1); }
return (performance.now() - t) / 40;
```

It understates anything the graphics card would do slowly (canvas blend modes such as `saturation` fall back to the
CPU on a real GPU), so treat a small difference here as possibly a large one on a player's machine.

## The autopilot keeper: `../sim/run.mjs`

```sh
node tools/sim/run.mjs --days 7 [--level cheap|fair|dear] [--keeper random|learner]
```

Plays the real game for some days (cooking, serving, ordering supplies) and prints the money by day, guests by hour,
how often serves Delight, wear, and how far the equipment has worn in. Use it to check a change to the economy or to
guests against a week of play.
