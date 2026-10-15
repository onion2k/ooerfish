# The crystal-clear water, round two: the plan

Approved 15 October 2026, and kept
as `docs/crystal.md` was, with each part's box ticked as it lands.
Written 15 October 2026. The facts hold on ooerfish `3c98de7` and
artshape-render `v0.42.0` (`538ac30`), whose clear water is
`src/game/clear.ts` there with its specs under `docs/specs/clear-water/`.
Part 0 is built by the `builder` agent on `sonnet` in a worktree of
artshape-render on a branch `crystal-2`; the parts after it are written
once the user has picked from part 0's sheet, and not before. Anything
marked _guess_ was not measured. The taste decisions are the user's and
are not made here.

## Context

The first round (`docs/crystal.md`, parts 0 to 14, all landed) gave the
lake its mirror of the scene, the sand ring, the shallows' knee and
caustic line, the detail layer, the recommended motion, a finer near
surface and sparkles that drift. The user finds the water good but short
of the best Unity and Unreal water, and gave a reference: Shaatish
Rajendran's "Unity Water Shader study 1.0" (URP, Amplify Shader, caustics
after the PolyToots method): an ocean round rocks and a lagoon with a
ship, by day and under a purple dusk. Set against the lake, the gap is in
five things, and three of them are worth trying again for reasons that did
not hold in the first round. The aim is still the toon, painted lake made
richer, not realistic; the reference's whitecaps and open-sea swell are an
ocean's and are out.

## What the reference has that the lake does not

1. **A glitter field, not stars.** The sun's reflection is thousands of
   small flecks, dense toward the sun and thinning away, moving with the
   surface. The lake draws a sparse lattice of a few big soft stars
   (`sparkles` 0.15) and has the renderer's own glitter turned off
   (`glitter: 0` in `src/water/clear.ts`): that glitter is a glint lobe
   aimed along the camera's heading (`ahead` in `CLEAR_FRAGMENT`), not at
   the sun, cut to dashes.
2. **The sun's own lane on the water** at dusk: a broad bright path under
   a low sun. The lake's mirror takes the sky from the environment cube,
   whose sun is clamped; round one's prototype found the mirror wants a
   true bright sun. There is no specular lobe toward `frame.sunDir` on the
   water at all today: `lightOn` is diffuse.
3. **Crisp, bright caustics on the sand.** Round one tried crisper caustics
   on a slate bed and could not see them (E2 there), and the figures were
   settled at line 0.08, strength 0.36. The bed has been sand in the
   shallows since part 7, and the caustics are drawn as light added in
   proportion to the bed's own colour (`below += below * line * ...`), so
   on sand they can be seen and on slate they vanish by design. Not tried
   since: larger cells, and a caustic that adds its own light rather than
   the bed's.
4. **A deeper colour sweep**, turquoise shallows to a saturated blue deep.
   The lake has the machinery (per-channel absorption, the knee, the
   near colour, the sand bands) and gentler figures: `PALETTE.clearShallow`,
   `clearDeep`, `clearNear`, `CLEAR.clarity` 0.8, `knee` 0.4. No new
   machinery; a sheet of palettes.
5. **A broken foam edge** with a wet strip of sand inside it. The lake's
   foam lines are wobbled by one noise (`FOAM_BREAK`, `FOAM_LINE_CELL`,
   shader constants, not options) and read as clean curves; nothing marks
   the sand as wet.

## Part 0: the sheet

- [x] **Part 0: the sheet.** (done 15 Oct) Built by the `builder` agent in the worktree `artshape-render-crystal2`, branch `crystal-2`, from `v0.42.0`, nothing committed; the report is `docs/specs/clear-water/crystal-2-experiments.md` there and the sheets and films are under `/tmp/crystal-2/`. Its record and the user's pick are under **What part 0 found** below.

One experiment per gap, each an option of `ClearWater` whose default
draws v0.42.0 to the pixel (the golden `cleargolden.gpu.test.ts` holds it,
and is run before the first picture and after the last), sheeted on the
package's build of the lake at three strengths, by day and at dusk, with
the glitter and the lane filmed since they only read moving. The user picks
from the sheet; only what is picked is built to the definition of done.

### The lab

- Round one's lab (`crystal.gpu.test.ts`) lived in a worktree that was
  removed and was never committed, so it is built again as
  `src/game/__tests__/crystal2.gpu.test.ts`, to the shape of
  `painted-sheet.gpu.test.ts`: it draws only where `VITE_FRAME_DIR` names a
  directory, says so where it does not, and holds nothing but that every
  frame drew without a validation error. Frames and sheets go under
  `/tmp/crystal-2/`, one sheet per experiment (`E1.png` to `E5.png`), the
  plain picture first and then the strengths, one row per scene; the
  report alongside the sheets as `docs/specs/clear-water/crystal-2-experiments.md`,
  in the shape of `crystal-experiments.md`, with a **Chosen** section left
  for the user.
- **The scenes** come from `clearlake.ts` (`lake()`, `LAKE_CLEAR`,
  `LAKE_LOOK`), brought up to the game at `3c98de7`: `LAKE_CLEAR` takes
  the game's `CLEAR` as it now is (the knee 0.4, line 0.08, caustics
  0.36, sparkles 0.15 with the drift, the detail layer at 8 px and 1, the
  metre's swell from -0.5 rad in the third slot) and the sand bed stays.
  Two views, the shore and the overhead, as round one had them; and two
  lights: the game's day look (`LAKE_LOOK`) and its dusk (the sun and
  colours of `look.ts`'s dusk in ooerfish, copied in with their source
  named), since the lane and the flecks' colour are a low sun's. Each
  picture 512 by 320 at four samples; a film is 90 frames at a thirtieth
  of a second, written as frames, an MP4 and a strip, as round one's films
  were.
- **Each experiment is one option**, packed past the end of the clear
  frame as round one did (`CLEAR_FRAME_FLOATS` grows by one vec4 per
  option that needs one; the frame's float count test in `clear.test.ts`
  moves with it and says why). The old expression is left as it was in an
  `else`, so the golden holds with every option at its default.

### E1: the glitter field, aimed at the sun

Two columns before anything new: the renderer's own glitter turned on at
0.3, 0.6 and 1 (`glitter`, which the game sets to 0), so it is seen what
is already there for nothing. Then the new option:

- `glitterSun` (0 to 1, default 0): how far the glint's way is turned from
  the camera's heading toward the sun, `ahead = normalize(mix(ahead,
frame.sunDir, glitterSun))`, in the glitter block only, so a game that
  names nought draws as before. At 1 the flecks lie under the sun as the
  reference's do; at a half they sit between, in view from more places.
- `glitterGrain` (0 to 1, default 0): the dash cut jittered per cell of
  the fine waves by a hash (`flowHash`), `cut = GLITTER_CUT * (1 +
(hash − 0.5) * glitterGrain)`, so the dashes break into flecks of
  unequal size and the field reads as thousands of small lights and not a
  texture of bars. A fleck's brightness is the sun's colour normalised, as
  the dashes are now.
- Strengths: `glitter` 0.6 with `glitterSun` at 0.5 and 1, each with
  `glitterGrain` at 0 and 0.6; by day and at dusk; filmed at `glitter`
  0.6, `glitterSun` 1, `glitterGrain` 0.6.
- The question the sheet answers: whether a field of flecks reads better
  than the stars, and whether the two can live together (the stars at 0.15
  stay on in every column). The cost: the glitter block is already in the
  shader; the two options add a mix and a hash a pixel on the water.
  `standard clear glitter` joins `perf.gpu.test.ts` with its figure.

### E2: the sun's lane

- `sunLane` (0 to 1, default 0) and `sunLaneWidth` (default 0): a
  specular lobe toward the true sun, `pow(max(dot(reflect(-v, n_fine),
frame.sunDir), 0), width)` with `n_fine` the surface's normal with the
  detail layer's slope added (so the lane breaks into the fine waves as the
  reference's does), times the sun's colour times `sunLane`, in the sun
  only (the shadow map, as the sparkles are gated), and faded by
  `max(frame.sunDir.z, 0)` so no lane is drawn from a sun below the
  horizon. `sunLaneWidth` is the lobe's power: 60 is a tight path, 15 a
  broad glow.
- Strengths: `sunLane` 0.3, 0.6, 1 at width 60, and 0.6 at widths 15 and
  200; by day (where the sun is high and the lane should sit far off) and
  at dusk (where it should run from the shore to the sun); filmed at dusk
  at 0.6 and 60.
- Not an HDR mirror: round one's note that the mirror wants a true bright
  sun is met by drawing the sun's lobe analytically, which costs a dot and
  a pow, not a texture format.

### E3: caustics on the sand

- `causticScale` is already an option (`cw.edge.w`, the cell's size); the
  game does not set it and takes the default. Columns: the cell at 1, 2
  and 3 times the default at the game's line 0.08 and strength 0.36.
- `causticGlow` (0 to 1, default 0): light added to what is below in the
  sun's colour by the line, `below += line * strength * causticGlow *
frame.sunColour * CAUSTIC_SUN`, beside the old term that scales the
  bed's own colour, so a caustic has a bright core even on a dark bed and
  shows the chromatic edge the reference has when its three channels are
  offset by a quarter of the line (`causticFringe`, 0 to 1, default 0,
  the offset as a share of the line's width; round one tried a fringe and
  found it read as a fault at 0.05 of a cell, so this is a share of the
  line and tried small).
- Strengths: `causticGlow` 0.3, 0.6, 1 at the game's cell and at twice it;
  `causticFringe` 0.25 at glow 0.6; by day, shore and overhead. The dusk
  row is drawn too, since the caustics follow `sunDir.z`.

### E4: the colour sweep

No package change. Three palettes drawn on the lake, each a set of
`near`, the water group's `albedo`/`second` pair (the game's
`clearShallow` and `clearDeep`) and `clarity`, and the knee:

- **As it is:** the game's figures.
- **Turquoise:** `clearShallow` toward (0.1, 0.55, 0.6), `clearDeep` kept,
  `clarity` 1.1, knee 0.5, so the shallows go green-blue over the sand and
  the deep stays.
- **Saturated:** `clearShallow` (0.05, 0.4, 0.78), `clearDeep` (0.02,
  0.16, 0.45), `clearNear` darker, `clarity` 0.6, so the colour deepens
  faster and the deep is a richer blue.

Each by day and at dusk, shore and overhead; the sick lake drawn too for
the chosen one, since `sickShallow` and `sickDeep` mix with these and an
olive lake would be the cost. The figures are guesses to be moved by what
the sheet shows, and the builder may add a fourth palette where one of
these clearly misses.

### E5: the foam's edge and the wet sand

Two halves, one each side of the pin:

- In the package, `foamFray` (default 0, the old `FOAM_BREAK` when nought)
  exposes the wobble as a share of the line's width, and `foamGrain` (0
  to 1, default 0) multiplies the line's own alpha by a finer noise
  (`flowNoise(q * 6.1)`, thresholded at `1 − foamGrain`), so the band is
  holed and frayed like froth rather than a solid ribbon. Columns:
  `foamFray` 0.5, 1, 2 at grain 0; grain 0.3, 0.6 at fray 1; by day, shore
  and overhead.
- In the game, a **wet strip**: a band of darker, more saturated sand
  inside the foam line, drawn by the bed's own sheet (`bedBands()` in
  `scene.ts`, a new band in `BED_SHALLOWS` with `PALETTE.wetSand`) and not
  by the water. The sheet shows it as a mock: the lake's sand ring in the
  lab darkened in a band 0.4 units inside the waterline, at two darknesses,
  since the bed colouring is the game's and the lab's lake has no bands. If
  chosen it is a part in ooerfish alone.

### What part 0 hands back

- The sheets `/tmp/crystal-2/sheets/E1.png` to `E5.png` and the films
  under `/tmp/crystal-2/film/`, each looked at by the builder and said
  what it shows, in the report, with a recommendation per experiment and
  the frame's cost of each option on `standard clear` timed in turn (the
  option off against on, same run), on the reference adapter, read from
  `perf.gpu.test.ts`'s new scenes.
- The golden green before the first picture and after the last, and seen
  to fail once with an option forced on inside the renderer.
- `npm run typecheck && npm test` green, nothing committed, the worktree
  left for the user to look at, as round one's was.
- About a day (_guess_).

## What part 0 found, and what the user chose

Drawn 15 October 2026 on the package's lake, by day and at the game's
dusk, from the shore, overhead and looking toward the sun (a row the
builder added, since neither of the plan's views could show a lane).

- **E2, the sun's lane,** is the strongest picture. Looking toward the sun
  by day it is a field of bright flecks broken by the fine waves, the
  glint of the reference; at dusk a soft pink-gold path. 0.3 is a hint,
  0.6 a lane, 1 starts to wash out; width 15 washes the water white and
  200 leaves sparse, crisp flecks.
- **E1, the glitter aimed at the sun,** misses: the renderer's own
  glitter is a few chunky bars overhead and nothing from the shore, and
  aimed at the sun it is a thin column at dusk. The lane does its work.
- **E3, caustics on the sand:** a cell at twice the default is a calmer,
  clearer net; `causticGlow` 0.3 to 0.6 gives bright cores on the sand and
  1 is too much; the fringe is a faint orange edge, not a fault.
- **E4, the palettes:** saturated is the richer deep blue, turquoise
  washes the deep out, and the sick lake is olive under all three.
- **E5, the foam:** `foamFray` only bulges the line; `foamGrain` is what
  frays it, dashes at 0.3 and froth at 0.6. The wet-strip mock read as a
  grey ring on the lab's steep bank.
- **The cost,** six runs on a busy machine, each against `standard clear
finish` in the same run: no option stood clear of the wobble (glitter
  about +0.03 ms, lane +0.01, glow +0.03, fray 0). To be timed again on a
  quiet machine in the parts below.

**The user chose (15 Oct):** the sun's lane at 0.6 and width 60; the
caustic glow with the cell at twice the default; the saturated palette;
the foam grain at 0.3. The glitter (`glitterSun`, `glitterGrain`), the
fray (`foamFray`), the fringe (`causticFringe`) and the wet strip are
dropped and are not built.

**One thing the take-in must settle:** the lane shows only where the camera
looks toward the sun. The game's day sun is high in the south-east
(`[0.45, -0.5, 0.74]` in `look.ts`), behind the angler on the south shore,
so from the Shore view the lane will show at dawn and dusk toward the
edges and hardly by day. Where the sun stands is the user's to pick, from
the game's films, in part 3.

## Parts

Each part's acceptance tests are written first and seen failing. The
package's golden (`cleargolden.gpu.test.ts`) holds v0.42.0 to the pixel
with every new option at its default, through every part.

- [x] **Part 1: the three options built** (done 15 Oct: `66a6e57` and `d824138` in artshape-render, the perf keys 0.74 ms each written on a quiet machine; the golden does not see the lane at 0.6 and power 60, its sun being behind its camera, so the new GPU test holds that figure; the grain also holes the plain foam band, for both foam paths alike) (artshape-render, branch
      `crystal-2-build` cut fresh from `v0.42.0` in a worktree
      `artshape-render-crystal2-build`; the sheet's worktree is the
      reference to port from and is not built on). `sunLane` (0 to 1) and
      `sunLaneWidth` (the lobe's power), `causticGlow` (0 to 1) and
      `foamGrain` (0 to 1), each nought by default, packed in one vec4
      after the drift (`CLEAR_FRAME_FLOATS` 108 to 112), refusals and
      packing held by `clear.test.ts`. A GPU test per option that it draws
      what it is for: the lane brightens the water toward the sun and not
      away from it, and draws nothing from a sun under the horizon or in
      the shadow; the glow lightens the caustic lines on a dark bed where
      the old term cannot; the grain holes the foam line and leaves water
      outside the line untouched. The golden seen failing with each option
      forced on in turn, not one alone. A spec,
      `docs/specs/clear-water/crystal-2.md`, in the shape of `drift.md`; the
      sheet's report carried onto the branch with **Chosen** filled in. The
      perf scenes `standard clear lane`, `standard clear caustic glow` and
      `standard clear grain`, timed against `standard clear finish` in the
      same runs; their baseline keys written by hand only on a quiet
      machine, and otherwise left and said so. `npm run typecheck && npm
test`, `npm run test:gpu` and `npm run perf:gpu` green. Left uncommitted on the branch for the user's go, not merged, not tagged. Half a day (_guess_).
- [x] **Part 1b: the release** (done 15 Oct: v0.43.0, `d950981`, pushed; the lock's own version, left at 0.41.1 by v0.42.0, brought to 0.43.0 with it) (artshape-render). On the user's go: the work committed, the branch merged to main, the version to 0.43.0, tagged, pushed.
- [x] **Part 2: the saturated palette** (done 15 Oct: `7f34ec9` on main, the clarity kept at 0.6 though it dims the fish's glow) (ooerfish, no release, in a
      worktree on `SMOKE_PORT` 5206). `PALETTE.clearShallow` (0.05, 0.4,
      0.78), `clearDeep` (0.02, 0.16, 0.45), `clearNear` (0.01, 0.05, 0.2)
      and `CLEAR.clarity` 0.6, the knee kept at 0.4, held by the water and
      palette tests seen failing first; the sick lake's mix left as it is
      and its pictures looked at for it. The look pictures through
      `/gate-moved`, every one looked at, by day, dusk, dawn and night;
      the pass, with the perf gate (a palette costs nothing, and the frame
      is held to that). A branch of its own, left uncommitted for the user's go, not merged. A few
      hours (_guess_).
- [x] **Part 3: the options taken in** (done 15 Oct: see its record below) (ooerfish, after parts 1b and 2).
      The pin to v0.43.0 in a commit of its own; then `CLEAR.sunLane` 0.6
      and `sunLaneWidth` 60, `causticGlow` at what the game's films say
      between 0.3 and 0.6 with `causticScale` at twice the default, and
      `foamGrain` 0.3. The lane filmed from the Shore view at dawn, day and
      dusk with the sun where it is and at two placements toward the
      north, for the user to pick where the sun stands; the pick lands as
      figures in `look.ts`. The pictures through `/gate-moved`, the pass,
      the perf figures before and after. One to two days (_guess_).

**Part 3's take-in (15 Oct):** the pin to v0.43.0 in a commit of its own,
every look picture holding to the pixel. Stills of the clean lake from the
Shore view at dawn, day and dusk, with the lane at 0.6 and power 60, the
glow, the doubled cell and the grain on, the sun at four placements: where
it stood, to the side, north and high, north and low. The lane shows only
with the sun ahead of the angler, and then the cliff, which faces the
angler, falls into shade; north and low gave a whole field of glints by day
and pink lanes at dawn and dusk, at the cost of a backlit cliff all day.
**The user chose** the day sun where it stood and dawn's and dusk's moved
north and low, `[0.45, 0.8, 0.35]` and `[-0.45, 0.8, 0.3]`, so the lanes
come at the ends of the day and the cliff stays lit by day. The glow was
settled at 0.45, the middle of the sheet's range, from the overhead still:
a crisp net on the sand ring, not overpowering. `CLEAR.sunLane` 0.6,
`sunLaneWidth` 60, `causticGlow` 0.45, `causticScale` 3 (twice the
renderer's 1.5 units at 100 mm a unit), `foamGrain` 0.3, held by
`test/water.test.ts`, and the suns by `test/look.test.ts`, both seen failing
first. Sixteen look pictures moved, each looked at: the dusk pair a field of
pink glints across the west of the water, and on the sick lake a gold
sheen; the rest the crisper caustic net and the frayed foam, on the water
only. The download moved from 114,608 to 115,379 gzipped bytes, 58 of them
the figures and the rest the renderer's shader with the pin, whose own
commit left the download gate red; the frame read 3.64 ms against 3.54,
within tolerance; every other gate held and twenty-four fuzz seeds broke
no rule. Not looked at: the lane at night, whose moon stands where it did.

- [x] **Part 4: the cured lake crystal clear** (ooerfish, 15 Oct). Asked
      for after part 3: the water was still opaque and not the bright,
      sunny water of the reference. Built from a sheet of the game's own
      lake, the user picking its fifth row.

**Part 4's record (15 Oct):** what made the cured lake opaque was the
game's own figures, not the renderer's. The bed was a near-black slate
under everything deeper than 2.6 units, and clear water over a black bed
reads as dark water. The clarity of 0.6 lost red light within a fifth of a
unit and blue within one, so past the shallows only the water's own colour
was seen. That colour was navy, darker still by the camera, and the sky's
mirror at 1.2 covered the far water from the shore. Part 2's saturated
palette, recommended from round two's sheet, lowered the clarity and
darkened the colours, and so pulled the wrong way; it is undone here.

A sheet of six, each building on the last, from the Shore view, overhead,
the boat and the sick lake: clarity 3 alone and the sand under the whole
lake each helped from overhead and left the shore view navy; the turquoise
colours with half the mirror were the jump; clarity 6 on top was crystal
clear, the sand seen through to the middle; and the slate kept at clarity 6
left the middle a darker teal. **The user chose the fifth:**
`PALETTE.clearShallow` (0.1, 0.62, 0.72), `clearDeep` (0.04, 0.42, 0.62),
`clearNear` the shallows' own colour, `CLEAR.clarity` 6, `mirror` 0.6, and
`BED_SHALLOWS.depth` 5.5, so the blend toward the slate ends past the
deepest point and the middle is a darkened sand. The sick lake's clarity
became a figure of its own, 0.15, the murk it had, rather than a share of
the clean one's, so the cured lake grows clearer without the sick one
following; the sick colours are untouched.

At a depth of 5.5 the bed's cut rule made a first band from nought to
4 × 10⁻¹⁹, an empty slate band that passed the test that each band starts
where the last ended. `bedCuts` now asks of the depth against `MAX_DEPTH`
whether the slate is reached, and when it is not, cuts the bands evenly from
the middle; a test holds both cases, and the old condition, on the share,
was seen failing it. The scene's hash moved with the bed's colours and
rings. Sixteen look pictures moved, each looked at: the cured lake bright
turquoise over sand from every view and time, the weed, rocks and fish seen
through it, the dusk lane still on it; the sick lake the same murky green,
a little flatter where the mirror lightened it.

## Out of scope

The ocean's whitecaps and open swell, foam from breaking waves, the
underwater view, a second water style, the sky, the fog, tone mapping and
bloom (the lane's halo is what bloom gives it, and bloom is as it is), the
boat, and anything in the game's logic. The sparkles stay as part 14 left
them unless the user's pick of E1 says to lower or remove them.

## Verification of part 0 itself

- The lab runs with `VITE_FRAME_DIR=/tmp/crystal-2 npx vitest run --config
vitest.browser.config.ts src/game/__tests__/crystal2.gpu.test.ts` and
  writes the five sheets and the films; without the variable it says so
  and draws nothing.
- `npx vitest run --config vitest.browser.config.ts
src/game/__tests__/cleargolden.gpu.test.ts` green at the start and the
  end, and red once with an option forced on.
- `npm run perf:gpu` reads the new scenes (`standard clear glitter`,
  `standard clear lane`, `standard clear caustic glow`, `standard clear
fray`) and the report carries their figures against `standard clear
finish`, the scene each adds to.
- Every sheet is looked at by the builder, and then by the user.
