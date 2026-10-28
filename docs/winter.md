# Winter's dressing: snow on the rocks, a frosted beach, frost at a clean lake's edge, and the glow brighter against the white

## Context

Stage 6 of `DESIGN.md` says winter is "snow on the banks, the cabin roof and the boat's cover, frost on the reeds,
mist on cold mornings, and the glow brighter against the white", and a lake fully cleaned gets "in winter a lace of
frost at its very edge (scenery only)". The seasons slice gave winter its white grass, a white roof, a grey deck,
pale trees, flakes and mist. The winter picture still shows summer's sand beach, dark boulders and cliff lumps
with no snow on them, dark pebbles, pink clumps, and the fish no brighter. This is slice A3 of `docs/roadmap.md`,
the tidy that lets stage 6 read done; there is no boat yet, so its cover waits on Part C.

**Chosen by the user (28 Oct 2026):** _agreed as written; no decision was the user's._

## What

- **Snow caps on the rocks.** `snowCap(mesh, rise)` in `src/rocks.ts`: from a painted, split rock (flat per-face
  normals, `indices[i] = i`), the triangles whose normal's z is over `SNOW.facing` (0.55) and whose centroid is
  above `SNOW.from` (0.35) of the rock's rise, lifted `SNOW.lift` (0.08) along their normal, as a mesh of its own
  with no paint; one for each boulder dome and each cliff lump, memoised with the rocks per lake. In winter
  `Scene.static(kit, palette, season)` appends a cap group per rock after every other group, with the rock's own
  matrix and `palette.snow` (new, `[0.93, 0.95, 0.98]`); in any other season it appends nothing, so summer's
  group list, slots and hash hold to the bit and the autumn test still finds the same meshes index by index.
- **The beach and the pebbles frosted, the clumps whitened:** the beach band (the last of `BED_SHALLOWS.bands`,
  all sand) takes `palette.sand` itself rather than a mixed copy, so a season may recolour it; `sand`, `pebble`
  (the kit's pebble role) and `flowers` (the clumps' role) join `SeasonColour`, and winter's palette sets them pale
  (`sand` a frosted cream, `pebble` a blue-grey, `flowers` a white-pink), the summer values untouched so no other
  picture moves. The builder checks which role the clumps take and names it.
- **Frost at a clean lake's edge.** `src/frostdraw.ts`, `FrostDraw`: a thin ring sheet (`sheet` from
  `src/meshes.ts` on `ringOn`'s waterline) from `FROST.inner` (1.0) to `FROST.outer` (1.045) of the shore radius,
  on the bank at `groundUnder + FROST.lift` (0.03), `palette.frost` (`[0.9, 0.95, 1]`), unlit through `FLOW_GLOW`
  faintly, one moving group in the dynamic set, appended last (after the rainbow), scaled to nothing unless the
  season is winter and the lake is clean (`pondClean`), handed over by `main.ts` only when the season or the
  water's shown dirt changes (it rides `showWater`); `game.season()` reads `frost` (shown) and `caps` (the count).
- **The glow brighter against the white:** `SEASON_DRESSING.<season>.glow` (winter 1.25, the others 1) scales
  the fish's body and fin glow in `fishdraw.ts`'s materials (`FISH_BODY.glow`, the cured glow too), the fish's
  groups handed over at `dress` as they are when the count cured changes.

## Where it stands now (read)

- Winter's palette moves `leaves`, `crown`, `bladeBase`, `bladeTip`, `cabinRoof`, `deck`; nothing else.
- Each rock is 64 triangles; a cap is the upward third or so, about 20 triangles, times 10 boulders and lumps.
- The static set's summer hash is held by `test/scene.test.ts`; `game.scenery()` counts placements, not groups.
- Winter pictures: `season-winter-day`, `season-winter-night-mist`, `season-winter-lean`, `phone-season-winter`,
  `weather-snow-winter`, all at cured 6, none clean.

## Acceptance criteria

1. A cap holds only triangles facing up and above the height, lifted by the lift, the same each build, and under
   half the rock's triangles.
2. Summer's static set is unchanged to the bit (its hash), autumn's meshes are summer's, and winter's is summer's
   groups followed by one cap per rock, with the rock's matrix.
3. The beach band is `palette.sand` by identity, and winter's palette recolours it, the pebbles and the clumps.
4. The frost ring lies on the bank between the inner and outer shares of the shore radius, just above the ground,
   with every vertex outside the waterline; it is shown only in winter on a clean lake, and handed over only when
   the season or the shown dirt changes.
5. The fish's glow in winter is `glow` times summer's, cured fish too; `game.fish()` or the materials read it.
6. `game.season()` reads `caps` (30 at the pond in winter, one a boulder and one a cliff lump; 2 at the Reservoir; 0 in
   summer) and `frost`.

## Edge cases (from the checklist)

- **save:** nothing new. **the day:** the dressing comes at a wake into winter and goes at the wake out; the caps
  are static so they cost nothing by look; the frost shows by day and night.
- **the seasons:** every other season appends no cap and shows no frost; day 57 (summer again) drops them.
- **the lakes:** the Reservoir's two boulders cap; it has no cliff; its frost ring on its own shore.
- **the rung:** the caps and the frost on lean too (static and one sheet).
- **the lake's contamination:** the frost shows at clean only, read from the cures and the drums (`pondClean`), never
  from the lever: `game.dirt` is the picture's water, and the design's frost is for "a lake fully cleaned".
- **the water:** the ring sits above the bank, never on the water (`inside` false for every vertex).
- **the switches, the mode, the line, the fish, the phone, the weather, the real clock:** not reachable.

## Decisions (mine, said so they can be changed)

- **Caps are geometry, not a recolour,** since a white boulder reads as chalk, not snow; and they are appended
  last so no summer picture or slot moves.
- **The glow boost is a season figure,** not a palette key, since it scales a material, not a colour.
- **The frost is dynamic,** since "clean" changes at play and the static set changes only at a dress.

## Performance risk

- **Frame:** about 200 triangles of caps and one ring sheet, static; measured by `measureFrame` in the winter
  scene and told. **Boot:** the caps are built with the rocks, once. **Download:** about 1.5 kB gzipped.

## Test plan

- **Unit:** `test/rocks.test.ts` (1); `test/scene.test.ts` (2, 3: the hash, the winter list); `test/season.test.ts`
  (winter's keys, `glow`); `test/frostdraw.test.ts` (4); `test/fishdraw.test.ts` (5).
- **End to end, `smoke/progress.spec.ts` "winter's dressing":** a load on day 29 reads `caps` 30 and `frost` false
  at cured 6, and the lever moves it neither way; a clean save shows it at once and hands it over once; day 1 reads
  `caps` 0; the Reservoir 2.
- **Fuzzer and invariants:** no action (dressing), no rule; said in the report.
- **Pictures:** the five winter pictures retaken through `/gate-moved` (the caps, the beach, the pebbles, the
  clumps, the glow); new `winter-frost-clean` (cured 12, drums 2, day 29) and `reservoir-winter`.
- **Perf:** the standard scene as now; the winter frame told.

## Parts

Built on `sonnet` by the `builder` agent, from `docs/winter.md`, this spec copied into the repo.

- [x] 0. **The spec in the repo:** `docs/winter.md`; `DESIGN.md` stage 6 notes the slice; the roadmap. Check: Prettier.
- [x] 1. **The caps and the palette:** `snowCap`, `Scene.static` with the season, the beach band, the keys, the
      glow. Check: `test/rocks`, `test/scene`, `test/season`, `test/fishdraw`.
- [x] 2. **The frost:** `frostdraw.ts`, the dynamic set, `game.season()`. Check: `test/frostdraw`.
- [x] 3. **The pictures and the stage:** the smoke stage, the moved winter pictures, the new ones. Check: `npm run
look`, `smoke/progress.spec.ts`.
- [x] 4. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (the cap's facing dropped;
      the frost shown in summer; the glow unscaled), the report. Commit.

## Part 4's notes (the pass)

- **The figures as tuned on the pictures:** `SNOW` facing 0.72, from 0.5, lift 0.05 (the spec's first guesses made
  white hats of the top half of each rock); `PALETTE.snow` [0.86, 0.9, 0.96]; `FROST` outer 1.07, glow 0.5,
  `PALETTE.frost` [0.8, 0.91, 1] (invisible at the first guess, now a faint pale line at the bank's edge, subtle
  against the pale beach, and left so rather than made a glowing ring); winter's sand [0.78, 0.76, 0.68].
- **The pebbles' key is `stone`,** which the Reservoir's dam takes too, so the dam goes blue-grey in winter; a
  frosted dam reads right and it was left.
- **A boot crash from part 2** (the frost used before its declaration in `main.ts`) was caught by the first
  winter page load in part 3 and fixed.
- **The download** grew from 208,318 to 208,883 bytes gzipped, the caps and the frost; that figure was written into
  the perf baseline by hand. Boot and frame hold (794 ms, 3.96 ms against 805 and 4.02); the winter frame reads
  the same as summer's within noise.
- **The mutations:** the cap's facing dropped (the rocks test fails), the frost shown in summer (two fail), the glow
  unscaled (one fails).
- **No fuzzer action and no invariant:** a dressing, held by its unit tests and the stage.
