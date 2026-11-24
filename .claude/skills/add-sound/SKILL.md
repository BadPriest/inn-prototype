---
name: add-sound
description: Add sounds to the Travelling Inn prototype. Covers sound effects, cues, ambience loops, gramophone records and background music (BGM). Converts Bruno's mp3/wav/etc. files to .opus, files them under assets/sounds, adds the SOUNDS entry in data.ts, hooks them to the game event or state that should play them, and updates the sound spec. Use this whenever Bruno hands over audio files, mentions a sound, sfx, cue, ambience, loop, record, track, song, music or BGM to add, swap or replace, or asks for something in the game to "make a noise" or "have a sound", even if he only drops a file path.
---

# Add a sound

Sound in this prototype is data plus one listener. A file lives in `assets/sounds/`. A row in `SOUNDS` (`src/data.ts`) says how it plays. Something in `src/sound.ts` or `src/sound/*.ts` decides when. Game systems never call sound directly: they emit events or hold state, and the sound side reacts. Keep it that way, so sound stays easy to swap and to turn off.

Read `docs/specs/sound.md` once before starting. It holds the decided rules (what's in scope, the three volume groups, the gramophone) and the "What's in" table you'll update.

## 1. Understand the request

For each file, settle:
- **What it is for**: which moment or state in the game. If Bruno only gave a file, the name usually says it (`sfx-coins-silver`); ask only if it's genuinely unclear.
- **Is it new, a variant, or a replacement?** A variant joins an existing entry's `files` list (the engine picks one at random each time). A replacement swaps the file and keeps the key.
- **Does it pass the spec's rule?** A sound is in scope if it reacts to state the game already has. If it needs new authored content per guest or per line (voices, per-guest barks), or nothing in the game can drive it yet, say so and let Bruno decide, rather than building the missing system on the quiet.

## 2. Convert and file it

Use the bundled script. It converts to opus with the settings the existing files use and reports length, silence at the ends, level, and what the file adds to `standalone.html`:

```bash
node .claude/skills/add-sound/scripts/prepare-sound.mjs "<input>" assets/sounds/<folder>/<name>.opus --kind <kind>
```

ffmpeg is installed via winget. The script finds it even when a shell's PATH doesn't have it yet.

Every sound lives in a folder named for what plays it, which mostly matches the `src/sound/` module that drives it. Nothing sits loose in `assets/sounds/`.

| What | `--kind` | Folder | Plays from |
| --- | --- | --- | --- |
| A cue: the game telling you something (orders, confirm, the bill, serve outcomes, delight, coins) | `cue` | `cues/` | `sound.ts` events |
| A menu: the desk and its papers, ticks, page turns, the pause latch | `cue` | `menus/` | `MenuSound` events → `sound.ts` `menuSound` |
| Rain, wind, thunder, the rain at the windows | `loop` / `sfx` | `weather/` | `sound/weather.ts` |
| The crowd's murmur, the street outside | `loop` | `ambience/` | `sound/crowd.ts`, `weather.ts` |
| The fireplace | `loop` | `fire/` | `sound/fire.ts` |
| The kettle, the stew | `loop` | `cooking/` | `sound/loops.ts` |
| Physical noises of people and things: the door and its bell, pouring, footsteps | `sfx` / `loop` | `foley/` | `sound.ts`, `sound/footsteps.ts` |
| A gramophone record, and the gramophone's own noises (crank, needle, crackle, run-out, winding down) | `record` / `sfx` | `gramophone/` | `sound/gramophone.ts` |
| Background music: tracks for the rotation, a couple of minutes or more | `bgm` | `bgm/` | `sound/bgm.ts` |
| A jingle: a short piece of music for one moment (turning in) | `bgm` | `jingles/` | an event in `sound.ts` |
| Parked: not used, not packed into `standalone.html` | | `questionable/` | |

If a new sound fits none of these, make a folder for it the same way (named for what plays it) and add a row here.

**Names:** lowercase with dashes, saying what it is and ending in a number for variants (`drink-pouring-4.opus`). Loops end in `-loop`. Leave existing files' names alone: renaming churns paths for nothing. A **variant** goes beside its siblings, named like them, so one `files` list stays in one folder with one naming style.

For **records** and **background music**, keep the song's title in the file name (`dawn-in-the-vale.opus`, never a number), and keep the original under its song title in `assets/sounds/music/`: records in `music/in-game-tracks/`, background music in `music/bgm/`. Those hold originals only; the playable `.opus` copies go in `assets/sounds/gramophone/` and `assets/sounds/bgm/` (the `music/` tree is gitignored and left out of the build, so a copy there never reaches the game). If an original turns up in `assets/sounds/bgm/` or `gramophone/`, move it to `music/`: anything left there gets packed into `standalone.html`. A short silence at the start of a song is fine: records drop the needle into it and background music fades in over it.

The script's last line is a ready-made `files` entry to paste.

Act on the script's warnings. For a variant, compare with a sibling first (`--info` on one of the existing files): if they share the quirk, such as a short silent start, the entry already deals with it, so leave it. Flags like `trim` apply to the whole entry, never to one file. Also say if the variant is much longer or shorter than its siblings.
- **Silence at the start** of a cue or effect: give it `trim: true`, which drops it at load, so it lands when asked. Footsteps use `slice` instead.
- **Silence at either end of a loop**: it will gap every time it repeats. Tell Bruno; trimming a loop by hand risks a click at the seam, so a cleaner file is usually better.
- **Touches 0 dB**: may be clipped in the source. Mention it; the engine evens out loudness, so it won't be too loud, but distortion stays.
- **Size**: every file is packed into `standalone.html` (base64, 4/3 of the file). Effects are small. Music adds about 0.7–1.4 MB per track; mention the total if a batch adds more than a few MB.

## 3. The SOUNDS entry (`src/data.ts`)

Add it next to its relatives, with a one-line comment saying what it's for and what decides when it plays. Match the neighbours:

```ts
coinsSilver: { bus: "cue", files: [SND + "cues/sfx-coins-silver.opus"], volume: 0.5, pitch: 0.05, trim: true },
```

- **key**: camelCase, named for the moment, not the file (`coinsTip`, `rainSoftIn`).
- **bus**: `"cue"` for the game telling you something; `"music"` for records, background music and the gramophone's own sounds; leave it out for atmosphere. This picks which pause-screen volume slider controls it, so get it right. For a real-world noise that also carries news (the door bell when someone comes in, a slam when a guest storms out), ask: would a player with Cues at 0 miss information? If yes, it's a cue, like the bell. Say which you chose.
- **volume**: the engine already evens every file to the same loudness (`SOUND_TUNING.targetLoudness`), so this is the *mix level* relative to other sounds, not a fix for a quiet file. Rough ranges in use: cues 0.45–0.6, foley 0.6–0.8, ambience loops 0.2–0.55, records 0.2, background music 0.15. Start from the nearest similar sound. An accent on a familiar sound (a slam against the ordinary close) sits about 0.1–0.2 above its sibling. Name your guess in the hand-over so Bruno checks it by ear.
- **pitch**: random variation per play. Cues and chords 0.01–0.05 (they must stay in tune); foley 0.05–0.07; music 0.
- **flags**:
  - `loop` for ambiences.
  - `heardEverywhere` when it isn't placed in the room: cues the player must hear anywhere, thunder, background music.
  - `trim` for cues and effects that must land on time.
  - `slice` for a file holding several separate hits (footsteps).
  - `room` to tie a loop to a room.
  - `tone: "gramophone"` for records only.

## 4. Make it play

Pick the pattern that fits. Each already has examples to copy:

- **A moment** (something happened): handle an event in the `g.bus.on` switch in `initSound()` (`src/sound.ts`). If no event covers it, add one to the `GameEvent` union in `src/core.ts` and emit it from the system where it happens, as `CoinPaid` and `PourStarted` do. Use `play(key, position | null)`: a position places it in the room, `null` plays it flat.
- **A state that lasts** (cooking, the fire, rain, headcount): a function in a `src/sound/` module, called from `soundscape()` every frame. It starts, crossfades and stops voices as the state changes. See `loops.ts` (simplest), `crowd.ts`, `fire.ts`. Put tuning numbers in a constant in `data.ts`, not in the module.
- **A gramophone record**: the `SOUNDS` entry (`recordX`, `tone: "gramophone"`, `bus: "music"`, `volume: 0.2`, `pitch: 0`) plus a line in `GRAMOPHONE.records` with its title. Nothing else.
- **A jingle**: a piece of music a few seconds long belongs to a moment, not the rotation (its fades would swallow it). Check the length the script reports: anything under about 30 s, ask Bruno which moment it's for. Its `SOUNDS` entry (`bus: "music"`, `heardEverywhere: true`, `pitch: 0`, about 0.25) plays on that moment's event, calling `hushBgm()` first so a background track makes way. See `turnIn`.
- **Background music**: the `SOUNDS` entry (`bgm` + a word from the title, like `bgmDawn`; the song's title as a comment; `bus: "music"`, `heardEverywhere: true`, `volume: 0.15`, `pitch: 0`) plus its key in `BGM.tracks`. `sound/bgm.ts` skips any key whose file isn't loaded.
- **Replacing a synthesised placeholder** (`synth.*` in `sound.ts`: a guest leaving early, the ✦ moment): swap the `synth.x()` call for `play(...)` and remove the unused synth if nothing else calls it. But first check *when* the sound should land; see the next point.
- **When the moment already has a sound**: if the new sound belongs to something that already makes noise (the door, a pour, the fire), hook into that sound's own code, not the bare event. A slam for a guest storming out belongs in `door()`, played instead of the usual close, as the door shuts. `PatronLeft` fires earlier, when the guest reaches the door, so playing it there would give a slam and then a second close a second later. Think through the sequence a listener would hear.

Sounds that can stack up (a table paying at once, a whole table's reactions) should queue or space out, the way `coin()` and `reaction()` do. Ten clinks on the same frame sound like one bad one.

## 5. Check it builds

```bash
npx --yes tsc -p . --noEmit
```

Don't run `npm run build` here: it bumps the build number, and that belongs to shipping. To hear it, `npx --yes tsc -p .` then `npm start`, and trigger the moment (the debug view, the backtick key, can spawn guests and skip time). Tell Bruno how to trigger it, since he's the one listening.

## 6. Write it down

- `docs/specs/sound.md`: add or update the row in **What's in** (layer, what it does, where in the code). If a decision was made about when or how it plays, add it where it belongs with **Decided** and the date. Don't stamp build numbers into rows or headings here: the number isn't settled until shipping, and the CHANGELOG is where builds are recorded. `/ship` writes that entry, so don't write one here either.
- `src/sound.ts` header comment: if you added a `sound/` module.
- `README.md` **Sound** paragraph: only if it's something a player would name (a new kind of sound, not a variant).

## 7. Hand over

Say what was added: files (with the script's report, one line each), keys, what triggers each, and how to hear it. Mention anything off: silence, clipping, size, a judgment call on volume that Bruno should check by ear. Then offer `/ship` to build and deploy it.
