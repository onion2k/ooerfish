# The crystal-clear water: the plan

Written 13 October 2026. The facts hold on ooerfish `b59aa0e` and
artshape-render `v0.38.0` (`f9f7b2c`), whose clear water is
`src/game/clear.ts` there with its specs under `docs/specs/clear-water`.
To be built by the `builder` agent on `sonnet`, one part at a time: parts
0 to 5 in a worktree of artshape-render on a branch `crystal`, each an
option of `ClearWater` whose default draws what v0.38.0 drew, to the
pixel, and part 6 in a worktree of ooerfish on `SMOKE_PORT` 5206 that
moves the pin and turns the options on. Anything marked _guess_ was not
measured. The taste decisions are the user's, made from the sheets in
part 0, and are not made here.

## Where this stands (paused 14 October 2026)

Read this first on picking the work up.

- **Landed on ooerfish main, none of it pushed:** the mirror (part 4,
  renderer v0.39.0), the sand ring (7), the shallows' knee and caustic
  line (8, v0.40.0) with the figures of part 9, the film tool (10), and
  the plan's records. `git log` from `b59aa0e` shows the commits.
- **Released and pushed:** artshape-render v0.39.0, v0.40.0 and v0.41.0
  (the detail layer, part 11) and v0.41.1 (the same with its perf
  figures, pushed on the evening of 14 Oct). ooerfish is pinned at v0.41.1
  and the detail layer is taken in (part 11c, merged to main); the
  blinking sparkle is written up as part 14.
- **Perf figures taken** (14 Oct, evening, Draw Things off the GPU). In
  the package `standard clear shallows` reads 0.71 ms and `standard clear
detail` 0.73 against the standard clear water's 0.71, written in by hand
  and committed and tagged as v0.41.1, pushed; every other scene held. In
  ooerfish the gate was already green, the bundle's bytes having been
  written as 12b and 13 landed, and three runs read the frame at 3.25 to
  3.28 ms and the boot at 699 to 700 against a baseline of 2.95 and 537
  written at the shade's and the cabin's commits. Timed in turn, with the
  renderer held at v0.40.0 throughout: the code before the mirror 2.86 ms
  and 633 ms, part 13's parent 3.02 and 666, head 3.28 and 700. So the
  frame's third of a millisecond is the mirror, the bed's bands and the
  motion (0.16) and the finer surface (0.25, near the 0.31 part 13
  reported), and the boot's rise is the day's drift for the most part
  (about 95 ms, the pre-mirror code booting slower today than the cabin's
  commit did) with about 30 ms each from those parts and from the finer
  surface. `smoke/perf-baseline.json` was written to 3.28 and 700, and
  then by part 11c to 3.54, 759 and 114,362 bytes (its record says why).
- **Parts 12b and 13 landed** (14 Oct, after the pause note was first
  written): the recommended motion with a metre's swell at steepness 0.12
  (the sum of four under one), and a surface fine to a spacing of 0.5
  within 40 units of the shore camera (51,510 triangles, +0.31 ms at the
  standard scene timed in turn; fine everywhere would have been 528,000
  triangles and +0.88 ms). The blinking sparkle is **not** fixed: a star is
  pinned to a lattice point and relights whenever the fine waves there face
  the glint, so no cut under one stops it; the fix belongs in
  artshape-render (a star that drifts with the flow, or a cell that rests
  once lit) and is a package item to write up. The short-swell film is at
  `/tmp/crystal/surface/`, and on the evening of 14 Oct **the user picked
  the recommended swells** over the 0.6 m swell from 2.9 rad, so the
  committed figures stand and part 13 is done; the slices there are the
  evidence that crests now cross the near water.
- **Part 11c is built and merged** (its record below), pinning v0.41.1.
  Next is part 14, the sparkle, in the package.
- **Decisions the user has made** are in each part's record and are not
  reopened: the mirror alone from part 0; the sand ring; knee 0.4, line
  0.08, caustics 0.36; the detail layer at 8 px and 1.0; the recommended
  motion with the blinking sparkle put right; a finer surface; the
  recommended swells kept over the short one.
- **The sheets, films and reports** of every experiment are under
  `/tmp/crystal/` (sheets, lake, shallows, film, detail, detail-film,
  motion) and the package's `docs/specs/clear-water/`.

## Aim

The lake seen into as the user's reference is, the shallows of
[threejswaterpro.com](https://threejswaterpro.com/): what is under thin
water bright and crisp, with sharp lines of caustic light on it and a
fine wobble from the ripples; the colour saturating to a rich blue only
where it is deep; the surface itself all but invisible from above and
mirroring the real scene (the rocks, the jetty, the cabin, the trees) at
a glancing angle; and the swells, where they catch the light, a little
lit through. The toon, low-poly, painted look stays: the water is made
richer, not realistic. The reference's sky, ship, FFT ocean, buoyancy and
underwater camera are out of scope, as are the foam textures.

## What the water does today, and what is missing

The clear pass (`CLEAR_FRAGMENT` in `clear.ts`) already has per-channel
Beer absorption through the water, the bend of what is under by the
waves, two drifting Voronoi layers of caustics, the shore field's foam
lines, the sparkles, a sky mirrored from the environment cube and the
painted ripple lightening. ooerfish tunes it in `src/water/clear.ts`
(`CLEAR`, `CLEAR_WAVES`) and `src/palette.ts`. Against the reference it
lacks: the shallows lit bright, the bed losing little in the first half
unit; caustics with crisp bright lines rather than a soft wash; a finer
surface normal than the twelve waves give, for the bed's wobble; the
scene in the mirror, not only the sky; and any light through a crest.

An experiment in October (the `try-absorb-water` worktree beside the
main checkout, to be removed) ported a Godot absorption water in place
of the pass and found it poorer; it is not built on.

## What part 0 found, and what the user chose

Run 13 October 2026 (`~/.claude/plans/crystal-experiments.md`; the report
is `docs/specs/clear-water/crystal-experiments.md` in the package's
`crystal` worktree). On the game's own lake only the mirror earned its
place: the falls, the rocks and the jetty in the water, at about 0.15 ms
on the standard scene. The knee darkened the shallows, since the bed is
dark slate; the crisper caustics could not be seen at three times the
strength; the fine normal changed nothing, as the fine waves fade out
below a few pixels; the light through the crest and the crest foam showed
nothing at the lake's swells. **The user chose to build part 4 alone.**
Parts 1, 2, 3 and 5 are dropped and stay below only as a record. The
prototype found three things the real mirror needs: a soft edge where the
reflected scenery meets the reflected sky, a say on whether the reflection
takes `mirrorTint` (without it the sick lake went olive), and a true HDR
texture, not a clamped one keyed on a colour.

## Parts

Each part's acceptance test is written first and seen failing. The
golden (`cleargolden.gpu.test.ts`) holds the old behaviour bit for bit
with every option at its default, and stays green through every part.
Each part adds a perf scene to `perf.gpu.test.ts` with its option on,
and the baseline gains its figure. The package's own `npm run check`,
then `test:gpu` and `perf:gpu`, pass before a part is ticked.

- [x] **Part 0: the sheets.** (done 13 Oct; see above) In `docs/specs/clear-water/crystal-experiments.md`,
      as `painted-experiments.md` was done: one picture per experiment of
      the test pond (`clearscene.ts`) and one of a lake built as ooerfish's
      is (the shore field, the bed, a rock standing in the water), each
      experiment one option of parts 1 to 5 at three strengths, taken by a
      GPU test that writes pictures and is not a gate. The user chooses
      from the sheets what parts 1 to 5 build to, and the choices are
      written in the file. Nothing lands from this part but the file and
      the pictures. Two days (_guess_).

- [ ] (dropped) **Part 1: the shallows lit.** `ClearWater.shallowLift` (how far what
      is under thin water is lightened toward `shallowColour`, nought for
      none) and `shallowDepth` (the depth over which it fades, in world
      units; a millimetre default as the others). In the fragment, after
      the caustics and before the absorption, `below` is lifted by
      `exp2(-stand / shallowDepth) * shallowLift`. The absorption's knee:
      `clearKnee`, a depth under which nothing is lost (default nought, so
      the old curve). Tests: `clear.test.ts` resolves and packs them;
      `clearfinish.gpu.test.ts` reads a pixel over the shallow box lighter
      with the lift than without, and the deep box unchanged. One day.

- [ ] (dropped) **Part 2: the caustics crisper.** `causticLine` (the line's width as a
      share of a cell, today the constant 0.16), `causticLayers` (two as
      today, or three, the third finer and faster), and `causticFringe`
      (how far the red and blue layers are offset from the green, in
      cells; nought for none, the reference's rainbow edge). Tests: a
      pixel row across the shallow bed has a higher contrast with a
      narrower line; the fringe reads a red and a blue edge either side of
      a line's peak. One day.

- [ ] (dropped) **Part 3: the fine normal.** `detailScale` and `detailAmount`: a
      third wave layer, finer than the twelve by `detailScale`, added to
      the normal and to the bend alone, never to the surface's height, so
      what floats on the water (`swell.ts`'s riders) is not moved. Tests:
      with the detail on, the bend at a pixel differs from the old by at
      most the detail's share; with it nought, the golden stands. One day.

- [x] **Part 4: the scene in the mirror.** (done 13 Oct, artshape-render v0.39.0) `ClearWater.mirrorScene`
      (false, as today), `mirrorPlane` (the water's height, world units)
      and `mirrorDistort` (how far the swells' normal shifts the
      reflection, as a share of the screen; the prototype used 0.08).
      When on, `GameRenderer` draws the opaque groups once more before
      the opaque pass, with the view mirrored in the plane and a clip at
      it (a uniform the scene shader reads under a `MIRRORED` build flag,
      discarding fragments under the plane; the prototype found the clip
      free and essential, since unclipped the bed seen from below turns
      the lake milky), into a half-size HDR texture `mirror` with its own
      depth and an alpha of nought where nothing was drawn, and the clear
      pass binds it at group 1 bindings 5 and 6 (a sampler). In the
      fragment, the reflection is read at the pixel offset by the
      Gerstner swells' normal (not the fine waves', which fade out far
      off) times `mirrorDistort`, and where its alpha is one it stands in
      for the sky's sample; where it is nought, the sky as today; between,
      the two mixed, and the edge where scenery meets sky softened by a
      one-pixel blur of the alpha, so a cliff's top is not a hard faceted
      line. The reflection takes `mirrorTint` as the sky does, so a sick
      lake does not go olive; `mirror`'s strength applies to both. The
      shadow maps, grass, cards, particles and the clear water itself are
      not redrawn for it. Tests: `clearmirror.gpu.test.ts` reads the
      white box standing in the shallows mirrored in the pixels beneath
      it, offset and tinted as asked; the alpha's edge is soft over a
      pixel; the pass is skipped and the texture not made while the
      option is off, and the golden stands; `perf-baseline.json` gains
      `standard clear mirror`. The budget: measured on ooerfish's standard
      scene the prototype cost 0.15 ms over 2.92, so the package's budget
      for the scene is 0.3 ms over `standard clear` on the reference
      adapter, and a cost past that is looked into, not written. Three
      days (_guess_).

- [ ] (dropped) **Part 5: light through the crest.** `sss` (a colour, null for
      none) and `sssAmount`: the body lightened toward it by the swell's
      height as a share of the most the waves can lift it, times how far
      the view looks toward the sun through the crest. `crestFoam` (a
      Jacobian below which the Gerstner sum is folding and foam is drawn;
      nought for none). The lake's swells are a centimetre high, so this
      may show nothing there: the sheet in part 0 says, and the part is
      dropped if the user sees nothing in it. One day.

- [x] **Part 6: taken into ooerfish.** (done 13 Oct) A release of artshape-render with
      part 4, a commit that moves the pin and nothing else, then a
      commit that turns the options on in `src/water/clear.ts` (`CLEAR`)
      and `src/palette.ts` to the figures the user chose in part 0. The
      lab gains nothing. The look pictures are written again through
      `/gate-moved`, every one looked at; the perf baseline gains the
      frame's new cost, within the 8 ms budget on both rungs, and the
      report gives the frame before and after at `STANDARD` and from the
      boat. `npm run check` green, `npm run fuzz -- --seeds 1-24` clean.
      One day.

## After the mirror: the bed, and the shallows' options revived

Pictured on 14 October 2026 with the mirror in: a sand-coloured bed in the
outer quarter of the lake gave the pale rim that reads as clear shallows,
from overhead most of all, with the slate kept in the deep; the whole bed
sand lost the deep; pale stone was a quieter sand. **The user chose the
sand ring.** With a pale bed, part 0's knee and crisper caustic line are
worth building after all, since on the lab's sand they worked and on the
slate they could not show. Parts 7 and 8 share nothing and are built side
by side; part 9 follows both.

- [x] **Part 7: the sand ring** (done 14 Oct) (ooerfish). The bed coloured by its depth:
      `PALETTE.sand` (first guess 0.62, 0.56, 0.4, the hack's) where the
      water is shallower than `BED_SHALLOWS.depth` (world units, first
      guess the depth at three quarters of the shore radius), `PALETTE.bed`
      where deeper than `depth + blend`, and mixed between, in
      `BED_SHALLOWS.bands` bands (first guess 6). Since a group has one
      colour, the bed sheet in `Scene.static()` (`scene.ts`) becomes one
      sheet per band, cut by radius with the sheet helper as the hack did, each band's colour mixed by the depth at
      its middle radius, and the sand reaching past the shore to the bank
      as the hack's did (`1.04`), so a strip of beach shows inside the foam
      line. The figures are content in `lake.ts` and `palette.ts`. Tests in
      `test/scene.test.ts`: the bands cover the bed once with no gap or
      overlap at their radii; the shallowest band is the sand and the
      deepest the slate, the middle ones between, monotone; the triangle
      count is within a named ceiling; the placement is the same from the
      same seed. `game.scenery()` counts the bands' triangles. The look
      pictures move and are written again through `/gate-moved`, every one
      looked at, with the inner edge seen to blend and not step from
      overhead; the frame at `STANDARD` before and after. No lab control.
      One day (_guess_).

- [x] **Part 8: the shallows' options** (done 14 Oct, artshape-render v0.40.0; its perf figure waits on a quiet machine) (artshape-render, from v0.39.0, as
      options whose defaults draw v0.39.0 to the pixel, held by the golden).
      `ClearWater.clearKnee` (a depth of water, world units, through which
      nothing is lost to the deep colour; nought as today, a millimetre
      default as the others) and `causticLine` (a line's width as a share of
      a caustic cell, 0.16 as today, the constant `CAUSTIC_LINE` made a
      field). Both ride in the two free words of `foamOpt` in `ClearFrame`,
      packed by `foamUniform`, so no struct grows. The knee is
      `exp2(-max(through - knee, 0) / lasts)` in the absorption, and the
      same knee on the caustics' fade. Tests: `clear.test.ts` resolves,
      refuses NaN, turns the millimetre default; a GPU test reads the
      shallow box unchanged in colour with a knee past its depth and the
      deep box darker than it, and a pixel row across the caustics with a
      higher contrast at a narrower line; the golden green; a perf scene
      `standard clear shallows` with both on. README and a spec
      `docs/specs/clear-water/shallows.md`. Then a release, v0.40.0. One
      day (_guess_).

- [x] **Part 9: taken in, and the figures chosen.** (done 14 Oct: knee 0.4, line 0.08, caustics 0.36; the pass ran without its perf gate, the machine being at other work, and the perf baseline is to be written on a quiet one) The pin to v0.40.0 (a
      commit of its own), then a sheet on the real lake with the sand ring
      in: the knee at nought, a quarter and a half of a clarity, and the
      line at 0.16, 0.08 and 0.06 with the caustics' strength at one and
      three times, from the shore, the boat and overhead. The user chooses;
      the figures go into `CLEAR`, the pictures move through `/gate-moved`,
      and the pass runs as part 6's did.

## After the shallows: seen moving, and a surface that holds its detail

Chosen 14 October 2026 from the ranking of what still separates the lake
from the reference. Every judgement so far was a still; and the fine waves
fade themselves out past a few pixels, so the surface has no small-scale
normal where the eye looks, which is why part 3 changed nothing.

- [x] **Part 10: the lake seen moving** (done 14 Oct) (ooerfish, a kept tool). `npm run film` with `--scene`, `--seconds` and `--out`: headless
      Playwright through `start()` and `set()` as the look pictures are
      taken, then one screenshot per stepped frame at the game's fixed
      step (`game.step(1)` each, never a timeout), the frames written as
      PNGs and, where `ffmpeg` is on the machine, an MP4 and a GIF beside
      them; without it, a filmstrip PNG of every eighth frame. The scenes
      are the look pictures' names plus `STANDARD`. `scripts/film.ts`
      with its arithmetic (which frames go on the strip, the strip's
      layout) in a pure module with unit tests; the Playwright part shares
      `smoke/game.ts`. It is a tool, not a gate: nothing is held to it.
      Its first use is a capture of `clear-day` and `half-boat` over five
      seconds beside a capture of the reference's demo at
      https://threejswaterpro.com/ over the same five seconds, for the
      user to look at, with notes on what differs in motion (the swells'
      travel, the caustics' crawl, the reflection's shimmer, the sparkles)
      and what to change in `CLEAR`, `CLEAR_WAVES` and `WATER_PACE`. Half
      a day (_guess_).

      **What the film found (14 Oct):** in a patch of near water between
      frames a thirtieth of a second apart, ours changes by a mean of 0.24
      levels of luma and the demo's by 7.8, about thirty times more.
      Nothing in ours is seen to travel across the screen; the swells show
      as whole rows brightening together, and a slice of one pixel row per
      frame has no slants, where the demo's is full of them. The caustics
      are soft blobs that wobble in place. The mirror moves most of
      anything in our water, the falls' reflections bending in a few broad
      zigzags with no fine shimmer; the demo's reflections break into fine
      glints. Our sparkles are one soft star now and then; the demo's
      shallows are thick with small changing glints. The foam line holds
      still. Recommended, not made, each a taste the user decides: `WATER_PACE`
      0.4 to about 0.6; `CLEAR.speed` 0.12 toward 0.2 and `CLEAR.scale` 2.4
      up, for some visible crawl near the camera (part 11 decides whether
      it holds far off); one or two shorter swells in `CLEAR_WAVES`, half
      a metre to a metre, from directions outside the present spread, so
      something travels, which also moves the bobber and the rings; the
      sparkles denser and smaller (`sparkles` 0.3 toward 0.6, `sparkleSize`
      9 toward 4, `sparkleCut` lower), against the choice of three big
      soft stars recorded in `CLEAR`; `mirrorDistort` left alone, since the
      coarse bends are the missing fine normal. The demo was captured at
      about 21 a second on a busy GPU, and these settings were not filmed.

- [x] **Part 11: a surface that holds its detail** (built 14 Oct, artshape-render v0.41.0: `detailPixels`, `detailAmount`; the scale from the still surface through the lens; the bend and the mirror's read falling back to plain's beside a thing in the water, which keeps the mirror's depth; shimmer held under 1.15 times plain; about 0.2 ms; its perf figure waits on a quiet machine) (artshape-render, an
      experiment then an option). The question: can a detail layer whose
      scale is chosen per pixel from the screen-space derivative of the
      world position (so it is always a few pixels wide, near and far,
      and never fades out) give the surface a small-scale normal that
      breaks up the mirror and wobbles the bed as the reference's does,
      without shimmer? The experiment, in a worktree from the `shallows`
      branch, under a temporary flag in `CLEAR_FRAGMENT`: a `waterSlope`
      read at a scale of `detailPixels / perPixel` (the layer's cell this
      many pixels across, blended between the two nearest powers of two
      of the lattice as the sparkles do, so the scale is continuous as
      the camera moves), its slope added to the normal at
      `detailAmount` and to the mirror's and the bend's reads, never the
      height. Pictured on the package's pond and the lab lake (the
      `crystalscene` of part 0, rebuilt from its report) at cells of 4, 8
      and 16 pixels and amounts of 0.3, 0.6 and 1.0, still and over
      sixty stepped frames (shimmer is a change between frames at the
      same place, measured as pixels moved more than a few levels),
      with the cost. The sheet decides; if the user picks one, the part
      is `ClearWater.detailPixels` and `detailAmount` (nought as today),
      with tests, the golden, a perf scene and a spec, then a release
      and a take-in with its pictures. Two days for the experiment, one
      for the part (_guess_).

**Part 11's experiment (14 Oct, `docs/specs/clear-water/detail-experiment.md`
in the package's `detail` worktree):** the layer as specified shows nothing
at any setting, because the renderer's fine waves fade themselves out
below nine to twenty pixels whatever scale they are read at; a variant B
that lowers that fade so the finest wave is one cell across is what the
sheets show. A cell of 8 pixels at an amount of 1.0 breaks the reflections
into short wavy bands that re-form from frame to frame and puts a fine
ripple on the near water; 4 pixels is grain, 16 and anything at 0.3 is
faint; overhead nothing changes. Shimmer on the far water (pixels changing
more than four levels between frames, exact run to run, checked against a
planted fault): plain 1,093 a frame, 8 px at 1.0 1,297, the worst 1,393.
Cost about 0.2 ms at any setting. No seam at the lattice's doubling. A real
option needs the scale taken from the position before the swells move it
(the swells facet it otherwise) and a fleck where the bend lands on a post
at the waterline put right. **The user chose to film it in the game before
deciding** (part 11b), and part 12 alongside.

- [x] **Part 11b: the detail layer filmed in the game.** (done 14 Oct: at 8 px the reflections break into bands that drift and re-form and the far water reads as moving water, with 7% more change and no more flicker; 4 px is grain; a purple-red smear at the bobber's waterline is a fault the option must put right; the user chose to build it) A throwaway
      ooerfish worktree linked to the package's `detail` worktree, the flag
      read from the address, and `npm run film` over five seconds of
      `clear-day`, `half-boat` and `cast-sinking` at plain, 8 px at 1.0 and
      4 px at 1.0, side by side with plain, with the far-water shimmer
      counted in the game as the experiment counted it. The user judges
      whether a fifth more change reads as moving water or as fizz. If it
      reads as water, part 11 is built as the option with the two fixes;
      if not, it is dropped. Half a day (_guess_).

- [x] **Part 12: the water's motion, filmed at three settings.** (filmed 14 Oct; see the record and part 12b below) From the
      film's recommendations, three settings of `CLEAR`, `CLEAR_WAVES` and
      `WATER_PACE`, read from the address in a throwaway worktree: calm (as
      now); recommended (`WATER_PACE` 0.6, `CLEAR.speed` 0.2, `CLEAR.scale`
      3.5, one swell of a metre added from a direction outside the present
      spread, sparkles as now); livelier (`WATER_PACE` 0.8, `speed` 0.25,
      `scale` 4, two short swells, sparkles 0.6 at size 4 and a lower cut).
      Filmed over five seconds in `clear-day`, `half-boat` and
      `cast-sinking` (the bobber and the rings ride the swells, so the
      added swell's effect on them is seen), side by side, with the same
      per-frame change measure as the film's notes, for the user to pick.
      The pace also drives the breeze and the falls, which is said beside
      the pictures. Whatever is picked lands as figures in `lake.ts` and
      `src/water/clear.ts` with the pictures through `/gate-moved` and the
      pass. Half a day for the sheet (_guess_).

**Part 12's films (14 Oct):** no setting makes anything travel across the
near water. The swells are worked out only at the surface mesh's corners,
about 1.5 to 2 units apart (24 rings by 128 segments, `src/water/surface.ts`),
and every swell short enough to be seen travelling is shorter than that, so
the near patch brightens and darkens together at the swell's rhythm (25,
19 and 74 frames measured against 25, 19 and 76 predicted). Travel shows
only in the far mirror's drifting bands. Recommended keeps calm's look and
adds a gentle pulse and a more broken reflection; lively reads as fizz (three
sparkles blinking in fixed places, glints jumping between frames). The
bobber's ride is under two pixels at every setting; the pace speeds the
breeze but not the falls, which divide it back out. **The user chose:** the
recommended figures landed now with the fixed blinking sparkle put right,
and a finer surface as part 13.

- [x] **Part 11c: the detail layer taken in** (done 14 Oct, in two commits on `claude/crystal-11c-ec229f`: the pin, then the figures; see its record below) (ooerfish, after parts 12b
      and 13 land, since they move the same pictures). The pin to v0.41.0,
      a commit of its own; then `CLEAR.detailPixels` 8 and `detailAmount`
      1 asked for in `src/water/clear.ts`, the water test holding them,
      the look pictures through `/gate-moved`, every one looked at, five
      seconds of `cast-sinking` filmed and the bobber's waterline looked
      at for the smear the option was built to put right, and the pass as
      part 9's with the perf gate deferred. Half a day (_guess_).

**Part 11c's take-in (14 Oct):** the pin moved to v0.41.0 in a commit of
its own and the lake drew as before, to the pixel; then `CLEAR.detailPixels`
8 and `detailAmount` 1, held by `test/water.test.ts`. All sixteen look
pictures moved, each looked at: the change is on the water only, a fine
ripple over the whole surface and the falls' reflections broken into wavy
bands, 0.3% of the pixels overhead and 12% from the shore of the sick lake;
nothing off the water moved and no seam shows where the fine surface meets
the coarse. Five seconds of `cast-sinking` filmed, the bobber's waterline
magnified at eight frames: the reflection's band passes behind the bobber
and the purple-red smear of part 11b is gone. The cost, timed in turn over
four rounds at the standard scene: the parent 3.48 ms, the pin alone 3.52
(within the wobble), the layer 3.80, so about 0.3 ms, a little over the
package's 0.2. The perf baseline is written again for the frame (2.95 to
3.54, the layer's 0.3 and the 0.3 of parts 12b and 13 that main's own
baseline, uncommitted, already carries as 3.28), the bundle (112,064 to
114,362 gzipped bytes: 2,273 the renderer's shader, 25 the two options) and
the boot (537 to 759, which is within the tolerance of main's 700: the
figure is what this evening read). The rung test held the lean rung to
four fifths of the full frame, and the grass is 0.7 ms of a frame that the
water now makes 3.5, so the layer's cost on both rungs tipped it (0.78 at
the parent, 0.81 after); it now holds the saving as milliseconds,
`GRASS_SAVING_MS` 0.35 with the measurement beside it, and was seen to fail
a lean frame that saved nothing. Nothing in the game's logic changed, so
the fuzzer, determinism, leaks, bench and pace gates ran as they were; the
bench read the fish's step 16% over its baseline once in the full check and
12% alone, at the parent and the change alike, so that is the machine's
evening and not the change's. `npm run fuzz -- --seeds 1-24` broke no rule.

- [x] **Part 12b: the recommended motion landed** (done 14 Oct, but for the sparkles' cut: see its record below) (ooerfish). `WATER_PACE`
      0.6; `CLEAR.speed` 0.2 and `CLEAR.scale` 3.5; in `CLEAR_WAVES` the
      1.5 m swell replaced by one of 1 m from -0.5 rad (the renderer draws
      four at most), steepnesses still under one; and `CLEAR.sparkleCut`
      raised until no sparkle sits blinking in one place over five seconds
      of `clear-day` (filmed to check; the figure is what the film says).
      `test/water.test.ts` holds the new figures and the swells' sum; the
      look pictures move through `/gate-moved`, every one looked at; the
      pass as part 9's, the perf gate deferred while the machine is busy.
      Half a day (_guess_).

**Part 12b's sparkles (14 Oct):** the cut was filmed at 0.45, 0.5, 0.55, 0.6,
0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95 and 0.98 over five seconds of `clear-day`
(`/tmp/crystal/sparkle/`), and no cut under one stops the star near the camera
coming back in its place: each star is pinned to a point of the renderer's
lattice and lights as the fine waves there come round to face the glint, and
a higher cut only makes it fewer and smaller (ten returns at 0.45, three at
0.9, two at 0.98, 128 frames apart). The cut is kept at 0.45 for the user to
pick from the films; what would stop it is in the renderer (a star that
moves with the flow, or a cell lit once and then resting), not a figure here.
The four swells' steepnesses added up to 1.01 before this part, over the one
at which the renderer's surface folds, so the metre's swell is 0.12 and not
the 0.15 it replaced, and the four add to 0.98.

- [x] **Part 13: a finer water surface** (done 14 Oct: the fallback taken, and the user chose the recommended swells from the film: see its record below) (ooerfish). `SURFACE` in `lake.ts`
      (rings, segments) read by `surface()` in `src/water/surface.ts`, so
      the greatest distance between neighbouring corners of the surface,
      measured by a test over the whole sheet, is under `SURFACE.spacing`
      (first guess 0.5 units, so a swell of a metre is drawn by at least
      two corners a crest); the rings packed toward the shore as they are,
      and `game.scenery()` counting the surface's triangles under a named
      ceiling. The cost: the water's own perf test and the frame at
      `STANDARD` and from the boat, timed in turn with the parent, within
      the 8 ms budget on both rungs; if the finer sheet costs more than
      half a millisecond, a sheet finer only within `SURFACE.near` units of
      the camera's shore view is the fallback, and the report says which.
      Then the short swells filmed again with the film tool, five seconds of
      `clear-day`, `half-boat` and `cast-sinking`, recommended against
      recommended with a 0.6 m swell from 2.9 rad in place of the 2 m one,
      side by side with the slices, for the user to pick; the swell that is
      picked lands as figures with its pictures. One to two days (_guess_).

**Part 13's swell (14 Oct, evening):** from the side-by-side films and the
slices, **the user chose the recommended swells**, so the figures of part 12b
stand and nothing lands for the pick. The short swell was finer on the near
water (a spread of 1.6 levels against 1.8, and a swing of 8.3 against 10.4
on `clear-day`), and was not preferred.

**Part 13's sheet (14 Oct):** fine all over, packed as it was, the sheet needs 240
rings by 1,100 segments (528,000 triangles against 6,144) to keep every edge
under half a unit, the diagonals setting it, and timed in turn with the
coarse one it cost 0.88 ms at the standard scene on the full rung, 0.85 on the
lean and 0.57 from the boat. So the fallback was taken: `SURFACE.near` of 40
from the Shore view's camera's place on the ground (the water from the south
shore to sixteen units in), with a margin of a coarse cell, made fine by fine
rings that run all round and fine angles that run all the way in, one sheet
with no corner in the middle of another's edge. It is 51,510 triangles and
cost 0.31 ms on full, 0.27 on lean, 0.09 and 0.07 from the boat, whose own
near water is still coarse. A reach of 50 cost 0.51. The fine rings run round
the far shore too, where a cell is a pixel or two; a sheet fine only in a
patch would be cheaper, and would need its edge stitched. `sheet()` packs its
rings toward its inner edge, which for the water is the middle and not the
shore.

## After the detail layer: a sparkle that moves with the water

Found 14 October 2026 by part 12b's films, and written up here as the
package item the pause notes call for.

- [ ] **Part 14: a sparkle that is not pinned to the lattice**
      (artshape-render). Each of the clear water's sparkles is a star pinned
      to a point of the renderer's lattice that lights as the fine waves
      there come round to face the glint, so a star near the camera returns
      in its place every few seconds and reads as a blink; `sparkleCut` only
      makes it fewer and smaller (ten returns in five seconds at 0.45, three
      at 0.9, two at 0.98, 128 frames apart) and no cut under one stops it.
      Two ways to put it right, to be sheeted and filmed in the package
      before one is chosen: a star that drifts with the flow, its cell's
      point carried by the water's own motion so a glint that returns
      returns somewhere else; or a cell that rests once lit, keeping a
      per-cell phase so a star that has just shone cannot shine again for a
      while. Either is an option of `look.clear` whose default is the old
      (a water that names neither draws as v0.41.1 does, to the pixel), with
      its spec in `docs/specs/clear-water/`, a GPU test that a star lit in a
      cell is not lit there again within the rest, the golden, a perf scene
      and the usual release. Then taken in here with a pin bump of its own,
      `CLEAR.sparkleCut` reconsidered from 0.45 with the fix in (it was kept
      there only because no cut helped), and five seconds of `clear-day`
      filmed to show no star returning in its place. One to two days
      (_guess_).

## Out of scope

The sky, the fog, tone mapping and bloom (tuning them is a part of its
own if the user asks after seeing part 6); a second water style; the
boat; the underwater view; anything in the game's logic. No option here
changes what `Game` steps, so the fuzzer, the determinism gate, the
bench and the pace gate are untouched and are run only in part 6.
