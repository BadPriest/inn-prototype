# Travelling Inn prototype

A browser prototype of a cosy inn-keeping game, for finding out whether the loop is fun. Bruno designs it; playtesters
play it at https://inn-prototype.vercel.app (password-protected). The finished game won't be a browser game, so don't
polish browser-only behaviour; do raise anything that would trip up a playtester, and let Bruno decide. Desktop widths
only; phone layout isn't a concern.

## Start here

1. [docs/status.md](docs/status.md): where things stand, what's next, the design agendas waiting on Bruno.
2. The Kanzo board, project `inn` (`inn#N`, open at http://localhost:4242/#inn/N). Every task has what was decided and
   what was built in its comments.
   Put anything left for later on the board, not in notes or chat.
3. [README.md](README.md): the game as it is, and where each part of the code lives. [CHANGELOG.md](CHANGELOG.md):
   what each build changed.

Design is decided by Bruno, in sessions held elsewhere; the results are in `docs/design-session-journal*.md`, the
specs in `docs/specs/`, and the tasks' comments. Where a design call isn't settled there, ask rather than invent.

## Build, check, ship

```sh
npx --yes tsc -p . --noEmit          # typecheck
node tools/build.mjs --no-bump       # data checks, compile src/ to dist/, pack standalone.html; keeps the build number
node tools/check/crawl.mjs           # the controller crawl over every card screen; run after any menu change
node tools/check/run.mjs tools/check/steps/screens.json --new-game   # screenshots, in tools/check/out/
node tools/sim/run.mjs --days 7      # the autopilot keeper: a week's money, guests, Delights, equipment wear
```

See [tools/check/README.md](tools/check/README.md) for scripted steps and screenshots. Look at screenshots in the
isometric view first (the default); top-down still exists (V) and gets every drawing change too.

- `npm run build` bumps the build number: that belongs to shipping only. Use `--no-bump` while working.
- Shipping is the `ship` skill: build number, CHANGELOG entry, README and status page kept current, the board, then
  commit and push. **Pushing `main` deploys to the playtest site.**
- Commit or push only when Bruno asks ("commit", "ship", "deploy"). Stage files by name, never `git add -A` or `-u`.
- Never stage `standalone.html`, `*recovery-codes*`, `.env*`, `assets/sounds/music/`, `assets/sounds/questionable/`,
  or `assets/art/` (Bruno's working material). The skills in `.claude/skills/` are committed; anything else that appears in `.claude/` (local settings) is not.
- `dist/` is committed: commit the compiled `dist/*.js` with the `src/` change. After a build, `git status` shows every
  `dist` file; `git diff --stat` shows the real changes.
- Never put Bruno's name, email or other personal details into anything sent outside (requests, URLs, headers).

## How the code is shaped

- **Game data is JSON** in `data/`, checked against `data/schemas/` by every build, which writes `src/gamedata.gen.ts`
  (never edit that by hand). A new field needs its schema entry and its type in `src/gamedata.ts`. Tuning numbers go
  in data, not in code.
- Other authored content and tuning are in `src/data.ts`. Systems talk through the event bus in `src/core.ts` where
  they can.
- **Before adding or renaming a field, say what reads it and what it changes in play.** If nothing would use it yet,
  don't add it.
- **No explanatory comments.** Clear names instead; a short doc comment only where code can't say it. Data field
  descriptions (schemas) state what the field holds: no plans, status or rationale. Those go on the board.
- Old saves keep loading: anything new in the save gets a default when it's missing (see the load in `src/day.ts`).
- Markdown files use CRLF line endings: edit them with the Edit tool, or handle `\r\n` in scripts.

## Menus and cards

Every menu is one of two shapes from `src/ui/menu.ts` ([docs/specs/ui.md](docs/specs/ui.md)):

- a **list** (`MenuSpec`) for small choices and confirmations;
- a **card screen** (`CardScreen`): a title, a subtitle that says what the screen is for and what to do, tabs (L1/R1,
  Tab), modes (L2/R2), a summary that stays put, the cards, and **at most three buttons: confirm (□, Enter),
  alternative (△, 1) and cancel (○, Backspace)**. Anything else the screen offers is a card on it. Cards are built
  with `src/ui/cards.ts`; the D-pad moves between them by where they sit.

## Writing for players

Game text uses the words players use. Period terms (bill of fare, carter, slip) are fine as names, tied to the familiar
word the first time. Cards lead with the fact that matters now (2 on the menu, 1 point to spend), then a plain line,
then the action. British spelling. The same plain voice in the CHANGELOG.

## Working with Bruno

- Systems first: economy, cooking, guests over story, tutorial or content. Costs can be abstract.
- Nothing punishes: pressure is gentle, failure is funny.
- Set sound volumes yourself, matching the existing mix (the `add-sound` skill explains how); don't hand them back to
  check by ear.
- On the board: move a task to `doing` when you start, comment what you built (numbers, files, how it was checked),
  move it to `review` when done. Bruno marks tasks done; tasks marked human are his.
- Keep [docs/status.md](docs/status.md) current when tasks move or builds ship.

## Environment

Windows, with Git Bash for shell commands (`npx` works as is). Use a scratch folder outside the repo for throwaway
scripts and screenshots.
