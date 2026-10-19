# The lab out, the game in

Agreed with the user on 16 October 2026, on commit 8313e56, from the mocks kept beside the session's notes (`mock/game-mocks.html`, outside the repo). The figures marked estimates are to be tuned after the user plays it.

## Context

The page is still the **lake lab**: a debug panel (`src/lab.ts`; settings read from and written back to the address by
`src/settings.ts`; applied by `apply`/`change` in `src/main.ts`) with a contamination slider, time, view, caustics and
paint buttons, "Drop a pebble", "Reel in", and a frame-time readout (`#stats`). Stages 1 and 2 of `DESIGN.md` (cast,
bite, fight, land) are done and the user found them fun, but the lab starts the lake fully sick, the day never moves,
and nothing a player does changes the lake. The user wants the panel gone and the page to be the game.

The intended outcome: a player opens the page straight onto a sick Duck Pond with a welcome line, goes fishing while
the day runs from dawn round to night and on, and **every fish landed and put in the bucket is cured and clears the
pond a step**, kept in the save, until the pond is clean. That is the smallest slice of stage 3 (the cure) that gives
the removed slider a player's meaning, and a first slice of stage 5 (the day's clock; its end came after, `docs/day.md`).

Mocks (real screenshots, seed 3): `~/Library/Application Support/Claude/side-session-notes/local_1aadb9a7-0359-41ea-a082-399dd985bcfb/mock/game-mocks.html`.
**Chosen by the user, 16 Oct 2026:** straight in with a welcome line (1B), the glow gauge (2B), a line and the gauge
stepping when a fish is cured (3A), and a stepping clock now.

## What replaces each lab lever

| Lever                | For the player                                                                                                                                                                                                                                     | Kept for tests as                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Contamination slider | The cure: each fish stowed lowers it by `1 / CURE.toClean` (12, an estimate); saved as a count of fish cured, so a retuned step re-derives it                                                                                                      | `game.dirt(x)`, setting it directly, as today                                      |
| Time of day          | The game's clock: `timeOfDay` runs on by game time, a day in `CLOCK.daySeconds` (720, an estimate), from dawn, round to midnight, where the day ends (`docs/day.md`); the look steps to the nearest of the four times (`nearestTime` in `look.ts`) | `game.time(name)` sets the clock there; it runs on from it                         |
| View                 | Look (free orbit) and Cast (the Shore view), as now; on a tall screen the Shore view takes the `phone` framing by itself                                                                                                                           | `game.view(name)`, all four views, for the pictures (`half-boat`)                  |
| Caustics, paint      | Gone from the screen; they were comparisons                                                                                                                                                                                                        | the address (`?caustics=off`, `?paint=off`, refused by name otherwise) and the API |
| Drop a pebble        | Kept as play: a tap on the water in look mode already drops one                                                                                                                                                                                    | `game.drop`, `game.dropNear` (the perf gate's splashes)                            |
| Reel in              | Dropped: casting again already reels in (`Game.cast` calls `reelIn`)                                                                                                                                                                               | `game.reelIn()`                                                                    |
| `#stats` readout     | Dropped                                                                                                                                                                                                                                            | `game.measureFrame()`, the perf gate                                               |

**The address stops holding game state.** `dirt`, `time` and `view` leave `Settings`; the address is no longer written
back (`history.replaceState` goes). What stays is the viewer's and the tests': `seed`, `paused`, `rung`, `caustics`,
`paint`. Old links with `dirt=` etc. are ignored (they still open the game).

## What the tests use the lab for, and how they keep it

Measured by grep: almost everything already goes through `window.game`, not the panel.

- `smoke/game.ts` `set(page, scene)` and `STANDARD`: the API (`dirt`, `time`, `view`, `caustics`, `mode`), unchanged,
  so the perf scene, the film scenes and `PICTURES` stay. The clock moves 180 frames by 0.004 of a day, against 0.125
  to the next look, so no picture steps its light.
- `hideOverlays` and five places in `smoke/look.spec.ts` hide `#labPanel`/`#stats`: those ids go; the gauge and the
  welcome line are hidden instead. The existing look pictures must stay **to the pixel**: the check that the removal
  moved nothing.
- `smoke/game.spec.ts`: the controls test (drags `#dirt`, clicks `data-setting`) and the phone panel test are replaced
  (below); the address test is rewritten for what the address still reads.
- `test/settings.test.ts`: cut to `caustics` and `paint`.
- Fuzzer and determinism call `Game.setContamination`/`setTimeOfDay` directly. The fuzzer's random raise of the dirt
  goes (it would break the new rule): it sets a random start once, then only cures. Its time action stays.

## The first playable loop

1. Boot fades straight onto the sick pond at dawn. A welcome line at the top: "Welcome home. The pond's fish are
   glowing: catch them to clean it up." It goes at the first cast, and is not shown again once a fish is cured.
2. Top left, the **glow gauge**: "Duck Pond" and a bar that empties as the pond cleans, read from the save. Cast button
   as now.
3. Cast, bite, strike, fight, land, as now. The catch card says "tap to cure it and put it in the bucket".
4. The tap: the gauge steps down, the water steps clearer at once, a line says "Cured! The pond clears a little." for
   `HEARD_FOR` of game time. Saved.
5. The twelfth: "The Duck Pond is clean!" Fish still come and are caught; the pond stays at 0.
6. The day: every three minutes or so the light steps (dawn, day, dusk, night). At midnight the day ends
   (`docs/day.md`, built after this). The time is not saved: a reload starts at dawn. The water's look and the fish's glow already follow the time.
7. Reload: gauge and water as left.

## Figures, measured or called estimates

- **A cure step costs ~0.5 ms** (measured: 15 `game.dirt` changes, 0.3–0.5 ms each, headless at 1280×800). The frame is
  the same at dirt 1, 0.5, 0 (4.0, 3.7, 4.2 ms): the cure adds nothing to the frame budget.
- **A time change costs 8–12 ms the first time each look is baked** (an environment), then ~0.1 ms (measured, same run).
  So the four are baked once right after `ready` (~30 ms, off the boot figure, measured in the pass), and a step in
  play is the uniform write only: no hitch. Nothing is made each frame: the page compares the look's name each frame
  and calls `light` only when it changes.
- **The light steps, it does not fade.** A blend between looks needs two environments mixed in the renderer, a package
  change; named as a follow-up if the snap feels wrong in play.
- **720 s a day and twelve fish to clean: estimates.** `DESIGN.md` sizes a day at 12–15 minutes of play; the pace
  gate's careful angler lands one fish every ~0.71 game minutes (2.13 for three), so ~9 minutes for twelve, a person
  guessed at 15–25: the pond cleans in a day or two. Tuned after the user plays it.
- **The pace gate may move:** the fight darts less in a cleaner lake, and the angler's three fish now clean it by a
  quarter. Measured in the pass; if it moves it goes through `/gate-moved` as a meant change.

## Plan (one box a part, in build order)

- [x] **1. The panel out.** Delete `src/lab.ts`; `src/settings.ts` keeps `caustics` and `paint` only and is never
      written back; `main.ts`'s `apply` split into the water (on a contamination change), the light (on a time change)
      and the camera (on a view pick), each callable from the API; `index.html` loses `#labPanel`, `#lab`, `#stats` and
      their phone rules. `debug.ts`: `settings()` returns the two kept; `dirt/time/view` keep their signatures.
      Check: `check:quick`; every existing look picture unmoved; `game.spec` updated as above.
- [x] **2. The clock.** `CLOCK = { daySeconds: 720, startsAt: 0.25 }` in `lake.ts`; `Game.step` runs `timeOfDay` on,
      wrapping at one; the page lights the nearest time when its name changes, the four baked after `ready`. Invariant:
      the time of day is in [0, 1). Check: unit tests (a day of steps comes round; `setTimeOfDay` still refuses what is
      not finite); smoke: step past a boundary, the look's time name changes; `measureFrame` across a step.
- [x] **3. The cure.** `CURE = { toClean: 12 }` in `lake.ts`; `Game.stow` counts a cure and sets contamination
      `1 − cured/toClean` (floored at 0), `GameEvents.cured(cured, toClean)`; `Progress` gains `cured: number` (default 0) with `test/saves/cured.json`; the page starts the contamination from the save. Invariant: contamination never
      rises but by `setContamination`. Fuzzer and determinism as above. Check: unit tests seen failing first;
      `fuzz -- --seeds 1-24`.
- [x] **4. The pond on screen.** `src/pondview.ts` (as `fightview.ts`: reads the game each frame, writes the page only on
      change): the gauge, the welcome line, the cured line, the clean line. Check: unit test of its words; smoke: land,
      tap the card, the gauge steps, `state().contamination` steps, `save()` holds it, reload keeps it; the welcome
      goes at the first cast.
- [x] **5. The phone's Shore.** The Shore view takes `VIEWS.phone` when the page is taller than wide (cast mode and
      the start). Check: smoke at 390×844, cast mode's camera is the phone framing.
- [x] **6. The pass.** Pictures added in `smoke/look.spec.ts`: `welcome`, `playing` (the gauge), `clean`, desk and
      phone, every one looked at. Perf before and after (download moves: lab out, pond view in; through `/gate-moved`
      with the byte change in the report). `npm run check`, `fuzz -- --seeds 1-24`, mutation check of each new test.
      `CLAUDE.md` (the lab paragraphs; "a control on the lab" in model features), `DESIGN.md` (stage 3 and 5 slices
      noted) and `docs/game.md` (this plan) updated.

## Edge cases that apply

save (old `{}` save loads `cured: 0`; the twelfth and past it); phone (gauge, lines and Cast button clear of the Reel
button and the fight's bar at 390); the mode (cast, look, the C key, a view picked through the API); the address
(`?paint=maybe` refused; old `?dirt=` ignored); the day (each time on full and lean; midnight's wrap; paused, the clock
stops); the lake's contamination (only down; fully clean); the fish (one caught after clean still respawns and counts).

## Out of scope

The cabin, curing machine and aquarium; fish that look cured; saving the time (the day's end and sleep came after,
`docs/day.md`); a blended sky;
a clock on the HUD; the journal; sound; a menu, options, Continue or New game (so no way yet to reset a cleaned pond:
named as the next thing); the boat as play; more lakes; contamination changing fish numbers.

## What was built, and how it differed from the plan (16 October 2026)

- **Pictures that moved, meant:** the plan said every existing look picture stays to the pixel. The 20 pictures of the
  canvas did. Five page-level pictures (`desk-bite`, `desk-fight`, `phone`, `phone-splash`, `phone-fight`) held the
  folded "Lake lab" bar and moved by exactly that rectangle when it went; `fishing-landed` moved by the catch card's
  longer words; the five and `fishing-landed` then took the pond's gauge. Each diff was measured to sit inside the
  changed element (bounding box, and at most one wobble pixel outside), and the pictures were looked at.
- **Perf, against 8313e56, interleaved on one quiet machine, three runs each:** boot 744/732/745 ms before and
  753/750/758 after; frame 3.58/3.63/3.62 before and 3.61/3.62/3.62 after; download 120,109 to 120,500 bytes gzipped
  (+391, the pond view, clock, cure and framing in and the lab out); scenery unchanged. Baseline written through
  `/gate-moved` (boot 759 to 756, frame 3.54 to 3.60, download 120,109 to 120,500). The four looks bake in 34 to
  38 ms after ready, off the boot figure; a look step in play is 0.6 to 1.4 ms. Frame in every look at sick, half and
  clean: 3.58 to 3.63 ms at 1280x800 and 1.58 to 1.69 ms at 390x844.
- **Pace moved, inside its band:** 2.13 to 1.79 min for three fish (-16%, band is 20%), because the lake cleans as
  the angler fishes. The baseline was not rewritten; the next change to the cure or the fight will push it out.
- **The fuzzer found a real fault** in the cure as first written: a cure set the contamination from the count even where
  the lever had made the lake cleaner, a rise. A cure now takes the lesser of the two (`test/cure.test.ts`).
- **Tests added to the test API:** `time()`, `view()`, `clock(at)`, `looksBaked()`, `drawnDirt()`; `settings()` is the
  two switches only.
- **Not covered:** `scripts/leaks.ts` plays no fishing, so the cure's save growth is not watched there (a count is a
  few digits; its ceiling is 2,000 bytes). The dawn look is dark (the existing look, now the first thing seen).
