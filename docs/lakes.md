# The lakes: the Duck Pond becomes one of several, and the Reservoir is the second, reached by a map in the cabin

## Context

`DESIGN.md` names a run of lakes after the Duck Pond, each its own course (stage 11, "the lakes after the first").
The code has one lake baked in: the pond's shore, bed, ground, boulders, cliff, falls, jetty, cabin, fish, drums,
treasures, views and scenery seeds are functions and constants in `src/lake.ts`, and about twenty modules import them
by name (`scene.ts`, `grass.ts`, `shorefield.ts`, `water/surface.ts`, `rocks.ts`, `falls.ts`, `cabin.ts`,
`cabinroom.ts`, `fish.ts`, `cast.ts`, `lure.ts`, `invariants.ts`, `game.ts`, `progress.ts`, `main.ts` and more).
The save keeps one cured count, one drum count, one journal, one set of finds.

**Chosen by the user (21 Oct 2026):** no stream (a flowing water is a slice of its own, later); **the refactor first**,
behaviour unchanged, then **the Reservoir** as the second lake, reached by **a map in the cabin**; **every lake open
from the start**. These land as two commits: the refactor, every picture pixel for pixel the same, then the feature.

## What

- **A `Lake`** (`src/lakes/lake.ts`, the interface): a lake's id and name; its geometry (`shoreRadius`, the stretch,
  `inside`, `inShore`, `inward`, `bedDepth`, `ground`, `bareGround`, `groundUnder`, the max depth, bank top and rise,
  the boulders' domes, `boulderGap`, `nearestBoulder`); its dressing (`cliff` and `notches` or none, the falls'
  speeds, the jetty and cabin or none, `cabinGap`, `jettyGap`, `nearestOnDeck`, the scenery counts and seeds now in
  `scene.ts`, `grass.ts` and `rocks.ts`, the shadow box); its fishing (`fishCount`, the slots' kinds, the placement
  extents now hard-coded in `fish.ts`, the shore and depth margins, the angler's place, `landAt`, the cast's reach, the
  pace angler's aim, the water's pace); its bed finds (the drums' and treasures' specs: counts, seeds, places, the
  treasures' list); its `views` and `surface` figures; and the cure's arithmetic from its own counts (`toClean`,
  `total`, `contaminationAfter`). The rules stay in `src/lake.ts`: `CLOCK`, `FIGHT` (less `landAt`), `FISHING`,
  `SIZE`, `TEMPERS`, `SWIM`, `CURE`'s shape, `HEAL`, `NIGHT`, `GEAR`, `CALENDAR`, `SEASONS`, `SEASON_DRESSING`,
  `KINDS` (the dictionary of kinds, the journal's key space; a lake lists its slots from it), `DRUMS`' and `TREASURES`'
  rule halves (`worth`, `reach`, `rate`, `dip`, `ring`, `fill`), the splash, release, phone, rung, falling and particle
  figures.
- **The Duck Pond** (`src/lakes/duckpond.ts`) is that object, every figure moved from `lake.ts`, `scene.ts`,
  `grass.ts`, `rocks.ts`, `fish.ts` and `angler.ts` and no figure changed, so every existing picture holds. `LAKES` in
  `src/lakes/index.ts` is the registry by id, `HOME` the Duck Pond, where the cabin is.
- **Everything built from the shape takes the lake:** `new Scene(lake)`, `bankField(lake, kind)`, `shoreField(lake,
size)`, `surface(lake)`, `boulderMeshes(lake)`, `fallMists(lake)` and `fallGroups(lake)`, `cabinGroups(lake,
palette)`, `jettyGroups`, `roomGroups`, `lampAt`, `places(spec, lake, avoid)` (the seam that exists), `School.fill`
  and its steering, `Bite`, `cast`, `Lure`, `castdraw`, `drumdraw`, `treasuredraw`, `fishdraw`, `checkInvariants(game)`
  reading `game.lake`, `Game` (`options.lake`, default the Duck Pond), the angler (`lake.aim`), and `main.ts` wiring
  one lake at boot. Module-level memos (`bedBands`, `surface`'s `made`, `rocks`' `boulders`, `FALLS`, `NOTCHES`,
  `DECK`, `CABIN_AT`, `CABIN_FLOOR`, `VIEWS.cabin`, `DRUM_PLACES`) become per-lake, keyed by the lake object in a
  `WeakMap` or made in the lake's own constructor, so a second lake moves nothing of the first.
- **One lake a page.** The page builds the lake the save names at boot and never swaps it: travel is a reload, as
  Start again is, under a fade. That keeps the boot's "built once" rule and every memo honest, and costs a boot
  (about 0.8 s) per journey. A load into the cabin fades in over `NIGHT.fadeIn`, as a wake does, so the cut is hidden.
- **The save** gains `lake` (the id, default `duckpond`; unknown ids read as the Duck Pond) and `lakes`, a record by
  id of `{ cured, drums, journal, found }`, each read against that lake's counts, kinds and treasures as today. An old
  flat save reads as the Duck Pond's entry; `persist` writes the new shape only; `test/saves/` gains the two shapes.
  The gear is the angler's: `gearFor` takes the cured count summed over every lake, so a journey resets nothing. The
  journal is kept per lake and the journal page shows the current lake's under its name. `day`, `time` and `place`
  stay the angler's.
- **The Reservoir** (`src/lakes/reservoir.ts`), the design's second lake, first guesses tuned by the pictures: an oval
  about 1.6 times the pond across and 1.5 times as deep, a straight dam wall along the north bank where the pond has
  its cliff (a painted concrete face from `lowpoly`'s blocks, no falls, no notches), two boulders, no jetty and no
  cabin, trees and the kit's clumps around, the angler on the south bank, sixteen fish (the three kinds, 5/7/4), three
  drums, no treasures yet (the other lakes' sets are a later slice, as `DESIGN.md` says), its own cure arithmetic
  (nineteen cleans), its own views (`shore`, `boat`, `overhead`, `phone`; the cabin views are the home's), its own
  gauge name. No cabin means no waking there: the day's end at the Reservoir yawns as now, and the wake is at home.
- **Waking is at home.** At `woke`, when the lake is not the home, the page writes the save (the day up, place cabin,
  lake `duckpond`) and reloads under the fade; the load opens in the cabin as the time slice already does. At the
  home lake nothing changes.
- **The map in the cabin** takes the empty picture's frame on the lake wall (`CABIN_ROOM.furniture.picture`, between
  the door and the window): a sheet with each lake as a flat blob in the water's colour and a red pin on the lake
  last fished, static but for the pin (one moving part, as the calendar's today is, handed over on change). A tap on
  the map in the cabin view (a ray from the tap to the map's rectangle, `src/pick.ts`'s way) opens **the lakes page**,
  a page like the journal's (`#lakes`, its words the pure `lakesWords` in `src/lakes/page.ts`: each lake's name, its
  glow left as a share, "You are here" on the current one), from the ⋯ menu as "Lakes" too, and from the morning's
  "Down to the pond" button, which becomes "Out to the <lake>" naming the lake last fished, with "Somewhere else…"
  beside it opening the page. Choosing the current lake goes out as now; choosing another writes `save.lake`, place
  `pond`, and reloads. The page stops the clock as every page does. Choosing from the pond (the menu) is allowed too:
  the lure is reeled in first; it is refused mid-fight as bed is.
- **The test API:** `game.lake()` reads the id and name; `game.lakes()` the registry's ids; `game.travel(id)` what the
  page does (resolving before the reload begins, so a test can wait for `load`); `game.openLakes(open)` the page.
  `start(page, { save: { lake } })` is how a test or picture opens a lake.

## Where it stands now (read)

| Figure                    | Now                                                                                                                         | Source                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `lake.ts`                 | 1328 lines, rules and the pond's content interleaved, no type separates them                                                | `src/lake.ts`              |
| Direct importers of shape | about 20 modules in `src`, by name; `BedWorld` the one seam                                                                 | the sweep                  |
| Hard-coded pond numbers   | `fish.ts` 40×30 extents, `angler.ts` AIM, `scene.ts` counts and seeds, `grass.ts` seed, `rocks.ts` seeds, `falls.ts` speeds | the sweep                  |
| Module memos              | `bedBands`, `surface`, `boulders`, import-time `FALLS`, `NOTCHES`, `DECK`, `CABIN_AT`, `VIEWS.cabin`, `DRUM_PLACES`         | the sweep                  |
| The save                  | flat `{ cured, drums, journal, found, day, time, place }`, 80 B fresh                                                       | `progress.ts`              |
| Pictures of the pond      | over 60 of 77                                                                                                               | `smoke/screens`            |
| Perf                      | boot 800 ms, frame 3.68 ms, download 187999 B                                                                               | `smoke/perf-baseline.json` |

## Acceptance criteria

**The refactor (commit one):**

1. `src/lake.ts` holds rules only; `src/lakes/duckpond.ts` holds the pond; nothing in `src/` but `lakes/` and
   `main.ts` names the Duck Pond.
2. Every builder and reader takes a lake; a test builds `new Scene(DUCK_POND)` and a `Game` with a lake handed in.
3. Every existing picture is unchanged to the pixel; the perf baseline moves only in bytes; the bench, pace and
   balance baselines hold; the fuzzer and determinism are clean with no change to their hashes' meaning.
4. The save still reads and writes as today (the refactor changes no field).

**The feature (commit two):**

5. A save with `lake: 'reservoir'` opens at the Reservoir: its shore, its sixteen fish, its three drums, its gauge
   name; the invariants hold there over the fuzzer's seeds; `game.lake()` reads it.
6. The save's `lakes` record keeps each lake's cures, drums, journal and finds apart; an old flat save reads as the
   Duck Pond's; a cure at the Reservoir moves only its entry; the gear reads the sum.
7. The map hangs in the picture's frame with a blob a lake and the pin on the lake last fished; a tap on it in the
   cabin opens the lakes page; "Lakes" in the ⋯ menu and "Somewhere else…" by the morning's button open it too; the
   page stops the clock.
8. Choosing another lake reloads and opens at its pond; choosing the current one goes out; mid-fight it is refused.
9. The day's end at the Reservoir wakes at home in the cabin, day up, under the fade; the next "Out to the Reservoir"
   goes back.
10. Perf: the Reservoir's frame from the shore by day under 8 ms and said; its boot said; the download's growth
    written and said; the standard scene (the pond) unchanged within tolerance.

## Edge cases (from the checklist)

- **save:** the flat save, a save naming an unknown lake (the Duck Pond), a `lakes` record with an unknown id in it
  (ignored, kept as is? dropped: say which in `progress.ts`; dropped), a lake's entry over its counts (clamped as
  today), a cabin save at the Reservoir (impossible by construction: read as the home, place cabin).
- **scale:** the Reservoir's sixteen fish under `FISH_CAPACITY`; the leaks' ceilings become the max over `LAKES`.
- **the mode, the line, the fish, splashes:** as the pond's, at the Reservoir, held by the fuzzer playing both.
- **the day:** midnight at the Reservoir (the wake at home); the morning's button names the last lake; the seasons
  dress the Reservoir too (its palette keys are the same).
- **the rung:** the governor measures the lake it booted into; lean at the Reservoir.
- **the phone:** the layout at the Reservoir's `phone` framing; the lakes page at the phone's width.
- **the switches:** `game.dirt`, `time`, `view` at the Reservoir; `?paint=off` on the dam.
- **the cabin:** the map clear of the eye, the door, the window and the calendar; a tap elsewhere on the wall does
  nothing; the room is the home's and drawn only there.
- **snags, the boat, the weather, the real clock, contamination's rules:** not reachable or unchanged.

## Decisions (mine, said so they can be changed)

- **Travel is a reload.** The alternative, rebuilding the scene in place, touches every memo and handover for a
  journey the player makes a few times a day. A boot under a fade is simpler and provably the same as a load.
- **The gear is the angler's** (the sum of cures), so the Sunny Atom's gifts are never taken back by a journey.
- **The journal is per lake** in the save and shown per lake, since its reads validate against the lake's counts;
  a merged book is a later nicety.
- **The Reservoir has a dam, no cabin, no treasures.** The dam is the one thing that makes it not a bigger pond; the
  cabin is home; the treasures' other sets are the design's own later slice.
- **The map is the picture.** The frame is already on the wall between the door and the window, in view from the
  pillow, and empty.

## Performance risk

- **Frame:** the Reservoir is bigger (more surface triangles, more grass cells, more trees); measured from the shore
  by day and held to 8 ms; the surface's `near` fine region keeps the triangle ceiling (`game.scenery()`), raised if
  the Reservoir needs it and said.
- **Boot:** unchanged at the pond (the same objects built once); the Reservoir's boot said.
- **Download:** the interface, the registry, the Reservoir's content, the page: about 3 kB gzipped, said exactly.
- **The save:** grows by the record's shape; `leaks` ceiling 2000 holds.

## Test plan

- **Unit:** `test/lakes.test.ts` (the Duck Pond object answers every geometry call as `lake.ts` did at a grid of
  points, held by a snapshot taken before the move; the Reservoir's `inside`, depths, boulders, fish slots, finds
  placed on its bed clear of each other; `contaminationAfter` per lake; `lakesWords`); every existing test that
  imported the pond's shape takes `DUCK_POND` instead; `test/saves.test.ts` (the flat save read as the pond's, the
  record, two new corpus files, the unknown lake, the gear sum); `test/invariants.test.ts` at both lakes;
  `test/cabinroom.test.ts` (the map's parts, the pin moving only with the lake, clear of everything, the ceiling).
- **End to end, `smoke/progress.spec.ts`:** a load at the Reservoir; a cure there moving only its entry; the lakes
  page from the map, the menu and the morning button, stopping the clock; travel both ways (waiting for `load`);
  the wake at the Reservoir landing at home; refused mid-fight.
- **Fuzzer:** each seed draws its lake from its own stream (half each), reloads keep the lake; determinism plays a
  seed at each lake; the bench and pace stay on the pond (the angler's aim is the lake's).
- **Leaks:** ceilings as the max over `LAKES`; the save bytes.
- **Pictures:** `reservoir-day`, `reservoir-dusk`, `reservoir-overhead`, `reservoir-fishing-bite`,
  `phone-reservoir`; `cabin-map` (the pin at home) and `cabin-map-reservoir`; `desk-lakes-page`, `phone-lakes-page`,
  `desk-morning-out` (the renamed button). Every existing picture unchanged after the refactor and after the feature.
- **Perf:** a test measuring the Reservoir from the shore by day, held to the budget; the standard scene as now.

## Parts

Built on `sonnet` by the `builder` agent, one at a time (they share `main.ts` and `lake.ts`), from `docs/lakes.md`,
which is this spec copied into the repo as part 0. Parts 1 to 3 are the refactor's commit; 4 to 8 the feature's.

- [x] 0. **The spec in the repo:** `docs/lakes.md`; `DESIGN.md` stage 11 says what this slice is. Check: Prettier.
- [x] 1. **The `Lake` interface and the Duck Pond as an object,** `lake.ts` cut to rules, the geometry snapshot test
      taken first from the old functions and held by the new object. Check: `test/lakes`, `check:quick`.
- [x] 2. **The builders take the lake:** scene, grass, shore field, surface, rocks, falls, cabin, room, finds, fish,
      bite, cast, lure, the draws, the invariants, the game, the angler, debug; the memos per lake. Check: every unit
      test green with `DUCK_POND` handed in; `npm run look` unchanged.
- [x] 3. **The page wires one lake,** `const lake = HOME` at boot (part 4 reads `save.lake` there), and the refactor's pass:
      `npm run check`, fuzz 1-24, the perf bytes written, every picture unchanged. Commit one.
- [x] 4. **The save per lake:** `lakes`, the flat read, the gear sum, the corpus files, the invariants, leaks.
      Check: `test/saves`, `test/game`, `test/invariants`.
- [x] 5. **The Reservoir's content** and its pictures, the fuzzer and determinism playing it, its perf test.
      Check: fuzz 1-24 at both lakes, the pictures looked at, the frame said.
- [x] 6. **Travel and the wake at home:** `game.travel`, the reload under the fade, the cabin load's fade-in, the
      morning button renamed. Check: the travel and wake stages.
- [x] 7. **The map and the lakes page:** the map's parts and pin, the tap, the page, the menu item, "Somewhere else…".
      Check: `test/cabinroom`, the page stages, the pictures.
- [x] 8. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (an unknown lake not read as
      the pond; a cure at the Reservoir written to the pond's entry; the map's pin not moving), the report. Commit two.
