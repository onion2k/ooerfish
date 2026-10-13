# The painted edge in ooerfish: the plan

Written 13 October 2026. The facts hold on ooerfish `0546f35` (the cabin
and the jetty drawn) and artshape-render `v0.38.0` (`f9f7b2c`), whose
spec is `docs/specs/painted.md` there and whose README has the section "A
painted edge, from 0.38.0". The experiments that chose the look are
`docs/specs/painted-experiments.md` there, E1 to E21; the taste decisions
in them are the user's and are not reopened here. To be built by the
`builder` agent on `sonnet`, one part at a time, on a branch `painted` in
a worktree of ooerfish, on `SMOKE_PORT` 5206 beside the main checkout.
Anything marked _guess_ was not measured.

## Aim

The lake's rocks, the boulders standing in the water and the lumps of the
cliff, carry the painted edge: a few chosen ridges with a crisp stroke of
pale chalk, a loaded head and a dry tail, as the experiments' sheets
showed on rocks of the same make. The jetty and the cabin may carry a
warm faint lip of their own, which the user liked in the experiments. A
game that draws the same frame as today everywhere else: the grass, the
water, the trees and the sky unchanged to the pixel unless the user picks
the light change in part 0.

## What ooerfish draws today, and what has to change

- **The water boulders are smooth balls**, `ball(1, 16, 12)` in
  `src/scene.ts` `static()`, stretched by `BOULDER_DOMES` (`lake.ts`) to
  their domes. The painted edge needs facets, so the boulders become
  faceted lumps. That is a change to the look the user has to see first.
- **The cliff's lumps are one faceted mesh**, `ROCK` in `scene.ts` (a
  `lump` of 4 rings and 8 segments, give 0.18, floor -0.4), instanced with
  a half-width each way (`rx`, `ry`, `rz` from `cliffLumps()`). The
  painted build scales the heights by the placement's uniform scale and
  would skew on a stretched instance, so each lump is built as its own
  mesh with its stretch in `lump`'s axes and placed with a uniform scale
  of one. The lumps count is `CLIFF.lumps` (crest, foot, face), about
  thirty (_guess_; read it), so a group of one placement each, or one
  group per distinct stretch.
- **The colours**: `PALETTE.boulder` (0.22, 0.22, 0.21) and `PALETTE.cliff`
  (0.15, 0.165, 0.2). The experiments found the game's 0.22 grey lights to
  about 200 of 255 under its sun, leaving a matte lip no room, and halved
  it; the cliff at half read as charcoal at a distance. Part 0 shows the
  boulders at 0.12 and the cliff at 0.11, and the user picks.
- **The light**: `TOY` in `look.ts` (shade (0.36, 0.55, 0.66), sky light
  (0.55, 0.7, 0.92), ground light (0.4, 0.45, 0.2), form 4 which the
  package caps at 3, rim 0.2), with the times of day scaling the fill by
  `ambient`. The experiments' best frames used a deeper, cooler shade
  (0.13, 0.19, 0.34), the fill at 0.4 of the day's with a cool sky light,
  a warmer sun and occlusion 4 at radius 12 tinted toward the shade. That
  changes the whole lake at every time of day, and the fog, the water's
  mirrored sky and the grass all read the same look, so it is shown in
  part 0 and picked or not; the paint does not need it.
- **The painted build compiles sixteen pipelines** before `ready` when the
  rocks are handed in, so boot is measured (budget 3000 ms, baseline 537).
  The bundle grows about 4 kB gzipped from the pin alone (the renderer's
  shader strings), plus the mesh pass and the rocks' code.

## The interfaces

### `src/rocks.ts` (new): the lake's rocks as painted meshes

```ts
/** One rock's mesh at its own stretch, faceted, split and painted, with a budget by its world size. */
export function rockMesh(
  axes: [number, number, number],
  seed: number,
  choice: PaintChoice,
  budget: number,
  set: number,
): Mesh;
export function boulderMeshes(): { mesh: Mesh; matrix: Float32Array }[]; // one per BOULDER_DOMES entry
export function cliffLumpMeshes(): { mesh: Mesh; matrix: Float32Array }[]; // one per cliffLumps() entry
export function rockBudget(worldRadius: number): number; // 1 under 1.5 units, 2 under 3, else 3 (*guess*: from the experiments' pebble 1 and boulder 3 at radius 1 and 2 at scale 40, which is the lake's 2.5 and 5)
```

Facet counts and budgets are content in `lake.ts`: `ROCKS` gains
`{ rings: 5, segments: 8, give: 0.2, floor: -0.4, cliffChoice: 'gate',
boulderChoice: 'ridge', spacing: 0.4 }`. The rocks' seeds are the domes'
index and the lumps' index, so one more rock moves no other.

### `src/look.ts`: the paint sets

```ts
export const PAINT: PaintSet[] = [ROCK_PAINT, WOOD_PAINT, CLIFF_PAINT];
```

`ROCK_PAINT` is the package's `PAINT_DEFAULT` with `lightColour`
`PALETTE.chalk` (new, (0.62, 0.55, 0.42)); `CLIFF_PAINT` over it with
`widthFacet` 0.06 and `gate` 0.45 and the chalk a quarter cooler
(`PALETTE.chalkCool`); `WOOD_PAINT` with `lightColour` `PALETTE.chalkWarm`
(0.8, 0.66, 0.48), `light` 0.5, `widthFacet` 0.05, `gate` 0.5, no marks
(`markValue`, `markEnd`, `markHue` at 0), `choice: 'gate'`. `lookFor(time)`
adds `paint: PAINT` to what it returns; the times of day do not change it
(the lip is mixed into the albedo, so night lights it as it lights the
rock).

### `src/settings.ts`, `src/lab.ts`, `src/debug.ts`: a control on the lab

`paint: 'on' | 'off'` in `Settings`, default `on`, checked in `CHECK`,
`?paint=off` in the address, a toggle on the panel, `game.paint(value)`
on the test API resolving when applied. Off sets every set's `light` and
`dark` to nought through `look.paint` (the meshes stay painted; the build
draws them plain), so the pictures and the user can compare in place.

### `src/cabin.ts`: the wood (only if the user picks it in part 0)

`cabinGroups()` and `jettyGroups()` hand their timber meshes through
`split` then `painted` with `set` 1 and `choice: 'gate'`; the window's
glass and the chimney's stone stay as they are (the chimney may take set 2
if it reads well; the sheet shows both).

## Parts, in build order

A box is ticked as its part lands with its check green. Points 3 to 8 of
the definition of done run once, in part 5.

- [x] **0. The sheet, for the user to pick from.** (made 13 Oct on the throwaway branch `painted-sheet`, commit 11f093a. **The user picked, 13 Oct: D's rocks (boulder 0.12, 0.12, 0.115; cliff 0.11, 0.12, 0.145), E's light, and the wood painted.**) On a throwaway branch,
      made in an hour and not kept: the lake's standard scene and the shore
      view by day, dusk and night, as pictures through `start()` in
      `smoke/game.ts`, in these columns: today; the boulders and cliff lumps
      faceted and plain; faceted and painted with `ROCK_PAINT` and
      `CLIFF_PAINT` at today's colours; the same at the darker colours
      (boulder 0.12, cliff 0.11); the same under the experiments' light
      (shade (0.13, 0.19, 0.34), fill at 0.4 with sky light (0.20, 0.25, 0.42)
      and ground light (0.15, 0.17, 0.13), sun (2.9, 2.5, 1.9) by day and the
      other times' suns scaled alike, occlusion 4 at radius 12 with
      `occlusionTint` 1 and direct 0.25); and the jetty and the cabin with
      `WOOD_PAINT`. Tiled with labels, sent to the user. **The user picks:**
      the rock colours, the light or not, the wood or not. Nothing else is
      built until they have. Check: the sheet seen by the user and their
      three answers written under this box.

- [x] **1. The pin.** (b87bd2e; bundle 100,846 to 105,034 bytes, no picture moved) `artshape-render#v0.38.0` in `package.json`, `npm
install`, the lockfile. Nothing imports the mesh pass yet. Check:
      `npm run check:quick` green; `npm run look` unchanged to the pixel; `npm
run perf` fails on `bundleBytes` by the renderer's growth alone, which
      `/gate-moved` writes again with the bytes said (_guess_: about +4,100
      gzipped) and `bootMs` within its tolerance; the commit says both.

- [x] **2. The rocks.** (26f6977; bundle to 108,934; frame about 2.69 ms against 2.53, boot median 656 ms against 537 with the parent at 608 the same day, both inside tolerance and not rewritten; 16 pictures moved and looked at) `src/rocks.ts`, the content in `lake.ts`, the
      groups in `scene.ts` `static()` taking the rocks from it (the boulders'
      group and the lumps' group replaced; the bed rocks under the water stay
      the smooth balls, since the water blurs them), `game.scenery()` counting
      the rocks' triangles and placements, and the lab control with
      `game.paint()`. Tests first, seen failing: `test/rocks.test.ts` holds
      the counts (one mesh per dome and per lump, each with `paint` of
      `PAINT_STRIDE × vertices` floats, no shared index, its stats' open edges
      nought and ridges chosen equal to its budget where the choice is ridge),
      the budgets by size (1, 2, 3 at the thresholds), determinism (two calls
      equal bytes), and that the boulders' meshes fit their domes (`groundAt`
      over a dome's footprint is not under the mesh's highest point, within
      the dome's `tall`); `test/scene.test.ts` holds the new figures;
      `test/settings.test.ts` the `paint` key refused when unknown;
      `smoke/game.spec.ts` the control clicked and `game.paint('off')` drawing
      the rocks plain (a pixel count against on). Check: those tests, `npm
run check:quick`, `npm run look` moved on every picture with rocks in
      it, written again through `/gate-moved` and every picture looked at,
      `npm run perf` within budget with `frameMs` and `bootMs` said against
      their baselines (boot carries sixteen more pipelines; if it passes its
      tolerance the baseline is written again and the commit says why; if not,
      stop and ask).

- [x] **3. The colours, and the light if picked.** (a0bb7b6; the occlusion costs about 0.2 ms and the frame baseline was written again, 2.53 to 2.95 ms, for a change meant to move it; 16 pictures moved and looked at; boot typically 633 to 779 against 537, not isolated) `PALETTE.boulder` and
      `PALETTE.cliff` to the user's pick, `PALETTE.chalk`, `chalkCool` and
      `chalkWarm`; if the light was picked, `TOY` and `TIMES` to the
      experiments' values with the fill, sun and occlusion scaled by each
      time's `ambient` as today's are, and the water's mirrored sky and the
      fog checked at each time of day in the pictures. Tests: `test/look.test.ts`
      holds the sets' colours to the palette and that `lookFor(time).paint` is
      `PAINT` at every time; the palette test, if there is one, the new
      entries. Check: `check:quick`, the pictures moved and looked at, each
      time of day and view on the lab by eye in headless Playwright, the
      pass's `measureFrame` at the standard scene and the night scene.

- [x] **4. The wood, if picked.** (38bb8ea; a faint warm lip on the eaves and the deck's rim, no measurable frame cost; 12 pictures moved) `cabin.ts` through `painted` with set 1,
      `test/cabin.test.ts` holding the meshes painted and the glass not, the
      pictures with the cabin in them moved and looked at.

- [ ] **5. The pass.** `npm run check` green; `npm run fuzz -- --seeds
1-24` clean; `measureFrame` at the standard scene, the shore by night,
      the boat and the overhead, each against its parent commit, in the
      report; the rung `lean` drawn with the rocks painted (the paint is not
      gated by the rung; if `lean` cannot hold 8 ms with it, the paint joins
      the grass on `full` only and `game.rung()` is held to it) and the
      governor's choice at boot unchanged; `npm run leaks` for ten minutes with
      nothing new kept (the meshes are built once); the phone width looked at;
      the report point by point against the definition of done, with what was
      not verified said plainly.

## Edge cases, from the project's checklist

- **The lab:** each time of day with the paint on and off, each view; the
  address `?paint=off` and `?paint=maybe` refused by name.
- **The rung:** `full` and `lean` with the rocks painted; the governor at
  boot.
- **The water:** a boulder's painted ridges under the water are seen
  through it as the rock is, and the foam rings and splashes keep off the
  boulders through `BOULDERS` as before (the mesh is not what they read).
- **Scale:** every boulder and lump painted at once is the whole of it;
  the frame at the standard scene is the measure.
- **Save:** nothing saved.
- **Determinism:** the rocks are built from fixed seeds, not the game's
  `random`, and `npm run determinism` is unchanged.

## Out of scope

- A pile of rocks, a slab rule for the cliff's face sheet (`steep` stays
  plain: it is a sheet, not a solid), the silhouette rule and ribbon
  strokes.
- The trees (the experiments found they take nothing well).
- The bed's rocks under the water and the kit's pebbles.
- Any change to artshape-render; what the rocks need and do not have is
  reported, not patched here.

## What is handed back

A report per part, and the pass's report at the end: the figures before
and after (frame, boot, bundle bytes), the pictures looked at, what was
not verified, and the three decisions the user made in part 0 written
under its box.

## Part 0 findings, 13 October 2026

- The boulders cannot be a lump stretched to the dome's axes: the domes are
  2.3 to 5.9 tall with 0.6 to 1.2 out of the water, so only the pole's fan
  shows and every boulder is a pyramid. The sheet built each as a unit
  lump with its middle at the waterline and its waterline radius across,
  the upper half stretched to the rise and the lower to the depth, normals
  worked out again (`twoHalves` in the sheet's `src/sheet.ts`). Part 2's
  `rockMesh` for boulders takes this shape (or more rings).
- `lookFor` does not exist at 0546f35: the look is applied by
  `light(renderer, ctx, time)` in `look.ts`, so the paint sets go there and
  part 3's test names that.
- The pin alone moves no look picture (all 18 pass on v0.38.0); a plain
  `npm install` kept 0.37.0 from the lockfile, so the pin is installed
  by name.
- The budgets by waterline radius came out 2, 2, 1, 1 for the four
  boulders. The darkening of D is less than halving suggests (a lump 139
  to 120 of 255) because the fill and the haze lift it. E changes the
  whole lake (grass 15% darker, the cliff charcoal, dusk's cliff near
  black) and leaves the water within 2%. The wood lip barely reads at the
  cabin view's distance. `hideOverlays` in `look.spec.ts` does not hide
  `#boot`, whose text can be caught fading in a picture taken right after
  boot.
