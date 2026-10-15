# The water moves when something lands in it: the spec

Agreed facts hold on ooerfish `fc738ce` and artshape-render `v0.43.0` (`d950981`).
Once agreed, this file is copied to `ooerfish/docs/splash.md` and its boxes are
ticked there as each part lands. _Guess_ marks what was not measured.

## Context

A splash today draws three perfect white rings (`src/ripples.ts`,
`src/ripplesdraw.ts`) and a hundred droplets (`splashBurst`). Against the
cured lake's bright, see-through water they read as circles painted on it. The
user wants the water itself seen to move. From the sheet of 15 Oct
(side-session notes `splash/`: today, A painted and broken, B in the surface,
C surface with lift and crown) **the user chose B**: no rings drawn; each
splash is a train of ripples in the water's own normal, so it bends the mirror,
the bed seen through the water and the light, and nothing white is painted.
The renderer cannot take ripples today (`ClearWater` has no such input), so
the shader work is an option in artshape-render whose default draws v0.43.0 to
the pixel, released and pinned, as the crystal-water parts were.

## What

- A pebble or a lure landing on the water sends out rings of ripples read by
  the surface itself: the reflection and the bed under it waver as each ring
  passes, the rings spread at about 3 units (30 cm) a second, lengthen into a
  train behind their front, fade with age and spreading, and are gone by
  3.5 s. A lure's are smaller than a pebble's (by the square root of the
  size, as now).
- A ring is never finer than 6 pixels on the screen, so a lure's rings read
  from the Shore view 60 units off, broader there than near the camera.
- No white rings are drawn. The droplets are fewer and finer (the mock's
  burst: a third the count, 0.6 of the rise, half the spread, 0.55 the size,
  0.7 s).
- The ripples move only the normal, never the height: the bobber, the lure,
  the line and every invariant about the water's level are as they were.
- Figures are the mock's, which the user saw: wavelength 0.5 units at size 1,
  speed 3 units/s, train 0.5 + 0.6 × age units, life 3.5 s, slope strength
  2.5, least 6 px.

## Where it stands now (measured on the mock, 15 Oct)

- The mock's shader loop (12 slots, early `continue` outside the ring's band)
  was not timed. Cost _guess_: under 0.1 ms a frame at 12 live, against a
  frame of about 3.6 ms and a budget of 8.
- Download: the shader adds perhaps 1 kB gzipped and `ripplesdraw.ts` goes,
  _guess_; held to the byte by `perf` and written again with the reason.

## Acceptance criteria

1. **Package, default unchanged:** with no ripples set and the option at its
   default, the clear water draws v0.43.0 to the pixel
   (`cleargolden.gpu.test.ts`, run before the first change and after the last).
2. **Package, the option:** `renderer.setRipples(data, count)` takes up to
   `RIPPLE_SLOTS` (12) ripples of `(x, y, age, size)`; more than the slots are
   refused by count (the first 12 kept, the return says so), non-finite values
   refused by name. The shape is `ClearWater` options `rippleStrength`
   (default 0 = none), `rippleWavelength`, `rippleSpeed`, `rippleTrain`,
   `rippleGrowth`, `rippleLife`, `ripplePixels`; lengths given in millimetres
   by default and resolved by `resolveClear`, as the other lengths are. Packing
   and refusals held by `clear.test.ts`.
3. **Package, it draws what it is for** (a new `clearripples.gpu.test.ts`): a
   ripple bends the water within its ring and nowhere outside it; nothing at
   an age past its life, nor before its front reaches; a ripple of strength 0
   draws the golden's pixels; a ring far from the camera is still drawn (the
   least pixels) and one near is not aliased (no pixel-to-pixel flip over a
   wavelength under 2 px).
4. **Game, what is handed over:** `rippleData(splashes, t, out)` (pure, in
   `src/ripples.ts`) writes every splash in the pool as `(x, y, age, size)`
   and says how many; it makes nothing (writes into an array sized once).
   Held by `test/ripples.test.ts`.
5. **Game, the look:** `CLEAR` in `src/water/clear.ts` names the figures above
   and `clear()` hands them in `look.clear`; held by `test/water.test.ts`.
6. **Game, no rings drawn:** `ripplesdraw.ts` and `PALETTE.ripple` are gone,
   and no group of the page draws a ring; `SPLASH_BURST` is the finer burst,
   held by `test/bursts.test.ts`.
7. **End to end:** a pebble dropped by a tap in look mode and by the lab's
   button, and a cast landing in cast mode, each shows as one more ripple
   handed to the renderer (`game.ripples()`, new on the test API), its age
   moving with `step` and none past its life; a cast onto the bank hands none.
8. **The pictures:** `splash.png` and `cast-sinking.png` show rippled water
   and no white rings; a new `splash-sick` (the sick lake from the boat) and
   `splash-night` (the clean lake at night) show what the ring does there.

## Edge cases (the project's checklist)

- **save:** not reachable; splashes are not saved.
- **scale:** twelve live (the pool's capacity, `SPLASH_CAPACITY`), the frame
  measured with twelve; the thirteenth replaces the oldest as now.
- **phone:** the phone view's picture taken with a splash; the ripple is on
  both rungs (it is the water's own pass), its cost measured on full.
- **the mode:** a tap in look drops a pebble, a cast landing in cast mode
  splashes; picking a view leaves live ripples where they are.
- **the rung:** full and lean draw the same ripples.
- **the lab:** day, dusk, night (the mirror is all the ring has at night:
  pictured); caustics on and off (the ring's bend moves the caustic net too);
  paint on and off (no effect); clear and sick (pictured); a pebble at the
  shore's edge: the ring is drawn only on the water's mesh, so it stops at the
  shore and at a boulder by what is drawn, tested in the GPU test by a ring
  half over the bank.
- **the water:** above and on the surface only (it is the surface's normal);
  at the shallowest the bend is less (the existing `BEND_DEPTH` rule).
- **the line:** cast onto water (ripples), onto the bank (none), at the
  shore's edge (a ring cut by the shore); cast again while out (a new splash,
  the old ripple goes on).
- **the fish:** a fish under a ring is seen bent with the bed; nothing new.
- **snags, the boat, the calendar, the real clock, the cabin:** not reachable
  yet.
- **the day:** the ripple's age is the game's clock, so it stops when the
  game is paused and is the same every run.
- **contamination:** sick water shows the ring through the mirror and the
  light; pictured.

## Decisions (defaults taken; say if any should change)

- **The figures** are the mock's (above). Recommended: keep, and tune only
  from the finished build's films if the user asks.
- **The droplets** are B's finer burst. Recommended: keep.
- **The bobber does not bob on its own ring** (height untouched).
  Recommended: out of scope; a later feature if wanted.
- **Ripple age is the game's time, not the water's clock** (`WATER_PACE`
  0.6 slows the swell, not the splash). Recommended, since the splash pool is
  in game time.

## Performance risk

- Frame: a loop of up to 12 per water pixel in the clear pass. Measured in
  the package by a perf scene `standard clear ripples` (12 live) against
  `standard clear finish` in the same runs; in the game by `measureFrame`
  with twelve pebbles live, and `npm run perf` at the standard scene (no
  splash: should not move).
- Download: held to the byte; the move written again with its reason.
- Nothing is kept: a fixed `Float32Array` on each side.

## Test plan

- Unit: `clear.test.ts` (package: packing, refusals, defaults);
  `test/ripples.test.ts` (rippleData), `test/water.test.ts` (figures),
  `test/bursts.test.ts` (burst).
- GPU (package): `clearripples.gpu.test.ts`; the golden before and after.
- End to end: a stage in `smoke/progress.spec.ts`, by tap, button and cast,
  read through `game.ripples()`.
- Fuzzer: the pebble drop and the cast are already actions; no new action.
  No new invariant: what is handed is a pure function of the splash pool,
  whose rules (`src/invariants.ts`: count, on the water, not after now)
  already hold; `rippleData`'s own test holds that it hands exactly those.
- Leaks: nothing new kept; the splashes' ceiling stands.
- Pictures: `splash`, `cast-sinking` moved through `/gate-moved`, every one
  looked at; `splash-sick`, `splash-night` new; the rest should not move (no
  splash in them), and any that does is looked into.
- Film: `scripts/film.ts` gains a `splash` scene (a pebble from the boat,
  filmed from the drop), so the motion can be looked at again.
- Mutation: the ripple's term taken out of the normal (GPU test fails), the
  age's sign flipped (end-to-end fails), `rippleData` dropping the last slot
  (unit fails).

## Out of scope

The bobber riding its ring; ripples from fish rising, the falls or rain;
rings on any water but the clear water; sound.

## Parts, in order

- [x] **Part 0:** this spec copied to `ooerfish/docs/splash.md`. Check: the file is there.
- [x] **Part 1 (artshape-render, worktree `artshape-render-ripples`, branch
      `ripples` from `v0.43.0`):** the options, `setRipples`, the uniform block
      appended after round two's (counted from the end as the others are), the
      `ringSlope` term in `CLEAR_FRAGMENT` added to `n`, `np` and `nm`, a spec
      `docs/specs/clear-water/ripples.md` in the shape of `drift.md`, the perf
      scene. The mock in `ooerfish/.claude/worktrees/splash-mocks/node_modules/artshape-render/src/game/clear.ts`
      (`ringSlope`) is the reference to port from, not built on. Check:
      `npm run typecheck && npm test`, `npm run test:gpu` (golden green before
      and after, the new test seen failing first), `npm run perf:gpu`.
      Left uncommitted for the user's go. Built by the `builder` agent on
      sonnet is possible; here it is built in this session.
      _Done 15 Oct, uncommitted in `artshape-render-ripples` on `ripples`:_ the
      options are named `ring*` and the setter `setRings`, since `ripple`,
      `rippleAmount` and `rippleCut` are already the fine waves' lightening.
      `npm test` 1347 green, `npm run test:gpu` 440 green (golden held),
      the six ring tests seen failing first and each mutation caught but the
      loop's stop at the count (redundant: `packRings` clears the slots past
      it). Twelve rings 0.017 ms over `standard clear finish` in the same
      run, on a loaded machine; its baseline key not written for that reason.
      See that worktree's `docs/specs/clear-water/rings.md`.
- [x] **Part 1b: the release** (done 15 Oct: `91c9c2b` and `8300d9b`, v0.44.0 tagged and pushed) (on the user's go): commit, merge to main,
      version 0.44.0, tag, push. Check: the tag on origin.
- [x] **Part 2 (ooerfish, worktree from `fc738ce`, `SMOKE_PORT` 5206):** (done 15 Oct: `d9079f5` on `claude/splash-pin`, every look picture held to the pixel, the download 115,408 to 116,697 bytes, boot and frame left at their figures) the
      pin to v0.44.0 in a commit of its own. Check: `npm run check`, every
      look picture to the pixel, the download moved and written again with
      the reason.
- [x] **Part 3 (ooerfish):** _Built 15 Oct on `claude/splash`, first against a copy of the unreleased renderer and then on the pin; the tests below seen failing first, then green._ tests first (criteria 4 to 8), then
      `rippleData`, `CLEAR`'s figures, `main.ts` handing the ripples each
      frame, `ripplesdraw.ts` and `PALETTE.ripple` removed, the finer burst,
      `game.ripples()`, the film's `splash` scene, the new pictures,
      CLAUDE.md's **Splashes** line rewritten. Check: the new tests green.
- [x] **Part 4: the pass:** (done 15 Oct, recorded below) `npm run check`, `npm run fuzz -- --seeds 1-24`,
      perf before and after (the bench read alone if it reads high inside the
      check), `measureFrame` with twelve live, the pictures through
      `/gate-moved`, a film of the finished splash from the boat and the
      shore for the user, mutation checks. Nothing committed until the user
      says.

## The pass (15 Oct 2026)

- `npm run check` green on `claude/splash` over `d9079f5`: 435 unit tests,
  44 browser tests, the bench within tolerance (+3% to +13%, on a busy
  machine), pace 2.31 minutes against 2.13 within tolerance, as at the pin.
  `npm run fuzz -- --seeds 1-24`: no rule broken in 97 splashes.
- Pictures moved, each looked at through `/gate-moved`: `splash` (30,295
  pixels: the white rings gone, the ripples in the water, the smaller burst
  and its reflection), `cast-sinking` (989: the rings round the bobber gone),
  and the three `fishing-` pictures (22 to 24 each: one mist droplet at the
  right fall's foot, moved because the cast's smaller burst takes fewer of
  the particle pool's slots). New: `splash-sick`, `splash-night` and
  `phone-splash`. At night the ring is seen only faintly, by the mirror.
- The download fell from 116,697 to 116,581 bytes (the white rings' drawing
  gone); written. Boot and frame not written: within their wobble.
- The frame, timed in turn with the parent (`d9079f5`) three rounds, the
  least of five each: the standard scene 3.55 to 3.57 ms against 3.56 to
  3.58; twelve splashes live 3.68 to 3.71 against the white rings' 3.65.
- Mutations: the ring's slope out of the normal, its life's test and its
  least pixels each fail the GPU test; `rippleData` dropping the last slot
  fails four unit tests; its age's sign flipped fails both end-to-end stages.
  Not caught: the shader's stop at the count (redundant), and the page not
  calling `setRings` at all, which only the pictures would see, since
  `game.ripples()` reads the page's array and not the renderer's.
- Not verified: another GPU; the leaks gate drops no pebble (its run reached
  nought splashes), so the splash pool's ceiling is held only by the unit
  tests and the fuzzer's invariants.
