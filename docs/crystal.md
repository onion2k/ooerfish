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

- [ ] **Part 10: the lake seen moving** (ooerfish, a kept tool). `npm run film` with `--scene`, `--seconds` and `--out`: headless
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

- [ ] **Part 11: a surface that holds its detail** (artshape-render, an
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

## Out of scope

The sky, the fog, tone mapping and bloom (tuning them is a part of its
own if the user asks after seeing part 6); a second water style; the
boat; the underwater view; anything in the game's logic. No option here
changes what `Game` steps, so the fuzzer, the determinism gate, the
bench and the pace gate are untouched and are run only in part 6.
