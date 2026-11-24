---
name: ship
description: Ship a build of the Travelling Inn prototype to playtesters. It bumps the build number, builds, checks the change made it into the compiled game, writes the CHANGELOG entry, keeps README and docs/status.md current, updates the Kanzo board, shows Bruno the write-up for an OK, then commits and pushes main (which deploys to Vercel). Use this whenever Bruno says ship, deploy, release, push it, put it up, send it to the playtesters, "new build", "bump the build", or asks to commit finished game changes. Also use it when a change is done and only the build, changelog and deploy are left, even if he doesn't name the skill.
---

# Ship a build

A build is one shippable change to the game, under one build number. It's what playtesters get at https://inn-prototype.vercel.app. Each build leaves a trail that Bruno relies on: the number in-game, a CHANGELOG entry, the status page, and the board. This skill keeps those four in step and gets the build deployed.

Pushing `main` is the deploy. Vercel builds from `src/` (`node tools/build.mjs --no-bump`) on every push, so whatever is committed is what playtesters get.

## 1. See what's being shipped

```bash
git status -s
git diff HEAD --stat
cat BUILD_NUMBER; git show HEAD:BUILD_NUMBER
```

Read the diff of `src/` (and any `assets/`) until you can say in a sentence or two what changed **for someone playing**. That sentence becomes the changelog entry and the commit subject.

Watch for:
- **Work that isn't finished, or belongs to something else.** Several sessions sometimes work in this folder at once. If the diff holds unrelated changes, or a half-done feature (files that are referenced but missing, TODOs, a CHANGELOG entry that says "not deployed" and talks about something you didn't do), list them for Bruno instead of guessing. One build can carry several changes; it shouldn't carry someone's half-made one by accident.
- **Untracked files.** `assets/art/` and similar folders may be Bruno's working material. Only stage untracked files that the shipped code actually uses. Never stage `standalone.html` (gitignored: too big; Vercel builds its own), `.env*`, `*recovery-codes*`, `assets/sounds/music/` or `assets/sounds/questionable/`.
- **Nothing game-changing** (docs only). Then it's not a build: commit with a "Status: …"-style subject and don't touch BUILD_NUMBER.

## 2. Build

The build number goes up once per build, not once per run of the build script:

- If `BUILD_NUMBER` in the working tree equals `HEAD`'s, nothing has claimed a number yet: `npm run build` (bumps, writes `src/version.ts` with today's date, compiles, packs `standalone.html`).
- If it's already ahead of `HEAD`, this build already has its number (someone ran the build earlier): `node tools/build.mjs --no-bump`.

If the TypeScript compile fails, stop and fix it (or report it). Don't ship around it.

## 3. Check the change actually made it in

Build 105 shipped without its change ("meant to bring back the Delight coins, but the edit didn't make it in"). So before writing anything up, pick one or two distinctive strings from the `src/` change (a new constant, a sound key, a log line) and confirm that they're in the compiled output:

```bash
grep -c "theDistinctiveString" dist/<file>.js standalone.html
```

`git diff --stat` should also show the matching `dist/` files changed. If the source change isn't in `dist/`, the build didn't see it: find out why before going on.

After a build, `git status` lists every `dist/*.js` file as modified because tsc rewrites them all; most have no content change. Go by `git diff --stat`, which lists only real changes. The `LF will be replaced by CRLF` warnings on every git command are harmless here (`2>/dev/null` hides them). The Markdown files use CRLF line endings, so edit them with the Edit tool, not with scripts that search for `\n`.

## 4. CHANGELOG.md

Newest entry at the top, right under the `---`. If an entry for this build number already exists (written while the work was in progress), update that one; don't add a second.

```markdown
## Build 107 · Nov 18, 2026 · deployed

### Added
- **Background music.** After 90 seconds with no music, a track plays softly …

### Changed
- **The gramophone picks up where it stopped.** …
```

- Date: today, written `Mon D, YYYY`.
- Deploy state: `deployed`, because this skill pushes in the same commit. If Bruno says not to push, write `not deployed`.
- Sections, in this order, only the ones that apply: Added, Changed, Fixed, Removed.
- Write for a playtester, not a programmer. Say what you'd notice in the game, lead each bullet with the gist in **bold**, and give the numbers that matter (prices, timings, thresholds). Name a constant only when Bruno would tune it. Say "placeholder" when a value is. Debug-menu changes get their own "Debug: …" bullet. Look at the last few entries and match their voice: plain sentences, British spelling, no marketing.
- A build with no player-facing change still gets an honest one-liner (see Build 105).

## 5. README.md, only if the game's description changed

- **What's in**: when a feature lands or changes how something works, change that paragraph or bullet so the README still describes the game as it is now. Don't log history here; that's the changelog's job.
- **Where things are**: when a new source file or folder appears.

Also grep `docs/` (the specs especially) for anything the change made stale: an old value, a renamed sound, a behaviour described the old way. Fix it in the same build.

## 6. docs/status.md, Bruno's one-page "where we are"

- The header line: `Updated <Mon D, YYYY> · build N (deployed) · https://inn-prototype.vercel.app`.
- Add a bullet for this build under a `## Built and deployed (<date>, builds X–Y)` section. Extend today's section if there is one (and widen its build range), otherwise start a new one above the older sections. Keep the bullet to one line in the same compressed style as its neighbours. Lead with `#N` if it's a board task, otherwise with `Build N:` (or `Builds N–M:` when a follow-up refines the same thing, merged into one bullet rather than two). Don't go back and fill in missing bullets for earlier builds unless Bruno asks; the changelog has them.
- If a `## Built, not deployed …` section covers this build, fold it into the deployed section.
- If a task moves (to review, done), move its line accordingly.

## 7. The Kanzo board (project `inn`)

If the build finishes or advances a task (`inn#N`, mentioned in status.md, the diff, or the conversation): add a comment saying what shipped and in which build, and move it to **review** when finished. Bruno marks tasks done himself. A change with no task doesn't need one.

## 8. Show Bruno, and wait for his OK

Bruno wants to see the write-up before anything is pushed. Show it compactly:

- the build number and the commit subject
- the CHANGELOG entry as written
- the status.md bullet
- any README changes (one line each)
- the files to be committed, plus anything you're deliberately **leaving out** and why
- any doubts from step 1

Then stop and wait. If he asks for changes, make them and show the changed parts again. "OK", "go", "ship it" or similar means go on.

## 9. Commit and push

Stage by name: the `src/`, `dist/` and asset files of this change, `BUILD_NUMBER`, `src/version.ts`, `dist/version.js`, `CHANGELOG.md`, and `README.md`/`docs/` if touched. Don't use `git add -A`.

Commit subject: one plain sentence about what changed in the game, the way earlier commits read ("Tips are paid when a guest leaves, all at once; forfeited on a walkout"). No "Build N:" prefix and no `feat:`-style tags. End the message with the attribution line from the session's instructions.

```bash
git commit -F <message-file>
git push origin main
```

If the push is rejected (the remote moved on), don't force it. Fetch, show Bruno what's new on the remote, and ask.

## 10. Confirm it's live

Vercel takes about 20–30 s. Check the newest production deployment:

```bash
npx --yes vercel ls inn-prototype 2>&1 | head -6
```

Wait for the top row to show `● Ready` and an age of a minute or so. Poll a few times with a pause between, not a tight loop. If it shows `Error`, run `npx --yes vercel inspect <url> --logs` and report what broke.

Finish with a short report: the build number, that it's live at https://inn-prototype.vercel.app (Bruno has the password), the commit hash, and any board tasks moved.
